# Backend — AI 분석 + 서비스 API (이가격 맞아요?)

중고 매물 URL 입력 → 시세비교 + AI 사기 위험분석 + 신뢰도 점수, 찜·비교·거래·마이페이지까지.
Backend A(AI 분석 파이프라인)와 Backend B(서비스·DB)가 같은 FastAPI 앱(`backend/app/`) 안에서 작업한다 —
파일/엔드포인트 단위로 담당이 나뉘어 있을 뿐 별도 서비스로 배포되진 않는다. 담당 구분과 상세 규칙은
`backend/AGENTS.md` 참고, 여기는 실행 방법과 API 계약이 원본.

## 실행

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

- Swagger 문서: http://localhost:8000/docs
- 상태 확인: `GET /health` (→ `upstage_key`로 Solar 연동 여부 확인)
- DB: 기본은 SQLite(`backend/resale_guard.db`, 자동 생성) — `.env`에 `DATABASE_URL`을 채우면 Postgres(Supabase)로
  자동 전환됨(코드 무변경). 자세한 건 아래 "SQLite ↔ Postgres 이중 백엔드" 참고, `.env.example` 참고
- Upstage 연동(선택): `cp .env.example .env` 후 `UPSTAGE_API_KEY` 입력 — 없어도 Rule Engine만으로 전부 동작
- 테스트: `.venv/bin/python -m pytest tests/ -q` (130개, A/B 전부 포함)

## 공통 응답 형식 (팀 컨벤션)

```json
성공: { "ok": true,  "data": { ... },  "error": null }
실패: { "ok": false, "data": null,     "error": { "code": "...", "message": "..." } }
```

**모든 실패가 이 형식을 따른다** — 요청 검증 실패(422 `VALIDATION_ERROR`)와 서버 오류(500 `INTERNAL_ERROR`)도 전역 핸들러로 변환해둠. 프론트는 `error.code` / `error.message`만 믿고 처리하면 된다.

| code | HTTP | 언제 |
|---|---|---|
| `SCRAPE_FAILED` | 400 | 매물 페이지 수집 실패 |
| `ITEM_NOT_FOUND` | 404 | 없는 item_id 요청 |
| `LISTING_NOT_FOUND` | 404 | `item_id`는 유효하지만 `/listing`으로 저장한 적 없음(또는 다른 user_id 소유) — B, `GET /api/v1/listing` 전용 |
| `VALIDATION_ERROR` | 422 | 요청 형식 오류 (필수 필드 누락, item_ids 개수 위반 등) |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |

---

## Backend A — AI 분석 파이프라인

**현재 상태**: 실제 분석 파이프라인 동작. `/analyze` 흐름:

```
scraper (매물 수집 — JSON-LD 우선, 실패 시 400 SCRAPE_FAILED)
  → market_price (번개장터 검색 → 잡음 필터 → trimmed mean, 실패 시 FALLBACK_PRICES)
  → rule_engine (trust_score·risk_level — 결정론적, LLM 아님)
  → ai_report (Upstage Solar LLM 로 하자/경고 텍스트 보강 — 키 없으면 자동 스킵, 점수 불변)
  → DB 저장
```

시세·Rule Engine·AI 보강 단계는 fallback이 있어 절대 예외를 던지지 않는다.
매물 수집(scraper) 자체가 실패하면(예: 지원하지 않는 사이트, 네트워크 오류) 가짜 데이터로 조용히
넘어가지 않고 **400 `SCRAPE_FAILED`를 정직하게 반환한다** (2026-08-01 변경 — 이전엔 fallback 고정
데이터로 200을 반환했음). 데모 트리거 단어(`danger`·`warning`·`mock-safe`·`fail`)는 스크래퍼 실행 전에
분기하므로 이 로직과 무관하게 항상 그대로 동작한다.

### 매물 수집 (scraper) 플랫폼별 동작

- **번개장터**: 공개 상품 API(`api.bunjang.co.kr`)를 우선 사용, 실패 시 og태그로 재시도
- **당근마켓 · 중고나라(`web.joongna.com`)**: JSON-LD(`schema.org/Product`)를 og태그보다 우선 사용
  — 실측 확인 결과 og태그보다 가격·이미지 정확도가 높음 (예: og:description에 판매자가 적은
  텍스트가 있어도 JSON-LD의 `offers.price`가 실제 가격)
- **`cafe.naver.com`(구 중고나라 카페 링크)**: 클라이언트에서만 렌더링되는 SPA라 og태그·JSON-LD
  모두 존재하지 않음 (실측 확인) — 요청조차 보내지 않고 바로 `scrape_ok: False` 처리 →
  `SCRAPE_FAILED` 반환. 같은 매물이라도 `web.joongna.com` 링크는 정상 동작.

### POST `/api/v1/analyze` — 매물 URL 분석 ★핵심

요청:
```json
{ "user_id": "demo-user-1", "url": "https://www.daangn.com/articles/123456" }
```

성공 200 — **`data` 스키마 (확정, 프론트 화면4·B `/listing`이 여기 의존)**:
```json
{
  "ok": true,
  "data": {
    "item_id": 1,
    "title": "아이폰 14 프로 256GB 딥퍼플 (상태 A급)",
    "price": 850000,
    "market_price_avg": 920000,
    "trust_score": 82,
    "risk_level": "SAFE",
    "scam_warnings": [],
    "product_status": {
      "defects_found": ["후면 카메라 링 주변 미세 스크래치"],
      "missing_components": ["정품 박스 없음"]
    }
  },
  "error": null
}
```

- `item_id`: **DB analysis_history의 PK** — 이후 모든 API(compare/checklist/inquiry-script, B의 모든 엔드포인트)에서 이 값 사용
- `trust_score`: 0~100 정수 (Rule Engine 계산, LLM 아님 — 재현성 보장)
- `risk_level`: `"SAFE" | "WARNING" | "DANGER"` — ⚠️ 프론트 `RiskLevel`(`LOW|MEDIUM|HIGH`)과 값이 다름, 상세는 `backend/AGENTS.md`의 "risk_level enum이 프론트와 다름" 참고
- `scam_warnings`: 문자열 배열 — SAFE면 보통 `[]`, WARNING/DANGER에서 채워짐

실패 400:
```json
{ "ok": false, "data": null, "error": { "code": "SCRAPE_FAILED", "message": "매물 페이지를 불러오지 못했습니다. URL을 확인해주세요." } }
```

### POST `/api/v1/compare` — 매물 2~3개 비교

요청: `{ "user_id": "...", "item_ids": [1, 3] }` (2~3개 필수, 아니면 422 `VALIDATION_ERROR` — 공통 에러 형식)

```json
{
  "ok": true,
  "data": {
    "items": [ /* analyze data 와 동일 구조 배열 */ ],
    "recommendation": "'아이폰 14 프로...' 매물이 신뢰도 82점으로 가장 안전합니다."
  },
  "error": null
}
```

### POST `/api/v1/checklist` — 현장 확인 체크리스트

요청: `{ "user_id": "...", "item_id": 1 }`
→ `data: { "item_id": 1, "checklist": ["실물 확인: ...", ...] }`

### POST `/api/v1/inquiry-script` — 판매자 문의 메시지

요청: `{ "user_id": "...", "item_id": 1 }`
→ `data: { "item_id": 1, "script": "안녕하세요, ..." }`

공통: 존재하지 않는 `item_id` → 404 `ITEM_NOT_FOUND`.

### 데모/테스트용 강제 트리거

기본적으로 **모든 URL은 실제 분석 파이프라인**을 탄다 (번개장터 URL이 가장 잘 됨).
프론트가 UI 상태별로 테스트하고 싶을 때만 `url`에 아래 단어를 포함:

| url에 포함된 단어 | 결과 |
|---|---|
| `fail` | 400 `SCRAPE_FAILED` 에러 (에러 UI 테스트) |
| `danger` | 고정 DANGER 매물 (trust_score 18, 경고 4건) |
| `warning` | 고정 WARNING 매물 (trust_score 55) |
| `mock-safe` | 고정 SAFE 매물 (trust_score 82) |

analyze 할 때마다 DB에 저장되고 `item_id`가 1씩 증가한다. compare/checklist/inquiry-script와 B의 모든
엔드포인트는 **본인이 analyze한 item_id**로 호출할 것.

### 개발 로드맵 (Backend A)

- [x] STEP 1: mock 서버 + 스키마 확정 + /docs
- [x] STEP 2: DB 3테이블 + 저장/조회 연동
- [x] STEP 3: URL 파싱 — `scraper.py` (플랫폼 판별·번개장터 API·og태그, 실패 시 fallback)
- [x] STEP 4: 시세 함수 — `market_price.py` (번개장터 검색, 잡음 필터, trimmed mean, FALLBACK_PRICES)
- [x] STEP 5: Rule Engine — `rule_engine.py` (시세비율·사기문구·판매자 신호 → 점수. 유닛테스트 12개)
- [x] STEP 6: /analyze 통합 — `ai_report.py` (Upstage Solar 보강, 키 없으면 스킵) + DB 저장
- [x] STEP 7: 나머지 API는 저장 데이터 재활용 (LLM 재호출 금지)
- [x] STEP 8: 당근마켓/중고나라 스크래핑 정확도 개선 — JSON-LD 파싱 추가, `cafe.naver.com` 미지원 확인 및 정직한 실패 처리, `analyze()`가 `scrape_ok` 반영하도록 수정 (2026-08-01)

남은 것(A): `cafe.naver.com` 실제 지원(비공식 네이버 카페 API 연동 필요 — 보류), Upstage Document
Parse·Information Extract 실사용 여부(현재 스크래핑은 자체 정규식/JSON-LD, `AGENTS.md` 프로젝트
개요의 "Document Parse로 구조화" 비전과 실제 구현 사이 괴리 있음 — A 확인 필요).

---

## Backend B — 서비스·DB

찜·비교후보·거래상태·마이페이지·매물 확인 상세, 그리고 DB 계층(SQLite/Postgres) 담당.
공통 `{ok,data,error}` 형식 동일, `item_id` 기준 404 `ITEM_NOT_FOUND` 처리 동일.

### GET `/api/v1/history?user_id=&page=1&size=10` — 분석 히스토리 (최신순)

A가 임시 제공하던 것을 B로 이관 완료(2026-08-02, 순수 코드 이동·API 계약 변경 없음).

```json
{
  "ok": true,
  "data": {
    "items": [
      { "item_id": 3, "source_url": "...", "title": "...", "price": 1500000,
        "trust_score": 18, "risk_level": "DANGER", "created_at": "2026-07-30T09:09:48Z" }
    ],
    "page": 1, "size": 10, "total": 3
  },
  "error": null
}
```

`created_at`은 UTC(`Z` 접미사) — JS에서 `new Date(created_at)` 하면 자동으로 로컬시간(KST) 변환된다.

### POST `/api/v1/listing` — 화면2 확인된 매물 상세 저장 (upsert)

요청:
```json
{
  "user_id": "demo-user-1", "item_id": 1,
  "title": "아이폰 13 프로 256GB", "price": 850000,
  "model_name": "iPhone 13 Pro", "year": "2021", "size_or_capacity": "256GB",
  "color": "그래파이트", "usage_period": "6개월",
  "components": ["박스", "충전기"], "defects": ["액정 미세 스크래치"]
}
```
성공 200: `data`는 요청 필드 그대로 + `updated_at`. 매 호출마다 전체 덮어쓰기(`analysis_id`당 1행) —
재확인 시 그냥 다시 POST하면 됨.

### GET `/api/v1/listing?user_id=&item_id=` — 저장된 매물 상세 조회 (2026-08-02 추가)

성공 200: POST와 동일한 `data`.
실패: `item_id`가 `analysis_history`에 없음 → `404 ITEM_NOT_FOUND` / 있지만 아직 저장한 적 없거나
다른 user_id 소유 → `404 LISTING_NOT_FOUND`.

### POST/DELETE/GET `/api/v1/bookmark` — 찜

- `POST { "user_id", "item_id" }` → `{ "item_id", "bookmarked": true|false }` (이미 찜한 상태면 `false`)
- `DELETE ?user_id=&item_id=` → `{ "item_id", "removed": bool }`
- `GET ?user_id=` → `{ "items": [ /* analyze data 배열 */ ], "total": int }`

### POST/DELETE/GET `/api/v1/comparison` — 비교 후보 목록

`/bookmark`와 동일 패턴, 응답 필드만 `added`/`removed`.

### POST/GET `/api/v1/transaction` — 거래 상태 (화면5 구매 결정 저장)

**2026-08-02 재설계**: 진행단계(`stage`)와 판단(`decision`)이 프론트 화면상 독립된 2축이라 컬럼도
분리(이전엔 `status` 단일 5값 enum이었음).

```json
{ "user_id": "demo-user-1", "item_id": 1, "stage": "CONTACTING", "decision": "CONSIDERING" }
```
- `stage`(필수): `BEFORE_CONTACT | CONTACTING | SCHEDULED | COMPLETED`
- `decision`(optional/nullable): `CONSIDERING | HOLD | EXCLUDED`
- POST는 매 호출마다 **두 필드 전체 덮어쓰기** — `decision` 생략 시 `NULL`로 리셋되니 유지하고 싶은
  값은 항상 같이 보낼 것
- `GET ?user_id=&stage=&decision=` — 둘 다 optional 필터, 같이 주면 AND

### GET `/api/v1/mypage?user_id=&recent_limit=` — 마이페이지 상단 요약

```json
{
  "ok": true,
  "data": {
    "analysis_count": 2, "bookmark_count": 1, "comparison_count": 2, "transaction_completed_count": 1,
    "recent_analyses": [ /* history item 배열, recent_limit 기본 5 */ ]
  },
  "error": null
}
```
`recent_analyses`는 기존 `/history` 로직 재사용(2026-08-02 추가) — 프론트 마이페이지 "기록" 섹션용.
"추천" 섹션과 매물 `location` 필드는 백엔드에 실데이터가 없어서 의도적으로 안 만듦(지어내지 않음).

### 개발 로드맵 (Backend B)

- [x] 찜·비교후보·거래상태·마이페이지 API 구현 (2026-07-31)
- [x] FK 제약 버그 수정 (`PRAGMA foreign_keys=ON`), Windows 인코딩 오류 수정 (2026-07-31)
- [x] `/listing` POST 구현 — 화면2 확인 매물 상세 upsert (2026-08-02)
- [x] `/history`를 A로부터 이관 (2026-08-02, 코드 위치까지 실제 이동·동작 변경 없음)
- [x] `/transaction`: `status` 단일 enum → `stage`+`decision` 2축 재설계 (2026-08-02)
- [x] `/mypage`: `recent_analyses` 번들 추가 (2026-08-02)
- [x] `/listing` GET 추가 — 화면2 재확인 시나리오 대비 (2026-08-02)
- [x] SQLite ↔ Postgres(Supabase) 이중 백엔드 지원 — 코드 준비 완료 (2026-08-02, 아래 참고)
- [x] `risk_level` enum이 프론트와 다른 문제 확인·문서화, 프론트 매핑 제안 (2026-08-02) — 이후
      프론트 `analysis-service.ts`에 실제 매핑 함수로 반영됨 확인
- [x] 실제 Supabase 프로젝트로 연결 검증 완료 (2026-08-03) — `init_db()`의 Postgres 다중 SQL문
      실행, signup/analyze/bookmark/history/mypage/soft-delete까지 실제 인스턴스에서 정상 동작
      확인. ⚠️ Direct connection(5432)은 IPv6 전용이라 IPv6 미지원 네트워크에서 연결 실패함 —
      **Pooler(6543, `?pgbouncer=true`)를 반드시 사용할 것** (아래 "SQLite ↔ Postgres" 절 참고).
      비밀번호에 URL 특수문자(`[`,`]`,`@`,`#` 등)가 있으면 연결 문자열 파싱이 깨지니 영문/숫자
      조합 권장.

남은 것(B): 실제 배포(Render 등), `AUTH_SECRET`/`AUTH_REQUIRED=1`/CORS 등 실서비스 전 보안 설정
(상세는 `backend/AGENTS.md` "보안 점검 결과" 절의 잔여 리스크 참고).

## DB 테이블 (8개)

- `users(id TEXT PK, created_at, password_hash, nickname, migrated_to)` — 인증(P0-3)·guest 이전(P0-4)용 컬럼 추가됨
- `analysis_history(id, user_id, source_url, title, price, trust_score, risk_level, raw_analysis_json, created_at, deleted_at)` — 분석결과 통째로 JSON 저장, `deleted_at`으로 soft delete (A 생성, B가 삭제 기능 추가)
- `bookmarks(id, user_id, analysis_id, created_at)` — UNIQUE(user_id, analysis_id) (A 생성, B가 엔드포인트 구현)
- `transaction_status(id, user_id, analysis_id, stage, decision, meeting_at, meeting_place, trade_method, memo, payment_method, created_at, updated_at)` — UNIQUE(user_id, analysis_id) (B, 2026-07-31 생성 → 2026-08-02 2축 재설계 → 거래 일정·장소·메모·결제수단 컬럼 추가)
- `comparison_items(id, user_id, analysis_id, created_at)` — UNIQUE(user_id, analysis_id), bookmarks와 동일 구조 (B, 2026-07-31)
- `listing_details(id, user_id, analysis_id, title, price, model_name, year, size_or_capacity, color, usage_period, components_json, defects_json, created_at, updated_at)` — UNIQUE(user_id, analysis_id) (B, 2026-08-02)
- `comparison_history(id, user_id, item_ids_json, recommendation, snapshot_json, created_at)` — 비교 실행 당시 값 snapshot 보존 (B, 2026-08-02)
- `checklist_state(id, user_id, analysis_id, checked_json, excluded_json, updated_at)` — 체크리스트 체크·제외 상태 서버 동기화 (B, 2026-08-02)

## SQLite ↔ Postgres(Supabase) 이중 백엔드

`DATABASE_URL` 환경변수 유무로 자동 분기 — 없으면 SQLite(로컬 개발·테스트 기본값, 무변경),
있으면 Postgres(psycopg2). 스키마 파일 2개: `backend/app/schema.sql`(SQLite) /
`backend/app/schema_postgres.sql`(Postgres, 차이는 `AUTOINCREMENT`→`BIGSERIAL`뿐).
`DATABASE_URL` 형식·PgBouncer 풀러 권장 사항은 `.env.example` 참고. 상세 설계는 `backend/AGENTS.md`
"SQLite ↔ Postgres(Supabase) 이중 백엔드" 절 참고.

✅ 실제 Supabase 인스턴스로 스모크 테스트 완료(2026-08-03) — `init_db()`의 다중 SQL문 실행 포함
전체 CRUD 정상 동작 확인. Direct connection(5432)은 IPv6 전용이라 대부분의 로컬 네트워크에서
연결이 안 될 수 있음 — 반드시 Pooler(6543) 연결 문자열을 사용할 것.

## 2026-08-02 확장 — 프론트 요구사항 문서 반영 (A·B)

> 상세 계약·정책은 `backend/AGENTS.md`의 "2026-08-02 확장" 절이 원본. 여기는 요약.

**사용자 수정값 전면 반영 (P0-1)**: `/listing` 수정값(제목·가격·하자)이 `/history`·`/bookmark`·
`/comparison`·`/compare`·`/transaction`·`/mypage`에 우선 적용됨 (조회 시 LEFT JOIN — 원본 비파괴).

**신규 API**:
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/v1/analysis/{item_id}?user_id=` | 분석 단건 상세 (소유권 검증, listing_details 포함) |
| DELETE | `/api/v1/analysis/{item_id}?user_id=` | 분석 삭제 (soft delete — 모든 목록에서 함께 제외) |
| POST | `/api/v1/price-proposal` | 가격 제안 — 표본 부족 시 `target_price: null` |
| POST/GET | `/api/v1/comparison-history` | 비교 실행 기록 (당시 값 snapshot 보존) |
| GET/DELETE | `/api/v1/comparison-history/{id}` | 비교 기록 단건 조회/삭제 |

**응답 확장 (additive — 기존 필드 전부 유지)**: `/analyze`에 `market_price`(min/avg/max/표본수/신뢰도)·
`platform`·`thumbnail_url`·`location`, `/checklist`에 `groups[]`(거래 전/현장/결제 전 3단계),
`/inquiry-script`에 `questions[]`(선택형)+`combined_script`, 목록 아이템에 시각·URL·플랫폼 필드.
`/compare` 응답에 `comparison_id` (자동 저장된 비교 기록 id).

DB: `analysis_history.deleted_at` 컬럼(자동 마이그레이션) + `comparison_history`·`checklist_state` 테이블 추가 (총 8개).
테스트: 85개 (`test_advisor.py`, `test_p0_endpoints.py` 추가).

**인증 (P0-3·P0-4, 2026-08-02)**: `POST /auth/signup`·`/auth/login` → Bearer 토큰(7일).
토큰을 보내면 user_id 위조가 차단되고(403 `AUTH_MISMATCH`), 안 보내면 기존처럼 동작(데모 모드).
`AUTH_REQUIRED=1`로 전면 강제 가능. guest 기록 이전은 `POST /account/migrate-guest`(토큰 필수, 멱등).
상세는 AGENTS.md "2026-08-02 확장" 절.

**보안 수정 (2026-08-02, 어드버세리얼 리뷰로 실측 재현 후 픽스)**: ① IDOR — 남의 `item_id`를 찜/비교/
체크리스트 등에 끼워넣어 분석 원문을 읽던 구멍 → 모든 참조 지점에 소유권 검증(남의 것은 404) ②
`AUTH_SECRET=`(빈 값)이면 서명키가 빈 문자열이 되던 함정 → 폴백 수정 + 운영 모드 기동 가드 ③ SSRF —
`/analyze`로 내부망·클라우드 메타데이터를 긁어오던 문제 → 공개 IP만 허용, 리다이렉트 매 홉 검사.
잔여 리스크(브루트포스 제한·토큰 취소 없음 등)는 AGENTS.md "보안 점검 결과" 참고.

**문서 12~18 반영 (2026-08-02)**: `/analyze` 에 `risk_signals`(구조화 위험신호)·`condition`(상태 등급/하자
심각도)·`comparables`(시세 근거 매물)·`category`·`image_urls`·`trade_method`·`seller_description`·`posted_at` 추가.
`POST/GET /api/v1/transaction` 에 거래 일정·장소·메모, 신규 `PUT/GET /api/v1/checklist-state`(체크 상태 동기화),
`GET /api/v1/recommendations`(분석·찜 기록 기반 추천, 기록 없으면 빈 배열), `/mypage` 에 `user` 블록.
전부 additive — 기존 필드(`scam_warnings`·`product_status`)는 문자열까지 동일하게 유지된다.
상세는 AGENTS.md "프론트 요구사항 문서 P2~P3 반영" 참고.
