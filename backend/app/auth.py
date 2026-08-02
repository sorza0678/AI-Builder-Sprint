"""Backend B: 인증 — 비밀번호 해시(pbkdf2) + 서명 토큰(HMAC).

외부 의존성 없이 파이썬 표준 라이브러리만 사용:
- 비밀번호는 평문 저장 금지 → pbkdf2_hmac(단방향 해시, salt + 20만회 반복)으로 저장.
  DB가 유출돼도 원래 비밀번호를 되돌릴 수 없다.
- 토큰은 "user_id.만료시각.서명" 형태. 서명 = 서버만 아는 SECRET으로 만든 HMAC —
  내용을 위조하면 서명이 안 맞아서 서버가 거부한다 (mini-JWT).

동작 모드 (프론트가 아직 토큰 연동 전이라 하이브리드):
- 토큰 제시 O: 서버는 토큰의 user_id만 믿는다. 요청의 user_id와 다르면 403.
- 토큰 제시 X: 기존처럼 요청의 user_id 사용 (개발/데모 모드).
- 환경변수 AUTH_REQUIRED=1 이면 토큰 없는 /api/v1/* 요청 전부 401 (실서비스 모드).
"""
import hashlib
import hmac
import os
import secrets
import time

# 개발용 폴백 — 이미 리포에 노출된 값으로 간주할 것. 실서비스는 .env 의 AUTH_SECRET 필수.
# `or` 사용: .env 에 'AUTH_SECRET=' (빈 값)으로 있어도 폴백되게 한다 (빈 문자열 서명키 = 누구나 위조 가능한 함정 방지).
_DEV_FALLBACK_SECRET = "dev-only-insecure-secret-change-me"
SECRET = os.getenv("AUTH_SECRET") or _DEV_FALLBACK_SECRET
TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60  # 7일


def secret_is_configured() -> bool:
    """실제 AUTH_SECRET 이 설정됐는지 (빈 값·미설정이면 False) — 운영 기동 가드용."""
    return bool(os.getenv("AUTH_SECRET"))

_PBKDF2_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    """비밀번호 → 'pbkdf2$salt$hash' 문자열 (저장용)."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), _PBKDF2_ITERATIONS
    )
    return f"pbkdf2${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt, expected = stored.split("$")
    except (ValueError, AttributeError):
        return False
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), _PBKDF2_ITERATIONS
    )
    # compare_digest: 일반 == 는 앞글자부터 틀리면 빨리 끝나서 시간차로 유추 가능(타이밍 공격) — 이를 방지
    return hmac.compare_digest(digest.hex(), expected)


def _sign(payload: str) -> str:
    return hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()


def create_token(user_id: str) -> tuple[str, int]:
    """→ (token, expires_at unix초). user_id에 '.'이 없어야 한다 (signup에서 강제)."""
    expires_at = int(time.time()) + TOKEN_TTL_SECONDS
    payload = f"{user_id}.{expires_at}"
    return f"{payload}.{_sign(payload)}", expires_at


def verify_token(token: str) -> str | None:
    """유효하면 user_id, 아니면 None (위조·만료·형식 오류 모두)."""
    try:
        user_id, expires_str, signature = token.rsplit(".", 2)
        expires_at = int(expires_str)
    except (ValueError, AttributeError):
        return None
    if not hmac.compare_digest(_sign(f"{user_id}.{expires_at}"), signature):
        return None
    if time.time() > expires_at:
        return None
    return user_id
