import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_SESSION_KEY = 'baton:auth:session';

export interface AuthSession {
  accountId: string;
  nickname: string | null;
  token: string;
  expiresAt: number;
  previousGuestUserId: string | null;
  loggedInAt: string;
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const value = await AsyncStorage.getItem(AUTH_SESSION_KEY);
  if (!value) return null;

  try {
    const session = JSON.parse(value) as Partial<AuthSession>;
    if (typeof session.accountId !== 'string' || typeof session.loggedInAt !== 'string'
      || typeof session.token !== 'string' || typeof session.expiresAt !== 'number') {
      return null;
    }
    if (session.expiresAt * 1000 <= Date.now()) {
      await AsyncStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return {
      accountId: session.accountId,
      nickname: typeof session.nickname === 'string' ? session.nickname : null,
      token: session.token,
      expiresAt: session.expiresAt,
      previousGuestUserId:
        typeof session.previousGuestUserId === 'string' ? session.previousGuestUserId : null,
      loggedInAt: session.loggedInAt,
    };
  } catch {
    return null;
  }
}

export async function saveAuthSession(
  auth: { user_id: string; nickname: string | null; token: string; expires_at: number },
  previousGuestUserId: string,
): Promise<AuthSession> {
  const session: AuthSession = {
    accountId: auth.user_id,
    nickname: auth.nickname,
    token: auth.token,
    expiresAt: auth.expires_at,
    previousGuestUserId,
    loggedInAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_SESSION_KEY);
}
