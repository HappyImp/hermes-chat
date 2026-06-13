import { useCallback } from 'react';
import { useToast } from '@/hooks';

interface CodeBlockProps {
  html: string;
}

export function CodeBlock({ html }: CodeBlockProps) {
  const { showToast } = useToast();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains('copy-btn')) return;
      const pre = target.closest('pre');
      const code = pre?.querySelector('code');
      if (!code) return;
      navigator.clipboard.writeText(code.textContent || '').then(() => {
        showToast('已复制');
      });
    },
    [showToast],
  );

  return (
    <div
      className="markdown-content"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
