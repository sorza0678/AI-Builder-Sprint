# AGENTS.md

AI 코딩 에이전트(Claude Code, Codex 등)가 이 저장소에서 작업할 때 따라야 할 공통 규칙입니다.
모든 팀원(A/B/프론트/디자이너)이 함께 참조하는 단일 진실 소스입니다.

## 프로젝트 개요

중고 매물의 링크/스크린샷을 넣으면 가격 적정성과 상태를 AI가 판별해주는 소비자용 앱.
Upstage Document Parse·Information Extract로 매물 정보를 구조화하고, Solar LLM으로 상태 등급·주의 신호·거래 체크리스트를 생성한다.

## 기술 스택

- **Frontend**: React Native (Expo), TypeScript, Zustand, React Query
- **Backend**: FastAPI, Python, PostgreSQL(Supabase)
- **AI**: Upstage Document Parse, Information Extract, Solar LLM
- **Backend 로직**: URL 파싱, Rule Engine, 신뢰도 점수 계산, 체크리스트 생성

## 팀 역할 분담

| 담당 | 영역 | 비고 |
|---|---|---|
| Backend A | AI 분석 파이프라인 (Upstage/Solar 직접 연동) | `/analyze`, `/price-analysis`, `/condition-analysis`, `/compare`, `/generate-questions`, `/generate-negotiation` |
| Backend B (ym) | 서비스·DB (인증, 매물관리, 찜, 기록, 비교, 거래, 마이페이지) | `/listing`, `/bookmark`, `/history`, `/comparison`, `/transaction`, `/mypage` |
| Frontend | React Native 화면 구현, mock → 실데이터 전환 | |
| Design | 화면 디자인 | |

## API 계약 (확정 — 2026-07-30, A)

> 전체 예시 JSON·에러코드 표·데모 트리거는 **`backend/README.md`가 원본**. 여기는 요약만.
> Backend A 구현은 `feat/analyze-api` 브랜치 (`backend/app/`).

### `POST /api/v1/analyze` 응답 `data` (확정)

```
item_id            int     — DB analysis_history PK. 이후 모든 API가 이 값 사용
title              str
price              int
market_price_avg   int     — 번개장터 검색 절사평균 (실패 시 FALLBACK_PRICES)
trust_score        int     — 0~100, Rule Engine 계산 (LLM 아님, 재현성 보장)
risk_level         str     — "SAFE" | "WARNING" | "DANGER"
scam_warnings      list[str]
product_status     { defects_found: list[str], missing_components: list[str] }
```

- Backend B의 `/listing`, Frontend 화면4가 이 스키마에 의존 — **필드 변경 시 팀 공지 필수**
- 에러코드: `SCRAPE_FAILED`(400) · `ITEM_NOT_FOUND`(404) · `VALIDATION_ERROR`(422) · `INTERNAL_ERROR`(500) — 전부 공통 `{ok,data,error}` 형식

### 나머지 A 엔드포인트 (구현 완료)

- `POST /api/v1/compare` — `item_ids` 2~3개 비교 + `recommendation` 한 줄
- `POST /api/v1/checklist` — 현장 확인 체크리스트 (역할표의 `/generate-questions`에 해당)
- `POST /api/v1/inquiry-script` — 판매자 문의 메시지 (역할표의 `/generate-negotiation`에 해당)

⚠️ 경로 이름이 역할표와 다름(`/checklist`·`/inquiry-script`로 구현됨) — 통일 필요하면 팀 논의.

⚠️ **`/analyze` 동작 변경 (2026-08-01)**: 스크래핑이 실제로 실패하면(예: `cafe.naver.com`처럼
지원 안 되는 사이트) 이전엔 fallback 고정 데이터로 200을 반환했지만, 이제 `400 SCRAPE_FAILED`를
반환한다 — 에러코드 자체는 기존 확정 계약에 이미 있었으나 실제 URL 실패에는 지금까지 연결되어
있지 않았음. 데모 트리거 단어(`danger`·`warning`·`mock-safe`·`fail`)는 영향 없음. 프론트에서 실제
매물 URL로 테스트할 때 이 응답을 에러로 처리하고 있는지 확인 필요. 자세한 내용은
`backend/README.md`의 "매물 수집 (scraper) 플랫폼별 동작" 참고.

### Backend B 엔드포인트 (구현 완료 — 2026-07-31, `feat/service-api` 브랜치)

> 화면5(거래 준비)·화면6(마이페이지) 대응. 공통 `{ok,data,error}` 형식 동일, `item_id` 기준 404 `ITEM_NOT_FOUND` 처리 동일.

- `GET /api/v1/history?user_id=&page=&size=` — 분석 히스토리 (최신순 페이지네이션). A가 임시 제공하던 것을 B로 이관 완료 (2026-08-02) — 코드 위치도 `main.py`/`db.py`/`schemas.py` 전부 B 블록으로 실제 이동, API 계약·동작 변경 없음(순수 이동). 테스트 4개 추가(`test_service_endpoints.py`).
- `POST/GET /api/v1/transaction` — 거래 상태 등록(upsert, 매물당 1개)/목록 조회. **2026-08-02 재설계**: 이전엔 `status`
  단일 5값 enum(`PLANNED|CONTACTED|ON_HOLD|COMPLETED|EXCLUDED`)이었으나, 실제 거래준비 화면(`trade/[analysisId].tsx`)이
  진행단계와 판단을 독립된 2축으로 관리하는 걸 확인해 `stage`(`BEFORE_CONTACT|CONTACTING|SCHEDULED|COMPLETED`, 필수) +
  `decision`(`CONSIDERING|HOLD|EXCLUDED`, optional/nullable)로 분리. POST는 매 호출마다 두 필드 전체 덮어쓰기
  (`decision` 생략 시 `NULL`로 리셋 — 항상 유지하고 싶은 값은 함께 재전송해야 함). GET은 `stage`/`decision` 각각
  독립 optional 필터(둘 다 주면 AND). 이 계약은 아직 프론트가 호출한 적 없는 상태에서 바로잡은 것이라 실사용
  데이터 마이그레이션은 없음. 함수명도 `upsert_transaction_status`로 리네임.
- `POST/DELETE/GET /api/v1/comparison` — 비교 후보 목록 추가/제거/조회
- `POST/DELETE/GET /api/v1/bookmark` — 찜 추가/제거/조회 (`bookmarks` 테이블은 A가 이미 생성, 엔드포인트는 B가 구현)
- `GET /api/v1/mypage` — 상단 요약 `{analysis_count, bookmark_count, comparison_count, transaction_completed_count}` — 별도 집계 테이블 없이 기존/신규 테이블 COUNT 쿼리로 구성
- `POST /api/v1/listing` — 화면2(분석 확인) 확인/수정된 매물 상세(모델명·연식·사이즈·색상·사용기간·구성품·하자·상품명·가격) upsert, `analysis_id`당 1행 (B, 2026-08-02). `analysis_history`와 분리된 별도 테이블 — Document Parse 파이프라인(AI 최초 추정)과 겹치지 않음, "사람이 확정한 최종본"만 저장. **범위를 의도적으로 좁게 잡음**: GET/DELETE 없음(재확인은 POST 재호출로 덮어씀), `/history`·`/bookmark`·`/comparison`·`/mypage` 등 목록 화면에는 반영되지 않음(그 화면들은 여전히 `analysis_history` 원본만 보여줌) — 필요해지면 별도 논의.

⚠️ **프론트 연동 전제**: 현재 화면2(`analysis-confirm-sheet.tsx`)는 `/analyze` 호출 **이전**에 뜨고 100% mock 데이터(`getRecentListings()`)로 채워진다. `/listing`은 이미 존재하는 `item_id`(=`/analyze`가 만든 `analysis_history` PK)에 종속되므로, 실제로 연결하려면 프론트가 흐름을 "URL/이미지 제출 → `/analyze` 호출 → 그 결과로 화면2 표시 → 확인 시 `/listing` 저장"으로 재배치해야 한다 — 프론트팀 확인 필요.

테스트 `backend/tests/test_service_endpoints.py` (26개, `/listing` 6개·`/transaction` 10개 포함) 참고.

## 공통 규칙

### API 응답 형식
```json
{ "ok": true, "data": {}, "error": null }
```
- 성공: `ok: true`, `data`에 실제 페이로드
- 실패: `ok: false`, `error`에 메시지/코드

### 커밋 컨벤션
- 형식: `feat|fix|docs|refactor(scope): 제목` — 제목 100자 이내
- 기능 단위로 자주, 작게 커밋 (히스토리 추적 용이하게)

### 브랜치 전략
- 기능 단위 브랜치, PR로 머지

### 보안
- API 키, DB 접속정보는 `.env`에만 — 절대 커밋 금지
- `.claude/`, `AGENTS.md`, `CLAUDE.md`는 저장소에 커밋 (secrets 제외)

## 빌드 · 테스트

```bash
# 설치
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# 실행 (:8000, /docs 에 Swagger)
.venv/bin/uvicorn app.main:app --reload --port 8000

# 테스트
.venv/bin/python -m pytest tests/ -q
```

- Upstage 연동(선택): `cp .env.example .env` 후 `UPSTAGE_API_KEY` 입력 — 없어도 전부 동작
- 변경 후 검증 습관: pytest + 서버 띄워서 curl 스모크 (`GET /health`)

## 에이전트 작업 방식 권장

- **plan 모드부터**: 큰 기능은 바로 코딩하지 말고 설계 검토 → 승인 후 구현
- **작은 커밋**: 기능 단위로 자주 커밋
- **테스트 우선**: 가능하면 테스트 먼저 작성 후 통과까지 확인
- **AI 활용 기록**: 작업 세션마다 한 줄씩 무엇을 AI와 함께 했는지 남기기 (데모/회고용)

## 데이터베이스

### 현재 구축됨 (SQLite — `backend/app/schema.sql`)

- `users(id TEXT PK, created_at)` — user_id는 프론트가 보내는 문자열 (인증 없음)
- `analysis_history(id, user_id, source_url, title, price, trust_score, risk_level, raw_analysis_json, created_at)` — 분석결과 통째로 JSON 저장, 모든 후속 API가 재사용 (LLM 재호출 금지)
- `bookmarks(id, user_id, analysis_id, created_at)` — UNIQUE(user_id, analysis_id) — A 생성, B가 `/bookmark` 엔드포인트 구현
- `transaction_status(id, user_id, analysis_id, stage, decision, created_at, updated_at)` — UNIQUE(user_id, analysis_id), `stage` CHECK 4종(필수)·`decision` CHECK 3종(nullable) (B, 2026-07-31, 2026-08-02 `status` 단일 컬럼에서 2축으로 재설계)
- `comparison_items(id, user_id, analysis_id, created_at)` — UNIQUE(user_id, analysis_id) — bookmarks와 동일 구조 (B, 2026-07-31)
- `listing_details(id, user_id, analysis_id, title, price, model_name, year, size_or_capacity, color, usage_period, components_json, defects_json, created_at, updated_at)` — UNIQUE(user_id, analysis_id), `transaction_status`와 동일한 upsert 패턴 (B, 2026-08-02)

로컬 파일 `backend/resale_guard.db` (gitignore). 스키마는 Supabase(PostgreSQL) 호환으로 작성됨 —
전환 시 `raw_analysis_json TEXT` → `JSONB`, `AUTOINCREMENT` → `BIGSERIAL`만 바꾸면 된다 (`DATABASE_URL`은 `.env`).
FK 제약은 `PRAGMA foreign_keys=ON`으로 실제 적용됨 (2026-07-31 수정 — 이전엔 선언만 되고 sqlite3 기본값 때문에 무시되고 있었음).

### 미확정 / 논의 필요

- 화면2 흐름 순서 — 위 "Backend B 엔드포인트" 절의 `/listing` 프론트 연동 전제 참고

### Git 작업
- 에이전트는 `git commit`, `git push`를 스스로 판단해서 실행하지 않는다
- 커밋/푸시가 필요하다고 판단되면 사람에게 먼저 제안하고, 명시적으로 지시받았을 때만 실행한다

## 참고

- Analysis History, Product Rules, Scam Patterns, Checklist Templates 중 Product Rules·Scam Patterns·Checklist Templates는 Backend A 소관 (Rule Engine·체크리스트 생성 로직 참조용)
- Analysis History는 Backend B 소관
