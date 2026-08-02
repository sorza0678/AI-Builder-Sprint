import { apiRequest, query } from './api-client';
import type { AnalyzeData } from './api-types';
import { getOrCreateGuestId } from '@/src/storage/guest-id-storage';
export async function getBookmarks() { const user_id=await getOrCreateGuestId(); return apiRequest<{items:AnalyzeData[];total:number}>(`/api/v1/bookmark?${query({user_id})}`); }
export async function addBookmark(item_id:number) { const user_id=await getOrCreateGuestId(); return apiRequest<{item_id:number;bookmarked:boolean}>('/api/v1/bookmark',{method:'POST',body:JSON.stringify({user_id,item_id})}); }
export async function removeBookmark(item_id:number) { const user_id=await getOrCreateGuestId(); return apiRequest<{item_id:number;removed:boolean}>(`/api/v1/bookmark?${query({user_id,item_id})}`,{method:'DELETE'}); }
