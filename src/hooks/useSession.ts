import { useSessionStore } from '@/store/sessionStore';

export function useSession() {
  const store = useSessionStore();

  const currentSession = store.sessions[store.currentChannel]?.find(
    (s) => s.id === store.currentSessionId,
  );

  const exportChat = (): string => {
    if (!currentSession || currentSession.messages.length === 0) return '';

    let md = `# Hermes Chat 导出\n\n> 导出时间: ${new Date().toLocaleString('zh-CN')}\n\n---\n\n`;
    for (const msg of currentSession.messages) {
      const role = msg.role === 'user' ? '👤 用户' : '🤖 Hermes';
      md += `### ${role}\n\n${msg.content}\n\n---\n\n`;
    }
    return md;
  };

  const downloadExport = () => {
    const md = exportChat();
    if (!md) return;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hermes-chat-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    currentSession,
    currentSessionId: store.currentSessionId,
    messages: currentSession?.messages || [],
    channel: store.currentChannel,
    sessions: store.sessions[store.currentChannel] || [],
    exportChat: downloadExport,
    clearChat: store.clearCurrentMessages,
    createSession: store.createSession,
    deleteSession: store.deleteSession,
    setCurrentSession: store.setCurrentSession,
    setChannel: store.setChannel,
    deleteChannel: store.deleteChannel,
    allChannels: Object.keys(store.sessions),
  };
}
