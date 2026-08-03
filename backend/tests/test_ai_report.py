"""ai_report.py 검증 — AI 보강이 기존 결과를 절대 훼손하지 않는지가 핵심.

이 모듈의 위험은 "AI가 틀리는 것"이 아니라 "AI가 실패했을 때 원래 잘 되던 것까지
같이 죽는 것"이다. 그래서 아래 세 가지를 집중적으로 본다:
1. AI 없음/실패 경로도 AI 있음 경로와 같은 키 집합을 반환한다 (호출부 KeyError 방지)
2. 점수(trust_score/risk_level)는 어떤 경우에도 병합으로 바뀌지 않는다 (점수는 rule_engine 전용)
3. 응답이 잘려 json.loads 가 터져도 예외가 밖으로 새지 않고 None 만 반환한다

네트워크 호출 없이 검증하려고 httpx.post 는 가짜 응답으로 monkeypatch 한다.
"""
import httpx
import pytest

from app import ai_report

AI_DETAIL_KEYS = ("model_name", "year", "size_or_capacity", "color", "usage_period")


class _FakeResponse:
    """Upstage chat/completions 응답 껍데기 — content 문자열만 갈아끼우면 된다."""

    def __init__(self, content: str, status_code: int = 200):
        self._content = content
        self.status_code = status_code

    def raise_for_status(self):
        pass

    def json(self):
        return {"choices": [{"message": {"content": self._content}}]}


@pytest.fixture
def rule_result():
    """rule_engine.evaluate() 가 돌려주는 형태의 최소 결과."""
    return {
        "trust_score": 72,
        "risk_level": "SAFE",
        "scam_warnings": ["시세보다 저렴합니다"],
        "risk_signals": [{"code": "PRICE_LOW", "title": "저가", "reason": "시세보다 저렴합니다"}],
        "product_status": {
            "defects_found": ["액정 잔기스"],
            "missing_components": ["박스 없음"],
        },
        "condition": {"grade": "B", "confidence": 0.5, "defects": []},
    }


@pytest.fixture
def ai_result():
    """get_ai_report() 가 돌려주는 형태의 AI 리포트."""
    return {
        "defects_found": ["배터리 성능 87%"],
        "missing_components": ["충전기 없음"],
        "scam_warnings": ["선입금 요구"],
        "model_name": "iPhone 14 Pro",
        "year": "2022",
        "size_or_capacity": "256GB",
        "color": "딥퍼플",
        "usage_period": "1년",
    }


# --- merge_report: 키 계약 ---------------------------------------------------


def test_merge_without_ai_still_has_all_detail_keys(rule_result):
    """AI 가 없어도 5개 키가 존재해야 한다 — 없으면 dict 를 직접 쓰는 호출부에서 KeyError."""
    merged = ai_report.merge_report(rule_result, None)

    for key in AI_DETAIL_KEYS:
        assert key in merged, f"AI 없음 경로에 {key} 키가 빠졌다"
        assert merged[key] is None


def test_merge_with_and_without_ai_return_same_key_set(rule_result, ai_result):
    """두 경로의 키 집합이 갈리면 프론트/스키마가 경로에 따라 다른 dict 를 받게 된다."""
    without_ai = ai_report.merge_report(rule_result, None)
    with_ai = ai_report.merge_report(rule_result, ai_result)

    assert without_ai.keys() == with_ai.keys()


def test_merge_without_ai_preserves_rule_fields(rule_result):
    merged = ai_report.merge_report(rule_result, None)

    assert merged["scam_warnings"] == ["시세보다 저렴합니다"]
    assert merged["product_status"]["defects_found"] == ["액정 잔기스"]
    assert merged["risk_signals"] == rule_result["risk_signals"]
    assert merged["condition"] == rule_result["condition"]


# --- merge_report: 값 병합 ---------------------------------------------------


def test_merge_carries_ai_detail_values(rule_result, ai_result):
    merged = ai_report.merge_report(rule_result, ai_result)

    assert merged["model_name"] == "iPhone 14 Pro"
    assert merged["year"] == "2022"
    assert merged["size_or_capacity"] == "256GB"
    assert merged["color"] == "딥퍼플"
    assert merged["usage_period"] == "1년"


def test_merge_never_touches_score_or_risk_level(rule_result, ai_result):
    """점수는 rule_engine 전용 — AI 가 무슨 말을 해도 병합 단계에서 바뀌면 안 된다."""
    hostile_ai = {
        **ai_result,
        "trust_score": 5,
        "risk_level": "DANGER",
        "scam_warnings": ["사기 확실"],
    }

    merged = ai_report.merge_report(rule_result, hostile_ai)

    assert merged["trust_score"] == 72
    assert merged["risk_level"] == "SAFE"


def test_merge_is_union_without_duplicates(rule_result, ai_result):
    """AI 가 rule_engine 과 같은 문구를 뱉어도 목록에 두 번 실리면 안 된다."""
    overlapping_ai = {
        **ai_result,
        "scam_warnings": ["시세보다 저렴합니다", "선입금 요구"],
        "defects_found": ["액정 잔기스", "배터리 성능 87%"],
        "missing_components": ["박스 없음", "충전기 없음"],
    }

    merged = ai_report.merge_report(rule_result, overlapping_ai)

    assert merged["scam_warnings"] == ["시세보다 저렴합니다", "선입금 요구"]
    assert merged["product_status"]["defects_found"] == ["액정 잔기스", "배터리 성능 87%"]
    assert merged["product_status"]["missing_components"] == ["박스 없음", "충전기 없음"]
    # 합집합이므로 rule_engine 항목이 앞, AI 항목이 뒤 — 각 목록에 중복 없음
    for values in (
        merged["scam_warnings"],
        merged["product_status"]["defects_found"],
        merged["product_status"]["missing_components"],
    ):
        assert len(values) == len(set(values))


def test_merge_does_not_mutate_rule_result(rule_result, ai_result):
    """원본을 건드리면 같은 verdict 를 재사용하는 호출부에서 유령 버그가 난다."""
    ai_report.merge_report(rule_result, ai_result)

    assert rule_result["scam_warnings"] == ["시세보다 저렴합니다"]
    assert rule_result["product_status"]["defects_found"] == ["액정 잔기스"]
    assert "model_name" not in rule_result


# --- _short_text: 자리표시 문자열 정규화 --------------------------------------


@pytest.mark.parametrize(
    "raw",
    ["없음", " 미상 ", "N/A", "n/a", "확인 불가", "확인불가", "정보 없음", "null", "NULL", "-", "", "   "],
)
def test_short_text_normalizes_placeholders_to_none(raw):
    """LLM 이 null 대신 뱉는 관성적 문자열 — 통과시키면 입력칸에 "없음" 이 자동 입력된다."""
    assert ai_report._short_text(raw) is None


@pytest.mark.parametrize(
    "raw",
    ["무광 블랙", "미사용", "미개봉", "블랙", "256GB", "2022", "6개월", "iPhone 14 Pro"],
)
def test_short_text_keeps_real_values(raw):
    """완전일치로만 걸러야 한다 — 부분일치면 "무광 블랙"·"미사용" 같은 진짜 값이 날아간다."""
    assert ai_report._short_text(raw) == raw


def test_short_text_trims_and_truncates():
    assert ai_report._short_text("  딥퍼플  ") == "딥퍼플"
    assert ai_report._short_text("가" * 50) == "가" * 30


def test_short_text_ignores_non_string():
    # LLM 이 스키마를 어기고 숫자/리스트를 넣어도 터지지 않아야 한다
    assert ai_report._short_text(None) is None
    assert ai_report._short_text(2022) is None
    assert ai_report._short_text(["블랙"]) is None


# --- get_ai_report: 실패해도 예외를 흘리지 않는다 -----------------------------


def test_get_ai_report_returns_none_when_no_api_key(monkeypatch):
    monkeypatch.setenv("UPSTAGE_API_KEY", "")

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("키가 없으면 네트워크 호출 자체를 하지 않아야 한다")

    monkeypatch.setattr(httpx, "post", _fail_if_called)

    assert ai_report.get_ai_report({"title": "t", "description": "d"}) is None


def test_get_ai_report_returns_none_on_truncated_json(monkeypatch):
    """max_tokens 초과로 응답이 중간에서 끊긴 상황 — json.loads 가 터져도 None 만 나와야 한다.

    여기서 예외가 새면 /analyze 전체가 500 으로 죽는다.
    """
    truncated = (
        '{"defects_found": ["액정 잔기스", "배터리 성능 저하"], '
        '"missing_components": ["박스 없음"], '
        '"scam_warnings": ["선입금 요구"], "model_name": "iPhone 14 P'
    )
    monkeypatch.setenv("UPSTAGE_API_KEY", "test-key")
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResponse(truncated))

    assert ai_report.get_ai_report({"title": "아이폰", "description": "설명"}) is None


def test_get_ai_report_returns_none_on_transport_error(monkeypatch):
    monkeypatch.setenv("UPSTAGE_API_KEY", "test-key")

    def _raise(*args, **kwargs):
        raise httpx.ConnectTimeout("timed out")

    monkeypatch.setattr(httpx, "post", _raise)

    assert ai_report.get_ai_report({"title": "아이폰", "description": "설명"}) is None


def test_get_ai_report_parses_valid_response_and_drops_placeholders(monkeypatch):
    content = (
        '{"defects_found": ["액정 잔기스"], "missing_components": ["박스 없음"], '
        '"scam_warnings": [], "model_name": "iPhone 14 Pro", "year": "미상", '
        '"size_or_capacity": "256GB", "color": "무광 블랙", "usage_period": "N/A"}'
    )
    monkeypatch.setenv("UPSTAGE_API_KEY", "test-key")
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResponse(content))

    result = ai_report.get_ai_report({"title": "아이폰", "description": "설명"})

    assert result["defects_found"] == ["액정 잔기스"]
    assert result["model_name"] == "iPhone 14 Pro"
    assert result["size_or_capacity"] == "256GB"
    assert result["color"] == "무광 블랙"  # 진짜 값은 살아남는다
    assert result["year"] is None  # "미상" → None
    assert result["usage_period"] is None  # "N/A" → None


def test_get_ai_report_caps_list_items_at_five(monkeypatch):
    items = ", ".join(f'"하자{i}"' for i in range(8))
    content = (
        f'{{"defects_found": [{items}], "missing_components": [], "scam_warnings": [], '
        '"model_name": null, "year": null, "size_or_capacity": null, '
        '"color": null, "usage_period": null}'
    )
    monkeypatch.setenv("UPSTAGE_API_KEY", "test-key")
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResponse(content))

    result = ai_report.get_ai_report({"title": "아이폰", "description": "설명"})

    assert len(result["defects_found"]) == 5


def test_max_tokens_has_headroom_for_eight_fields(monkeypatch):
    """8개 필드 최악 출력량(≒490 토큰)이 잘리면 기존 필드까지 통째로 사라진다 — 여유 확인."""
    sent = {}
    monkeypatch.setenv("UPSTAGE_API_KEY", "test-key")

    def _capture(url, **kwargs):
        sent.update(kwargs["json"])
        return _FakeResponse('{"defects_found": [], "missing_components": [], "scam_warnings": []}')

    monkeypatch.setattr(httpx, "post", _capture)
    ai_report.get_ai_report({"title": "아이폰", "description": "설명"})

    assert sent["max_tokens"] >= 800
