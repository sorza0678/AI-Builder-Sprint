import { apiRequest, query } from './api-client';
import type { MyPageData } from './api-types';
import { getOrCreateGuestId } from '@/src/storage/guest-id-storage';
export async function getMyPageSummary(){const user_id=await getOrCreateGuestId();return apiRequest<MyPageData>(`/api/v1/mypage?${query({user_id})}`)}
