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

# (체크리스트/문의질문 생성은 app/advisor.py 로 이동 — 구조화 버전으로 대체됨, 2026-08-02)
