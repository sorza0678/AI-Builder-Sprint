import AsyncStorage from '@react-native-async-storage/async-storage';

type MatchItem<T> = (item: T) => boolean;

export async function getJson<T>(key: string, fallback: T): Promise<T> {
  const rawValue = await AsyncStorage.getItem(key);

  if (rawValue === null) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

export async function setJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function remove(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export async function getArray<T>(key: string): Promise<T[]> {
  const value = await getJson<unknown>(key, []);
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function upsertArrayItem<T>(
  key: string,
  nextItem: T,
  matchesItem: MatchItem<T>,
): Promise<T[]> {
  const currentItems = await getArray<T>(key);
  const nextItems = currentItems.some(matchesItem)
    ? currentItems.map((item) => (matchesItem(item) ? nextItem : item))
    : [nextItem, ...currentItems];

  await setJson(key, nextItems);
  return nextItems;
}

export async function removeArrayItem<T>(
  key: string,
  matchesItem: MatchItem<T>,
): Promise<T[]> {
  const nextItems = (await getArray<T>(key)).filter((item) => !matchesItem(item));
  await setJson(key, nextItems);
  return nextItems;
}
