import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'baton:explicit-trade-selection-ids';

export async function markTradeSelection(itemId: number): Promise<void> {
  const ids = await getTradeSelectionIds();
  if (ids.includes(itemId)) return;
  await AsyncStorage.setItem(KEY, JSON.stringify([...ids, itemId]));
}

export async function getTradeSelectionIds(): Promise<number[]> {
  const value = await AsyncStorage.getItem(KEY);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is number => Number.isInteger(item))
      : [];
  } catch {
    return [];
  }
}
