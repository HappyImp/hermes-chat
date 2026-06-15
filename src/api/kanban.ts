import type { KanbanTask, KanbanStats, Employee } from '@/types/employee';

const API_BASE = '/chat/api/kanban';

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

/**
 * 构造 WebSocket URL。
 * 同源页面使用相对协议，避免混合内容问题。
 */
export function buildKanbanWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/chat/api/kanban/events`;
}
