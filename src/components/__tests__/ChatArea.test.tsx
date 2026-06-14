import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatArea } from '../Chat/ChatArea';
import { useSessionStore } from '@/store/sessionStore';

vi.mock('@/hooks', () => ({
  useChat: () => ({
    sendMessage: vi.fn(),
    isStreaming: false,
    renderMarkdown: (s: string) => s,
  }),
  useSession: () => {
    const store = useSessionStore.getState();
    const session = store.sessions[store.currentChannel]?.find(
      (s: { id: string }) => s.id === store.currentSessionId,
    );
    return {
      messages: session?.messages || [],
      exportChat: vi.fn(),
      clearChat: store.clearCurrentMessages,
    };
  },
  useToast: () => ({ message: null, showToast: vi.fn() }),
}));

describe('ChatArea', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState({
      sessions: {},
      currentChannel: 'default',
      currentSessionId: null,
      isStreaming: false,
    });
  });

  it('renders header', () => {
    render(<ChatArea />);
    expect(screen.getByText('Hermes Agent')).toBeInTheDocument();
  });

  it('shows welcome when no messages', () => {
    render(<ChatArea />);
    expect(screen.getByText(/Hermes Chat/)).toBeInTheDocument();
  });

  it('renders messages', () => {
    useSessionStore.getState().createSession('default');
    useSessionStore.getState().addMessage({ id: 'test-id-1', role: 'user', content: 'hello' });
    useSessionStore.getState().addMessage({ id: 'test-id-2', role: 'assistant', content: 'hi' });
    render(<ChatArea />);
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('has export button', () => {
    render(<ChatArea />);
    expect(screen.getByTitle('导出对话')).toBeInTheDocument();
  });

  it('has clear button', () => {
    render(<ChatArea />);
    expect(screen.getByTitle('清空对话')).toBeInTheDocument();
  });

  it('has send button', () => {
    render(<ChatArea />);
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument();
  });
});
