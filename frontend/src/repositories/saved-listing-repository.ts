import type { AnalysisResult } from '@/src/types/marketplace';

import { CURRENT_STORAGE_SCHEMA_VERSION, STORAGE_KEYS } from '@/src/storage/storage-keys';
import { getArray, removeArrayItem, upsertArrayItem } from '@/src/storage/storage-client';
import { createGuestScopedLocalId } from '@/src/storage/guest-id-storage';
import type { SavedListingSnapshot } from '@/src/storage/storage-types';

export function getServerItemIdFromAnalysis(result: AnalysisResult): number {
  const numericId = Number(result.id.replace(/\D/g, ''));
  return Number.isFinite(numericId) && numericId > 0 ? numericId : 0;
}

function createSavedListingSnapshot(result: AnalysisResult): SavedListingSnapshot {
  const now = new Date().toISOString();
  const serverItemId = getServerItemIdFromAnalysis(result);

  return {
    localId: createGuestScopedLocalId('saved-listing'),
    serverItemId,
    title: result.listing.title,
    price: result.listing.price,
    marketPriceAverage: result.marketPrice.average,
    conditionGrade: result.conditionGrade,
    riskLevel: result.riskLevel,
    imageUrl: result.listing.imageUrl,
    sourceUrl: result.listing.sourceUrl,
    syncStatus: 'local-only',
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
  };
}

export async function getSavedListings(): Promise<SavedListingSnapshot[]> {
  return getArray<SavedListingSnapshot>(STORAGE_KEYS.savedListings);
}

export async function saveListing(result: AnalysisResult): Promise<SavedListingSnapshot[]> {
  const serverItemId = getServerItemIdFromAnalysis(result);
  const existing = (await getSavedListings()).find((item) => item.serverItemId === serverItemId);
  const snapshot = {
    ...createSavedListingSnapshot(result),
    localId: existing?.localId ?? createGuestScopedLocalId('saved-listing'),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  return upsertArrayItem(
    STORAGE_KEYS.savedListings,
    snapshot,
    (item: SavedListingSnapshot) => item.serverItemId === serverItemId,
  );
}

export async function removeSavedListing(serverItemId: number): Promise<SavedListingSnapshot[]> {
  return removeArrayItem(
    STORAGE_KEYS.savedListings,
    (item: SavedListingSnapshot) => item.serverItemId === serverItemId,
  );
}

export async function isListingSaved(serverItemId: number): Promise<boolean> {
  return (await getSavedListings()).some((item) => item.serverItemId === serverItemId);
}

export async function toggleSavedListing(
  result: AnalysisResult,
): Promise<{ saved: boolean; items: SavedListingSnapshot[] }> {
  const serverItemId = getServerItemIdFromAnalysis(result);

  if (await isListingSaved(serverItemId)) {
    return {
      saved: false,
      items: await removeSavedListing(serverItemId),
    };
  }

  return {
    saved: true,
    items: await saveListing(result),
  };
}
