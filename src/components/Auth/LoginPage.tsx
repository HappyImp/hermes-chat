import { useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { login as apiLogin, register as apiRegister } from '@/api/auth';

type Mode = 'login' | 'register';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const authLogin = useAuthStore((s) => s.login);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!username.trim() || !password.trim()) {
        setError('用户名和密码不能为空');
        return;
      }

      if (mode === 'register' && password.length < 6) {
        setError('密码至少需要 6 位');
        return;
      }

      setLoading(true);
      try {
        if (mode === 'register') {
          await apiRegister(username, password);
        }
        const token = await apiLogin(username, password);
        authLogin(token, username);
      } catch (err) {
        setError(err instanceof Error ? err.message : '操作失败');
      } finally {
        setLoading(false);
      }
    },
    [mode, username, password, authLogin],
  );

  return (
    <div className="flex items-center justify-center h-screen bg-bg">
      <div className="w-full max-w-sm p-6 bg-surface rounded-lg border border-border">
        <h1 className="text-xl font-bold text-text text-center mb-1">
          Hermes Chat
        </h1>
        <p className="text-sm text-text2 text-center mb-6">
          {mode === 'login' ? '登录以继续' : '创建新账户'}
        </p>

        {/* Tab switcher */}
        <div className="flex mb-4 border-b border-border">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium cursor-pointer bg-transparent border-none transition-colors ${
              mode === 'login'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text2 hover:text-text'
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium cursor-pointer bg-transparent border-none transition-colors ${
              mode === 'register'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text2 hover:text-text'
            }`}
          >
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 bg-bg border border-border rounded-md text-text text-sm outline-none focus:border-accent"
            autoComplete="username"
          />
          <div>
            <input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-bg border border-border rounded-md text-text text-sm outline-none focus:border-accent"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'register' && (
              <p className="text-text2 text-xs mt-1">至少 6 位</p>
            )}
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-accent text-white rounded-md text-sm font-medium cursor-pointer disabled:opacity-50 border-none"
          >
            {loading ? '处理中...' : mode === 'login' ? '登录' : '注册并登录'}
          </button>
        </form>
      </div>
    </div>
  );
}