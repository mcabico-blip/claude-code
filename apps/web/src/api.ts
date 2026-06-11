import type { UserClaims } from '@ubi/types';

const TOKEN_KEY = 'ubi.token';
const USER_KEY = 'ubi.user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): UserClaims | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as UserClaims) : null;
}

export function setSession(token: string, user: UserClaims): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearSession();
    window.location.assign('/login');
    throw new Error('session expired');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const msg = body?.message;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : (msg ?? `${res.status} ${res.statusText}`));
  }
  return (await res.json()) as T;
}

export function hasClaim(user: UserClaims | null, claim: string): boolean {
  return !!user && (user.claims.includes(claim) || user.claims.includes('role:admin'));
}
