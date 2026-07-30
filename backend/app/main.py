"""이가격 맞아요? — AI 분석 API (Backend A) — STEP 2: DB 연동 (분석은 mock).

실행:  cd backend && uvicorn app.main:app --reload --port 8000
문서:  http://localhost:8000/docs

mock 동작 규칙 (프론트 참고, STEP 3~5에서 실제 로직으로 교체 예정):
- POST /analyze 의 url 에 "fail"   이 들어있으면 → 400 SCRAPE_FAILED (에러 UI 테스트용)
- POST /analyze 의 url 에 "danger" 가 들어있으면 → DANGER 매물 반환
- POST /analyze 의 url 에 "warning" 이 들어있으면 → WARNING 매물 반환
- 그 외 모든 url → SAFE 매물 반환

analyze() 결과는 SQLite(backend/resale_guard.db)에 저장되고, history/compare/
checklist/inquiry-script 는 전부 이 저장된 데이터를 재사용한다 (LLM 재호출 없음).
"""
from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import db, mock_data
from app.schemas import (
    AnalyzeRequest,
    AnalyzeSuccess,
    ChecklistRequest,
    ChecklistSuccess,
    CompareRequest,
    CompareSuccess,
    ErrorBody,
    ErrorResponse,
    HistorySuccess,
    InquiryScriptRequest,
    InquiryScriptSuccess,
)

app = FastAPI(
    title="이가격 맞아요? API",
    version="0.2.0",
    description="중고 매물 URL 입력 → 시세비교 + AI 사기 위험분석 + 신뢰도 점수. "
    "현재 분석 결과는 mock — 응답 스키마는 최종본과 동일 (프론트 개발 기준으로 사용).",
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
    if "fail" in url:
        return error(400, "SCRAPE_FAILED", "매물 페이지를 불러오지 못했습니다. URL을 확인해주세요.")
    if "danger" in url:
        base = mock_data.ANALYSES[3]
    elif "warning" in url:
        base = mock_data.ANALYSES[2]
    else:
        base = mock_data.ANALYSES[1]

    # item_id 는 DB auto-increment 값으로 교체 (STEP 3~5 실제 로직에서도 동일하게 저장/반환)
    analysis_id = db.save_analysis(req.user_id, req.url, base)
    return success({**base, "item_id": analysis_id})


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


@app.get("/health", tags=["meta"], summary="상태 확인")
def health():
    return {"ok": True, "data": {"status": "alive", "step": 2}, "error": None}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
