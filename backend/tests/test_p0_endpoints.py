"""P0/P1 신규·확장 엔드포인트 통합 테스트.

- 사용자 수정값(/listing)이 history/bookmark/comparison/compare/transaction에 반영되는지
- 분석 단건 조회 + 소유권 검증
- soft delete가 모든 목록에서 함께 사라지게 하는지
- 비교 기록 저장/조회/삭제 + snapshot 보존
- 구조화 체크리스트/문의질문/가격제안 응답 형태
"""
import os
import tempfile

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    from app import db as db_module

    # 로컬 .env에 실제 DATABASE_URL(Supabase)이 있어도 테스트는 항상 SQLite를 쓰도록 강제
    monkeypatch.delenv("DATABASE_URL", raising=False)
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    monkeypatch.setattr(db_module, "DATABASE", type(db_module.DATABASE)(path))
    from app.main import app

    db_module.init_db()
    with TestClient(app) as c:
        yield c
    os.unlink(path)


def _analyze(client, user_id="u1", url="https://test.com/mock-safe"):
    r = client.post("/api/v1/analyze", json={"user_id": user_id, "url": url})
    assert r.status_code == 200
    return r.json()["data"]["item_id"]


def _save_listing(client, item_id, user_id="u1", title="수정된 제목", price=777_000, defects=None):
    r = client.post("/api/v1/listing", json={
        "user_id": user_id, "item_id": item_id, "title": title, "price": price,
        "model_name": "iPhone 14 Pro", "year": "2022", "size_or_capacity": "256GB",
        "color": "딥퍼플", "usage_period": "1년", "components": ["본체"],
        "defects": defects if defects is not None else ["사용자 확인 하자"],
    })
    assert r.status_code == 200


# ---------- P0-1: 사용자 수정값의 전체 반영 ----------

def test_listing_override_in_history(client):
    item_id = _analyze(client)
    _save_listing(client, item_id)
    items = client.get("/api/v1/history", params={"user_id": "u1"}).json()["data"]["items"]
    assert items[0]["title"] == "수정된 제목"
    assert items[0]["price"] == 777_000


def test_listing_override_in_bookmark_and_comparison(client):
    item_id = _analyze(client)
    client.post("/api/v1/bookmark", json={"user_id": "u1", "item_id": item_id})
    client.post("/api/v1/comparison", json={"user_id": "u1", "item_id": item_id})
    _save_listing(client, item_id)

    bm = client.get("/api/v1/bookmark", params={"user_id": "u1"}).json()["data"]["items"][0]
    assert bm["title"] == "수정된 제목" and bm["price"] == 777_000
    assert "bookmarked_at" in bm and bm["source_url"]

    cp = client.get("/api/v1/comparison", params={"user_id": "u1"}).json()["data"]["items"][0]
    assert cp["title"] == "수정된 제목"
    assert "comparison_added_at" in cp


def test_listing_override_in_compare_and_transaction(client):
    a = _analyze(client)
    b = _analyze(client, url="https://test.com/warning")
    _save_listing(client, a)
    client.post("/api/v1/transaction", json={"user_id": "u1", "item_id": a, "stage": "CONTACTING"})

    cmp_items = client.post(
        "/api/v1/compare", json={"user_id": "u1", "item_ids": [a, b]}
    ).json()["data"]["items"]
    assert next(i for i in cmp_items if i["item_id"] == a)["title"] == "수정된 제목"
    # 사용자 확정 하자가 원본 하자를 대체
    assert next(i for i in cmp_items if i["item_id"] == a)["product_status"]["defects_found"] == ["사용자 확인 하자"]

    tx = client.get("/api/v1/transaction", params={"user_id": "u1"}).json()["data"]["items"][0]
    assert tx["title"] == "수정된 제목"


def test_other_users_edit_does_not_leak(client):
    item_id = _analyze(client, user_id="u1")
    _save_listing(client, item_id, user_id="u1")
    # u2가 같은 매물을 분석 기록에 가진 게 아니므로 u2 history는 빈 목록이어야 정상
    items = client.get("/api/v1/history", params={"user_id": "u2"}).json()["data"]["items"]
    assert items == []


# ---------- P0-2: 단건 조회 + 소유권 ----------

def test_analysis_detail_with_listing(client):
    item_id = _analyze(client)
    _save_listing(client, item_id)
    r = client.get(f"/api/v1/analysis/{item_id}", params={"user_id": "u1"})
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["title"] == "수정된 제목"          # 상단은 수정값 우선
    assert d["listing_details"]["model_name"] == "iPhone 14 Pro"
    assert d["created_at"] and d["updated_at"]
    assert d["source_url"]


def test_analysis_detail_without_listing_has_null(client):
    item_id = _analyze(client)
    d = client.get(f"/api/v1/analysis/{item_id}", params={"user_id": "u1"}).json()["data"]
    assert d["listing_details"] is None
    assert d["updated_at"] is None


def test_analysis_detail_ownership(client):
    item_id = _analyze(client, user_id="u1")
    r = client.get(f"/api/v1/analysis/{item_id}", params={"user_id": "u2"})
    assert r.status_code == 404  # 남의 것은 "없음"과 동일


# ---------- P1-7: soft delete ----------

def test_delete_removes_from_all_lists(client):
    item_id = _analyze(client)
    client.post("/api/v1/bookmark", json={"user_id": "u1", "item_id": item_id})
    client.post("/api/v1/comparison", json={"user_id": "u1", "item_id": item_id})
    client.post("/api/v1/transaction", json={"user_id": "u1", "item_id": item_id, "stage": "CONTACTING"})

    r = client.delete(f"/api/v1/analysis/{item_id}", params={"user_id": "u1"})
    assert r.status_code == 200 and r.json()["data"]["deleted"] is True

    assert client.get("/api/v1/history", params={"user_id": "u1"}).json()["data"]["total"] == 0
    assert client.get("/api/v1/bookmark", params={"user_id": "u1"}).json()["data"]["items"] == []
    assert client.get("/api/v1/comparison", params={"user_id": "u1"}).json()["data"]["items"] == []
    assert client.get("/api/v1/transaction", params={"user_id": "u1"}).json()["data"]["items"] == []
    assert client.get(f"/api/v1/analysis/{item_id}", params={"user_id": "u1"}).status_code == 404
    mypage = client.get("/api/v1/mypage", params={"user_id": "u1"}).json()["data"]
    assert mypage["analysis_count"] == 0 and mypage["bookmark_count"] == 0


def test_delete_clears_completed_transaction_count(client):
    # 완료 거래가 있는 분석을 삭제하면 mypage 완료 카운트도 0이어야 (유령 카운트 방지)
    item_id = _analyze(client)
    client.post("/api/v1/transaction", json={"user_id": "u1", "item_id": item_id, "stage": "COMPLETED"})
    assert client.get("/api/v1/mypage", params={"user_id": "u1"}).json()["data"]["transaction_completed_count"] == 1
    client.delete(f"/api/v1/analysis/{item_id}", params={"user_id": "u1"})
    mypage = client.get("/api/v1/mypage", params={"user_id": "u1"}).json()["data"]
    assert mypage["transaction_completed_count"] == 0
    assert client.get("/api/v1/transaction", params={"user_id": "u1"}).json()["data"]["total"] == 0


def test_delete_ownership_and_double_delete(client):
    item_id = _analyze(client, user_id="u1")
    assert client.delete(f"/api/v1/analysis/{item_id}", params={"user_id": "u2"}).status_code == 404
    assert client.delete(f"/api/v1/analysis/{item_id}", params={"user_id": "u1"}).status_code == 200
    assert client.delete(f"/api/v1/analysis/{item_id}", params={"user_id": "u1"}).status_code == 404


# ---------- P1-6: 비교 기록 ----------

def test_compare_saves_history_with_snapshot(client):
    a = _analyze(client)
    b = _analyze(client, url="https://test.com/danger")
    cmp_data = client.post("/api/v1/compare", json={"user_id": "u1", "item_ids": [a, b]}).json()["data"]
    cid = cmp_data["comparison_id"]
    assert cid

    record = client.get(f"/api/v1/comparison-history/{cid}", params={"user_id": "u1"}).json()["data"]
    assert record["item_ids"] == [a, b]
    snapshot_title = record["items"][0]["title"]

    # 이후 제목을 수정해도 snapshot은 비교 당시 값 그대로
    _save_listing(client, a, title="나중에 바꾼 제목")
    record2 = client.get(f"/api/v1/comparison-history/{cid}", params={"user_id": "u1"}).json()["data"]
    assert record2["items"][0]["title"] == snapshot_title

    # 목록·삭제·소유권
    assert client.get("/api/v1/comparison-history", params={"user_id": "u1"}).json()["data"]["total"] == 1
    assert client.get(f"/api/v1/comparison-history/{cid}", params={"user_id": "u2"}).status_code == 404
    assert client.delete(f"/api/v1/comparison-history/{cid}", params={"user_id": "u1"}).status_code == 200
    assert client.get("/api/v1/comparison-history", params={"user_id": "u1"}).json()["data"]["total"] == 0


def test_comparison_history_post_endpoint(client):
    a = _analyze(client)
    b = _analyze(client, url="https://test.com/warning")
    r = client.post("/api/v1/comparison-history", json={"user_id": "u1", "item_ids": [a, b]})
    assert r.status_code == 200
    assert r.json()["data"]["recommendation"]


# ---------- A: 구조화 체크리스트·문의질문·가격제안 ----------

def test_checklist_structured_response(client):
    item_id = _analyze(client)
    d = client.post("/api/v1/checklist", json={"user_id": "u1", "item_id": item_id}).json()["data"]
    assert [g["key"] for g in d["groups"]] == ["BEFORE_TRADE", "ON_SITE", "BEFORE_PAYMENT"]
    assert d["checklist"] == [i["text"] for g in d["groups"] for i in g["items"]]  # 구버전 호환


def test_inquiry_structured_response(client):
    item_id = _analyze(client)
    d = client.post("/api/v1/inquiry-script", json={"user_id": "u1", "item_id": item_id}).json()["data"]
    assert d["questions"] and d["combined_script"]
    assert d["script"] == d["combined_script"]  # 구버전 호환


def test_price_proposal_endpoint_mock_record_is_null(client):
    # mock 트리거 기록은 market_price(시세 상세)가 없어서 target_price null이어야 함
    item_id = _analyze(client)
    d = client.post("/api/v1/price-proposal", json={"user_id": "u1", "item_id": item_id}).json()["data"]
    assert d["target_price"] is None
    assert d["reasons"]
    assert client.post(
        "/api/v1/price-proposal", json={"user_id": "u1", "item_id": 9999}
    ).status_code == 404
