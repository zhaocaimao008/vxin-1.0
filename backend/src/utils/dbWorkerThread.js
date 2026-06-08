/**
 * SQLite 写入 Worker Thread
 * - 独占写连接，主线程永远不等写锁
 * - 批量事务：每 FLUSH_MS 或积满 MAX_BATCH 条时一次 COMMIT
 * - 所有消息 INSERT 走这里；HTTP 路由的低频写仍用主线程 db
 */
'use strict';
const { workerData, parentPort } = require('worker_threads');
const Database = require('better-sqlite3');

const DB_PATH  = workerData.dbPath;
const FLUSH_MS  = workerData.flushMs  || 8;    // 最长等待毫秒
const MAX_BATCH = workerData.maxBatch || 200;   // 单批上限

const db = new Database(DB_PATH, { timeout: 10000 });
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -32000');
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 268435456');

// 预编译语句缓存
const stmtCache = new Map();
function stmt(sql) {
  if (!stmtCache.has(sql)) stmtCache.set(sql, db.prepare(sql));
  return stmtCache.get(sql);
}

// 队列与统计
let queue  = [];
let timer  = null;
const stats = { batches: 0, writes: 0, errors: 0, maxBatch: 0 };

function flush() {
  timer = null;
  if (!queue.length) return;

  const batch = queue.splice(0, MAX_BATCH);
  stats.batches++;
  stats.writes += batch.length;
  if (batch.length > stats.maxBatch) stats.maxBatch = batch.length;

  try {
    db.transaction(() => {
      for (const { sql, params } of batch) {
        stmt(sql).run(...params);
      }
    })();

    // 通知需要 ack 的请求
    const acks = batch.filter(b => b.reqId != null);
    if (acks.length) {
      parentPort.postMessage({ type: 'ack', ids: acks.map(b => b.reqId) });
    }
  } catch (e) {
    stats.errors++;
    // 逐条重试：防止一条坏数据阻塞整批，并为每条记录独立的错误
    for (const item of batch) {
      try {
        stmt(item.sql).run(...item.params);
        if (item.reqId != null) {
          parentPort.postMessage({ type: 'ack', ids: [item.reqId] });
        }
      } catch (itemErr) {
        console.error('[dbWorker] SQL 执行失败:', item.sql, itemErr.message);
        if (item.reqId != null) {
          parentPort.postMessage({ type: 'ack', ids: [item.reqId], error: itemErr.message });
        }
      }
    }
  }

  // 队列仍有积压，继续
  if (queue.length > 0) {
    setImmediate(flush);
  }
}

function schedule() {
  if (queue.length >= MAX_BATCH) {
    if (timer) { clearTimeout(timer); timer = null; }
    setImmediate(flush);
  } else if (!timer) {
    timer = setTimeout(flush, FLUSH_MS);
  }
}

parentPort.on('message', msg => {
  switch (msg.type) {
    case 'write':
      queue.push(msg);
      schedule();
      break;

    case 'writeBatch':
      // 多条 SQL 作为原子批次
      for (const op of msg.ops) queue.push({ sql: op.sql, params: op.params, reqId: msg.reqId });
      schedule();
      break;

    case 'stats':
      parentPort.postMessage({ type: 'stats', stats: { ...stats, queueLen: queue.length } });
      break;

    case 'shutdown':
      flush();
      db.close();
      process.exit(0);
      break;
  }
});

process.on('uncaughtException', e => {
  console.error('[dbWorker] uncaughtException:', e.message);
});
