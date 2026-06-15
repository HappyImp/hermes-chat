/**
 * 共享员工配置：元数据 + Kanban/Cron 映射。
 *
 * 所有员工名称、角色、头像、任务列表、assignee 别名
 * 统一在此维护，避免各模块硬编码。
 */

/** 员工基础元数据 */
export interface EmployeeMeta {
  role: string;
  avatar: string;
  tasks: string[];
  /** Kanban profile 别名列表（小写匹配） */
  aliases: string[];
}

/** 已知员工元数据（唯一数据源） */
export const EMPLOYEE_META: Record<string, EmployeeMeta> = {
  '老财': {
    role: 'AI操盘手',
    avatar: '💰',
    tasks: ['盘前研判', '开盘异动', '午盘复盘', '尾盘异动', '每晚复盘'],
    aliases: ['老财', 'laocai'],
  },
  '铁壳': {
    role: 'AI运维工程师',
    avatar: '🤖',
    tasks: ['每日日报', '运维护航'],
    aliases: ['铁壳', 'tieke'],
  },
  '小K': {
    role: 'AI情报员',
    avatar: '🔍',
    tasks: ['每日早报'],
    aliases: ['小k', 'xiaok'],
  },
  '404': {
    role: 'AI开发工程师',
    avatar: '💻',
    tasks: ['每日日报', '开发任务'],
    aliases: ['404', 'coder-404'],
  },
  '裁判君': {
    role: 'AI审查官',
    avatar: '⚖️',
    tasks: ['按需审查'],
    aliases: ['裁判', '裁判君', 'reviewer', 'referee'],
  },
  'Ditto': {
    role: 'AI测试工程师',
    avatar: '🧪',
    tasks: ['线上测试'],
    aliases: ['ditto'],
  },
};

/**
 * 根据 kanban assignee 名称查找员工显示名。
 * 基于 EMPLOYEE_META.aliases 做大小写不敏感匹配。
 * 返回 null 表示未找到。
 */
export function resolveAssignee(assignee: string): string | null {
  if (!assignee) return null;
  const lower = assignee.toLowerCase();
  for (const [displayName, meta] of Object.entries(EMPLOYEE_META)) {
    if (meta.aliases.some((alias) => lower.includes(alias) || lower === alias)) {
      return displayName;
    }
  }
  return null;
}

/**
 * 根据 cron job 名称查找员工显示名。
 * 逻辑：job name 包含员工中文名即匹配。
 */
export function resolveCronJobName(jobName: string): string | null {
  if (!jobName) return null;
  for (const displayName of Object.keys(EMPLOYEE_META)) {
    if (jobName.includes(displayName)) return displayName;
  }
  // 特殊：job name 含 "早报" → 小K
  if (jobName.includes('早报')) return '小K';
  // 特殊：job name 含 "ditto"（大小写不敏感）
  if (jobName.toLowerCase().includes('ditto')) return 'Ditto';
  return null;
}
