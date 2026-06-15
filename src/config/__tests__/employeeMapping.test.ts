import { describe, it, expect } from 'vitest';
import { EMPLOYEE_META, resolveAssignee, resolveCronJobName } from '../employeeMapping';

describe('EMPLOYEE_META', () => {
  it('contains all known employees', () => {
    const names = Object.keys(EMPLOYEE_META);
    expect(names).toContain('老财');
    expect(names).toContain('铁壳');
    expect(names).toContain('小K');
    expect(names).toContain('404');
    expect(names).toContain('裁判君');
    expect(names).toContain('Ditto');
  });

  it('each employee has required fields', () => {
    for (const [name, meta] of Object.entries(EMPLOYEE_META)) {
      expect(meta.role, `${name} missing role`).toBeTruthy();
      expect(meta.avatar, `${name} missing avatar`).toBeTruthy();
      expect(Array.isArray(meta.tasks), `${name} tasks not array`).toBe(true);
      expect(meta.aliases.length, `${name} aliases empty`).toBeGreaterThan(0);
    }
  });
});

describe('resolveAssignee', () => {
  it('maps profile names containing 404', () => {
    expect(resolveAssignee('404')).toBe('404');
    expect(resolveAssignee('coder-404')).toBe('404');
    expect(resolveAssignee('worker-404')).toBe('404');
  });

  it('maps reviewer/referee to 裁判君', () => {
    expect(resolveAssignee('reviewer')).toBe('裁判君');
    expect(resolveAssignee('referee')).toBe('裁判君');
    expect(resolveAssignee('裁判')).toBe('裁判君');
  });

  it('maps ditto to Ditto', () => {
    expect(resolveAssignee('ditto')).toBe('Ditto');
    expect(resolveAssignee('Ditto')).toBe('Ditto');
  });

  it('maps laocai to 老财', () => {
    expect(resolveAssignee('laocai')).toBe('老财');
    expect(resolveAssignee('老财')).toBe('老财');
  });

  it('maps tieke to 铁壳', () => {
    expect(resolveAssignee('tieke')).toBe('铁壳');
    expect(resolveAssignee('铁壳')).toBe('铁壳');
  });

  it('maps xiaok to 小K', () => {
    expect(resolveAssignee('xiaok')).toBe('小K');
    expect(resolveAssignee('小K')).toBe('小K');
    expect(resolveAssignee('小k')).toBe('小K');
  });

  it('returns null for empty assignee', () => {
    expect(resolveAssignee('')).toBeNull();
  });

  it('returns null for unknown assignee', () => {
    expect(resolveAssignee('random-user')).toBeNull();
  });
});

describe('resolveCronJobName', () => {
  it('maps 老财 jobs', () => {
    expect(resolveCronJobName('老财-盘前研判')).toBe('老财');
    expect(resolveCronJobName('老财-开盘异动')).toBe('老财');
  });

  it('maps 铁壳 jobs', () => {
    expect(resolveCronJobName('铁壳日报')).toBe('铁壳');
  });

  it('maps 小K jobs', () => {
    expect(resolveCronJobName('小K早报')).toBe('小K');
  });

  it('maps jobs containing 早报 to 小K', () => {
    expect(resolveCronJobName('科技早报')).toBe('小K');
  });

  it('maps 404 jobs', () => {
    expect(resolveCronJobName('404日报')).toBe('404');
    expect(resolveCronJobName('404-employee-status-api')).toBe('404');
  });

  it('maps 裁判君 jobs', () => {
    expect(resolveCronJobName('裁判君审查')).toBe('裁判君');
  });

  it('maps Ditto jobs', () => {
    expect(resolveCronJobName('Ditto测试')).toBe('Ditto');
    expect(resolveCronJobName('ditto-test')).toBe('Ditto');
  });

  it('returns null for unknown job names', () => {
    expect(resolveCronJobName('random-task')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(resolveCronJobName('')).toBeNull();
  });
});
