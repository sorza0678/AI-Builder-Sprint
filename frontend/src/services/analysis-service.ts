import type { AnalysisResult, Listing, PriceGrade, RiskLevel } from '@/src/types/marketplace';
import type { AnalyzeData, ApiRiskLevel } from './api-types';
import { apiRequest } from './api-client';
import { getOrCreateGuestId } from '@/src/storage/guest-id-storage';
import { cacheAnalysisResult, getCachedAnalysisResult } from '@/src/repositories/analysis-result-cache-repository';

const riskMap: Record<ApiRiskLevel, RiskLevel> = { SAFE: 'LOW', WARNING: 'MEDIUM', DANGER: 'HIGH' };

function getPriceGrade(price: number, average: number): PriceGrade {
  if (average <= 0) return 'FAIR';
  if (price <= average * 0.9) return 'GOOD';
  if (price >= average * 1.1) return 'EXPENSIVE';
  return 'FAIR';
}

export function mapAnalyzeData(data: AnalyzeData, sourceUrl = '', imageUrl: string | null = null): AnalysisResult {
  const listing: Listing = {
    id: String(data.item_id), title: data.title, platform: '플랫폼 표시 미지원', imageUrl,
    sourceUrl, price: data.price, modelName: '', year: '',
    sizeOrCapacity: '', color: '', usagePeriod: '', components: [],
    defects: data.product_status.defects_found, sellerDescription: '', saved: false,
  };
  return {
    id: String(data.item_id), listing,
    marketPrice: { min: data.market_price_avg, average: data.market_price_avg, max: data.market_price_avg },
    priceGrade: getPriceGrade(data.price, data.market_price_avg), conditionGrade: 'D',
    riskLevel: riskMap[data.risk_level], warningSignals: data.scam_warnings,
    missingInformation: data.product_status.missing_components,
    tradeChecklist: [], sellerQuestions: [], analyzedAt: new Date().toISOString(),
    trustScore: data.trust_score, marketPriceRangeSupported: false, conditionGradeSupported: false,
  };
}

export async function createAnalysis(listing: Listing): Promise<AnalysisResult> {
  const user_id = await getOrCreateGuestId();
  const data = await apiRequest<AnalyzeData>('/api/v1/analyze', {
    method: 'POST', body: JSON.stringify({ user_id, url: listing.sourceUrl }),
  });
  const result = mapAnalyzeData(data, listing.sourceUrl, listing.imageUrl);
  await cacheAnalysisResult(result);
  return result;
}

export async function getAnalysisResult(id: string): Promise<AnalysisResult | undefined> {
  return getCachedAnalysisResult(id);
}
