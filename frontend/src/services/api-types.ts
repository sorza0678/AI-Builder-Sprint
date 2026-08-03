export type ApiRiskLevel = 'SAFE' | 'WARNING' | 'DANGER';
export type ApiTransactionStage = 'BEFORE_CONTACT' | 'CONTACTING' | 'SCHEDULED' | 'COMPLETED';
export type ApiTransactionDecision = 'CONSIDERING' | 'HOLD' | 'EXCLUDED';

export interface ApiRiskSignal {
  code: string; title: string; reason: string; severity: ApiRiskLevel; evidence: string | null;
}
export type ApiDefectSeverity = 'MINOR' | 'MODERATE' | 'MAJOR';
export type ApiDefectSource = 'DESCRIPTION' | 'USER';
export interface ApiConditionDefect {
  name: string; severity: ApiDefectSeverity | null; evidence: string | null; source: ApiDefectSource;
}
export interface ApiCondition {
  grade: string | null; confidence: number | null; defects: ApiConditionDefect[];
}
export interface ApiComparable {
  title: string; price: number; platform: string; url: string | null;
  location?: string | null; sold?: boolean | null;
}
export type ApiListingTradeMethod = 'IN_PERSON' | 'DELIVERY' | 'BOTH';

export interface AnalyzeData {
  item_id: number;
  title: string;
  price: number;
  market_price_avg: number;
  trust_score: number;
  risk_level: ApiRiskLevel;
  scam_warnings: string[];
  product_status: { defects_found: string[]; missing_components: string[] };
  risk_signals?: ApiRiskSignal[];
  condition?: ApiCondition | null;
  market_price?: { min: number | null; average: number | null; max: number | null; sample_count: number; calculated_at: string; confidence: number | null } | null;
  comparables?: ApiComparable[];
  platform?: string | null;
  thumbnail_url?: string | null;
  location?: string | null;
  seller_description?: string | null;
  trade_method?: ApiListingTradeMethod | null;
  model_name?: string | null;
  year?: string | null;
  size_or_capacity?: string | null;
  color?: string | null;
  usage_period?: string | null;
  source_url?: string;
  bookmarked_at?: string;
  comparison_added_at?: string;
}

export interface HistoryItem {
  item_id: number; source_url: string; title: string; price: number;
  trust_score: number; risk_level: ApiRiskLevel; created_at: string;
  platform: string | null; thumbnail_url: string | null; location: string | null;
}
export interface HistoryData { items: HistoryItem[]; page: number; size: number; total: number }
export interface CompareData { items: AnalyzeData[]; recommendation: string; comparison_id?: number | null }
export type ApiProgressTradeMethod = 'IN_PERSON' | 'DELIVERY';
export interface TransactionItem {
  item_id: number; title: string; price: number; trust_score: number;
  risk_level: ApiRiskLevel; stage: ApiTransactionStage;
  decision: ApiTransactionDecision | null; updated_at: string;
  meeting_at: string | null;
  meeting_place: string | null;
  trade_method: ApiProgressTradeMethod | null;
  memo: string | null;
  payment_method: string | null;
}
export interface MyPageUser {
  id: string; nickname: string | null; profile_image_url: string | null; created_at: string;
}
export interface MyPageData {
  user: MyPageUser | null;
  analysis_count: number; bookmark_count: number; comparison_count: number;
  transaction_completed_count: number;
  recent_analyses: HistoryItem[];
}

export type ApiChecklistGroupKey = 'BEFORE_TRADE' | 'ON_SITE' | 'BEFORE_PAYMENT';
export interface ApiChecklistItem {
  id: string; text: string; reason: string | null; required: boolean;
}
export interface ApiChecklistGroup {
  key: ApiChecklistGroupKey; title: string; items: ApiChecklistItem[];
}
export interface ChecklistData {
  item_id: number; checklist: string[]; groups: ApiChecklistGroup[];
}

export type ApiInquiryCategory = 'CONDITION' | 'COMPONENTS' | 'AUTHENTICITY' | 'TRADE';
export interface ApiInquiryQuestion {
  id: string; text: string; reason: string | null; category: ApiInquiryCategory;
}
export interface InquiryScriptData {
  item_id: number; script: string; questions: ApiInquiryQuestion[]; combined_script: string;
}

export interface NegotiationRange { min: number; max: number }
export interface PriceProposalData {
  item_id: number;
  target_price: number | null;
  negotiation_range: NegotiationRange | null;
  reasons: string[];
  message: string | null;
}

export interface ChecklistStateData {
  item_id: number; checked_item_ids: string[]; excluded_item_ids: string[]; updated_at: string | null;
}

export interface RecommendedItem extends ApiComparable { reason: string }
export interface RecommendationData {
  items: RecommendedItem[]; total: number; basis: string[];
}
export interface ListingDetailsData {
  item_id: number; title: string; price: number; model_name: string; year: string;
  size_or_capacity: string; color: string; usage_period: string; components: string[];
  defects: string[]; updated_at: string;
}
export interface AnalysisDetailData extends AnalyzeData {
  source_url: string; listing_details: ListingDetailsData | null;
  created_at: string; updated_at: string | null;
}
export interface ComparisonHistoryData {
  comparison_id: number; item_ids: number[]; recommendation: string; created_at: string;
  items: Pick<AnalyzeData, 'item_id' | 'title' | 'price' | 'trust_score' | 'risk_level'>[];
}
export interface ApiErrorBody { code: string; message: string }
export type ApiEnvelope<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: ApiErrorBody };
