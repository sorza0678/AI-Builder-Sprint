import { CURRENT_STORAGE_SCHEMA_VERSION, STORAGE_KEYS } from '@/src/storage/storage-keys';
import { getJson, setJson, remove } from '@/src/storage/storage-client';
import type { ComparisonCart } from '@/src/storage/storage-types';

const MAX_COMPARISON_ITEMS = 3;
const EMPTY_CART: ComparisonCart = {
  serverItemIds: [],
  updatedAt: '',
  schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
};

export type AddComparisonResult =
  | { ok: true; itemIds: number[] }
  | { ok: false; reason: 'MAX_ITEMS' | 'ALREADY_EXISTS'; itemIds: number[] };

function normalizeCart(cart: ComparisonCart): ComparisonCart {
  return {
    serverItemIds: Array.from(new Set(cart.serverItemIds)).slice(0, MAX_COMPARISON_ITEMS),
    updatedAt: cart.updatedAt,
    schemaVersion: cart.schemaVersion || CURRENT_STORAGE_SCHEMA_VERSION,
  };
}

export async function getComparisonCart(): Promise<ComparisonCart> {
  return normalizeCart(await getJson<ComparisonCart>(STORAGE_KEYS.comparisonCart, EMPTY_CART));
}

export async function addToComparisonCart(serverItemId: number): Promise<AddComparisonResult> {
  const cart = await getComparisonCart();

  if (cart.serverItemIds.includes(serverItemId)) {
    return { ok: false, reason: 'ALREADY_EXISTS', itemIds: cart.serverItemIds };
  }

  if (cart.serverItemIds.length >= MAX_COMPARISON_ITEMS) {
    return { ok: false, reason: 'MAX_ITEMS', itemIds: cart.serverItemIds };
  }

  const nextCart: ComparisonCart = {
    serverItemIds: [...cart.serverItemIds, serverItemId],
    updatedAt: new Date().toISOString(),
    schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
  };
  await setJson(STORAGE_KEYS.comparisonCart, nextCart);

  return { ok: true, itemIds: nextCart.serverItemIds };
}

export async function removeFromComparisonCart(serverItemId: number): Promise<ComparisonCart> {
  const cart = await getComparisonCart();
  const nextCart: ComparisonCart = {
    serverItemIds: cart.serverItemIds.filter((itemId) => itemId !== serverItemId),
    updatedAt: new Date().toISOString(),
    schemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
  };
  await setJson(STORAGE_KEYS.comparisonCart, nextCart);
  return nextCart;
}

export async function clearComparisonCart(): Promise<void> {
  await remove(STORAGE_KEYS.comparisonCart);
}

export async function isInComparisonCart(serverItemId: number): Promise<boolean> {
  return (await getComparisonCart()).serverItemIds.includes(serverItemId);
}
