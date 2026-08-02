import { apiRequest } from './api-client';
import { saveAuthSession, type AuthSession } from '@/src/storage/auth-session-storage';

interface AuthData {
  user_id: string;
  nickname: string | null;
  token: string;
  expires_at: number;
}

export async function signIn(accountId: string, password: string, previousGuestUserId: string): Promise<AuthSession> {
  const auth = await apiRequest<AuthData>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ user_id: accountId.trim(), password }),
  });
  return completeAuthentication(auth, previousGuestUserId);
}

export async function signUp(accountId: string, password: string, previousGuestUserId: string): Promise<AuthSession> {
  const auth = await apiRequest<AuthData>('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ user_id: accountId.trim(), password }),
  });
  return completeAuthentication(auth, previousGuestUserId);
}

async function completeAuthentication(auth: AuthData, previousGuestUserId: string): Promise<AuthSession> {
  const session = await saveAuthSession(auth, previousGuestUserId);
  if (previousGuestUserId.startsWith('guest-')) {
    await apiRequest('/api/v1/account/migrate-guest', {
      method: 'POST',
      body: JSON.stringify({ guest_user_id: previousGuestUserId }),
    }).catch(() => undefined);
  }
  return session;
}
