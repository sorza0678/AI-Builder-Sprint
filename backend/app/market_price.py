"""STEP 4: 시세 함수 — 번개장터 검색 → 가격 목록 → trimmed mean.

검색 결과에는 광고(매입/수리), 액세서리(케이스/필름), 미끼가격(500원)이 섞여
있으므로 키워드·가격 필터 + 양끝 20% 절사평균으로 방어한다.
실패하거나 표본이 적으면 FALLBACK_PRICES 로 폴백 (데모 안죽게).
"""
import re
import statistics

import httpx

from app.scraper import UA, TIMEOUT

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


def trimmed_mean(prices: list[int], trim_ratio: float = 0.2) -> int:
    """양끝 trim_ratio 씩 잘라낸 평균. 표본이 적으면 중앙값."""
    if len(prices) < MIN_SAMPLES:
        return int(statistics.median(prices)) if prices else 0
    s = sorted(prices)
    k = int(len(s) * trim_ratio)
    core = s[k : len(s) - k] or s
    return int(statistics.mean(core))


def search_prices(keyword: str, limit: int = 30) -> list[int]:
    """번개장터 검색 API에서 유효한 가격 표본 수집. 실패 시 예외."""
    r = httpx.get(
        "https://api.bunjang.co.kr/api/1/find_v2.json",
        params={"q": keyword, "order": "score", "page": 0, "n": limit * 2},
        headers={"User-Agent": UA},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    prices = []
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
        prices.append(price)
        if len(prices) >= limit:
            break
    return prices


def _fallback_price(title: str, listing_price: int | None) -> int:
    """검색 실패 시: 키워드 테이블 매칭 → 그래도 없으면 매물가 기반 추정."""
    flat = title.replace(" ", "").lower()
    for key, price in FALLBACK_PRICES.items():
        if key.replace(" ", "").lower() in flat:
            return price
    # 최후의 보루 — 시세 미상: 매물가를 그대로 시세로 봐서 가격 규칙이 중립이 되게 한다
    return listing_price or 500_000


def get_market_price(title: str, listing_price: int | None) -> tuple[int, bool]:
    """제목 → (시세 평균, 실측 여부). 어떤 경우에도 예외를 던지지 않는다."""
    try:
        prices = search_prices(build_keyword(title))
        if len(prices) >= MIN_SAMPLES:
            return trimmed_mean(prices), True
    except Exception:
        pass
    return _fallback_price(title, listing_price), False
