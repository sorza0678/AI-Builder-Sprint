"""이가격 맞아요? — AI 분석 API (Backend A) — STEP 6: 실제 분석 파이프라인.

실행:  cd backend && uvicorn app.main:app --reload --port 8000
문서:  http://localhost:8000/docs

/analyze 파이프라인: scraper(수집·fallback) → market_price(시세) →
rule_engine(점수, 결정론적) → ai_report(Solar LLM 보강, 키 없으면 스킵) → DB 저장.
history/compare/checklist/inquiry-script 는 저장된 데이터만 재사용 (LLM 재호출 없음).

데모/프론트 테스트용 강제 트리거 (url 에 해당 단어 포함 시 실제 분석 대신 고정 응답):
- "fail" → 400 SCRAPE_FAILED  ·  "danger" → DANGER  ·  "warning" → WARNING  ·  "mock-safe" → SAFE
"""
from dotenv import load_dotenv

load_dotenv()  # ai_report 등이 읽는 UPSTAGE_API_KEY 를 backend/.env 에서 로드

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import ai_report, db, market_price, mock_data, rule_engine, scraper
from app.schemas import (
    AnalyzeRequest,
    AnalyzeSuccess,
    BookmarkListSuccess,
    BookmarkRemoveSuccess,
    BookmarkRequest,
    BookmarkSuccess,
    ChecklistRequest,
    ChecklistSuccess,
    ComparisonAddRequest,
    ComparisonAddSuccess,
    ComparisonListSuccess,
    ComparisonRemoveSuccess,
    CompareRequest,
    CompareSuccess,
    ErrorBody,
    ErrorResponse,
    HistorySuccess,
    InquiryScriptRequest,
    InquiryScriptSuccess,
    ListingRequest,
    ListingSuccess,
    MyPageSuccess,
    TransactionListSuccess,
    TransactionRequest,
    TransactionStatusEnum,
    TransactionSuccess,
)

app = FastAPI(
    title="이가격 맞아요? API",
    version="0.2.0",
    description="중고 매물 URL 입력 → 시세비교 + AI 사기 위험분석 + 신뢰도 점수. "
    "실제 분석 파이프라인 동작 (모든 외부호출 fallback — 데모 안죽음). "
    "테스트 트리거: url에 fail/danger/warning/mock-safe 포함 시 고정 응답.",
)

# 예외 → 팀 공통 500 envelope. CORS보다 "먼저" 등록해야 CORS가 바깥에 감싸져서
# 브라우저가 500 에러 바디를 읽을 수 있다 (전역 exception_handler는 CORS 밖이라 못 읽음).
@app.middleware("http")
async def error_envelope_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "data": None,
                "error": {"code": "INTERNAL_ERROR", "message": "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."},
            },
        )


# 해커톤용 — 프론트 오리진 제한 없음
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    db.init_db()


def error(status_code: int, code: str, message: str) -> JSONResponse:
    body = ErrorResponse(error=ErrorBody(code=code, message=message))
    return JSONResponse(status_code=status_code, content=body.model_dump())


# 팀 컨벤션: 모든 응답은 {ok, data, error} 형식 — FastAPI 기본 422/500 응답도 변환한다
@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    detail = "; ".join(
        f"{'.'.join(str(l) for l in e['loc'])}: {e['msg']}" for e in exc.errors()
    )
    return error(422, "VALIDATION_ERROR", f"요청 형식이 잘못되었습니다 — {detail}")


@app.exception_handler(Exception)
async def internal_error_handler(request: Request, exc: Exception):
    return error(500, "INTERNAL_ERROR", "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")


def success(data) -> dict:
    return {"ok": True, "data": data, "error": None}


@app.post(
    "/api/v1/analyze",
    response_model=AnalyzeSuccess,
    responses={400: {"model": ErrorResponse}},
    tags=["analyze"],
    summary="매물 URL 분석 (핵심 시나리오)",
)
def analyze(req: AnalyzeRequest):
    url = req.url.lower()

    # --- 데모/프론트 테스트용 강제 트리거 (실제 분석 우회) ---
    if "fail" in url:
        return error(400, "SCRAPE_FAILED", "매물 페이지를 불러오지 못했습니다. URL을 확인해주세요.")
    mock_trigger = {"danger": 3, "warning": 2, "mock-safe": 1}
    for word, mock_id in mock_trigger.items():
        if word in url:
            base = mock_data.ANALYSES[mock_id]
            analysis_id = db.save_analysis(req.user_id, req.url, base)
            return success({**base, "item_id": analysis_id})

    # --- 실제 파이프라인: 수집 → 시세 → Rule Engine → AI 보강 → 저장 ---
    listing = scraper.scrape_listing(req.url)
    if not listing["scrape_ok"]:
        return error(400, "SCRAPE_FAILED", "매물 페이지를 불러오지 못했습니다. URL을 확인해주세요.")

    avg, measured = market_price.get_market_price(listing["title"], listing["price"])
    verdict = rule_engine.evaluate(listing, avg, measured)
    verdict = ai_report.merge_report(verdict, ai_report.get_ai_report(listing))

    data = {
        "item_id": 0,  # save_analysis 가 DB PK 로 교체
        "title": listing["title"],
        "price": listing["price"] or 0,
        "market_price_avg": avg,
        **verdict,
    }
    analysis_id = db.save_analysis(req.user_id, req.url, data)
    return success({**data, "item_id": analysis_id})


@app.get(
    "/api/v1/history",
    response_model=HistorySuccess,
    tags=["history"],
    summary="유저의 분석 히스토리 (최신순)",
)
def history(
    user_id: str = Query(examples=["demo-user-1"]),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=50),
):
    items, total = db.get_history(user_id, page, size)
    return success({"items": items, "page": page, "size": size, "total": total})


@app.post(
    "/api/v1/compare",
    response_model=CompareSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["compare"],
    summary="저장된 매물 2~3개 비교",
)
def compare(req: CompareRequest):
    items = db.get_multiple_analyses(req.item_ids)
    found_ids = {i["item_id"] for i in items}
    missing = [i for i in req.item_ids if i not in found_ids]
    if missing:
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {missing}")
    best = max(items, key=lambda x: x["trust_score"])
    return success(
        {
            "items": items,
            "recommendation": f"'{best['title']}' 매물이 신뢰도 {best['trust_score']}점으로 가장 안전합니다.",
        }
    )


@app.post(
    "/api/v1/checklist",
    response_model=ChecklistSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["follow-up"],
    summary="현장 확인 체크리스트 생성",
)
def checklist(req: ChecklistRequest):
    analysis = db.get_analysis_by_id(req.item_id)
    if not analysis:
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {req.item_id}")
    return success({"item_id": req.item_id, "checklist": mock_data.build_checklist(analysis)})


@app.post(
    "/api/v1/inquiry-script",
    response_model=InquiryScriptSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["follow-up"],
    summary="판매자 문의 메시지 생성",
)
def inquiry_script(req: InquiryScriptRequest):
    analysis = db.get_analysis_by_id(req.item_id)
    if not analysis:
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {req.item_id}")
    return success({"item_id": req.item_id, "script": mock_data.build_inquiry_script(analysis)})


@app.post(
    "/api/v1/transaction",
    response_model=TransactionSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["transaction"],
    summary="거래 상태 등록/변경 (화면5 구매 결정 저장)",
)
def set_transaction(req: TransactionRequest):
    if not db.get_analysis_by_id(req.item_id):
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {req.item_id}")
    updated_at = db.set_transaction_status(req.user_id, req.item_id, req.status)
    return success({"item_id": req.item_id, "status": req.status, "updated_at": updated_at})


@app.get(
    "/api/v1/transaction",
    response_model=TransactionListSuccess,
    tags=["transaction"],
    summary="거래 상태 목록 조회 (status 생략 시 전체)",
)
def list_transactions(
    user_id: str = Query(examples=["demo-user-1"]),
    status: TransactionStatusEnum | None = Query(None),
):
    items = db.get_transactions(user_id, status)
    return success({"items": items, "total": len(items)})


@app.post(
    "/api/v1/comparison",
    response_model=ComparisonAddSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["comparison"],
    summary="비교 후보 추가",
)
def add_comparison(req: ComparisonAddRequest):
    if not db.get_analysis_by_id(req.item_id):
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {req.item_id}")
    added = db.add_comparison_item(req.user_id, req.item_id)
    return success({"item_id": req.item_id, "added": added})


@app.delete(
    "/api/v1/comparison",
    response_model=ComparisonRemoveSuccess,
    tags=["comparison"],
    summary="비교 후보 제거",
)
def remove_comparison(
    user_id: str = Query(examples=["demo-user-1"]),
    item_id: int = Query(examples=[1]),
):
    removed = db.remove_comparison_item(user_id, item_id)
    return success({"item_id": item_id, "removed": removed})


@app.get(
    "/api/v1/comparison",
    response_model=ComparisonListSuccess,
    tags=["comparison"],
    summary="비교 후보 목록 조회",
)
def list_comparison(user_id: str = Query(examples=["demo-user-1"])):
    items = db.get_comparison_items(user_id)
    return success({"items": items, "total": len(items)})


@app.post(
    "/api/v1/bookmark",
    response_model=BookmarkSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["bookmark"],
    summary="찜 추가",
)
def add_bookmark(req: BookmarkRequest):
    if not db.get_analysis_by_id(req.item_id):
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {req.item_id}")
    bookmarked = db.bookmark(req.user_id, req.item_id)
    return success({"item_id": req.item_id, "bookmarked": bookmarked})


@app.delete(
    "/api/v1/bookmark",
    response_model=BookmarkRemoveSuccess,
    tags=["bookmark"],
    summary="찜 제거",
)
def remove_bookmark(
    user_id: str = Query(examples=["demo-user-1"]),
    item_id: int = Query(examples=[1]),
):
    removed = db.unbookmark(user_id, item_id)
    return success({"item_id": item_id, "removed": removed})


@app.get(
    "/api/v1/bookmark",
    response_model=BookmarkListSuccess,
    tags=["bookmark"],
    summary="찜 목록 조회",
)
def list_bookmarks(user_id: str = Query(examples=["demo-user-1"])):
    items = db.get_bookmarks(user_id)
    return success({"items": items, "total": len(items)})


@app.post(
    "/api/v1/listing",
    response_model=ListingSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["listing"],
    summary="화면2 확인된 매물 상세 저장 (upsert)",
)
def upsert_listing(req: ListingRequest):
    if not db.get_analysis_by_id(req.item_id):
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {req.item_id}")
    updated_at = db.upsert_listing_details(
        req.user_id,
        req.item_id,
        req.title,
        req.price,
        req.model_name,
        req.year,
        req.size_or_capacity,
        req.color,
        req.usage_period,
        req.components,
        req.defects,
    )
    return success({**req.model_dump(exclude={"user_id"}), "updated_at": updated_at})


@app.get(
    "/api/v1/mypage",
    response_model=MyPageSuccess,
    tags=["mypage"],
    summary="마이페이지 상단 요약",
)
def mypage(user_id: str = Query(examples=["demo-user-1"])):
    return success(db.get_mypage_summary(user_id))


@app.get("/health", tags=["meta"], summary="상태 확인")
def health():
    import os

    return {
        "ok": True,
        "data": {"status": "alive", "step": 6, "upstage_key": bool(os.getenv("UPSTAGE_API_KEY"))},
        "error": None,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
