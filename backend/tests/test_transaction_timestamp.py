"""거래 일정(meeting_at) 타임스탬프 회귀 테스트 — 프로덕션 500 재발 방지.

실제로 터진 버그: 프론트가 JS `toISOString()` 형식("2026-08-05T06:00:00.000Z")을 보내면
DB 에 오프셋이 붙은 채로 저장되고, 조회 때 `_iso_z` 가 뒤에 'Z' 를 한 번 더 붙여
"2026-08-05T06:00:00+00:00Z" 라는 타임존 두 번짜리 문자열이 만들어졌다.
이 값은 Pydantic 의 datetime 파서가 거부하므로 응답 검증 단계에서
ResponseValidationError → GET /api/v1/transaction 이 통째로 500.

그래서 이 파일의 테스트는 **반드시 API 레벨(TestClient)** 이다.
db 함수만 직접 부르면 Pydantic 응답 검증을 건너뛰어 이 버그를 못 잡는다 —
`db.get_transactions()` 는 깨진 문자열도 그냥 dict 로 돌려주기 때문에 초록불이 뜬다.
"""
import sqlite3
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter, ValidationError

_UTC = timezone.utc
_DT = TypeAdapter(datetime)  # 응답 문자열이 스키마(datetime)로 되읽히는지 검사용


@pytest.fixture()
def db_path(tmp_path, monkeypatch):
    """격리된 임시 SQLite 경로. 경로를 돌려주는 이유는 아래 '깨진 행' 테스트가
    API 로는 만들 수 없는 값(레거시 데이터)을 직접 UPDATE 로 심어야 하기 때문이다."""
    from app import db as db_module

    # 로컬 .env에 실제 DATABASE_URL(Supabase)이 있어도 테스트는 항상 SQLite를 쓰도록 강제
    monkeypatch.delenv("DATABASE_URL", raising=False)
    path = tmp_path / "test_transaction_timestamp.db"
    monkeypatch.setattr(db_module, "DATABASE", type(db_module.DATABASE)(path))
    db_module.init_db()
    return path


@pytest.fixture()
def client(db_path):
    from app.main import app

    with TestClient(app) as c:
        yield c


def _analyze(client, user_id="u1", url="https://test.com/mock-safe") -> int:
    r = client.post("/api/v1/analyze", json={"user_id": user_id, "url": url})
    assert r.status_code == 200, r.text
    return r.json()["data"]["item_id"]


def _post_meeting(client, item_id, meeting_at, user_id="u1"):
    return client.post("/api/v1/transaction", json={
        "user_id": user_id, "item_id": item_id, "stage": "SCHEDULED",
        "meeting_at": meeting_at, "meeting_place": "강남역 11번 출구",
    })


def _first_transaction(client, user_id="u1") -> dict:
    r = client.get("/api/v1/transaction", params={"user_id": user_id})
    # ← 여기가 실제로 500 이 나던 지점. status_code 를 먼저 단언해야 원인이 드러난다.
    assert r.status_code == 200, f"거래내역 조회 실패: {r.status_code} {r.text}"
    return r.json()["data"]["items"][0]


def _stored_meeting_at(db_path) -> str | None:
    with sqlite3.connect(str(db_path)) as conn:
        return conn.execute("SELECT meeting_at FROM transaction_status").fetchone()[0]


# 프론트(JS)가 실제로 보내는 형식들. 앞의 셋은 같은 순간(06:00 UTC)을 다르게 표기한 것.
MEETING_AT_INPUTS = [
    # (입력, 기대 UTC 순간)
    ("2026-08-05T06:00:00.000Z", datetime(2026, 8, 5, 6, 0, tzinfo=_UTC)),   # JS toISOString()
    ("2026-08-05T06:00:00Z", datetime(2026, 8, 5, 6, 0, tzinfo=_UTC)),
    ("2026-08-05T06:00:00+00:00", datetime(2026, 8, 5, 6, 0, tzinfo=_UTC)),
    ("2026-08-05T15:00:00+09:00", datetime(2026, 8, 5, 6, 0, tzinfo=_UTC)),  # KST — 같은 순간
    ("2026-08-05T15:00:00", datetime(2026, 8, 5, 15, 0, tzinfo=_UTC)),       # naive = UTC 로 간주
]


# ---------- 1. 핵심: 저장 후 조회가 200 인가 ----------

@pytest.mark.parametrize("raw,expected", MEETING_AT_INPUTS, ids=lambda v: str(v)[:26])
def test_meeting_at_roundtrip_returns_200(client, raw, expected):
    """meeting_at 저장 → GET /api/v1/transaction 200. 이 조합이 500 을 냈었다."""
    item_id = _analyze(client)
    assert _post_meeting(client, item_id, raw).status_code == 200

    item = _first_transaction(client)
    assert item["item_id"] == item_id
    assert item["meeting_place"] == "강남역 11번 출구"
    assert _DT.validate_python(item["meeting_at"]) == expected


@pytest.mark.parametrize("raw,expected", MEETING_AT_INPUTS, ids=lambda v: str(v)[:26])
def test_meeting_at_roundtrip_in_post_response(client, raw, expected):
    """POST 응답의 meeting_at 이 조회 API 와 '완전히 같은 문자열'이어야 한다.

    순간만 맞는지 보면 부족하다 — 오프셋 없는 "2026-08-05T06:00:00" 을 내보내도
    파싱 결과를 UTC 로 간주해 버리면 테스트는 통과하지만, 브라우저의
    `new Date()` 는 그 값을 '로컬 시각'으로 읽어 KST 기준 9시간 어긋난 시각을 보여준다.
    그래서 여기서는 (1) 타임존이 붙어 있는지, (2) GET 응답과 문자열까지 같은지를 단언한다.
    """
    item_id = _analyze(client)
    r = _post_meeting(client, item_id, raw)
    assert r.status_code == 200, r.text
    raw_value = r.json()["data"]["meeting_at"]

    got = _DT.validate_python(raw_value)
    assert got.tzinfo is not None, (
        f"POST 응답에 타임존이 없다: {raw_value!r} — JS 가 로컬 시각으로 오해한다"
    )
    assert got == expected
    assert raw_value == _first_transaction(client)["meeting_at"], (
        "POST 응답과 GET 응답의 meeting_at 표기가 다르다"
    )


def test_meeting_at_survives_repeated_reads(client):
    """같은 행을 몇 번을 조회해도 계속 200 이어야 한다 (_iso_z 멱등성의 API 레벨 확인)."""
    item_id = _analyze(client)
    _post_meeting(client, item_id, "2026-08-05T06:00:00.000Z")
    values = {_first_transaction(client)["meeting_at"] for _ in range(3)}
    assert len(values) == 1, f"조회할 때마다 값이 달라진다: {values}"


# ---------- 2. 이미 깨진 레거시 행도 읽혀야 한다 (마이그레이션 없이) ----------

@pytest.mark.parametrize("legacy,expected", [
    ("2026-08-05 06:00:00+00:00", datetime(2026, 8, 5, 6, 0, tzinfo=_UTC)),   # 버그가 남긴 값
    ("2026-08-05 15:00:00+09:00", datetime(2026, 8, 5, 6, 0, tzinfo=_UTC)),   # KST 로 저장된 값
    ("2026-08-05T06:00:00Z", datetime(2026, 8, 5, 6, 0, tzinfo=_UTC)),        # 'Z' 가 이미 붙은 값
    ("2026-08-05 06:00:00.123456", datetime(2026, 8, 5, 6, 0, tzinfo=_UTC)),  # 소수점 이하 초
    ("2026-08-05 15:00:00", datetime(2026, 8, 5, 15, 0, tzinfo=_UTC)),        # 정상(naive) 값
])
def test_legacy_broken_row_is_readable_without_migration(client, db_path, legacy, expected):
    """DB 에 이미 들어있는 깨진 값도 읽기 경로만으로 복구돼야 한다.

    운영 DB 에는 버그 시절에 저장된 행이 남아 있고, 해커톤 일정상 마이그레이션을 돌릴 수
    없다. 그래서 '고친 뒤에 저장한 값만 정상'이면 안 되고, 기존 행도 200 이어야 한다.
    API 로는 이런 값을 만들 수 없으므로 직접 UPDATE 로 심는다.
    """
    item_id = _analyze(client)
    _post_meeting(client, item_id, "2026-08-05T06:00:00.000Z")
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute("UPDATE transaction_status SET meeting_at = ?", (legacy,))

    item = _first_transaction(client)
    assert _DT.validate_python(item["meeting_at"]) == expected


@pytest.mark.xfail(
    strict=True,
    reason="미해결(낮은 우선순위): _iso_z 는 파싱 불가한 값을 원본 그대로 돌려주므로 "
           "('2026-08-05 25:99:99+00:00' → '2026-08-05T25:99:99+00:00') 여전히 Pydantic 이 거부해 500 이 된다. "
           "단 이 값은 API 로는 만들어질 수 없다 — meeting_at 은 입력 시 Pydantic datetime 검증을 "
           "거치고, 버그 시절 저장된 행도 검증된 datetime 의 isoformat 이라 항상 파싱 가능하다. "
           "따라서 DB 를 직접 손댄 경우에만 발생. 고친다면 _iso_z 가 마지막 갈래에서 None 을 "
           "돌려주게 하면 되지만, 그건 이번 핫픽스 범위 밖이라 사실만 기록해 둔다.",
)
def test_legacy_unparseable_row_does_not_500(client, db_path):
    """형식을 알 수 없는 값이 들어있어도 목록 전체가 죽으면 안 된다 (현재는 죽는다 — xfail)."""
    item_id = _analyze(client)
    _post_meeting(client, item_id, "2026-08-05T06:00:00.000Z")
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute("UPDATE transaction_status SET meeting_at = ?", ("2026-08-05 25:99:99+00:00",))

    r = client.get("/api/v1/transaction", params={"user_id": "u1"})
    # 값을 못 읽는 건 데이터 문제지만, 응답이 500 이 되는 건 우리 문제다.
    assert r.status_code != 500, r.text


# ---------- 3. UTC 가 아닌 오프셋에서 시각이 바뀌지 않는가 ----------

def test_kst_offset_is_converted_not_truncated(client):
    """+09:00 을 '잘라내면' 15:00Z 가 되어 9시간 틀어진다. 반드시 06:00Z 로 환산돼야 한다."""
    item_id = _analyze(client)
    _post_meeting(client, item_id, "2026-08-05T15:00:00+09:00")

    got = _DT.validate_python(_first_transaction(client)["meeting_at"])
    assert got == datetime(2026, 8, 5, 6, 0, tzinfo=_UTC)
    assert got != datetime(2026, 8, 5, 15, 0, tzinfo=_UTC), "오프셋을 잘라내 시각이 9시간 틀어졌다"


def test_same_instant_different_notation_is_identical(client):
    """같은 순간을 다르게 표기해 보내면 조회 결과도 같아야 한다 (표기법이 값을 바꾸면 안 된다)."""
    item_id = _analyze(client)
    seen = set()
    for raw in ("2026-08-05T06:00:00.000Z", "2026-08-05T06:00:00+00:00", "2026-08-05T15:00:00+09:00"):
        _post_meeting(client, item_id, raw)
        seen.add(_first_transaction(client)["meeting_at"])
    assert len(seen) == 1, f"표기법에 따라 결과가 달라진다: {seen}"


def test_negative_offset_is_converted(client):
    """음수 오프셋(-05:00)도 환산돼야 한다 — 날짜의 '-' 와 오프셋의 '-' 를 혼동하면 깨진다."""
    item_id = _analyze(client)
    _post_meeting(client, item_id, "2026-08-05T01:00:00-05:00")
    assert _DT.validate_python(_first_transaction(client)["meeting_at"]) == datetime(
        2026, 8, 5, 6, 0, tzinfo=_UTC
    )


def test_stored_value_has_no_timezone_offset(client, db_path):
    """저장 시점에도 UTC 로 통일 — 오프셋이 섞인 값이 DB 에 계속 쌓이면 정렬·비교가 어긋난다."""
    item_id = _analyze(client)
    _post_meeting(client, item_id, "2026-08-05T15:00:00+09:00")

    stored = _stored_meeting_at(db_path)
    assert stored is not None
    time_part = stored.replace(" ", "T", 1).partition("T")[2]
    assert "+" not in time_part and "Z" not in time_part.upper(), f"오프셋이 저장됐다: {stored!r}"
    assert stored.startswith("2026-08-05 06:00:00"), stored


# ---------- 4. 형식 계약: 응답 문자열이 Pydantic datetime 으로 되읽히는가 ----------

@pytest.mark.parametrize("raw,_expected", MEETING_AT_INPUTS, ids=lambda v: str(v)[:26])
def test_response_timestamps_are_reparseable(client, raw, _expected):
    """meeting_at·updated_at 이 모두 스키마(datetime)로 다시 파싱 가능해야 한다.

    이 계약이 깨진 순간이 곧 500 이다 — 응답 직렬화 결과를 프론트도, 우리 스키마도 못 읽는다.
    """
    item_id = _analyze(client)
    _post_meeting(client, item_id, raw)

    item = _first_transaction(client)
    for key in ("meeting_at", "updated_at"):
        value = item[key]
        assert isinstance(value, str) and value, f"{key} 가 비었다: {value!r}"
        _DT.validate_python(value)  # 실패하면 여기서 ValidationError


def test_double_timezone_string_is_rejected_by_schema():
    """왜 500 이었는지 못 박아 두는 테스트 — '...+00:00Z' 는 Pydantic 이 거부한다.

    즉 이 문자열이 응답에 실리면 무조건 ResponseValidationError(=500)다.
    """
    with pytest.raises(ValidationError):
        _DT.validate_python("2026-08-05T06:00:00+00:00Z")


def test_iso_z_is_idempotent_and_single_format():
    """_iso_z 를 여러 번 통과시켜도 결과가 같아야 한다 (이중 타임존이 생기는 근본 조건 차단)."""
    from app.db import _iso_z

    samples = [
        "2026-08-02 16:58:42",            # SQLite CURRENT_TIMESTAMP
        "2026-08-05 06:00:00+00:00",      # 버그가 남긴 값
        "2026-08-05 15:00:00+09:00",
        "2026-08-05T06:00:00.000Z",
        datetime(2026, 8, 5, 6, 0),  # noqa: DTZ001 — naive datetime 갈래를 일부러 태운다
        datetime(2026, 8, 5, 15, 0, tzinfo=timezone.utc),
    ]
    for value in samples:
        once = _iso_z(value)
        assert once.endswith("Z") and once.count("Z") == 1, once
        assert "+" not in once.partition("T")[2], f"이중 타임존: {once!r}"
        assert _iso_z(once) == once, f"멱등하지 않음: {value!r} → {once!r} → {_iso_z(once)!r}"
        _DT.validate_python(once)

    assert _iso_z(None) is None
    # 기존 동작 보존 — naive 문자열은 예전과 바이트 단위로 같아야 한다
    assert _iso_z("2026-08-02 16:58:42") == "2026-08-02T16:58:42Z"


def test_other_list_timestamps_unaffected(client):
    """created_at 등 기존 타임스탬프 형식이 바뀌지 않았는지 (부수효과 회귀 방지)."""
    item_id = _analyze(client)
    _post_meeting(client, item_id, "2026-08-05T06:00:00.000Z")

    history = client.get("/api/v1/history", params={"user_id": "u1"})
    assert history.status_code == 200
    created_at = history.json()["data"]["items"][0]["created_at"]
    assert created_at.endswith("Z") and len(created_at) == 20, created_at  # YYYY-MM-DDTHH:MM:SSZ
    _DT.validate_python(created_at)

    # 전체 화면이 함께 뜨는 경로들도 500 이 아니어야 한다
    assert client.get("/api/v1/mypage", params={"user_id": "u1"}).status_code == 200
    assert client.get(f"/api/v1/analysis/{item_id}", params={"user_id": "u1"}).status_code == 200


def test_meeting_at_null_when_omitted(client):
    """meeting_at 없이 저장하면 null — 기존 계약(생략 시 NULL 리셋) 유지."""
    item_id = _analyze(client)
    r = client.post("/api/v1/transaction", json={
        "user_id": "u1", "item_id": item_id, "stage": "CONTACTING",
    })
    assert r.status_code == 200
    assert _first_transaction(client)["meeting_at"] is None
