import { STORAGE_KEYS } from './storage-keys';
import { getJson, setJson } from './storage-client';

function createLocalId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${randomPart}`;
}

export function createGuestScopedLocalId(prefix: string): string {
  return `${prefix}-${createLocalId()}`;
}

export async function getOrCreateGuestId(): Promise<string> {
  const existingId = await getJson<string | null>(STORAGE_KEYS.guestId, null);

  if (existingId?.startsWith('guest-')) {
    return existingId;
  }

  const nextId = `guest-${createLocalId()}`;
  await setJson(STORAGE_KEYS.guestId, nextId);
  return nextId;
}
