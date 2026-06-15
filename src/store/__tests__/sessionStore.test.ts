import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from '../sessionStore';

describe('sessionStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState({
      sessions: {},
      currentChannel: 'default',
      currentSessionId: null,
      isStreaming: false,
    });
  });

  it('creates a session', () => {
    const id = useSessionStore.getState().createSession('default');
    const state = useSessionStore.getState();
    expect(state.sessions['default']).toHaveLength(1);
    expect(state.sessions['default'][0].id).toBe(id);
    expect(state.currentSessionId).toBe(id);
  });

  it('creates session in new channel', () => {
    useSessionStore.getState().setChannel('test');
    const state = useSessionStore.getState();
    expect(state.currentChannel).toBe('test');
    expect(state.sessions['test']).toHaveLength(1);
  });

  it('adds message to current session', () => {
    useSessionStore.getState().createSession('default');
    useSessionStore.getState().addMessage({ id: 'test-id', role: 'user', content: 'hello' });
    const session = useSessionStore.getState().getCurrentSession();
    expect(session?.messages).toHaveLength(1);
    expect(session?.messages[0].content).toBe('hello');
    expect(session?.title).toBe('hello');
  });

  it('derives title from first user message', () => {
    useSessionStore.getState().createSession('default');
    useSessionStore.getState().addMessage({
      id: 'test-id',
      role: 'user',
      content: 'This is a very long message that should be truncated at 20 characters',
    });
    const session = useSessionStore.getState().getCurrentSession();
    expect(session?.title.length).toBeLessThanOrEqual(23); // 20 + '...'
  });

  it('updates last message', () => {
    useSessionStore.getState().createSession('default');
    useSessionStore.getState().addMessage({ id: 'test-id', role: 'assistant', content: '' });
    useSessionStore.getState().updateLastMessage('updated content');
    const session = useSessionStore.getState().getCurrentSession();
    expect(session?.messages[0].content).toBe('updated content');
  });

  it('deletes session', () => {
    const id = useSessionStore.getState().createSession('default');
    useSessionStore.getState().deleteSession(id);
    const state = useSessionStore.getState();
    expect(state.sessions['default']).toHaveLength(0);
    expect(state.currentSessionId).toBeNull();
  });

  it('clears current messages', () => {
    useSessionStore.getState().createSession('default');
    useSessionStore.getState().addMessage({ id: 'test-id', role: 'user', content: 'test' });
    useSessionStore.getState().clearCurrentMessages();
    const session = useSessionStore.getState().getCurrentSession();
    expect(session?.messages).toHaveLength(0);
    expect(session?.title).toBe('新会话');
  });

  it('deletes channel', () => {
    useSessionStore.getState().setChannel('mychannel');
    useSessionStore.getState().deleteChannel('mychannel');
    const state = useSessionStore.getState();
    expect(state.currentChannel).toBe('default');
    expect(state.sessions['mychannel']).toBeUndefined();
  });

  it('switches session', () => {
    const id1 = useSessionStore.getState().createSession('default');
    useSessionStore.getState().createSession('default');
    useSessionStore.getState().setCurrentSession(id1);
    expect(useSessionStore.getState().currentSessionId).toBe(id1);
  });

  it('sets channel to existing channel', () => {
    useSessionStore.getState().createSession('default');
    useSessionStore.getState().setChannel('default');
    expect(useSessionStore.getState().currentChannel).toBe('default');
  });

  it('handles updateLastMessage with no messages', () => {
    useSessionStore.getState().createSession('default');
    // Should not throw
    useSessionStore.getState().updateLastMessage('test');
    const session = useSessionStore.getState().getCurrentSession();
    expect(session?.messages).toHaveLength(0);
  });

  it('handles deleteChannel for default channel', () => {
    useSessionStore.getState().createSession('default');
    useSessionStore.getState().deleteChannel('default');
    const state = useSessionStore.getState();
    expect(state.currentChannel).toBe('default');
    expect(state.sessions['default']).toHaveLength(1);
  });

  it('does not persist isStreaming to localStorage', async () => {
    useSessionStore.setState({ isStreaming: true });
    // persist writes asynchronously — wait for it
    await new Promise((r) => setTimeout(r, 50));
    const stored = JSON.parse(localStorage.getItem('hermes_chat_sessions') || '{}');
    expect(stored.state?.isStreaming).toBeUndefined();
  });

  it('isStreaming defaults to false even if stale localStorage has true', async () => {
    // Simulate stale persisted data with isStreaming: true (from old code)
    localStorage.setItem(
      'hermes_chat_sessions',
      JSON.stringify({
        state: { sessions: {}, currentChannel: 'default', currentSessionId: null, isStreaming: true },
        version: 0,
      }),
    );
    // Trigger rehydration — merge function should force isStreaming to false
    useSessionStore.persist.rehydrate();
    await new Promise((r) => setTimeout(r, 50));
    expect(useSessionStore.getState().isStreaming).toBe(false);
  });
});
