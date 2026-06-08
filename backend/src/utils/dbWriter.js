/**
 * 主线程侧写入接口
 * write()      - fire-and-forget，不等确认
 * writeAsync() - 等待 worker commit 后 resolve（用于需要保证落盘的场景）
 */
'use strict';
const { Worker } = require('worker_threads');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../wechat.db');

const worker = new Worker(
  path.join(__dirname, 'dbWorkerThread.js'),
  {
    workerData: {
      dbPath:   DB_PATH,
      flushMs:  8,
      maxBatch: 200,
    },
  }
);

worker.on('error', e => console.error('[dbWriter] Worker error:', e.message));
worker.on('exit', code => {
  if (code !== 0) console.error('[dbWriter] Worker exited, code:', code);
});

// ack 映射
let _reqId = 0;
const _pending = new Map();   // reqId → resolve

worker.on('message', msg => {
  if (msg.type === 'ack') {
    for (const id of msg.ids) {
      const resolve = _pending.get(id);
      if (resolve) { _pending.delete(id); resolve(); }
    }
  }
  if (msg.type === 'stats') {
    _statsResolve?.(msg.stats);
    _statsResolve = null;
  }
});

// ── 公共 API ────────────────────────────────────────────────────

/** 异步写入，主线程立即返回，不等 DB commit */
function write(sql, params = []) {
  worker.postMessage({ type: 'write', sql, params });
}

/** 批量原子写入（多条 SQL 在同一事务内） */
function writeBatch(ops) {
  worker.postMessage({ type: 'writeBatch', ops });
}

/** 等待 worker 确认写入完成（需要读后写一致性时使用） */
function writeAsync(sql, params = []) {
  const id = ++_reqId;
  return new Promise(resolve => {
    _pending.set(id, resolve);
    worker.postMessage({ type: 'write', sql, params, reqId: id });
  });
}

/** 获取 worker 统计数据 */
let _statsResolve = null;
function getStats() {
  return new Promise(resolve => {
    _statsResolve = resolve;
    worker.postMessage({ type: 'stats' });
  });
}

function shutdown() {
  worker.postMessage({ type: 'shutdown' });
}

module.exports = { write, writeBatch, writeAsync, getStats, shutdown };
