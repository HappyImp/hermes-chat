import type { Message } from '@/types';
import { renderMarkdown } from '@/utils';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const avatar = isUser ? '👤' : '🤖';

  return (
    <div
      className={`flex gap-2.5 max-w-[85%] animate-fade-in ${isUser ? 'self-end flex-row-reverse' : 'self-start'}`}
    >
      <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[13px] shrink-0 bg-primary">
        {avatar}
      </div>
      <div
        className={`px-3.5 py-2.5 rounded-xl text-sm leading-7 break-words ${
          isUser ? 'bg-userBg' : 'bg-botBg border border-border'
        }`}
        dangerouslySetInnerHTML={{
          __html: isUser
            ? message.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            : renderMarkdown(message.content),
        }}
      />
    </div>
  );
}
