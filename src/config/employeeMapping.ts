/**
 * 共享员工配置：Kanban assignee 别名映射。
 *
 * resolveAssignee 将 kanban profile 名称映射到员工显示名。
 */

/** 员工别名映射（小写 → 显示名） */
const EMPLOYEE_ALIASES: Record<string, string> = {
  '老财': '老财',
  'laocai': '老财',
  '铁壳': '铁壳',
  'tieke': '铁壳',
  '小k': '小K',
  'xiaok': '小K',
  '404': '404',
  'coder-404': '404',
  '裁判': '裁判君',
  '裁判君': '裁判君',
  'reviewer': '裁判君',
  'referee': '裁判君',
  'ditto': 'Ditto',
};

/**
 * 根据 kanban assignee 名称查找员工显示名。
 * 基于 EMPLOYEE_ALIASES 做大小写不敏感匹配。
 * 返回 null 表示未找到。
 */
export function resolveAssignee(assignee: string): string | null {
  if (!assignee) return null;
  const lower = assignee.toLowerCase();
  for (const [alias, displayName] of Object.entries(EMPLOYEE_ALIASES)) {
    if (lower.includes(alias) || lower === alias) {
      return displayName;
    }
  }
  return null;
}
