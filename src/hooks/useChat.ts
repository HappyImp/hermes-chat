import { useCallback } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { renderMarkdown, generateId } from '@/utils';

const API_URL = '/chat/v1/chat/completions';

/**
 * Parse SSE text from a buffer. Handles \n and \r\n line endings.
 * Returns [leftover, accumulatedContent].
 */
function parseSSEChunk(buffer: string, full: string): [string, string] {
  const lines = buffer.split(/\r?\n/);
  const leftover = lines.pop() ?? '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const data = trimmed.slice(5).trim();
    if (data === '[DONE]') continue;
    try {
      const parsed = JSON.parse(data);
      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) full += delta;
    } catch {
      // skip malformed JSON
    }
  }
  return [leftover, full];
}

export function useChat() {
  const { addMessage, updateLastMessage, isStreaming } = useSessionStore();

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      addMessage({ id: generateId(), role: 'user', content: text });
      addMessage({ id: generateId(), role: 'assistant', content: '' });
      useSessionStore.setState({ isStreaming: true });

      try {
        const session = useSessionStore.getState().getCurrentSession();
        const messages = session?.messages.filter((m) => m.content) ?? [];

        const resp = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'hermes-agent',
            messages,
            stream: true,
          }),
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        let full = '';

        if (resp.body) {
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            [buffer, full] = parseSSEChunk(buffer, full);
            if (full) updateLastMessage(full);
          }

          // Flush decoder and process any remaining buffered data
          buffer += decoder.decode();
          if (buffer.trim()) {
            [, full] = parseSSEChunk(buffer + '\n', full);
          }
        } else {
          // Fallback for environments without streaming support
          const text = await resp.text();
          [, full] = parseSSEChunk(text + '\n', '');
        }

        if (full) {
          updateLastMessage(full);
        } else {
          updateLastMessage('（无响应）');
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : '未知错误';
        updateLastMessage(`错误: ${error}`);
      } finally {
        useSessionStore.setState({ isStreaming: false });
      }
    },
    [addMessage, updateLastMessage],
  );

  return { sendMessage, isStreaming, renderMarkdown };
}
