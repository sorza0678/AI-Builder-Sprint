import type { AnalysisResult, TradeStatus } from '@/src/types/marketplace';

import { CURRENT_STORAGE_SCHEMA_VERSION, STORAGE_KEYS } from '@/src/storage/storage-keys';
import { getArray, removeArrayItem, upsertArrayItem } from '@/src/storage/storage-client';
import { createGuestScopedLocalId } from '@/src/storage/guest-id-storage';
import type { TradeRecordDraft } from '@/src/storage/storage-types';
import { getServerItemIdFromAnalysis } from './saved-listing-repository';

export async function getTradeRecords(): Promise<TradeRecordDraft[]> {
  return (await getArray<TradeRecordDraft>(STORAGE_KEYS.tradeRecords)).sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

export async function getTradeRecord(serverItemId: number): Promise<TradeRecordDraft | undefined> {
  return (await getTradeRecords()).find((record) => record.serverItemId === serverItemId);
}

export async function saveTradeRecord(
  result: AnalysisResult,
  status: TradeStatus,
  options: Pick<TradeRecordDraft, 'scheduledAt' | 'completedAt' | 'location' | 'memo'> = {},
): Promise<TradeRecordDraft> {
  const now = new Date().toISOString();
  const serverItemId = getServerItemIdFromAnalysis(result);
  const existing = await getTradeRecord(serverItemId);
  const nextRecord: TradeRecordDraft = {
    ...existing,
    ...options,
    localId: existing?.localId ?? createGuestScopedLocalId('trade-record'),
    serverItemId,
    listingSnapshot: {
      id: result.listing.id,
      title: result.listing.title,
      price: result.listing.price,
      imageUrl: result.listing.imageUrl,
      sourceUrl: result.listing.sourceUrl,
    },
    status,
    syncStatus: existing?.syncStatus ?? 'local-only',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
  };
  await upsertArrayItem(
    STORAGE_KEYS.tradeRecords,
    nextRecord,
    (item: TradeRecordDraft) => item.serverItemId === serverItemId,
  );
  return nextRecord;
}

export async function removeTradeRecord(serverItemId: number): Promise<TradeRecordDraft[]> {
  return removeArrayItem(
    STORAGE_KEYS.tradeRecords,
    (item: TradeRecordDraft) => item.serverItemId === serverItemId,
  );
}
