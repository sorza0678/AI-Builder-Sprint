"""인증 방어 회귀 테스트 — 잘못된 토큰은 500 이 아니라 401 이어야 한다.

실제로 터진 버그: HTTP 헤더는 바이트라서 Starlette 이 latin-1 로 디코딩한다.
UTF-8 한글이 담긴 Authorization 헤더는 non-ASCII 문자가 섞인 str 이 되고,
`hmac.compare_digest` 는 그런 str 에 TypeError 를 던진다
("comparing strings with non-ASCII characters is not supported").
그 호출이 try 블록 밖에 있어서 예외가 그대로 새어 401 이어야 할 요청이 500 이 됐다.

테스트에서 non-ASCII 헤더를 보내려면 **헤더 값을 bytes 로** 넘겨야 한다 —
httpx 는 str 헤더를 ascii 로 인코딩하려다 클라이언트 쪽에서 먼저 터지기 때문에
str 로는 이 버그를 재현할 수 없다 (그래서 그동안 아무도 못 잡았다).

과잉 차단 회귀도 함께 막는다: 정상 토큰은 여전히 통과해야 한다.
"""
import sqlite3
import time

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def db_path(tmp_path, monkeypatch):
    from app import db as db_module

    # 로컬 .env에 실제 DATABASE_URL(Supabase)이 있어도 테스트는 항상 SQLite를 쓰도록 강제
    monkeypatch.delenv("DATABASE_URL", raising=False)
    path = tmp_path / "test_auth_hardening.db"
    monkeypatch.setattr(db_module, "DATABASE", type(db_module.DATABASE)(path))
    db_module.init_db()
    return path


@pytest.fixture()
def client(db_path):
    from app.main import app

    with TestClient(app) as c:
        yield c


def _get_history(client, header_value):
    """Authorization 헤더를 그대로(str 또는 bytes) 실어 보낸다."""
    return client.get(
        "/api/v1/history",
        params={"user_id": "u1"},
        headers={"Authorization": header_value},
    )


def _assert_401(r, label):
    assert r.status_code == 401, f"{label}: 401 이어야 하는데 {r.status_code} — {r.text}"
    assert r.json()["ok"] is False
    assert r.json()["error"]["code"] in ("INVALID_TOKEN", "AUTH_REQUIRED"), r.text


# ---------- non-ASCII 토큰 (실제 500 의 원인) ----------

@pytest.mark.parametrize("label,token_bytes", [
    ("한글 서명", "u1.9999999999.한글서명".encode()),
    ("한글 user_id", "사용자.9999999999.abcdef".encode()),
    ("이모지 서명", "u1.9999999999.🔥🔥".encode()),
    ("전부 한글", "한글토큰입니다".encode()),
    ("latin-1 바이트", b"u1.9999999999.\xe9\xe8"),
    ("깨진 UTF-8", b"u1.9999999999.\xff\xfe\x80"),
    ("한글 + 정상형태 만료시각", "u1.1.서명".encode()),
])
def test_non_ascii_token_returns_401_not_500(client, label, token_bytes):
    r = _get_history(client, b"Bearer " + token_bytes)
    _assert_401(r, label)


def test_non_ascii_token_in_post_body_route(client):
    """GET(query) 뿐 아니라 POST(body) 경로에서도 401 이어야 한다."""
    r = client.post(
        "/api/v1/analyze",
        json={"user_id": "u1", "url": "https://t.com/mock-safe"},
        headers={"Authorization": "Bearer u1.9999999999.한글서명".encode()},
    )
    _assert_401(r, "POST non-ASCII")


# ---------- 그 외 쓰레기 토큰 ----------

@pytest.mark.parametrize("bad", [
    "",                       # 빈 값
    " ",                      # 공백만
    "garbage",                # 점 없음
    "a.b",                    # 점 1개
    "a.b.c",                  # 점 2개지만 만료시각이 숫자가 아님
    "u1.notanint.deadbeef",   # 만료시각 파싱 실패
    "u1..deadbeef",           # 만료시각 없음
    "..",                     # 점만
    "u1.9999999999.",         # 서명 없음
    "u1.9999999999.deadbeef",  # 서명 위조
    "....",
])
def test_garbage_tokens_return_401(client, bad):
    _assert_401(_get_history(client, f"Bearer {bad}"), repr(bad))


def test_wrong_scheme_returns_401(client):
    """'Bearer ' 가 아닌 스킴도 500 이 아니라 401."""
    for header in ("Basic abcdef", "Bearer", "Token abc", "bearerabc"):
        _assert_401(_get_history(client, header), header)


def test_expired_but_correctly_signed_token_returns_401(client):
    """서명은 진짜인데 만료된 토큰 — 401 이어야 하고 500 이면 안 된다."""
    from app import auth

    payload = f"u1.{int(time.time()) - 10}"
    expired = f"{payload}.{auth._sign(payload)}"
    _assert_401(_get_history(client, f"Bearer {expired}"), "만료 토큰")


def test_very_long_token_returns_401(client):
    _assert_401(_get_history(client, "Bearer " + "a" * 10_000), "초장문 토큰")


# ---------- 과잉 차단 회귀 방지: 정상 토큰은 통과해야 한다 ----------

def test_valid_token_still_works(client):
    """방어 코드를 넣다가 정상 토큰까지 막아버리면 로그인 자체가 죽는다."""
    signup = client.post(
        "/api/v1/auth/signup",
        json={"user_id": "baton001", "password": "1234", "nickname": "바톤"},
    )
    assert signup.status_code == 200, signup.text
    token = signup.json()["data"]["token"]

    headers = {"Authorization": f"Bearer {token}"}
    analyze = client.post(
        "/api/v1/analyze",
        json={"user_id": "baton001", "url": "https://t.com/mock-safe"},
        headers=headers,
    )
    assert analyze.status_code == 200, analyze.text

    r = client.get("/api/v1/history", params={"user_id": "baton001"}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["items"][0]["item_id"] == analyze.json()["data"]["item_id"]

    # 로그인도 정상 (비밀번호 검증 경로에 같은 방어를 넣었으므로 함께 확인)
    login = client.post("/api/v1/auth/login", json={"user_id": "baton001", "password": "1234"})
    assert login.status_code == 200, login.text
    assert login.json()["data"]["token"]


def test_token_without_header_still_dev_mode(client):
    """토큰 미제시는 기존대로 통과 (프론트 미연동 데모 모드) — 방어가 여기까지 번지면 안 된다."""
    client.post("/api/v1/analyze", json={"user_id": "u1", "url": "https://t.com/mock-safe"})
    assert client.get("/api/v1/history", params={"user_id": "u1"}).status_code == 200


# ---------- 단위 레벨: verify_token / verify_password 는 절대 예외를 던지지 않는다 ----------

@pytest.mark.parametrize("token", [
    "u1.9999999999.한글서명",
    "u1.9999999999.🔥",
    "한글.9999999999.abcdef",
    "\ud800.9999999999.abcdef",   # 짝 없는 서로게이트 — _sign 의 encode() 가 터지던 경로
    "u1.9999999999.\ud800",
    "garbage", "", "a.b", "a.b.c", "u1.notanint.sig",
    None, 123, b"u1.9999999999.abc", ["u1", "9", "s"],
])
def test_verify_token_never_raises(token):
    """계약: 어떤 입력이 와도 예외 없이 None 또는 user_id.

    미들웨어는 None 만 401 로 바꾼다 — 예외는 그대로 500 이 되기 때문에
    '예외를 안 던진다' 자체가 이 함수의 계약이다.
    """
    from app import auth

    assert auth.verify_token(token) is None


def test_verify_token_accepts_its_own_token():
    from app import auth

    token, _ = auth.create_token("u1")
    assert auth.verify_token(token) == "u1"
    # 서명 한 글자만 바꿔도 거부
    tampered = token[:-1] + ("a" if token[-1] != "a" else "b")
    assert auth.verify_token(tampered) is None


@pytest.mark.parametrize("stored", [
    "pbkdf2$zz$abc",       # salt 가 hex 가 아님 (fromhex → ValueError 로 500 이 나던 경로)
    "pbkdf2$$",            # salt·해시 없음
    "pbkdf2$한글$abc",      # non-ASCII salt
    "pbkdf2$00$한글해시",    # non-ASCII 해시 → compare_digest TypeError
    "notahash",            # '$' 구분자 없음
    "a$b$c$d",             # 조각이 너무 많음
    "", None, 12345,
])
def test_verify_password_never_raises(stored):
    from app import auth

    assert auth.verify_password("1234", stored) is False


def test_verify_password_roundtrip():
    """과잉 차단 회귀 방지 — 올바른 비밀번호는 여전히 True."""
    from app import auth

    stored = auth.hash_password("비밀번호1234")
    assert auth.verify_password("비밀번호1234", stored) is True
    assert auth.verify_password("wrong", stored) is False


def test_login_with_corrupted_password_hash_returns_401(client, db_path):
    """DB 의 password_hash 가 손상돼도 로그인은 401 이어야 한다 (500 금지).

    손상된 행은 API 로 만들 수 없으므로 직접 UPDATE 로 심는다.
    """
    client.post("/api/v1/auth/signup", json={"user_id": "baton002", "password": "1234"})
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", ("pbkdf2$zz$abc", "baton002"))

    r = client.post("/api/v1/auth/login", json={"user_id": "baton002", "password": "1234"})
    assert r.status_code == 401, r.text
    assert r.json()["error"]["code"] == "LOGIN_FAILED"


def test_auth_required_mode_rejects_non_ascii_token(client, monkeypatch):
    """실서비스 모드(AUTH_REQUIRED=1)에서도 non-ASCII 토큰은 401."""
    monkeypatch.setenv("AUTH_REQUIRED", "1")
    _assert_401(_get_history(client, "Bearer u1.9999999999.한글서명".encode()), "AUTH_REQUIRED 모드")
    assert client.get("/health").status_code == 200  # 예외 경로는 그대로


def test_unhandled_exception_is_logged(client, caplog):
    """미들웨어가 500 을 삼키더라도 traceback 은 로그에 남아야 한다.

    이 로그가 없어서 거래내역 500 의 원인을 아무도 찾지 못했다 (콘솔에 아무것도 안 찍혔다).
    """
    import logging

    from app import main as main_module

    def _boom(*args, **kwargs):
        raise RuntimeError("의도적 폭발")

    original = main_module.db.get_transactions
    main_module.db.get_transactions = _boom
    try:
        with caplog.at_level(logging.ERROR, logger="app"):
            r = client.get("/api/v1/transaction", params={"user_id": "u1"})
    finally:
        main_module.db.get_transactions = original

    assert r.status_code == 500
    assert r.json()["error"]["code"] == "INTERNAL_ERROR"  # 사용자에게는 내부 상세를 숨긴다
    assert "의도적 폭발" in caplog.text, "삼킨 예외의 traceback 이 로그에 없다"
    assert "/api/v1/transaction" in caplog.text  # 어느 요청인지도 함께 남아야 한다
