import type { TaskInfo } from '@/hooks/useEmployeeTask';

const employeeMap: Record<string, { avatar: string; role: string }> = {
  '老财': { avatar: '💰', role: 'AI操盘手' },
  '铁壳': { avatar: '🤖', role: '运维工程师' },
  '小K': { avatar: '🔍', role: '科技资讯官' },
  '404': { avatar: '💻', role: 'AI开发工程师' },
  '裁判君': { avatar: '⚖️', role: '代码审查员' },
  'Ditto': { avatar: '🧪', role: '测试工程师' },
};

const statusConfig = {
  pending: { icon: '⏳', text: '等待中', className: 'text-text2' },
  working: { icon: '🔄', text: '执行中...', className: 'text-primary animate-pulse' },
  completed: { icon: '✅', text: '已完成', className: 'text-success' },
  failed: { icon: '❌', text: '失败', className: 'text-danger' },
  timeout: { icon: '⏰', text: '超时', className: 'text-warning' },
};

interface TaskCardProps {
  taskInfo: TaskInfo;
}

export function TaskCard({ taskInfo }: TaskCardProps) {
  const { employee, task, status, startedAt, result, error } = taskInfo;
  const emp = employeeMap[employee] || { avatar: '👤', role: 'AI员工' };
  const st = statusConfig[status];

  return (
    <div className="bg-surface border border-border rounded-xl p-3.5 min-w-[280px] max-w-[400px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{emp.avatar}</span>
        <div className="flex-1">
          <span className="font-semibold text-sm">{employee}</span>
          <span className="text-xs text-text2 ml-2">{emp.role}</span>
        </div>
        <span className={`text-xs ${st.className}`}>{st.icon} {st.text}</span>
      </div>

      {/* Task description */}
      <div className="text-sm text-text mb-2">{task}</div>

      {/* Result */}
      {result && (
        <div className="text-xs text-success bg-success/10 rounded-lg p-2 mt-2" data-testid="task-result">
          {result}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-danger bg-danger/10 rounded-lg p-2 mt-2" data-testid="task-error">
          <span className="font-semibold">错误:</span> {error}
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-text2 mt-2">
        启动时间: {startedAt.toLocaleString('zh-CN')}
      </div>
    </div>
  );
}
