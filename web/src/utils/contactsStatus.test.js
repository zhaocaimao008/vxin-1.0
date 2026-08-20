import { describe, test, expect } from 'vitest';
import { seedOnlineIds, filterContactsByStatus } from './contactsStatus';

describe('seedOnlineIds 首屏在线态播种', () => {
  test('把 status===online 的联系人加入已有集合', () => {
    const existing = new Set(['u1']);
    const contacts = [{ id: 'u1', status: 'offline' }, { id: 'u2', status: 'online' }, { id: 'u3', status: 'offline' }];
    const result = seedOnlineIds(existing, contacts);
    expect(result.has('u1')).toBe(true); // 已有的不受影响
    expect(result.has('u2')).toBe(true); // 新播种
    expect(result.has('u3')).toBe(false);
  });

  test('不修改传入的原集合（返回新 Set）', () => {
    const existing = new Set();
    const result = seedOnlineIds(existing, [{ id: 'u1', status: 'online' }]);
    expect(existing.has('u1')).toBe(false);
    expect(result.has('u1')).toBe(true);
  });

  test('空数组/未定义 contacts 不报错', () => {
    expect(() => seedOnlineIds(new Set(), [])).not.toThrow();
    expect(() => seedOnlineIds(new Set(), undefined)).not.toThrow();
  });
});

describe('filterContactsByStatus 全部/在线/离线过滤', () => {
  const contacts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const onlineIds = new Set(['a', 'c']);

  test('all 返回原数组', () => {
    expect(filterContactsByStatus(contacts, onlineIds, 'all')).toEqual(contacts);
  });

  test('online 只保留在线', () => {
    expect(filterContactsByStatus(contacts, onlineIds, 'online').map(c => c.id)).toEqual(['a', 'c']);
  });

  test('offline 只保留离线', () => {
    expect(filterContactsByStatus(contacts, onlineIds, 'offline').map(c => c.id)).toEqual(['b']);
  });
});
