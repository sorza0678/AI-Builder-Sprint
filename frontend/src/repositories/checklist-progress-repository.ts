import { CURRENT_STORAGE_SCHEMA_VERSION, STORAGE_KEYS } from '@/src/storage/storage-keys';
import { getArray, removeArrayItem, upsertArrayItem } from '@/src/storage/storage-client';
import { createGuestScopedLocalId } from '@/src/storage/guest-id-storage';
import type { ChecklistProgressItem, TradeChecklistProgress } from '@/src/storage/storage-types';

function createProgress(
  serverItemId: number,
  checklist: { id: string; text: string }[],
  existing?: TradeChecklistProgress,
): TradeChecklistProgress {
  const now = new Date().toISOString();
  const existingItems = existing?.items ?? [];

  return {
    localId: existing?.localId ?? createGuestScopedLocalId('checklist-progress'),
    serverItemId,
    items: checklist.map((item) => {
      const existingItem = existingItems.find((candidate) => candidate.id === item.id);
      return {
        id: item.id,
        text: item.text,
        checked: existingItem?.checked ?? false,
        memo: existingItem?.memo,
      };
    }),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
  };
}

async function getAllChecklistProgress(): Promise<TradeChecklistProgress[]> {
  return getArray<TradeChecklistProgress>(STORAGE_KEYS.checklistProgress);
}

export async function getChecklistProgress(
  serverItemId: number,
): Promise<TradeChecklistProgress | undefined> {
  return (await getAllChecklistProgress()).find((progress) => progress.serverItemId === serverItemId);
}

export async function saveGeneratedChecklist(
  serverItemId: number,
  checklist: { id: string; text: string }[],
): Promise<TradeChecklistProgress> {
  const existing = await getChecklistProgress(serverItemId);
  const progress = createProgress(serverItemId, checklist, existing);
  await upsertArrayItem(
    STORAGE_KEYS.checklistProgress,
    progress,
    (item: TradeChecklistProgress) => item.serverItemId === serverItemId,
  );
  return progress;
}

export async function toggleChecklistItem(
  serverItemId: number,
  itemId: string,
): Promise<TradeChecklistProgress | undefined> {
  const progress = await getChecklistProgress(serverItemId);

  if (!progress) {
    return undefined;
  }

  const nextProgress: TradeChecklistProgress = {
    ...progress,
    items: progress.items.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item,
    ),
    updatedAt: new Date().toISOString(),
  };
  await upsertArrayItem(
    STORAGE_KEYS.checklistProgress,
    nextProgress,
    (item: TradeChecklistProgress) => item.serverItemId === serverItemId,
  );
  return nextProgress;
}

export async function updateChecklistItemMemo(
  serverItemId: number,
  itemId: string,
  memo: string,
): Promise<TradeChecklistProgress | undefined> {
  const progress = await getChecklistProgress(serverItemId);

  if (!progress) {
    return undefined;
  }

  const nextProgress: TradeChecklistProgress = {
    ...progress,
    items: progress.items.map((item): ChecklistProgressItem =>
      item.id === itemId ? { ...item, memo } : item,
    ),
    updatedAt: new Date().toISOString(),
  };
  await upsertArrayItem(
    STORAGE_KEYS.checklistProgress,
    nextProgress,
    (item: TradeChecklistProgress) => item.serverItemId === serverItemId,
  );
  return nextProgress;
}

export async function resetChecklistProgress(serverItemId: number): Promise<void> {
  await removeArrayItem(
    STORAGE_KEYS.checklistProgress,
    (item: TradeChecklistProgress) => item.serverItemId === serverItemId,
  );
}
