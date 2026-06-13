import { describe, it, expect } from 'vitest';
import { renderMarkdown, escapeHtml } from '../markdown';

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('handles text without special chars', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

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
});
