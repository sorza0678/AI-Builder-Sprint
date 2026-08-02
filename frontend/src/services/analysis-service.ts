import type { AnalysisResult, ConditionGrade, Listing, PriceGrade } from '@/src/types/marketplace';
import type { AnalysisDetailData, AnalyzeData } from './api-types';
import { apiRequest, query } from './api-client';
import { getOrCreateGuestId } from '@/src/storage/guest-id-storage';
import { cacheAnalysisResult, getCachedAnalysisResult, removeCachedAnalysisResult } from '@/src/repositories/analysis-result-cache-repository';
import { riskMap } from '@/src/utils/risk-level';

function getPriceGrade(price: number, average: number): PriceGrade {
  if (average <= 0) return 'FAIR';
  if (price <= average * 0.9) return 'GOOD';
  if (price >= average * 1.1) return 'EXPENSIVE';
  return 'FAIR';
}

export function mapAnalyzeData(data: AnalyzeData, sourceUrl = '', imageUrl: string | null = null): AnalysisResult {
  const details = 'listing_details' in data ? (data as AnalysisDetailData).listing_details : null;
  const marketAverage = data.market_price?.average ?? data.market_price_avg;
  const listing: Listing = {
    id: String(data.item_id),
    title: details?.title ?? data.title,
    platform: data.platform ?? '플랫폼 정보 없음',
    imageUrl: data.thumbnail_url ?? imageUrl,
    sourceUrl: data.source_url ?? sourceUrl,
    price: details?.price ?? data.price,
    modelName: details?.model_name ?? '',
    year: details?.year ?? '',
    sizeOrCapacity: details?.size_or_capacity ?? '',
    color: details?.color ?? '',
    usagePeriod: details?.usage_period ?? '',
    components: details?.components ?? [],
    defects: details?.defects ?? data.product_status.defects_found,
    sellerDescription: data.seller_description ?? '',
    saved: false,
  };
  return {
    id: String(data.item_id),
    listing,
    marketPrice: {
      min: data.market_price?.min ?? marketAverage,
      average: marketAverage,
      max: data.market_price?.max ?? marketAverage,
      sampleCount: data.market_price?.sample_count ?? 0,
      calculatedAt: data.market_price?.calculated_at ?? '',
      confidence: data.market_price?.confidence ?? null,
    },
    comparables: (data.comparables ?? []).map((comparable) => ({
      title: comparable.title,
      price: comparable.price,
      platform: comparable.platform,
      url: comparable.url,
    })),
    priceGrade: getPriceGrade(listing.price, marketAverage),
    conditionGrade: (data.condition?.grade as ConditionGrade | undefined) ?? 'D',
    conditionDefects: (data.condition?.defects ?? []).map((defect) => ({
      name: defect.name,
      severity: defect.severity,
      evidence: defect.evidence,
    })),
    riskLevel: riskMap[data.risk_level],
    warningSignals: data.scam_warnings,
    missingInformation: data.product_status.missing_components,
    tradeChecklist: [],
    sellerQuestions: [],
    analyzedAt: 'created_at' in data ? (data as AnalysisDetailData).created_at : new Date().toISOString(),
    trustScore: data.trust_score,
    marketPriceRangeSupported: Boolean(data.market_price),
    conditionGradeSupported: Boolean(data.condition?.grade),
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
  const user_id = await getOrCreateGuestId();
  try {
    const data = await apiRequest<AnalysisDetailData>(`/api/v1/analysis/${encodeURIComponent(id)}?${query({ user_id })}`);
    const result = mapAnalyzeData(data);
    await cacheAnalysisResult(result);
    return result;
  } catch (error) {
    const cached = await getCachedAnalysisResult(id);
    if (cached) return cached;
    throw error;
  }
}

export async function getAnalysisDetailData(id: number): Promise<AnalysisDetailData> {
  const user_id = await getOrCreateGuestId();
  return apiRequest<AnalysisDetailData>(`/api/v1/analysis/${id}?${query({ user_id })}`);
}

export async function deleteAnalysis(id: string): Promise<void> {
  const user_id = await getOrCreateGuestId();
  await apiRequest<{ item_id: number; deleted: boolean }>(`/api/v1/analysis/${encodeURIComponent(id)}?${query({ user_id })}`, {
    method: 'DELETE',
  });
  await removeCachedAnalysisResult(id);
}
