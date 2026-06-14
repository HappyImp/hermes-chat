import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from './App';
import { useSessionStore } from '@/store/sessionStore';
import { useAuthStore } from '@/store/authStore';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState({
      sessions: {},
      currentChannel: 'default',
      currentSessionId: null,
      isStreaming: false,
    });
    useAuthStore.setState({
      token: null,
      username: null,
      isAuthenticated: false,
    });
  });

  it('未登录显示登录页', () => {
    render(<App />);
    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument();
  });

  it('已登录显示聊天界面', () => {
    useAuthStore.getState().login('token', 'alice');
    // Need to create a session for the chat to render
    render(<App />);
    expect(screen.getByText('Hermes Agent')).toBeInTheDocument();
  });

  it('已登录时切换侧边栏', () => {
    useAuthStore.getState().login('token', 'alice');
    render(<App />);
    const menuBtn = screen.getByLabelText('Toggle sidebar');
    fireEvent.click(menuBtn);
    expect(screen.getByText('Hermes Chat')).toBeInTheDocument();
  });

  it('已登录时侧边栏有登出按钮', () => {
    useAuthStore.getState().login('token', 'alice');
    render(<App />);
    expect(screen.getByText(/登出/)).toBeInTheDocument();
  });
});