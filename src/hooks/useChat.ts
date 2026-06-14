import { useCallback } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { renderMarkdown, generateId } from '@/utils';

const API_URL = '/chat/api/v1/chat/completions';

function parseSSEChunk(buffer: string, full: string): [string, string] {
  const lines = buffer.split('\n');
  const leftover = lines.pop() || '';
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
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
        const messages = session?.messages.filter((m) => m.content) || [];

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

        if (resp.body?.getReader) {
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
        } else {
          const text = await resp.text();
          [, full] = parseSSEChunk(text + '\n', '');
        }

        if (!full) {
          updateLastMessage('（无响应）');
        } else {
          updateLastMessage(full);
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
