import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, getAuthToken } from '../authStore';

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      token: null,
      username: null,
      isAuthenticated: false,
    });
  });

  it('初始状态未认证', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.username).toBeNull();
  });

  it('login 设置 token 和用户名', () => {
    useAuthStore.getState().login('test-token', 'alice');
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('test-token');
    expect(state.username).toBe('alice');
  });

  it('logout 清除认证状态', () => {
    useAuthStore.getState().login('test-token', 'alice');
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.username).toBeNull();
  });

  it('getAuthToken 返回当前 token', () => {
    expect(getAuthToken()).toBeNull();
    useAuthStore.getState().login('my-token', 'bob');
    expect(getAuthToken()).toBe('my-token');
  });
});