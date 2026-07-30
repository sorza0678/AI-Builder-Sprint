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

- `GET /api/v1/history?user_id=&page=&size=` — 분석 히스토리 (최신순 페이지네이션)
- `POST /api/v1/compare` — `item_ids` 2~3개 비교 + `recommendation` 한 줄
- `POST /api/v1/checklist` — 현장 확인 체크리스트 (역할표의 `/generate-questions`에 해당)
- `POST /api/v1/inquiry-script` — 판매자 문의 메시지 (역할표의 `/generate-negotiation`에 해당)

⚠️ 경로 이름이 역할표와 다름(`/checklist`·`/inquiry-script`로 구현됨) — 통일 필요하면 팀 논의.
`/history`는 역할표상 B 소관이지만 현재 A가 분석 히스토리 조회용으로 임시 제공 중 — B 서비스로 이관/통합 여부 논의 필요.

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

### 현재 구축됨 (A, SQLite — `backend/app/schema.sql`)

- `users(id TEXT PK, created_at)` — user_id는 프론트가 보내는 문자열 (인증 없음)
- `analysis_history(id, user_id, source_url, title, price, trust_score, risk_level, raw_analysis_json, created_at)` — 분석결과 통째로 JSON 저장, 모든 후속 API가 재사용 (LLM 재호출 금지)
- `bookmarks(id, user_id, analysis_id, created_at)` — UNIQUE(user_id, analysis_id)

로컬 파일 `backend/resale_guard.db` (gitignore). 스키마는 Supabase(PostgreSQL) 호환으로 작성됨 —
전환 시 `raw_analysis_json TEXT` → `JSONB`, `AUTOINCREMENT` → `BIGSERIAL`만 바꾸면 된다 (`DATABASE_URL`은 `.env`).

### Backend B 소관 테이블 (TBD)

> 스키마 확정 후 채우기: 매물, 찜(위 bookmarks 재사용 가능), 비교목록, 거래상태, 마이페이지 집계용 테이블

### Git 작업
- 에이전트는 `git commit`, `git push`를 스스로 판단해서 실행하지 않는다
- 커밋/푸시가 필요하다고 판단되면 사람에게 먼저 제안하고, 명시적으로 지시받았을 때만 실행한다

## 참고

- Analysis History, Product Rules, Scam Patterns, Checklist Templates 중 Product Rules·Scam Patterns·Checklist Templates는 Backend A 소관 (Rule Engine·체크리스트 생성 로직 참조용)
- Analysis History는 Backend B 소관
