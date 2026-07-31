"""STEP 1 전용 가짜 데이터. STEP 6에서 실제 로직으로 교체되지만
스키마(모양)는 이대로 유지된다 — 프론트는 이 모양만 믿고 개발하면 됨."""

# item_id → 분석 결과. SAFE / WARNING / DANGER 세 가지 상태를 전부 제공해서
# 프론트가 UI 3종을 모두 만들어볼 수 있게 한다.
ANALYSES: dict[int, dict] = {
    1: {
        "item_id": 1,
        "title": "아이폰 14 프로 256GB 딥퍼플 (상태 A급)",
        "price": 850_000,
        "market_price_avg": 920_000,
        "trust_score": 82,
        "risk_level": "SAFE",
        "scam_warnings": [],
        "product_status": {
            "defects_found": ["후면 카메라 링 주변 미세 스크래치"],
            "missing_components": ["정품 박스 없음"],
        },
    },
    2: {
        "item_id": 2,
        "title": "갤럭시 S24 울트라 512GB 티타늄 블랙",
        "price": 950_000,
        "market_price_avg": 1_150_000,
        "trust_score": 55,
        "risk_level": "WARNING",
        "scam_warnings": [
            "시세 대비 17% 저렴한 가격",
            "판매자 거래 내역이 2건으로 적음",
        ],
        "product_status": {
            "defects_found": ["액정 좌측 상단 잔기스", "배터리 효율 87%"],
            "missing_components": ["S펜 없음", "충전기 없음"],
        },
    },
    3: {
        "item_id": 3,
        "title": "맥북 프로 M3 14인치 미개봉 급처",
        "price": 1_500_000,
        "market_price_avg": 2_400_000,
        "trust_score": 18,
        "risk_level": "DANGER",
        "scam_warnings": [
            "시세 대비 37% 저렴 — 미끼 매물 가능성 높음",
            "판매자 계정 생성 7일 미만",
            "게시글에 선입금 유도 문구 감지",
            "동일 이미지가 다른 지역 매물에서도 발견됨",
        ],
        "product_status": {
            "defects_found": [],
            "missing_components": [],
        },
    },
}

# STEP 2부터 item_id 는 DB auto-increment 값이라 고정 키로 못 둔다.
# 저장된 분석 데이터(raw_analysis_json)를 바탕으로 그때그때 조합해서 만든다.
# (LLM 호출 없음 — STEP 7 원칙 준수. 진짜 로직은 나중 단계에서 고도화)

_RISK_HEADLINE = {
    "SAFE": [],
    "WARNING": ["⚠️ 주의 매물 — 아래 항목을 꼭 직접 확인하세요"],
    "DANGER": ["🚨 고위험 매물 — 직거래 외 거래 금지, 선입금 요구 시 즉시 중단"],
}


def build_checklist(analysis: dict) -> list[str]:
    items = list(_RISK_HEADLINE.get(analysis["risk_level"], []))
    for defect in analysis["product_status"]["defects_found"]:
        items.append(f"실물 확인: {defect}")
    for missing in analysis["product_status"]["missing_components"]:
        items.append(f"미포함 항목 확인: {missing}")
    for warning in analysis["scam_warnings"]:
        items.append(f"판매자에게 확인: {warning}")
    if not items:
        items.append("특이사항 없음 — 일반 중고거래 주의사항만 확인하세요.")
    items.append("직거래 시 안전한 공공장소(지구대 인근 등)에서 만나세요.")
    return items


def build_inquiry_script(analysis: dict) -> str:
    lines = [f"안녕하세요, '{analysis['title']}' 매물 보고 연락드립니다."]
    n = 1
    for defect in analysis["product_status"]["defects_found"]:
        lines.append(f"{n}. {defect} — 실물 사진 조금 더 받아볼 수 있을까요?")
        n += 1
    for missing in analysis["product_status"]["missing_components"]:
        lines.append(f"{n}. {missing} 관련해서 가격 조정 여지가 있을까요?")
        n += 1
    if analysis["risk_level"] == "DANGER":
        lines.append(f"{n}. 직거래로만 진행하고 싶은데 가능한 지역이 어디신가요?")
        n += 1
    lines.append(f"{n}. 직거래 가능한 지역/시간대가 어떻게 되시나요?")
    return "\n".join(lines)
