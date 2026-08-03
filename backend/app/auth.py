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


def _constant_time_equals(expected: str, provided: str) -> bool:
    """타이밍 공격 방어(compare_digest)는 유지하면서, 어떤 입력이 와도 예외를 내지 않는 비교.

    hmac.compare_digest 는 str 인자에 non-ASCII 문자가 하나라도 섞이면
    TypeError("comparing strings with non-ASCII characters is not supported") 를 던진다.
    우리가 비교하는 값(HMAC 서명·pbkdf2 해시)은 항상 ASCII hex 이므로,
    non-ASCII 가 들어왔다는 건 곧 '틀린 값'이라는 뜻이다 → 조용히 False.
    이 예외가 밖으로 새면 401 이어야 할 요청이 500 이 된다 (실제로 그랬다).
    """
    try:
        return hmac.compare_digest(expected, provided)
    except TypeError:
        # non-ASCII 문자열, 또는 str/bytes 가 아닌 값(None 등)
        return False


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt, expected = stored.split("$")
        # fromhex/encode 도 try 안에 둔다 — salt 가 hex 가 아닌 손상된 행이 있으면
        # 여기서 ValueError 가 나고, 밖에 두면 로그인 요청이 401 대신 500 이 된다.
        salt_bytes = bytes.fromhex(salt)
        password_bytes = password.encode()
    except (ValueError, AttributeError):
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password_bytes, salt_bytes, _PBKDF2_ITERATIONS)
    # compare_digest: 일반 == 는 앞글자부터 틀리면 빨리 끝나서 시간차로 유추 가능(타이밍 공격) — 이를 방지
    return _constant_time_equals(digest.hex(), expected)


def _sign(payload: str) -> str:
    return hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()


def create_token(user_id: str) -> tuple[str, int]:
    """→ (token, expires_at unix초). user_id에 '.'이 없어야 한다 (signup에서 강제)."""
    expires_at = int(time.time()) + TOKEN_TTL_SECONDS
    payload = f"{user_id}.{expires_at}"
    return f"{payload}.{_sign(payload)}", expires_at


def verify_token(token: str) -> str | None:
    """유효하면 user_id, 아니면 None (위조·만료·형식 오류 모두).

    어떤 형태의 토큰이 와도 예외를 밖으로 흘리지 않는 것이 이 함수의 계약이다 —
    호출부(미들웨어)는 None 을 401 로 바꾸지만, 예외는 그대로 500 이 되기 때문이다.
    그래서 서명 생성(_sign)과 비교까지 전부 방어 범위 안에 둔다.
    """
    try:
        user_id, expires_str, signature = token.rsplit(".", 2)
        expires_at = int(expires_str)
        # _sign 의 encode() 도 서로게이트 문자 등에서 UnicodeEncodeError(ValueError) 를 낼 수 있다
        expected = _sign(f"{user_id}.{expires_at}")
    except (ValueError, AttributeError, TypeError):
        return None
    # 서명에 한글 같은 non-ASCII 가 섞여 있어도 여기서 False 로 떨어진다 (예외 아님)
    if not _constant_time_equals(expected, signature):
        return None
    if time.time() > expires_at:
        return None
    return user_id
