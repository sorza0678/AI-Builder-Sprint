import { apiRequest, query } from './api-client';
import type { ChecklistStateData } from './api-types';
import { getOrCreateGuestId } from '@/src/storage/guest-id-storage';

export async function getChecklistState(item_id: number) {
  const user_id = await getOrCreateGuestId();
  return apiRequest<ChecklistStateData>(`/api/v1/checklist-state?${query({ user_id, item_id })}`);
}

export async function putChecklistState(
  item_id: number,
  checked_item_ids: string[],
  excluded_item_ids: string[],
) {
  const user_id = await getOrCreateGuestId();
  return apiRequest<ChecklistStateData>('/api/v1/checklist-state', {
    method: 'PUT',
    body: JSON.stringify({ user_id, item_id, checked_item_ids, excluded_item_ids }),
  });
}
