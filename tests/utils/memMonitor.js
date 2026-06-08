/**
 * 内存 / EventLoop / 泄漏监控
 * 每 MEM_INTERVAL_MS 采样一次，写入 test-reports/mem-snapshots.json
 * 同时提供泄漏检测：Socket 泄漏、内存泄漏、句柄泄漏
 */
const fs  = require('fs');
const path = require('path');
const cfg  = require('../config');
const rep  = require('./reporter');

const SNAP_FILE    = path.join(cfg.REPORTS_DIR, 'mem-snapshots.json');
const LEAK_FILE    = path.join(cfg.REPORTS_DIR, 'leak-report.json');

// 每小时内存增长超过此值（MB）视为泄漏
const HEAP_LEAK_MB_PER_H = 50;
// 句柄数超过此值报警
const HANDLE_WARN = 500;

let snapshots   = [];
let leaks       = [];
let timer       = null;
let socketRef   = null;   // 可传入 socket.io server 实例

function loadExisting() {
  try { snapshots = JSON.parse(fs.readFileSync(SNAP_FILE)); } catch {}
  try { leaks     = JSON.parse(fs.readFileSync(LEAK_FILE));  } catch {}
}

function save() {
  fs.mkdirSync(cfg.REPORTS_DIR, { recursive: true });
  fs.writeFileSync(SNAP_FILE, JSON.stringify(snapshots, null, 2));
  fs.writeFileSync(LEAK_FILE, JSON.stringify(leaks, null, 2));
}

// 测量 EventLoop 延迟
function measureELLag() {
  return new Promise(resolve => {
    const t = Date.now();
    setImmediate(() => resolve(Date.now() - t));
  });
}

async function takeSnapshot(label = '') {
  const mem    = process.memoryUsage();
  const elLag  = await measureELLag();
  const handles = process._getActiveHandles?.().length ?? -1;
  const requests = process._getActiveRequests?.().length ?? -1;

  // socket.io 连接数（如果有注入）
  let socketConns = -1;
  if (socketRef) {
    try { socketConns = (await socketRef.fetchSockets()).length; } catch {}
  }

  const snap = {
    time:        new Date().toISOString(),
    label,
    rss:         Math.round(mem.rss         / 1024 / 1024),
    heapUsed:    Math.round(mem.heapUsed    / 1024 / 1024),
    heapTotal:   Math.round(mem.heapTotal   / 1024 / 1024),
    external:    Math.round(mem.external    / 1024 / 1024),
    elLagMs:     elLag,
    handles,
    requests,
    socketConns,
  };
  snapshots.push(snap);

  rep.log(
    `[MEM] RSS:${snap.rss}MB  Heap:${snap.heapUsed}/${snap.heapTotal}MB` +
    `  EL:${snap.elLagMs}ms  Handles:${snap.handles}  Sockets:${snap.socketConns}`
  );

  checkLeaks(snap);
  save();
  return snap;
}

function checkLeaks(snap) {
  const now = Date.now();

  // ── 内存泄漏检测 ────────────────────────────────────────
  if (snapshots.length >= 7) {
    // 对比 1 小时前（约 6 个采样点）的 heapUsed
    const old = snapshots[snapshots.length - 7];
    const elapsedH = (new Date(snap.time) - new Date(old.time)) / 3_600_000;
    if (elapsedH > 0) {
      const growthPerH = (snap.heapUsed - old.heapUsed) / elapsedH;
      if (growthPerH > HEAP_LEAK_MB_PER_H) {
        addLeak('MEMORY_LEAK', `Heap 每小时增长 ${Math.round(growthPerH)}MB (阈值 ${HEAP_LEAK_MB_PER_H}MB)`, snap);
      }
    }
  }

  // ── 句柄泄漏检测 ─────────────────────────────────────────
  if (snap.handles > HANDLE_WARN) {
    addLeak('HANDLE_LEAK', `活跃句柄数 ${snap.handles} > ${HANDLE_WARN}`, snap);
  }

  // ── EventLoop 卡顿检测 ───────────────────────────────────
  if (snap.elLagMs > 500) {
    addLeak('EVENTLOOP_LAG', `EventLoop 延迟 ${snap.elLagMs}ms`, snap);
  }

  // ── Socket 连接泄漏（持续增长）────────────────────────────
  if (snap.socketConns > 0 && snapshots.length >= 4) {
    const recent = snapshots.slice(-4).map(s => s.socketConns).filter(n => n >= 0);
    if (recent.length === 4 && recent.every((v, i) => i === 0 || v > recent[i - 1])) {
      addLeak('SOCKET_LEAK', `Socket 连接数持续增长: ${recent.join(' → ')}`, snap);
    }
  }
}

function addLeak(type, detail, snap) {
  const entry = { time: snap.time, type, detail, snap };
  leaks.push(entry);
  rep.fail(`leak:${type}`, new Error(detail), 'high');
  save();
}

function start(ioServer = null) {
  loadExisting();
  socketRef = ioServer;
  takeSnapshot('start');
  timer = setInterval(() => takeSnapshot(), cfg.MEM_INTERVAL_MS);
  timer.unref(); // 不阻塞进程退出
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
  takeSnapshot('stop');
}

function getSnapshots() { return snapshots; }
function getLeaks()     { return leaks; }

module.exports = { start, stop, takeSnapshot, getSnapshots, getLeaks };
