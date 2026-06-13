import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageInput } from '../Chat/MessageInput';

describe('MessageInput', () => {
  it('renders input area', () => {
    render(<MessageInput onSend={vi.fn()} disabled={false} />);
    expect(screen.getByPlaceholderText(/输入消息/)).toBeInTheDocument();
  });

  it('calls onSend on Enter', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByPlaceholderText(/输入消息/);
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('does not send on Shift+Enter', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByPlaceholderText(/输入消息/);
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send when disabled', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} disabled={true} />);
    const textarea = screen.getByPlaceholderText(/输入消息/);
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send empty message', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByPlaceholderText(/输入消息/);
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('clears input after send', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByPlaceholderText(/输入消息/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(textarea.value).toBe('');
  });

  it('disables send button when empty', () => {
    render(<MessageInput onSend={vi.fn()} disabled={false} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('enables send button with text', () => {
    render(<MessageInput onSend={vi.fn()} disabled={false} />);
    const textarea = screen.getByPlaceholderText(/输入消息/);
    fireEvent.change(textarea, { target: { value: 'hello' } });
    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
  });
});
