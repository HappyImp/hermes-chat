export interface Employee {
  name: string;
  role: string;
  avatar: string;
  status: 'working' | 'standby' | 'off' | 'completed' | 'blocked';
  currentTask: string;
  tasks: string[];
  /** Kanban 看板状态（running/todo/done/blocked 等），仅 kanban 模式下有值 */
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
  /** 该员工的 kanban 任务对象列表（用于详情展示） */
  kanbanTasks?: KanbanTask[];
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
    case 'blocked':
      return '阻塞';
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
    case 'blocked':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * 将 kanban 任务状态映射为员工状态。
 * Kanban DB 实际状态：todo / ready / running / blocked / done
 * - 'running' → 'working'   （进行中）
 * - 'doing'   → 'working'   （兼容旧值）
 * - 'ready'   → 'standby'   （就绪待领取）
 * - 'todo'    → 'standby'   （待办）
 * - 'done'    → 'completed' （已完成）
 * - 'blocked' → 'blocked'   （被阻塞）
 * - 其他      → 'off'
 */
export function kanbanStatusToEmployeeStatus(
  kanbanStatus: string,
): Employee['status'] {
  switch (kanbanStatus) {
    case 'running':
    case 'doing':
      return 'working';
    case 'ready':
    case 'todo':
      return 'standby';
    case 'done':
      return 'completed';
    case 'blocked':
      return 'blocked';
    default:
      return 'off';
  }
}

/** kanban 任务状态标签 */
export function getKanbanStatusLabel(status: string): string {
  switch (status) {
    case 'doing':
    case 'running':
      return '进行中';
    case 'todo':
      return '待处理';
    case 'ready':
      return '就绪';
    case 'done':
    case 'completed':
      return '已完成';
    case 'blocked':
      return '阻塞';
    default:
      return status || '未知';
  }
}

/** kanban 任务状态对应的 Tailwind 背景色（小圆点/徽章用） */
export function getKanbanStatusColor(status: string): string {
  switch (status) {
    case 'doing':
    case 'running':
      return 'bg-green-500';
    case 'todo':
      return 'bg-amber-500';
    case 'ready':
      return 'bg-yellow-500';
    case 'done':
    case 'completed':
      return 'bg-blue-500';
    case 'blocked':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

/** kanban 任务状态对应的 Tailwind 文字色 */
export function getKanbanStatusTextColor(status: string): string {
  switch (status) {
    case 'doing':
    case 'running':
      return 'text-green-400';
    case 'todo':
      return 'text-amber-400';
    case 'ready':
      return 'text-yellow-400';
    case 'done':
    case 'completed':
      return 'text-blue-400';
    case 'blocked':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}
