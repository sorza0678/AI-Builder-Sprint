import { apiRequest, query } from './api-client';
import type { AnalyzeData, CompareData, ComparisonHistoryData } from './api-types';
import { getOrCreateGuestId } from '@/src/storage/guest-id-storage';

export async function getComparisonItems() {
  const user_id = await getOrCreateGuestId();
  return apiRequest<{ items: AnalyzeData[]; total: number }>(`/api/v1/comparison?${query({ user_id })}`);
}

export async function addComparisonItem(item_id: number) {
  const user_id = await getOrCreateGuestId();
  return apiRequest<{ item_id: number; added: boolean }>('/api/v1/comparison', {
    method: 'POST', body: JSON.stringify({ user_id, item_id }),
  });
}

export async function removeComparisonItem(item_id: number) {
  const user_id = await getOrCreateGuestId();
  return apiRequest<{ item_id: number; removed: boolean }>(`/api/v1/comparison?${query({ user_id, item_id })}`, { method: 'DELETE' });
}

export async function compareItems(item_ids: number[]): Promise<CompareData> {
  const user_id = await getOrCreateGuestId();
  return apiRequest<CompareData>('/api/v1/compare', {
    method: 'POST', body: JSON.stringify({ user_id, item_ids }),
  });
}

export async function getComparisonHistory() {
  const user_id = await getOrCreateGuestId();
  return apiRequest<{ items: ComparisonHistoryData[]; total: number }>(`/api/v1/comparison-history?${query({ user_id })}`);
}

export async function getComparisonHistoryById(comparisonId: number) {
  const user_id = await getOrCreateGuestId();
  return apiRequest<ComparisonHistoryData>(`/api/v1/comparison-history/${comparisonId}?${query({ user_id })}`);
}

export async function deleteComparisonHistory(comparisonId: number) {
  const user_id = await getOrCreateGuestId();
  return apiRequest<{ comparison_id: number; deleted: boolean }>(`/api/v1/comparison-history/${comparisonId}?${query({ user_id })}`, { method: 'DELETE' });
}
