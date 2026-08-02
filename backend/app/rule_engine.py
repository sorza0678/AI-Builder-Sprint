"""STEP 5: Rule Engine — trust_score(0~100)·risk_level·경고 산출.

점수는 LLM이 아니라 여기서만 계산한다 (재현성). 같은 입력 → 항상 같은 점수.
"""
import re

# (코드, 패턴 목록, 감점, 짧은 제목, 상세 사유) — 제목+설명에서 탐지
# code 는 프론트가 문구가 바뀌어도 안전하게 분기할 수 있는 안정적 식별자다.
SCAM_TEXT_RULES: list[tuple[str, list[str], int, str, str]] = [
    ("PREPAY_REQUEST", ["선입금", "선결제", "먼저 입금", "예약금"], 20,
     "선입금 요구", "선입금 유도 문구 감지 — 입금 전 반드시 실물 확인"),
    ("EXTERNAL_PAYMENT_LINK", ["안전결제 링크", "안전거래 링크", "결제링크", "링크로 결제"], 25,
     "외부 결제 링크", "외부 결제 링크 유도 — 피싱 사기의 전형적 수법"),
    ("OFF_PLATFORM_CONTACT", ["텔레그램", "카톡으로 연락", "카카오톡 아이디", "문자로만"], 10,
     "플랫폼 밖 연락 유도", "플랫폼 밖 연락 유도 — 거래 기록이 남지 않음"),
    ("NO_IN_PERSON", ["직거래 불가", "택배만", "택배거래만"], 10,
     "직거래 거부", "직거래 거부 — 실물 확인 불가"),
    ("OVERSEAS_SHIPPING", ["해외배송", "해외 직배송", "관세"], 10,
     "해외배송", "해외배송 매물 — 수령까지 확인 불가"),
    ("URGENCY", ["급처", "급매", "급하게", "오늘만"], 5,
     "급처분 강조", "급처분 강조 — 서두르게 만드는 화법 주의"),
]

# 감점 크기 → 신호 자체의 심각도 (프론트가 신호별로 색/아이콘을 정할 때 사용)
def _severity(penalty: int) -> str:
    if penalty >= 20:
        return "DANGER"
    return "WARNING" if penalty >= 10 else "SAFE"

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


def _snippet_around(text: str, keyword: str, width: int = 20) -> str | None:
    """신호의 근거가 된 원문 조각 — 사용자가 '왜 이 경고가 떴나'를 확인할 수 있게."""
    idx = text.find(keyword)
    if idx == -1:
        return None
    start, end = max(0, idx - width), min(len(text), idx + len(keyword) + width)
    return ("…" if start else "") + text[start:end].strip().replace("\n", " ") + ("…" if end < len(text) else "")


# 하자 심각도 — 사용 불가/수리 이력은 MAJOR, 성능 저하는 MODERATE, 외관은 MINOR
_DEFECT_SEVERITY: list[tuple[str, list[str]]] = [
    ("MAJOR", ["파손", "깨짐", "고장", "침수", "액정 교체"]),
    ("MODERATE", ["불량", "수리", "번인", "잔상"]),
    ("MINOR", ["기스", "스크래치", "잔기스", "찍힘", "흠집"]),
]
# 하자 심각도 → 상태 등급
_GRADE_BY_WORST = {None: "A", "MINOR": "B", "MODERATE": "C", "MAJOR": "D"}


def _defect_severity(defect_text: str) -> str | None:
    for severity, keywords in _DEFECT_SEVERITY:
        if any(kw in defect_text for kw in keywords):
            return severity
    return None


def build_condition(listing: dict, defects: list[str], user_defects: list[str] | None = None) -> dict:
    """상품 상태 구조화 — 판매자 설명 텍스트에서 확인된 것만.

    grade 는 발견된 하자 중 가장 심각한 것을 기준으로 A~D. 설명 자체가 없으면 판단 근거가
    없으므로 grade/confidence 는 null (임의 등급을 매기지 않는다).
    confidence 는 '설명이 얼마나 자세한가'일 뿐 실물 확인을 대체하지 않는다.
    source 는 DESCRIPTION(판매자 설명) / USER(사용자가 화면2에서 확정) 두 가지 —
    이미지 분석은 구현돼 있지 않으므로 IMAGE 는 절대 반환하지 않는다.
    """
    entries: list[dict] = []
    for text in defects:
        entries.append(
            {
                "name": text,
                "severity": _defect_severity(text),
                "evidence": text,
                "source": "DESCRIPTION",
            }
        )
    for text in user_defects or []:
        entries.append(
            {"name": text, "severity": _defect_severity(text), "evidence": None, "source": "USER"}
        )

    description = listing.get("description") or ""
    if not description.strip() and not entries:
        return {"grade": None, "confidence": None, "defects": []}

    order = ["MAJOR", "MODERATE", "MINOR"]
    found = [e["severity"] for e in entries if e["severity"]]
    worst = next((s for s in order if s in found), None)
    return {
        "grade": _GRADE_BY_WORST[worst],
        # 설명 300자 정도면 판단 근거가 충분하다고 보고 1.0 — 어디까지나 텍스트 분량 기준
        "confidence": round(min(1.0, len(description) / 300), 2) if description.strip() else None,
        "defects": entries,
    }


def evaluate(listing: dict, market_price_avg: int, market_measured: bool) -> dict:
    """매물 + 시세 → 점수/위험도/신호/상태. 결정론적 — 외부 호출 없음."""
    score = 100
    signals: list[dict] = []
    text = f"{listing.get('title', '')} {listing.get('description', '')}"
    price = listing.get("price")

    def add_signal(code: str, penalty: int, title: str, reason: str, evidence: str | None = None):
        signals.append(
            {
                "code": code,
                "title": title,
                "reason": reason,
                "severity": _severity(penalty),
                "evidence": evidence,
            }
        )

    # 1) 시세 대비 가격
    if price and market_price_avg > 0:
        ratio = price / market_price_avg
        discount_pct = round((1 - ratio) * 100)
        basis = "실측 시세" if market_measured else "참고 시세"
        evidence = f"판매가 {price:,}원 / {basis} {market_price_avg:,}원"
        for max_ratio, penalty in PRICE_RATIO_RULES:
            if ratio <= max_ratio:
                score -= penalty
                label = "미끼 매물 가능성 높음" if max_ratio <= 0.50 else "시세 확인 필요"
                add_signal(
                    "PRICE_TOO_LOW", penalty, f"시세 대비 {discount_pct}% 저렴",
                    f"{basis} 대비 {discount_pct}% 저렴 — {label}", evidence,
                )
                break
        else:
            if ratio >= OVERPRICE_RATIO:
                score -= OVERPRICE_PENALTY
                over_pct = round((ratio - 1) * 100)
                add_signal(
                    "PRICE_TOO_HIGH", OVERPRICE_PENALTY, f"시세보다 {over_pct}% 비쌈",
                    f"시세보다 {over_pct}% 비쌈 — 가격 협상 여지 확인", evidence,
                )

    # 2) 사기 의심 문구
    for code, keywords, penalty, title, reason in SCAM_TEXT_RULES:
        matched = next((kw for kw in keywords if kw in text), None)
        if matched:
            score -= penalty
            add_signal(code, penalty, title, reason, _snippet_around(text, matched))

    # 3) 판매자 신호 (스크래핑으로 얻은 경우에만)
    trade_count = listing.get("seller_trade_count")
    account_age = listing.get("seller_account_age_days")
    if (trade_count is not None and trade_count == 0) or (
        account_age is not None and account_age < 7
    ):
        score -= NEW_SELLER_PENALTY
        add_signal(
            "NEW_SELLER", NEW_SELLER_PENALTY, "신규 판매자",
            "판매자 거래 이력이 거의 없음 (신규 계정)",
            f"거래 {trade_count}건 / 가입 {account_age}일" if trade_count is not None else None,
        )

    # 4) 상품 상태 (감점 없음 — 정보 제공용)
    defects = _find_sentences(text, DEFECT_KEYWORDS)
    product_status = {
        "defects_found": defects,
        "missing_components": _find_sentences(text, MISSING_KEYWORDS),
    }

    score = max(0, min(100, score))
    risk_level = "SAFE" if score >= SAFE_MIN else "WARNING" if score >= WARNING_MIN else "DANGER"
    return {
        "trust_score": score,
        "risk_level": risk_level,
        # 구버전 계약 유지 — risk_signals 의 reason 과 완전히 동일한 문자열
        "scam_warnings": [s["reason"] for s in signals],
        "risk_signals": signals,
        "product_status": product_status,
        "condition": build_condition(listing, defects),
    }
