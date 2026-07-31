-- SQLite 스키마 (Supabase 호환하도록 JSONB → TEXT)

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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
CREATE TABLE IF NOT EXISTS transaction_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    analysis_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PLANNED', 'CONTACTED', 'ON_HOLD', 'COMPLETED', 'EXCLUDED')),
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
