'use strict';
/**
 * SQLite 写入 Worker Thread
 *   - 独占写连接，主线程永不等写锁
 *   - 批量事务：每 FLUSH_MS 或积满 MAX_BATCH 条一次 COMMIT
 *   - uncaughtException 时先 flush 再非零退出，由主线程负责重启
 */
const { workerData, parentPort } = require('worker_threads');
const Database = require('better-sqlite3');

const FLUSH_MS  = workerData.flushMs  || 8;
const MAX_BATCH = workerData.maxBatch || 200;

const db = new Database(workerData.dbPath, { timeout: 10000 });
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -32000');
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 268435456');

const stmtCache = new Map();
const stmt = sql => {
  if (!stmtCache.has(sql)) stmtCache.set(sql, db.prepare(sql));
  return stmtCache.get(sql);
};

let queue = [];
let timer = null;

function flush() {
  timer = null;
  if (!queue.length) return;

  const batch = queue.splice(0, MAX_BATCH);

  try {
    db.transaction(() => {
      for (const { sql, params } of batch) stmt(sql).run(...params);
    })();
    const acks = batch.filter(b => b.reqId != null);
    if (acks.length) parentPort.postMessage({ type: 'ack', ids: acks.map(b => b.reqId) });
  } catch (e) {
    // 逐条重试：一条坏数据不阻塞整批
    for (const item of batch) {
      try {
        stmt(item.sql).run(...item.params);
        if (item.reqId != null) parentPort.postMessage({ type: 'ack', ids: [item.reqId] });
      } catch (itemErr) {
        console.error('[dbWorker] SQL 执行失败:', item.sql, itemErr.message);
        if (item.reqId != null) parentPort.postMessage({ type: 'ack', ids: [item.reqId], error: itemErr.message });
      }
    }
  }

  if (queue.length > 0) setImmediate(flush);
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
    case 'shutdown':
      flush();
      db.close();
      process.exit(0);
      break;
  }
});

let _terminating = false;
process.on('uncaughtException', e => {
  console.error('[dbWorker] uncaughtException:', e.message, e.stack);
  if (_terminating) return;
  _terminating = true;
  try { if (queue.length > 0) flush(); } catch {}
  process.exit(1);
});
