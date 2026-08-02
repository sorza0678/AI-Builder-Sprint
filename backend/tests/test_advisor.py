"""advisor(구조화 체크리스트·문의질문·가격제안) 유닛 테스트 — 결정론성과 규칙 검증."""
from app import advisor


def make_analysis(**overrides):
    base = {
        "item_id": 1,
        "title": "아이폰 14 프로 256GB",
        "price": 850_000,
        "market_price_avg": 900_000,
        "trust_score": 82,
        "risk_level": "SAFE",
        "scam_warnings": [],
        "product_status": {"defects_found": ["후면 잔기스"], "missing_components": ["박스 없음"]},
        "market_price": {
            "min": 700_000, "average": 900_000, "max": 1_100_000,
            "sample_count": 20, "calculated_at": "2026-08-02T00:00:00Z",
            "confidence": 0.67, "measured": True,
        },
        "description": "상태 좋아요. 직거래 선호.",
    }
    return {**base, **overrides}


# ---------- 체크리스트 ----------

def test_checklist_has_three_groups_in_order():
    groups = advisor.build_checklist_groups(make_analysis())
    assert [g["key"] for g in groups] == ["BEFORE_TRADE", "ON_SITE", "BEFORE_PAYMENT"]
    for g in groups:
        assert g["items"], f"{g['key']} 그룹이 비어 있음"
        for item in g["items"]:
            assert set(item.keys()) == {"id", "text", "reason", "required"}


def test_checklist_phone_includes_imei_and_account():
    groups = advisor.build_checklist_groups(make_analysis())
    all_text = " ".join(i["text"] for g in groups for i in g["items"])
    assert "IMEI" in all_text
    assert "계정" in all_text  # 결제 전 계정 로그아웃 확인


def test_checklist_danger_marks_required():
    analysis = make_analysis(risk_level="DANGER", scam_warnings=["선입금 유도 문구 감지"])
    groups = advisor.build_checklist_groups(analysis)
    before_trade = next(g for g in groups if g["key"] == "BEFORE_TRADE")
    assert any(i["required"] for i in before_trade["items"])


def test_checklist_fashion_differs_from_phone():
    phone = advisor.build_checklist_groups(make_analysis())
    fashion = advisor.build_checklist_groups(make_analysis(title="스톤아일랜드 패딩 L"))
    phone_text = " ".join(i["text"] for g in phone for i in g["items"])
    fashion_text = " ".join(i["text"] for g in fashion for i in g["items"])
    assert "IMEI" in phone_text and "IMEI" not in fashion_text
    assert "사이즈" in fashion_text


def test_checklist_deterministic():
    a = advisor.build_checklist_groups(make_analysis())
    b = advisor.build_checklist_groups(make_analysis())
    assert a == b


# ---------- 문의 질문 ----------

def test_inquiry_structure_and_ids():
    result = advisor.build_inquiry(make_analysis())
    assert result["questions"], "질문이 하나도 생성되지 않음"
    assert len(result["questions"]) <= 8
    for i, q in enumerate(result["questions"]):
        assert q["id"] == f"q{i + 1}"
        assert q["category"] in ("CONDITION", "COMPONENTS", "AUTHENTICITY", "TRADE")
    assert result["combined_script"].startswith("안녕하세요")


def test_inquiry_converts_unknown_battery_to_question():
    # 설명에 배터리 정보가 없는 폰 → 배터리 질문 생성
    result = advisor.build_inquiry(make_analysis(description="상태 좋아요"))
    assert any("배터리" in q["text"] for q in result["questions"])
    # 설명에 배터리 정보가 있으면 → 배터리 질문 없음 (아는 걸 또 묻지 않는다)
    result2 = advisor.build_inquiry(make_analysis(description="배터리 효율 91%입니다"))
    assert not any("배터리 성능" in q["text"] for q in result2["questions"])


def test_inquiry_uses_user_edited_defects():
    listing = {
        "title": "아이폰 14 프로 (수정됨)", "price": 800_000, "usage_period": "",
        "defects": ["액정 깨짐"], "components": [],
    }
    result = advisor.build_inquiry(make_analysis(), listing)
    assert any("액정 깨짐" in q["text"] for q in result["questions"])
    # 원본 하자(후면 잔기스)는 사용자 확정값으로 대체됨
    assert not any("후면 잔기스" in q["text"] for q in result["questions"])


# ---------- 가격 제안 ----------

def test_price_proposal_normal_case():
    p = advisor.build_price_proposal(make_analysis(price=1_000_000))
    assert p["target_price"] is not None
    assert p["target_price"] < 1_000_000
    assert p["negotiation_range"]["min"] == p["target_price"]
    assert p["negotiation_range"]["max"] <= 1_000_000
    assert any("표본" in r for r in p["reasons"])
    assert p["message"]


def test_price_proposal_null_when_no_market_sample():
    # 시세 실측 실패(폴백) → 임의 목표가를 만들지 않는다
    analysis = make_analysis(
        market_price={"min": None, "average": 900_000, "max": None,
                      "sample_count": 0, "calculated_at": "2026-08-02T00:00:00Z",
                      "confidence": None, "measured": False}
    )
    p = advisor.build_price_proposal(analysis)
    assert p["target_price"] is None
    assert p["negotiation_range"] is None


def test_price_proposal_null_when_old_record():
    # 구버전 분석 기록 (market_price 키 자체가 없음)
    analysis = make_analysis()
    del analysis["market_price"]
    p = advisor.build_price_proposal(analysis)
    assert p["target_price"] is None


def test_price_proposal_null_when_already_cheap():
    # 판매가가 이미 조정 시세 이하 → 네고 제안 안 함
    p = advisor.build_price_proposal(make_analysis(price=700_000))
    assert p["target_price"] is None
    assert p["message"] is not None  # "이미 합리적" 안내는 있음


def test_price_proposal_uses_user_edited_price():
    listing = {"title": "아이폰 14 프로", "price": 1_200_000, "usage_period": "",
               "defects": [], "components": []}
    p = advisor.build_price_proposal(make_analysis(price=700_000), listing)
    # 사용자가 가격을 120만원으로 수정 → 그 기준으로 네고 제안이 생겨야 함
    assert p["target_price"] is not None
