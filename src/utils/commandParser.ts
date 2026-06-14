/**
 * 解析聊天命令
 *
 * 支持的命令格式：
 * - /dispatch <员工名> <任务描述> — 启动员工异步任务
 */

export interface DispatchCommand {
  type: 'dispatch';
  employee: string;
  task: string;
}

export interface UnknownCommand {
  type: 'unknown';
  error: string;
}

export type ParsedCommand = DispatchCommand | UnknownCommand;

/** 支持的员工列表 */
const VALID_EMPLOYEES = ['老财', '铁壳', '小K', '404', '裁判君', 'Ditto'] as const;

/**
 * 解析用户输入的命令
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();

  const dispatchMatch = trimmed.match(/^\/dispatch\s+(\S+)\s+(.+)$/);
  if (!dispatchMatch) {
    return { type: 'unknown', error: '不是 dispatch 命令' };
  }

  const [, employee, task] = dispatchMatch;

  if (!VALID_EMPLOYEES.includes(employee as (typeof VALID_EMPLOYEES)[number])) {
    return {
      type: 'unknown',
      error: `未知员工: ${employee}，支持的员工：${VALID_EMPLOYEES.join('、')}`,
    };
  }

  if (!task.trim()) {
    return { type: 'unknown', error: '任务描述不能为空' };
  }

  return { type: 'dispatch', employee, task: task.trim() };
}

/**
 * 检查是否是 dispatch 命令
 */
export function isDispatchCommand(input: string): boolean {
  return input.trim().startsWith('/dispatch');
}

/**
 * 获取支持的员工列表
 */
export function getValidEmployees(): readonly string[] {
  return VALID_EMPLOYEES;
}
