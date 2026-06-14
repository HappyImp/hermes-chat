import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginPage } from '../LoginPage';
import { useAuthStore } from '@/store/authStore';

// Mock auth API
vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
}));

import { login, register } from '@/api/auth';
const mockLogin = vi.mocked(login);
const mockRegister = vi.mocked(register);

/** Get the submit button (type=submit, not the tab button). */
function getSubmitButton() {
  return screen.getByText((_, el) => {
    return el?.tagName === 'BUTTON' && el.getAttribute('type') === 'submit';
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      token: null,
      username: null,
      isAuthenticated: false,
    });
    mockLogin.mockReset();
    mockRegister.mockReset();
  });

  it('渲染登录表单', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument();
    expect(screen.getByText('登录以继续')).toBeInTheDocument();
  });

  it('切换到注册模式', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByText('注册'));
    expect(screen.getByText('注册并登录')).toBeInTheDocument();
  });

  it('空输入提交显示错误', async () => {
    render(<LoginPage />);
    fireEvent.click(getSubmitButton());
    await waitFor(() => {
      expect(screen.getByText('用户名和密码不能为空')).toBeInTheDocument();
    });
  });

  it('登录成功调用 authStore.login', async () => {
    mockLogin.mockResolvedValue('jwt-token');
    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('用户名'), {
      target: { value: 'alice' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'pass123' },
    });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().token).toBe('jwt-token');
    });
  });

  it('注册模式先注册再登录', async () => {
    mockRegister.mockResolvedValue(undefined);
    mockLogin.mockResolvedValue('jwt-new');
    render(<LoginPage />);

    fireEvent.click(screen.getByText('注册'));
    fireEvent.change(screen.getByPlaceholderText('用户名'), {
      target: { value: 'newuser' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'pass123' },
    });
    fireEvent.click(screen.getByText('注册并登录'));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('newuser', 'pass123');
      expect(mockLogin).toHaveBeenCalledWith('newuser', 'pass123');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
  });

  it('登录失败显示错误信息', async () => {
    mockLogin.mockRejectedValue(new Error('密码错误'));
    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('用户名'), {
      target: { value: 'alice' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText('密码错误')).toBeInTheDocument();
    });
  });
});