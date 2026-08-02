import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AnalysisResult } from '@/src/types/marketplace';
const PREFIX = 'baton:analysis-result:';
export async function cacheAnalysisResult(result: AnalysisResult): Promise<void> {
  await AsyncStorage.setItem(`${PREFIX}${result.id}`, JSON.stringify(result));
}
export async function getCachedAnalysisResult(id: string): Promise<AnalysisResult | undefined> {
  const value = await AsyncStorage.getItem(`${PREFIX}${id}`);
  if (!value) return undefined;
  try { return JSON.parse(value) as AnalysisResult; } catch { return undefined; }
}

export async function mergeCachedListingValues<T extends { item_id: number; title: string; price: number }>(
  items: T[],
): Promise<T[]> {
  return Promise.all(items.map(async (item) => {
    const cached = await getCachedAnalysisResult(String(item.item_id));
    if (!cached) return item;
    return {
      ...item,
      title: cached.listing.title,
      price: cached.listing.price,
    };
  }));
}
