import { CURRENT_STORAGE_SCHEMA_VERSION, STORAGE_KEYS } from '@/src/storage/storage-keys';
import { getArray, removeArrayItem, setJson, upsertArrayItem } from '@/src/storage/storage-client';
import { createGuestScopedLocalId } from '@/src/storage/guest-id-storage';
import type { ComparisonHistorySnapshot } from '@/src/storage/storage-types';

const MAX_COMPARISON_HISTORY_ITEMS = 20;

export async function getComparisonHistory(): Promise<ComparisonHistorySnapshot[]> {
  return (await getArray<ComparisonHistorySnapshot>(STORAGE_KEYS.comparisonHistory)).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export async function saveComparisonHistory(
  snapshot: Omit<ComparisonHistorySnapshot, 'localId' | 'createdAt' | 'updatedAt' | 'schemaVersion'>,
): Promise<ComparisonHistorySnapshot[]> {
  const now = new Date().toISOString();
  const key = snapshot.serverItemIds.join(':');
  const existing = (await getComparisonHistory()).find(
    (item) => item.serverItemIds.join(':') === key,
  );
  const nextSnapshot: ComparisonHistorySnapshot = {
    ...snapshot,
    localId: existing?.localId ?? createGuestScopedLocalId('comparison-history'),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
  };
  const nextItems = await upsertArrayItem(
    STORAGE_KEYS.comparisonHistory,
    nextSnapshot,
    (item: ComparisonHistorySnapshot) => item.serverItemIds.join(':') === key,
  );
  const sortedItems = nextItems
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_COMPARISON_HISTORY_ITEMS);
  await setJson(STORAGE_KEYS.comparisonHistory, sortedItems);
  return sortedItems;
}

export async function removeComparisonHistory(localId: string): Promise<ComparisonHistorySnapshot[]> {
  return removeArrayItem(
    STORAGE_KEYS.comparisonHistory,
    (item: ComparisonHistorySnapshot) => item.localId === localId,
  );
}

export async function clearComparisonHistory(): Promise<void> {
  await setJson(STORAGE_KEYS.comparisonHistory, []);
}
