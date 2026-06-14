/** 任务状态类型（全局共用） */
export type TaskStatus = 'pending' | 'working' | 'completed' | 'failed' | 'timeout';

/** 任务信息（用于消息元数据和任务调度） */
export interface TaskInfo {
  id: string;
  employee: string;
  task: string;
  status: TaskStatus;
  startedAt: Date;
  result?: string;
  error?: string;
}

/** 消息元数据 */
export interface MessageMetadata {
  type: 'task';
  taskInfo: TaskInfo;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: MessageMetadata;
}

export interface Session {
  id: string;
  title: string;
  channel: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatState {
  sessions: Record<string, Session[]>;
  currentChannel: string;
  currentSessionId: string | null;
  isStreaming: boolean;
}
