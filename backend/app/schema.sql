-- SQLite 스키마 (Supabase 호환하도록 JSONB → TEXT)

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    password_hash TEXT,   -- NULL = 비회원(guest)·암묵 생성 유저, 값 있음 = 실계정 (P0-3)
    nickname TEXT,
    migrated_to TEXT      -- guest 데이터를 실계정으로 이전한 뒤 표시 — 재사용 방지 (P0-4)
);

CREATE TABLE IF NOT EXISTS analysis_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    price INTEGER NOT NULL,
    trust_score INTEGER NOT NULL CHECK (trust_score >= 0 AND trust_score <= 100),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('SAFE', 'WARNING', 'DANGER')),
    raw_analysis_json TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,  -- soft delete: 값이 있으면 "삭제된" 기록 (모든 조회에서 제외)
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    analysis_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (analysis_id) REFERENCES analysis_history(id),
    UNIQUE (user_id, analysis_id)
);

CREATE INDEX IF NOT EXISTS idx_history_user_created ON analysis_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);

-- Backend B: 화면5(거래 준비) — 매물당 현재 거래 상태 1개 (이력 아님, 상태 변경 시 UPDATE)
-- stage(진행 단계)·decision(판단)은 프론트 실제 화면상 독립된 2축이라 컬럼도 분리함 (2026-08-02)
CREATE TABLE IF NOT EXISTS transaction_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    analysis_id INTEGER NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('BEFORE_CONTACT', 'CONTACTING', 'SCHEDULED', 'COMPLETED')),
    decision TEXT CHECK (decision IN ('CONSIDERING', 'HOLD', 'EXCLUDED')),
    -- 거래 일정·메모 (개인정보 포함 가능 — 소유자만 조회)
    meeting_at TIMESTAMP,
    meeting_place TEXT,
    trade_method TEXT CHECK (trade_method IN ('IN_PERSON', 'DELIVERY')),
    memo TEXT,
    payment_method TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (analysis_id) REFERENCES analysis_history(id),
    UNIQUE (user_id, analysis_id)
);

-- Backend B: 화면1/3/4/6 — 비교 후보 목록 (bookmarks와 동일 구조)
CREATE TABLE IF NOT EXISTS comparison_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    analysis_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (analysis_id) REFERENCES analysis_history(id),
    UNIQUE (user_id, analysis_id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_user ON transaction_status(user_id);
CREATE INDEX IF NOT EXISTS idx_comparison_user ON comparison_items(user_id);

-- Backend B: 화면2(분석 확인) — AI 추정을 사용자가 확인/수정한 매물 상세 (매물당 1개, 이력 아님)
CREATE TABLE IF NOT EXISTS listing_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    analysis_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    price INTEGER NOT NULL,
    model_name TEXT NOT NULL,
    year TEXT NOT NULL,
    size_or_capacity TEXT NOT NULL,
    color TEXT NOT NULL,
    usage_period TEXT NOT NULL,
    components_json TEXT NOT NULL,
    defects_json TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (analysis_id) REFERENCES analysis_history(id),
    UNIQUE (user_id, analysis_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_details_user ON listing_details(user_id);

-- Backend B: 실행된 비교 기록 (비교 후보 목록과 별개 — "비교를 실행했던 과거"의 보존)
-- snapshot_json: 비교 당시의 제목·가격·점수를 그대로 저장 (이후 상품 정보가 바뀌어도 기록은 불변)
CREATE TABLE IF NOT EXISTS comparison_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    item_ids_json TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_comparison_history_user ON comparison_history(user_id);

-- Backend B: 화면5 거래 준비 — 체크리스트 체크 상태 서버 동기화 (기기 바뀌어도 유지)
CREATE TABLE IF NOT EXISTS checklist_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    analysis_id INTEGER NOT NULL,
    checked_json TEXT NOT NULL,
    excluded_json TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (analysis_id) REFERENCES analysis_history(id),
    UNIQUE (user_id, analysis_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_state_user ON checklist_state(user_id);
