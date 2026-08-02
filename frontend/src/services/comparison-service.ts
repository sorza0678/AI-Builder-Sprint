import { apiRequest, query } from './api-client';
import type { AnalyzeData, CompareData } from './api-types';
import { getOrCreateGuestId } from '@/src/storage/guest-id-storage';
import { mergeCachedListingValues } from '@/src/repositories/analysis-result-cache-repository';
export async function getComparisonItems(){const user_id=await getOrCreateGuestId();const data=await apiRequest<{items:AnalyzeData[];total:number}>(`/api/v1/comparison?${query({user_id})}`);return {...data,items:await mergeCachedListingValues(data.items)}}
export async function addComparisonItem(item_id:number){const user_id=await getOrCreateGuestId();return apiRequest<{item_id:number;added:boolean}>('/api/v1/comparison',{method:'POST',body:JSON.stringify({user_id,item_id})})}
export async function removeComparisonItem(item_id:number){const user_id=await getOrCreateGuestId();return apiRequest<{item_id:number;removed:boolean}>(`/api/v1/comparison?${query({user_id,item_id})}`,{method:'DELETE'})}
export async function compareItems(item_ids:number[]):Promise<CompareData>{const user_id=await getOrCreateGuestId();const data=await apiRequest<CompareData>('/api/v1/compare',{method:'POST',body:JSON.stringify({user_id,item_ids})});const items=await mergeCachedListingValues(data.items);let recommendation=data.recommendation;data.items.forEach((item,index)=>{if(item.title!==items[index].title)recommendation=recommendation.replace(item.title,items[index].title)});return {...data,items,recommendation}}
