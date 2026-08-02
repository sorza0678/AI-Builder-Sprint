"""Backend A: 저장된 분석 결과 → 구조화된 체크리스트·문의 질문·가격 제안 생성.

원칙:
- 전부 규칙 기반·결정론적 (LLM 재호출 없음 — 같은 분석이면 항상 같은 결과).
- 상품 카테고리(제목에서 판별)와 실제 분석 내용(하자·누락·경고)에 맞는 항목만 생성 —
  모든 상품에 같은 질문을 반복하지 않는다.
- 사용자가 화면2에서 수정한 값(listing_details)이 있으면 그걸 우선 사용.
- 근거 없는 숫자를 지어내지 않는다 — 시세 표본이 부족하면 target_price 는 null.
"""

# ---------- 카테고리 판별 ----------

_CATEGORY_KEYWORDS: list[tuple[str, list[str]]] = [
    ("PHONE", ["아이폰", "iphone", "갤럭시", "galaxy", "픽셀", "스마트폰", "공기계", "자급제"]),
    ("LAPTOP_TABLET", ["맥북", "macbook", "노트북", "그램", "아이패드", "ipad", "갤럭시탭", "서피스"]),
    ("ELECTRONICS", ["에어팟", "버즈", "워치", "닌텐도", "스위치", "플스", "플레이스테이션", "엑스박스",
                     "모니터", "카메라", "키보드", "마우스", "스피커", "이어폰", "헤드폰", "충전기", "티비", "tv"]),
    ("FASHION", ["자켓", "재킷", "셔츠", "바지", "청바지", "코트", "패딩", "신발", "운동화", "구두",
                 "가방", "지갑", "모자", "원피스", "니트", "맨투맨", "후드"]),
]


def detect_category(title: str) -> str:
    flat = title.lower()
    for category, keywords in _CATEGORY_KEYWORDS:
        if any(kw in flat for kw in keywords):
            return category
    return "GENERAL"


def _merged_state(analysis: dict, listing: dict | None) -> tuple[list[str], list[str], str, int]:
    """(하자 목록, 누락 구성품, 제목, 가격) — 사용자 수정값 우선."""
    product_status = analysis.get("product_status", {})
    defects = product_status.get("defects_found", [])
    missing = product_status.get("missing_components", [])
    title = analysis.get("title", "")
    price = analysis.get("price", 0)
    if listing:
        defects = listing.get("defects", defects)
        title = listing.get("title", title)
        price = listing.get("price", price)
    return defects, missing, title, price


# ---------- 1. 단계별 체크리스트 (화면: 거래 전 / 현장 / 결제 전) ----------

_GROUP_TITLES = {
    "BEFORE_TRADE": "거래 전에 확인",
    "ON_SITE": "현장에서 확인",
    "BEFORE_PAYMENT": "결제 전에 확인",
}


def build_checklist_groups(analysis: dict, listing: dict | None = None) -> list[dict]:
    defects, missing, title, _ = _merged_state(analysis, listing)
    category = detect_category(title)
    risk = analysis.get("risk_level", "SAFE")
    warnings = analysis.get("scam_warnings", [])
    high_risk = risk in ("WARNING", "DANGER")

    before_trade: list[dict] = []
    on_site: list[dict] = []
    before_payment: list[dict] = []

    # --- 거래 전에 확인 ---
    for w in warnings:
        before_trade.append({
            "text": f"위험 신호 재확인: {w}",
            "reason": "분석에서 감지된 신호 — 사실인지 판매자에게 직접 확인",
            "required": risk == "DANGER",
        })
    before_trade.append({
        "text": "판매자 프로필·거래 후기·가입 시기 확인",
        "reason": "신규 계정·후기 없음은 대표적인 사기 신호" if high_risk else None,
        "required": high_risk,
    })
    if risk == "DANGER":
        before_trade.append({
            "text": "매물 사진을 이미지 검색해 같은 사진의 다른 매물이 있는지 확인",
            "reason": "도용 사진은 미끼 매물의 전형적 수법",
            "required": True,
        })

    # --- 현장에서 확인 ---
    for d in defects:
        on_site.append({
            "text": f"실물 확인: {d}",
            "reason": "매물 설명에 언급된 하자 — 정도를 직접 확인",
            "required": True,
        })
    if category == "PHONE":
        on_site += [
            {"text": "IMEI 조회로 분실/도난 여부 확인 (*#06#)", "reason": "장물 여부는 현장에서만 확인 가능", "required": True},
            {"text": "배터리 성능(효율 %) 설정에서 직접 확인", "reason": None, "required": False},
            {"text": "카메라·스피커·마이크·생체인식 동작 테스트", "reason": None, "required": False},
        ]
    elif category == "LAPTOP_TABLET":
        on_site += [
            {"text": "전원 연결·발열·팬 소음 확인", "reason": None, "required": False},
            {"text": "키보드 전 키 입력·화면 불량화소 확인", "reason": None, "required": False},
            {"text": "배터리 사이클/성능 상태 확인", "reason": None, "required": False},
        ]
    elif category == "ELECTRONICS":
        on_site.append({"text": "전원을 켜서 기본 동작 직접 확인", "reason": None, "required": True})
    elif category == "FASHION":
        on_site += [
            {"text": "실측 사이즈 확인 (표기 사이즈와 다를 수 있음)", "reason": None, "required": False},
            {"text": "오염·수선 흔적·보풀 상태 확인", "reason": None, "required": False},
        ]
    else:
        on_site.append({"text": "사진과 실물이 일치하는지 확인", "reason": None, "required": True})
    for m in missing:
        on_site.append({
            "text": f"구성품 확인: {m}",
            "reason": "매물 설명 기준 미포함 — 현장에서 최종 확인",
            "required": False,
        })

    # --- 결제 전에 확인 ---
    before_payment.append({
        "text": "선입금·예약금 요구 시 거래 중단",
        "reason": "만나기 전 송금 요구는 사기의 대표 패턴",
        "required": True,
    })
    if category in ("PHONE", "LAPTOP_TABLET"):
        before_payment.append({
            "text": "기기 초기화 + 계정(iCloud/삼성/구글) 로그아웃 확인",
            "reason": "계정 잠금이 남아 있으면 기기를 쓸 수 없다",
            "required": True,
        })
    before_payment.append({
        "text": "안전한 공공장소에서 거래 (지구대 인근 등)",
        "reason": None,
        "required": False,
    })
    if risk == "DANGER":
        before_payment.append({
            "text": "고위험 매물 — 송금 전 모든 확인 항목을 다시 점검",
            "reason": f"신뢰도 {analysis.get('trust_score')}점 (DANGER)",
            "required": True,
        })

    groups = []
    for key, items in (
        ("BEFORE_TRADE", before_trade),
        ("ON_SITE", on_site),
        ("BEFORE_PAYMENT", before_payment),
    ):
        groups.append({
            "key": key,
            "title": _GROUP_TITLES[key],
            "items": [
                {"id": f"{key.lower()}-{i + 1}", **item}
                for i, item in enumerate(items)
            ],
        })
    return groups


def flatten_checklist(groups: list[dict]) -> list[str]:
    """구조화 체크리스트 → 기존 계약(list[str]) 호환용 평탄화."""
    return [item["text"] for group in groups for item in group["items"]]


# ---------- 2. 판매자 문의 질문 (사용자가 골라서 보내는 구조) ----------

def build_inquiry(analysis: dict, listing: dict | None = None) -> dict:
    defects, missing, title, _ = _merged_state(analysis, listing)
    category = detect_category(title)
    risk = analysis.get("risk_level", "SAFE")
    description = (analysis.get("description") or "").lower()
    questions: list[dict] = []

    def add(text: str, category_: str, reason: str | None):
        if all(q["text"] != text for q in questions):
            questions.append({"text": text, "category": category_, "reason": reason})

    # 언급된 하자 → 상태 확인 질문
    for d in defects[:3]:
        add(f"{d} — 해당 부분 사진을 몇 장 더 받아볼 수 있을까요?", "CONDITION", "설명에 언급된 하자 재확인")
    # 누락 구성품 → 가격 반영 질문
    for m in missing[:3]:
        add(f"{m} 상태로 판매하시는 게 맞나요? 가격에 반영 가능할까요?", "COMPONENTS", "설명 기준 미포함 구성품")

    # "알 수 없는 정보"를 질문으로 전환 — 설명에 없는 것만 묻는다
    if category == "PHONE" and "배터리" not in description:
        add("배터리 성능(효율 %)이 어떻게 되나요?", "CONDITION", "설명에 배터리 상태 정보 없음")
    if category in ("PHONE", "LAPTOP_TABLET"):
        if not any(w in description for w in ("초기화", "계정", "로그아웃")):
            add("계정(iCloud/삼성/구글) 로그아웃과 초기화 가능한 상태인가요?", "AUTHENTICITY", "계정 잠금 여부는 필수 확인 사항")
        if risk != "SAFE" and "일련번호" not in description:
            add("일련번호(IMEI)를 알려주시면 조회 후 연락드리겠습니다.", "AUTHENTICITY", "위험 신호가 있어 정품/도난 여부 확인 권장")
    if not any(w in description for w in ("개월", "년 사용", "사용기간", "사용 기간")) and not (listing and listing.get("usage_period")):
        add("실사용 기간이 어느 정도 되나요?", "CONDITION", "설명에 사용 기간 정보 없음")
    if any(w in title for w in ("미개봉", "새상품", "새제품")) or risk == "DANGER":
        add("구매 영수증이나 구매 내역을 확인할 수 있을까요?", "AUTHENTICITY", "미개봉/고위험 매물은 구매 증빙 확인 권장")

    # 거래 방식
    add("직거래 가능한 지역과 시간대가 어떻게 되시나요?", "TRADE", None)
    if risk == "DANGER" or "택배" in description:
        add("직거래로만 진행하고 싶은데 가능할까요?", "TRADE", "실물 확인 없이 거래하지 않는 것이 안전")

    questions = questions[:8]
    for i, q in enumerate(questions):
        q["id"] = f"q{i + 1}"

    combined = "\n".join(
        [f"안녕하세요, '{title}' 매물 보고 연락드립니다."]
        + [f"{i + 1}. {q['text']}" for i, q in enumerate(questions)]
    )
    return {"questions": questions, "combined_script": combined}


# ---------- 3. 가격 제안 (근거 없는 숫자는 만들지 않는다) ----------

def _round_1000(value: float) -> int:
    return int(round(value / 1000) * 1000)


def build_price_proposal(analysis: dict, listing: dict | None = None) -> dict:
    defects, missing, _, price = _merged_state(analysis, listing)
    market = analysis.get("market_price")  # /analyze 가 저장한 시세 상세 (구 데이터엔 없음)

    # 시세 근거가 부족하면 목표가를 제시하지 않는다 (임의 숫자 금지)
    if not market or not market.get("measured") or market.get("average") in (None, 0):
        return {
            "target_price": None,
            "negotiation_range": None,
            "reasons": ["시세 표본이 부족해 목표가를 제시하지 않습니다 (실측 시세 검색 실패 또는 구버전 분석 기록)"],
            "message": None,
        }
    if not price:
        return {
            "target_price": None,
            "negotiation_range": None,
            "reasons": ["매물 가격 정보가 없어 목표가를 계산할 수 없습니다"],
            "message": None,
        }

    avg = market["average"]
    reasons = [f"실측 시세 평균 {avg:,}원 (표본 {market['sample_count']}건)"]

    # 하자/누락 구성품만큼 시세에서 감가 — 각 항목이 근거로 남는다
    deduction = 0.0
    if defects:
        d = min(len(defects) * 0.03, 0.09)
        deduction += d
        reasons.append(f"하자 {len(defects)}건 반영 -{round(d * 100)}%")
    if missing:
        d = min(len(missing) * 0.02, 0.06)
        deduction += d
        reasons.append(f"구성품 누락 {len(missing)}건 반영 -{round(d * 100)}%")

    fair = _round_1000(avg * (1 - deduction))

    if price <= fair:
        reasons.append(f"판매가 {price:,}원 — 이미 조정 시세({fair:,}원) 이하")
        return {
            "target_price": None,
            "negotiation_range": None,
            "reasons": reasons,
            "message": "현재 판매가가 이미 시세 대비 합리적입니다. 무리한 가격 협상보다 상태 확인에 집중하세요.",
        }

    target = fair
    reasons.append(f"판매가 {price:,}원 대비 {price - target:,}원 인하 제안")
    midpoint = _round_1000((target + price) / 2)
    return {
        "target_price": target,
        "negotiation_range": {"min": target, "max": midpoint},
        "reasons": reasons,
        "message": (
            f"안녕하세요! 매물 잘 봤습니다. 시세와 상태를 감안해서 {target:,}원에 "
            f"거래 가능하실까요? 바로 직거래 가능합니다."
        ),
    }
