import { marked } from 'marked';
import hljs from 'highlight.js';

function createRenderer() {
  const renderer = new marked.Renderer();

  renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    const language = lang || 'code';
    const highlighted =
      lang && hljs.getLanguage(lang)
        ? hljs.highlight(text, { language: lang }).value
        : hljs.highlightAuto(text).value;
    return `<pre><div class="code-header"><span>${language}</span><button class="copy-btn">📋 复制</button></div><code class="hljs">${highlighted}</code></pre>`;
  };

  return renderer;
}

export function renderMarkdown(content: string): string {
  try {
    return marked.parse(content, { renderer: createRenderer(), breaks: true, gfm: true }) as string;
  } catch {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
