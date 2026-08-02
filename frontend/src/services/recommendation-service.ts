import { apiRequest, query } from './api-client';
import type { RecommendationData } from './api-types';
import { getOrCreateGuestId } from '@/src/storage/guest-id-storage';

export async function getRecommendations(): Promise<RecommendationData> {
  const user_id = await getOrCreateGuestId();
  return apiRequest<RecommendationData>(`/api/v1/recommendations?${query({ user_id })}`);
}
