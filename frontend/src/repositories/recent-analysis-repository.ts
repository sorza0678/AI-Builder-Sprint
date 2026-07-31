import type { AnalysisResult } from '@/src/types/marketplace';

import { CURRENT_STORAGE_SCHEMA_VERSION, STORAGE_KEYS } from '@/src/storage/storage-keys';
import { getArray, setJson, upsertArrayItem } from '@/src/storage/storage-client';
import { createGuestScopedLocalId } from '@/src/storage/guest-id-storage';
import type { RecentAnalysisSnapshot } from '@/src/storage/storage-types';
import { getServerItemIdFromAnalysis } from './saved-listing-repository';

const MAX_RECENT_ANALYSES = 20;

export async function getRecentAnalyses(): Promise<RecentAnalysisSnapshot[]> {
  return (await getArray<RecentAnalysisSnapshot>(STORAGE_KEYS.recentAnalyses)).sort(
    (a, b) => Date.parse(b.viewedAt) - Date.parse(a.viewedAt),
  );
}

export async function upsertRecentAnalysis(
  result: AnalysisResult,
): Promise<RecentAnalysisSnapshot[]> {
  const now = new Date().toISOString();
  const serverItemId = getServerItemIdFromAnalysis(result);
  const existing = (await getRecentAnalyses()).find((item) => item.serverItemId === serverItemId);
  const snapshot: RecentAnalysisSnapshot = {
    localId: existing?.localId ?? createGuestScopedLocalId('recent-analysis'),
    serverItemId,
    title: result.listing.title,
    price: result.listing.price,
    sourceUrl: result.listing.sourceUrl,
    viewedAt: now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
  };
  const nextItems = await upsertArrayItem(
    STORAGE_KEYS.recentAnalyses,
    snapshot,
    (item: RecentAnalysisSnapshot) => item.serverItemId === serverItemId,
  );
  const sortedItems = nextItems
    .sort((a, b) => Date.parse(b.viewedAt) - Date.parse(a.viewedAt))
    .slice(0, MAX_RECENT_ANALYSES);
  await setJson(STORAGE_KEYS.recentAnalyses, sortedItems);
  return sortedItems;
}
