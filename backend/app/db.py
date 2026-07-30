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
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """테이블 생성."""
    with get_db() as conn:
        conn.executescript(SCHEMA.read_text())
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
