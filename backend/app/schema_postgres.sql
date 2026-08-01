-- PostgreSQL 스키마 (schema.sql의 Supabase 대응판)
-- 차이는 AUTOINCREMENT → BIGSERIAL 뿐. raw_analysis_json/components_json/defects_json은
-- 의도적으로 JSONB가 아닌 TEXT 유지 (기존 json.dumps/json.loads 수동 관리 방식과 psycopg2의
-- JSONB 자동 adapt가 충돌하지 않도록 하기 위함).

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analysis_history (
    id BIGSERIAL PRIMARY KEY,
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
    id BIGSERIAL PRIMARY KEY,
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
-- stage(진행 단계)·decision(판단)은 프론트 실제 화면상 독립된 2축이라 컬럼도 분리함
CREATE TABLE IF NOT EXISTS transaction_status (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    analysis_id INTEGER NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('BEFORE_CONTACT', 'CONTACTING', 'SCHEDULED', 'COMPLETED')),
    decision TEXT CHECK (decision IN ('CONSIDERING', 'HOLD', 'EXCLUDED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (analysis_id) REFERENCES analysis_history(id),
    UNIQUE (user_id, analysis_id)
);

-- Backend B: 화면1/3/4/6 — 비교 후보 목록 (bookmarks와 동일 구조)
CREATE TABLE IF NOT EXISTS comparison_items (
    id BIGSERIAL PRIMARY KEY,
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
    id BIGSERIAL PRIMARY KEY,
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
