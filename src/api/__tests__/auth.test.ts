import { describe, it, expect, beforeEach, vi } from 'vitest';
import { login, register } from '../auth';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('auth API', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('login', () => {
    it('成功登录返回 token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'jwt-123' }),
      });
      const token = await login('alice', 'pass123');
      expect(token).toBe('jwt-123');
      expect(mockFetch).toHaveBeenCalledWith(
        '/chat/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ username: 'alice', password: 'pass123' }),
        }),
      );
    });

    it('登录失败抛出错误', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: '密码错误' }),
      });
      await expect(login('alice', 'wrong')).rejects.toThrow('密码错误');
    });

    it('服务器未返回 token 抛出错误', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      await expect(login('alice', 'pass')).rejects.toThrow('服务器未返回 token');
    });
  });

  describe('register', () => {
    it('成功注册不抛异常', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      await expect(register('newuser', 'pass123')).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith(
        '/chat/api/auth/register',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('注册失败抛出错误', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: '用户名已存在' }),
      });
      await expect(register('alice', 'pass')).rejects.toThrow('用户名已存在');
    });
  });
});