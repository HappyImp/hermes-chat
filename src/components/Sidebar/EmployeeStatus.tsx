import type { Employee } from '@/types/employee';
import { getStatusLabel, getStatusColor } from '@/types/employee';
import { useEmployeeStatus } from '@/hooks/useEmployeeStatus';

interface EmployeeStatusProps {
  onBack: () => void;
}

function EmployeeCard({ employee }: { employee: Employee }) {
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
      <div className="text-xs text-text2 mb-1.5">
        <span className="text-text2/70">当前：</span>
        <span className="text-primary">{employee.currentTask}</span>
      </div>
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
    </div>
  );
}

export function EmployeeStatus({ onBack }: EmployeeStatusProps) {
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
