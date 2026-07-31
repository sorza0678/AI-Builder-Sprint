"""Rule Engine 결정론 검증 — 같은 입력이면 항상 같은 점수가 나와야 한다."""
from app import rule_engine


def make_listing(**overrides):
    base = {
        "platform": "bunjang",
        "title": "아이폰 14 프로 256GB",
        "price": 900_000,
        "description": "상태 좋습니다. 직거래 환영합니다.",
        "seller_trade_count": None,
        "seller_account_age_days": None,
        "scrape_ok": True,
    }
    return {**base, **overrides}


def test_normal_listing_is_safe():
    r = rule_engine.evaluate(make_listing(), market_price_avg=920_000, market_measured=True)
    assert r["risk_level"] == "SAFE"
    assert r["trust_score"] >= 70
    assert r["scam_warnings"] == []


def test_half_price_bait_is_danger():
    r = rule_engine.evaluate(
        make_listing(price=400_000, description="미개봉 새제품 급처! 선입금 주시면 바로 보내드려요. 텔레그램으로 연락주세요"),
        market_price_avg=1_000_000,
        market_measured=True,
    )
    assert r["risk_level"] == "DANGER"
    assert any("저렴" in w for w in r["scam_warnings"])
    assert any("선입금" in w for w in r["scam_warnings"])


def test_deterministic():
    listing = make_listing(price=700_000)
    a = rule_engine.evaluate(listing, 1_000_000, True)
    b = rule_engine.evaluate(listing, 1_000_000, True)
    assert a == b


def test_score_clamped_0_to_100():
    listing = make_listing(
        price=100_000,
        description="선입금 필수, 안전결제 링크 드림, 텔레그램 연락, 택배만 가능, 해외배송, 급처",
        seller_trade_count=0,
    )
    r = rule_engine.evaluate(listing, 2_000_000, True)
    assert 0 <= r["trust_score"] <= 100
    assert r["risk_level"] == "DANGER"


def test_product_status_extraction():
    r = rule_engine.evaluate(
        make_listing(description="액정에 잔기스 있고 배터리 효율 87%입니다. 박스 없고 본체만 드려요."),
        920_000,
        True,
    )
    assert r["product_status"]["defects_found"]
    assert r["product_status"]["missing_components"]


def test_no_price_skips_price_rules():
    r = rule_engine.evaluate(make_listing(price=None), 920_000, True)
    assert not any("저렴" in w or "비쌈" in w for w in r["scam_warnings"])


def test_negated_defects_not_flagged():
    # "수리 이력 없습니다", "기스 없어요" 는 하자가 아니다
    r = rule_engine.evaluate(
        make_listing(description="정상작동 합니다. 수리 이력 없습니다. 기스 없어요."),
        920_000,
        True,
    )
    assert r["product_status"]["defects_found"] == []
    # 반대로 실제 하자는 잡혀야 한다
    r2 = rule_engine.evaluate(
        make_listing(description="모서리에 잔기스 있습니다."), 920_000, True
    )
    assert r2["product_status"]["defects_found"] != []


def test_negation_in_other_clause_still_flags_defect():
    # 부정어가 "다른 절"에 있으면 하자로 잡아야 한다 (리뷰에서 발견된 미탐 케이스들)
    cases = [
        "고장 나서 전원이 안 들어옵니다",
        "잔기스 있고 기능 문제 없습니다",
        "생활기스 있지만 눈에 안 띄어요",
        "액정 깨짐 있고 그 외 문제 없어요",
        "번인 있지만 심하지 않아요",
    ]
    for desc in cases:
        r = rule_engine.evaluate(make_listing(description=desc), 920_000, True)
        assert r["product_status"]["defects_found"] != [], f"미탐: {desc}"


def test_second_occurrence_not_negated_flags_defect():
    # 첫 등장은 부정("기스 없음")이어도 두 번째 등장("기스 있음")은 잡아야 한다
    r = rule_engine.evaluate(
        make_listing(description="큰 기스 없음. 근데 모서리에 기스 하나 있어요."),
        920_000,
        True,
    )
    assert r["product_status"]["defects_found"] != []
