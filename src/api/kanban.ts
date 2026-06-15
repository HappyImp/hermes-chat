import type { KanbanTask, KanbanStats, Employee } from '@/types/employee';
export type { KanbanTask } from '@/types/employee';
import { resolveAssignee } from '@/config/employeeMapping';

const API_BASE = '/chat/api/kanban';

/** Employee's kanban-derived status summary. */
export interface EmployeeKanbanStatus {
  status: 'working' | 'standby' | 'off' | 'completed';
  currentTask: string;
  pendingCount: number;
  completedCount: number;
  runningCount: number;
}

// ─── REST API ───────────────────────────────────────────────────────

/** 获取 kanban 任务列表 */
export async function fetchKanbanTasks(): Promise<KanbanTask[]> {
  try {
    const res = await fetch(`${API_BASE}/tasks`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.tasks ?? []);
  } catch {
    return [];
  }
}

/** 获取单个任务详情 */
export async function fetchKanbanTask(id: string): Promise<KanbanTask | null> {
  try {
    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(id)}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** 获取 kanban 统计数据 */
export async function fetchKanbanStats(): Promise<KanbanStats> {
  try {
    const res = await fetch(`${API_BASE}/stats`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return { total: 0, doing: 0, done: 0, pending: 0 };
    return await res.json();
  } catch {
    return { total: 0, doing: 0, done: 0, pending: 0 };
  }
}

/** 获取 kanban 员工列表（含状态） */
export async function fetchKanbanEmployees(): Promise<Employee[]> {
  try {
    const res = await fetch(`${API_BASE}/employees`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.employees ?? []);
  } catch {
    return [];
  }
}

// ─── WebSocket ──────────────────────────────────────────────────────

export type KanbanEventType =
  | 'task.created'
  | 'task.updated'
  | 'task.completed'
  | 'task.deleted'
  | 'employee.status_changed';

export interface KanbanEvent {
  type: KanbanEventType;
  payload: unknown;
  timestamp: string;
}

type EventHandler = (event: KanbanEvent) => void;

/** 指数退避重连的 WebSocket 客户端 */
export class KanbanWebSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<EventHandler>();
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30_000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private url: string) {}

  /** 注册事件处理器 */
  on(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** 启动连接 */
  connect(): void {
    if (this.stopped) return;
    this.tryConnect();
  }

  /** 主动断开 */
  disconnect(): void {
    this.stopped = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** 当前是否已连接 */
  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private tryConnect(): void {
    if (this.stopped) return;

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectDelay = 1000; // 重置退避
    };

    this.ws.onmessage = (msg: MessageEvent) => {
      try {
        const event: KanbanEvent = JSON.parse(msg.data);
        for (const handler of this.handlers) {
          handler(event);
        }
      } catch {
        // 忽略解析失败的事件
      }
    };

    this.ws.onclose = () => {
      if (!this.stopped) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose 会紧随其后触发，在那里处理重连
    };
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay,
      );
      this.tryConnect();
    }, this.reconnectDelay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

/** Get the WebSocket URL for kanban events. */
export function getKanbanWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/chat/api/kanban/events`;
}

// ─── Status Derivation ─────────────────────────────────────────────

/**
 * Map a kanban assignee name to an employee display name.
 * Kanban assignees use Hermes profile names (e.g., "coder-404"),
 * while employees use display names (e.g., "404").
 * Returns null if no match.
 *
 * Delegates to shared config (resolveAssignee).
 */
export function mapKanbanAssigneeToEmployee(assignee: string): string | null {
  return resolveAssignee(assignee);
}

/**
 * Derive an employee's status from their kanban tasks.
 *
 * Rules (priority order):
 * 1. Any task with status 'doing' → 'working' (show task title)
 * 2. Any task with status 'todo' → 'standby' (has pending work)
 * 3. Only 'done' tasks → 'completed'; no tasks → 'completed'
 */
export function deriveKanbanTaskStatus(tasks: KanbanTask[]): EmployeeKanbanStatus {
  const doing = tasks.filter((t) => t.status === 'doing');
  const todo = tasks.filter((t) => t.status === 'todo');
  const done = tasks.filter((t) => t.status === 'done');

  if (doing.length > 0) {
    return {
      status: 'working',
      currentTask: doing[0].title,
      pendingCount: todo.length,
      completedCount: done.length,
      runningCount: doing.length,
    };
  }

  if (todo.length > 0) {
    return {
      status: 'standby',
      currentTask: `待处理: ${todo.length} 个任务`,
      pendingCount: todo.length,
      completedCount: done.length,
      runningCount: 0,
    };
  }

  return {
    status: 'completed',
    currentTask: done.length > 0 ? `已完成 ${done.length} 项` : '暂无任务',
    pendingCount: 0,
    completedCount: done.length,
    runningCount: 0,
  };
}

/**
 * Group kanban tasks by assignee, returning a map of employee name → tasks.
 * Only includes tasks whose assignee maps to a known employee.
 */
export function groupKanbanTasksByEmployee(
  tasks: KanbanTask[],
): Map<string, KanbanTask[]> {
  const grouped = new Map<string, KanbanTask[]>();
  for (const task of tasks) {
    const employee = mapKanbanAssigneeToEmployee(task.assignee);
    if (!employee) continue;
    const existing = grouped.get(employee) ?? [];
    existing.push(task);
    grouped.set(employee, existing);
  }
  return grouped;
}
