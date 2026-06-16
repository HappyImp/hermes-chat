import { describe, it, expect } from 'vitest';
import { resolveAssignee } from '../employeeMapping';

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
