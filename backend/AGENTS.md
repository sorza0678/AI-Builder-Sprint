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

⚠️ **`risk_level` enum이 프론트와 다름 — 실연동 전에 확인 필요 (B 제안, 2026-08-02)**

백엔드 `risk_level`은 `"SAFE" | "WARNING" | "DANGER"`(`backend/app/schemas.py`, `schema.sql`의
`analysis_history.risk_level` CHECK 제약)인데, 프론트 `RiskLevel` 타입(`frontend/src/types/marketplace.ts:3`)은
`'LOW' | 'MEDIUM' | 'HIGH'`로 완전히 다른 값이다. 지금은 프론트가 실제 API를 하나도 호출하지 않는
mock 전용 상태라 문제가 드러나지 않지만, 실연동 순간 확인된 구체적 버그 2개가 있다:

- `frontend/src/components/analysis-result-view.tsx:86-88` — `riskPenalty = { LOW: 0, MEDIUM: 8, HIGH: 18 }`에
  `SAFE`/`WARNING`/`DANGER` 값을 넣으면 `riskPenalty[result.riskLevel]`가 `undefined` → 점수 계산이
  `NaN`이 되어 화면 점수가 깨짐
- 같은 파일 `:242` — `riskLevel === 'LOW' ? '높음' : ... : '낮음'` 삼항 체인이 `SAFE`/`WARNING`/`DANGER`
  전부 마지막 분기로 빠져서, 실제로는 안전한(`SAFE`) 매물인데 "가격 신뢰도: 낮음"으로 잘못 표시됨(크래시는
  안 나고 조용히 틀린 값이 뜨는 게 더 위험)

**B 제안**: 백엔드 enum(`SAFE|WARNING|DANGER`, A의 확정 계약 + DB CHECK 제약 + rule_engine 로직에 이미
박혀있음)을 바꾸는 대신, **프론트가 실제 연동하는 시점에 `SAFE→LOW, WARNING→MEDIUM, DANGER→HIGH`
매핑 함수 하나를 데이터 수신 지점(API 응답 → `AnalysisResult` 변환 레이어)에 추가**하는 쪽을 권장한다.
이유: 백엔드 쪽을 바꾸려면 A의 이미 테스트된 `rule_engine.py` 로직 + DB CHECK 제약 + "확정" 계약 문서를
전부 건드려야 해서 블라스트 반경이 크고, 반대로 프론트 쪽은 매핑 함수 하나로 끝남. `conditionGrade`
(A/B/C/D) 같은 다른 필드들도 실연동 시 비슷한 매핑이 필요할 수 있으니, 이 참에 "백엔드 원시값 → 프론트
표시값" 변환을 한 군데(예: `analysis-service.ts`의 API 응답 파싱 지점)로 모아두는 걸 제안. B가 코드로
구현할 부분은 없음(프론트 파일이라 연동 담당자 몫) — 여기 기록해서 실연동 시점에 놓치지 않게 하는 것까지가 B의 역할.

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

### Backend B 엔드포인트 (구현 완료, 2026-07-31 ~ 2026-08-02)

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
- `GET /api/v1/mypage?user_id=&recent_limit=` — 상단 요약 `{analysis_count, bookmark_count, comparison_count,
  transaction_completed_count}` (별도 집계 테이블 없이 COUNT 쿼리) + `recent_analyses`(최근 분석 목록,
  `recent_limit` 기본 5, `get_history()` 그대로 재사용 — 2026-08-02 추가). 프론트 마이페이지 화면의 "기록"
  섹션은 이걸로 커버됨. "추천" 섹션과 `location` 필드는 의도적으로 뺌 — `location`은 백엔드 어디에도 실제
  데이터가 없고(scraper가 판매자 위치를 수집하지 않음), "추천"은 `market_price.py`가 검색 결과를 가격만
  남기고 버려서(`search_prices()`) 지어내지 않고는 채울 데이터가 없음. 둘 다 새 데이터 수집/설계가 필요한
  별개 작업.
- `POST/GET /api/v1/listing` — 화면2(분석 확인) 확인/수정된 매물 상세(모델명·연식·사이즈·색상·사용기간·구성품·하자·상품명·가격) upsert/단건 조회, `analysis_id`당 1행 (B, 2026-08-02). `analysis_history`와 분리된 별도 테이블 — Document Parse 파이프라인(AI 최초 추정)과 겹치지 않음, "사람이 확정한 최종본"만 저장. GET은 **2026-08-02 추가** — 처음엔 POST만 만들었다가, 화면2 재오픈/재확인 시나리오가 예상돼 나중에 추가함. `item_id`가 `analysis_history`에 없으면 `404 ITEM_NOT_FOUND`, 있지만 아직 `/listing`으로 저장한 적 없으면(또는 다른 user_id 소유면) `404 LISTING_NOT_FOUND`(신규 코드, 둘을 구분해야 프론트가 "잘못된 id"와 "아직 확인 안 함"을 다르게 처리 가능). **여전히 의도적으로 안 만든 것**: DELETE(재확인은 POST 재호출로 덮어씀, 유스케이스 없음), user의 전체 저장 목록 조회. `/history`·`/bookmark`·`/comparison`·`/mypage` 등 목록 화면에는 여전히 반영 안 됨(그 화면들은 `analysis_history` 원본만 보여줌) — 필요해지면 별도 논의.

⚠️ **프론트 연동 전제**: 현재 화면2(`analysis-confirm-sheet.tsx`)는 `/analyze` 호출 **이전**에 뜨고 100% mock 데이터(`getRecentListings()`)로 채워진다. `/listing`은 이미 존재하는 `item_id`(=`/analyze`가 만든 `analysis_history` PK)에 종속되므로, 실제로 연결하려면 프론트가 흐름을 "URL/이미지 제출 → `/analyze` 호출 → 그 결과로 화면2 표시 → 확인 시 `/listing` 저장"으로 재배치해야 한다 — 프론트팀 확인 필요.

테스트 `backend/tests/test_service_endpoints.py` (31개, `/listing` 10개·`/transaction` 10개 포함) 참고.

### 2026-08-02 확장 (프론트 요구사항 문서 반영 — A·B 공동)

**핵심 정책 변경 — 사용자 수정값의 전면 반영 (P0-1)**: `/listing`으로 저장한 수정값(제목·가격·하자)이
이제 `/history`·`/bookmark`·`/comparison`·`/compare`·`/transaction`·`/mypage` 응답에 **우선 적용**된다.
방식은 조회 시 LEFT JOIN (원본 `analysis_history`는 절대 덮어쓰지 않음 — AI 원본과 사용자 확정본 분리 보존).
listing_details 행이 존재하면 defects 배열은 빈 배열이어도 사용자 확정값으로 존중한다.

**신규 엔드포인트**:
- `GET /api/v1/analysis/{item_id}?user_id=` — 분석 단건 상세 (P0-2). 로컬 캐시 없이 상세 화면 복원용.
  **소유권 검증**: 남의 item_id는 존재 여부도 노출하지 않고 404 `ITEM_NOT_FOUND`. `listing_details` 포함(없으면 null).
- `DELETE /api/v1/analysis/{item_id}?user_id=` — 분석 기록 삭제 (P1-7). **soft delete**(`deleted_at` 컬럼,
  기존 DB는 init_db가 자동 마이그레이션) — 모든 조회가 `deleted_at IS NULL` 필터라 찜/비교/거래 목록에서도 함께 사라짐.
- `POST /api/v1/price-proposal` `{user_id, item_id}` — 가격 제안 (A). `{target_price, negotiation_range{min,max},
  reasons[], message}`. **시세 표본 부족(실측 실패·구버전 기록)이거나 이미 시세 이하면 target_price=null** (임의 숫자 금지).
- `POST/GET /api/v1/comparison-history`, `GET/DELETE /api/v1/comparison-history/{id}` — 실행된 비교 기록 (P1-6).
  비교 당시 제목·가격·점수를 **snapshot으로 보존** (이후 수정·삭제와 무관). `POST /compare`도 실행 시 자동 저장하고
  응답에 `comparison_id`를 additive로 포함.

**응답 형태 확장 (전부 additive — 기존 필드 유지)**:
- `/analyze`: + `market_price{min,average,max,sample_count,calculated_at,confidence}` (시세 신뢰도 판단 근거,
  실측 실패 시 min/max/confidence null) · `platform`·`thumbnail_url`·`location` (수집 못 하면 null — 지어내지 않음)
- `/checklist`: + `groups[]` — `BEFORE_TRADE`/`ON_SITE`/`BEFORE_PAYMENT` 3그룹, 항목 `{id,text,reason,required}`.
  카테고리(폰/노트북/패션…)별로 다른 항목 생성. 기존 `checklist[]`는 groups 평탄화본으로 유지.
- `/inquiry-script`: + `questions[]` `{id,text,reason,category(CONDITION|COMPONENTS|AUTHENTICITY|TRADE)}` +
  `combined_script`. 설명에 이미 있는 정보는 묻지 않고, **없는 정보만 질문으로 전환**. 기존 `script` 유지.
- `/history` 아이템: + `platform`·`thumbnail_url`·`location` (null 가능)
- `/bookmark` 아이템: + `source_url`·`bookmarked_at` · `/comparison` 아이템: + `source_url`·`comparison_added_at`

생성 로직은 `app/advisor.py` (규칙 기반·결정론적, LLM 재호출 없음). 테스트 85개 (`test_advisor.py`·`test_p0_endpoints.py` 추가).

**인증 (P0-3, 2026-08-02 추가)** — 하이브리드 방식 (`app/auth.py`, 표준 라이브러리만 사용):
- `POST /api/v1/auth/signup` `{user_id, password, nickname?}` → `{token, expires_at}` (비밀번호 pbkdf2 해시 저장, 기존 id 재사용 전면 금지)
- `POST /api/v1/auth/login` → 동일 응답. 실패는 계정 존재 여부를 숨기고 통일된 401 `LOGIN_FAILED`
- **토큰 제시 시**: 요청의 user_id(query/body)가 토큰 신원과 다르면 403 `AUTH_MISMATCH`, 무효/만료 토큰은 401 `INVALID_TOKEN` — "클라이언트 user_id를 신뢰하지 않기"가 토큰 있는 순간부터 강제됨
- **토큰 없음**: 기존처럼 동작 (프론트 미연동 상태 데모 유지). **`AUTH_REQUIRED=1`** 환경변수로 전면 필수화 (auth·/health 제외) — 실서비스 전환 스위치
- `.env`: `AUTH_SECRET` 반드시 교체 (기본값은 개발용)

**guest 데이터 이전 (P0-4)** — `POST /api/v1/account/migrate-guest` `{guest_user_id}` + **Bearer 토큰 필수**
(계정은 토큰으로만 식별 — body로 계정 지정 불가). 단일 트랜잭션으로 6개 테이블 이전, 멱등(재호출 시 0건),
실계정 이전 시도는 403(탈취 방지), 이전된 guest는 `users.migrated_to` 마킹으로 로그인·재가입·재이전 차단.

### 보안 점검 결과 (2026-08-02, 어드버세리얼 리뷰로 재현·수정)

수정 완료 (전부 실제 재현 후 픽스):
1. **IDOR — 남의 매물 열람** (major): 찜/비교/compare/checklist/inquiry/price-proposal/transaction/listing이
   item의 *존재*만 확인하고 소유자를 확인하지 않아, 로그인 사용자가 남의 `item_id`(순번 정수라 추측 가능)를
   자기 찜에 넣으면 그 사람 분석 원문(제목·가격·source_url·사기경고)이 그대로 노출됐다.
   → `db.user_owns_analysis()` / `get_owned_analysis()` 게이트를 모든 참조 지점에 적용 + `_collection_items`
   JOIN에 `a.user_id = c.user_id` 이중 방어. **남의 것은 404(존재 여부도 비노출)로 통일.**
   ⚠️ 부수효과: 남의 매물 `GET /listing`이 `LISTING_NOT_FOUND` → `ITEM_NOT_FOUND`로 바뀜 (의도된 변경).
2. **AUTH_SECRET 빈 값 함정** (major): `.env.example`을 그대로 복사하면 `AUTH_SECRET=`(빈 문자열)이 되어
   `os.getenv(k, default)`가 기본값으로 폴백하지 않아 **서명키가 빈 문자열** → 누구나 토큰 위조·계정 탈취.
   → `os.getenv(...) or 폴백`으로 변경 + `AUTH_REQUIRED=1`인데 시크릿이 비면 **기동 거부**.
3. **SSRF** (major, 배포 시 치명): `/analyze`가 사용자가 준 URL을 서버가 대신 요청하는데 내부망 차단이
   없어, `http://127.0.0.1:.../` 나 `http://169.254.169.254/`(클라우드 메타데이터=서버 자격증명)를
   긁어 응답에 담아줬다 (실측 재현). → `scraper.is_public_url()`로 스킴 검사 + DNS 조회 후
   사설/루프백/링크로컬 IP 거부, **리다이렉트 매 홉 재검사**(외부→내부 우회 차단).
4. **migrate_guest UNIQUE 충돌 → 불투명한 500** (minor): 이제 409 `MIGRATE_CONFLICT`로 변환.

**알려진 잔여 리스크 (MVP 범위 밖 — 본선/실서비스 전 검토)**:
- 로그인 시도 횟수 제한(브루트포스) 없음 — pbkdf2 20만회가 시도당 ~0.1초 비용을 강제해 완화되지만 제한은 아님
- 토큰 취소(로그아웃/무효화) 없음 — stateless 서명 토큰이라 발급 후 7일간 유효
- DNS 리바인딩(검사 시점과 실제 접속 시점의 IP가 바뀌는 공격)은 방어 안 함
- CORS `allow_origins=["*"]` — 토큰이 헤더 방식이라 브라우저가 자동 첨부하진 않으나 배포 시 도메인 제한 권장

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

로컬 파일 `backend/resale_guard.db` (gitignore).
FK 제약은 `PRAGMA foreign_keys=ON`으로 실제 적용됨 (2026-07-31 수정 — 이전엔 선언만 되고 sqlite3 기본값 때문에 무시되고 있었음).

### SQLite ↔ Postgres(Supabase) 이중 백엔드 (2026-08-02)

`backend/app/db.py`가 `DATABASE_URL` 환경변수 유무로 자동 분기한다 — 없으면 지금처럼 SQLite(로컬 개발·
테스트, **무변경**), 있으면 Postgres(psycopg2). 배포(Render 등)는 이번 스코프에 포함 안 함 — DB 계층만.

- 스키마 파일 2개: `backend/app/schema.sql`(SQLite, 기존) / `backend/app/schema_postgres.sql`(신규,
  차이는 `AUTOINCREMENT` → `BIGSERIAL`뿐). `raw_analysis_json`/`components_json`/`defects_json`은
  Postgres에서도 **JSONB가 아니라 TEXT 유지** — 기존 `json.dumps`/`json.loads` 수동 관리와 psycopg2의
  JSONB 자동 adapt가 충돌하지 않게 하려는 의도적 선택 (이전에 이 문서에 "JSONB로 바꾸면 된다"고 적혀
  있던 건 이제 틀린 내용 — TEXT 유지로 확정).
  헬퍼 3개(`_is_postgres()`, `_execute()`, `_iso_z()`)만 추가해 `?`→`%s` 변환·타임스탬프
  문자열/datetime 차이를 흡수 — SQLite 3.35+/Postgres 공통으로 `RETURNING`과
  `ON CONFLICT ... DO NOTHING`/`DO UPDATE`를 쓰므로 `.lastrowid`·`INSERT OR IGNORE` 같은 진짜
  SQLite 전용 구문만 걷어냈다.
- 테스트는 `client` fixture가 `monkeypatch.delenv("DATABASE_URL", raising=False)`로 항상 SQLite를
  쓰도록 강제 — 로컬 `.env`에 실제 Supabase `DATABASE_URL`을 넣어놔도 `pytest`는 안 새어나감. 54개
  전부 무변경으로 통과 확인.
- ⚠️ **아직 실제 Supabase로 검증 안 됨**: `init_db()`가 `schema_postgres.sql` 전체를 파라미터 없는
  `cur.execute()` 한 번으로 실행하는데(psycopg2/libpq의 simple query protocol이 세미콜론 구분 다중
  문장을 지원한다는 전제), 실제 네트워크 인스턴스로 스모크 테스트 전까지는 리스크로 남아있음. 실패하면
  세미콜론 split 후 순차 실행으로 바꾸면 됨(구현 난이도 낮음).
- ⚠️ **연결 풀링**: 코드 레벨 풀링은 이번에 안 넣음(해커톤 트래픽엔 불필요) — 대신 실제 `DATABASE_URL`을
  넣을 때 Supabase의 direct connection(5432)이 아니라 **PgBouncer 풀러 URL(6543, `?pgbouncer=true`)**을
  쓰는 걸 권장. `.env.example` 참고.

### 미확정 / 논의 필요

- 화면2 흐름 순서 — 위 "Backend B 엔드포인트" 절의 `/listing` 프론트 연동 전제 참고

### Git 작업
- 에이전트는 `git commit`, `git push`를 스스로 판단해서 실행하지 않는다
- 커밋/푸시가 필요하다고 판단되면 사람에게 먼저 제안하고, 명시적으로 지시받았을 때만 실행한다

## 참고

- Analysis History, Product Rules, Scam Patterns, Checklist Templates 중 Product Rules·Scam Patterns·Checklist Templates는 Backend A 소관 (Rule Engine·체크리스트 생성 로직 참조용)
- Analysis History는 Backend B 소관
