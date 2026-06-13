import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../Sidebar/Sidebar';
import { useSessionStore } from '@/store/sessionStore';

vi.mock('@/hooks', () => ({
  useSession: () => {
    const store = useSessionStore.getState();
    return {
      sessions: store.sessions[store.currentChannel] || [],
      currentSessionId: store.currentSessionId,
      channel: store.currentChannel,
      allChannels: Object.keys(store.sessions),
      setChannel: store.setChannel,
      deleteChannel: store.deleteChannel,
      createSession: store.createSession,
      deleteSession: store.deleteSession,
      setCurrentSession: store.setCurrentSession,
    };
  },
  useChat: () => ({ sendMessage: vi.fn(), isStreaming: false, renderMarkdown: (s: string) => s }),
  useToast: () => ({ message: null, showToast: vi.fn() }),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState({
      sessions: {},
      currentChannel: 'default',
      currentSessionId: null,
      isStreaming: false,
    });
  });

  it('renders when open', () => {
    useSessionStore.getState().createSession('default');
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Hermes Chat')).toBeInTheDocument();
  });

  it('shows channel list', () => {
    useSessionStore.getState().createSession('default');
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText(/# default/)).toBeInTheDocument();
  });

  it('shows session list', () => {
    useSessionStore.getState().createSession('default');
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    expect(screen.getAllByText(/新会话/).length).toBeGreaterThan(0);
  });

  it('calls onClose when overlay clicked', () => {
    const onClose = vi.fn();
    useSessionStore.getState().createSession('default');
    render(<Sidebar isOpen={true} onClose={onClose} />);
    const overlay = document.querySelector('.fixed.inset-0');
    if (overlay) fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('creates new session on button click', () => {
    useSessionStore.getState().createSession('default');
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    const btn = screen.getByText('+ 新会话');
    fireEvent.click(btn);
    expect(useSessionStore.getState().sessions['default']).toHaveLength(2);
  });

  it('shows new channel input', () => {
    useSessionStore.getState().createSession('default');
    render(<Sidebar isOpen={true} onClose={vi.fn()} />);
    const btn = screen.getByText('+ 新建');
    fireEvent.click(btn);
    expect(screen.getByPlaceholderText('channel 名称')).toBeInTheDocument();
  });
});
