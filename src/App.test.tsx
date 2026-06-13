import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from './App';
import { useSessionStore } from '@/store/sessionStore';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState({
      sessions: {},
      currentChannel: 'default',
      currentSessionId: null,
      isStreaming: false,
    });
  });

  it('renders the app', () => {
    render(<App />);
    expect(screen.getByText('Hermes Agent')).toBeInTheDocument();
  });

  it('toggles sidebar on menu button click', () => {
    render(<App />);
    const menuBtn = screen.getByLabelText('Toggle sidebar');
    fireEvent.click(menuBtn);
    expect(screen.getByText('Hermes Chat')).toBeInTheDocument();
  });

  it('renders chat area by default', () => {
    render(<App />);
    expect(screen.getAllByText(/Hermes Chat/).length).toBeGreaterThan(0);
  });
});
