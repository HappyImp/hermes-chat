const API_BASE = '/chat/api';

interface AuthResponse {
  token?: string;
  message?: string;
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
    throw new Error(data.message || `登录失败 (${res.status})`);
  }

  const data = await res.json();
  if (!data.token) throw new Error('服务器未返回 token');
  return data.token;
}

export async function register(
  username: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const data: AuthResponse = await res.json().catch(() => ({}));
    throw new Error(data.message || `注册失败 (${res.status})`);
  }
}