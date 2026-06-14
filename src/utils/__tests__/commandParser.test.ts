import { describe, it, expect } from 'vitest';
import { parseCommand, isDispatchCommand, getValidEmployees } from '../commandParser';

describe('parseCommand', () => {
  it('parses valid dispatch command with known employee', () => {
    const result = parseCommand('/dispatch 404 修复登录bug');
    expect(result).toEqual({
      type: 'dispatch',
      employee: '404',
      task: '修复登录bug',
    });
  });

  it('parses dispatch with 老财 employee', () => {
    const result = parseCommand('/dispatch 老财 分析600519');
    expect(result).toEqual({
      type: 'dispatch',
      employee: '老财',
      task: '分析600519',
    });
  });

  it('parses dispatch with multi-word task description', () => {
    const result = parseCommand('/dispatch 铁壳 检查服务器磁盘空间和内存使用情况');
    expect(result).toEqual({
      type: 'dispatch',
      employee: '铁壳',
      task: '检查服务器磁盘空间和内存使用情况',
    });
  });

  it('returns unknown for non-dispatch input', () => {
    const result = parseCommand('普通消息');
    expect(result).toEqual({
      type: 'unknown',
      error: '不是 dispatch 命令',
    });
  });

  it('returns unknown for empty input', () => {
    const result = parseCommand('');
    expect(result).toEqual({
      type: 'unknown',
      error: '不是 dispatch 命令',
    });
  });

  it('returns unknown for unknown employee', () => {
    const result = parseCommand('/dispatch 未知员工 任务');
    expect(result).toEqual({
      type: 'unknown',
      error: expect.stringContaining('未知员工: 未知员工'),
    });
  });

  it('returns unknown for missing task description', () => {
    const result = parseCommand('/dispatch 404');
    expect(result).toEqual({
      type: 'unknown',
      error: '不是 dispatch 命令',
    });
  });

  it('handles leading/trailing whitespace', () => {
    const result = parseCommand('  /dispatch 小K 生成早报  ');
    expect(result).toEqual({
      type: 'dispatch',
      employee: '小K',
      task: '生成早报',
    });
  });

  it('parses all 6 valid employees', () => {
    const employees = ['老财', '铁壳', '小K', '404', '裁判君', 'Ditto'];
    for (const emp of employees) {
      const result = parseCommand(`/dispatch ${emp} 测试任务`);
      expect(result).toEqual({
        type: 'dispatch',
        employee: emp,
        task: '测试任务',
      });
    }
  });
});

describe('isDispatchCommand', () => {
  it('returns true for /dispatch prefix', () => {
    expect(isDispatchCommand('/dispatch 404 fix bug')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(isDispatchCommand('hello world')).toBe(false);
  });

  it('returns true even for /dispatching (prefix match only)', () => {
    expect(isDispatchCommand('/dispatching 404 test')).toBe(true);
  });
});

describe('getValidEmployees', () => {
  it('returns all 6 employees', () => {
    const employees = getValidEmployees();
    expect(employees).toHaveLength(6);
    expect(employees).toContain('老财');
    expect(employees).toContain('404');
    expect(employees).toContain('Ditto');
  });
});
