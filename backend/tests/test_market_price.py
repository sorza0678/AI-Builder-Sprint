"""시세 함수 단위 테스트 — 네트워크 없이 순수 로직만 검증."""
from app import market_price


def test_trimmed_mean_cuts_outliers():
    # 미끼가격 500원과 뻥튀기 900만원이 절사되어야 한다
    prices = [500, 800_000, 820_000, 850_000, 880_000, 900_000, 9_000_000]
    avg = market_price.trimmed_mean(prices)
    assert 800_000 <= avg <= 900_000


def test_trimmed_mean_small_sample_uses_median():
    assert market_price.trimmed_mean([100, 200, 300]) == 200
    assert market_price.trimmed_mean([]) == 0


def test_build_keyword_strips_noise():
    kw = market_price.build_keyword("아이폰 14 프로 256GB 급처 팝니다!! 미개봉 🔥")
    assert "급처" not in kw and "팝니다" not in kw
    assert "아이폰" in kw


def test_fallback_price_table_match():
    price = market_price._fallback_price("아이폰 14 프로 딥퍼플", listing_price=850_000)
    assert price == market_price.FALLBACK_PRICES["아이폰 14 프로"]


def test_fallback_price_unknown_item_uses_listing_price():
    assert market_price._fallback_price("희귀 골동품 도자기", listing_price=300_000) == 300_000


# ---------- comparables (시세 근거 매물) ----------

def test_get_market_detail_returns_comparables(monkeypatch):
    """실측 성공 시 시세 근거 매물을 함께 반환하고, 중앙값에 가까운 순으로 고른다."""
    fake = [
        {"title": f"아이폰 14 프로 매물{i}", "price": p, "platform": "bunjang",
         "url": f"https://m.bunjang.co.kr/products/{i}", "location": "서울", "sold": None}
        for i, p in enumerate([100_000, 800_000, 850_000, 900_000, 950_000, 5_000_000])
    ]
    monkeypatch.setattr(market_price, "search_listings", lambda *a, **k: fake)

    d = market_price.get_market_detail("아이폰 14 프로", 900_000)
    assert d["measured"] is True
    assert 1 <= len(d["comparables"]) <= market_price.MAX_COMPARABLES
    prices = [c["price"] for c in d["comparables"]]
    # 극단값(10만원·500만원)보다 중앙값 근처가 먼저 선택돼야 한다
    assert 850_000 in prices and 5_000_000 not in prices
    assert all(c["url"].startswith("https://m.bunjang.co.kr/") for c in d["comparables"])


def test_get_market_detail_comparables_empty_on_failure(monkeypatch):
    """검색 실패·표본 부족이면 comparables 는 빈 배열 (지어내지 않는다)."""
    def boom(*a, **k):
        raise RuntimeError("network down")

    monkeypatch.setattr(market_price, "search_listings", boom)
    d = market_price.get_market_detail("아이폰 14 프로", 900_000)
    assert d["measured"] is False and d["comparables"] == []


def test_search_prices_still_returns_ints(monkeypatch):
    """기존 호출부 호환 — search_prices 는 여전히 정수 리스트."""
    monkeypatch.setattr(
        market_price, "search_listings",
        lambda *a, **k: [{"title": "x", "price": 500_000, "platform": "bunjang", "url": None, "location": None, "sold": None}],
    )
    assert market_price.search_prices("아이폰") == [500_000]


# ---------- 시세 표본 정확도 (자기 자신·다른 세대 제외) ----------

def test_extract_model_number():
    assert market_price.extract_model_number("아이폰 14 프로 256GB") == "14"
    assert market_price.extract_model_number("아이폰14프로 스페이스블랙") == "14"
    assert market_price.extract_model_number("갤럭시 S24 울트라 512GB") == "24"
    assert market_price.extract_model_number("맥북 프로 128기가") is None  # 용량만 있음
    assert market_price.extract_model_number("스톤아일랜드 패딩") is None


def test_excludes_self_from_market_sample(monkeypatch):
    """분석 대상 자신의 호가가 자기 시세에 섞이면 안 된다 (항상 '적정가'로 보임)."""
    me = "https://m.bunjang.co.kr/products/999"
    fake = [
        {"title": "아이폰 14 프로 A", "price": 9_000_000, "platform": "bunjang",
         "url": me, "location": None, "sold": None},
    ] + [
        {"title": f"아이폰 14 프로 {i}", "price": 900_000, "platform": "bunjang",
         "url": f"https://m.bunjang.co.kr/products/{i}", "location": None, "sold": None}
        for i in range(6)
    ]
    monkeypatch.setattr(market_price, "search_listings", lambda *a, **k: fake)

    d = market_price.get_market_detail("아이폰 14 프로", 900_000, exclude_url=me)
    assert d["max"] == 900_000, "자기 자신(900만원)이 표본에 남아있음"
    assert all("/products/999" not in (c["url"] or "") for c in d["comparables"])


def test_excludes_other_generations(monkeypatch):
    """아이폰 14 프로 시세에 15/16/17 프로가 섞이면 안 된다."""
    fake = [
        {"title": f"아이폰 14 프로 매물{i}", "price": 900_000, "platform": "bunjang",
         "url": f"https://m.bunjang.co.kr/products/1{i}", "location": None, "sold": None}
        for i in range(6)
    ] + [
        {"title": f"[미사용] 아이폰{g}프로 재고정리", "price": 590_000, "platform": "bunjang",
         "url": f"https://m.bunjang.co.kr/products/2{g}", "location": None, "sold": None}
        for g in (15, 16, 17)
    ]
    monkeypatch.setattr(market_price, "search_listings", lambda *a, **k: fake)

    d = market_price.get_market_detail("아이폰 14 프로", 900_000)
    assert d["sample_count"] == 6, "다른 세대가 표본에 남아있음"
    assert all("14" in c["title"] for c in d["comparables"])


def test_model_filter_falls_back_when_too_few(monkeypatch):
    """같은 세대 표본이 너무 적으면 필터를 포기한다 (없는 것보단 오염된 표본이 낫다)."""
    fake = [
        {"title": "아이폰 14 프로", "price": 900_000, "platform": "bunjang",
         "url": "https://m.bunjang.co.kr/products/1", "location": None, "sold": None},
    ] + [
        {"title": f"아이폰 15 프로 {i}", "price": 1_000_000, "platform": "bunjang",
         "url": f"https://m.bunjang.co.kr/products/2{i}", "location": None, "sold": None}
        for i in range(6)
    ]
    monkeypatch.setattr(market_price, "search_listings", lambda *a, **k: fake)

    d = market_price.get_market_detail("아이폰 14 프로", 900_000)
    assert d["measured"] is True and d["sample_count"] == 7


def test_excludes_keyword_stuffing_listings(monkeypatch):
    """'아이폰17프로 [13,14,15,16]' 같이 모든 세대를 나열한 낚시 매물은 비교 대상 아님."""
    # 낚시 판정은 _same_model 이 아니라 is_bait_listing 소관 (모델 번호 없이도 걸러야 하므로)
    assert market_price.is_bait_listing("[미사용] 아이폰17프로 재고정리 [13,14,15,16]") is True
    assert market_price.is_bait_listing("아이폰 14 프로 골드 128기가 배터리 90") is False
    assert market_price._same_model("아이폰 14 프로 골드 128기가 배터리 90", "14") is True
    # 정상 제목에 숫자가 여럿 있어도 오탐하지 않는다
    assert market_price.is_bait_listing("갤럭시 S24 울트라 512GB 5G 1년 사용") is False
    assert market_price._same_model("갤럭시 S24 울트라 512GB 5G 1년 사용", "24") is True

    fake = [
        {"title": f"아이폰 14 프로 정상매물{i}", "price": 900_000, "platform": "bunjang",
         "url": f"https://m.bunjang.co.kr/products/1{i}", "location": None, "sold": None}
        for i in range(6)
    ] + [
        {"title": "[미사용/새상품] 아이폰17프로 재고정리 할인 [13,14,15,16]", "price": 590_000,
         "platform": "bunjang", "url": "https://m.bunjang.co.kr/products/99", "location": None, "sold": None}
    ]
    monkeypatch.setattr(market_price, "search_listings", lambda *a, **k: fake)
    d = market_price.get_market_detail("아이폰 14 프로", 900_000)
    assert d["sample_count"] == 6
    assert all("재고정리" not in c["title"] for c in d["comparables"])


def test_comparables_stay_clean_even_when_stats_fall_back(monkeypatch):
    """깨끗한 표본이 부족해 통계는 전체로 폴백해도, 보여주는 근거 매물은 오염되면 안 된다."""
    clean_items = [
        {"title": f"아이폰 14 프로 정상{i}", "price": 900_000, "platform": "bunjang",
         "url": f"https://m.bunjang.co.kr/products/1{i}", "location": None, "sold": None}
        for i in range(2)  # MIN_SAMPLES 미만
    ]
    dirty_items = [
        {"title": "[미사용] 아이폰17프로 재고정리 [13,14,15,16]", "price": 590_000,
         "platform": "bunjang", "url": f"https://m.bunjang.co.kr/products/9{i}",
         "location": None, "sold": None}
        for i in range(6)
    ]
    monkeypatch.setattr(market_price, "search_listings", lambda *a, **k: clean_items + dirty_items)

    d = market_price.get_market_detail("아이폰 14 프로", 900_000)
    assert d["measured"] is True and d["sample_count"] == 8  # 통계는 전체 폴백
    assert len(d["comparables"]) == 2                        # 근거는 깨끗한 것만
    assert all("재고정리" not in c["title"] for c in d["comparables"])


# ---------- 리뷰에서 확정된 필터 버그 2건 회귀 방지 ----------

def test_extract_model_number_ignores_non_model_numbers():
    """중고 제목에 섞인 배터리%·판매자코드·수량을 모델 번호로 오인하면 안 된다."""
    cases = [
        ("(배터리90)아이폰 14 프로 Pro 스페이스 블랙 256GB 256기가", "14"),
        ("배터리 90 아이폰 15 프로 256GB 블랙티타늄", "15"),
        ("아이폰 13 기스 없음", "13"),          # '기스'의 '기'를 용량 단위로 오인하던 버그
        ("(152) 특가 배터리90 아이폰14프로 128G 골드 A+급", "14"),
        ("216239 아이폰14프로 팝니다", "14"),   # 긴 판매자 코드를 쪼개 '39'로 읽던 버그
        ("[3/2 가격인하] 아이폰 14 프로 256GB", "14"),
        ("2개남음 아이폰 14 프로", "14"),
        ("갤럭시 S24 울트라 512GB", "24"),
        ("갤럭시 Z플립5 자급제", "5"),
        ("맥북 프로 128기가", None),            # 용량만 있으면 모델 번호 없음
        ("스톤아일랜드 패딩 L", None),
    ]
    for title, expected in cases:
        assert market_price.extract_model_number(title) == expected, title


def test_bait_filter_applies_without_model_number(monkeypatch):
    """모델 번호를 못 뽑는 검색에서도 낚시 매물은 근거·통계에서 제외돼야 한다.

    (이전엔 스터핑 검사가 _same_model 안에만 있어 model=None 이면 통째로 우회됐다 —
     사기 검증 서비스가 미끼 매물을 '시세 근거'로 링크째 노출하던 버그)
    """
    bait = [
        {"title": f"[미사용] 아이폰{g}프로 재고정리 [13,14,15,16]", "price": 590_000,
         "platform": "bunjang", "url": f"https://m.bunjang.co.kr/products/9{g}",
         "location": None, "sold": None}
        for g in (15, 16, 17)
    ]
    real = [
        {"title": f"아이폰 프로 맥스 정상매물{i}", "price": 1_100_000, "platform": "bunjang",
         "url": f"https://m.bunjang.co.kr/products/1{i}", "location": None, "sold": None}
        for i in range(6)
    ]
    monkeypatch.setattr(market_price, "search_listings", lambda *a, **k: bait + real)

    # 모델 번호를 뽑을 수 없는 제목
    assert market_price.extract_model_number("아이폰 프로 맥스 팝니다") is None
    d = market_price.get_market_detail("아이폰 프로 맥스 팝니다", 1_000_000)
    assert all(not market_price.is_bait_listing(c["title"]) for c in d["comparables"])
    assert d["sample_count"] == 6, "낚시 매물이 통계 표본에 남아있음"


def test_recommendations_exclude_bait(monkeypatch):
    monkeypatch.setattr(
        market_price, "search_listings",
        lambda *a, **k: [
            {"title": "[미사용] 아이폰17프로 재고정리 [13,14,15,16]", "price": 590_000,
             "platform": "bunjang", "url": "https://m.bunjang.co.kr/products/99",
             "location": None, "sold": None},
            {"title": "아이폰 14 프로 정상매물", "price": 900_000, "platform": "bunjang",
             "url": "https://m.bunjang.co.kr/products/11", "location": None, "sold": None},
        ],
    )
    items = market_price.recommend(["아이폰 14 프로"])
    assert items and all(not market_price.is_bait_listing(i["title"]) for i in items)


def test_search_is_cached(monkeypatch):
    """같은 키워드 재검색은 외부 호출 없이 캐시에서 — 데모 반복·차단 위험 완화."""
    calls = {"n": 0}

    def fake(keyword, limit):
        calls["n"] += 1
        return [{"title": "아이폰 14 프로", "price": 900_000, "platform": "bunjang",
                 "url": "https://m.bunjang.co.kr/products/1", "location": None, "sold": None}]

    monkeypatch.setattr(market_price, "_search_listings_uncached", fake)
    market_price.search_listings("아이폰 14 프로")
    market_price.search_listings("아이폰 14 프로")
    assert calls["n"] == 1, "캐시가 동작하지 않아 외부 호출이 반복됨"
    market_price.search_listings("갤럭시 S24")  # 다른 키워드는 새로 호출
    assert calls["n"] == 2


def test_cache_does_not_store_failures(monkeypatch):
    """일시적 실패가 TTL 동안 굳어버리면 안 된다."""
    state = {"fail": True}

    def flaky(keyword, limit):
        if state["fail"]:
            raise RuntimeError("네트워크 일시 오류")
        return [{"title": "아이폰 14 프로", "price": 900_000, "platform": "bunjang",
                 "url": None, "location": None, "sold": None}]

    monkeypatch.setattr(market_price, "_search_listings_uncached", flaky)
    d1 = market_price.get_market_detail("아이폰 14 프로", 900_000)
    assert d1["measured"] is False
    state["fail"] = False
    assert market_price.search_listings("아이폰 14 프로"), "실패가 캐시돼 복구 후에도 빈 결과"
