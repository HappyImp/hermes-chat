import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChannelList } from '../Sidebar/ChannelList';
import { useSessionStore } from '@/store/sessionStore';

describe('ChannelList', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState({
      sessions: { default: [], test: [] },
      currentChannel: 'default',
      currentSessionId: null,
      isStreaming: false,
    });
  });

  it('renders channels', () => {
    render(<ChannelList currentChannel="default" onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/# default/)).toBeInTheDocument();
    expect(screen.getByText(/# test/)).toBeInTheDocument();
  });

  it('calls onSelect when channel clicked', () => {
    const onSelect = vi.fn();
    render(<ChannelList currentChannel="default" onSelect={onSelect} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByText(/# test/));
    expect(onSelect).toHaveBeenCalledWith('test');
  });

  it('shows new channel input on button click', () => {
    render(<ChannelList currentChannel="default" onSelect={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByText('+ 新建'));
    expect(screen.getByPlaceholderText('channel 名称')).toBeInTheDocument();
  });

  it('creates new channel on Enter', () => {
    const onSelect = vi.fn();
    render(<ChannelList currentChannel="default" onSelect={onSelect} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByText('+ 新建'));
    const input = screen.getByPlaceholderText('channel 名称');
    fireEvent.change(input, { target: { value: 'new-channel' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('new-channel');
  });
});
