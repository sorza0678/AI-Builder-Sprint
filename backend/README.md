# Backend A — AI 분석 API (이가격 맞아요?)

중고 매물 URL 입력 → 시세비교 + AI 사기 위험분석 + 신뢰도 점수.

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

## 실행

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

- Swagger 문서: http://localhost:8000/docs
- 상태 확인: `GET /health` (→ `upstage_key`로 Solar 연동 여부 확인)
- DB: SQLite (`backend/resale_guard.db`, 자동 생성) — Supabase 전환 전 로컬용
- Upstage 연동(선택): `cp .env.example .env` 후 `UPSTAGE_API_KEY` 입력 — 없어도 Rule Engine만으로 전부 동작
- 테스트: `.venv/bin/python -m pytest tests/ -q`

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
| `VALIDATION_ERROR` | 422 | 요청 형식 오류 (필수 필드 누락, item_ids 개수 위반 등) |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |

## 엔드포인트

### POST `/api/v1/analyze` — 매물 URL 분석 ★핵심

요청:
```json
{ "user_id": "demo-user-1", "url": "https://www.daangn.com/articles/123456" }
```

성공 200 — **`data` 스키마 (확정, 프론트 화면4·B /listing 이 여기 의존)**:
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

- `item_id`: **DB analysis_history의 PK** — 이후 모든 API(compare/checklist/inquiry-script)에서 이 값 사용
- `trust_score`: 0~100 정수 (Rule Engine 계산, LLM 아님 — 재현성 보장)
- `risk_level`: `"SAFE" | "WARNING" | "DANGER"`
- `scam_warnings`: 문자열 배열 — SAFE면 보통 `[]`, WARNING/DANGER에서 채워짐

실패 400:
```json
{ "ok": false, "data": null, "error": { "code": "SCRAPE_FAILED", "message": "매물 페이지를 불러오지 못했습니다. URL을 확인해주세요." } }
```

### GET `/api/v1/history?user_id=&page=1&size=10` — 분석 히스토리 (최신순)

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

## 데모/테스트용 강제 트리거

기본적으로 **모든 URL은 실제 분석 파이프라인**을 탄다 (번개장터 URL이 가장 잘 됨).
프론트가 UI 상태별로 테스트하고 싶을 때만 `url`에 아래 단어를 포함:

| url에 포함된 단어 | 결과 |
|---|---|
| `fail` | 400 `SCRAPE_FAILED` 에러 (에러 UI 테스트) |
| `danger` | 고정 DANGER 매물 (trust_score 18, 경고 4건) |
| `warning` | 고정 WARNING 매물 (trust_score 55) |
| `mock-safe` | 고정 SAFE 매물 (trust_score 82) |

analyze 할 때마다 DB에 저장되고 `item_id`가 1씩 증가한다. history/compare/checklist/inquiry-script는 **본인이 analyze한 item_id**로 호출할 것.

## DB 테이블 (3개)

- `users(id TEXT PK, created_at)` — user_id는 프론트가 보내는 문자열 (인증 없음)
- `analysis_history(id, user_id, source_url, title, price, trust_score, risk_level, raw_analysis_json, created_at)` — 분석결과 통째로 JSON 저장
- `bookmarks(id, user_id, analysis_id, created_at)` — UNIQUE(user_id, analysis_id)

## 개발 로드맵 (Backend A)

- [x] STEP 1: mock 서버 + 스키마 확정 + /docs
- [x] STEP 2: DB 3테이블 + 저장/조회 연동
- [x] STEP 3: URL 파싱 — `scraper.py` (플랫폼 판별·번개장터 API·og태그, 실패 시 fallback)
- [x] STEP 4: 시세 함수 — `market_price.py` (번개장터 검색, 잡음 필터, trimmed mean, FALLBACK_PRICES)
- [x] STEP 5: Rule Engine — `rule_engine.py` (시세비율·사기문구·판매자 신호 → 점수. 유닛테스트 12개)
- [x] STEP 6: /analyze 통합 — `ai_report.py` (Upstage Solar 보강, 키 없으면 스킵) + DB 저장
- [x] STEP 7: 나머지 API는 저장 데이터 재활용 (LLM 재호출 금지)

- [x] STEP 8: 당근마켓/중고나라 스크래핑 정확도 개선 — JSON-LD 파싱 추가, `cafe.naver.com` 미지원 확인 및 정직한 실패 처리, `analyze()`가 `scrape_ok` 반영하도록 수정 (2026-08-01)

남은 것: Supabase 전환(선택), 배포. (`cafe.naver.com` 실제 지원은 비공식 네이버 카페 API 연동이 필요 — 보류)
