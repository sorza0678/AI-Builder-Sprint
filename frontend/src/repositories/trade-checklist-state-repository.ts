import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredTradeMethod = 'inPerson' | 'delivery' | 'undecided';

// 체크/제외 상태는 /api/v1/checklist-state 서버 동기화로 이전됨 (checklist-state-service.ts).
// trade_method는 해당 API 응답에 없는 필드라 여기 로컬에만 계속 보관한다.
export interface TradeMethodState {
  tradeMethod: StoredTradeMethod;
}

const PREFIX = 'baton:trade-checklist-state:';

export async function getTradeMethod(itemId: number): Promise<StoredTradeMethod | undefined> {
  const value = await AsyncStorage.getItem(`${PREFIX}${itemId}`);
  if (!value) return undefined;
  try {
    return (JSON.parse(value) as TradeMethodState).tradeMethod;
  } catch {
    return undefined;
  }
}

export async function saveTradeMethod(itemId: number, tradeMethod: StoredTradeMethod): Promise<void> {
  await AsyncStorage.setItem(`${PREFIX}${itemId}`, JSON.stringify({ tradeMethod } satisfies TradeMethodState));
}
