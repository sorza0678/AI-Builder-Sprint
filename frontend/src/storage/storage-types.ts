import type { ConditionGrade, Listing, RiskLevel, TradeStatus } from '@/src/types/marketplace';
import type { AnalysisDraft } from '@/src/types/analysis-input';

export type SyncStatus = 'local-only' | 'pending' | 'synced' | 'failed';

export interface LocalEntityMeta {
  localId: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface SavedListingSnapshot extends LocalEntityMeta {
  serverItemId: number;
  title: string;
  price: number;
  marketPriceAverage: number;
  conditionGrade: ConditionGrade;
  riskLevel: RiskLevel;
  imageUrl: string | null;
  sourceUrl: string;
  syncStatus: SyncStatus;
}

export interface ComparisonCart {
  serverItemIds: number[];
  updatedAt: string;
  schemaVersion: number;
}

export interface ChecklistProgressItem {
  id: string;
  text: string;
  checked: boolean;
  memo?: string;
}

export interface TradeChecklistProgress extends LocalEntityMeta {
  serverItemId: number;
  items: ChecklistProgressItem[];
}

export interface ComparisonHistorySnapshot extends LocalEntityMeta {
  serverItemIds: number[];
  itemSnapshots: {
    serverItemId: number;
    title: string;
    price: number;
    marketPriceAverage?: number;
    trustScore?: number;
    riskLevel?: RiskLevel;
  }[];
  recommendation: string;
}

export interface TradeRecordDraft extends LocalEntityMeta {
  serverItemId: number;
  listingSnapshot: Pick<Listing, 'id' | 'title' | 'price' | 'imageUrl' | 'sourceUrl'>;
  status: TradeStatus;
  scheduledAt?: string;
  completedAt?: string;
  location?: string;
  memo?: string;
  checklistProgressLocalId?: string;
  syncStatus: SyncStatus;
}

export interface RecentAnalysisSnapshot extends LocalEntityMeta {
  serverItemId: number;
  title: string;
  price: number;
  sourceUrl: string;
  viewedAt: string;
}

export interface StoredAnalysisDraft {
  draft: AnalysisDraft;
  updatedAt: string;
  schemaVersion: number;
}
