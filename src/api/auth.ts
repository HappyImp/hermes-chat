const API_BASE = '/chat/api';

interface AuthResponse {
  token?: string;
  error?: string;
}

function extractError(data: AuthResponse, fallback: string): string {
  return data.error || fallback;
}

export async function login(
  username: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const data: AuthResponse = await res.json().catch(() => ({}));
    throw new Error(extractError(data, `登录失败 (${res.status})`));
  }

  const data = await res.json();
  if (!data.token) throw new Error('服务器未返回 token');
  return data.token;
}

export async function register(
  username: string,
  password: string,
  invitationCode?: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, invitation_code: invitationCode }),
  });

  if (!res.ok) {
    const data: AuthResponse = await res.json().catch(() => ({}));
    throw new Error(extractError(data, `注册失败 (${res.status})`));
  }
}

export async function logout(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const data: AuthResponse = await res.json().catch(() => ({}));
    throw new Error(extractError(data, `登出失败 (${res.status})`));
  }
}
