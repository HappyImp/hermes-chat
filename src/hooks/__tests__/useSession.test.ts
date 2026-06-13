import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSession } from '../useSession';
import { useSessionStore } from '@/store/sessionStore';

describe('useSession', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState({
      sessions: {},
      currentChannel: 'default',
      currentSessionId: null,
      isStreaming: false,
    });
  });

  it('returns empty messages when no session', () => {
    const { result } = renderHook(() => useSession());
    expect(result.current.messages).toEqual([]);
  });

  it('returns current session messages', () => {
    act(() => {
      useSessionStore.getState().createSession('default');
      useSessionStore.getState().addMessage({ role: 'user', content: 'test' });
    });
    const { result } = renderHook(() => useSession());
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('test');
  });

  it('creates new session', () => {
    const { result } = renderHook(() => useSession());
    act(() => result.current.createSession());
    expect(result.current.sessions).toHaveLength(1);
  });

  it('deletes session', () => {
    const { result } = renderHook(() => useSession());
    let sessionId: string;
    act(() => {
      sessionId = result.current.createSession();
    });
    act(() => result.current.deleteSession(sessionId!));
    expect(result.current.sessions).toHaveLength(0);
  });

  it('returns all channels', () => {
    act(() => {
      useSessionStore.getState().createSession('default');
      useSessionStore.getState().setChannel('test');
    });
    const { result } = renderHook(() => useSession());
    expect(result.current.allChannels).toContain('default');
    expect(result.current.allChannels).toContain('test');
  });

  it('clears chat', () => {
    act(() => {
      useSessionStore.getState().createSession('default');
      useSessionStore.getState().addMessage({ role: 'user', content: 'test' });
    });
    const { result } = renderHook(() => useSession());
    act(() => result.current.clearChat());
    expect(result.current.messages).toHaveLength(0);
  });

  it('returns channel name', () => {
    act(() => useSessionStore.getState().createSession('default'));
    const { result } = renderHook(() => useSession());
    expect(result.current.channel).toBe('default');
  });
});
