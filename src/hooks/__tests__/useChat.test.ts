import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChat } from '../useChat';
import { useSessionStore } from '@/store/sessionStore';

describe('useChat', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState({
      sessions: {},
      currentChannel: 'default',
      currentSessionId: null,
      isStreaming: false,
    });
    vi.restoreAllMocks();
  });

  it('does not send empty message', async () => {
    useSessionStore.getState().createSession('default');
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage('');
    });
    const session = useSessionStore.getState().getCurrentSession();
    expect(session?.messages).toHaveLength(0);
  });

  it('handles fetch error', async () => {
    useSessionStore.getState().createSession('default');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage('hello');
    });
    const session = useSessionStore.getState().getCurrentSession();
    expect(session?.messages).toHaveLength(2);
    expect(session?.messages[1].content).toContain('错误');
  });

  it('handles HTTP error', async () => {
    useSessionStore.getState().createSession('default');
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage('hello');
    });
    const session = useSessionStore.getState().getCurrentSession();
    expect(session?.messages[1].content).toContain('错误');
  });

  it('sends message and processes SSE response', async () => {
    useSessionStore.getState().createSession('default');
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: stream,
    } as unknown as Response);
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage('hello');
    });
    const session = useSessionStore.getState().getCurrentSession();
    expect(session?.messages[1].content).toBe('Hi');
  });
});
