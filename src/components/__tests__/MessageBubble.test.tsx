import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../Chat/MessageBubble';
import type { Message } from '@/types';

describe('MessageBubble', () => {
  it('renders user message', () => {
    render(<MessageBubble message={{ id: 'test-id', role: 'user', content: 'Hello' }} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders bot message with markdown', () => {
    render(<MessageBubble message={{ id: 'test-id', role: 'assistant', content: '**bold**' }} />);
    expect(screen.getByText('bold')).toBeInTheDocument();
  });

  it('renders bot message with code', () => {
    render(<MessageBubble message={{ id: 'test-id', role: 'assistant', content: '`code`' }} />);
    expect(screen.getByText('code')).toBeInTheDocument();
  });

  it('applies user style class', () => {
    const { container } = render(<MessageBubble message={{ id: 'test-id', role: 'user', content: 'test' }} />);
    expect(container.firstChild).toHaveClass('self-end');
  });

  it('applies bot style class', () => {
    const { container } = render(
      <MessageBubble message={{ id: 'test-id', role: 'assistant', content: 'test' }} />,
    );
    expect(container.firstChild).toHaveClass('self-start');
  });

  it('renders empty content', () => {
    render(<MessageBubble message={{ id: 'test-id', role: 'assistant', content: '' }} />);
    // Should not throw
  });

  it('escapes HTML in user messages', () => {
    render(<MessageBubble message={{ id: 'test-id', role: 'user', content: '<script>alert(1)</script>' }} />);
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  });

  it('renders TaskCard when message has task metadata', () => {
    const taskMessage: Message = {
      id: 'task-msg-1',
      role: 'assistant',
      content: '',
      metadata: {
        type: 'task',
        taskInfo: {
          id: 'task_1',
          employee: '404',
          task: '修复登录bug',
          status: 'working',
          startedAt: new Date('2026-06-14T10:00:00'),
        },
      },
    };

    render(<MessageBubble message={taskMessage} />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('修复登录bug')).toBeInTheDocument();
    expect(screen.getByText('执行中...')).toBeInTheDocument();
  });

  it('renders TaskCard with completed status', () => {
    const taskMessage: Message = {
      id: 'task-msg-2',
      role: 'assistant',
      content: '',
      metadata: {
        type: 'task',
        taskInfo: {
          id: 'task_2',
          employee: '铁壳',
          task: '检查服务器',
          status: 'completed',
          startedAt: new Date('2026-06-14T10:00:00'),
          result: '一切正常',
        },
      },
    };

    render(<MessageBubble message={taskMessage} />);
    expect(screen.getByText('铁壳')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('一切正常')).toBeInTheDocument();
  });

  it('TaskCard message uses bot avatar', () => {
    const taskMessage: Message = {
      id: 'task-msg-3',
      role: 'assistant',
      content: '',
      metadata: {
        type: 'task',
        taskInfo: {
          id: 'task_3',
          employee: '老财',
          task: '分析600519',
          status: 'working',
          startedAt: new Date('2026-06-14T10:00:00'),
        },
      },
    };

    const { container } = render(<MessageBubble message={taskMessage} />);
    // Task card messages are aligned to start (bot side)
    expect(container.firstChild).toHaveClass('self-start');
  });
});
