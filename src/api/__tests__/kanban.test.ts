import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mapKanbanAssigneeToEmployee,
  deriveKanbanTaskStatus,
  groupKanbanTasksByEmployee,
  fetchKanbanTasks,
  KanbanWebSocket,
  getKanbanWsUrl,
} from '../kanban';
import type { KanbanTask } from '@/types/employee';
import type { KanbanWsEvent } from '../kanban';

function makeTask(overrides: Partial<KanbanTask> = {}): KanbanTask {
  return {
    id: 't_test123',
    title: '测试任务',
    status: 'todo',
    assignee: 'coder-404',
    priority: '0',
    created_at: 1750000000,
    started_at: 1750000000,
    ...overrides,
  };
}

describe('mapKanbanAssigneeToEmployee', () => {
  it('maps coder-404 to 404', () => {
    expect(mapKanbanAssigneeToEmployee('coder-404')).toBe('404');
  });

  it('maps profile names containing 404', () => {
    expect(mapKanbanAssigneeToEmployee('404')).toBe('404');
    expect(mapKanbanAssigneeToEmployee('worker-404')).toBe('404');
  });

  it('maps reviewer to 裁判君', () => {
    expect(mapKanbanAssigneeToEmployee('reviewer')).toBe('裁判君');
    expect(mapKanbanAssigneeToEmployee('referee')).toBe('裁判君');
  });

  it('maps 裁判 to 裁判君', () => {
    expect(mapKanbanAssigneeToEmployee('裁判')).toBe('裁判君');
  });

  it('maps ditto to Ditto', () => {
    expect(mapKanbanAssigneeToEmployee('ditto')).toBe('Ditto');
    expect(mapKanbanAssigneeToEmployee('Ditto')).toBe('Ditto');
  });

  it('maps laocai to 老财', () => {
    expect(mapKanbanAssigneeToEmployee('laocai')).toBe('老财');
    expect(mapKanbanAssigneeToEmployee('老财')).toBe('老财');
  });

  it('maps tieke to 铁壳', () => {
    expect(mapKanbanAssigneeToEmployee('tieke')).toBe('铁壳');
    expect(mapKanbanAssigneeToEmployee('铁壳')).toBe('铁壳');
  });

  it('maps xiaok to 小K', () => {
    expect(mapKanbanAssigneeToEmployee('xiaok')).toBe('小K');
    expect(mapKanbanAssigneeToEmployee('小K')).toBe('小K');
  });

  it('returns null for empty assignee', () => {
    expect(mapKanbanAssigneeToEmployee('')).toBeNull();
  });

  it('returns null for unknown assignee', () => {
    expect(mapKanbanAssigneeToEmployee('random-user')).toBeNull();
  });
});

describe('deriveKanbanTaskStatus', () => {
  it('returns working when task is doing', () => {
    const tasks = [makeTask({ status: 'doing', title: '修 Bug' })];
    const result = deriveKanbanTaskStatus(tasks);
    expect(result.status).toBe('working');
    expect(result.currentTask).toBe('修 Bug');
    expect(result.runningCount).toBe(1);
  });

  it('returns standby when tasks are pending (todo)', () => {
    const tasks = [
      makeTask({ status: 'todo', title: '任务A' }),
      makeTask({ status: 'todo', title: '任务B', id: 't_2' }),
    ];
    const result = deriveKanbanTaskStatus(tasks);
    expect(result.status).toBe('standby');
    expect(result.pendingCount).toBe(2);
  });

  it('returns completed when all tasks are done', () => {
    const tasks = [
      makeTask({ status: 'done', title: '已完成' }),
      makeTask({ status: 'done', title: '也完成了', id: 't_2' }),
    ];
    const result = deriveKanbanTaskStatus(tasks);
    expect(result.status).toBe('completed');
    expect(result.completedCount).toBe(2);
    expect(result.currentTask).toContain('已完成');
  });

  it('returns off when no tasks', () => {
    const result = deriveKanbanTaskStatus([]);
    expect(result.status).toBe('completed');
    expect(result.currentTask).toBe('暂无任务');
  });

  it('doing takes priority over todo', () => {
    const tasks = [
      makeTask({ status: 'todo', title: '待办任务', id: 't_1' }),
      makeTask({ status: 'doing', title: '进行中', id: 't_2' }),
    ];
    const result = deriveKanbanTaskStatus(tasks);
    expect(result.status).toBe('working');
    expect(result.currentTask).toBe('进行中');
  });

  it('counts all categories correctly', () => {
    const tasks = [
      makeTask({ status: 'doing', id: 't_1' }),
      makeTask({ status: 'todo', id: 't_2' }),
      makeTask({ status: 'done', id: 't_3' }),
      makeTask({ status: 'todo', id: 't_4' }),
    ];
    const result = deriveKanbanTaskStatus(tasks);
    expect(result.runningCount).toBe(1);
    expect(result.pendingCount).toBe(2);
    expect(result.completedCount).toBe(1);
  });
});

describe('groupKanbanTasksByEmployee', () => {
  it('groups tasks by mapped employee name', () => {
    const tasks = [
      makeTask({ assignee: 'coder-404', id: 't_1' }),
      makeTask({ assignee: 'coder-404', id: 't_2' }),
      makeTask({ assignee: 'reviewer', id: 't_3' }),
    ];
    const grouped = groupKanbanTasksByEmployee(tasks);
    expect(grouped.get('404')).toHaveLength(2);
    expect(grouped.get('裁判君')).toHaveLength(1);
  });

  it('skips tasks with unknown assignee', () => {
    const tasks = [
      makeTask({ assignee: 'unknown-user', id: 't_1' }),
      makeTask({ assignee: 'coder-404', id: 't_2' }),
    ];
    const grouped = groupKanbanTasksByEmployee(tasks);
    expect(grouped.size).toBe(1);
    expect(grouped.has('404')).toBe(true);
  });

  it('returns empty map for empty input', () => {
    const grouped = groupKanbanTasksByEmployee([]);
    expect(grouped.size).toBe(0);
  });
});

describe('fetchKanbanTasks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns tasks on success', async () => {
    const mockTasks = [makeTask()];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockTasks), { status: 200 }),
    );
    const tasks = await fetchKanbanTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('t_test123');
  });

  it('returns tasks from { tasks: [...] } format', async () => {
    const mockTasks = [makeTask()];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ tasks: mockTasks }), { status: 200 }),
    );
    const tasks = await fetchKanbanTasks();
    expect(tasks).toHaveLength(1);
  });

  it('returns empty array on non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );
    const tasks = await fetchKanbanTasks();
    expect(tasks).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    const tasks = await fetchKanbanTasks();
    expect(tasks).toEqual([]);
  });
});

describe('KanbanWebSocket', () => {
  let mockWs: {
    onopen: (() => void) | null;
    onmessage: ((msg: { data: string }) => void) | null;
    onclose: (() => void) | null;
    onerror: (() => void) | null;
    close: ReturnType<typeof vi.fn>;
    readyState: number;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockWs = {
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      close: vi.fn(),
      readyState: 0, // CONNECTING
    };
    const MockWebSocket = vi.fn().mockImplementation(() => mockWs);
    (MockWebSocket as unknown as { OPEN: number }).OPEN = 1;
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('creates WebSocket with correct URL', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    ws.connect();
    expect(WebSocket).toHaveBeenCalledWith('ws://localhost:3000/events');
  });

  it('starts in disconnected status', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    expect(ws.status).toBe('disconnected');
  });

  it('sets connecting status on connect', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    const statusChanges: string[] = [];
    ws.onStatusChange((s) => statusChanges.push(s));

    ws.connect();
    expect(statusChanges).toContain('connecting');
  });

  it('sets connected status on open', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    const statusChanges: string[] = [];
    ws.onStatusChange((s) => statusChanges.push(s));

    ws.connect();
    mockWs.readyState = 1; // OPEN
    mockWs.onopen?.();

    expect(statusChanges).toContain('connected');
    expect(ws.connected).toBe(true);
  });

  it('parses and dispatches events', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    const events: unknown[] = [];
    ws.on((e) => events.push(e));

    ws.connect();
    mockWs.onopen?.();

    const testEvent = { type: 'task_changed', task_id: 't_1', task: { id: 't_1', status: 'doing' } };
    mockWs.onmessage?.({ data: JSON.stringify(testEvent) });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(testEvent);
  });

  it('dispatches task_claimed events', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    const events: KanbanWsEvent[] = [];
    ws.on((e) => events.push(e));

    ws.connect();
    mockWs.onopen?.();
    mockWs.onmessage?.({
      data: JSON.stringify({
        type: 'task_claimed',
        task_id: 't_1',
        task: { id: 't_1', title: '任务', status: 'doing', assignee: 'coder-404', priority: '0' },
      }),
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('task_claimed');
  });

  it('dispatches heartbeat events', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    const events: KanbanWsEvent[] = [];
    ws.on((e) => events.push(e));

    ws.connect();
    mockWs.onopen?.();
    mockWs.onmessage?.({
      data: JSON.stringify({
        type: 'heartbeat',
        task_id: '',
        task: { id: '', title: '', status: '', assignee: '', priority: '0' },
      }),
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('heartbeat');
  });

  it('updates lastMessageTime on message', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    expect(ws.lastMessageTime).toBeNull();

    ws.connect();
    mockWs.onopen?.();
    mockWs.onmessage?.({
      data: JSON.stringify({ type: 'task_created', task_id: 't_1', task: { id: 't_1' } }),
    });

    expect(ws.lastMessageTime).toBeInstanceOf(Date);
  });

  it('ignores invalid JSON messages', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    const events: unknown[] = [];
    ws.on((e) => events.push(e));

    ws.connect();
    mockWs.onopen?.();
    mockWs.onmessage?.({ data: 'not json' });

    expect(events).toHaveLength(0);
  });

  it('schedules reconnect on close', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    ws.connect();
    mockWs.onopen?.();
    mockWs.onclose?.();

    // Should schedule reconnect after 1s (initial delay)
    expect(ws.status).toBe('reconnecting');

    vi.advanceTimersByTime(1000);
    expect(WebSocket).toHaveBeenCalledTimes(2); // Reconnected
  });

  it('does not reconnect after disconnect()', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    ws.connect();
    ws.disconnect();

    vi.advanceTimersByTime(5000);
    expect(WebSocket).toHaveBeenCalledTimes(1); // Only initial connect
  });

  it('cleans up on disconnect', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    ws.connect();
    ws.disconnect();

    expect(mockWs.close).toHaveBeenCalled();
    expect(ws.status).toBe('disconnected');
  });

  it('unsubscribe works', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    const events: unknown[] = [];
    const unsub = ws.on((e) => events.push(e));

    ws.connect();
    mockWs.onopen?.();

    mockWs.onmessage?.({ data: JSON.stringify({ type: 'task_created', task_id: 't_1' }) });
    expect(events).toHaveLength(1);

    unsub();
    mockWs.onmessage?.({ data: JSON.stringify({ type: 'task_created', task_id: 't_2' }) });
    expect(events).toHaveLength(1); // No new events
  });
});

describe('getKanbanWsUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: {
        protocol: 'http:',
        host: 'localhost:3000',
      },
    });
  });

  it('returns ws:// URL for http', () => {
    const url = getKanbanWsUrl();
    expect(url).toMatch(/^ws:\/\/localhost:3000\/chat\/api\/kanban\/events/);
  });

  it('includes token query param', () => {
    const url = getKanbanWsUrl();
    expect(url).toContain('token=');
  });
});
