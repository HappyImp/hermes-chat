import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChat, __testing__ } from '../useChat';
import { useSessionStore } from '@/store/sessionStore';

/** Encode SSE chunks into a ReadableStream. */
function makeStream(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  }) as unknown as ReadableStream;
}

/** A stream that never closes — simulates a hung backend. */
function makeHangingStream() {
  return new ReadableStream({ start() {} }) as unknown as ReadableStream;
}

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
    // Use tiny delays so tests don't wait real seconds
    __testing__.setReconnectDelayMs(1);
    __testing__.setChunkTimeoutMs(50);
    __testing__.setMaxReconnectAttempts(3);
  });

  // ── basic ────────────────────────────────────────────────
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
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
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
    vi.mocked(fetch).mockResolvedValue({
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
    const stream = makeStream([
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);
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

  // ── Feature 1: 超时提示 ─────────────────────────────────
  it('shows timeout hint when no chunk arrives in time', async () => {
    useSessionStore.getState().createSession('default');
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: makeHangingStream(),
    } as unknown as Response);

    const { result } = renderHook(() => useChat());
    await act(async () => {
      // chunkTimeoutMs is 50ms in tests, so 50ms should trigger
      await result.current.sendMessage('hello');
    });

    const session = useSessionStore.getState().getCurrentSession();
    expect(session?.messages[1].content).toBe('正在处理中，请耐心等待...');
    expect(useSessionStore.getState().isStreaming).toBe(false);
  });

  it('resets timeout on each incoming chunk', async () => {
    // Use a longer timeout so we can test the reset behavior
    __testing__.setChunkTimeoutMs(200);
    useSessionStore.getState().createSession('default');
    const encoder = new TextEncoder();
    let ctrl: ReadableStreamDefaultController;
    const stream = new ReadableStream({ start(c) { ctrl = c; } });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: stream,
    } as unknown as Response);

    const { result } = renderHook(() => useChat());

    // Start the request — it will wait for chunks
    let done = false;
    await act(async () => {
      const p = result.current.sendMessage('hello').then(() => { done = true; });

      // Send chunk at 100ms — within the 200ms timeout, resets it
      await new Promise((r) => setTimeout(r, 100));
      ctrl.enqueue(
        encoder.encode('data: {"choices":[{"delta":{"content":"A"}}]}\n\n'),
      );

      // Wait another 100ms — timeout was reset so it won't fire
      await new Promise((r) => setTimeout(r, 100));
      ctrl.enqueue(
        encoder.encode('data: {"choices":[{"delta":{"content":"B"}}]}\n\n'),
      );

      ctrl.enqueue(encoder.encode('data: [DONE]\n\n'));
      ctrl.close();
      await p;
    });

    expect(done).toBe(true);
    const session = useSessionStore.getState().getCurrentSession();
    expect(session?.messages[1].content).toBe('AB');
  });

  // ── Feature 2: 进度推送 ─────────────────────────────────
  it('displays progress delta then final content', async () => {
    useSessionStore.getState().createSession('default');
    const stream = makeStream([
      'data: {"progress":"⏳ 任务已派给铁壳，正在执行..."}\n\n',
      'data: {"choices":[{"delta":{"content":"部署完成"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: stream,
    } as unknown as Response);
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage('部署项目');
    });
    const session = useSessionStore.getState().getCurrentSession();
    expect(session?.messages[1].content).toBe('部署完成');
  });

  it('shows progress when only progress event arrives', async () => {
    useSessionStore.getState().createSession('default');
    const stream = makeStream([
      'data: {"progress":"⏳ 任务已派给404，正在执行..."}\n\n',
      'data: [DONE]\n\n',
    ]);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: stream,
    } as unknown as Response);
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage('写个功能');
    });
    const session = useSessionStore.getState().getCurrentSession();
    expect(session?.messages[1].content).toBe('⏳ 任务已派给404，正在执行...');
  });

  // ── Feature 3: 自动重连 ─────────────────────────────────
  it('retries on connection failure up to 3 times', async () => {
    useSessionStore.getState().createSession('default');
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('Connection lost'))
      .mockRejectedValueOnce(new Error('Connection lost'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: makeStream([
          'data: {"choices":[{"delta":{"content":"OK"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      } as unknown as Response);

    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage('hello');
    });

    expect(fetch).toHaveBeenCalledTimes(3);
    const session = useSessionStore.getState().getCurrentSession();
    expect(session?.messages[1].content).toBe('OK');
  });

  it('gives up after max reconnect failures', async () => {
    useSessionStore.getState().createSession('default');
    vi.mocked(fetch).mockRejectedValue(new Error('Network down'));

    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage('hello');
    });

    // 1 initial + 3 retries = 4
    expect(fetch).toHaveBeenCalledTimes(4);
    const session = useSessionStore.getState().getCurrentSession();
    expect(session?.messages[1].content).toContain('错误');
  });

  it('cleans up streaming state on completion', async () => {
    useSessionStore.getState().createSession('default');
    const stream = makeStream([
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: stream,
    } as unknown as Response);
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage('test');
    });
    expect(useSessionStore.getState().isStreaming).toBe(false);
  });
});
