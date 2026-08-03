import { Platform } from 'react-native';
import type { ApiEnvelope } from './api-types';
import { getAuthSession } from '@/src/storage/auth-session-storage';

const fallbackBaseUrl = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || fallbackBaseUrl).replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const session = await getAuthSession();
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}), ...init?.headers },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('REQUEST_TIMEOUT', '분석 요청 시간이 초과되었습니다. 서버 연결을 확인해 주세요.');
    }
    throw new ApiError('NETWORK_ERROR', '서버에 연결할 수 없습니다. 네트워크와 서버 주소를 확인해 주세요.');
  } finally {
    clearTimeout(timeoutId);
  }
  let envelope: ApiEnvelope<T>;
  try { envelope = await response.json() as ApiEnvelope<T>; }
  catch { throw new ApiError('INVALID_RESPONSE', '서버 응답을 해석할 수 없습니다.', response.status); }
  if (!response.ok || !envelope.ok) {
    const error = envelope.ok ? null : envelope.error;
    throw new ApiError(error?.code ?? 'HTTP_ERROR', error?.message ?? '요청에 실패했습니다.', response.status);
  }
  return envelope.data;
}

export function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined) search.set(key, String(value)); });
  return search.toString();
}
