import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_SESSION_KEY = 'baton:auth:session';

export interface AuthSession {
  accountId: string;
  previousGuestUserId: string | null;
  loggedInAt: string;
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const value = await AsyncStorage.getItem(AUTH_SESSION_KEY);
  if (!value) return null;

  try {
    const session = JSON.parse(value) as Partial<AuthSession>;
    if (typeof session.accountId !== 'string' || typeof session.loggedInAt !== 'string') {
      return null;
    }
    return {
      accountId: session.accountId,
      previousGuestUserId:
        typeof session.previousGuestUserId === 'string' ? session.previousGuestUserId : null,
      loggedInAt: session.loggedInAt,
    };
  } catch {
    return null;
  }
}

export async function signInWithMockAccount(
  accountId: string,
  password: string,
  previousGuestUserId: string,
): Promise<AuthSession | null> {
  if (accountId.trim() !== 'baton001' || password !== '1234') return null;

  const session: AuthSession = {
    accountId: 'baton001',
    previousGuestUserId,
    loggedInAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_SESSION_KEY);
}
