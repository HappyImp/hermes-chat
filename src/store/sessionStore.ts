import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session, Message, ChatState } from '@/types';
import { generateId } from '@/utils';

interface SessionStore extends ChatState {
  setChannel: (channel: string) => void;
  createSession: (channel?: string) => string;
  deleteSession: (sessionId: string) => void;
  setCurrentSession: (sessionId: string) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  clearCurrentMessages: () => void;
  deleteChannel: (channel: string) => void;
  getCurrentSession: () => Session | undefined;
  getSessionTitle: (sessionId: string) => string;
}

function createEmptySession(channel: string): Session {
  return {
    id: generateId(),
    title: '新会话',
    channel,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return '新会话';
  const text = firstUser.content.slice(0, 20);
  return text.length < firstUser.content.length ? text + '...' : text;
}

/**
 * Helper to update current session in store.
 * Reduces duplication in addMessage, updateLastMessage, clearCurrentMessages.
 */
function updateCurrentSession(
  state: SessionStore,
  updater: (session: Session) => Session,
): Partial<SessionStore> {
  const channel = state.currentChannel;
  const sessions = state.sessions[channel] || [];
  const idx = sessions.findIndex((s) => s.id === state.currentSessionId);
  if (idx === -1) return state;
  const updated = updater({ ...sessions[idx] });
  updated.updatedAt = new Date().toISOString();
  const newSessions = [...sessions];
  newSessions[idx] = updated;
  return {
    sessions: { ...state.sessions, [channel]: newSessions },
  };
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      sessions: {},
      currentChannel: 'default',
      currentSessionId: null,
      isStreaming: false,

      setChannel: (channel) => {
        const { sessions } = get();
        if (!sessions[channel]) {
          const newSession = createEmptySession(channel);
          set({
            currentChannel: channel,
            sessions: { ...sessions, [channel]: [newSession] },
            currentSessionId: newSession.id,
          });
        } else {
          set({
            currentChannel: channel,
            currentSessionId: sessions[channel][0]?.id || null,
          });
        }
      },

      createSession: (channel) => {
        const ch = channel || get().currentChannel;
        const newSession = createEmptySession(ch);
        set((state) => ({
          sessions: {
            ...state.sessions,
            [ch]: [newSession, ...(state.sessions[ch] || [])],
          },
          currentSessionId: newSession.id,
          currentChannel: ch,
        }));
        return newSession.id;
      },

      deleteSession: (sessionId) => {
        set((state) => {
          const channel = state.currentChannel;
          const filtered = (state.sessions[channel] || []).filter((s) => s.id !== sessionId);
          const nextId =
            state.currentSessionId === sessionId ? filtered[0]?.id || null : state.currentSessionId;
          return {
            sessions: { ...state.sessions, [channel]: filtered },
            currentSessionId: nextId,
          };
        });
      },

      setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),

      addMessage: (message) => {
        set((state) =>
          updateCurrentSession(state, (session) => ({
            ...session,
            messages: [...session.messages, message],
            title: deriveTitle([...session.messages, message]),
          })),
        );
      },

      updateLastMessage: (content) => {
        set((state) =>
          updateCurrentSession(state, (session) => {
            const msgs = [...session.messages];
            if (msgs.length === 0) return session;
            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
            return { ...session, messages: msgs };
          }),
        );
      },

      clearCurrentMessages: () => {
        set((state) =>
          updateCurrentSession(state, (session) => ({
            ...session,
            messages: [],
            title: '新会话',
          })),
        );
      },

      deleteChannel: (channel) => {
        set((state) => {
          const { [channel]: _, ...rest } = state.sessions;
          const nextChannel = state.currentChannel === channel ? 'default' : state.currentChannel;
          if (!rest[nextChannel]) {
            const newSession = createEmptySession(nextChannel);
            return {
              sessions: { ...rest, [nextChannel]: [newSession] },
              currentChannel: nextChannel,
              currentSessionId: newSession.id,
            };
          }
          return {
            sessions: rest,
            currentChannel: nextChannel,
            currentSessionId: rest[nextChannel]?.[0]?.id || null,
          };
        });
      },

      getCurrentSession: () => {
        const { sessions, currentChannel, currentSessionId } = get();
        return (sessions[currentChannel] || []).find((s) => s.id === currentSessionId);
      },

      getSessionTitle: (sessionId) => {
        const { sessions, currentChannel } = get();
        const session = (sessions[currentChannel] || []).find((s) => s.id === sessionId);
        return session?.title || '新会话';
      },
    }),
    {
      name: 'hermes_chat_sessions',
      partialize: (state) => {
        // isStreaming 是运行时状态，不应持久化到 localStorage
        const { isStreaming, ...rest } = state;
        return rest;
      },
      merge: (persisted, current) => {
        // 防止旧 localStorage 中残留的 isStreaming: true 被恢复
        return { ...current, ...(persisted as Partial<SessionStore>), isStreaming: false };
      },
    },
  ),
);
