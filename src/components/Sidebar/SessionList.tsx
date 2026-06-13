import { useCallback } from 'react';
import type { Session } from '@/types';

interface SessionListProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export function SessionList({
  sessions,
  currentSessionId,
  onSelect,
  onDelete,
  onNew,
}: SessionListProps) {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (confirm('确定删除这个会话？')) onDelete(id);
    },
    [onDelete],
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-xs text-text2 font-semibold uppercase tracking-wider">会话</span>
        <button
          onClick={onNew}
          className="text-xs text-primary bg-transparent border-none cursor-pointer hover:underline"
        >
          + 新会话
        </button>
      </div>
      <div className="flex flex-col gap-0.5">
        {sorted.map((session) => (
          <div
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={`group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer text-sm transition-colors ${
              session.id === currentSessionId
                ? 'bg-primary/15 text-primary'
                : 'text-text2 hover:bg-surface hover:text-text'
            }`}
          >
            <span className="flex-1 truncate text-[13px]">💬 {session.title}</span>
            <button
              onClick={(e) => handleDelete(e, session.id)}
              className="text-xs text-text2 bg-transparent border-none cursor-pointer hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
              title="删除会话"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
