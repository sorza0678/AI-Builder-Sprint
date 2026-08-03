"""잘못된 입력이 500 대신 422/404 로 나가는지 — 최종 게이트에서 발견된 P1 2건의 회귀 테스트.

두 결함 모두 "Pydantic 검증은 통과하는데 그 아래 계층에서 OverflowError 가 터진다" 는
같은 모양이었다. 500 은 프론트가 재시도해야 할지 고쳐 보내야 할지 알 수 없는 응답이라,
'입력이 잘못됐다(422)' 또는 '그런 건 없다(404)' 로 내려가야 한다.

1. item_id 가 64비트 정수 범위를 넘으면 SQLite 드라이버가
   OverflowError("Python int too large to convert to SQLite INTEGER") 를 던졌다 (12개 엔드포인트).
2. meeting_at 이 표현 범위 경계에 오프셋을 달고 오면
   ('0001-01-01T00:00:00+14:00') UTC 환산에서 OverflowError("date value out of range").
"""
import pytest
from fastapi.testclient import TestClient

from app.schemas import INT64_MAX, INT64_MIN

_OVER_MAX = INT64_MAX + 1          # 9223372036854775808
_UNDER_MIN = INT64_MIN - 1
_HUGE = 10**30


@pytest.fixture()
def db_path(tmp_path, monkeypatch):
    from app import db as db_module

    # 로컬 .env 에 실제 DATABASE_URL(Supabase)이 있어도 테스트는 항상 SQLite 를 쓰도록 강제
    monkeypatch.delenv("DATABASE_URL", raising=False)
    path = tmp_path / "test_hostile_input.db"
    monkeypatch.setattr(db_module, "DATABASE", type(db_module.DATABASE)(path))
    db_module.init_db()
    return path


@pytest.fixture()
def client(db_path):
    from app.main import app

    with TestClient(app) as c:
        yield c


def _analyze(client, user_id="u1") -> int:
    r = client.post("/api/v1/analyze", json={"user_id": user_id, "url": "https://test.com/mock-safe"})
    assert r.status_code == 200, r.text
    return r.json()["data"]["item_id"]


# ---------- 1. item_id 범위 ----------

# (method, path, body 여부) — item_id 가 body / query / path 중 어디로 들어가는지가 다 다르다
BODY_ROUTES = [
    ("POST", "/api/v1/bookmark"),
    ("POST", "/api/v1/comparison"),
    ("POST", "/api/v1/checklist"),
    ("POST", "/api/v1/inquiry-script"),
    ("POST", "/api/v1/price-proposal"),
    ("POST", "/api/v1/listing"),
]
QUERY_ROUTES = [
    ("GET", "/api/v1/listing"),
    ("GET", "/api/v1/checklist-state"),
    ("DELETE", "/api/v1/bookmark"),
    ("DELETE", "/api/v1/comparison"),
]
PATH_ROUTES = [
    ("GET", "/api/v1/analysis/{}"),
    ("DELETE", "/api/v1/analysis/{}"),
    ("GET", "/api/v1/comparison-history/{}"),
    ("DELETE", "/api/v1/comparison-history/{}"),
]
OUT_OF_RANGE = [_OVER_MAX, _UNDER_MIN, _HUGE, -_HUGE]


@pytest.mark.parametrize("method,path", BODY_ROUTES)
@pytest.mark.parametrize("value", OUT_OF_RANGE)
def test_body_item_id_out_of_int64_is_422(client, method, path, value):
    r = client.request(method, path, json={"user_id": "u1", "item_id": value})
    assert r.status_code == 422, f"{method} {path} → {r.status_code} {r.text[:200]}"
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize("method,path", QUERY_ROUTES)
@pytest.mark.parametrize("value", OUT_OF_RANGE)
def test_query_item_id_out_of_int64_is_422(client, method, path, value):
    r = client.request(method, path, params={"user_id": "u1", "item_id": value})
    assert r.status_code == 422, f"{method} {path} → {r.status_code} {r.text[:200]}"


@pytest.mark.parametrize("method,path", PATH_ROUTES)
@pytest.mark.parametrize("value", OUT_OF_RANGE)
def test_path_item_id_out_of_int64_is_422(client, method, path, value):
    r = client.request(method, path.format(value), params={"user_id": "u1"})
    assert r.status_code == 422, f"{method} {path} → {r.status_code} {r.text[:200]}"


@pytest.mark.parametrize("value", OUT_OF_RANGE)
def test_transaction_and_checklist_state_item_id_out_of_int64_is_422(client, value):
    r = client.post("/api/v1/transaction",
                    json={"user_id": "u1", "item_id": value, "stage": "SCHEDULED"})
    assert r.status_code == 422, r.text
    r = client.put("/api/v1/checklist-state",
                   json={"user_id": "u1", "item_id": value,
                         "checked_item_ids": [], "excluded_item_ids": []})
    assert r.status_code == 422, r.text


@pytest.mark.parametrize("value", OUT_OF_RANGE)
def test_compare_item_ids_out_of_int64_is_422(client, value):
    """리스트 안에 섞여 들어와도 걸러져야 한다."""
    for path in ("/api/v1/compare", "/api/v1/comparison-history"):
        r = client.post(path, json={"user_id": "u1", "item_ids": [1, value]})
        assert r.status_code == 422, f"{path} → {r.status_code} {r.text[:200]}"


@pytest.mark.parametrize("value", [INT64_MAX, INT64_MIN, 0, -1, 999999])
def test_in_range_item_id_still_404_not_422(client, value):
    """경계 안쪽 값은 기존 그대로 404 여야 한다 — 범위 제한이 정상 동작을 잡아먹으면 안 된다."""
    _analyze(client)  # 다른 매물이 있어도 '없는 id' 는 404
    r = client.get("/api/v1/listing", params={"user_id": "u1", "item_id": value})
    assert r.status_code == 404, f"item_id={value} → {r.status_code} {r.text[:200]}"
    assert r.json()["error"]["code"] == "ITEM_NOT_FOUND"


def test_existing_item_id_still_works(client):
    """정상 id 는 그대로 200 (범위 제한이 실제 경로를 막지 않는지 확인)."""
    item_id = _analyze(client)
    r = client.post("/api/v1/bookmark", json={"user_id": "u1", "item_id": item_id})
    assert r.status_code == 200, r.text


# ---------- 2. meeting_at 표현 범위 ----------

# datetime 은 서기 1~9999년만 표현 가능. 경계값 + 오프셋 = UTC 환산 불가.
UNREPRESENTABLE = [
    "0001-01-01T00:00:00+14:00",
    "0001-01-01T00:00:00+00:01",
    "9999-12-31T23:59:59-12:00",
    "9999-12-31T23:59:59-00:01",
]


@pytest.mark.parametrize("raw", UNREPRESENTABLE)
def test_unrepresentable_meeting_at_is_422_not_500(client, raw):
    item_id = _analyze(client)
    r = client.post("/api/v1/transaction", json={
        "user_id": "u1", "item_id": item_id, "stage": "SCHEDULED", "meeting_at": raw,
    })
    assert r.status_code == 422, f"{raw} → {r.status_code} {r.text[:200]}"
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize("raw", [
    "0001-01-01T00:00:00Z",      # 오프셋이 UTC 면 환산해도 범위 안 — 통과해야 한다
    "9999-12-31T23:59:59Z",
    "0001-01-01T00:00:00",       # naive 는 환산 자체를 안 한다
    "9999-12-31T23:59:59",
    "1970-01-01T00:00:00Z",
])
def test_extreme_but_representable_meeting_at_still_200(client, raw):
    """경계값이라도 환산이 가능하면 막지 않는다 — 과잉 차단 여부 확인."""
    item_id = _analyze(client)
    r = client.post("/api/v1/transaction", json={
        "user_id": "u1", "item_id": item_id, "stage": "SCHEDULED", "meeting_at": raw,
    })
    assert r.status_code == 200, f"{raw} → {r.status_code} {r.text[:200]}"
    assert client.get("/api/v1/transaction", params={"user_id": "u1"}).status_code == 200


@pytest.mark.parametrize("raw", UNREPRESENTABLE)
def test_db_helpers_do_not_raise_on_unrepresentable_values(raw):
    """API 앞단에서 막았더라도 DB 계층이 스스로 죽지 않아야 한다 (이중 방어).

    누가 나중에 다른 경로로 같은 값을 흘려보내도 500 이 되면 안 된다.
    """
    from app.db import _iso_z, _normalize_meeting_at

    stored = _normalize_meeting_at(raw.replace("T", " "))
    assert stored is not None
    read_back = _iso_z(stored)
    assert read_back is not None
    # 읽어 온 값은 응답 스키마(datetime)로 다시 파싱될 수 있어야 500 이 안 난다
    from datetime import datetime

    from pydantic import TypeAdapter

    TypeAdapter(datetime).validate_python(read_back)
