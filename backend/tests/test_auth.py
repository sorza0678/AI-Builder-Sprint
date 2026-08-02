"""인증(P0-3)·guest 이전(P0-4) 테스트."""
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


def _signup(client, user_id="baton001", password="1234"):
    r = client.post("/api/v1/auth/signup", json={"user_id": user_id, "password": password, "nickname": "바톤"})
    assert r.status_code == 200, r.text
    return r.json()["data"]["token"]


def _analyze(client, user_id, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    r = client.post("/api/v1/analyze", json={"user_id": user_id, "url": "https://t.com/mock-safe"}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["data"]["item_id"]


# ---------- 회원가입 / 로그인 ----------

def test_signup_login_roundtrip(client):
    _signup(client)
    r = client.post("/api/v1/auth/login", json={"user_id": "baton001", "password": "1234"})
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["token"] and d["nickname"] == "바톤" and d["expires_at"] > 0


def test_signup_duplicate_and_guest_id_takeover_blocked(client):
    _signup(client)
    assert client.post("/api/v1/auth/signup", json={"user_id": "baton001", "password": "x999"}).status_code == 409
    # 이미 데이터가 있는 guest id 로도 가입 불가 (탈취 방지)
    _analyze(client, "guest-abc")
    assert client.post("/api/v1/auth/signup", json={"user_id": "guest-abc", "password": "1234"}).status_code == 409


def test_login_wrong_password_same_error_as_missing_user(client):
    _signup(client)
    r1 = client.post("/api/v1/auth/login", json={"user_id": "baton001", "password": "wrong"})
    r2 = client.post("/api/v1/auth/login", json={"user_id": "no-such-user", "password": "1234"})
    assert r1.status_code == r2.status_code == 401
    assert r1.json()["error"]["code"] == r2.json()["error"]["code"] == "LOGIN_FAILED"


def test_password_stored_hashed(client):
    from app import db as db_module

    _signup(client)
    stored = db_module.get_user_auth("baton001")["password_hash"]
    assert "1234" not in stored and stored.startswith("pbkdf2$")


# ---------- 토큰 신원 강제 ----------

def test_token_mismatch_user_id_rejected(client):
    token = _signup(client)
    # body의 user_id가 토큰 신원과 다르면 403 (남의 데이터 접근 시도)
    r = client.post(
        "/api/v1/analyze",
        json={"user_id": "someone-else", "url": "https://t.com/mock-safe"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "AUTH_MISMATCH"
    # query 파라미터 경로도 동일
    r2 = client.get(
        "/api/v1/history",
        params={"user_id": "someone-else"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r2.status_code == 403


def test_token_matching_user_id_ok(client):
    token = _signup(client)
    item_id = _analyze(client, "baton001", token)
    r = client.get(
        "/api/v1/history", params={"user_id": "baton001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["data"]["items"][0]["item_id"] == item_id


def test_invalid_or_forged_token_401(client):
    token = _signup(client)
    forged = token[:-4] + ("aaaa" if token[-4:] != "aaaa" else "bbbb")
    for bad in ("garbage", forged, "a.b.c"):
        r = client.get(
            "/api/v1/history", params={"user_id": "baton001"},
            headers={"Authorization": f"Bearer {bad}"},
        )
        assert r.status_code == 401, bad
        assert r.json()["error"]["code"] == "INVALID_TOKEN"


def test_tokenless_requests_still_work_dev_mode(client):
    # 프론트가 토큰 연동 전이므로 토큰 없는 요청은 기존처럼 동작해야 한다
    _analyze(client, "u1")
    assert client.get("/api/v1/history", params={"user_id": "u1"}).status_code == 200


def test_auth_required_mode(client, monkeypatch):
    monkeypatch.setenv("AUTH_REQUIRED", "1")
    assert client.get("/api/v1/history", params={"user_id": "u1"}).status_code == 401
    assert client.get("/health").status_code == 200                # 예외 경로
    token = _signup(client)                                        # auth 경로도 예외
    r = client.get(
        "/api/v1/history", params={"user_id": "baton001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200


# ---------- guest 데이터 이전 ----------

def test_migrate_guest_moves_everything(client):
    # guest가 분석 + 찜 + 비교후보 + 거래 + 수정정보 + 비교기록을 만든 상태
    a = _analyze(client, "guest-x")
    b = _analyze(client, "guest-x")
    client.post("/api/v1/bookmark", json={"user_id": "guest-x", "item_id": a})
    client.post("/api/v1/comparison", json={"user_id": "guest-x", "item_id": a})
    client.post("/api/v1/transaction", json={"user_id": "guest-x", "item_id": a, "stage": "CONTACTING"})
    client.post("/api/v1/compare", json={"user_id": "guest-x", "item_ids": [a, b]})

    token = _signup(client)
    r = client.post(
        "/api/v1/account/migrate-guest",
        json={"guest_user_id": "guest-x"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    moved = r.json()["data"]["migrated"]
    assert moved["analysis_history"] == 2
    assert moved["bookmarks"] == 1 and moved["comparison_items"] == 1
    assert moved["transaction_status"] == 1 and moved["comparison_history"] == 1

    # 계정으로 조회되고, guest로는 안 보임
    assert client.get("/api/v1/history", params={"user_id": "baton001"}).json()["data"]["total"] == 2
    assert client.get("/api/v1/history", params={"user_id": "guest-x"}).json()["data"]["total"] == 0

    # 멱등성: 재호출 시 전부 0
    r2 = client.post(
        "/api/v1/account/migrate-guest",
        json={"guest_user_id": "guest-x"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r2.status_code == 200
    assert all(v == 0 for v in r2.json()["data"]["migrated"].values())

    # 이전된 guest id 는 로그인·가입 불가
    assert client.post("/api/v1/auth/login", json={"user_id": "guest-x", "password": "1234"}).status_code == 401


def test_migrate_guest_requires_token(client):
    assert client.post(
        "/api/v1/account/migrate-guest", json={"guest_user_id": "guest-x"}
    ).status_code == 401


def test_migrate_real_account_blocked(client):
    token = _signup(client)
    client.post("/api/v1/auth/signup", json={"user_id": "victim", "password": "secret"})
    _analyze(client, "victim")
    r = client.post(
        "/api/v1/account/migrate-guest",
        json={"guest_user_id": "victim"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "CANNOT_MIGRATE_ACCOUNT"
    # victim 데이터는 그대로
    assert client.get("/api/v1/history", params={"user_id": "victim"}).json()["data"]["total"] == 1


def test_migrate_to_second_account_blocked(client):
    _analyze(client, "guest-y")
    t1 = _signup(client, "acc1")
    t2 = _signup(client, "acc2")
    assert client.post(
        "/api/v1/account/migrate-guest", json={"guest_user_id": "guest-y"},
        headers={"Authorization": f"Bearer {t1}"},
    ).status_code == 200
    r = client.post(
        "/api/v1/account/migrate-guest", json={"guest_user_id": "guest-y"},
        headers={"Authorization": f"Bearer {t2}"},
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "ALREADY_MIGRATED"


# ---------- IDOR: 남의 매물을 참조할 수 없어야 (보안 리뷰 확정 이슈) ----------

def test_cannot_reference_other_users_item(client):
    """공격자가 피해자의 item_id(정수라 추측 가능)를 자기 요청에 끼워넣어도 전부 404."""
    victim_id = _analyze(client, "victim")
    attacker_token = _signup(client, "attacker")
    H = {"Authorization": f"Bearer {attacker_token}"}

    # 찜/비교후보에 남의 매물 추가 시도
    assert client.post("/api/v1/bookmark", json={"user_id": "attacker", "item_id": victim_id}, headers=H).status_code == 404
    assert client.post("/api/v1/comparison", json={"user_id": "attacker", "item_id": victim_id}, headers=H).status_code == 404
    # 거래상태·매물상세 저장 시도
    assert client.post("/api/v1/transaction", json={"user_id": "attacker", "item_id": victim_id, "stage": "CONTACTING"}, headers=H).status_code == 404
    assert client.post("/api/v1/listing", json={
        "user_id": "attacker", "item_id": victim_id, "title": "탈취", "price": 1,
        "model_name": "", "year": "", "size_or_capacity": "", "color": "",
        "usage_period": "", "components": [], "defects": [],
    }, headers=H).status_code == 404
    # 파생 정보(체크리스트·문의·가격제안)로 내용 추출 시도
    for path in ("checklist", "inquiry-script", "price-proposal"):
        r = client.post(f"/api/v1/{path}", json={"user_id": "attacker", "item_id": victim_id}, headers=H)
        assert r.status_code == 404, path
    # 단건 조회·삭제
    assert client.get(f"/api/v1/analysis/{victim_id}", params={"user_id": "attacker"}, headers=H).status_code == 404
    assert client.delete(f"/api/v1/analysis/{victim_id}", params={"user_id": "attacker"}, headers=H).status_code == 404
    # 피해자 데이터는 무사
    assert client.get("/api/v1/history", params={"user_id": "victim"}).json()["data"]["total"] == 1


def test_compare_rejects_mixed_ownership(client):
    """내 매물 + 남의 매물을 섞어 비교하면 404 (남의 title/price 노출 금지)."""
    victim_id = _analyze(client, "victim")
    attacker_token = _signup(client, "attacker")
    mine = _analyze(client, "attacker", attacker_token)
    H = {"Authorization": f"Bearer {attacker_token}"}
    for path in ("compare", "comparison-history"):
        r = client.post(f"/api/v1/{path}", json={"user_id": "attacker", "item_ids": [mine, victim_id]}, headers=H)
        assert r.status_code == 404, path
        assert "victim" not in r.text


def test_auth_secret_empty_falls_back_not_empty_key(monkeypatch):
    """.env.example 을 그대로 복사(AUTH_SECRET=)해도 빈 문자열 서명키가 되면 안 된다."""
    import importlib

    monkeypatch.setenv("AUTH_SECRET", "")
    from app import auth as auth_module

    reloaded = importlib.reload(auth_module)
    try:
        assert reloaded.SECRET != ""
        assert reloaded.secret_is_configured() is False
    finally:
        monkeypatch.delenv("AUTH_SECRET", raising=False)
        importlib.reload(auth_module)  # 다른 테스트에 영향 없게 원복
