import { useRef, useEffect } from 'react';
import { useChat, useSession } from '@/hooks';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { Welcome } from './Welcome';

export function ChatArea() {
  const { messages, exportChat, clearChat } = useSession();
  const { sendMessage, isStreaming } = useChat();
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="flex flex-col flex-1 min-w-0 h-screen">
      {/* Header */}
      <div className="pl-14 pr-4 py-3 lg:px-4 border-b border-border flex items-center gap-2.5 bg-surface shrink-0">
        <div className="w-2 h-2 rounded-full bg-success shrink-0" />
        <h1 className="text-base font-semibold flex-1">Hermes Agent</h1>
        <div className="flex gap-1.5">
          <button
            onClick={exportChat}
            title="导出对话"
            className="bg-transparent border border-border rounded-lg text-text2 px-2.5 py-1.5 text-xs cursor-pointer flex items-center gap-1 hover:border-primary hover:text-primary transition-all whitespace-nowrap"
          >
            📥 <span className="hidden sm:inline">导出</span>
          </button>
          <button
            onClick={clearChat}
            title="清空对话"
            className="bg-transparent border border-danger rounded-lg text-danger px-2.5 py-1.5 text-xs cursor-pointer flex items-center gap-1 hover:bg-danger/10 transition-all whitespace-nowrap"
          >
            🗑️ <span className="hidden sm:inline">清空</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 scroll-smooth">
        {messages.length === 0 ? (
          <Welcome />
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        {isStreaming && messages.length > 0 && messages[messages.length - 1].content === '' && (
          <div className="flex gap-1 p-1">
            <span className="w-1.5 h-1.5 rounded-full bg-text2 animate-blink" />
            <span className="w-1.5 h-1.5 rounded-full bg-text2 animate-blink [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-text2 animate-blink [animation-delay:0.4s]" />
          </div>
        )}
      </div>

      {/* Input */}
      <MessageInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
