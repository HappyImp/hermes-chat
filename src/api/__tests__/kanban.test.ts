import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mapKanbanAssigneeToEmployee,
  deriveKanbanTaskStatus,
  groupKanbanTasksByEmployee,
  fetchKanbanTasks,
  fetchKanbanTask,
  fetchKanbanStats,
  fetchKanbanEmployees,
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

  it('returns working when task is running', () => {
    const tasks = [makeTask({ status: 'running', title: '开发功能' })];
    const result = deriveKanbanTaskStatus(tasks);
    expect(result.status).toBe('working');
    expect(result.currentTask).toBe('开发功能');
    expect(result.runningCount).toBe(1);
  });

  it('returns blocked when task is blocked', () => {
    const tasks = [makeTask({ status: 'blocked', title: '等待审查' })];
    const result = deriveKanbanTaskStatus(tasks);
    expect(result.status).toBe('blocked');
    expect(result.currentTask).toContain('阻塞');
    expect(result.currentTask).toContain('等待审查');
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

  it('returns standby when tasks are ready', () => {
    const tasks = [makeTask({ status: 'ready', title: '准备中' })];
    const result = deriveKanbanTaskStatus(tasks);
    expect(result.status).toBe('standby');
    expect(result.pendingCount).toBe(1);
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

  it('returns completed when no tasks', () => {
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

  it('running takes priority over blocked', () => {
    const tasks = [
      makeTask({ status: 'blocked', title: '阻塞任务', id: 't_1' }),
      makeTask({ status: 'running', title: '运行中', id: 't_2' }),
    ];
    const result = deriveKanbanTaskStatus(tasks);
    expect(result.status).toBe('working');
    expect(result.currentTask).toBe('运行中');
  });

  it('blocked takes priority over todo', () => {
    const tasks = [
      makeTask({ status: 'todo', title: '待办任务', id: 't_1' }),
      makeTask({ status: 'blocked', title: '阻塞任务', id: 't_2' }),
    ];
    const result = deriveKanbanTaskStatus(tasks);
    expect(result.status).toBe('blocked');
    expect(result.currentTask).toContain('阻塞');
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

describe('fetchKanbanTask', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns task on success', async () => {
    const mockTask = makeTask({ id: 't_abc', title: '详情任务' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockTask), { status: 200 }),
    );
    const task = await fetchKanbanTask('t_abc');
    expect(task).not.toBeNull();
    expect(task!.id).toBe('t_abc');
    expect(task!.title).toBe('详情任务');
  });

  it('encodes task id in URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(makeTask()), { status: 200 }),
    );
    await fetchKanbanTask('t/with/slash');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('t/with/slash')),
      expect.anything(),
    );
  });

  it('returns null on non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );
    const task = await fetchKanbanTask('t_missing');
    expect(task).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    const task = await fetchKanbanTask('t_err');
    expect(task).toBeNull();
  });
});

describe('fetchKanbanStats', () => {
  const fallback = { total: 0, doing: 0, done: 0, pending: 0 };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts stats from { stats: {...} } response', async () => {
    const mockStats = { total: 10, doing: 3, done: 5, pending: 2 };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ stats: mockStats }), { status: 200 }),
    );
    const stats = await fetchKanbanStats();
    expect(stats).toEqual(mockStats);
  });

  it('handles flat stats response (no wrapper)', async () => {
    const mockStats = { total: 5, doing: 1, done: 3, pending: 1 };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockStats), { status: 200 }),
    );
    const stats = await fetchKanbanStats();
    expect(stats).toEqual(mockStats);
  });

  it('returns fallback on non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Server Error', { status: 500 }),
    );
    const stats = await fetchKanbanStats();
    expect(stats).toEqual(fallback);
  });

  it('returns fallback on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    const stats = await fetchKanbanStats();
    expect(stats).toEqual(fallback);
  });
});

describe('fetchKanbanEmployees', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns employees on success', async () => {
    const mockEmployees = [
      { name: '404', role: 'coder', avatar: '🤖', status: 'working', currentTask: '写代码', tasks: [] },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockEmployees), { status: 200 }),
    );
    const employees = await fetchKanbanEmployees();
    expect(employees).toHaveLength(1);
    expect(employees[0].name).toBe('404');
  });

  it('returns employees from { employees: [...] } format', async () => {
    const mockEmployees = [
      { name: '裁判君', role: 'reviewer', avatar: '👨‍⚖️', status: 'standby', currentTask: '待命', tasks: [] },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ employees: mockEmployees }), { status: 200 }),
    );
    const employees = await fetchKanbanEmployees();
    expect(employees).toHaveLength(1);
    expect(employees[0].name).toBe('裁判君');
  });

  it('returns empty array on non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    );
    const employees = await fetchKanbanEmployees();
    expect(employees).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    const employees = await fetchKanbanEmployees();
    expect(employees).toEqual([]);
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

  it('connectionStatus alias matches status', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    expect(ws.connectionStatus).toBe('disconnected');
    ws.connect();
    expect(ws.connectionStatus).toBe('connecting');
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

  it('dispatches heartbeat events (no task_id)', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    const events: KanbanWsEvent[] = [];
    ws.on((e) => events.push(e));

    ws.connect();
    mockWs.onopen?.();
    // 后端只发 { type: "heartbeat" }，无 task_id
    mockWs.onmessage?.({
      data: JSON.stringify({ type: 'heartbeat' }),
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('heartbeat');
    expect(events[0].task_id).toBeUndefined();
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

  it('dispatches task_deleted events', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    const events: KanbanWsEvent[] = [];
    ws.on((e) => events.push(e));

    ws.connect();
    mockWs.onopen?.();
    mockWs.onmessage?.({
      data: JSON.stringify({
        type: 'task_deleted',
        task_id: 't_1',
      }),
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('task_deleted');
    expect(events[0].task_id).toBe('t_1');
  });

  it('fires error handlers on onerror', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    const errors: string[] = [];
    ws.onError((msg) => errors.push(msg));

    ws.connect();
    mockWs.onerror?.();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('WebSocket 连接错误');
  });

  it('onError unsubscribe works', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    const errors: string[] = [];
    const unsub = ws.onError((msg) => errors.push(msg));

    ws.connect();
    mockWs.onerror?.();
    expect(errors).toHaveLength(1);

    unsub();
    // Trigger another error via reconnect
    mockWs.onclose?.();
    vi.advanceTimersByTime(1000);
    mockWs.onerror?.();
    expect(errors).toHaveLength(1); // No new errors
  });

  it('handles multiple handlers', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    const events1: KanbanWsEvent[] = [];
    const events2: KanbanWsEvent[] = [];
    ws.on((e) => events1.push(e));
    ws.on((e) => events2.push(e));

    ws.connect();
    mockWs.onopen?.();
    mockWs.onmessage?.({
      data: JSON.stringify({ type: 'task_created', task_id: 't_1' }),
    });

    expect(events1).toHaveLength(1);
    expect(events2).toHaveLength(1);
  });

  it('handles multiple status change handlers', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    const statuses1: string[] = [];
    const statuses2: string[] = [];
    ws.onStatusChange((s) => statuses1.push(s));
    ws.onStatusChange((s) => statuses2.push(s));

    ws.connect();
    mockWs.readyState = 1;
    mockWs.onopen?.();

    expect(statuses1).toContain('connected');
    expect(statuses2).toContain('connected');
  });

  it('status handler unsubscribe works', () => {
    const ws = new KanbanWebSocket('ws://localhost:3000/events');
    const statuses: string[] = [];
    const unsub = ws.onStatusChange((s) => statuses.push(s));

    ws.connect();
    expect(statuses).toContain('connecting');

    unsub();
    mockWs.readyState = 1;
    mockWs.onopen?.();
    // Should not receive 'connected' after unsubscribe
    expect(statuses.filter((s) => s === 'connected')).toHaveLength(0);
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
