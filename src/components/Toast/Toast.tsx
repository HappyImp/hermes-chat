interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps) {
  if (!message) return null;
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-surface border border-border text-text px-4 py-2 rounded-lg text-sm z-50 animate-fade-in">
      {message}
    </div>
  );
}
