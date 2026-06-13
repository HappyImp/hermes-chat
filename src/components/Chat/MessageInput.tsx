import { useState, useRef, useCallback } from 'react';

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  const handleSend = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      adjustHeight();
    },
    [adjustHeight],
  );

  return (
    <div className="px-4 py-3 border-t border-border bg-surface shrink-0">
      <div className="flex gap-2.5 items-end max-w-[900px] mx-auto">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          rows={1}
          className="flex-1 bg-bg border border-border rounded-xl px-3.5 py-2.5 text-text text-sm resize-none outline-none min-h-[42px] max-h-[160px] font-inherit leading-6 focus:border-primary placeholder:text-text2"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="bg-primary border-none rounded-xl w-[42px] h-[42px] cursor-pointer flex items-center justify-center shrink-0 hover:opacity-85 disabled:opacity-35 disabled:cursor-not-allowed transition-opacity"
        >
          <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-white">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
