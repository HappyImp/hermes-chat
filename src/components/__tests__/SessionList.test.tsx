import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionList } from '../Sidebar/SessionList';
import type { Session } from '@/types';

const mockSessions: Session[] = [
  {
    id: '1',
    title: 'Session 1',
    channel: 'default',
    messages: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: '2',
    title: 'Session 2',
    channel: 'default',
    messages: [],
    createdAt: '2026-01-02',
    updatedAt: '2026-01-02',
  },
];

describe('SessionList', () => {
  it('renders sessions', () => {
    render(
      <SessionList
        sessions={mockSessions}
        currentSessionId="1"
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
      />,
    );
    expect(screen.getByText(/Session 1/)).toBeInTheDocument();
    expect(screen.getByText(/Session 2/)).toBeInTheDocument();
  });

  it('calls onSelect when session clicked', () => {
    const onSelect = vi.fn();
    render(
      <SessionList
        sessions={mockSessions}
        currentSessionId="1"
        onSelect={onSelect}
        onDelete={vi.fn()}
        onNew={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/Session 2/));
    expect(onSelect).toHaveBeenCalledWith('2');
  });

  it('calls onNew when new session button clicked', () => {
    const onNew = vi.fn();
    render(
      <SessionList
        sessions={mockSessions}
        currentSessionId="1"
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onNew={onNew}
      />,
    );
    fireEvent.click(screen.getByText('+ 新会话'));
    expect(onNew).toHaveBeenCalled();
  });

  it('calls onDelete when delete confirmed', () => {
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <SessionList
        sessions={mockSessions}
        currentSessionId="1"
        onSelect={vi.fn()}
        onDelete={onDelete}
        onNew={vi.fn()}
      />,
    );
    const deleteButtons = screen.getAllByTitle('删除会话');
    fireEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalled();
  });

  it('does not call onDelete when confirm cancelled', () => {
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <SessionList
        sessions={mockSessions}
        currentSessionId="1"
        onSelect={vi.fn()}
        onDelete={onDelete}
        onNew={vi.fn()}
      />,
    );
    const deleteButtons = screen.getAllByTitle('删除会话');
    fireEvent.click(deleteButtons[0]);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('renders empty list', () => {
    render(
      <SessionList
        sessions={[]}
        currentSessionId={null}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
      />,
    );
    expect(screen.getByText('+ 新会话')).toBeInTheDocument();
  });
});
