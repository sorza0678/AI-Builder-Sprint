"""STEP 3: 매물 URL 파싱 — 플랫폼 판별 + 제목/가격/설명 추출.

원칙: 스크래핑은 언제든 막힐 수 있다. 어떤 실패에도 예외를 밖으로 던지지 않고
FALLBACK_LISTING 을 반환한다 (데모 안죽게). fallback 여부는 scrape_ok 로 표시.
"""
import re
from urllib.parse import urlparse

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

# 스크래핑 완전 실패 시 데모용 고정 매물
FALLBACK_LISTING = {
    "platform": "unknown",
    "title": "아이폰 14 프로 256GB 딥퍼플 (상태 A급)",
    "price": 850_000,
    "description": "생활기스 약간 있고 배터리 효율 88%입니다. 박스 없음, 직거래 선호합니다.",
    "image": None,
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


def _scrape_bunjang_api(url: str) -> dict | None:
    """번개장터는 상품 API가 열려있어 og태그보다 정확하다. 실패하면 None."""
    m = re.search(r"/products/(\d+)", url)
    if not m:
        return None
    pid = m.group(1)
    r = httpx.get(
        f"https://api.bunjang.co.kr/api/pms/v3/products-detail/{pid}?viewerUid=-1",
        headers={"User-Agent": UA},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    d = r.json().get("data", {}).get("product", {})
    if not d.get("name"):
        return None
    return {
        "platform": "bunjang",
        "title": d["name"],
        "price": int(d.get("price") or 0) or None,
        "description": (d.get("description") or "")[:2000],
        "image": d.get("imageUrl"),
        "seller_trade_count": None,
        "seller_account_age_days": None,
        "scrape_ok": True,
    }


def scrape_listing(url: str) -> dict:
    """URL → 매물 정보 dict. 어떤 경우에도 예외를 던지지 않는다."""
    platform = detect_platform(url)

    if platform == "bunjang":
        try:
            result = _scrape_bunjang_api(url)
            if result:
                return result
        except Exception:
            pass  # og 태그 방식으로 재시도

    try:
        r = httpx.get(
            url, headers={"User-Agent": UA}, timeout=TIMEOUT, follow_redirects=True
        )
        r.raise_for_status()
        html = r.text

        title = _meta(html, "og:title")
        description = _meta(html, "og:description") or ""
        if not title:
            m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
            title = m.group(1).strip() if m else None
        if not title:
            return {**FALLBACK_LISTING, "platform": platform}

        return {
            "platform": platform,
            "title": title[:200],
            "price": _extract_price(html, description, title),
            "description": description[:2000],
            "image": _meta(html, "og:image"),
            "seller_trade_count": None,
            "seller_account_age_days": None,
            "scrape_ok": True,
        }
    except Exception:
        return {**FALLBACK_LISTING, "platform": platform}
