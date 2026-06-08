/**
 * 压力测试 — 扩展版
 * 支持 100 bots / 100,000 消息
 */
const api    = require('../utils/api');
const { connectSocket, sendMessage } = require('../utils/socket');
const rep    = require('../utils/reporter');
const cfg    = require('../config');
const os     = require('os');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runStressTest(accounts, groupIds) {
  rep.log('\n══ 压力测试 ══');

  const BOTS     = Math.min(accounts.length, cfg.STRESS_BOTS    || 100);
  const WORKERS  = Math.min(BOTS,            cfg.STRESS_WORKERS ||  50);
  const MSG_MAX  = cfg.MSG_COUNT       || 100000;
  const DURATION = cfg.STRESS_DURATION_S * 1000;
  const convId   = groupIds?.[0];

  rep.log(`  Bots:${BOTS}  Workers:${WORKERS}  目标:${MSG_MAX}条  时限:${cfg.STRESS_DURATION_S}s`);

  if (!convId) { rep.fail('stress:noConv', new Error('无压测会话'), 'high'); return; }

  // ── 连接所有 Bot Socket ─────────────────────────────────
  const sockets = [];
  let connOk = 0, connFail = 0;
  for (let i = 0; i < BOTS; i++) {
    try {
      const s = await connectSocket(api.clientFromAccount(accounts[i]).getCookie());
      s.emit('join_conversation', { conversationId: convId });
      sockets.push(s);
      connOk++;
    } catch { connFail++; }
    if ((i + 1) % 20 === 0) {
      rep.log(`  Socket 连接: ${connOk} 成功 / ${connFail} 失败`);
      await sleep(50);
    }
  }
  rep.log(`  实际连接 ${connOk} 个 WebSocket`);

  // ── 压测主循环 ──────────────────────────────────────────
  let sent = 0, errors = 0, totalLat = 0;
  const latencies  = [];
  const startTime  = Date.now();
  const endTime    = startTime + DURATION;

  const MSGS = ['你好', '在吗', '哈哈哈', '好的', '收到', '👍', '明白', '稍等', '666', '牛啊'];

  const worker = async (sock) => {
    while (Date.now() < endTime && sent < MSG_MAX) {
      const content = MSGS[sent % MSGS.length] + ` ${++sent}`;
      const t0 = Date.now();
      try {
        await sendMessage(sock, convId, content);
        const lat = Date.now() - t0;
        latencies.push(lat);
        totalLat += lat;
      } catch {
        errors++;
        sent--;
      }
      // 无 sleep：最大吞吐
    }
  };

  // 监控协程
  const snapshots = [];
  const monitor = async () => {
    while (Date.now() < endTime && sent < MSG_MAX) {
      const mem = process.memoryUsage();
      snapshots.push({
        t:    Math.round((Date.now() - startTime) / 1000),
        rss:  Math.round(mem.rss      / 1024 / 1024),
        heap: Math.round(mem.heapUsed / 1024 / 1024),
        sent, errors,
      });
      await sleep(10_000);
    }
    return snapshots;
  };

  const workerPool = sockets.slice(0, WORKERS).map(s => worker(s));
  await Promise.all([...workerPool, monitor()]);

  // ── 统计 ────────────────────────────────────────────────
  const elapsed    = (Date.now() - startTime) / 1000;
  const throughput = Math.round(sent / elapsed);
  const avgLat     = latencies.length ? Math.round(totalLat / latencies.length) : 0;
  const sortedLats = latencies.slice().sort((a, b) => a - b);
  const p95Lat     = sortedLats[Math.floor(sortedLats.length * 0.95)] ?? 0;
  const p99Lat     = sortedLats[Math.floor(sortedLats.length * 0.99)] ?? 0;
  const errorRate  = sent + errors > 0 ? Math.round(errors / (sent + errors) * 100) : 0;
  const peakRss    = snapshots.length ? Math.max(...snapshots.map(s => s.rss))  : 0;
  const peakHeap   = snapshots.length ? Math.max(...snapshots.map(s => s.heap)) : 0;

  rep.log(`\n  ── 压测结果 ──`);
  rep.log(`  发送消息: ${sent} / ${MSG_MAX}  (${elapsed.toFixed(1)}s)`);
  rep.log(`  错误:     ${errors} (${errorRate}%)`);
  rep.log(`  吞吐量:   ${throughput} msg/s`);
  rep.log(`  延迟:     avg=${avgLat}ms  P95=${p95Lat}ms  P99=${p99Lat}ms`);
  rep.log(`  内存:     峰值 RSS ${peakRss}MB  Heap ${peakHeap}MB`);

  errorRate <= 5
    ? rep.pass('stress:errorRate', `错误率 ${errorRate}% ≤ 5%`)
    : rep.fail('stress:errorRate', new Error(`错误率过高: ${errorRate}%`), 'high');

  avgLat <= 500
    ? rep.pass('stress:latency', `平均延迟 ${avgLat}ms ≤ 500ms`)
    : rep.fail('stress:latency', new Error(`平均延迟过高: ${avgLat}ms`), 'medium');

  throughput >= 10
    ? rep.pass('stress:throughput', `吞吐量 ${throughput} msg/s`)
    : rep.fail('stress:throughput', new Error(`吞吐量过低: ${throughput} msg/s`), 'medium');

  sockets.forEach(s => { try { s.disconnect(); } catch {} });

  return { sent, errors, errorRate, throughput, avgLat, p95Lat, p99Lat, peakRss, peakHeap, elapsed, snapshots };
}

module.exports = { runStressTest };
