import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logout as logoutApi } from '../api/auth';

interface AuthState {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  login: (token: string, username: string) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      username: null,
      isAuthenticated: false,

      login: (token, username) =>
        set({ token, username, isAuthenticated: true }),

      logout: async () => {
        const { token } = get();
        // 尝试通知服务端失效 token，失败也不阻塞本地清理
        if (token) {
          try {
            await logoutApi(token);
          } catch {
            // 服务端调用失败仍清本地状态（网络异常时不卡死用户）
          }
        }
        set({ token: null, username: null, isAuthenticated: false });
      },
    }),
    {
      name: 'hermes_chat_auth',
    },
  ),
);

/** Get the current auth token (for use outside React components). */
export function getAuthToken(): string | null {
  return useAuthStore.getState().token;
}