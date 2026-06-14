import { renderMarkdown } from '@/utils';
import type { Message } from '@/types';
import { TaskCard } from './TaskCard';

const avatars: Record<string, string> = {
  user: '👤',
  assistant: '🤖',
};

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  if (message.metadata?.type === 'task') {
    return (
      <div className="flex gap-2.5 self-start max-w-[85%]">
        <span className="text-xl mt-0.5 shrink-0">🤖</span>
        <TaskCard taskInfo={message.metadata.taskInfo} />
      </div>
    );
  }

  // 检查是否是任务消息
  if (message.metadata?.type === 'task') {
    return (
      <div className="flex gap-2.5 max-w-[85%] animate-fade-in self-start">
        <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[13px] shrink-0 bg-primary">
          🤖
        </div>
        <TaskCard taskInfo={message.metadata.taskInfo} />
      </div>
    );
  }

  return (
    <div
      className={`flex gap-2.5 ${isUser ? 'self-end flex-row-reverse max-w-[85%]' : 'self-start max-w-[85%]'}`}
    >
      <span className="text-xl mt-0.5 shrink-0">{avatars[message.role]}</span>
      <div
        className={`rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
          isUser
            ? 'bg-primary text-white rounded-br-md'
            : 'bg-surface text-text border border-border rounded-bl-md'
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap break-words">{message.content}</span>
        ) : (
          <div
            className="markdown-body prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        )}
      </div>
    </div>
  );
}
