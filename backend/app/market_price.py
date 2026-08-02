"""STEP 4: 시세 함수 — 번개장터 검색 → 가격 목록 → trimmed mean.

검색 결과에는 광고(매입/수리), 액세서리(케이스/필름), 미끼가격(500원)이 섞여
있으므로 키워드·가격 필터 + 양끝 20% 절사평균으로 방어한다.
실패하거나 표본이 적으면 FALLBACK_PRICES 로 폴백 (데모 안죽게).
"""
import logging
import re
import statistics
from datetime import datetime, timezone

import httpx

from app import cache
from app.scraper import TIMEOUT, UA

logger = logging.getLogger(__name__)

# 시세는 몇 분 사이에 의미 있게 변하지 않는다 — 같은 키워드 재검색을 캐시해
# 데모 응답을 빠르게 하고 번개장터 호출 빈도를 낮춘다 (차단 위험 완화).
SEARCH_CACHE_TTL = 300.0

# 검색 결과에서 제외할 잡음 (액세서리·광고·부품)
NOISE_WORDS = [
    "케이스", "필름", "매입", "삽니다", "수리", "부품", "액정만", "기판",
    "스티커", "커버", "충전기", "케이블", "거치대", "스트랩", "파우치",
]
MIN_PRICE = 10_000       # 이보다 싸면 액세서리/미끼로 간주
MIN_SAMPLES = 5          # 표본이 이보다 적으면 폴백

# 제목에서 검색 키워드를 만들 때 버릴 판매 상투어
STOPWORDS = [
    "팝니다", "판매", "급처", "급매", "미개봉", "새상품", "정품", "상태",
    "A급", "S급", "직거래", "택배", "네고", "가능", "완전", "풀박스",
]

FALLBACK_PRICES: dict[str, int] = {
    "아이폰 15": 1_050_000,
    "아이폰 14 프로": 920_000,
    "아이폰 14": 750_000,
    "아이폰 13": 550_000,
    "갤럭시 S24": 1_150_000,
    "갤럭시 S23": 700_000,
    "맥북 프로": 2_400_000,
    "맥북 에어": 1_300_000,
    "아이패드": 600_000,
    "에어팟": 180_000,
    "닌텐도 스위치": 250_000,
    "플레이스테이션": 550_000,
}


def build_keyword(title: str) -> str:
    """매물 제목 → 검색 키워드 (상투어·이모지 제거, 앞쪽 4토큰)."""
    text = re.sub(r"[^\w\s가-힣]", " ", title)
    tokens = [t for t in text.split() if t not in STOPWORDS and len(t) > 1]
    return " ".join(tokens[:4]) or title[:20]


# 모델 번호 바로 뒤에 오면 그 숫자는 모델이 아니라 수량·용량·비율이다.
# '기(?![가-힣])' — '128기가'의 '기'는 용량이지만 '13 기스'의 '기'는 아니다.
_UNIT_AFTER = re.compile(
    r"^\s*(gb|tb|기가|기(?![가-힣])|%|퍼|프로센트|개|년|월|일|명|원|만원|인치|w|k)",
    re.IGNORECASE,
)
# 이 단어 뒤의 숫자는 배터리 잔량 등 상태 수치 — 모델 번호가 아니다
_STATE_BEFORE = re.compile(r"(배터리|효율|성능|잔량|사이클|용량|약)\s*$")
# 브랜드·제품명 바로 뒤 숫자가 가장 확실한 모델 번호 ('아이폰14프로', '갤럭시 S24')
_BRAND_MODEL = re.compile(
    r"(?:아이폰|iphone|갤럭시|galaxy|아이패드|ipad|맥북|macbook|갤탭|플립|폴드|노트|note|"
    r"에어팟|airpods|워치|watch|스위치|switch|픽셀|pixel|[sz])\s*(\d{1,2})(?![\d])",
    re.IGNORECASE,
)


def extract_model_number(title: str) -> str | None:
    """제목에서 모델 번호를 뽑는다 ('아이폰 14 프로 256GB' → '14').

    검색 결과에 다른 세대(아이폰 15/16/17)가 섞여 시세를 오염시키는 걸 막기 위함.
    중고 제목에는 모델 번호가 아닌 숫자가 많이 섞인다 —
    '(배터리90)아이폰 14 프로'의 90, '(152) 특가'의 152, '256GB'의 256 같은 것들.
    그래서 ① 브랜드 바로 뒤 숫자를 먼저 찾고, ② 없으면 단위·상태 수치를 걸러가며 훑는다.
    """
    text = re.sub(r"[^\w\s가-힣%]", " ", title)

    brand = _BRAND_MODEL.search(text)
    if brand:
        return brand.group(1)

    for m in re.finditer(r"\d+", text):  # 숫자 덩어리 전체 (판매자 코드 '216239' 를 쪼개지 않게)
        number = m.group(0)
        if len(number) > 2:  # 128·256·512 용량, 긴 판매자 코드
            continue
        if _UNIT_AFTER.match(text[m.end():]):
            continue
        if _STATE_BEFORE.search(text[: m.start()]):
            continue
        return number
    return None


# "아이폰17프로 재고정리 [13,14,15,16]" 처럼 모든 세대 번호를 나열해 검색에 걸리게 하는
# 낚시성 매물 — 정상 매물은 한 제품만 팔므로 세대 번호를 나열하지 않는다.
_NUMBER_STUFFING = re.compile(r"\d{1,2}\s*[,/·]\s*\d{1,2}\s*[,/·]\s*\d{1,2}")


def is_bait_listing(title: str) -> bool:
    """모든 세대 번호를 나열해 검색마다 걸리게 하는 낚시 매물인지.

    모델 번호를 못 뽑는 매물에도 반드시 적용돼야 한다 — 이 검사가 _same_model 안에만
    있으면, 모델 번호 없는 검색에서 낚시 매물이 근거 매물로 그대로 노출된다.
    """
    return bool(_NUMBER_STUFFING.search(title))


def _same_model(candidate_title: str, model_number: str) -> bool:
    """후보 제목이 같은 모델 번호를 가지는지 (다른 세대 배제)."""
    numbers = re.findall(r"\d{1,4}", re.sub(r"[^\w\s가-힣]", " ", candidate_title))
    small = [n for n in numbers if len(n) <= 2]
    if not small:
        return False  # 모델 번호가 없는 매물(부품·잡화 등)은 비교 대상에서 제외
    return model_number in small


def trimmed_mean(prices: list[int], trim_ratio: float = 0.2) -> int:
    """양끝 trim_ratio 씩 잘라낸 평균. 표본이 적으면 중앙값."""
    if len(prices) < MIN_SAMPLES:
        return int(statistics.median(prices)) if prices else 0
    s = sorted(prices)
    k = int(len(s) * trim_ratio)
    core = s[k : len(s) - k] or s
    return int(statistics.mean(core))


def search_listings(keyword: str, limit: int = 30) -> list[dict]:
    """번개장터 검색 → 시세 표본이 된 매물 목록 (5분 캐시). 실패 시 예외.

    가격만 뽑고 버리던 제목·링크·지역을 함께 보존한다 —
    프론트가 "이 시세는 어떤 매물들로 계산됐나"를 사용자에게 보여줄 수 있어야 하기 때문.
    """
    return cache.get_or_call(
        f"search:{keyword}:{limit}", SEARCH_CACHE_TTL, lambda: _search_listings_uncached(keyword, limit)
    )


def _search_listings_uncached(keyword: str, limit: int) -> list[dict]:
    r = httpx.get(
        "https://api.bunjang.co.kr/api/1/find_v2.json",
        params={"q": keyword, "order": "score", "page": 0, "n": limit * 2},
        headers={"User-Agent": UA},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    listings = []
    for item in r.json().get("list", []):
        name = item.get("name", "")
        try:
            price = int(item.get("price") or 0)
        except (TypeError, ValueError):
            continue
        if price < MIN_PRICE:
            continue
        if any(w in name for w in NOISE_WORDS):
            continue
        pid = item.get("pid")
        listings.append(
            {
                "title": name,
                "price": price,
                "platform": "bunjang",
                "url": f"https://m.bunjang.co.kr/products/{pid}" if pid else None,
                "location": item.get("location") or None,
                # 검색 API는 판매중 매물만 반환해 판매완료 여부를 알 수 없다 → null
                # (즉 이 값들은 실거래가가 아니라 '호가'다)
                "sold": None,
            }
        )
        if len(listings) >= limit:
            break
    return listings


def search_prices(keyword: str, limit: int = 30) -> list[int]:
    """가격 표본만 필요할 때 (search_listings의 요약 버전)."""
    return [item["price"] for item in search_listings(keyword, limit)]


def _fallback_price(title: str, listing_price: int | None) -> int:
    """검색 실패 시: 키워드 테이블 매칭 → 그래도 없으면 매물가 기반 추정."""
    flat = title.replace(" ", "").lower()
    for key, price in FALLBACK_PRICES.items():
        if key.replace(" ", "").lower() in flat:
            return price
    # 최후의 보루 — 시세 미상: 매물가를 그대로 시세로 봐서 가격 규칙이 중립이 되게 한다
    return listing_price or 500_000


MAX_COMPARABLES = 5


def _same_listing(url_a: str | None, url_b: str | None) -> bool:
    """같은 매물인지 — 상품 id 로 비교 (m./www. 등 도메인 표기 차이 무시)."""
    if not url_a or not url_b:
        return False
    ids = [re.search(r"/products/(\d+)", u or "") for u in (url_a, url_b)]
    return bool(ids[0] and ids[1] and ids[0].group(1) == ids[1].group(1))


def get_market_detail(
    title: str, listing_price: int | None, exclude_url: str | None = None
) -> dict:
    """제목 → 시세 상세 + 근거 매물. 어떤 경우에도 예외를 던지지 않는다.

    실측 성공: min/average/max/sample_count/confidence 와 comparables(근거 매물) 반환.
    실측 실패(검색 불가·표본 부족): average만 폴백값, 나머지는 null, comparables 는 빈 배열 —
    프론트가 "표본 없는 평균가"를 실측처럼 신뢰하지 않도록 정직하게 구분한다.
    confidence: 표본 30개면 1.0이 되는 단순 비율 (0~1).
    exclude_url: 분석 중인 매물 자신 — 자기 가격이 자기 시세에 섞이지 않게 제외한다.
    """
    calculated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        listings = search_listings(build_keyword(title))
    except Exception as e:
        logger.warning("시세 검색 실패 → FALLBACK_PRICES 사용: '%s' (%s)", title[:40], e)
        listings = []

    # 1) 분석 대상 자신 제외 — 자기 호가로 자기 시세를 만들면 항상 "적정가"가 된다
    if exclude_url:
        listings = [x for x in listings if not _same_listing(x.get("url"), exclude_url)]

    # 2) 낚시 매물 제외 — 모델 번호를 못 뽑는 검색에서도 반드시 걸러야 한다.
    #    (사기 검증 서비스가 미끼 매물을 '시세 근거'라며 링크째 보여주면 안 된다)
    no_bait = [x for x in listings if not is_bait_listing(x["title"])]

    # 3) 다른 세대 제외 (아이폰 14 프로 시세에 15/16/17 이 섞이는 문제)
    model = extract_model_number(title)
    clean = [x for x in no_bait if _same_model(x["title"], model)] if model else no_bait

    # 통계는 표본 수가 필요하므로 단계적으로 폴백한다: 같은세대 → 낚시제외 → 전체.
    # 다만 사용자에게 보여줄 근거(comparables)는 언제나 clean 에서만 고른다 —
    # 아이폰 14 시세라면서 17 매물을 근거로 보여주는 게 표본 몇 개보다 훨씬 나쁘다.
    if len(clean) >= MIN_SAMPLES:
        stat_source = clean
    elif len(no_bait) >= MIN_SAMPLES:
        stat_source = no_bait
    else:
        stat_source = listings

    prices = [item["price"] for item in stat_source]
    if len(prices) >= MIN_SAMPLES:
        # 중앙값에 가까운 순으로 골라 보여준다 — 양끝 이상치보다 시세를 대표한다
        median = statistics.median(prices)
        comparables = sorted(clean, key=lambda x: abs(x["price"] - median))[:MAX_COMPARABLES]
        return {
            "min": min(prices),
            "average": trimmed_mean(prices),
            "max": max(prices),
            "sample_count": len(prices),
            "calculated_at": calculated_at,
            "confidence": round(min(1.0, len(prices) / 30), 2),
            "measured": True,
            "comparables": comparables,
        }
    return {
        "min": None,
        "average": _fallback_price(title, listing_price),
        "max": None,
        "sample_count": len(prices),
        "calculated_at": calculated_at,
        "confidence": None,
        "measured": False,
        "comparables": [],
    }


def get_market_price(title: str, listing_price: int | None) -> tuple[int, bool]:
    """제목 → (시세 평균, 실측 여부). get_market_detail의 요약 버전 (기존 호출부 호환)."""
    detail = get_market_detail(title, listing_price)
    return detail["average"], detail["measured"]


MAX_RECOMMENDATIONS = 6


def recommend(titles: list[str], exclude_urls: set[str] | None = None) -> list[dict]:
    """사용자가 실제로 분석/찜한 매물 제목 → 같은 모델의 현재 판매중 매물 추천.

    행동 기록(titles)이 없으면 빈 배열 — 근거 없는 임의 추천은 만들지 않는다 (문서 18 원칙).
    이미 본 매물은 exclude_urls 로 제외한다.
    """
    if not titles:
        return []
    exclude_urls = exclude_urls or set()
    seen_ids, out = set(), []
    for title in titles[:3]:  # 최근·찜한 관심사 위주로 몇 개만
        try:
            candidates = search_listings(build_keyword(title), limit=10)
        except Exception as e:
            logger.info("추천 검색 실패, 건너뜀: '%s' (%s)", title[:30], e)
            continue
        model = extract_model_number(title)
        for item in candidates:
            if is_bait_listing(item["title"]):  # 추천에도 낚시 매물이 섞이면 안 된다
                continue
            if model and not _same_model(item["title"], model):
                continue
            url = item.get("url")
            # 이미 분석한 매물은 추천에서 제외 (도메인 표기가 달라도 상품 id 로 대조)
            if not url or url in seen_ids or any(_same_listing(url, u) for u in exclude_urls):
                continue
            seen_ids.add(url)
            out.append({**item, "reason": f"최근 관심 매물 '{title[:20]}'과 같은 모델"})
            if len(out) >= MAX_RECOMMENDATIONS:
                return out
    return out
