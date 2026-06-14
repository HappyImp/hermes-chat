import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ChatArea } from '@/components/Chat';
import { Toast } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useToast } from '@/hooks';
import { useEmployeeStatus } from '@/hooks/useEmployeeStatus';
import { PixelOffice } from '@/components/Office/PixelOffice';

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOffice, setShowOffice] = useState(false);
  const { message: toastMessage } = useToast();
  const { employees } = useEmployeeStatus();

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const openOffice = useCallback(() => {
    setShowOffice(true);
  }, []);

  const closeOffice = useCallback(() => {
    setShowOffice(false);
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

        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} onOpenOffice={openOffice} />
        <ChatArea />
        <Toast message={toastMessage} />

        {/* Pixel Office overlay */}
        {showOffice && (
          <div className="fixed inset-0 z-50 bg-bg">
            <PixelOffice employees={employees} onBack={closeOffice} />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
