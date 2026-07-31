"""SQLite 연결 + CRUD. (Supabase 전환 전까지 로컬 개발/데모용)"""
import sqlite3
import json
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

_APP_DIR = Path(__file__).resolve().parent
DATABASE = _APP_DIR.parent / "resale_guard.db"
SCHEMA = _APP_DIR / "schema.sql"


@contextmanager
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")  # sqlite3 기본값은 OFF — FK 제약이 선언만 되고 무시되는 걸 방지
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """테이블 생성."""
    with get_db() as conn:
        conn.executescript(SCHEMA.read_text(encoding="utf-8"))
        conn.commit()


def ensure_user(user_id: str):
    """user_id가 없으면 생성."""
    with get_db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO users(id) VALUES (?)",
            (user_id,),
        )
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
        cursor = conn.execute(
            """
            INSERT INTO analysis_history
            (user_id, source_url, title, price, trust_score, risk_level, raw_analysis_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
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
        analysis_id = cursor.lastrowid
        analysis_data = {**analysis_data, "item_id": analysis_id}
        conn.execute(
            "UPDATE analysis_history SET raw_analysis_json = ? WHERE id = ?",
            (json.dumps(analysis_data), analysis_id),
        )
        conn.commit()
        return analysis_id


def get_history(user_id: str, page: int = 1, size: int = 10) -> tuple[list, int]:
    """
    분석 히스토리 조회 (최신순).
    → (items_list, total_count)
    """
    with get_db() as conn:
        total = conn.execute(
            "SELECT COUNT(*) as cnt FROM analysis_history WHERE user_id = ?",
            (user_id,),
        ).fetchone()["cnt"]

        offset = (page - 1) * size
        rows = conn.execute(
            """
            SELECT id, source_url, title, price, trust_score, risk_level,
                   raw_analysis_json, created_at
            FROM analysis_history
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ? OFFSET ?
            """,
            (user_id, size, offset),
        ).fetchall()

    return (
        [
            {
                "item_id": row["id"],
                "source_url": row["source_url"],
                "title": row["title"],
                "price": row["price"],
                "trust_score": row["trust_score"],
                "risk_level": row["risk_level"],
                # SQLite CURRENT_TIMESTAMP 는 UTC — 'Z'를 붙여 aware datetime 으로
                # 내보내야 프론트(JS Date)가 로컬시간으로 올바르게 변환한다
                "created_at": row["created_at"].replace(" ", "T") + "Z",
            }
            for row in rows
        ],
        total,
    )


def get_analysis_by_id(analysis_id: int) -> Optional[dict]:
    """분석 결과 조회 (raw_analysis_json에서 full data 파싱)."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT raw_analysis_json FROM analysis_history WHERE id = ?",
            (analysis_id,),
        ).fetchone()
    if not row:
        return None
    return json.loads(row["raw_analysis_json"])


def get_multiple_analyses(analysis_ids: list[int]) -> list[dict]:
    """복수 분석 결과 조회."""
    results = []
    for aid in analysis_ids:
        data = get_analysis_by_id(aid)
        if data:
            results.append(data)
    return results


def bookmark(user_id: str, analysis_id: int) -> bool:
    """북마크 추가 → 성공 여부."""
    ensure_user(user_id)
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO bookmarks(user_id, analysis_id) VALUES (?, ?)",
                (user_id, analysis_id),
            )
            conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False  # 이미 북마크됨 또는 invalid analysis_id


def unbookmark(user_id: str, analysis_id: int) -> bool:
    """북마크 제거 → 성공 여부."""
    with get_db() as conn:
        cursor = conn.execute(
            "DELETE FROM bookmarks WHERE user_id = ? AND analysis_id = ?",
            (user_id, analysis_id),
        )
        conn.commit()
    return cursor.rowcount > 0


def get_bookmarks(user_id: str) -> list[dict]:
    """찜 목록 → analyze data 형태 배열 (최신순)."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT analysis_id FROM bookmarks WHERE user_id = ? ORDER BY id DESC",
            (user_id,),
        ).fetchall()
    return get_multiple_analyses([row["analysis_id"] for row in rows])


def set_transaction_status(user_id: str, analysis_id: int, status: str) -> str:
    """거래 상태 upsert (매물당 1개, 이력 아님) → updated_at(ISO, 'Z' 접미사) 반환."""
    ensure_user(user_id)
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO transaction_status (user_id, analysis_id, status)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, analysis_id)
            DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP
            """,
            (user_id, analysis_id, status),
        )
        conn.commit()
        row = conn.execute(
            "SELECT updated_at FROM transaction_status WHERE user_id = ? AND analysis_id = ?",
            (user_id, analysis_id),
        ).fetchone()
    return row["updated_at"].replace(" ", "T") + "Z"


def get_transactions(user_id: str, status: Optional[str] = None) -> list[dict]:
    """거래 상태 목록 (analysis_history와 조인, 최신 변경순). status 생략 시 전체."""
    query = """
        SELECT t.analysis_id, t.status, t.updated_at,
               a.title, a.price, a.trust_score, a.risk_level
        FROM transaction_status t
        JOIN analysis_history a ON a.id = t.analysis_id
        WHERE t.user_id = ?
    """
    params: list = [user_id]
    if status:
        query += " AND t.status = ?"
        params.append(status)
    query += " ORDER BY t.updated_at DESC"
    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()
    return [
        {
            "item_id": row["analysis_id"],
            "title": row["title"],
            "price": row["price"],
            "trust_score": row["trust_score"],
            "risk_level": row["risk_level"],
            "status": row["status"],
            "updated_at": row["updated_at"].replace(" ", "T") + "Z",
        }
        for row in rows
    ]


def add_comparison_item(user_id: str, analysis_id: int) -> bool:
    """비교 후보 추가 → 성공 여부(이미 있으면 False)."""
    ensure_user(user_id)
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO comparison_items(user_id, analysis_id) VALUES (?, ?)",
                (user_id, analysis_id),
            )
            conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False


def remove_comparison_item(user_id: str, analysis_id: int) -> bool:
    """비교 후보 제거 → 성공 여부."""
    with get_db() as conn:
        cursor = conn.execute(
            "DELETE FROM comparison_items WHERE user_id = ? AND analysis_id = ?",
            (user_id, analysis_id),
        )
        conn.commit()
    return cursor.rowcount > 0


def get_comparison_items(user_id: str) -> list[dict]:
    """비교 후보 목록 → analyze data 형태 배열 (최신순)."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT analysis_id FROM comparison_items WHERE user_id = ? ORDER BY id DESC",
            (user_id,),
        ).fetchall()
    return get_multiple_analyses([row["analysis_id"] for row in rows])


def get_mypage_summary(user_id: str) -> dict:
    """마이페이지 상단 요약 — 기존/신규 테이블 COUNT만으로 구성 (별도 집계 테이블 없음)."""
    with get_db() as conn:
        analysis_count = conn.execute(
            "SELECT COUNT(*) c FROM analysis_history WHERE user_id = ?", (user_id,)
        ).fetchone()["c"]
        bookmark_count = conn.execute(
            "SELECT COUNT(*) c FROM bookmarks WHERE user_id = ?", (user_id,)
        ).fetchone()["c"]
        comparison_count = conn.execute(
            "SELECT COUNT(*) c FROM comparison_items WHERE user_id = ?", (user_id,)
        ).fetchone()["c"]
        transaction_completed_count = conn.execute(
            "SELECT COUNT(*) c FROM transaction_status WHERE user_id = ? AND status = 'COMPLETED'",
            (user_id,),
        ).fetchone()["c"]
    return {
        "analysis_count": analysis_count,
        "bookmark_count": bookmark_count,
        "comparison_count": comparison_count,
        "transaction_completed_count": transaction_completed_count,
    }
