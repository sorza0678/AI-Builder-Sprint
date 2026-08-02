"""STEP 3: 매물 URL 파싱 — 플랫폼 판별 + 제목/가격/설명 추출.

원칙: 스크래핑은 언제든 막힐 수 있다. 어떤 실패에도 예외를 밖으로 던지지 않고
FALLBACK_LISTING 을 반환한다 (데모 안죽게). fallback 여부는 scrape_ok 로 표시.
"""
import ipaddress
import json
import re
import socket
from urllib.parse import urljoin, urlparse

import httpx

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)
TIMEOUT = 6.0

PLATFORM_DOMAINS = {
    "daangn.com": "daangn",
    "karrotmarket.com": "daangn",
    "bunjang.co.kr": "bunjang",
    "joongna.com": "joongna",
    "cafe.naver.com": "joongna",  # 중고나라 카페
    "hellomarket.com": "hello",
}

# cafe.naver.com(구 중고나라 카페 링크)은 og태그·JSON-LD 없이 완전히 클라이언트에서
# 렌더링되는 SPA 쉘이라 og태그 스크래핑으로는 실제 매물 정보를 얻을 수 없다 (실측 확인됨).
# 같은 콘텐츠가 web.joongna.com 에는 정상적으로 노출되므로, 그쪽 링크는 이 목록에 없다.
KNOWN_UNSCRAPABLE_HOSTS = {"cafe.naver.com", "m.cafe.naver.com"}

# 스크래핑 완전 실패 시 데모용 고정 매물
FALLBACK_LISTING = {
    "platform": "unknown",
    "title": "아이폰 14 프로 256GB 딥퍼플 (상태 A급)",
    "price": 850_000,
    "description": "생활기스 약간 있고 배터리 효율 88%입니다. 박스 없음, 직거래 선호합니다.",
    "image": None,
    "location": None,
    "seller_trade_count": None,
    "seller_account_age_days": None,
    "scrape_ok": False,
}


def detect_platform(url: str) -> str:
    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:  # 'http://[' 같은 깨진 IPv6 표기 — urlparse가 여기서 던진다
        return "unknown"
    for domain, name in PLATFORM_DOMAINS.items():
        if host == domain or host.endswith("." + domain):
            return name
    return "unknown"


MAX_REDIRECTS = 3


def is_public_url(url: str) -> bool:
    """SSRF 방어: 외부 공개 주소만 허용.

    사용자가 준 URL 로 서버가 대신 요청하므로, 막지 않으면 공격자가
    http://127.0.0.1:8000/... (내부 서비스) 나 http://169.254.169.254/... (클라우드
    메타데이터 = 서버 자격증명) 같은 내부망 주소를 긁어오게 시킬 수 있다.
    호스트명을 실제로 DNS 조회해서, 하나라도 사설/루프백/링크로컬로 풀리면 거부한다.
    """
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https"):
        return False  # file://, gopher:// 등 차단
    host = parsed.hostname
    if not host:
        return False
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
    except (socket.gaierror, UnicodeError, ValueError):
        return False
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            return False
        if not ip.is_global or ip.is_multicast:
            return False
    return True


def _meta(html: str, prop: str) -> str | None:
    """<meta property="og:..." content="..."> 추출 (속성 순서 양쪽 다 지원)."""
    for pattern in (
        rf'<meta[^>]+(?:property|name)=["\']{re.escape(prop)}["\'][^>]+content=["\']([^"\']*)["\']',
        rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']{re.escape(prop)}["\']',
    ):
        m = re.search(pattern, html, re.IGNORECASE)
        if m and m.group(1).strip():
            return m.group(1).strip()
    return None


def _extract_price(*texts: str | None) -> int | None:
    """텍스트에서 가격 추출: '850,000원' / '₩850000' / JSON-LD "price" 등."""
    for text in texts:
        if not text:
            continue
        m = re.search(r'"price"\s*:\s*"?([\d,.]+)"?', text)
        if not m:
            m = re.search(r"(?:₩|가격\s*:?\s*)?([\d,]{5,})\s*원", text)
        if m:
            try:
                price = int(m.group(1).replace(",", "").split(".")[0])
                if 1_000 <= price <= 100_000_000:
                    return price
            except ValueError:
                continue
    return None


def _find_ld_product(html: str) -> dict | None:
    """<script type="application/ld+json"> 중 schema.org Product 블록을 찾아 반환.

    당근마켓·중고나라(web.joongna.com) 실제 매물 페이지에서 확인됨 — og태그보다
    title/price/image가 정확하다 (og:image는 플랫폼 기본 이미지로 대체되는 경우가 있음).
    """
    for block in re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.DOTALL | re.IGNORECASE,
    ):
        try:
            parsed = json.loads(block.strip())
        except (json.JSONDecodeError, ValueError):
            continue

        candidates = parsed if isinstance(parsed, list) else [parsed]
        for candidate in candidates:
            if isinstance(candidate, dict) and candidate.get("@type") == "Product":
                return candidate
    return None


def _price_from_offers(offers: object) -> int | None:
    if isinstance(offers, list):
        offers = offers[0] if offers else None
    if not isinstance(offers, dict):
        return None
    raw_price = offers.get("price")
    if raw_price is None:
        return None
    try:
        price = int(float(raw_price))
    except (TypeError, ValueError):
        return None
    return price if 1_000 <= price <= 100_000_000 else None


def _first_image(image: object) -> str | None:
    if isinstance(image, list):
        return image[0] if image else None
    if isinstance(image, str):
        return image
    return None


def _get_public(url: str) -> httpx.Response:
    """공개 주소만 GET. 리다이렉트도 매 홉 검사한다 (외부→내부 우회 차단)."""
    for _ in range(MAX_REDIRECTS + 1):
        if not is_public_url(url):
            raise ValueError(f"내부망/비공개 주소로는 요청하지 않습니다: {url}")
        r = httpx.get(url, headers={"User-Agent": UA}, timeout=TIMEOUT, follow_redirects=False)
        if r.status_code in (301, 302, 303, 307, 308):
            location = getattr(r, "headers", {}).get("location")
            if not location:
                r.raise_for_status()
                return r
            url = urljoin(url, location)  # 상대경로 Location 도 절대 URL 로
            continue
        r.raise_for_status()
        return r
    raise ValueError("리다이렉트가 너무 많습니다")


def _scrape_bunjang_api(url: str) -> dict | None:
    """번개장터는 상품 API가 열려있어 og태그보다 정확하다. 실패하면 None."""
    m = re.search(r"/products/(\d+)", url)
    if not m:
        return None
    pid = m.group(1)
    # 고정 도메인(번개장터 공식 API)이라 SSRF 위험 없음 — pid 는 정규식으로 숫자만 통과
    r = httpx.get(
        f"https://api.bunjang.co.kr/api/pms/v3/products-detail/{pid}?viewerUid=-1",
        headers={"User-Agent": UA},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    d = r.json().get("data", {}).get("product", {})
    if not d.get("name"):
        return None
    # 판매 지역: API 응답에 있을 때만 — 없으면 null (지어내지 않는다)
    geo = d.get("geo") or {}
    location = d.get("location") or geo.get("label") or geo.get("address") or None
    return {
        "platform": "bunjang",
        "title": d["name"],
        "price": int(d.get("price") or 0) or None,
        "description": (d.get("description") or "")[:2000],
        "image": d.get("imageUrl"),
        "location": location if isinstance(location, str) else None,
        "seller_trade_count": None,
        "seller_account_age_days": None,
        "scrape_ok": True,
    }


def scrape_listing(url: str) -> dict:
    """URL → 매물 정보 dict. 어떤 경우에도 예외를 던지지 않는다."""
    platform = detect_platform(url)

    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:
        host = ""
    if host in KNOWN_UNSCRAPABLE_HOSTS:
        # cafe.naver.com은 og태그/JSON-LD 없이 클라이언트에서만 렌더링되는 SPA라
        # 일반 GET으로는 실제 매물 정보를 얻을 수 없다 (실측 확인, 시도해도 항상 실패).
        return {**FALLBACK_LISTING, "platform": platform}

    if platform == "bunjang":
        try:
            result = _scrape_bunjang_api(url)
            if result:
                return result
        except Exception:
            pass  # og 태그 방식으로 재시도

    try:
        r = _get_public(url)
        html = r.text
        product = _find_ld_product(html)

        title = (product.get("name") if product else None) or _meta(html, "og:title")
        if not title:
            m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
            title = m.group(1).strip() if m else None
        if not title:
            return {**FALLBACK_LISTING, "platform": platform}

        description = (
            (product.get("description") if product else None)
            or _meta(html, "og:description")
            or ""
        )
        image = (_first_image(product.get("image")) if product else None) or _meta(
            html, "og:image"
        )
        price = (_price_from_offers(product.get("offers")) if product else None) or (
            _extract_price(html, description, title)
        )

        return {
            "platform": platform,
            "title": title[:200],
            "price": price,
            "description": description[:2000],
            "image": image,
            "location": None,  # og태그/JSON-LD 경로에서는 판매 지역을 얻을 수 없다
            "seller_trade_count": None,
            "seller_account_age_days": None,
            "scrape_ok": True,
        }
    except Exception:
        return {**FALLBACK_LISTING, "platform": platform}
