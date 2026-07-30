# Backend A — AI 분석 API (이가격 맞아요?)

중고 매물 URL 입력 → 시세비교 + AI 사기 위험분석 + 신뢰도 점수.

**현재 상태**: 응답 스키마 확정 + DB 저장/조회 동작. 분석 내용만 mock (실제 스크래핑·Rule Engine으로 순차 교체 예정, 스키마는 안 바뀜).
**→ 프론트/Backend B는 아래 스키마 기준으로 바로 개발 시작 가능.**

## 실행

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

- Swagger 문서: http://localhost:8000/docs
- 상태 확인: `GET /health`
- DB: SQLite (`backend/resale_guard.db`, 자동 생성) — Supabase 전환 전 로컬용

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

## mock 조작법 (프론트 UI 상태별 테스트용)

`POST /analyze`의 `url` 문자열에 아래 단어를 포함시키면 원하는 상태를 강제할 수 있다:

| url에 포함된 단어 | 결과 |
|---|---|
| `fail` | 400 `SCRAPE_FAILED` 에러 |
| `danger` | DANGER 매물 (trust_score 18, 경고 4건) |
| `warning` | WARNING 매물 (trust_score 55) |
| (그 외 전부) | SAFE 매물 (trust_score 82) |

analyze 할 때마다 DB에 저장되고 `item_id`가 1씩 증가한다. history/compare/checklist/inquiry-script는 **본인이 analyze한 item_id**로 호출할 것.

## DB 테이블 (3개)

- `users(id TEXT PK, created_at)` — user_id는 프론트가 보내는 문자열 (인증 없음)
- `analysis_history(id, user_id, source_url, title, price, trust_score, risk_level, raw_analysis_json, created_at)` — 분석결과 통째로 JSON 저장
- `bookmarks(id, user_id, analysis_id, created_at)` — UNIQUE(user_id, analysis_id)

## 개발 로드맵 (Backend A)

- [x] STEP 1: mock 서버 + 스키마 확정 + /docs
- [x] STEP 2: DB 3테이블 + 저장/조회 연동
- [ ] STEP 3: URL 파싱 (플랫폼 판별, 실패 시 fallback)
- [ ] STEP 4: 시세 함수 (trimmed mean, 실패 시 FALLBACK_PRICES)
- [ ] STEP 5: Rule Engine (trust_score / risk_level 산출)
- [ ] STEP 6: /analyze 통합 (+ Upstage/Solar 리포트 연동)
- [ ] STEP 7: 나머지 API는 저장 데이터 재활용 (LLM 재호출 금지)
