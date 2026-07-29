export type PriceGrade = 'GOOD' | 'FAIR' | 'EXPENSIVE';
export type ConditionGrade = 'A' | 'B' | 'C' | 'D';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type TradeStatus = 'INTERESTED' | 'CONTACTED' | 'SCHEDULED' | 'COMPLETED' | 'CANCELED';

export interface Listing {
  id: string;
  title: string;
  platform: string;
  imageUrl: string | null;
  sourceUrl: string;
  price: number;
  modelName: string;
  year: string;
  sizeOrCapacity: string;
  color: string;
  usagePeriod: string;
  components: string[];
  defects: string[];
  sellerDescription: string;
  saved: boolean;
}

export interface AnalysisResult {
  id: string;
  listing: Listing;
  marketPrice: { min: number; average: number; max: number };
  priceGrade: PriceGrade;
  conditionGrade: ConditionGrade;
  riskLevel: RiskLevel;
  warningSignals: string[];
  missingInformation: string[];
  tradeChecklist: string[];
  sellerQuestions: string[];
  analyzedAt: string;
}
