"""API 요청/응답 스키마. /docs(Swagger)가 이 파일로 자동 생성된다.

팀 공통 응답 형식 (backend/AGENTS.md):
  성공 { "ok": true,  "data": {...}, "error": null }
  실패 { "ok": false, "data": null,  "error": {"code": "...", "message": "..."} }
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RiskLevel = Literal["SAFE", "WARNING", "DANGER"]


# ---------- 공통 ----------

class ErrorBody(BaseModel):
    code: str = Field(examples=["SCRAPE_FAILED"])
    message: str = Field(examples=["매물 페이지를 불러오지 못했습니다."])


class ErrorResponse(BaseModel):
    ok: Literal[False] = False
    data: None = None
    error: ErrorBody


# ---------- /analyze ----------

class AnalyzeRequest(BaseModel):
    user_id: str = Field(examples=["demo-user-1"])
    url: str = Field(examples=["https://www.daangn.com/articles/123456"])


class ProductStatus(BaseModel):
    defects_found: list[str]
    missing_components: list[str]


class MarketPriceDetail(BaseModel):
    """시세 상세 — 평균 하나만으로는 신뢰도를 판단할 수 없어 표본 정보를 함께 준다.

    실측 실패(폴백) 시 min/max/confidence 는 null, sample_count 는 0에 가깝다."""
    min: int | None
    average: int | None
    max: int | None
    sample_count: int
    calculated_at: datetime
    confidence: float | None = Field(default=None, description="0~1, 표본 30건이면 1.0")


class AnalyzeData(BaseModel):
    item_id: int
    title: str
    price: int
    market_price_avg: int
    trust_score: int = Field(ge=0, le=100)
    risk_level: RiskLevel
    scam_warnings: list[str]
    product_status: ProductStatus
    # ↓ 2026-08-02 추가 (additive — 구버전 분석 기록·mock 데이터에서는 null)
    market_price: MarketPriceDetail | None = None
    platform: str | None = None
    thumbnail_url: str | None = None
    location: str | None = None


class AnalyzeSuccess(BaseModel):
    ok: Literal[True] = True
    data: AnalyzeData
    error: None = None


# ---------- /compare ----------

class CompareRequest(BaseModel):
    user_id: str = Field(examples=["demo-user-1"])
    item_ids: list[int] = Field(min_length=2, max_length=3, examples=[[1, 2]])


class CompareData(BaseModel):
    items: list[AnalyzeData]
    recommendation: str = Field(
        description="어느 매물이 나은지 한 줄 코멘트",
        examples=["1번 매물이 시세 대비 합리적이고 신뢰도가 가장 높습니다."],
    )
    comparison_id: int | None = Field(
        default=None, description="이 비교 실행이 저장된 비교 기록 id (GET /comparison-history/{id})"
    )


class CompareSuccess(BaseModel):
    ok: Literal[True] = True
    data: CompareData
    error: None = None


# ---------- /checklist ----------

class ChecklistRequest(BaseModel):
    user_id: str = Field(examples=["demo-user-1"])
    item_id: int = Field(examples=[1])


ChecklistGroupKey = Literal["BEFORE_TRADE", "ON_SITE", "BEFORE_PAYMENT"]


class ChecklistItem(BaseModel):
    id: str = Field(examples=["on_site-1"])
    text: str
    reason: str | None = Field(default=None, description="왜 확인해야 하는지 (없으면 null)")
    required: bool = Field(description="필수 확인 항목 여부")


class ChecklistGroup(BaseModel):
    key: ChecklistGroupKey
    title: str = Field(examples=["현장에서 확인"])
    items: list[ChecklistItem]


class ChecklistData(BaseModel):
    item_id: int
    checklist: list[str] = Field(description="(구버전 호환) groups 를 평탄화한 문자열 배열")
    groups: list[ChecklistGroup] = Field(description="거래 전/현장/결제 전 3단계 구조화 체크리스트")


class ChecklistSuccess(BaseModel):
    ok: Literal[True] = True
    data: ChecklistData
    error: None = None


# ---------- /inquiry-script ----------

class InquiryScriptRequest(BaseModel):
    user_id: str = Field(examples=["demo-user-1"])
    item_id: int = Field(examples=[1])


InquiryCategory = Literal["CONDITION", "COMPONENTS", "AUTHENTICITY", "TRADE"]


class InquiryQuestion(BaseModel):
    id: str = Field(examples=["q1"])
    text: str
    reason: str | None = Field(default=None, description="이 질문을 권하는 근거 (없으면 null)")
    category: InquiryCategory


class InquiryScriptData(BaseModel):
    item_id: int
    script: str = Field(description="(구버전 호환) combined_script 와 동일")
    questions: list[InquiryQuestion] = Field(
        description="사용자가 골라서 보낼 질문 목록 — 기본 선택 없음, 프론트에서 선택 후 조합"
    )
    combined_script: str = Field(description="전체 질문을 합친 기본 문의 메시지")


class InquiryScriptSuccess(BaseModel):
    ok: Literal[True] = True
    data: InquiryScriptData
    error: None = None


# ---------- /history ----------

class HistoryItem(BaseModel):
    item_id: int
    source_url: str
    title: str = Field(description="사용자가 화면2에서 수정했으면 수정값")
    price: int = Field(description="사용자가 화면2에서 수정했으면 수정값")
    trust_score: int
    risk_level: RiskLevel
    created_at: datetime
    # ↓ 스크래핑으로 수집된 경우에만 값 존재 (구버전 기록·mock은 null)
    platform: str | None = None
    thumbnail_url: str | None = None
    location: str | None = None


class HistoryData(BaseModel):
    items: list[HistoryItem]
    page: int
    size: int
    total: int


class HistorySuccess(BaseModel):
    ok: Literal[True] = True
    data: HistoryData
    error: None = None


# ---------- /transaction (화면5 구매 결정 저장) ----------

TransactionStageEnum = Literal["BEFORE_CONTACT", "CONTACTING", "SCHEDULED", "COMPLETED"]
TransactionDecisionEnum = Literal["CONSIDERING", "HOLD", "EXCLUDED"]


class TransactionRequest(BaseModel):
    user_id: str = Field(examples=["demo-user-1"])
    item_id: int = Field(examples=[1])
    stage: TransactionStageEnum = Field(examples=["CONTACTING"])
    decision: TransactionDecisionEnum | None = Field(default=None, examples=["CONSIDERING"])


class TransactionData(BaseModel):
    item_id: int
    stage: TransactionStageEnum
    decision: TransactionDecisionEnum | None
    updated_at: datetime


class TransactionSuccess(BaseModel):
    ok: Literal[True] = True
    data: TransactionData
    error: None = None


class TransactionListItem(BaseModel):
    item_id: int
    title: str
    price: int
    trust_score: int
    risk_level: RiskLevel
    stage: TransactionStageEnum
    decision: TransactionDecisionEnum | None
    updated_at: datetime


class TransactionListData(BaseModel):
    items: list[TransactionListItem]
    total: int


class TransactionListSuccess(BaseModel):
    ok: Literal[True] = True
    data: TransactionListData
    error: None = None


# ---------- /comparison (비교 후보 목록) ----------

class ComparisonAddRequest(BaseModel):
    user_id: str = Field(examples=["demo-user-1"])
    item_id: int = Field(examples=[1])


class ComparisonAddData(BaseModel):
    item_id: int
    added: bool = Field(description="새로 추가되면 true, 이미 후보에 있었으면 false")


class ComparisonAddSuccess(BaseModel):
    ok: Literal[True] = True
    data: ComparisonAddData
    error: None = None


class ComparisonRemoveData(BaseModel):
    item_id: int
    removed: bool


class ComparisonRemoveSuccess(BaseModel):
    ok: Literal[True] = True
    data: ComparisonRemoveData
    error: None = None


class ComparisonCandidateItem(AnalyzeData):
    """비교 후보 목록 아이템 — 분석 데이터 + 목록 메타 (추가 시각·원본 URL)."""
    source_url: str
    comparison_added_at: datetime


class ComparisonListData(BaseModel):
    items: list[ComparisonCandidateItem]
    total: int


class ComparisonListSuccess(BaseModel):
    ok: Literal[True] = True
    data: ComparisonListData
    error: None = None


# ---------- /bookmark (찜) ----------

class BookmarkRequest(BaseModel):
    user_id: str = Field(examples=["demo-user-1"])
    item_id: int = Field(examples=[1])


class BookmarkData(BaseModel):
    item_id: int
    bookmarked: bool = Field(description="새로 찜하면 true, 이미 찜해둔 상태였으면 false")


class BookmarkSuccess(BaseModel):
    ok: Literal[True] = True
    data: BookmarkData
    error: None = None


class BookmarkRemoveData(BaseModel):
    item_id: int
    removed: bool


class BookmarkRemoveSuccess(BaseModel):
    ok: Literal[True] = True
    data: BookmarkRemoveData
    error: None = None


class BookmarkListItem(AnalyzeData):
    """찜 목록 아이템 — 분석 데이터 + 목록 메타 (찜한 시각·원본 URL)."""
    source_url: str
    bookmarked_at: datetime


class BookmarkListData(BaseModel):
    items: list[BookmarkListItem]
    total: int


class BookmarkListSuccess(BaseModel):
    ok: Literal[True] = True
    data: BookmarkListData
    error: None = None


# ---------- /listing (화면2 확인/수정된 매물 상세) ----------

class ListingRequest(BaseModel):
    user_id: str = Field(examples=["demo-user-1"])
    item_id: int = Field(examples=[1])
    title: str = Field(examples=["아이폰 13 프로 256GB"])
    price: int = Field(examples=[850000])
    model_name: str = Field(examples=["iPhone 13 Pro"])
    year: str = Field(examples=["2021"])
    size_or_capacity: str = Field(examples=["256GB"])
    color: str = Field(examples=["그래파이트"])
    usage_period: str = Field(examples=["6개월"])
    components: list[str] = Field(examples=[["박스", "충전기"]])
    defects: list[str] = Field(examples=[["액정 미세 스크래치"]])


class ListingData(BaseModel):
    item_id: int
    title: str
    price: int
    model_name: str
    year: str
    size_or_capacity: str
    color: str
    usage_period: str
    components: list[str]
    defects: list[str]
    updated_at: datetime


class ListingSuccess(BaseModel):
    ok: Literal[True] = True
    data: ListingData
    error: None = None


# ---------- /mypage ----------

class MyPageData(BaseModel):
    analysis_count: int
    bookmark_count: int
    comparison_count: int
    transaction_completed_count: int
    recent_analyses: list[HistoryItem]


class MyPageSuccess(BaseModel):
    ok: Literal[True] = True
    data: MyPageData
    error: None = None


# ---------- GET/DELETE /analysis/{item_id} (단건 조회·삭제) ----------

class AnalysisDetailData(BaseModel):
    """분석 단건 상세 — 기기 로컬 캐시 없이 상세 화면을 복원할 수 있는 전체 데이터.

    title/price/defects 는 사용자 수정값이 있으면 그 값 (원본 수정값은 listing_details 에)."""
    item_id: int
    source_url: str
    title: str
    price: int
    market_price_avg: int
    trust_score: int
    risk_level: RiskLevel
    scam_warnings: list[str]
    product_status: ProductStatus
    market_price: MarketPriceDetail | None = None
    platform: str | None = None
    thumbnail_url: str | None = None
    location: str | None = None
    listing_details: ListingData | None = Field(
        default=None, description="화면2에서 확인/수정한 상세 — 아직 없으면 null"
    )
    created_at: datetime
    updated_at: datetime | None = Field(default=None, description="사용자 수정이 있었으면 그 시각")


class AnalysisDetailSuccess(BaseModel):
    ok: Literal[True] = True
    data: AnalysisDetailData
    error: None = None


class AnalysisDeleteData(BaseModel):
    item_id: int
    deleted: bool


class AnalysisDeleteSuccess(BaseModel):
    ok: Literal[True] = True
    data: AnalysisDeleteData
    error: None = None


# ---------- POST /price-proposal (가격 제안) ----------

class PriceProposalRequest(BaseModel):
    user_id: str = Field(examples=["demo-user-1"])
    item_id: int = Field(examples=[1])


class NegotiationRange(BaseModel):
    min: int = Field(description="강하게 제안할 수 있는 목표가")
    max: int = Field(description="현실적으로 합의될 만한 상한")


class PriceProposalData(BaseModel):
    item_id: int
    target_price: int | None = Field(
        description="제안 목표가 — 시세 표본이 부족하거나 이미 저렴하면 null (임의 생성 금지)"
    )
    negotiation_range: NegotiationRange | None
    reasons: list[str] = Field(description="목표가 산출 근거 (표본 수·하자·누락 반영 내역)")
    message: str | None = Field(description="판매자에게 보낼 제안 문구 초안 — 제안할 게 없으면 null")


class PriceProposalSuccess(BaseModel):
    ok: Literal[True] = True
    data: PriceProposalData
    error: None = None


# ---------- /comparison-history (실행된 비교 기록) ----------

class ComparisonSnapshotItem(BaseModel):
    """비교 당시의 값 그대로 (이후 수정·삭제와 무관하게 보존)."""
    item_id: int
    title: str
    price: int
    trust_score: int
    risk_level: RiskLevel


class ComparisonHistoryRequest(BaseModel):
    user_id: str = Field(examples=["demo-user-1"])
    item_ids: list[int] = Field(min_length=2, max_length=3, examples=[[1, 2]])


class ComparisonHistoryData(BaseModel):
    comparison_id: int
    item_ids: list[int]
    recommendation: str
    items: list[ComparisonSnapshotItem]
    created_at: datetime


class ComparisonHistorySuccess(BaseModel):
    ok: Literal[True] = True
    data: ComparisonHistoryData
    error: None = None


class ComparisonHistoryListData(BaseModel):
    items: list[ComparisonHistoryData]
    total: int


class ComparisonHistoryListSuccess(BaseModel):
    ok: Literal[True] = True
    data: ComparisonHistoryListData
    error: None = None


class ComparisonHistoryDeleteData(BaseModel):
    comparison_id: int
    deleted: bool


class ComparisonHistoryDeleteSuccess(BaseModel):
    ok: Literal[True] = True
    data: ComparisonHistoryDeleteData
    error: None = None


# ---------- /auth (회원가입·로그인) ----------

class SignupRequest(BaseModel):
    user_id: str = Field(
        min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_-]+$",
        description="영문/숫자/-/_ 만 허용 ('.'은 토큰 구분자라 금지)",
        examples=["baton001"],
    )
    password: str = Field(min_length=4, max_length=100, examples=["1234"])
    nickname: str | None = Field(default=None, max_length=30, examples=["바톤"])


class LoginRequest(BaseModel):
    user_id: str = Field(examples=["baton001"])
    password: str = Field(examples=["1234"])


class AuthData(BaseModel):
    user_id: str
    nickname: str | None
    token: str = Field(description="이후 요청의 Authorization: Bearer <token> 헤더에 사용")
    expires_at: int = Field(description="토큰 만료 (unix seconds)")


class AuthSuccess(BaseModel):
    ok: Literal[True] = True
    data: AuthData
    error: None = None


# ---------- /account/migrate-guest (비회원 데이터 이전) ----------

class MigrateGuestRequest(BaseModel):
    guest_user_id: str = Field(
        examples=["guest-abc123"],
        description="이전할 guest id. 계정은 Bearer 토큰으로 식별 (body로 계정 지정 불가)",
    )


class MigrateGuestData(BaseModel):
    account_user_id: str
    guest_user_id: str
    migrated: dict[str, int] = Field(
        description="테이블별 이전된 행 수 — 재호출 시 전부 0 (멱등)"
    )


class MigrateGuestSuccess(BaseModel):
    ok: Literal[True] = True
    data: MigrateGuestData
    error: None = None
