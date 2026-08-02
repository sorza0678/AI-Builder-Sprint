import { apiRequest, query } from './api-client';
import type { HistoryData } from './api-types';
import { getOrCreateGuestId } from '@/src/storage/guest-id-storage';
export async function getHistory(page = 1, size = 10): Promise<HistoryData> {
  const user_id = await getOrCreateGuestId();
  const data = await apiRequest<HistoryData>(`/api/v1/history?${query({ user_id, page, size })}`);
  return data;
}
