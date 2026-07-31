"""Backend B 신규 엔드포인트(/transaction, /comparison, /bookmark, /mypage) 통합 테스트.

각 테스트는 격리된 임시 SQLite 파일을 쓴다 (dev용 resale_guard.db를 건드리지 않음).
"""
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DATABASE", tmp_path / "test_resale_guard.db")
    with TestClient(app) as c:
        yield c


def _analyze(client, url="mock-safe-test", user_id="u1") -> int:
    r = client.post("/api/v1/analyze", json={"user_id": user_id, "url": url})
    assert r.status_code == 200
    return r.json()["data"]["item_id"]


# ---------- /transaction ----------

def test_transaction_set_and_get(client):
    item_id = _analyze(client)
    r = client.post(
        "/api/v1/transaction", json={"user_id": "u1", "item_id": item_id, "status": "PLANNED"}
    )
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "PLANNED"

    r = client.get("/api/v1/transaction", params={"user_id": "u1"})
    items = r.json()["data"]["items"]
    assert len(items) == 1 and items[0]["status"] == "PLANNED"


def test_transaction_upsert_overwrites_not_duplicates(client):
    item_id = _analyze(client)
    client.post("/api/v1/transaction", json={"user_id": "u1", "item_id": item_id, "status": "PLANNED"})
    client.post("/api/v1/transaction", json={"user_id": "u1", "item_id": item_id, "status": "COMPLETED"})

    r = client.get("/api/v1/transaction", params={"user_id": "u1"})
    items = r.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["status"] == "COMPLETED"


def test_transaction_filter_by_status(client):
    a = _analyze(client, url="mock-safe-a")
    b = _analyze(client, url="danger-b")
    client.post("/api/v1/transaction", json={"user_id": "u1", "item_id": a, "status": "COMPLETED"})
    client.post("/api/v1/transaction", json={"user_id": "u1", "item_id": b, "status": "PLANNED"})

    r = client.get("/api/v1/transaction", params={"user_id": "u1", "status": "COMPLETED"})
    items = r.json()["data"]["items"]
    assert [i["item_id"] for i in items] == [a]


def test_transaction_unknown_item_returns_404(client):
    r = client.post(
        "/api/v1/transaction", json={"user_id": "u1", "item_id": 9999, "status": "PLANNED"}
    )
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "ITEM_NOT_FOUND"


def test_transaction_invalid_status_returns_422(client):
    item_id = _analyze(client)
    r = client.post(
        "/api/v1/transaction", json={"user_id": "u1", "item_id": item_id, "status": "NOT_A_STATUS"}
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
    client.post("/api/v1/transaction", json={"user_id": "u1", "item_id": a, "status": "COMPLETED"})

    r = client.get("/api/v1/mypage", params={"user_id": "u1"})
    data = r.json()["data"]
    assert data == {
        "analysis_count": 2,
        "bookmark_count": 1,
        "comparison_count": 2,
        "transaction_completed_count": 1,
    }


def test_mypage_empty_user_returns_zeros(client):
    r = client.get("/api/v1/mypage", params={"user_id": "brand-new-user"})
    assert r.json()["data"] == {
        "analysis_count": 0,
        "bookmark_count": 0,
        "comparison_count": 0,
        "transaction_completed_count": 0,
    }


# ---------- FK 회귀 방지 (기존 버그: PRAGMA foreign_keys 미적용) ----------

def test_foreign_key_enforcement_rejects_unknown_analysis_id(client):
    with pytest.raises(sqlite3.IntegrityError):
        with db.get_db() as conn:
            conn.execute(
                "INSERT INTO comparison_items(user_id, analysis_id) VALUES ('ghost', 999999)"
            )
            conn.commit()
