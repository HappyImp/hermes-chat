import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpeechBubble } from '../SpeechBubble';

describe('SpeechBubble', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <SpeechBubble text="hello" x={100} y={100} visible={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders text when visible', () => {
    render(
      <SpeechBubble text="测试气泡" x={100} y={50} visible={true} />,
    );
    expect(screen.getByText('测试气泡')).toBeInTheDocument();
  });

  it('positions at given x, y coordinates', () => {
    const { container } = render(
      <SpeechBubble text="hi" x={200} y={150} visible={true} />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.left).toBe('200px');
    expect(wrapper.style.top).toBe('150px');
  });

  it('has pointer-events-none class', () => {
    const { container } = render(
      <SpeechBubble text="hi" x={0} y={0} visible={true} />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('pointer-events-none');
  });
});
