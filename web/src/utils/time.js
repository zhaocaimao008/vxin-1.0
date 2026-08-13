/**
 * 时间格式化工具（性能优化版）
 *
 * 优化点：
 * - 缓存 today/yesterday/thisYear 边界（每分钟更新），消除每次调用创建 3 个 Date 对象
 * - 热路径（ChatList 每条会话都调用 format）从 O(3个Date) → O(1个Date)
 */

// ── 时间边界缓存（每分钟刷新）─────────────────────────────────────
let _cache = null;
let _cacheTs = 0;

function getBoundaries() {
  const now = Date.now();
  // 60s 刷新一次（格式跳变在分钟级别发生，如"刚刚→N分钟前"）
  if (!_cache || now - _cacheTs > 60_000) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    _cache = {
      todayMs,
      yesterdayMs: todayMs - 86_400_000,
      thisYearMs:  new Date(today.getFullYear(), 0, 1).getTime(),
    };
    _cacheTs = now;
  }
  return _cache;
}

/** 会话列表时间（简短格式）*/
export function format(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  const { todayMs, yesterdayMs, thisYearMs } = getBoundaries();
  const dMs = d.getTime();
  if (dMs >= todayMs)     return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (dMs >= yesterdayMs) return '昨天';
  if (dMs >= thisYearMs)  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

/** 消息时间分割线（完整时间）*/
export function formatFull(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const { todayMs, yesterdayMs, thisYearMs } = getBoundaries();
  const dMs = d.getTime();
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (dMs >= todayMs)     return time;
  if (dMs >= yesterdayMs) return `昨天 ${time}`;
  if (dMs >= thisYearMs)  return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${time}`;
}

/** 最后在线时间（特权账户专用）*/
export function formatLastOnline(ts, isOnline) {
  if (isOnline) return '当前在线';
  if (!ts || ts <= 0) return null;
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return null;
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  if (diff < 60_000) return '刚刚在线';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前在线`;
  const { todayMs, yesterdayMs, thisYearMs } = getBoundaries();
  const dMs = d.getTime();
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (dMs >= todayMs)     return `今天 ${time}`;
  if (dMs >= yesterdayMs) return `昨天 ${time}`;
  if (dMs >= thisYearMs)  return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${time}`;
}
