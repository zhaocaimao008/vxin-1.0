'use strict';
/**
 * IPC 批处理管理器（Electron 主进程）
 *
 * 问题：渲染进程频繁 invoke（如滚动时的角标更新、窗口状态查询）导致
 *       每次往返 > 1ms IPC 开销，高频下累积影响帧率。
 *
 * 方案：
 *   1. ipcBatcher.queue() — 将可合并的 IPC 调用排入队列，下一 tick 统一处理
 *   2. ipcBatcher.debounce() — 对高频事件（如 badge 更新）防抖
 *   3. 监控统计（DEV 模式下输出合并率）
 */

const stats = {
  queued: 0,
  executed: 0,
  debounced: 0,
  saved: 0,   // 节省的 IPC 调用次数
};

// ── 批量队列（同类型合并，末者优先）─────────────────────────
const pendingQueue = new Map();   // key -> { fn, args, timer }
let flushScheduled = false;

/**
 * 将 key 对应的调用加入队列，同一 key 在同帧内只执行最后一次。
 * @param {string} key      唯一标识（如 'badge:update'）
 * @param {Function} fn     实际执行函数
 */
function queue(key, fn) {
  stats.queued++;
  if (pendingQueue.has(key)) {
    stats.saved++;
    pendingQueue.get(key).fn = fn;   // 覆盖为最新
    return;
  }
  pendingQueue.set(key, { fn });
  if (!flushScheduled) {
    flushScheduled = true;
    setImmediate(flush);
  }
}

function flush() {
  flushScheduled = false;
  const entries = [...pendingQueue.values()];
  pendingQueue.clear();
  for (const { fn } of entries) {
    try { fn(); stats.executed++; } catch (e) { /* 静默 */ }
  }
}

// ── 防抖包装器 ────────────────────────────────────────────────
const debounceTimers = new Map();

/**
 * 防抖执行，同一 key 在 wait ms 内只触发一次（末次触发生效）。
 * @param {string} key
 * @param {Function} fn
 * @param {number} wait   ms，默认 150
 */
function debounce(key, fn, wait = 150) {
  stats.debounced++;
  if (debounceTimers.has(key)) clearTimeout(debounceTimers.get(key));
  debounceTimers.set(key, setTimeout(() => {
    debounceTimers.delete(key);
    try { fn(); stats.executed++; } catch (e) { /* 静默 */ }
  }, wait));
}

/** 开发模式下每分钟输出合并率统计 */
if (process.env.NODE_ENV !== 'production') {
  setInterval(() => {
    if (stats.queued > 0) {
      const saveRate = ((stats.saved / stats.queued) * 100).toFixed(1);
      console.log(`[IPC Batcher] queued=${stats.queued} exec=${stats.executed} saved=${stats.saved} (${saveRate}%)`);
    }
  }, 60000);
}

module.exports = { queue, debounce, stats };
