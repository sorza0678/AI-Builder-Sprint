import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredTradeMethod = 'inPerson' | 'delivery' | 'undecided';

export interface TradeChecklistState {
  tradeMethod: StoredTradeMethod;
  checkedTexts: string[];
  excludedTexts: string[];
  updatedAt: string;
}

const PREFIX = 'baton:trade-checklist-state:';

export async function getTradeChecklistState(itemId: number): Promise<TradeChecklistState | undefined> {
  const value = await AsyncStorage.getItem(`${PREFIX}${itemId}`);
  if (!value) return undefined;
  try {
    return JSON.parse(value) as TradeChecklistState;
  } catch {
    return undefined;
  }
}

export async function saveTradeChecklistState(
  itemId: number,
  state: Omit<TradeChecklistState, 'updatedAt'>,
): Promise<void> {
  await AsyncStorage.setItem(`${PREFIX}${itemId}`, JSON.stringify({
    ...state,
    updatedAt: new Date().toISOString(),
  } satisfies TradeChecklistState));
}
