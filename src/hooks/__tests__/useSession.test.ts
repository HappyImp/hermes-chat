import { describe, it, expect, beforeEach, vi } from 'vitest';
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
      useSessionStore.getState().addMessage({ id: 'test-id', role: 'user', content: 'test' });
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
      useSessionStore.getState().addMessage({ id: 'test-id', role: 'user', content: 'test' });
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

  it('exports chat as markdown', () => {
    act(() => {
      useSessionStore.getState().createSession('default');
      useSessionStore.getState().addMessage({ id: 'test-id', role: 'user', content: 'Hello' });
      useSessionStore.getState().addMessage({ id: 'test-id', role: 'assistant', content: 'Hi' });
    });
    const { result } = renderHook(() => useSession());
    
    // Mock download functionality
    const mockClick = vi.fn();
    const mockAnchor = document.createElement('a');
    mockAnchor.click = mockClick as unknown as HTMLAnchorElement['click'];
    const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test');
    const mockRevokeObjectURL = vi.fn();
    const urlObj = URL as unknown as Record<string, unknown>;
    urlObj.createObjectURL = mockCreateObjectURL;
    urlObj.revokeObjectURL = mockRevokeObjectURL;

    act(() => result.current.exportChat());

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test');

    mockCreateElement.mockRestore();
  });

  it('returns empty string when exporting empty chat', () => {
    const { result } = renderHook(() => useSession());
    // Should not throw when no session
    act(() => result.current.exportChat());
  });
});
