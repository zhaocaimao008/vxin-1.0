'use strict';
/**
 * 房间广播调度器（削峰）。
 *
 * 问题：突发消息时，每条都在 handler 内同步 io.to(room).emit(...)，上万次背靠背派发
 *       会在单个事件循环 tick 内堆满同步工作，拉高事件循环延迟（ELD）尖峰。
 *
 * 方案：
 *   1) 批量派发——同一房间/事件的广播先入队，统一在排空循环里发出（FIFO，保序）。
 *   2) setImmediate 分片——每个 tick 最多派发 SHARD 条，tick 之间让出事件循环，
 *      避免单 tick 长时间占用，把 ELD 尖峰摊平。
 *   3) 每 100 条广播统计一次派发耗时（lastPer100Ms / maxPer100Ms / avgPer100Ms）。
 *
 * 语义保持：ack 仍由 handler 同步回执；广播仅延迟 1 个 setImmediate tick（亚毫秒级）。
 */
const { info } = require('../utils/logger');

let _io = null;
const queue = [];
let draining = false;

// 每 tick 最多派发条数。实测 64 在"削峰(压低 ELD max)"与"吞吐/p99"间最优：单 tick
// 派发 ≤64 次 emit 即让出事件循环，把突发广播摊到多个 tick，消除秒级冻结尖峰。
const SHARD = 64;
const LOG_EVERY = 2000; // 每 2000 条广播打一条汇总日志，避免刷屏

// ── 统计 ───────────────────────────────────────────────────────
let _count = 0;
let _markAt = 0n;
const stats = {
  totalBroadcasts: 0,
  maxQueue: 0,
  lastPer100Ms: 0,
  maxPer100Ms: 0,
  avgPer100Ms: 0,
  _sum: 0, _windows: 0,
};

function setIo(io) { _io = io; }

/**
 * 入队一条房间广播。
 * @param {string} room            目标房间（会话 id 或 user_<id>）
 * @param {string} event           事件名（如 'new_message'）
 * @param {*}      payload          负载
 * @param {string} [exceptSocketId] 排除的 socket（发送者自己），不传则发给房间全员
 */
function broadcast(room, event, payload, exceptSocketId) {
  queue.push({ room, event, payload, exceptSocketId });
  if (queue.length > stats.maxQueue) stats.maxQueue = queue.length;
  if (!draining) {
    draining = true;
    if (_markAt === 0n) _markAt = process.hrtime.bigint();
    setImmediate(drain);
  }
}

function drain() {
  let n = 0;
  while (queue.length && n < SHARD) {
    const b = queue.shift();
    if (_io) {
      const target = b.exceptSocketId
        ? _io.to(b.room).except(b.exceptSocketId)
        : _io.to(b.room);
      target.emit(b.event, b.payload);
    }
    n++;

    // 每 100 条统计一次派发耗时
    if (++_count % 100 === 0) {
      const now = process.hrtime.bigint();
      const ms = Number(now - _markAt) / 1e6;
      _markAt = now;
      stats.lastPer100Ms = +ms.toFixed(3);
      if (ms > stats.maxPer100Ms) stats.maxPer100Ms = +ms.toFixed(3);
      stats._sum += ms; stats._windows++;
      stats.avgPer100Ms = +(stats._sum / stats._windows).toFixed(3);
      if (_count % LOG_EVERY === 0) {
        info('[broadcast] 派发统计', {
          total: _count, per100_last_ms: stats.lastPer100Ms,
          per100_avg_ms: stats.avgPer100Ms, per100_max_ms: stats.maxPer100Ms,
          queue: queue.length,
        });
      }
    }
  }
  stats.totalBroadcasts += n;

  if (queue.length) {
    setImmediate(drain); // 还有积压：让出事件循环后继续下一片
  } else {
    draining = false;
    _markAt = process.hrtime.bigint(); // 空闲后重新计时，不把空闲间隔算进派发耗时
  }
}

module.exports = { setIo, broadcast, stats };
