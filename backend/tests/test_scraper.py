"""scraper.py 스크래핑 정확도·안전성 검증.

JSON-LD 파싱과 cafe.naver.com 단락 처리는 실제 매물 페이지(daangn.com,
web.joongna.com, cafe.naver.com)에 대한 실측 확인을 거쳐 작성됨.
네트워크 호출 없이 동작을 검증하기 위해 httpx.get 은 fixture HTML로 monkeypatch한다.
"""
import httpx
import pytest

from app import scraper


class _FakeResponse:
    def __init__(self, text: str, status_code: int = 200):
        self.text = text
        self.status_code = status_code

    def raise_for_status(self):
        pass


DAANGN_HTML = """
<html><head>
<meta property="og:title" content="아이폰 se6 | 디지털기기 | 당근 중고거래">
<meta property="og:description" content="중고폰 1ㅇ만원 아이가 중고폰으로구입">
<meta property="og:image" content="https://karrotmarket.com/_remix/img_og_fallback_kr.png">
<script type="application/ld+json">
{"@context": "https://schema.org", "@type": "Product", "name": "아이폰 se6",
 "description": "실제 상품 설명", "image": "https://dnvefa72aowie.cloudfront.net/real.png",
 "offers": {"@type": "Offer", "price": "120000.0", "priceCurrency": "KRW"}}
</script>
<script type="application/ld+json">
{"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": []}
</script>
</head><body></body></html>
"""

CAFE_NAVER_SHELL_HTML = """
<html><head><title>중고나라 : 네이버 카페</title></head>
<body><iframe id="cafe_main" src="about:blank"></iframe></body></html>
"""


def test_json_ld_product_preferred_over_og_tags(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse(DAANGN_HTML))

    result = scraper.scrape_listing("https://www.daangn.com/kr/buy-sell/example-abc123/")

    assert result["scrape_ok"] is True
    assert result["title"] == "아이폰 se6"
    assert result["price"] == 120_000  # JSON-LD offers.price, not the "1ㅇ만원" text in og:description
    assert result["image"] == "https://dnvefa72aowie.cloudfront.net/real.png"


def test_falls_back_to_og_tags_when_no_ld_json(monkeypatch):
    html = (
        '<html><head><meta property="og:title" content="번개장터st 매물">'
        '<meta property="og:description" content="가격: 50,000원">'
        '<meta property="og:image" content="https://example.com/img.png"></head></html>'
    )
    monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse(html))

    result = scraper.scrape_listing("https://joongna.com/product/1")

    assert result["scrape_ok"] is True
    assert result["title"] == "번개장터st 매물"
    assert result["price"] == 50_000
    assert result["image"] == "https://example.com/img.png"


def test_cafe_naver_com_short_circuits_without_network_call(monkeypatch):
    def _fail_if_called(*args, **kwargs):
        raise AssertionError("cafe.naver.com should not trigger an HTTP request")

    monkeypatch.setattr(httpx, "get", _fail_if_called)

    result = scraper.scrape_listing("https://cafe.naver.com/joonggonara/665605032")

    assert result["scrape_ok"] is False
    assert result["platform"] == "joongna"


def test_cafe_naver_com_would_otherwise_look_like_a_success(monkeypatch):
    """회귀 확인용: 단락 처리가 없으면 SPA 쉘의 제네릭 <title>이 '성공'으로 오인된다."""
    monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse(CAFE_NAVER_SHELL_HTML))

    title = scraper._meta(CAFE_NAVER_SHELL_HTML, "og:title")
    assert title is None  # og:title 자체가 없음 — <title> 태그만으로는 실제 매물 여부를 알 수 없다


@pytest.mark.parametrize(
    "offers,expected",
    [
        ({"price": "8000"}, 8_000),
        ({"price": 8000}, 8_000),
        ([{"price": "5000"}], 5_000),  # 일부 사이트는 offers를 배열로 감싼다
        ({"price": "999"}, None),  # 하한(1,000원) 미만은 오탐으로 간주해 버림
        ({}, None),
        (None, None),
    ],
)
def test_price_from_offers(offers, expected):
    assert scraper._price_from_offers(offers) == expected


def test_find_ld_product_ignores_non_product_blocks_and_malformed_json():
    html = """
    <script type="application/ld+json">not valid json</script>
    <script type="application/ld+json">{"@type": "BreadcrumbList"}</script>
    <script type="application/ld+json">{"@type": "Product", "name": "실제 상품"}</script>
    """
    product = scraper._find_ld_product(html)
    assert product == {"@type": "Product", "name": "실제 상품"}


# ---------- SSRF 방어 (보안 점검에서 실제 재현된 취약점) ----------

def test_is_public_url_blocks_internal_targets():
    from app import scraper as s

    blocked = [
        "http://127.0.0.1:8000/admin",       # 루프백 — 같은 서버의 내부 API
        "http://localhost:9911/",
        "http://169.254.169.254/latest/meta-data/",  # 클라우드 메타데이터 = 서버 자격증명
        "http://10.0.0.5/internal",          # 사설망
        "http://192.168.0.1/router",
        "http://[::1]:8000/",
        "file:///etc/passwd",                # http(s) 아닌 스킴
        "gopher://evil/",
        "http://0.0.0.0/",
    ]
    for url in blocked:
        assert s.is_public_url(url) is False, f"차단돼야 함: {url}"


def test_is_public_url_allows_real_sites():
    from app import scraper as s

    assert s.is_public_url("https://m.bunjang.co.kr/products/123") is True
    assert s.is_public_url("https://www.daangn.com/articles/1") is True


def test_scrape_listing_returns_fallback_for_internal_url():
    """내부망 URL 은 예외 없이 fallback(scrape_ok=False) → /analyze 가 400 SCRAPE_FAILED."""
    from app import scraper as s

    result = s.scrape_listing("http://127.0.0.1:8000/admin")
    assert result["scrape_ok"] is False


# ---------- posted_at (매물 등록 시각) ----------

def test_iso_utc_normalizes_various_formats():
    from app import scraper as s

    assert s._iso_utc("2026-08-02T01:26:28.755683Z") == "2026-08-02T01:26:28Z"
    assert s._iso_utc("2026-07-30T02:53:55Z") == "2026-07-30T02:53:55Z"
    assert s._iso_utc("2026-07-30T11:53:55+09:00") == "2026-07-30T02:53:55Z"  # KST → UTC
    for bad in (None, "", "어제", 12345, "not-a-date"):
        assert s._iso_utc(bad) is None


def test_posted_at_from_og_published_time(monkeypatch):
    html = (
        '<html><head><meta property="og:title" content="테스트 매물">'
        '<meta property="og:description" content="가격: 50,000원">'
        '<meta property="article:published_time" content="2026-07-30T11:53:55+09:00">'
        "</head></html>"
    )
    monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse(html))
    result = scraper.scrape_listing("https://joongna.com/product/1")
    assert result["posted_at"] == "2026-07-30T02:53:55Z"


def test_posted_at_null_when_absent(monkeypatch):
    html = '<html><head><meta property="og:title" content="테스트 매물"></head></html>'
    monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse(html))
    assert scraper.scrape_listing("https://joongna.com/product/1")["posted_at"] is None
