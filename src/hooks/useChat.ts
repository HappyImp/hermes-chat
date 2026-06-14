import { useCallback, useRef } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useAuthStore } from '@/store/authStore';
import { renderMarkdown, generateId } from '@/utils';

const API_URL = '/chat/v1/chat/completions';
const CHUNK_TIMEOUT_MS = 60_000;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 1_000;

/** Overridable for testing. */
let chunkTimeoutMs = CHUNK_TIMEOUT_MS;
let maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;
let reconnectDelayMs = RECONNECT_DELAY_MS;

export const __testing__ = {
  setChunkTimeoutMs(v: number) {
    chunkTimeoutMs = v;
  },
  setMaxReconnectAttempts(v: number) {
    maxReconnectAttempts = v;
  },
  setReconnectDelayMs(v: number) {
    reconnectDelayMs = v;
  },
  resetDefaults() {
    chunkTimeoutMs = CHUNK_TIMEOUT_MS;
    maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;
    reconnectDelayMs = RECONNECT_DELAY_MS;
  },
};

/**
 * Parse SSE text from a buffer.
 * Returns [leftover, accumulatedContent, progressMessage].
 */
function parseSSEChunk(
  buffer: string,
  full: string,
): [string, string, string | null] {
  const lines = buffer.split(/\r?\n/);
  const leftover = lines.pop() ?? '';
  let progress: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const data = trimmed.slice(5).trim();
    if (data === '[DONE]') continue;
    try {
      const parsed = JSON.parse(data);
      if (parsed.progress) {
        progress = parsed.progress;
        continue;
      }
      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) full += delta;
    } catch {
      // skip malformed JSON
    }
  }
  return [leftover, full, progress];
}

/**
 * Consume SSE stream. Listens on signal to cancel the reader when aborted.
 * Returns [content, hadProgress].
 */
async function consumeSSEStream(
  resp: Response,
  signal: AbortSignal,
  onContent: (content: string) => void,
  onProgress: (msg: string) => void,
  resetTimeout: () => void,
): Promise<[string, boolean]> {
  let full = '';
  let hadProgress = false;

  if (resp.body) {
    const reader = resp.body.getReader();
    // Cancel reader when the signal fires (e.g. timeout)
    const onAbort = () => {
      try { reader.cancel(); } catch { /* already closed */ }
    };
    signal.addEventListener('abort', onAbort, { once: true });

    try {
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        resetTimeout();
        buffer += decoder.decode(value, { stream: true });
        let progress: string | null;
        [buffer, full, progress] = parseSSEChunk(buffer, full);
        if (progress) { onProgress(progress); hadProgress = true; }
        if (full) onContent(full);
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        [, full] = parseSSEChunk(buffer + '\n', full);
      }
    } catch {
      if (!signal.aborted) throw new Error('Stream read failed');
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  } else {
    const text = await resp.text();
    [, full] = parseSSEChunk(text + '\n', '');
  }

  return [full, hadProgress];
}

export function useChat() {
  const { addMessage, updateLastMessage, isStreaming } = useSessionStore();
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      addMessage({ id: generateId(), role: 'user', content: text });
      addMessage({ id: generateId(), role: 'assistant', content: '' });
      useSessionStore.setState({ isStreaming: true });

      let attempts = 0;

      try {
        while (attempts <= maxReconnectAttempts) {
          try {
            await attemptSend({
              getMessages: () => {
                const session = useSessionStore.getState().getCurrentSession();
                return session?.messages.filter((m) => m.content) ?? [];
              },
              updateLastMessage,
              abortRef,
            });
            break;
          } catch (e: unknown) {
            const isAbort =
              e instanceof DOMException && e.name === 'AbortError';
            if (isAbort) break;

            attempts++;
            if (attempts > maxReconnectAttempts) throw e;

            await new Promise((r) =>
              setTimeout(r, reconnectDelayMs * attempts),
            );
            updateLastMessage(
              `连接中断，正在重连 (${attempts}/${maxReconnectAttempts})...`,
            );
          }
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : '未知错误';
        updateLastMessage(`错误: ${error}`);
      } finally {
        abortRef.current?.abort();
        abortRef.current = null;
        useSessionStore.setState({ isStreaming: false });
      }
    },
    [addMessage, updateLastMessage],
  );

  return { sendMessage, isStreaming, renderMarkdown };
}

async function attemptSend(opts: {
  getMessages: () => Array<{ role: string; content: string }>;
  updateLastMessage: (c: string) => void;
  abortRef: React.MutableRefObject<AbortController | null>;
}): Promise<void> {
  const { getMessages, updateLastMessage, abortRef } = opts;

  const controller = new AbortController();
  abortRef.current = controller;

  let chunkTimer: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;

  const resetTimeout = () => {
    if (chunkTimer) clearTimeout(chunkTimer);
    chunkTimer = setTimeout(() => {
      timedOut = true;
      updateLastMessage('正在处理中，请耐心等待...');
      controller.abort(); // triggers reader.cancel() in consumeSSEStream
    }, chunkTimeoutMs);
  };

  resetTimeout();

  let pendingError: Error | undefined;
  try {
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const resp = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'hermes-agent',
        messages: getMessages(),
        stream: true,
      }),
      signal: controller.signal,
    });

    if (resp.status === 401) {
      await useAuthStore.getState().logout();
      throw new Error('认证已过期，请重新登录');
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const [full, hadProgress] = await consumeSSEStream(
      resp,
      controller.signal,
      (content) => updateLastMessage(content),
      (progress) => updateLastMessage(progress),
      resetTimeout,
    );

    if (full) {
      updateLastMessage(full);
    } else if (!timedOut && !hadProgress) {
      updateLastMessage('（无响应）');
    }
  } finally {
    if (chunkTimer) clearTimeout(chunkTimer);
    if (timedOut) {
      pendingError = new DOMException('Chunk timeout', 'AbortError');
    }
  }
  if (pendingError) throw pendingError;
}