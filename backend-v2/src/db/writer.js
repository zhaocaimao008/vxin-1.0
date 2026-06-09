'use strict';
/**
 * 主线程侧写入接口
 *   write()      —— fire-and-forget，不等确认，吞吐最高
 *   writeAsync() —— 等 worker commit 后 resolve（读后写一致性场景）
 *   writeBatch() —— 多条 SQL 原子批次
 *
 * 容错：worker 非零退出自动重启（500ms），重启窗口内写操作缓存 retryQueue；
 * writeAsync 未决操作记录 _pendingOps，崩溃后加入 retryQueue 重放，
 * 保证 Promise 最终 resolve（已入库的 INSERT 由 UNIQUE 冲突静默忽略）。
 */
const { Worker } = require('worker_threads');
const path = require('path');
const config = require('../config');

const WORKER_SCRIPT = path.join(__dirname, 'worker.js');
const WORKER_DATA   = { dbPath: config.dbPath, flushMs: 8, maxBatch: 200 };
const RESTART_DELAY = 500;

let worker        = null;
let _reqId        = 0;
const _pending    = new Map();   // reqId → resolve
const _pendingOps = new Map();   // reqId → { sql, params }
const retryQueue  = [];
let isRestarting  = false;

function createWorker() {
  const w = new Worker(WORKER_SCRIPT, { workerData: WORKER_DATA });

  w.on('message', msg => {
    if (msg.type === 'ack') {
      for (const id of msg.ids) {
        _pendingOps.delete(id);
        const resolve = _pending.get(id);
        if (resolve) { _pending.delete(id); resolve(); }
      }
    }
  });

  w.on('error', e => console.error('[dbWriter] Worker error:', e.message));

  w.on('exit', code => {
    if (code === 0) return;
    console.error('[dbWriter] Worker crashed (code %d), restarting in %dms …', code, RESTART_DELAY);
    isRestarting = true;
    for (const [id, op] of _pendingOps) {
      retryQueue.unshift({ type: 'write', sql: op.sql, params: op.params, reqId: id });
    }
    _pendingOps.clear();
    setTimeout(() => {
      worker = createWorker();
      isRestarting = false;
      const backlog = retryQueue.splice(0);
      for (const msg of backlog) { try { worker.postMessage(msg); } catch {} }
      console.info('[dbWriter] Worker restarted, flushed %d buffered ops', backlog.length);
    }, RESTART_DELAY);
  });

  return w;
}

worker = createWorker();

function postMsg(msg) {
  if (isRestarting) retryQueue.push(msg);
  else worker.postMessage(msg);
}

function write(sql, params = []) {
  postMsg({ type: 'write', sql, params });
}

function writeAsync(sql, params = []) {
  const id = ++_reqId;
  _pendingOps.set(id, { sql, params });
  return new Promise(resolve => {
    _pending.set(id, resolve);
    postMsg({ type: 'write', sql, params, reqId: id });
  });
}

function shutdown() {
  postMsg({ type: 'shutdown' });
}

module.exports = { write, writeAsync, shutdown };
