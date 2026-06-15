export interface Employee {
  name: string;
  role: string;
  avatar: string;
  status: 'working' | 'standby' | 'off' | 'completed';
  currentTask: string;
  tasks: string[];
  /** Kanban 看板状态（doing/todo/done 等），仅 kanban 模式下有值 */
  kanbanStatus?: string;
  /** 当前进行中的 kanban 任务 ID */
  currentTaskId?: string;
  /** 该员工负责的 kanban 任务总数 */
  taskCount?: number;
  /** kanban 任务总数（实时统计） */
  kanbanTaskCount?: number;
  /** kanban running 任务数 */
  kanbanRunningCount?: number;
  /** kanban pending 任务数 */
  kanbanPendingCount?: number;
  /** kanban completed 任务数 */
  kanbanCompletedCount?: number;
}

export interface EmployeeStatusData {
  employees: Employee[];
}

/** Kanban 任务 */
export interface KanbanTask {
  id: string;
  title: string;
  body?: string;
  status: string;
  assignee: string;
  priority: number | string;
  created_at?: number;
  started_at?: number;
  completed_at?: number | null;
  /** @deprecated use created_at */
  createdAt?: string;
  /** @deprecated use started_at */
  updatedAt?: string;
}

/** Kanban 看板统计 */
export interface KanbanStats {
  total: number;
  doing: number;
  done: number;
  pending: number;
}

export function getStatusLabel(status: Employee['status']): string {
  switch (status) {
    case 'working':
      return '工作中';
    case 'standby':
      return '待命';
    case 'off':
      return '休息';
    case 'completed':
      return '已完成';
    default:
      return '未知';
  }
}

export function getStatusColor(status: Employee['status']): string {
  switch (status) {
    case 'working':
      return 'bg-success';
    case 'standby':
      return 'bg-yellow-500';
    case 'off':
      return 'bg-gray-500';
    case 'completed':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * 将 kanban 任务状态映射为员工状态。
 * - 'doing' → 'working'
 * - 'todo'  → 'standby'
 * - 'done'  → 'completed'
 * - 其他    → 'off'
 */
export function kanbanStatusToEmployeeStatus(
  kanbanStatus: string,
): Employee['status'] {
  switch (kanbanStatus) {
    case 'doing':
      return 'working';
    case 'todo':
      return 'standby';
    case 'done':
      return 'completed';
    default:
      return 'off';
  }
}
