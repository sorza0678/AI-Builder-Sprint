export type ApiRiskLevel = 'SAFE' | 'WARNING' | 'DANGER';
export type ApiTransactionStage = 'BEFORE_CONTACT' | 'CONTACTING' | 'SCHEDULED' | 'COMPLETED';
export type ApiTransactionDecision = 'CONSIDERING' | 'HOLD' | 'EXCLUDED';

export interface AnalyzeData {
  item_id: number;
  title: string;
  price: number;
  market_price_avg: number;
  trust_score: number;
  risk_level: ApiRiskLevel;
  scam_warnings: string[];
  product_status: { defects_found: string[]; missing_components: string[] };
  market_price?: { min: number | null; average: number | null; max: number | null; sample_count: number; calculated_at: string; confidence: number | null } | null;
  platform?: string | null;
  thumbnail_url?: string | null;
  location?: string | null;
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
export interface TransactionItem {
  item_id: number; title: string; price: number; trust_score: number;
  risk_level: ApiRiskLevel; stage: ApiTransactionStage;
  decision: ApiTransactionDecision | null; updated_at: string;
}
export interface MyPageData {
  analysis_count: number; bookmark_count: number; comparison_count: number;
  transaction_completed_count: number;
  recent_analyses: HistoryItem[];
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
