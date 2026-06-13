import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CodeBlock } from '../CodeBlock/CodeBlock';

vi.mock('@/hooks', () => ({
  useToast: () => ({ message: null, showToast: vi.fn() }),
}));

describe('CodeBlock', () => {
  it('renders html content', () => {
    render(<CodeBlock html="<p>test</p>" />);
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('renders code block', () => {
    const html =
      '<pre><div class="code-header"><span>js</span><button class="copy-btn">📋 复制</button></div><code>const a = 1;</code></pre>';
    render(<CodeBlock html={html} />);
    expect(screen.getByText('const a = 1;')).toBeInTheDocument();
    expect(screen.getByText('js')).toBeInTheDocument();
  });

  it('copies code on button click', async () => {
    const html =
      '<pre><div class="code-header"><span>js</span><button class="copy-btn">📋 复制</button></div><code>const a = 1;</code></pre>';
    render(<CodeBlock html={html} />);
    fireEvent.click(screen.getByText('📋 复制'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('const a = 1;');
  });
});
