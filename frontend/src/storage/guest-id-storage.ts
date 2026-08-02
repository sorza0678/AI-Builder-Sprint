import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthSession } from './auth-session-storage';
const KEY = 'baton:guest:id';
export async function getOrCreateGuestId(): Promise<string> {
  const session = await getAuthSession();
  if (session) return session.accountId;

  return getOrCreateDeviceGuestId();
}

export async function getOrCreateDeviceGuestId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY);
  if (existing?.startsWith('guest-')) return existing;
  const id = `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(KEY, id);
  return id;
}
