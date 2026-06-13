import { useCallback } from 'react';
import { useSession } from '@/hooks';
import { ChannelList } from './ChannelList';
import { SessionList } from './SessionList';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const {
    sessions,
    currentSessionId,
    channel,
    setChannel,
    deleteChannel,
    createSession,
    deleteSession,
    setCurrentSession,
  } = useSession();

  const handleSelectChannel = useCallback(
    (ch: string) => {
      setChannel(ch);
    },
    [setChannel],
  );

  const handleDeleteChannel = useCallback(
    (ch: string) => {
      if (confirm(`确定删除 channel "${ch}" 及其所有会话？`)) {
        deleteChannel(ch);
      }
    },
    [deleteChannel],
  );

  const handleNewSession = useCallback(() => {
    createSession();
  }, [createSession]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />}

      {/* Sidebar */}
      <div
        className={`fixed lg:relative z-40 h-screen w-[260px] bg-surface border-r border-border flex flex-col transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:hidden'
        }`}
      >
        {/* Header */}
        <div className="px-3 py-3 border-b border-border flex items-center justify-between shrink-0">
          <span className="text-sm font-semibold text-text">Hermes Chat</span>
          <button
            onClick={onClose}
            className="lg:hidden text-text2 bg-transparent border-none cursor-pointer text-lg"
          >
            ✕
          </button>
        </div>

        {/* Channel list */}
        <div className="px-2 pt-3">
          <ChannelList
            currentChannel={channel}
            onSelect={handleSelectChannel}
            onDelete={handleDeleteChannel}
          />
        </div>

        {/* Divider */}
        <div className="mx-3 border-t border-border" />

        {/* Session list */}
        <div className="flex-1 px-2 pt-3 overflow-hidden flex flex-col">
          <SessionList
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelect={setCurrentSession}
            onDelete={deleteSession}
            onNew={handleNewSession}
          />
        </div>
      </div>
    </>
  );
}
