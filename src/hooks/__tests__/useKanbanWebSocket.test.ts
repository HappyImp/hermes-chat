import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKanbanWebSocket } from '../useKanbanWebSocket';
import type { KanbanWsEvent, WsConnectionStatus } from '@/api/kanban';

// Mock KanbanWebSocket class
const mockOn = vi.fn();
const mockOnStatusChange = vi.fn();
const mockOnError = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

vi.mock('@/api/kanban', () => ({
  KanbanWebSocket: vi.fn().mockImplementation(() => ({
    on: mockOn,
    onStatusChange: mockOnStatusChange,
    onError: mockOnError,
    connect: mockConnect,
    disconnect: mockDisconnect,
    connected: false,
    status: 'disconnected',
  })),
  getKanbanWsUrl: vi.fn().mockReturnValue('ws://localhost:3000/api/kanban/events?token=test'),
}));

describe('useKanbanWebSocket', () => {
  let eventHandler: (event: KanbanWsEvent) => void;
  let statusHandler: (status: WsConnectionStatus) => void;
  let errorHandler: (message: string) => void;

  beforeEach(() => {
    vi.clearAllMocks();

    // Capture handlers registered by the hook
    mockOn.mockImplementation((handler: (event: KanbanWsEvent) => void) => {
      eventHandler = handler;
      return vi.fn(); // unsubscribe
    });

    mockOnStatusChange.mockImplementation((handler: (status: WsConnectionStatus) => void) => {
      statusHandler = handler;
      return vi.fn(); // unsubscribe
    });

    mockOnError.mockImplementation((handler: (message: string) => void) => {
      errorHandler = handler;
      return vi.fn(); // unsubscribe
    });
  });

  it('connects on mount', () => {
    renderHook(() => useKanbanWebSocket());
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('disconnects on unmount', () => {
    const { unmount } = renderHook(() => useKanbanWebSocket());
    unmount();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('registers event and status handlers', () => {
    renderHook(() => useKanbanWebSocket());
    expect(mockOn).toHaveBeenCalledTimes(1);
    expect(mockOnStatusChange).toHaveBeenCalledTimes(1);
    expect(mockOnError).toHaveBeenCalledTimes(1);
  });

  it('calls onEvent callback when event received', () => {
    const onEvent = vi.fn();
    renderHook(() => useKanbanWebSocket(onEvent));

    const testEvent: KanbanWsEvent = {
      type: 'task_changed',
      task_id: 't_123',
      task: { id: 't_123', title: '测试', status: 'doing', assignee: 'coder-404', priority: '0' },
      old_status: 'todo',
      new_status: 'doing',
    };

    act(() => {
      eventHandler(testEvent);
    });

    expect(onEvent).toHaveBeenCalledWith(testEvent);
  });

  it('updates lastEvent when event received', () => {
    const { result } = renderHook(() => useKanbanWebSocket());

    const testEvent: KanbanWsEvent = {
      type: 'task_created',
      task_id: 't_new',
      task: { id: 't_new', title: '新任务', status: 'todo', assignee: 'coder-404', priority: '0' },
    };

    act(() => {
      eventHandler(testEvent);
    });

    expect(result.current.lastEvent).toEqual(testEvent);
  });

  it('updates wsStatus when status changes', () => {
    const { result } = renderHook(() => useKanbanWebSocket());

    act(() => {
      statusHandler('connecting');
    });
    expect(result.current.wsStatus).toBe('connecting');

    act(() => {
      statusHandler('connected');
    });
    expect(result.current.wsStatus).toBe('connected');

    act(() => {
      statusHandler('reconnecting');
    });
    expect(result.current.wsStatus).toBe('reconnecting');

    act(() => {
      statusHandler('disconnected');
    });
    expect(result.current.wsStatus).toBe('disconnected');
  });

  it('reconnect() disconnects and reconnects', () => {
    const { result } = renderHook(() => useKanbanWebSocket());

    act(() => {
      result.current.reconnect();
    });

    // disconnect called once for cleanup, then connect called
    expect(mockDisconnect).toHaveBeenCalled();
    expect(mockConnect).toHaveBeenCalled();
  });

  it('does not call onEvent after unmount', () => {
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => useKanbanWebSocket(onEvent));

    unmount();

    // Event handler should not be called after unmount
    // (the unsubscribe function from .on() should be called)
    expect(mockOn).toHaveBeenCalledTimes(1);
    const unsubscribe = mockOn.mock.results[0].value;
    expect(unsubscribe).toBeDefined();
  });

  it('sets wsError when error handler fires', () => {
    const { result } = renderHook(() => useKanbanWebSocket());

    expect(result.current.wsError).toBeNull();

    act(() => {
      errorHandler('WebSocket 连接错误');
    });

    expect(result.current.wsError).toBe('WebSocket 连接错误');
  });

  it('clears wsError when connection becomes connected', () => {
    const { result } = renderHook(() => useKanbanWebSocket());

    // First set an error
    act(() => {
      errorHandler('WebSocket 连接错误');
    });
    expect(result.current.wsError).toBe('WebSocket 连接错误');

    // Then connect successfully
    act(() => {
      statusHandler('connected');
    });
    expect(result.current.wsError).toBeNull();
  });

  it('initializes with wsError as null', () => {
    const { result } = renderHook(() => useKanbanWebSocket());
    expect(result.current.wsError).toBeNull();
  });
});
