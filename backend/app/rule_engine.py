"""STEP 5: Rule Engine — trust_score(0~100)·risk_level·경고 산출.

점수는 LLM이 아니라 여기서만 계산한다 (재현성). 같은 입력 → 항상 같은 점수.
"""
import re

# (패턴 목록, 감점, 경고 문구) — 제목+설명에서 탐지
SCAM_TEXT_RULES: list[tuple[list[str], int, str]] = [
    (["선입금", "선결제", "먼저 입금", "예약금"], 20, "선입금 유도 문구 감지 — 입금 전 반드시 실물 확인"),
    (["안전결제 링크", "안전거래 링크", "결제링크", "링크로 결제"], 25, "외부 결제 링크 유도 — 피싱 사기의 전형적 수법"),
    (["텔레그램", "카톡으로 연락", "카카오톡 아이디", "문자로만"], 10, "플랫폼 밖 연락 유도 — 거래 기록이 남지 않음"),
    (["직거래 불가", "택배만", "택배거래만"], 10, "직거래 거부 — 실물 확인 불가"),
    (["해외배송", "해외 직배송", "관세"], 10, "해외배송 매물 — 수령까지 확인 불가"),
    (["급처", "급매", "급하게", "오늘만"], 5, "급처분 강조 — 서두르게 만드는 화법 주의"),
]

# 시세 대비 가격 비율 규칙: (상한 비율, 감점) — 낮은 순으로 첫 매칭 적용
PRICE_RATIO_RULES: list[tuple[float, int]] = [
    (0.50, 45),  # 반값 이하 — 미끼 매물 가능성 높음
    (0.65, 30),
    (0.80, 15),
]
OVERPRICE_RATIO = 1.30
OVERPRICE_PENALTY = 10

NEW_SELLER_PENALTY = 15  # 거래 0건 or 계정 7일 미만 (정보 있을 때만)

DEFECT_KEYWORDS = [
    "기스", "스크래치", "잔기스", "파손", "깨짐", "찍힘", "흠집",
    "잔상", "번인", "불량", "고장", "수리", "침수", "액정 교체",
]
MISSING_KEYWORDS = [
    "박스 없", "박스없", "구성품 없", "충전기 없", "본체만",
    "s펜 없", "S펜 없", "케이블 없", "영수증 없",
]

SAFE_MIN = 70      # trust_score >= 70 → SAFE
WARNING_MIN = 40   # 40~69 → WARNING, 그 미만 → DANGER


# 부정 판정은 키워드와 "같은 절" 안에서만 — 절 경계(쉼표/마침표/연결어미) 밖의
# 부정어는 다른 말을 부정하는 것이다 ("고장 나서 전원이 안 들어옵니다"의 '안').
_CLAUSE_END = re.compile(r"[,.!?\n]|지만|는데|고\s|서\s|며\s|면서")
_NEGATION = re.compile(r"없|않|아니|안\s")


def _is_negated(text: str, kw_end: int) -> bool:
    """키워드 직후 같은 절 안에 부정어가 있으면 True ("기스 없음", "수리 이력 없습니다")."""
    tail = text[kw_end : kw_end + 20]
    boundary = _CLAUSE_END.search(tail)
    clause = tail[: boundary.start()] if boundary else tail
    return bool(_NEGATION.search(clause))


def _find_sentences(text: str, keywords: list[str]) -> list[str]:
    """키워드가 들어간 원문 조각을 짧게 잘라 반환 (부정 문맥 제외, 중복 제거).

    같은 키워드가 여러 번 나오면 하나라도 비부정 문맥이 있을 때 하자로 본다
    ("기스 없음... 근데 모서리 기스 있음" → 하자).
    """
    found = []
    for kw in keywords:
        for m in re.finditer(re.escape(kw), text):
            if _is_negated(text, m.end()):
                continue
            start = max(0, m.start() - 10)
            snippet = text[start : m.end() + 15].strip().replace("\n", " ")
            found.append(f"{kw} ({snippet[:40]}…)" if len(snippet) > 40 else snippet)
            break  # 이 키워드는 하자 확정 — 다음 키워드로
    return list(dict.fromkeys(found))


def evaluate(listing: dict, market_price_avg: int, market_measured: bool) -> dict:
    """매물 + 시세 → 점수/위험도/경고/상태. 결정론적 — 외부 호출 없음."""
    score = 100
    warnings: list[str] = []
    text = f"{listing.get('title', '')} {listing.get('description', '')}"
    price = listing.get("price")

    # 1) 시세 대비 가격
    if price and market_price_avg > 0:
        ratio = price / market_price_avg
        discount_pct = round((1 - ratio) * 100)
        for max_ratio, penalty in PRICE_RATIO_RULES:
            if ratio <= max_ratio:
                score -= penalty
                label = "미끼 매물 가능성 높음" if max_ratio <= 0.50 else "시세 확인 필요"
                basis = "실측 시세" if market_measured else "참고 시세"
                warnings.append(f"{basis} 대비 {discount_pct}% 저렴 — {label}")
                break
        else:
            if ratio >= OVERPRICE_RATIO:
                score -= OVERPRICE_PENALTY
                warnings.append(f"시세보다 {round((ratio - 1) * 100)}% 비쌈 — 가격 협상 여지 확인")

    # 2) 사기 의심 문구
    for keywords, penalty, message in SCAM_TEXT_RULES:
        if any(kw in text for kw in keywords):
            score -= penalty
            warnings.append(message)

    # 3) 판매자 신호 (스크래핑으로 얻은 경우에만)
    trade_count = listing.get("seller_trade_count")
    account_age = listing.get("seller_account_age_days")
    if (trade_count is not None and trade_count == 0) or (
        account_age is not None and account_age < 7
    ):
        score -= NEW_SELLER_PENALTY
        warnings.append("판매자 거래 이력이 거의 없음 (신규 계정)")

    # 4) 상품 상태 (감점 없음 — 정보 제공용)
    product_status = {
        "defects_found": _find_sentences(text, DEFECT_KEYWORDS),
        "missing_components": _find_sentences(text, MISSING_KEYWORDS),
    }

    score = max(0, min(100, score))
    risk_level = "SAFE" if score >= SAFE_MIN else "WARNING" if score >= WARNING_MIN else "DANGER"
    return {
        "trust_score": score,
        "risk_level": risk_level,
        "scam_warnings": warnings,
        "product_status": product_status,
    }
