import type { AnalysisDraft } from '@/src/types/analysis-input';

import { CURRENT_STORAGE_SCHEMA_VERSION, STORAGE_KEYS } from '@/src/storage/storage-keys';
import { getJson, remove, setJson } from '@/src/storage/storage-client';
import type { StoredAnalysisDraft } from '@/src/storage/storage-types';

const EMPTY_DRAFT: StoredAnalysisDraft = {
  draft: { url: '', image: null },
  updatedAt: '',
  schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
};

export async function getAnalysisDraft(): Promise<StoredAnalysisDraft> {
  return getJson<StoredAnalysisDraft>(STORAGE_KEYS.analysisDraft, EMPTY_DRAFT);
}

export async function saveAnalysisDraft(draft: AnalysisDraft): Promise<StoredAnalysisDraft> {
  const storedDraft: StoredAnalysisDraft = {
    draft,
    updatedAt: new Date().toISOString(),
    schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
  };
  await setJson(STORAGE_KEYS.analysisDraft, storedDraft);
  return storedDraft;
}

export async function clearAnalysisDraft(): Promise<void> {
  await remove(STORAGE_KEYS.analysisDraft);
}
