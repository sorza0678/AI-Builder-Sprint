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


class AnalyzeData(BaseModel):
    item_id: int
    title: str
    price: int
    market_price_avg: int
    trust_score: int = Field(ge=0, le=100)
    risk_level: RiskLevel
    scam_warnings: list[str]
    product_status: ProductStatus


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


class CompareSuccess(BaseModel):
    ok: Literal[True] = True
    data: CompareData
    error: None = None


# ---------- /checklist ----------

class ChecklistRequest(BaseModel):
    user_id: str = Field(examples=["demo-user-1"])
    item_id: int = Field(examples=[1])


class ChecklistData(BaseModel):
    item_id: int
    checklist: list[str]


class ChecklistSuccess(BaseModel):
    ok: Literal[True] = True
    data: ChecklistData
    error: None = None


# ---------- /inquiry-script ----------

class InquiryScriptRequest(BaseModel):
    user_id: str = Field(examples=["demo-user-1"])
    item_id: int = Field(examples=[1])


class InquiryScriptData(BaseModel):
    item_id: int
    script: str


class InquiryScriptSuccess(BaseModel):
    ok: Literal[True] = True
    data: InquiryScriptData
    error: None = None


# ---------- /history ----------

class HistoryItem(BaseModel):
    item_id: int
    source_url: str
    title: str
    price: int
    trust_score: int
    risk_level: RiskLevel
    created_at: datetime


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


class ComparisonListData(BaseModel):
    items: list[AnalyzeData]
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


class BookmarkListData(BaseModel):
    items: list[AnalyzeData]
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


class MyPageSuccess(BaseModel):
    ok: Literal[True] = True
    data: MyPageData
    error: None = None
