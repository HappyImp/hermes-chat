import { useState, useCallback, useRef } from 'react';

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((text: string) => {
    clearTimeout(timerRef.current);
    setMessage(text);
    timerRef.current = setTimeout(() => setMessage(null), 2000);
  }, []);

  return { message, showToast };
}
