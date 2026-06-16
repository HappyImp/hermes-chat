import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useKanbanEvents } from '../useKanbanEvents';
import type { KanbanTask } from '@/types/employee';
import type { KanbanWsEvent } from '@/api/kanban';

// ─── Mocks ──────────────────────────────────────────────────────

const mockFetchKanbanTasks = vi.fn();

vi.mock('@/api/kanban', () => ({
  fetchKanbanTasks: (...args: unknown[]) => mockFetchKanbanTasks(...args),
}));

// Mock useKanbanWebSocket — capture the onEvent callback
let capturedOnEvent: ((event: KanbanWsEvent) => void) | undefined;
let mockReconnect: ReturnType<typeof vi.fn>;

vi.mock('../useKanbanWebSocket', () => ({
  useKanbanWebSocket: vi.fn().mockImplementation(
    (onEvent?: (event: KanbanWsEvent) => void) => {
      capturedOnEvent = onEvent;
      mockReconnect = vi.fn();
      return {
        wsStatus: 'connected',
        lastEvent: null,
        reconnect: mockReconnect,
        wsError: null,
      };
    },
  ),
}));

// ─── Helpers ────────────────────────────────────────────────────

const makeTask = (overrides: Partial<KanbanTask> = {}): KanbanTask => ({
  id: 't_test',
  title: '测试任务',
  status: 'todo',
  assignee: 'coder-404',
  priority: '0',
  created_at: 1750000000,
  started_at: 1750000000,
  ...overrides,
});

// ─── Tests ──────────────────────────────────────────────────────

describe('useKanbanEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnEvent = undefined;
    mockFetchKanbanTasks.mockResolvedValue([]);
    vi.stubEnv('VITE_USE_KANBAN', 'true');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  // ── 初始加载 ──

  it('fetches tasks on mount', async () => {
    const tasks = [makeTask({ id: 't1' }), makeTask({ id: 't2' })];
    mockFetchKanbanTasks.mockResolvedValue(tasks);

    const { result } = renderHook(() => useKanbanEvents());

    await waitFor(() => {
      expect(result.current.tasks).toEqual(tasks);
    });
    expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
  });

  it('starts with isLoading=true', () => {
    mockFetchKanbanTasks.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useKanbanEvents());
    expect(result.current.isLoading).toBe(true);
  });

  it('sets isLoading=false after fetch completes', async () => {
    const { result } = renderHook(() => useKanbanEvents());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('keeps existing tasks on fetch error', async () => {
    const tasks = [makeTask({ id: 't1' })];
    mockFetchKanbanTasks.mockResolvedValueOnce(tasks);

    const { result } = renderHook(() => useKanbanEvents());
    await waitFor(() => {
      expect(result.current.tasks).toEqual(tasks);
    });

    // Second fetch fails
    mockFetchKanbanTasks.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      await result.current.refresh();
    });

    // Tasks should be preserved
    expect(result.current.tasks).toEqual(tasks);
  });

  // ── WebSocket 状态 ──

  it('exposes wsStatus as connected when WS enabled', async () => {
    const { result } = renderHook(() => useKanbanEvents());
    await waitFor(() => {
      expect(result.current.wsStatus).toBe('connected');
    });
  });

  it('exposes wsStatus as polling when WS disabled', async () => {
    vi.stubEnv('VITE_USE_KANBAN', 'false');
    const { result } = renderHook(() => useKanbanEvents());
    // Hook always calls useKanbanWebSocket (Rules of Hooks),
    // but sync effect forces wsStatus to 'polling' when enableWebSocket=false
    await waitFor(() => {
      expect(result.current.wsStatus).toBe('polling');
    });
  });

  it('exposes wsError and lastWsUpdate', async () => {
    const { result } = renderHook(() => useKanbanEvents());
    await waitFor(() => {
      expect(result.current.wsError).toBeNull();
      expect(result.current.lastWsUpdate).toBeNull();
    });
  });

  it('exposes reconnect function', async () => {
    const { result } = renderHook(() => useKanbanEvents());
    expect(typeof result.current.reconnect).toBe('function');
  });

  // ── WebSocket 事件处理 ──

  describe('WebSocket event handling', () => {
    it('task_created adds task to list', async () => {
      mockFetchKanbanTasks.mockResolvedValue([]);
      const { result } = renderHook(() => useKanbanEvents());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const newTask = makeTask({ id: 't_new', title: '新任务' });
      act(() => {
        capturedOnEvent?.({
          type: 'task_created',
          task_id: 't_new',
          task: newTask,
        });
      });

      expect(result.current.tasks).toEqual([newTask]);
      expect(result.current.lastWsUpdate).toBeInstanceOf(Date);
    });

    it('task_created ignores duplicate task_id', async () => {
      const existing = makeTask({ id: 't1', title: '已有任务' });
      mockFetchKanbanTasks.mockResolvedValue([existing]);
      const { result } = renderHook(() => useKanbanEvents());
      await waitFor(() => expect(result.current.tasks).toEqual([existing]));

      act(() => {
        capturedOnEvent?.({
          type: 'task_created',
          task_id: 't1',
          task: makeTask({ id: 't1', title: '重复任务' }),
        });
      });

      // Should be ignored, original preserved
      expect(result.current.tasks).toEqual([existing]);
    });

    it('task_changed replaces existing task', async () => {
      const original = makeTask({ id: 't1', status: 'todo', title: '旧标题' });
      mockFetchKanbanTasks.mockResolvedValue([original]);
      const { result } = renderHook(() => useKanbanEvents());
      await waitFor(() => expect(result.current.tasks).toEqual([original]));

      const updated = makeTask({ id: 't1', status: 'doing', title: '新标题' });
      act(() => {
        capturedOnEvent?.({
          type: 'task_changed',
          task_id: 't1',
          task: updated,
          old_status: 'todo',
          new_status: 'doing',
        });
      });

      expect(result.current.tasks).toEqual([updated]);
    });

    it('task_changed for unknown task is ignored', async () => {
      mockFetchKanbanTasks.mockResolvedValue([]);
      const { result } = renderHook(() => useKanbanEvents());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        capturedOnEvent?.({
          type: 'task_changed',
          task_id: 't_unknown',
          task: makeTask({ id: 't_unknown' }),
          old_status: 'todo',
          new_status: 'doing',
        });
      });

      expect(result.current.tasks).toEqual([]);
    });

    it('task_claimed replaces existing task', async () => {
      const original = makeTask({ id: 't1', assignee: 'unassigned', status: 'todo' });
      mockFetchKanbanTasks.mockResolvedValue([original]);
      const { result } = renderHook(() => useKanbanEvents());
      await waitFor(() => expect(result.current.tasks).toEqual([original]));

      const claimed = makeTask({ id: 't1', assignee: 'coder-404', status: 'doing' });
      act(() => {
        capturedOnEvent?.({
          type: 'task_claimed',
          task_id: 't1',
          task: claimed,
        });
      });

      expect(result.current.tasks).toEqual([claimed]);
    });

    it('task_claimed adds new task if not in cache', async () => {
      mockFetchKanbanTasks.mockResolvedValue([]);
      const { result } = renderHook(() => useKanbanEvents());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const claimed = makeTask({ id: 't_new', assignee: 'coder-404', status: 'doing' });
      act(() => {
        capturedOnEvent?.({
          type: 'task_claimed',
          task_id: 't_new',
          task: claimed,
        });
      });

      expect(result.current.tasks).toEqual([claimed]);
    });

    it('task_deleted removes task from list', async () => {
      const tasks = [
        makeTask({ id: 't1', title: '任务1' }),
        makeTask({ id: 't2', title: '任务2' }),
      ];
      mockFetchKanbanTasks.mockResolvedValue(tasks);
      const { result } = renderHook(() => useKanbanEvents());
      await waitFor(() => expect(result.current.tasks).toEqual(tasks));

      act(() => {
        capturedOnEvent?.({ type: 'task_deleted', task_id: 't1' });
      });

      expect(result.current.tasks).toEqual([tasks[1]]);
    });

    it('task_deleted for unknown task does not crash', async () => {
      mockFetchKanbanTasks.mockResolvedValue([]);
      const { result } = renderHook(() => useKanbanEvents());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        capturedOnEvent?.({ type: 'task_deleted', task_id: 't_unknown' });
      });

      expect(result.current.tasks).toEqual([]);
    });

    it('heartbeat updates lastWsUpdate but not tasks', async () => {
      const tasks = [makeTask({ id: 't1' })];
      mockFetchKanbanTasks.mockResolvedValue(tasks);
      const { result } = renderHook(() => useKanbanEvents());
      await waitFor(() => expect(result.current.tasks).toEqual(tasks));

      const before = result.current.lastWsUpdate;
      act(() => {
        capturedOnEvent?.({ type: 'heartbeat', task_id: '' });
      });

      expect(result.current.lastWsUpdate).toBeInstanceOf(Date);
      expect(result.current.lastWsUpdate).not.toBe(before);
      expect(result.current.tasks).toEqual(tasks);
    });

    it('event without task object is ignored (except deleted/heartbeat)', async () => {
      mockFetchKanbanTasks.mockResolvedValue([]);
      const { result } = renderHook(() => useKanbanEvents());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        capturedOnEvent?.({ type: 'task_created', task_id: 't_orphan' });
      });

      expect(result.current.tasks).toEqual([]);
    });
  });

  // ── 手动刷新 ──

  it('refresh() re-fetches tasks', async () => {
    const tasks = [makeTask({ id: 't1' })];
    mockFetchKanbanTasks.mockResolvedValue(tasks);
    const { result } = renderHook(() => useKanbanEvents());
    await waitFor(() => expect(result.current.tasks).toEqual(tasks));

    const newTasks = [makeTask({ id: 't2' })];
    mockFetchKanbanTasks.mockResolvedValue(newTasks);
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.tasks).toEqual(newTasks);
  });

  // ── 页面获焦刷新 ──

  it('refreshes on document visibilitychange to visible', async () => {
    renderHook(() => useKanbanEvents());
    await waitFor(() => expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(2);
    });
  });

  it('does NOT refresh on visibilitychange to hidden', async () => {
    renderHook(() => useKanbanEvents());
    await waitFor(() => expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Should still be 1 call
    expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(1);
  });

  it('refreshes on window focus', async () => {
    renderHook(() => useKanbanEvents());
    await waitFor(() => expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(2);
    });
  });

  it('skips focus refresh when refreshOnFocus=false', async () => {
    renderHook(() => useKanbanEvents({ refreshOnFocus: false }));
    await waitFor(() => expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(1);
  });

  // ── 非 WS 模式 ──

  it('uses pollingInterval when WS disabled', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_USE_KANBAN', 'false');
    mockFetchKanbanTasks.mockResolvedValue([]);

    renderHook(() => useKanbanEvents({ pollingInterval: 10_000 }));

    // Initial fetch
    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(1);

    // After 10s polling interval
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(2);

    // After another 10s
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(3);
  });

  // ── lastUpdated ──

  it('updates lastUpdated on fetch', async () => {
    const before = new Date();
    const { result } = renderHook(() => useKanbanEvents());
    await waitFor(() => {
      expect(result.current.lastUpdated.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  it('updates lastUpdated on WS event', async () => {
    mockFetchKanbanTasks.mockResolvedValue([]);
    const { result } = renderHook(() => useKanbanEvents());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = result.current.lastUpdated;
    act(() => {
      capturedOnEvent?.({
        type: 'task_created',
        task_id: 't_new',
        task: makeTask({ id: 't_new' }),
      });
    });

    expect(result.current.lastUpdated.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
