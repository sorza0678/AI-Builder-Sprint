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
}

export interface HistoryItem {
  item_id: number; source_url: string; title: string; price: number;
  trust_score: number; risk_level: ApiRiskLevel; created_at: string;
}
export interface HistoryData { items: HistoryItem[]; page: number; size: number; total: number }
export interface CompareData { items: AnalyzeData[]; recommendation: string }
export interface TransactionItem {
  item_id: number; title: string; price: number; trust_score: number;
  risk_level: ApiRiskLevel; stage: ApiTransactionStage;
  decision: ApiTransactionDecision | null; updated_at: string;
}
export interface MyPageData {
  analysis_count: number; bookmark_count: number; comparison_count: number;
  transaction_completed_count: number;
}
export interface ApiErrorBody { code: string; message: string }
export type ApiEnvelope<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: ApiErrorBody };
