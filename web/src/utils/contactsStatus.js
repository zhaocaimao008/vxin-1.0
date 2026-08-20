/**
 * 联系人在线状态的纯函数辅助——从 ContactList.jsx 抽出，供联系人相关组件复用。
 */

// 用联系人首屏拉取到的 c.status 播种在线集合：接口已经把真实状态返回了，
// 之前只靠 socket 实时事件累积会导致"页面刚打开、事件还没触发过"的在线好友被误判离线。
// 只做新增（离线由后续 user_offline 事件负责摘除），避免覆盖掉已经存在的实时状态。
export function seedOnlineIds(existingIds, contacts) {
  const next = new Set(existingIds);
  for (const c of contacts || []) {
    if (c && c.status === 'online') next.add(c.id);
  }
  return next;
}

// 全部 / 在线 / 离线 三态过滤
export function filterContactsByStatus(contacts, onlineIds, filter) {
  if (filter === 'online') return contacts.filter(c => onlineIds.has(c.id));
  if (filter === 'offline') return contacts.filter(c => !onlineIds.has(c.id));
  return contacts;
}
