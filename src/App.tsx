import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ChatArea } from '@/components/Chat';
import { Toast } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useToast } from '@/hooks';

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { message: toastMessage } = useToast();

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-bg text-text overflow-hidden">
        {/* Mobile menu button */}
        <button
          onClick={toggleSidebar}
          className="fixed top-3 left-3 z-50 lg:hidden bg-surface border border-border rounded-lg p-2 text-text2 cursor-pointer hover:text-text transition-colors"
          aria-label="Toggle sidebar"
        >
          ☰
        </button>

        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
        <ChatArea />
        <Toast message={toastMessage} />
      </div>
    </ErrorBoundary>
  );
}
