import { useState, useCallback } from 'react';
import { useSessionStore } from '@/store/sessionStore';

interface ChannelListProps {
  currentChannel: string;
  onSelect: (channel: string) => void;
  onDelete: (channel: string) => void;
}

export function ChannelList({ currentChannel, onSelect, onDelete }: ChannelListProps) {
  const sessions = useSessionStore((s) => s.sessions);
  const channels = Object.keys(sessions);
  const [showInput, setShowInput] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = useCallback(() => {
    const name = newName.trim();
    if (!name || channels.includes(name)) return;
    onSelect(name);
    setNewName('');
    setShowInput(false);
  }, [newName, channels, onSelect]);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-xs text-text2 font-semibold uppercase tracking-wider">Channels</span>
        <button
          onClick={() => setShowInput(!showInput)}
          className="text-xs text-primary bg-transparent border-none cursor-pointer hover:underline"
        >
          + 新建
        </button>
      </div>
      {showInput && (
        <div className="flex gap-1 mb-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="channel 名称"
            className="flex-1 bg-bg border border-border rounded-md px-2 py-1 text-xs text-text outline-none focus:border-primary"
          />
          <button
            onClick={handleCreate}
            className="text-xs text-primary bg-transparent border-none cursor-pointer"
          >
            ✓
          </button>
        </div>
      )}
      {channels.map((ch) => (
        <div
          key={ch}
          className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
            ch === currentChannel
              ? 'bg-primary/15 text-primary'
              : 'text-text2 hover:bg-surface hover:text-text'
          }`}
          onClick={() => onSelect(ch)}
        >
          <span className="flex-1 truncate"># {ch}</span>
          {ch !== 'default' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(ch);
              }}
              className="text-xs text-text2 bg-transparent border-none cursor-pointer hover:text-danger opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              title="删除 channel"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
