"""Backend B 신규 엔드포인트(/transaction, /comparison, /bookmark, /mypage) 통합 테스트.

각 테스트는 격리된 임시 SQLite 파일을 쓴다 (dev용 resale_guard.db를 건드리지 않음).
"""
import json
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    # 로컬 .env에 실제 DATABASE_URL(Supabase)이 있어도 테스트는 항상 SQLite를 쓰도록 강제
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setattr(db, "DATABASE", tmp_path / "test_resale_guard.db")
    with TestClient(app) as c:
        yield c


def _analyze(client, url="mock-safe-test", user_id="u1") -> int:
    r = client.post("/api/v1/analyze", json={"user_id": user_id, "url": url})
    assert r.status_code == 200
    return r.json()["data"]["item_id"]


# ---------- /history ----------

def test_history_returns_items_newest_first(client):
    first_id = _analyze(client)
    second_id = _analyze(client)

    r = client.get("/api/v1/history", params={"user_id": "u1"})
    assert r.status_code == 200
    data = r.json()["data"]
    item_ids = [item["item_id"] for item in data["items"]]
    assert item_ids == [second_id, first_id]

    item = data["items"][0]
    assert set(item.keys()) == {
        "item_id", "source_url", "title", "price", "trust_score", "risk_level", "created_at",
    }


def test_history_pagination(client):
    for _ in range(3):
        _analyze(client)

    r = client.get("/api/v1/history", params={"user_id": "u1", "page": 1, "size": 2})
    data = r.json()["data"]
    assert len(data["items"]) == 2
    assert data["total"] == 3

    r = client.get("/api/v1/history", params={"user_id": "u1", "page": 2, "size": 2})
    data = r.json()["data"]
    assert len(data["items"]) == 1
    assert data["total"] == 3


def test_history_scoped_to_user(client):
    _analyze(client, user_id="u1")
    _analyze(client, user_id="u2")

    r = client.get("/api/v1/history", params={"user_id": "u1"})
    data = r.json()["data"]
    assert data["total"] == 1


def test_history_empty_user_returns_empty_list(client):
    r = client.get("/api/v1/history", params={"user_id": "brand-new-user"})
    data = r.json()["data"]
    assert data["items"] == []
    assert data["total"] == 0


# ---------- /transaction ----------

def _transaction_row(item_id, user_id="u1"):
    with db.get_db() as conn:
        return conn.execute(
            "SELECT stage, decision FROM transaction_status WHERE user_id = ? AND analysis_id = ?",
            (user_id, item_id),
        ).fetchone()


def test_transaction_set_and_get(client):
    item_id = _analyze(client)
    r = client.post(
        "/api/v1/transaction",
        json={"user_id": "u1", "item_id": item_id, "stage": "CONTACTING", "decision": "CONSIDERING"},
    )
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["stage"] == "CONTACTING"
    assert data["decision"] == "CONSIDERING"

    row = _transaction_row(item_id)
    assert row["stage"] == "CONTACTING"
    assert row["decision"] == "CONSIDERING"

    r = client.get("/api/v1/transaction", params={"user_id": "u1"})
    items = r.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["stage"] == "CONTACTING"
    assert items[0]["decision"] == "CONSIDERING"


def test_transaction_upsert_overwrites_not_duplicates(client):
    item_id = _analyze(client)
    client.post(
        "/api/v1/transaction",
        json={"user_id": "u1", "item_id": item_id, "stage": "BEFORE_CONTACT", "decision": "CONSIDERING"},
    )
    r = client.post(
        "/api/v1/transaction", json={"user_id": "u1", "item_id": item_id, "stage": "COMPLETED"}
    )
    assert r.json()["data"]["stage"] == "COMPLETED"
    assert r.json()["data"]["decision"] is None  # decision 생략 → 리셋(전체 덮어쓰기 계약)

    r = client.get("/api/v1/transaction", params={"user_id": "u1"})
    items = r.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["stage"] == "COMPLETED"
    assert items[0]["decision"] is None


def test_transaction_decision_omitted_on_first_insert_is_null(client):
    item_id = _analyze(client)
    r = client.post("/api/v1/transaction", json={"user_id": "u1", "item_id": item_id, "stage": "SCHEDULED"})
    assert r.json()["data"]["decision"] is None
    assert _transaction_row(item_id)["decision"] is None


def test_transaction_decision_persists_independently_of_stage(client):
    item_id = _analyze(client)
    client.post(
        "/api/v1/transaction",
        json={"user_id": "u1", "item_id": item_id, "stage": "SCHEDULED", "decision": "HOLD"},
    )
    row = _transaction_row(item_id)
    assert row["stage"] == "SCHEDULED"
    assert row["decision"] == "HOLD"


def test_transaction_filter_by_stage(client):
    a = _analyze(client, url="mock-safe-a")
    b = _analyze(client, url="danger-b")
    client.post("/api/v1/transaction", json={"user_id": "u1", "item_id": a, "stage": "COMPLETED"})
    client.post("/api/v1/transaction", json={"user_id": "u1", "item_id": b, "stage": "BEFORE_CONTACT"})

    r = client.get("/api/v1/transaction", params={"user_id": "u1", "stage": "COMPLETED"})
    items = r.json()["data"]["items"]
    assert [i["item_id"] for i in items] == [a]


def test_transaction_filter_by_decision(client):
    a = _analyze(client, url="mock-safe-a")
    b = _analyze(client, url="danger-b")
    client.post(
        "/api/v1/transaction",
        json={"user_id": "u1", "item_id": a, "stage": "CONTACTING", "decision": "EXCLUDED"},
    )
    client.post(
        "/api/v1/transaction",
        json={"user_id": "u1", "item_id": b, "stage": "CONTACTING", "decision": "HOLD"},
    )

    r = client.get("/api/v1/transaction", params={"user_id": "u1", "decision": "EXCLUDED"})
    items = r.json()["data"]["items"]
    assert [i["item_id"] for i in items] == [a]


def test_transaction_filter_by_stage_and_decision_combined(client):
    a = _analyze(client, url="mock-safe-a")
    b = _analyze(client, url="danger-b")
    client.post(
        "/api/v1/transaction",
        json={"user_id": "u1", "item_id": a, "stage": "SCHEDULED", "decision": "CONSIDERING"},
    )
    client.post(
        "/api/v1/transaction",
        json={"user_id": "u1", "item_id": b, "stage": "SCHEDULED", "decision": "HOLD"},
    )

    r = client.get(
        "/api/v1/transaction", params={"user_id": "u1", "stage": "SCHEDULED", "decision": "CONSIDERING"}
    )
    items = r.json()["data"]["items"]
    assert [i["item_id"] for i in items] == [a]


def test_transaction_unknown_item_returns_404(client):
    r = client.post(
        "/api/v1/transaction", json={"user_id": "u1", "item_id": 9999, "stage": "BEFORE_CONTACT"}
    )
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "ITEM_NOT_FOUND"


def test_transaction_invalid_stage_returns_422(client):
    item_id = _analyze(client)
    r = client.post(
        "/api/v1/transaction", json={"user_id": "u1", "item_id": item_id, "stage": "NOT_A_STAGE"}
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_transaction_invalid_decision_returns_422(client):
    item_id = _analyze(client)
    r = client.post(
        "/api/v1/transaction",
        json={"user_id": "u1", "item_id": item_id, "stage": "CONTACTING", "decision": "NOT_A_DECISION"},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


# ---------- /comparison ----------

def test_comparison_add_list_remove(client):
    item_id = _analyze(client)

    r = client.post("/api/v1/comparison", json={"user_id": "u1", "item_id": item_id})
    assert r.json()["data"]["added"] is True

    r = client.post("/api/v1/comparison", json={"user_id": "u1", "item_id": item_id})
    assert r.json()["data"]["added"] is False  # 중복 추가는 added=False

    r = client.get("/api/v1/comparison", params={"user_id": "u1"})
    assert r.json()["data"]["total"] == 1

    r = client.delete("/api/v1/comparison", params={"user_id": "u1", "item_id": item_id})
    assert r.json()["data"]["removed"] is True

    r = client.get("/api/v1/comparison", params={"user_id": "u1"})
    assert r.json()["data"]["total"] == 0


def test_comparison_unknown_item_returns_404(client):
    r = client.post("/api/v1/comparison", json={"user_id": "u1", "item_id": 9999})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "ITEM_NOT_FOUND"


# ---------- /bookmark ----------

def test_bookmark_add_list_remove(client):
    item_id = _analyze(client)

    r = client.post("/api/v1/bookmark", json={"user_id": "u1", "item_id": item_id})
    assert r.json()["data"]["bookmarked"] is True

    r = client.get("/api/v1/bookmark", params={"user_id": "u1"})
    assert r.json()["data"]["total"] == 1

    r = client.delete("/api/v1/bookmark", params={"user_id": "u1", "item_id": item_id})
    assert r.json()["data"]["removed"] is True


# ---------- /mypage ----------

def test_mypage_counts_reflect_state(client):
    a = _analyze(client, url="mock-safe-a")
    b = _analyze(client, url="danger-b")
    client.post("/api/v1/bookmark", json={"user_id": "u1", "item_id": a})
    client.post("/api/v1/comparison", json={"user_id": "u1", "item_id": a})
    client.post("/api/v1/comparison", json={"user_id": "u1", "item_id": b})
    client.post("/api/v1/transaction", json={"user_id": "u1", "item_id": a, "stage": "COMPLETED"})

    r = client.get("/api/v1/mypage", params={"user_id": "u1"})
    data = r.json()["data"]
    assert data["analysis_count"] == 2
    assert data["bookmark_count"] == 1
    assert data["comparison_count"] == 2
    assert data["transaction_completed_count"] == 1
    assert [item["item_id"] for item in data["recent_analyses"]] == [b, a]  # 최신순


def test_mypage_empty_user_returns_zeros(client):
    r = client.get("/api/v1/mypage", params={"user_id": "brand-new-user"})
    data = r.json()["data"]
    assert data == {
        "analysis_count": 0,
        "bookmark_count": 0,
        "comparison_count": 0,
        "transaction_completed_count": 0,
        "recent_analyses": [],
    }


def test_mypage_recent_analyses_respects_limit_and_order(client):
    ids = [_analyze(client) for _ in range(4)]

    r = client.get("/api/v1/mypage", params={"user_id": "u1", "recent_limit": 2})
    recent = r.json()["data"]["recent_analyses"]
    assert [item["item_id"] for item in recent] == list(reversed(ids))[:2]


# ---------- /listing ----------

def _listing_payload(item_id, **overrides):
    payload = {
        "user_id": "u1",
        "item_id": item_id,
        "title": "아이폰 13 프로 256GB",
        "price": 850000,
        "model_name": "iPhone 13 Pro",
        "year": "2021",
        "size_or_capacity": "256GB",
        "color": "그래파이트",
        "usage_period": "6개월",
        "components": ["박스", "충전기"],
        "defects": ["액정 미세 스크래치"],
    }
    payload.update(overrides)
    return payload


def test_listing_upsert_creates_row_and_returns_confirmed_fields(client):
    item_id = _analyze(client)
    r = client.post("/api/v1/listing", json=_listing_payload(item_id))
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["item_id"] == item_id
    assert data["model_name"] == "iPhone 13 Pro"
    assert data["components"] == ["박스", "충전기"]
    assert data["defects"] == ["액정 미세 스크래치"]
    assert "updated_at" in data


def test_listing_upsert_updates_not_duplicates(client):
    item_id = _analyze(client)
    client.post("/api/v1/listing", json=_listing_payload(item_id, color="그래파이트"))
    r = client.post("/api/v1/listing", json=_listing_payload(item_id, color="실버"))
    assert r.json()["data"]["color"] == "실버"

    with db.get_db() as conn:
        rows = conn.execute(
            "SELECT color FROM listing_details WHERE user_id = ? AND analysis_id = ?",
            ("u1", item_id),
        ).fetchall()
    assert len(rows) == 1
    assert rows[0]["color"] == "실버"


def test_listing_post_unknown_item_returns_404(client):
    r = client.post("/api/v1/listing", json=_listing_payload(9999))
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "ITEM_NOT_FOUND"


def test_listing_missing_required_field_returns_422(client):
    item_id = _analyze(client)
    payload = _listing_payload(item_id)
    del payload["price"]
    r = client.post("/api/v1/listing", json=payload)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_listing_components_and_defects_persist_as_json_list(client):
    item_id = _analyze(client)
    client.post(
        "/api/v1/listing",
        json=_listing_payload(item_id, components=["박스", "충전기", "이어폰"], defects=[]),
    )

    with db.get_db() as conn:
        row = conn.execute(
            "SELECT components_json, defects_json FROM listing_details "
            "WHERE user_id = ? AND analysis_id = ?",
            ("u1", item_id),
        ).fetchone()
    assert json.loads(row["components_json"]) == ["박스", "충전기", "이어폰"]
    assert json.loads(row["defects_json"]) == []


def test_listing_does_not_mutate_analysis_history(client):
    item_id = _analyze(client)
    with db.get_db() as conn:
        before = conn.execute(
            "SELECT title, price FROM analysis_history WHERE id = ?", (item_id,)
        ).fetchone()

    client.post(
        "/api/v1/listing",
        json=_listing_payload(item_id, title="완전히 다른 상품명", price=1),
    )

    with db.get_db() as conn:
        after = conn.execute(
            "SELECT title, price FROM analysis_history WHERE id = ?", (item_id,)
        ).fetchone()
    assert after["title"] == before["title"]
    assert after["price"] == before["price"]


def test_listing_get_after_upsert_returns_saved_fields(client):
    item_id = _analyze(client)
    client.post("/api/v1/listing", json=_listing_payload(item_id))

    r = client.get("/api/v1/listing", params={"user_id": "u1", "item_id": item_id})
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["item_id"] == item_id
    assert data["model_name"] == "iPhone 13 Pro"
    assert data["components"] == ["박스", "충전기"]
    assert data["defects"] == ["액정 미세 스크래치"]


def test_listing_get_before_upsert_returns_listing_not_found(client):
    item_id = _analyze(client)
    r = client.get("/api/v1/listing", params={"user_id": "u1", "item_id": item_id})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "LISTING_NOT_FOUND"


def test_listing_get_unknown_item_returns_item_not_found(client):
    r = client.get("/api/v1/listing", params={"user_id": "u1", "item_id": 9999})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "ITEM_NOT_FOUND"


def test_listing_get_scoped_to_user(client):
    item_id = _analyze(client)
    client.post("/api/v1/listing", json=_listing_payload(item_id))

    r = client.get("/api/v1/listing", params={"user_id": "u2", "item_id": item_id})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "LISTING_NOT_FOUND"


# ---------- FK 회귀 방지 (기존 버그: PRAGMA foreign_keys 미적용) ----------

def test_foreign_key_enforcement_rejects_unknown_analysis_id(client):
    with pytest.raises(sqlite3.IntegrityError):
        with db.get_db() as conn:
            conn.execute(
                "INSERT INTO comparison_items(user_id, analysis_id) VALUES ('ghost', 999999)"
            )
            conn.commit()
