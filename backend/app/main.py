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

import logging
import os

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import (
    advisor,
    ai_report,
    auth,
    db,
    market_price,
    mock_data,
    rule_engine,
    scraper,
)
from app.schemas import (
    AnalysisDeleteSuccess,
    AnalysisDetailSuccess,
    AnalyzeRequest,
    AnalyzeSuccess,
    AuthSuccess,
    BookmarkListSuccess,
    BookmarkRemoveSuccess,
    BookmarkRequest,
    BookmarkSuccess,
    ChecklistRequest,
    ChecklistStateRequest,
    ChecklistStateSuccess,
    ChecklistSuccess,
    CompareRequest,
    CompareSuccess,
    ComparisonAddRequest,
    ComparisonAddSuccess,
    ComparisonHistoryDeleteSuccess,
    ComparisonHistoryListSuccess,
    ComparisonHistoryRequest,
    ComparisonHistorySuccess,
    ComparisonListSuccess,
    ComparisonRemoveSuccess,
    ErrorBody,
    ErrorResponse,
    HistorySuccess,
    InquiryScriptRequest,
    InquiryScriptSuccess,
    ListingRequest,
    ListingSuccess,
    LoginRequest,
    MigrateGuestRequest,
    MigrateGuestSuccess,
    MyPageSuccess,
    PriceProposalRequest,
    PriceProposalSuccess,
    RecommendationSuccess,
    SignupRequest,
    TransactionDecisionEnum,
    TransactionListSuccess,
    TransactionRequest,
    TransactionStageEnum,
    TransactionSuccess,
)

# 로깅 — 외부 호출 실패는 전부 fallback 으로 삼켜지므로, 로그가 없으면
# 데모 중 "왜 분석이 이상하죠?" 에 답할 방법이 없다. LOG_LEVEL 로 조절.
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
)
logger = logging.getLogger("app")


# ---------- 인증 (P0-3): 하이브리드 신원 강제 ----------
# - Bearer 토큰 제시 시: 토큰의 user_id 만 신뢰. 요청(query/body)의 user_id 가 다르면 403.
# - 토큰 없음: 기존처럼 요청의 user_id 사용 (프론트가 아직 토큰 미연동 — 데모 유지).
# - AUTH_REQUIRED=1 환경변수: /api/v1/* (auth 제외) 전체에 토큰 필수 (실서비스 모드).
async def enforce_auth(request: Request):
    header = request.headers.get("authorization")
    if header:
        if not header.lower().startswith("bearer "):
            raise HTTPException(401, {"code": "INVALID_TOKEN", "message": "Authorization 헤더는 'Bearer <token>' 형식이어야 합니다."})
        token_uid = auth.verify_token(header[7:].strip())
        if not token_uid:
            raise HTTPException(401, {"code": "INVALID_TOKEN", "message": "토큰이 유효하지 않거나 만료되었습니다. 다시 로그인해주세요."})
        request.state.auth_user_id = token_uid
        # 요청이 주장하는 user_id 와 토큰 신원 대조 — 다르면 남의 데이터 접근 시도
        claimed = request.query_params.get("user_id")
        if claimed is None and request.method in ("POST", "PUT", "PATCH") and \
                request.headers.get("content-type", "").startswith("application/json"):
            try:
                body = await request.json()  # Starlette이 body를 캐시하므로 엔드포인트 파싱과 충돌 없음
                claimed = body.get("user_id") if isinstance(body, dict) else None
            except Exception:
                claimed = None
        if claimed and claimed != token_uid:
            raise HTTPException(403, {"code": "AUTH_MISMATCH", "message": "요청의 user_id가 로그인한 사용자와 다릅니다."})
    else:
        request.state.auth_user_id = None
        path = request.url.path
        if (
            os.getenv("AUTH_REQUIRED")
            and path.startswith("/api/v1/")
            and not path.startswith("/api/v1/auth/")
        ):
            raise HTTPException(401, {"code": "AUTH_REQUIRED", "message": "로그인이 필요합니다."})


def require_login(request: Request) -> str:
    """토큰이 필수인 엔드포인트용 — 인증된 user_id 반환, 없으면 401."""
    uid = getattr(request.state, "auth_user_id", None)
    if not uid:
        raise HTTPException(401, {"code": "AUTH_REQUIRED", "message": "이 API는 로그인(Bearer 토큰)이 필요합니다."})
    return uid


app = FastAPI(
    title="이가격 맞아요? API",
    version="0.2.0",
    dependencies=[Depends(enforce_auth)],
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
    # 실서비스 모드(AUTH_REQUIRED=1)인데 서명키가 없으면 기동 거부 —
    # 개발용 폴백 키로 운영하면 누구나 남의 토큰을 위조할 수 있다 (설정 실수를 조용히 넘기지 않는다).
    if os.getenv("AUTH_REQUIRED") and not auth.secret_is_configured():
        raise RuntimeError(
            "AUTH_REQUIRED=1 인데 AUTH_SECRET 이 비어 있습니다. "
            ".env 에 무작위 문자열을 넣어주세요 (예: python3 -c \"import secrets;print(secrets.token_hex(32))\")."
        )
    db.init_db()


def error(status_code: int, code: str, message: str) -> JSONResponse:
    body = ErrorResponse(error=ErrorBody(code=code, message=message))
    return JSONResponse(status_code=status_code, content=body.model_dump())


# 팀 컨벤션: 모든 응답은 {ok, data, error} 형식 — HTTPException(401/403/404/405 등)도 변환
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        return error(exc.status_code, exc.detail["code"], exc.detail.get("message", ""))
    return error(exc.status_code, "HTTP_ERROR", str(exc.detail))


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


def _run_comparison(user_id: str, item_ids: list[int]) -> tuple[list[dict], str, int] | None:
    """비교 실행 공통 로직 (compare·comparison-history 공유).

    소유한 매물만 조회 → 하나라도 없으면(=남의 것/삭제됨) None(호출부에서 404).
    성공 시 (items, recommendation, comparison_id) 반환하며 비교 기록도 저장한다.
    """
    items = db.get_multiple_analyses(item_ids, user_id=user_id)
    if {i["item_id"] for i in items} != set(item_ids):
        return None
    best = max(items, key=lambda x: x["trust_score"])
    recommendation = f"'{best['title']}' 매물이 신뢰도 {best['trust_score']}점으로 가장 안전합니다."
    snapshot = [
        {k: item[k] for k in ("item_id", "title", "price", "trust_score", "risk_level")}
        for item in items
    ]
    comparison_id = db.save_comparison_history(user_id, item_ids, recommendation, snapshot)
    return items, recommendation, comparison_id


# ---------- 인증 API (Backend B, P0-3·P0-4) ----------

@app.post(
    "/api/v1/auth/signup",
    response_model=AuthSuccess,
    responses={409: {"model": ErrorResponse}},
    tags=["auth"],
    summary="회원가입 — 비밀번호는 pbkdf2 해시로 저장",
)
def signup(req: SignupRequest):
    created = db.create_account(req.user_id, auth.hash_password(req.password), req.nickname)
    if not created:
        # guest 행 포함 어떤 기존 id도 재사용 금지 — 남의 guest 데이터 탈취 방지
        return error(409, "USER_EXISTS", f"이미 사용 중인 user_id: {req.user_id}")
    token, expires_at = auth.create_token(req.user_id)
    return success({"user_id": req.user_id, "nickname": req.nickname, "token": token, "expires_at": expires_at})


@app.post(
    "/api/v1/auth/login",
    response_model=AuthSuccess,
    responses={401: {"model": ErrorResponse}},
    tags=["auth"],
    summary="로그인 — Bearer 토큰 발급 (7일 유효)",
)
def login(req: LoginRequest):
    user = db.get_user_auth(req.user_id)
    # 존재하지 않는 계정과 비밀번호 오류를 같은 메시지로 — 계정 존재 여부 노출 방지
    if (
        not user
        or not user["password_hash"]
        or user["migrated_to"]  # 이전 완료된 guest id 로그인 금지
        or not auth.verify_password(req.password, user["password_hash"])
    ):
        return error(401, "LOGIN_FAILED", "아이디 또는 비밀번호가 올바르지 않습니다.")
    token, expires_at = auth.create_token(req.user_id)
    return success({"user_id": req.user_id, "nickname": user["nickname"], "token": token, "expires_at": expires_at})


@app.post(
    "/api/v1/account/migrate-guest",
    response_model=MigrateGuestSuccess,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
    tags=["auth"],
    summary="비회원(guest) 기록을 로그인 계정으로 이전 (토큰 필수, 멱등)",
)
def migrate_guest(req: MigrateGuestRequest, account_id: str = Depends(require_login)):
    try:
        counts = db.migrate_guest(account_id, req.guest_user_id)
    except db.MigrateError as e:
        status = 403 if e.code == "CANNOT_MIGRATE_ACCOUNT" else 409
        return error(status, e.code, e.message)
    return success({
        "account_user_id": account_id,
        "guest_user_id": req.guest_user_id,
        "migrated": counts,
    })


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

    # exclude_url: 분석 대상 자신이 시세 표본·근거 매물에 섞이지 않게 제외
    market = market_price.get_market_detail(listing["title"], listing["price"], req.url)
    verdict = rule_engine.evaluate(listing, market["average"], market["measured"])
    verdict = ai_report.merge_report(verdict, ai_report.get_ai_report(listing))

    data = {
        "item_id": 0,  # save_analysis 가 DB PK 로 교체
        "title": listing["title"],
        "price": listing["price"] or 0,
        "market_price_avg": market["average"],
        # 시세 상세(min/max/표본수/실측여부) — 프론트가 "평균가의 신뢰도"를 판단할 근거
        "market_price": market,
        # 그 시세를 만든 실제 매물들 — "왜 이 가격인지" 사용자에게 보여줄 근거
        "comparables": market["comparables"],
        # 목록 화면용 매물 기본 정보 — 수집 못 했으면 null (지어내지 않는다)
        "platform": listing.get("platform"),
        "thumbnail_url": listing.get("image"),
        "location": listing.get("location"),
        "posted_at": listing.get("posted_at"),
        "category": listing.get("category"),
        "image_urls": listing.get("image_urls") or [],
        "trade_method": listing.get("trade_method"),
        "seller_description": listing.get("description") or None,
        "seller_profile_url": listing.get("seller_profile_url"),
        # 설명 원문(요약) — 질문 생성·가격 제안이 쓰는 내부 데이터.
        # description/measured 는 응답 스키마(AnalyzeData)에 없어서 API 응답에서는
        # response_model 이 자동으로 걸러낸다 (DB raw JSON에만 남음).
        "description": (listing.get("description") or "")[:600],
        **verdict,
    }
    analysis_id = db.save_analysis(req.user_id, req.url, data)
    return success({**data, "item_id": analysis_id})


@app.post(
    "/api/v1/compare",
    response_model=CompareSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["compare"],
    summary="저장된 매물 2~3개 비교",
)
def compare(req: CompareRequest):
    # 소유한 매물만 비교 (남의 item_id 섞으면 404) + 화면2 수정값 반영 + 비교 기록 저장
    result = _run_comparison(req.user_id, req.item_ids)
    if result is None:
        return error(404, "ITEM_NOT_FOUND", "본인 분석 내역에 없는 item_id가 포함되어 있습니다.")
    items, recommendation, comparison_id = result
    return success(
        {"items": items, "recommendation": recommendation, "comparison_id": comparison_id}
    )


@app.post(
    "/api/v1/checklist",
    response_model=ChecklistSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["follow-up"],
    summary="현장 확인 체크리스트 생성",
)
def checklist(req: ChecklistRequest):
    analysis = db.get_owned_analysis(req.user_id, req.item_id)  # 소유권 검증 포함
    if not analysis:
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {req.item_id}")
    listing = db.get_listing_details(req.user_id, req.item_id)  # 사용자 수정값 (없으면 None)
    groups = advisor.build_checklist_groups(analysis, listing)
    return success(
        {
            "item_id": req.item_id,
            "checklist": advisor.flatten_checklist(groups),  # 구버전 호환
            "groups": groups,
        }
    )


@app.post(
    "/api/v1/inquiry-script",
    response_model=InquiryScriptSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["follow-up"],
    summary="판매자 문의 메시지 생성",
)
def inquiry_script(req: InquiryScriptRequest):
    analysis = db.get_owned_analysis(req.user_id, req.item_id)  # 소유권 검증 포함
    if not analysis:
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {req.item_id}")
    listing = db.get_listing_details(req.user_id, req.item_id)  # 사용자 수정값 (없으면 None)
    inquiry = advisor.build_inquiry(analysis, listing)
    return success(
        {
            "item_id": req.item_id,
            "script": inquiry["combined_script"],  # 구버전 호환
            "questions": inquiry["questions"],
            "combined_script": inquiry["combined_script"],
        }
    )


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
    "/api/v1/transaction",
    response_model=TransactionSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["transaction"],
    summary="거래 상태 등록/변경 (화면5 구매 결정 저장)",
)
def set_transaction(req: TransactionRequest):
    if not db.user_owns_analysis(req.user_id, req.item_id):  # 소유권 검증 (남의 매물 참조 차단)
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {req.item_id}")
    plan = req.model_dump(
        include={"meeting_at", "meeting_place", "trade_method", "memo", "payment_method"}
    )
    plan["meeting_at"] = req.meeting_at.isoformat(sep=" ") if req.meeting_at else None
    updated_at = db.upsert_transaction_status(
        req.user_id, req.item_id, req.stage, req.decision, plan
    )
    return success(
        {
            **req.model_dump(exclude={"user_id", "item_id"}),
            "item_id": req.item_id,
            "updated_at": updated_at,
        }
    )


@app.get(
    "/api/v1/transaction",
    response_model=TransactionListSuccess,
    tags=["transaction"],
    summary="거래 상태 목록 조회 (stage/decision 생략 시 미필터)",
)
def list_transactions(
    user_id: str = Query(examples=["demo-user-1"]),
    stage: TransactionStageEnum | None = Query(None),
    decision: TransactionDecisionEnum | None = Query(None),
):
    items = db.get_transactions(user_id, stage, decision)
    return success({"items": items, "total": len(items)})


@app.post(
    "/api/v1/comparison",
    response_model=ComparisonAddSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["comparison"],
    summary="비교 후보 추가",
)
def add_comparison(req: ComparisonAddRequest):
    if not db.user_owns_analysis(req.user_id, req.item_id):  # 소유권 검증 (남의 매물 참조 차단)
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
    if not db.user_owns_analysis(req.user_id, req.item_id):  # 소유권 검증 (남의 매물 참조 차단)
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
    if not db.user_owns_analysis(req.user_id, req.item_id):  # 소유권 검증 (남의 매물 참조 차단)
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
    "/api/v1/listing",
    response_model=ListingSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["listing"],
    summary="확인된 매물 상세 조회",
)
def get_listing(
    user_id: str = Query(examples=["demo-user-1"]),
    item_id: int = Query(examples=[1]),
):
    if not db.user_owns_analysis(user_id, item_id):  # 소유권 검증
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {item_id}")
    detail = db.get_listing_details(user_id, item_id)
    if not detail:
        return error(404, "LISTING_NOT_FOUND", f"아직 확인/저장된 매물 상세가 없는 item_id: {item_id}")
    return success(detail)


@app.get(
    "/api/v1/mypage",
    response_model=MyPageSuccess,
    tags=["mypage"],
    summary="마이페이지 상단 요약",
)
def mypage(
    user_id: str = Query(examples=["demo-user-1"]),
    recent_limit: int = Query(5, ge=1, le=20),
):
    return success(db.get_mypage_summary(user_id, recent_limit))


@app.post(
    "/api/v1/price-proposal",
    response_model=PriceProposalSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["follow-up"],
    summary="가격 제안 (시세·하자 근거 기반 — 근거 부족 시 target_price null)",
)
def price_proposal(req: PriceProposalRequest):
    analysis = db.get_owned_analysis(req.user_id, req.item_id)  # 소유권 검증 포함
    if not analysis:
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {req.item_id}")
    listing = db.get_listing_details(req.user_id, req.item_id)
    proposal = advisor.build_price_proposal(analysis, listing)
    return success({"item_id": req.item_id, **proposal})


@app.get(
    "/api/v1/analysis/{item_id}",
    response_model=AnalysisDetailSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["analyze"],
    summary="분석 단건 상세 조회 (소유권 검증 — 본인 것만)",
)
def analysis_detail(
    item_id: int,
    user_id: str = Query(examples=["demo-user-1"]),
):
    detail = db.get_analysis_full(user_id, item_id)
    if not detail:
        # 남의 분석이든 없는 분석이든 같은 404 — 존재 여부를 노출하지 않는다
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {item_id}")
    return success(detail)


@app.delete(
    "/api/v1/analysis/{item_id}",
    response_model=AnalysisDeleteSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["analyze"],
    summary="분석 기록 삭제 (soft delete — 찜/비교/거래 목록에서도 함께 사라짐)",
)
def analysis_delete(
    item_id: int,
    user_id: str = Query(examples=["demo-user-1"]),
):
    deleted = db.delete_analysis(user_id, item_id)
    if not deleted:
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {item_id}")
    return success({"item_id": item_id, "deleted": True})


@app.post(
    "/api/v1/comparison-history",
    response_model=ComparisonHistorySuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["comparison"],
    summary="비교 실행 + 기록 저장 (POST /compare 와 동일 로직, 기록 중심 응답)",
)
def create_comparison_history(req: ComparisonHistoryRequest):
    result = _run_comparison(req.user_id, req.item_ids)
    if result is None:
        return error(404, "ITEM_NOT_FOUND", "본인 분석 내역에 없는 item_id가 포함되어 있습니다.")
    _, _, comparison_id = result
    return success(db.get_comparison_history(req.user_id, comparison_id))


@app.get(
    "/api/v1/comparison-history",
    response_model=ComparisonHistoryListSuccess,
    tags=["comparison"],
    summary="비교 기록 목록 (최신순)",
)
def list_comparison_history(user_id: str = Query(examples=["demo-user-1"])):
    items = db.get_comparison_history_list(user_id)
    return success({"items": items, "total": len(items)})


@app.get(
    "/api/v1/comparison-history/{comparison_id}",
    response_model=ComparisonHistorySuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["comparison"],
    summary="비교 기록 단건 조회 (본인 것만)",
)
def get_comparison_history(
    comparison_id: int,
    user_id: str = Query(examples=["demo-user-1"]),
):
    record = db.get_comparison_history(user_id, comparison_id)
    if not record:
        return error(404, "COMPARISON_NOT_FOUND", f"비교 기록에 없는 comparison_id: {comparison_id}")
    return success(record)


@app.delete(
    "/api/v1/comparison-history/{comparison_id}",
    response_model=ComparisonHistoryDeleteSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["comparison"],
    summary="비교 기록 삭제 (본인 것만)",
)
def delete_comparison_history(
    comparison_id: int,
    user_id: str = Query(examples=["demo-user-1"]),
):
    deleted = db.delete_comparison_history(user_id, comparison_id)
    if not deleted:
        return error(404, "COMPARISON_NOT_FOUND", f"비교 기록에 없는 comparison_id: {comparison_id}")
    return success({"comparison_id": comparison_id, "deleted": True})


@app.put(
    "/api/v1/checklist-state",
    response_model=ChecklistStateSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["follow-up"],
    summary="체크리스트 체크 상태 저장 (기기 바뀌어도 유지)",
)
def put_checklist_state(req: ChecklistStateRequest):
    if not db.user_owns_analysis(req.user_id, req.item_id):
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {req.item_id}")
    updated_at = db.upsert_checklist_state(
        req.user_id, req.item_id, req.checked_item_ids, req.excluded_item_ids
    )
    return success(
        {
            "item_id": req.item_id,
            "checked_item_ids": req.checked_item_ids,
            "excluded_item_ids": req.excluded_item_ids,
            "updated_at": updated_at,
        }
    )


@app.get(
    "/api/v1/checklist-state",
    response_model=ChecklistStateSuccess,
    responses={404: {"model": ErrorResponse}},
    tags=["follow-up"],
    summary="저장된 체크 상태 조회 (없으면 빈 목록)",
)
def get_checklist_state(
    user_id: str = Query(examples=["demo-user-1"]),
    item_id: int = Query(examples=[1]),
):
    if not db.user_owns_analysis(user_id, item_id):
        return error(404, "ITEM_NOT_FOUND", f"분석 내역에 없는 item_id: {item_id}")
    state = db.get_checklist_state(user_id, item_id)
    # 한 번도 저장 안 했으면 404 대신 빈 상태 — 프론트가 분기 없이 그대로 쓰면 된다
    return success(
        state
        or {
            "item_id": item_id,
            "checked_item_ids": [],
            "excluded_item_ids": [],
            "updated_at": None,
        }
    )


@app.get(
    "/api/v1/recommendations",
    response_model=RecommendationSuccess,
    tags=["mypage"],
    summary="추천 매물 (분석·찜 기록 기반 — 기록 없으면 빈 배열)",
)
def recommendations(
    user_id: str = Query(examples=["demo-user-1"]),
):
    interest = db.get_user_interest(user_id)
    if not interest["titles"]:
        # 근거가 없으면 추천하지 않는다 — 임의 추천은 사용자를 오도한다 (문서 18 원칙)
        return success({"items": [], "total": 0, "basis": []})
    items = market_price.recommend(interest["titles"], set(interest["seen_urls"]))
    return success({"items": items, "total": len(items), "basis": interest["titles"][:3]})


@app.get("/health", tags=["meta"], summary="상태 확인 (DB 연결 포함)")
def health():
    # DB 를 실제로 두드려본다 — 예전엔 DB 가 죽어도 200 이라 헬스체크 의미가 없었다
    try:
        with db.get_db() as conn:
            db._execute(conn, "SELECT 1")
        db_ok = True
    except Exception as e:
        logger.error("헬스체크 DB 연결 실패: %s", e)
        db_ok = False
    body = {
        "status": "alive" if db_ok else "degraded",
        "database": "ok" if db_ok else "error",
        "backend": "postgres" if os.getenv("DATABASE_URL") else "sqlite",
        "upstage_key": bool(os.getenv("UPSTAGE_API_KEY")),
        "auth_required": bool(os.getenv("AUTH_REQUIRED")),
    }
    return JSONResponse(
        status_code=200 if db_ok else 503,
        content={"ok": db_ok, "data": body, "error": None}
        if db_ok
        else {"ok": False, "data": body, "error": {"code": "DB_UNAVAILABLE", "message": "데이터베이스에 연결할 수 없습니다."}},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
