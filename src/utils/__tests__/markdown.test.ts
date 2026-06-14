import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../markdown';
import { marked } from 'marked';

describe('renderMarkdown', () => {
  it('renders bold text', () => {
    const result = renderMarkdown('**bold**');
    expect(result).toContain('<strong>bold</strong>');
  });

  it('renders inline code', () => {
    const result = renderMarkdown('`code`');
    expect(result).toContain('<code');
  });

  it('renders code blocks', () => {
    const result = renderMarkdown('```js\nconst a = 1;\n```');
    expect(result).toContain('pre');
    expect(result).toContain('code');
  });

  it('renders links', () => {
    const result = renderMarkdown('[link](https://example.com)');
    expect(result).toContain('href="https://example.com"');
  });

  it('renders lists', () => {
    const result = renderMarkdown('- item1\n- item2');
    expect(result).toContain('<li');
  });

  it('handles empty string', () => {
    const result = renderMarkdown('');
    expect(typeof result).toBe('string');
  });

  it('falls back to escaped text on error', () => {
    // Mock marked.parse to throw an error
    const originalParse = marked.parse;
    marked.parse = () => { throw new Error('Test error'); };
    
    const result = renderMarkdown('test & <script>alert(1)</script>');
    expect(result).toContain('test &amp;');
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
    
    // Restore original
    marked.parse = originalParse;
  });

  it('sanitizes XSS in markdown output', () => {
    const result = renderMarkdown('<img src=x onerror=alert(1)>');
    expect(result).not.toContain('onerror');
  });
});
