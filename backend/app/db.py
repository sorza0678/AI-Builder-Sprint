"""SQLite/Postgres(Supabase) 이중 백엔드 연결 + CRUD.

DATABASE_URL 환경변수가 있으면 Postgres(psycopg2), 없으면 SQLite(로컬 개발/테스트) 사용.
psycopg2 는 Postgres 를 실제로 쓸 때만 지연 import 한다 — 최상단에서 import 하면
SQLite 만 쓰는 사람도 psycopg2 가 없으면 이 모듈 import 자체가 실패해서,
docstring 의 "없으면 SQLite" 가 거짓말이 된다.
"""
import json
import logging
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

_UTC = timezone.utc


class _PsycopgUnavailable(Exception):
    """psycopg2 미설치 시 except 절 자리를 채우는 더미 — 아무도 던지지 않으므로 절대 매치되지 않는다."""


_psycopg2_module = None
_psycopg2_loaded = False


def _psycopg2(required: bool = True):
    """psycopg2 지연 로드 (한 번만 시도하고 캐시).

    required=False 는 except 절처럼 "있으면 쓰고 없으면 그냥 넘어가는" 자리에서 쓴다.
    Postgres 경로에서 없으면 import 실패 대신 원인이 분명한 에러를 낸다.
    """
    global _psycopg2_module, _psycopg2_loaded
    if not _psycopg2_loaded:
        _psycopg2_loaded = True
        try:
            import psycopg2
            import psycopg2.extras  # RealDictCursor — 서브모듈은 따로 import 해야 붙는다

            _psycopg2_module = psycopg2
        except ImportError:
            _psycopg2_module = None
    if _psycopg2_module is None and required:
        raise RuntimeError(
            "DATABASE_URL 이 설정됐지만 psycopg2 가 설치돼 있지 않습니다. "
            "pip install psycopg2-binary 후 다시 시도하세요."
        )
    return _psycopg2_module


def _integrity_errors() -> tuple:
    """UNIQUE/FK 위반 예외 튜플 — psycopg2 가 없으면 더미로 채워 except 절이 그대로 동작한다."""
    pg = _psycopg2(required=False)
    return (sqlite3.IntegrityError, pg.IntegrityError if pg else _PsycopgUnavailable)

_APP_DIR = Path(__file__).resolve().parent
DATABASE = _APP_DIR.parent / "resale_guard.db"
SCHEMA = _APP_DIR / "schema.sql"
SCHEMA_POSTGRES = _APP_DIR / "schema_postgres.sql"


def _is_postgres() -> bool:
    """매 호출마다 fresh하게 읽음 — 테스트가 이 값을 캐시에 의존하지 않게 하기 위함."""
    return bool(os.environ.get("DATABASE_URL"))


def _execute(conn, sql: str, params=()):
    """conn.execute(...) 슈거 대체 — sqlite3/psycopg2 공통, ? → %s 자동 변환."""
    cur = conn.cursor()
    cur.execute(sql.replace("?", "%s") if _is_postgres() else sql, params)
    return cur


def _parse_ts(text: str) -> datetime | None:
    """타임스탬프 문자열 → datetime. 알 수 없는 형식이면 None (호출부가 원본을 그대로 쓴다)."""
    candidate = text.strip()
    if not candidate:
        return None
    # fromisoformat 은 3.11+ 에서만 'Z' 를 읽으므로 미리 오프셋으로 바꿔둔다
    if candidate.endswith(("Z", "z")):
        candidate = candidate[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(candidate)
    except ValueError:
        return None


def _to_naive_utc(parsed: datetime) -> datetime | None:
    """tz-aware datetime → 타임존 벗긴 UTC. 환산이 표현 범위를 넘으면 None.

    datetime 은 서기 1~9999년만 표현할 수 있어서, 경계에 붙은 값
    ('0001-01-01T00:00:00+14:00')에 오프셋을 적용하면 OverflowError 가 난다.
    이 예외가 새어나가면 조회/저장이 통째로 500 이 되므로, 여기서 None 으로 바꿔
    호출부가 "환산 못 함" 을 정상 분기로 처리하게 한다 (예외를 숨기는 게 아니라,
    변환 불가라는 사실을 반환값으로 표현하는 것).
    입력 단계(schemas.TransactionRequest)에서 이미 422 로 걸러지므로 여기는 이중 방어다.
    """
    if parsed.tzinfo is None:
        return parsed
    try:
        return parsed.astimezone(_UTC).replace(tzinfo=None)
    except (OverflowError, OSError, ValueError):
        return None


def _iso_z(value) -> str | None:
    """DB에서 읽은 타임스탬프를 ISO-8601 UTC 문자열('...Z')로 정규화.

    sqlite3 는 str, psycopg2 는 datetime 을 돌려준다. 그런데 meeting_at 처럼 사용자가 보낸
    값은 이미 오프셋이 붙은 채('2026-08-05 06:00:00+00:00') 저장돼 있을 수 있고, 여기에
    무조건 'Z' 를 덧붙이면 '...+00:00Z' 라는 타임존 두 번짜리 문자열이 만들어져
    Pydantic 응답 검증이 깨진다 (→ 500). 그래서 세 갈래로 나눈다:

    - 이미 오프셋/'Z' 가 있으면 → UTC 로 환산해서 'Z' 형식으로 통일 (오프셋을 잘라내
      시각을 바꾸지 않는다. +09:00 은 -9시간 해서 같은 순간을 유지)
    - 타임존이 없으면(SQLite CURRENT_TIMESTAMP) → 기존과 동일하게 UTC 로 보고 'Z' 부착
    - datetime 이 tz-aware 면 → UTC 로 변환 후 'Z' (예전 strftime 은 오프셋을 조용히
      버려서 시각이 틀어졌다)

    결과 형식이 항상 하나로 수렴하므로 여러 번 적용해도 안전하다(멱등).
    """
    if value is None:
        return None  # 호출부가 대부분 조건문으로 거르지만, 여기서도 터지지 않게 한다
    if isinstance(value, datetime):
        naive = _to_naive_utc(value)
        if naive is None:
            # UTC 로 못 옮기는 극단값 — 오프셋을 단 원본 ISO 로 내보낸다.
            # 시각이 보존되고 Pydantic 도 읽을 수 있어서, 500 대신 정상 응답이 된다.
            return value.isoformat()
        return naive.strftime("%Y-%m-%dT%H:%M:%S") + "Z"

    text = str(value).strip()
    date_part, sep, time_part = text.replace(" ", "T", 1).partition("T")
    if not sep:
        # 날짜만 있는 값 — 'Z' 를 붙이면 오히려 파싱 불가가 되므로 그대로 둔다
        return text
    if time_part.endswith(("Z", "z")) or "+" in time_part or "-" in time_part:
        parsed = _parse_ts(text)
        if parsed is None:
            return date_part + "T" + time_part  # 못 읽으면 최소한 이중 타임존은 만들지 않는다
        naive = _to_naive_utc(parsed)
        if naive is None:
            return parsed.isoformat()  # 위 datetime 갈래와 같은 이유 (극단 오프셋)
        return naive.strftime("%Y-%m-%dT%H:%M:%S") + "Z"
    # 소수점 이하 초는 버린다 — 위 두 갈래(strftime)와 초 단위로 형식을 맞춰야 "단일 형식"이
    # 되고, 그래야 몇 번을 다시 통과시켜도 결과가 같다. SQLite CURRENT_TIMESTAMP 는
    # 애초에 소수점이 없으므로 기존 동작('2026-08-02T16:58:42Z')은 그대로다.
    return date_part + "T" + time_part.split(".", 1)[0] + "Z"


def _normalize_meeting_at(value) -> str | None:
    """저장 직전 meeting_at 정규화 — 항상 UTC 기준 'YYYY-MM-DD HH:MM:SS'.

    main.py 가 datetime.isoformat(sep=' ') 로 넘기기 때문에, 프론트가 tz-aware 값을
    보내면 '+00:00' 같은 오프셋이 그대로 저장된다. 읽기(_iso_z)만 고치면 DB 에는 계속
    형식이 뒤섞인 값이 쌓이고 정렬·비교도 어긋나므로, 쓰는 시점에 UTC 로 통일한다.
    (naive 값은 _iso_z 와 같은 규칙으로 UTC 로 간주 — 왕복해도 시각이 안 변한다.)
    이미 저장된 오프셋 포함 행은 _iso_z 가 처리하므로 마이그레이션은 필요 없다.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        text = str(value).strip()
        if not text:
            return None
        parsed = _parse_ts(text)
        if parsed is None:
            return text  # 알 수 없는 형식은 건드리지 않는다 (사용자 입력을 임의로 버리지 않음)
    naive = _to_naive_utc(parsed)
    if naive is None:
        # UTC 로 못 옮기는 극단값은 오프셋을 유지한 채 저장한다 — 읽을 때 _iso_z 가
        # 같은 방식으로 되돌려주므로 시각이 어긋나지 않는다 (버리는 것보다 낫다).
        return parsed.isoformat(sep=" ")
    return naive.strftime("%Y-%m-%d %H:%M:%S")


@contextmanager
def get_db():
    if _is_postgres():
        pg = _psycopg2()
        conn = pg.connect(
            os.environ["DATABASE_URL"],
            cursor_factory=pg.extras.RealDictCursor,
        )
        try:
            yield conn
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(DATABASE, timeout=15.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")  # sqlite3 기본값은 OFF — FK 제약이 선언만 되고 무시되는 걸 방지
        # WAL: 읽기가 쓰기를 막지 않는다. 데모 중 여러 명이 동시에 써도 "database is locked"
        # 확률을 낮춘다 (timeout 15초와 함께 이중 방어). 파일이 .db-wal/.db-shm 로 늘어난다.
        conn.execute("PRAGMA journal_mode = WAL")
        try:
            yield conn
        finally:
            conn.close()


def init_db():
    """테이블 생성 + 기존 DB 마이그레이션."""
    with get_db() as conn:
        if _is_postgres():
            conn.cursor().execute(SCHEMA_POSTGRES.read_text(encoding="utf-8"))
        else:
            conn.executescript(SCHEMA.read_text(encoding="utf-8"))
        conn.commit()
        # 마이그레이션: 스키마 파일의 CREATE TABLE IF NOT EXISTS 는 "이미 있는" 테이블을
        # 바꾸지 못하므로, 예전 DB에 없는 컬럼은 여기서 추가한다.
        # 이미 있으면 "duplicate column" 에러가 나는데 그건 정상이라 무시.
        for ddl in (
            "ALTER TABLE analysis_history ADD COLUMN deleted_at TIMESTAMP",
            "ALTER TABLE users ADD COLUMN password_hash TEXT",       # 인증 (P0-3)
            "ALTER TABLE users ADD COLUMN nickname TEXT",
            "ALTER TABLE users ADD COLUMN migrated_to TEXT",         # guest 이전 후 재사용 방지 (P0-4)
            # 거래 일정·메모 (문서 15)
            "ALTER TABLE transaction_status ADD COLUMN meeting_at TIMESTAMP",
            "ALTER TABLE transaction_status ADD COLUMN meeting_place TEXT",
            "ALTER TABLE transaction_status ADD COLUMN trade_method TEXT",
            "ALTER TABLE transaction_status ADD COLUMN memo TEXT",
            "ALTER TABLE transaction_status ADD COLUMN payment_method TEXT",
        ):
            try:
                _execute(conn, ddl)
                conn.commit()
            except Exception as e:
                # 대부분 "duplicate column"(이미 적용됨)이라 정상이지만, 진짜 실패도
                # 여기로 오므로 흔적은 남긴다 — 조용히 넘기면 원인을 못 찾는다.
                conn.rollback()
                logger.debug("마이그레이션 건너뜀 (%s): %s", ddl.split("ADD COLUMN")[-1].strip(), e)


def ensure_user(user_id: str):
    """user_id가 없으면 생성."""
    with get_db() as conn:
        _execute(conn, "INSERT INTO users(id) VALUES (?) ON CONFLICT (id) DO NOTHING", (user_id,))
        conn.commit()


def save_analysis(
    user_id: str,
    source_url: str,
    analysis_data: dict,
) -> int:
    """
    분석 결과 저장 → analysis_id 반환.
    item_id는 DB auto-increment 값으로 확정되므로, insert 후
    analysis_data['item_id']를 그 값으로 맞춰 raw_analysis_json에 반영한다.
    """
    ensure_user(user_id)
    with get_db() as conn:
        cursor = _execute(
            conn,
            """
            INSERT INTO analysis_history
            (user_id, source_url, title, price, trust_score, risk_level, raw_analysis_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING id
            """,
            (
                user_id,
                source_url,
                analysis_data["title"],
                analysis_data["price"],
                analysis_data["trust_score"],
                analysis_data["risk_level"],
                "{}",  # placeholder, 아래에서 item_id 확정 후 채움
            ),
        )
        analysis_id = cursor.fetchone()["id"]
        analysis_data = {**analysis_data, "item_id": analysis_id}
        _execute(
            conn,
            "UPDATE analysis_history SET raw_analysis_json = ? WHERE id = ?",
            (json.dumps(analysis_data), analysis_id),
        )
        conn.commit()
        return analysis_id


def get_analysis_by_id(analysis_id: int) -> dict | None:
    """분석 결과 조회 (raw_analysis_json에서 full data 파싱). 삭제된 기록은 없는 것으로 취급.

    ⚠️ 소유자를 확인하지 않는다 — 남의 매물도 반환한다. 외부 요청 처리에는 절대 쓰지 말고
    반드시 get_owned_analysis / user_owns_analysis 를 써라 (IDOR 방지). 내부 재사용 전용.
    """
    with get_db() as conn:
        row = _execute(
            conn,
            "SELECT raw_analysis_json FROM analysis_history WHERE id = ? AND deleted_at IS NULL",
            (analysis_id,),
        ).fetchone()
    if not row:
        return None
    return json.loads(row["raw_analysis_json"])


def user_owns_analysis(user_id: str, analysis_id: int) -> bool:
    """분석이 이 사용자 소유이고 살아있는지 — 찜/비교/체크리스트 등 모든 참조의 소유권 게이트."""
    with get_db() as conn:
        row = _execute(
            conn,
            "SELECT 1 FROM analysis_history WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
            (analysis_id, user_id),
        ).fetchone()
    return row is not None


def get_owned_analysis(user_id: str, analysis_id: int) -> dict | None:
    """소유권 검증 포함 분석 조회 — 남의 것/삭제된 것은 None (존재 여부도 노출 안 함)."""
    with get_db() as conn:
        row = _execute(
            conn,
            "SELECT raw_analysis_json FROM analysis_history WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
            (analysis_id, user_id),
        ).fetchone()
    if not row:
        return None
    return json.loads(row["raw_analysis_json"])


def _apply_listing_override(data: dict, ld_row) -> dict:
    """사용자가 화면2(/listing)에서 확인/수정한 값이 있으면 AI 원본보다 우선 적용.

    listing_details 행이 존재한다 = 사용자가 그 매물 정보를 "확정"했다는 뜻이므로
    title/price/defects 는 통째로 사용자 값으로 교체한다 (빈 배열도 '하자 없음 확정'으로 존중).
    """
    if not ld_row:
        return data
    out = {**data, "title": ld_row["title"], "price": ld_row["price"]}
    product_status = {**out.get("product_status", {"defects_found": [], "missing_components": []})}
    product_status["defects_found"] = json.loads(ld_row["defects_json"])
    out["product_status"] = product_status
    return out


def _get_listing_rows(user_id: str, analysis_ids: list[int]) -> dict[int, dict]:
    """analysis_id → listing_details 행 매핑 (한 번의 쿼리로)."""
    if not analysis_ids:
        return {}
    placeholders = ",".join("?" for _ in analysis_ids)
    with get_db() as conn:
        rows = _execute(
            conn,
            f"SELECT * FROM listing_details WHERE user_id = ? AND analysis_id IN ({placeholders})",
            (user_id, *analysis_ids),
        ).fetchall()
    return {row["analysis_id"]: row for row in rows}


def get_multiple_analyses(analysis_ids: list[int], user_id: str | None = None) -> list[dict]:
    """복수 분석 결과 조회. user_id를 주면 소유한 것만 반환 + 수정값(listing_details) 우선 반영.

    user_id를 주면 소유권 필터가 걸린다 — compare 등에서 남의 매물을 섞어 조회하는 IDOR 방지.
    id 하나당 커넥션을 열던 N+1 을 없애고 한 번의 쿼리로 가져온다
    (SQLite 는 차이가 작지만 Supabase 는 커넥션마다 네트워크 왕복이 붙는다).
    """
    if not analysis_ids:
        return []
    placeholders = ",".join("?" for _ in analysis_ids)
    query = f"""
        SELECT a.id, a.raw_analysis_json,
               ld.title AS ld_title, ld.price AS ld_price, ld.defects_json AS ld_defects_json
        FROM analysis_history a
        LEFT JOIN listing_details ld
               ON ld.analysis_id = a.id AND ld.user_id = a.user_id
        WHERE a.id IN ({placeholders}) AND a.deleted_at IS NULL
    """
    params: list = list(analysis_ids)
    if user_id:
        query += " AND a.user_id = ?"
        params.append(user_id)
    with get_db() as conn:
        rows = _execute(conn, query, params).fetchall()

    by_id = {}
    for row in rows:
        data = json.loads(row["raw_analysis_json"])
        if user_id and row["ld_title"] is not None:
            data = _apply_listing_override(
                data,
                {
                    "title": row["ld_title"],
                    "price": row["ld_price"],
                    "defects_json": row["ld_defects_json"],
                },
            )
        by_id[row["id"]] = data
    # 요청 순서를 유지한다 (프론트가 넘긴 item_ids 순서대로 비교 화면에 뜨게)
    return [by_id[aid] for aid in analysis_ids if aid in by_id]


def bookmark(user_id: str, analysis_id: int) -> bool:
    """북마크 추가 → 성공 여부."""
    ensure_user(user_id)
    with get_db() as conn:
        try:
            _execute(
                conn,
                "INSERT INTO bookmarks(user_id, analysis_id) VALUES (?, ?)",
                (user_id, analysis_id),
            )
            conn.commit()
            return True
        except _integrity_errors():
            conn.rollback()
            return False  # 이미 북마크됨 또는 invalid analysis_id


def unbookmark(user_id: str, analysis_id: int) -> bool:
    """북마크 제거 → 성공 여부."""
    with get_db() as conn:
        cursor = _execute(
            conn,
            "DELETE FROM bookmarks WHERE user_id = ? AND analysis_id = ?",
            (user_id, analysis_id),
        )
        conn.commit()
    return cursor.rowcount > 0


def _collection_items(user_id: str, table: str, added_at_key: str) -> list[dict]:
    """찜/비교후보 공통 조회 — 분석 원본 + 사용자 수정값 + 목록 추가 시각/원본 URL.

    LEFT JOIN listing_details: 사용자 수정값이 "있으면" 붙고, 없으면 NULL(→ 원본 유지).
    JOIN analysis_history 의 deleted_at IS NULL 조건으로 삭제된 분석은 목록에서 자동 제외.
    JOIN 에 a.user_id = c.user_id 를 걸어, 혹시 남의 analysis_id 를 가리키는 행이 있어도
    그 내용이 새지 않게 방어한다 (소유권은 추가 시점에도 검증하지만 조회에서 이중 방어).
    """
    with get_db() as conn:
        rows = _execute(
            conn,
            f"""
            SELECT c.analysis_id, c.created_at AS added_at,
                   a.source_url, a.raw_analysis_json,
                   ld.title AS ld_title, ld.price AS ld_price, ld.defects_json AS ld_defects_json
            FROM {table} c
            JOIN analysis_history a
                   ON a.id = c.analysis_id AND a.user_id = c.user_id AND a.deleted_at IS NULL
            LEFT JOIN listing_details ld
                   ON ld.analysis_id = c.analysis_id AND ld.user_id = c.user_id
            WHERE c.user_id = ?
            ORDER BY c.id DESC
            """,
            (user_id,),
        ).fetchall()
    items = []
    for row in rows:
        data = json.loads(row["raw_analysis_json"])
        if row["ld_title"] is not None:
            data = _apply_listing_override(
                data,
                {"title": row["ld_title"], "price": row["ld_price"], "defects_json": row["ld_defects_json"]},
            )
        items.append(
            {
                **data,
                "source_url": row["source_url"],
                added_at_key: _iso_z(row["added_at"]),
            }
        )
    return items


def get_bookmarks(user_id: str) -> list[dict]:
    """찜 목록 (최신순) — 사용자 수정값 반영 + bookmarked_at/source_url 포함."""
    return _collection_items(user_id, "bookmarks", "bookmarked_at")


def get_history(user_id: str, page: int = 1, size: int = 10) -> tuple[list, int]:
    """
    분석 히스토리 조회 (최신순).
    → (items_list, total_count)
    """
    with get_db() as conn:
        total = _execute(
            conn,
            "SELECT COUNT(*) as cnt FROM analysis_history WHERE user_id = ? AND deleted_at IS NULL",
            (user_id,),
        ).fetchone()["cnt"]

        offset = (page - 1) * size
        rows = _execute(
            conn,
            """
            SELECT a.id, a.source_url, a.title, a.price, a.trust_score, a.risk_level,
                   a.raw_analysis_json, a.created_at,
                   ld.title AS ld_title, ld.price AS ld_price
            FROM analysis_history a
            LEFT JOIN listing_details ld
                   ON ld.analysis_id = a.id AND ld.user_id = a.user_id
            WHERE a.user_id = ? AND a.deleted_at IS NULL
            ORDER BY a.id DESC
            LIMIT ? OFFSET ?
            """,
            (user_id, size, offset),
        ).fetchall()

    items = []
    for row in rows:
        raw = json.loads(row["raw_analysis_json"])
        items.append(
            {
                "item_id": row["id"],
                "source_url": row["source_url"],
                # 사용자가 화면2에서 수정한 값이 있으면(ld_title NOT NULL) 그 값 우선
                "title": row["ld_title"] if row["ld_title"] is not None else row["title"],
                "price": row["ld_price"] if row["ld_price"] is not None else row["price"],
                "trust_score": row["trust_score"],
                "risk_level": row["risk_level"],
                # 스크래핑으로 수집됐을 때만 존재 — 없으면 null (지어내지 않는다)
                "platform": raw.get("platform"),
                "thumbnail_url": raw.get("thumbnail_url"),
                "location": raw.get("location"),
                "posted_at": raw.get("posted_at"),
                # 항상 UTC — 'Z'를 붙여 aware datetime 으로 내보내야
                # 프론트(JS Date)가 로컬시간으로 올바르게 변환한다
                "created_at": _iso_z(row["created_at"]),
            }
        )
    return items, total


def upsert_transaction_status(
    user_id: str, analysis_id: int, stage: str, decision: str | None, plan: dict | None = None
) -> str:
    """거래 상태 upsert (매물당 1개, 이력 아님, 매 호출마다 전 필드 덮어씀)
    → updated_at(ISO, 'Z' 접미사) 반환.

    plan: 거래 일정·장소·메모 등 (문서 15). 생략된 키는 NULL 로 리셋되므로
    유지하고 싶은 값은 함께 재전송해야 한다 (stage/decision 과 동일한 규칙).
    """
    plan = plan or {}
    ensure_user(user_id)
    with get_db() as conn:
        _execute(
            conn,
            """
            INSERT INTO transaction_status
                (user_id, analysis_id, stage, decision,
                 meeting_at, meeting_place, trade_method, memo, payment_method)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, analysis_id)
            DO UPDATE SET stage = excluded.stage, decision = excluded.decision,
                          meeting_at = excluded.meeting_at,
                          meeting_place = excluded.meeting_place,
                          trade_method = excluded.trade_method,
                          memo = excluded.memo,
                          payment_method = excluded.payment_method,
                          updated_at = CURRENT_TIMESTAMP
            """,
            (
                user_id, analysis_id, stage, decision,
                # 오프셋이 섞인 값이 그대로 쌓이지 않도록 저장 시점에 UTC 로 정규화
                _normalize_meeting_at(plan.get("meeting_at")), plan.get("meeting_place"),
                plan.get("trade_method"), plan.get("memo"), plan.get("payment_method"),
            ),
        )
        conn.commit()
        row = _execute(
            conn,
            "SELECT updated_at FROM transaction_status WHERE user_id = ? AND analysis_id = ?",
            (user_id, analysis_id),
        ).fetchone()
    return _iso_z(row["updated_at"])


def get_transactions(
    user_id: str, stage: str | None = None, decision: str | None = None
) -> list[dict]:
    """거래 상태 목록 (analysis_history와 조인, 최신 변경순). stage/decision 각각 생략 시 미필터."""
    query = """
        SELECT t.analysis_id, t.stage, t.decision, t.updated_at,
               t.meeting_at, t.meeting_place, t.trade_method, t.memo, t.payment_method,
               a.title, a.price, a.trust_score, a.risk_level,
               ld.title AS ld_title, ld.price AS ld_price
        FROM transaction_status t
        JOIN analysis_history a ON a.id = t.analysis_id AND a.deleted_at IS NULL
        LEFT JOIN listing_details ld
               ON ld.analysis_id = t.analysis_id AND ld.user_id = t.user_id
        WHERE t.user_id = ?
    """
    params: list = [user_id]
    if stage:
        query += " AND t.stage = ?"
        params.append(stage)
    if decision:
        query += " AND t.decision = ?"
        params.append(decision)
    query += " ORDER BY t.updated_at DESC"
    with get_db() as conn:
        rows = _execute(conn, query, params).fetchall()
    return [
        {
            "item_id": row["analysis_id"],
            # 사용자 수정값 우선 (화면2에서 확정한 제목/가격)
            "title": row["ld_title"] if row["ld_title"] is not None else row["title"],
            "price": row["ld_price"] if row["ld_price"] is not None else row["price"],
            "trust_score": row["trust_score"],
            "risk_level": row["risk_level"],
            "stage": row["stage"],
            "decision": row["decision"],
            # 거래 준비 정보 (문서 15) — 저장 안 했으면 전부 null
            "meeting_at": _iso_z(row["meeting_at"]) if row["meeting_at"] else None,
            "meeting_place": row["meeting_place"],
            "trade_method": row["trade_method"],
            "memo": row["memo"],
            "payment_method": row["payment_method"],
            "updated_at": _iso_z(row["updated_at"]),
        }
        for row in rows
    ]


def add_comparison_item(user_id: str, analysis_id: int) -> bool:
    """비교 후보 추가 → 성공 여부(이미 있으면 False)."""
    ensure_user(user_id)
    with get_db() as conn:
        try:
            _execute(
                conn,
                "INSERT INTO comparison_items(user_id, analysis_id) VALUES (?, ?)",
                (user_id, analysis_id),
            )
            conn.commit()
            return True
        except _integrity_errors():
            conn.rollback()
            return False


def remove_comparison_item(user_id: str, analysis_id: int) -> bool:
    """비교 후보 제거 → 성공 여부."""
    with get_db() as conn:
        cursor = _execute(
            conn,
            "DELETE FROM comparison_items WHERE user_id = ? AND analysis_id = ?",
            (user_id, analysis_id),
        )
        conn.commit()
    return cursor.rowcount > 0


def get_comparison_items(user_id: str) -> list[dict]:
    """비교 후보 목록 (최신순) — 사용자 수정값 반영 + comparison_added_at/source_url 포함."""
    return _collection_items(user_id, "comparison_items", "comparison_added_at")


def upsert_listing_details(
    user_id: str,
    analysis_id: int,
    title: str,
    price: int,
    model_name: str,
    year: str,
    size_or_capacity: str,
    color: str,
    usage_period: str,
    components: list[str],
    defects: list[str],
) -> str:
    """화면2 확인/수정된 매물 상세 upsert (매물당 1개, 이력 아님) → updated_at(ISO, 'Z' 접미사) 반환."""
    ensure_user(user_id)
    with get_db() as conn:
        _execute(
            conn,
            """
            INSERT INTO listing_details
                (user_id, analysis_id, title, price, model_name, year,
                 size_or_capacity, color, usage_period, components_json, defects_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, analysis_id) DO UPDATE SET
                title = excluded.title,
                price = excluded.price,
                model_name = excluded.model_name,
                year = excluded.year,
                size_or_capacity = excluded.size_or_capacity,
                color = excluded.color,
                usage_period = excluded.usage_period,
                components_json = excluded.components_json,
                defects_json = excluded.defects_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                user_id,
                analysis_id,
                title,
                price,
                model_name,
                year,
                size_or_capacity,
                color,
                usage_period,
                json.dumps(components),
                json.dumps(defects),
            ),
        )
        conn.commit()
        row = _execute(
            conn,
            "SELECT updated_at FROM listing_details WHERE user_id = ? AND analysis_id = ?",
            (user_id, analysis_id),
        ).fetchone()
    return _iso_z(row["updated_at"])


def get_listing_details(user_id: str, analysis_id: int) -> dict | None:
    """화면2 확인/수정된 매물 상세 조회 (없으면 None)."""
    with get_db() as conn:
        row = _execute(
            conn,
            "SELECT * FROM listing_details WHERE user_id = ? AND analysis_id = ?",
            (user_id, analysis_id),
        ).fetchone()
    if not row:
        return None
    return {
        "item_id": row["analysis_id"],
        "title": row["title"],
        "price": row["price"],
        "model_name": row["model_name"],
        "year": row["year"],
        "size_or_capacity": row["size_or_capacity"],
        "color": row["color"],
        "usage_period": row["usage_period"],
        "components": json.loads(row["components_json"]),
        "defects": json.loads(row["defects_json"]),
        "updated_at": _iso_z(row["updated_at"]),
    }


def get_mypage_summary(user_id: str, recent_limit: int = 5) -> dict:
    """마이페이지 상단 요약 — 기존/신규 테이블 COUNT + 최근 분석 목록(기존 get_history 재사용)."""
    with get_db() as conn:
        analysis_count = _execute(
            conn,
            "SELECT COUNT(*) c FROM analysis_history WHERE user_id = ? AND deleted_at IS NULL",
            (user_id,),
        ).fetchone()["c"]
        bookmark_count = _execute(
            conn,
            """SELECT COUNT(*) c FROM bookmarks b
               JOIN analysis_history a ON a.id = b.analysis_id AND a.deleted_at IS NULL
               WHERE b.user_id = ?""",
            (user_id,),
        ).fetchone()["c"]
        comparison_count = _execute(
            conn,
            """SELECT COUNT(*) c FROM comparison_items ci
               JOIN analysis_history a ON a.id = ci.analysis_id AND a.deleted_at IS NULL
               WHERE ci.user_id = ?""",
            (user_id,),
        ).fetchone()["c"]
        transaction_completed_count = _execute(
            conn,
            """SELECT COUNT(*) c FROM transaction_status t
               JOIN analysis_history a ON a.id = t.analysis_id AND a.deleted_at IS NULL
               WHERE t.user_id = ? AND t.stage = 'COMPLETED'""",
            (user_id,),
        ).fetchone()["c"]
    recent_analyses, _ = get_history(user_id, page=1, size=recent_limit)
    with get_db() as conn:
        row = _execute(
            conn, "SELECT id, nickname, created_at FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    user = (
        {
            "id": row["id"],
            "nickname": row["nickname"],
            # 프로필 이미지는 업로드 기능이 없어 항상 null (지어내지 않는다)
            "profile_image_url": None,
            "created_at": _iso_z(row["created_at"]),
        }
        if row
        else None
    )
    return {
        "user": user,
        "analysis_count": analysis_count,
        "bookmark_count": bookmark_count,
        "comparison_count": comparison_count,
        "transaction_completed_count": transaction_completed_count,
        "recent_analyses": recent_analyses,
    }


# ---------- 분석 단건 조회 / 삭제 (Backend B, P0-2·P1-7) ----------

def get_analysis_full(user_id: str, analysis_id: int) -> dict | None:
    """분석 단건 상세 — 소유권 검증 포함 (본인 것 + 삭제 안 된 것만).

    다른 사용자의 item_id로 조회하면 "없음"과 똑같이 None을 반환한다
    (존재 여부조차 알려주지 않아야 남의 데이터를 떠볼 수 없다).
    """
    with get_db() as conn:
        row = _execute(
            conn,
            """SELECT id, source_url, raw_analysis_json, created_at
               FROM analysis_history
               WHERE id = ? AND user_id = ? AND deleted_at IS NULL""",
            (analysis_id, user_id),
        ).fetchone()
    if not row:
        return None
    data = json.loads(row["raw_analysis_json"])
    listing = get_listing_details(user_id, analysis_id)
    if listing:
        # 상단 표시값은 사용자 수정값 우선, listing_details 객체는 원본 그대로 함께 제공
        data = {**data, "title": listing["title"], "price": listing["price"]}
        product_status = {**data.get("product_status", {"defects_found": [], "missing_components": []})}
        product_status["defects_found"] = listing["defects"]
        data["product_status"] = product_status
    return {
        **data,
        "item_id": row["id"],
        "source_url": row["source_url"],
        "listing_details": listing,
        "created_at": _iso_z(row["created_at"]),
        "updated_at": listing["updated_at"] if listing else None,
    }


def delete_analysis(user_id: str, analysis_id: int) -> bool:
    """분석 기록 soft delete — 실제 행은 남기고 deleted_at만 찍는다 (복구·정합성 대비).

    모든 조회 쿼리가 deleted_at IS NULL 조건을 걸므로, 찜/비교후보/거래 목록에서도
    같이 사라진다 (연결 데이터를 지우지 않아도 됨). 본인 것만 삭제 가능.
    """
    with get_db() as conn:
        cursor = _execute(
            conn,
            """UPDATE analysis_history SET deleted_at = CURRENT_TIMESTAMP
               WHERE id = ? AND user_id = ? AND deleted_at IS NULL""",
            (analysis_id, user_id),
        )
        conn.commit()
    return cursor.rowcount > 0


# ---------- 비교 기록 (Backend B, P1-6) ----------

def save_comparison_history(
    user_id: str, item_ids: list[int], recommendation: str, snapshot: list[dict]
) -> int:
    """비교 실행 기록 저장 — 당시의 제목·가격·점수 snapshot을 그대로 보존 → comparison_id 반환."""
    ensure_user(user_id)
    with get_db() as conn:
        cursor = _execute(
            conn,
            """INSERT INTO comparison_history (user_id, item_ids_json, recommendation, snapshot_json)
               VALUES (?, ?, ?, ?) RETURNING id""",
            (user_id, json.dumps(item_ids), recommendation, json.dumps(snapshot)),
        )
        comparison_id = cursor.fetchone()["id"]
        conn.commit()
    return comparison_id


def _comparison_history_row_to_dict(row) -> dict:
    return {
        "comparison_id": row["id"],
        "item_ids": json.loads(row["item_ids_json"]),
        "recommendation": row["recommendation"],
        "items": json.loads(row["snapshot_json"]),
        "created_at": _iso_z(row["created_at"]),
    }


def get_comparison_history_list(user_id: str) -> list[dict]:
    """비교 기록 목록 (최신순)."""
    with get_db() as conn:
        rows = _execute(
            conn,
            "SELECT * FROM comparison_history WHERE user_id = ? ORDER BY id DESC",
            (user_id,),
        ).fetchall()
    return [_comparison_history_row_to_dict(row) for row in rows]


def get_comparison_history(user_id: str, comparison_id: int) -> dict | None:
    """비교 기록 단건 — 본인 것만 (남의 id는 없음과 동일하게 None)."""
    with get_db() as conn:
        row = _execute(
            conn,
            "SELECT * FROM comparison_history WHERE id = ? AND user_id = ?",
            (comparison_id, user_id),
        ).fetchone()
    return _comparison_history_row_to_dict(row) if row else None


def delete_comparison_history(user_id: str, comparison_id: int) -> bool:
    """비교 기록 삭제 (단순 로그라 hard delete). 본인 것만."""
    with get_db() as conn:
        cursor = _execute(
            conn,
            "DELETE FROM comparison_history WHERE id = ? AND user_id = ?",
            (comparison_id, user_id),
        )
        conn.commit()
    return cursor.rowcount > 0


# ---------- 인증 (Backend B, P0-3) ----------

def create_account(user_id: str, password_hash: str, nickname: str | None) -> bool:
    """실계정 생성 → 성공 여부. 이미 존재하는 user_id면 False (guest 행 탈취 방지 — 어떤 기존 id도 재사용 불가)."""
    with get_db() as conn:
        existing = _execute(conn, "SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
        if existing:
            return False
        _execute(
            conn,
            "INSERT INTO users (id, password_hash, nickname) VALUES (?, ?, ?)",
            (user_id, password_hash, nickname),
        )
        conn.commit()
    return True


def get_user_auth(user_id: str) -> dict | None:
    """로그인 검증용 사용자 행 (없으면 None)."""
    with get_db() as conn:
        row = _execute(
            conn,
            "SELECT id, password_hash, nickname, migrated_to FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    if not row:
        return None
    return {
        "user_id": row["id"],
        "password_hash": row["password_hash"],
        "nickname": row["nickname"],
        "migrated_to": row["migrated_to"],
    }


# ---------- guest 데이터 계정 이전 (Backend B, P0-4) ----------

class MigrateError(Exception):
    """code: CANNOT_MIGRATE_ACCOUNT | ALREADY_MIGRATED"""

    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def migrate_guest(account_id: str, guest_id: str) -> dict:
    """guest의 모든 기록을 실계정으로 이전 — 단일 트랜잭션, 멱등.

    안전 규칙:
    - guest 행에 password_hash가 있으면(=실계정) 이전 거부 — 남의 계정 데이터 탈취 방지.
    - 이미 다른 계정으로 이전된 guest면 거부, 같은 계정으로 재요청이면 성공(이동 0건) — 멱등성.
    - 이전 후 users.migrated_to 를 찍어 guest id 재사용(로그인·재이전)을 막는다.

    소유권 불변식 덕분에 UNIQUE(user_id, analysis_id) 충돌은 정상 흐름에선 불가능
    (guest의 찜/비교/거래는 전부 guest 자신의 분석을 가리키므로, 계정 쪽에 같은
    analysis_id 행이 미리 존재할 수 없다). 만약을 대비해 전체를 롤백으로 감싼다.
    """
    ensure_user(account_id)
    with get_db() as conn:
        guest = _execute(
            conn,
            "SELECT password_hash, migrated_to FROM users WHERE id = ?",
            (guest_id,),
        ).fetchone()
        empty = {t: 0 for t in (
            "analysis_history", "listing_details", "bookmarks",
            "comparison_items", "transaction_status", "comparison_history",
        )}
        if not guest:
            return empty  # 이전할 게 없음 — 멱등 성공
        if guest["password_hash"]:
            raise MigrateError("CANNOT_MIGRATE_ACCOUNT", "실계정은 guest 이전 대상이 될 수 없습니다.")
        if guest["migrated_to"] and guest["migrated_to"] != account_id:
            raise MigrateError("ALREADY_MIGRATED", "이미 다른 계정으로 이전된 guest 입니다.")

        try:
            counts = {}
            for table in (
                "analysis_history", "listing_details", "bookmarks",
                "comparison_items", "transaction_status", "comparison_history",
            ):
                counts[table] = _execute(
                    conn,
                    f"UPDATE {table} SET user_id = ? WHERE user_id = ?",
                    (account_id, guest_id),
                ).rowcount
            _execute(
                conn, "UPDATE users SET migrated_to = ? WHERE id = ?", (account_id, guest_id)
            )
            conn.commit()
            return counts
        except _integrity_errors():
            # 계정과 guest가 같은 analysis_id 를 각자 찜/비교/거래에 담고 있으면
            # UNIQUE(user_id, analysis_id) 충돌 — 불투명한 500 대신 명확한 409 로 변환.
            # (소유권 검증으로 정상 경로에선 발생 불가하지만 이중 방어)
            conn.rollback()
            raise MigrateError("MIGRATE_CONFLICT", "계정과 guest에 중복된 항목이 있어 이전할 수 없습니다.")
        except Exception:
            conn.rollback()
            raise


# ---------- 체크리스트 체크 상태 (Backend B, 문서 16) ----------

def upsert_checklist_state(
    user_id: str, analysis_id: int, checked: list[str], excluded: list[str]
) -> str:
    """체크/제외한 항목 id 목록 저장 (기기 바뀌어도 유지) → updated_at."""
    ensure_user(user_id)
    with get_db() as conn:
        _execute(
            conn,
            """
            INSERT INTO checklist_state (user_id, analysis_id, checked_json, excluded_json)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, analysis_id)
            DO UPDATE SET checked_json = excluded.checked_json,
                          excluded_json = excluded.excluded_json,
                          updated_at = CURRENT_TIMESTAMP
            """,
            (user_id, analysis_id, json.dumps(checked), json.dumps(excluded)),
        )
        conn.commit()
        row = _execute(
            conn,
            "SELECT updated_at FROM checklist_state WHERE user_id = ? AND analysis_id = ?",
            (user_id, analysis_id),
        ).fetchone()
    return _iso_z(row["updated_at"])


def get_checklist_state(user_id: str, analysis_id: int) -> dict | None:
    """저장된 체크 상태 (한 번도 저장 안 했으면 None)."""
    with get_db() as conn:
        row = _execute(
            conn,
            "SELECT * FROM checklist_state WHERE user_id = ? AND analysis_id = ?",
            (user_id, analysis_id),
        ).fetchone()
    if not row:
        return None
    return {
        "item_id": row["analysis_id"],
        "checked_item_ids": json.loads(row["checked_json"]),
        "excluded_item_ids": json.loads(row["excluded_json"]),
        "updated_at": _iso_z(row["updated_at"]),
    }


# ---------- 추천 근거 데이터 (Backend B, 문서 18) ----------

def get_user_interest(user_id: str, limit: int = 5) -> dict:
    """추천 근거 — 사용자가 실제로 분석/찜한 매물에서 관심사를 뽑는다.

    행동 기록이 없으면 빈 값을 반환한다 (근거 없는 추천은 만들지 않는다).
    """
    with get_db() as conn:
        rows = _execute(
            conn,
            """
            SELECT a.title, a.raw_analysis_json, a.id, a.source_url,
                   (SELECT COUNT(*) FROM bookmarks b
                     WHERE b.analysis_id = a.id AND b.user_id = a.user_id) AS bookmarked
            FROM analysis_history a
            WHERE a.user_id = ? AND a.deleted_at IS NULL
            ORDER BY a.id DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    seen_ids, seen_urls, categories, titles = [], [], [], []
    for row in rows:
        seen_ids.append(row["id"])
        if row["source_url"]:
            seen_urls.append(row["source_url"])  # 이미 본 매물을 추천하지 않기 위함
        raw = json.loads(row["raw_analysis_json"])
        if raw.get("category"):
            categories.append(raw["category"])
        # 찜한 매물을 더 강한 관심 신호로 본다
        titles.insert(0, row["title"]) if row["bookmarked"] else titles.append(row["title"])
    return {
        "analysis_ids": seen_ids,
        "seen_urls": seen_urls,
        "categories": categories,
        "titles": titles,
    }
