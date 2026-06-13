import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../Chat/MessageBubble';

describe('MessageBubble', () => {
  it('renders user message', () => {
    render(<MessageBubble message={{ role: 'user', content: 'Hello' }} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders bot message with markdown', () => {
    render(<MessageBubble message={{ role: 'assistant', content: '**bold**' }} />);
    expect(screen.getByText('bold')).toBeInTheDocument();
  });

  it('renders bot message with code', () => {
    render(<MessageBubble message={{ role: 'assistant', content: '`code`' }} />);
    expect(screen.getByText('code')).toBeInTheDocument();
  });

  it('applies user style class', () => {
    const { container } = render(<MessageBubble message={{ role: 'user', content: 'test' }} />);
    expect(container.firstChild).toHaveClass('self-end');
  });

  it('applies bot style class', () => {
    const { container } = render(
      <MessageBubble message={{ role: 'assistant', content: 'test' }} />,
    );
    expect(container.firstChild).toHaveClass('self-start');
  });

  it('renders empty content', () => {
    render(<MessageBubble message={{ role: 'assistant', content: '' }} />);
    // Should not throw
  });

  it('escapes HTML in user messages', () => {
    render(<MessageBubble message={{ role: 'user', content: '<script>alert(1)</script>' }} />);
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  });
});
