import type { Employee, KanbanTask } from '@/types/employee';
import {
  getStatusLabel,
  getStatusColor,
  getKanbanStatusLabel,
  getKanbanStatusColor,
  getKanbanStatusTextColor,
} from '@/types/employee';
import { useEmployeeStatus } from '@/hooks/useEmployeeStatus';

interface EmployeeStatusProps {
  onBack: () => void;
  onOpenOffice: () => void;
}

/** 单个 kanban 任务徽章（带状态颜色） */
function KanbanTaskBadge({ task, isCurrentTask }: { task: KanbanTask; isCurrentTask: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded border ${
        isCurrentTask
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border bg-surface text-text2'
      }`}
      title={task.body || task.title}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${getKanbanStatusColor(task.status)}`}
      />
      <span className="truncate max-w-[120px]">{task.title}</span>
      <span className={`text-[10px] shrink-0 ${getKanbanStatusTextColor(task.status)}`}>
        {getKanbanStatusLabel(task.status)}
      </span>
    </span>
  );
}

/** 任务列表区域：优先展示 kanban 任务详情，否则回退到字符串标签 */
function TaskList({ employee }: { employee: Employee }) {
  const kanbanTasks = employee.kanbanTasks;

  // 有 kanban 任务对象时，展示详情
  if (kanbanTasks && kanbanTasks.length > 0) {
    // 排序：doing/running 在前，todo 在中，done 在后
    const statusOrder: Record<string, number> = {
      running: 0, doing: 0, blocked: 1, ready: 2, todo: 2, done: 3, completed: 3,
    };
    const sorted = [...kanbanTasks].sort(
      (a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9),
    );

    return (
      <div className="flex flex-wrap gap-1">
        {sorted.map((task) => (
          <KanbanTaskBadge
            key={task.id}
            task={task}
            isCurrentTask={task.id === employee.currentTaskId}
          />
        ))}
      </div>
    );
  }

  // 回退：纯文本标签
  if (employee.tasks.length > 0) {
    return (
      <div className="flex flex-wrap gap-1">
        {employee.tasks.map((task, index) => (
          <span
            key={`${employee.name}-${task}-${index}`}
            className="inline-block px-1.5 py-0.5 text-[11px] rounded bg-surface text-text2 border border-border"
          >
            {task}
          </span>
        ))}
      </div>
    );
  }

  return null;
}

function EmployeeCard({ employee }: { employee: Employee }) {
  const total = employee.kanbanTaskCount ?? employee.taskCount;
  const completed = employee.kanbanCompletedCount ?? 0;
  const running = employee.kanbanRunningCount ?? 0;
  const pending = employee.kanbanPendingCount ?? 0;
  const progressPercent = total && total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-bg rounded-lg p-3 border border-border">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{employee.avatar}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text truncate">{employee.name}</span>
            <span
              className={`inline-block w-2 h-2 rounded-full shrink-0 ${getStatusColor(employee.status)}`}
            />
            <span className="text-xs text-text2 shrink-0">{getStatusLabel(employee.status)}</span>
          </div>
          <span className="text-xs text-text2">{employee.role}</span>
        </div>
      </div>

      {/* 当前任务 */}
      <div className="text-xs text-text2 mb-1.5">
        <span className="text-text2/70">当前：</span>
        <span className="text-primary">{employee.currentTask}</span>
      </div>

      {/* 进度条（仅在有 kanban 任务时显示） */}
      {total !== undefined && total > 0 && (
        <div className="mb-1.5">
          <div className="flex items-center justify-between text-[11px] text-text2 mb-0.5">
            <span>进度 {completed}/{total}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex gap-2 mt-1 text-[10px] text-text2/70">
            {running > 0 && <span className="text-success">●{running} 进行中</span>}
            {pending > 0 && <span className="text-yellow-500">●{pending} 待处理</span>}
            {completed > 0 && <span className="text-blue-400">●{completed} 已完成</span>}
          </div>
        </div>
      )}

      {/* 任务列表 */}
      <TaskList employee={employee} />
    </div>
  );
}

export function EmployeeStatus({ onBack, onOpenOffice }: EmployeeStatusProps) {
  const { employees, lastUpdated, refresh } = useEmployeeStatus();

  const workingCount = employees.filter((e) => e.status === 'working').length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="text-text2 bg-transparent border-none cursor-pointer hover:text-text text-sm"
            title="返回"
          >
            ←
          </button>
          <span className="text-sm font-semibold text-text">👥 员工状态</span>
        </div>
        <button
          onClick={refresh}
          className="text-text2 bg-transparent border-none cursor-pointer hover:text-text text-sm"
          title="刷新"
        >
          🔄
        </button>
      </div>

      {/* Office button */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <button
          onClick={onOpenOffice}
          className="w-full py-1.5 px-3 rounded text-xs font-medium cursor-pointer border-none transition-colors"
          style={{
            backgroundColor: '#4488CC',
            color: '#FFFFFF',
          }}
          title="进入办公室"
        >
          🏢 进入办公室
        </button>
      </div>

      {/* Summary */}
      <div className="px-3 py-2 text-xs text-text2 border-b border-border shrink-0">
        <span className="text-success">{workingCount}</span> 人工作中 · 共 {employees.length} 人
        <span className="float-right text-text2/50">
          {lastUpdated.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* Employee list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {employees.map((emp) => (
          <EmployeeCard key={emp.name} employee={emp} />
        ))}
      </div>
    </div>
  );
}
