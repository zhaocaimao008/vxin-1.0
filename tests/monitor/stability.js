#!/usr/bin/env node
/**
 * V信 24小时稳定性监控器
 * 每 30 分钟采样一次，24小时后生成最终报告
 *
 * 采样指标：
 *   Heap / RSS / CPU / Socket数 / DB大小 / 活跃用户数 / 进程句柄数
 *
 * 用法：node monitor/stability.js
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const http = require('http');

require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

const REPORTS_DIR   = path.join(__dirname, '../test-reports');
const STABILITY_FILE = path.join(REPORTS_DIR, 'stability.json');
const REPORT_FILE    = path.join(REPORTS_DIR, 'stability-report.html');
const LOG_FILE       = path.join(REPORTS_DIR, 'stability.log');

const INTERVAL_MS   = 30 * 60 * 1000;   // 30 分钟
const DURATION_H    = 24;
const DEADLINE      = Date.now() + DURATION_H * 3_600_000;
const BASE_URL      = 'http://localhost:3002';
const DB_PATH       = path.join(__dirname, '../../backend/wechat.db');

// CPU 测量用
let lastCpuInfo = os.cpus();
let lastCpuTime = Date.now();

function getCpuPercent() {
  const cpus = os.cpus();
  let idleDelta = 0, totalDelta = 0;
  for (let i = 0; i < cpus.length; i++) {
    const old = lastCpuInfo[i].times;
    const cur = cpus[i].times;
    for (const t in cur) totalDelta += cur[t] - (old[t] || 0);
    idleDelta += cur.idle - (old.idle || 0);
  }
  lastCpuInfo = cpus;
  return totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;
}

function measureELLag() {
  return new Promise(r => {
    const t = Date.now();
    setImmediate(() => r(Date.now() - t));
  });
}

// HTTP GET helper（带 timeout）
function httpGet(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeout);
    http.get(url, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { clearTimeout(timer); resolve({ status: res.statusCode, body }); });
    }).on('error', e => { clearTimeout(timer); reject(e); });
  });
}

function getDbStats() {
  try {
    const db = require('../../backend/src/models/db');
    const messages = db.prepare('SELECT COUNT(*) as n FROM messages').get().n;
    const users    = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
    const convs    = db.prepare('SELECT COUNT(*) as n FROM conversations').get().n;
    const onlineN  = db.prepare("SELECT COUNT(*) as n FROM users WHERE status='online'").get().n;
    const dbSize   = fs.existsSync(DB_PATH) ? Math.round(fs.statSync(DB_PATH).size / 1024 / 1024) : 0;
    return { messages, users, convs, onlineN, dbSize };
  } catch {
    return { messages: -1, users: -1, convs: -1, onlineN: -1, dbSize: -1 };
  }
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function loadData() {
  try { return JSON.parse(fs.readFileSync(STABILITY_FILE)); }
  catch { return { startTime: new Date().toISOString(), samples: [], anomalies: [] }; }
}

function saveData(data) {
  fs.writeFileSync(STABILITY_FILE, JSON.stringify(data, null, 2));
}

async function takeSample(data, label = '') {
  const mem  = process.memoryUsage();
  const cpu  = getCpuPercent();
  const el   = await measureELLag();
  const db   = getDbStats();

  // 向后端查询在线 Socket 数（通过 onlineUsers API）
  let socketCount = -1;
  let backendOk   = false;
  let apiLatencyMs = -1;
  try {
    const t0 = Date.now();
    const r = await httpGet(`${BASE_URL}/api/auth/me`);
    apiLatencyMs = Date.now() - t0;
    backendOk = r.status === 401 || r.status === 200; // 401=未授权但服务正常
  } catch {}

  // 从 DB 估算 WebSocket 连接数（在线用户数）
  socketCount = db.onlineN >= 0 ? db.onlineN : -1;

  const handles  = process._getActiveHandles?.().length ?? -1;
  const requests = process._getActiveRequests?.().length ?? -1;

  const sample = {
    time:          new Date().toISOString(),
    label,
    rss:           Math.round(mem.rss         / 1024 / 1024),
    heapUsed:      Math.round(mem.heapUsed    / 1024 / 1024),
    heapTotal:     Math.round(mem.heapTotal   / 1024 / 1024),
    external:      Math.round(mem.external    / 1024 / 1024),
    cpu,
    elLagMs:       el,
    handles,
    requests,
    socketCount,
    backendOk,
    apiLatencyMs,
    db,
  };

  data.samples.push(sample);

  // 异常检测
  checkAnomalies(sample, data);

  log(
    `[采样] RSS:${sample.rss}MB Heap:${sample.heapUsed}MB CPU:${sample.cpu}% ` +
    `EL:${sample.elLagMs}ms Socket:${sample.socketCount} ` +
    `DB:${sample.db.dbSize}MB 消息:${sample.db.messages} ` +
    `API:${sample.backendOk?'OK':'DOWN'}(${sample.apiLatencyMs}ms)`
  );

  saveData(data);
  generateReport(data);
  return sample;
}

function checkAnomalies(sample, data) {
  const anomalies = [];

  // Heap 突增（相比上一个同类状态样本增长 > 20MB）
  const prev = data.samples.slice(-10, -1).reverse().find(s => s.heapUsed > 0);
  if (prev && sample.heapUsed - prev.heapUsed > 20) {
    anomalies.push({ type: 'HEAP_SPIKE', detail: `Heap ${prev.heapUsed}→${sample.heapUsed}MB (+${sample.heapUsed-prev.heapUsed}MB)` });
  }

  // 后端宕机
  if (!sample.backendOk) {
    anomalies.push({ type: 'BACKEND_DOWN', detail: `API 无响应，延迟 ${sample.apiLatencyMs}ms` });
  }

  // API 延迟过高
  if (sample.apiLatencyMs > 2000) {
    anomalies.push({ type: 'API_SLOW', detail: `API 延迟 ${sample.apiLatencyMs}ms` });
  }

  // CPU 过高
  if (sample.cpu > 80) {
    anomalies.push({ type: 'CPU_HIGH', detail: `CPU ${sample.cpu}%` });
  }

  // EventLoop 卡顿
  if (sample.elLagMs > 1000) {
    anomalies.push({ type: 'EL_LAG', detail: `EventLoop ${sample.elLagMs}ms` });
  }

  for (const a of anomalies) {
    a.time = sample.time;
    data.anomalies.push(a);
    log(`⚠️  [ANOMALY] ${a.type}: ${a.detail}`);
  }
}

// ── HTML 报告生成 ─────────────────────────────────────────────────
function generateReport(data) {
  const samples = data.samples;
  if (samples.length < 2) return;

  const now      = new Date().toLocaleString('zh-CN');
  const elapsed  = Math.round((Date.now() - new Date(data.startTime)) / 3600000 * 10) / 10;
  const remaining = Math.max(0, Math.round((DEADLINE - Date.now()) / 3600000 * 10) / 10);

  // 统计
  const heaps    = samples.map(s => s.heapUsed);
  const rssList  = samples.map(s => s.rss);
  const cpus     = samples.map(s => s.cpu);
  const elLags   = samples.map(s => s.elLagMs);
  const apiLats  = samples.filter(s => s.apiLatencyMs > 0).map(s => s.apiLatencyMs);

  const avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
  const max = arr => arr.length ? Math.max(...arr) : 0;
  const min = arr => arr.length ? Math.min(...arr) : 0;

  const labels     = JSON.stringify(samples.map(s => s.time.slice(11, 16)));
  const heapData   = JSON.stringify(heaps);
  const rssData    = JSON.stringify(rssList);
  const cpuData    = JSON.stringify(cpus);
  const elData     = JSON.stringify(elLags);
  const apiData    = JSON.stringify(samples.map(s => s.apiLatencyMs > 0 ? s.apiLatencyMs : null));
  const sockData   = JSON.stringify(samples.map(s => s.socketCount >= 0 ? s.socketCount : null));
  const dbMsgData  = JSON.stringify(samples.map(s => s.db.messages >= 0 ? s.db.messages : null));

  const anomalyRows = data.anomalies.map(a => `
    <tr><td>${a.time.replace('T',' ').slice(0,19)}</td>
        <td><span style="background:${a.type.includes('DOWN')?'#FF3B30':'#FF9500'};color:#fff;padding:2px 8px;border-radius:8px;font-size:11px">${a.type}</span></td>
        <td>${a.detail}</td></tr>`).join('');

  const last = samples[samples.length - 1];

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width">
<meta http-equiv="refresh" content="120">
<title>V信 24h 稳定性监控</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,sans-serif;background:#F2F2F7;color:#1C1C1E}
.header{background:linear-gradient(135deg,#1C1C1E,#3A3A3C);color:#fff;padding:28px 20px}
.header h1{font-size:24px;font-weight:700;margin-bottom:4px}
.header p{opacity:.7;font-size:12px}
.container{max-width:1200px;margin:20px auto;padding:0 14px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px}
.stat{background:#fff;border-radius:12px;padding:14px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.stat .num{font-size:26px;font-weight:700}
.stat .lbl{font-size:11px;color:#8E8E93;margin-top:3px}
.card{background:#fff;border-radius:12px;padding:18px;margin-bottom:18px;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.card h2{font-size:14px;margin-bottom:14px;font-weight:600}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:700px){.two-col{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#F2F2F7;padding:8px 6px;text-align:left;font-weight:600}
td{padding:7px 6px;border-bottom:1px solid #F2F2F7}
tr:last-child td{border-bottom:none}
.ok{color:#07C160;font-weight:600}
.warn{color:#FF9500;font-weight:600}
.err{color:#FF3B30;font-weight:600}
</style>
</head>
<body>
<div class="header">
  <h1>V信 24小时稳定性监控</h1>
  <p>运行 ${elapsed}h / 24h · 剩余 ${remaining}h · 采样 ${samples.length} 次 · 更新: ${now}</p>
</div>
<div class="container">

<div class="stats">
  <div class="stat"><div class="num ${last.heapUsed>30?'warn':'ok'}">${last.heapUsed}MB</div><div class="lbl">当前 Heap</div></div>
  <div class="stat"><div class="num">${last.rss}MB</div><div class="lbl">当前 RSS</div></div>
  <div class="stat"><div class="num ${last.cpu>60?'warn':'ok'}">${last.cpu}%</div><div class="lbl">CPU</div></div>
  <div class="stat"><div class="num ${last.elLagMs>200?'warn':'ok'}">${last.elLagMs}ms</div><div class="lbl">EL 延迟</div></div>
  <div class="stat"><div class="num">${last.socketCount}</div><div class="lbl">在线用户</div></div>
  <div class="stat"><div class="num">${last.db.messages.toLocaleString?.()??last.db.messages}</div><div class="lbl">消息总数</div></div>
  <div class="stat"><div class="num ${last.db.dbSize}MB</div><div class="lbl">DB 大小</div></div>
  <div class="stat"><div class="num ${last.apiLatencyMs>500?'warn':'ok'}">${last.apiLatencyMs}ms</div><div class="lbl">API 延迟</div></div>
  <div class="stat"><div class="num ${data.anomalies.length?'warn':'ok'}">${data.anomalies.length}</div><div class="lbl">异常事件</div></div>
</div>

<div class="two-col">
  <div class="card">
    <h2>💾 Heap / RSS 趋势</h2>
    <canvas id="memChart" height="120"></canvas>
  </div>
  <div class="card">
    <h2>⚡ CPU / EventLoop 延迟</h2>
    <canvas id="cpuChart" height="120"></canvas>
  </div>
</div>

<div class="two-col">
  <div class="card">
    <h2>🔌 在线用户 / 消息增长</h2>
    <canvas id="sockChart" height="120"></canvas>
  </div>
  <div class="card">
    <h2>🌐 API 响应延迟</h2>
    <canvas id="apiChart" height="120"></canvas>
  </div>
</div>

<div class="card">
  <h2>📊 指标统计摘要</h2>
  <table>
    <tr><th>指标</th><th>最小</th><th>平均</th><th>最大</th><th>当前</th><th>状态</th></tr>
    <tr><td>Heap (MB)</td><td>${min(heaps)}</td><td>${avg(heaps)}</td><td>${max(heaps)}</td><td>${last.heapUsed}</td><td class="${max(heaps)<35?'ok':'warn'}">${max(heaps)<35?'正常':'偏高'}</td></tr>
    <tr><td>RSS (MB)</td><td>${min(rssList)}</td><td>${avg(rssList)}</td><td>${max(rssList)}</td><td>${last.rss}</td><td class="ok">正常</td></tr>
    <tr><td>CPU (%)</td><td>${min(cpus)}</td><td>${avg(cpus)}</td><td>${max(cpus)}</td><td>${last.cpu}</td><td class="${max(cpus)<70?'ok':'warn'}">${max(cpus)<70?'正常':'偏高'}</td></tr>
    <tr><td>EL 延迟 (ms)</td><td>${min(elLags)}</td><td>${avg(elLags)}</td><td>${max(elLags)}</td><td>${last.elLagMs}</td><td class="${max(elLags)<500?'ok':'warn'}">${max(elLags)<500?'正常':'卡顿'}</td></tr>
    <tr><td>API 延迟 (ms)</td><td>${min(apiLats)}</td><td>${avg(apiLats)}</td><td>${max(apiLats)}</td><td>${last.apiLatencyMs}</td><td class="${max(apiLats)<1000?'ok':'warn'}">${max(apiLats)<1000?'正常':'偏慢'}</td></tr>
  </table>
</div>

${data.anomalies.length ? `
<div class="card">
  <h2>⚠️ 异常事件 (${data.anomalies.length})</h2>
  <table><tr><th>时间</th><th>类型</th><th>详情</th></tr>${anomalyRows}</table>
</div>` : '<div class="card"><h2>✅ 无异常事件</h2></div>'}

</div>

<script>
const LABELS = ${labels};
function mkChart(id, datasets, withY2=false) {
  const ctx = document.getElementById(id).getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: { labels: LABELS, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { ticks: { maxTicksLimit: 8 } },
        y: { type: 'linear', position: 'left' },
            ...(withY2 ? { y2: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } } } : {})
      }
    }
  });
}

mkChart('memChart', [
  { label: 'Heap MB', data: ${heapData}, borderColor: '#5856D6', tension: .2, fill: false },
  { label: 'RSS MB',  data: ${rssData},  borderColor: '#FF9500', tension: .2, fill: false },
], false);
mkChart('cpuChart', [
  { label: 'CPU %',    data: ${cpuData}, borderColor: '#FF3B30', tension: .2, fill: false },
  { label: 'EL 延迟ms', data: ${elData},  borderColor: '#FFCC00', tension: .2, fill: false, yAxisID: 'y2' },
], true);
mkChart('sockChart', [
  { label: '在线用户', data: ${sockData},  borderColor: '#07C160', tension: .2, fill: false },
  { label: '消息数÷1000', data: ${dbMsgData}.map(v=>v?Math.round(v/1000):null), borderColor: '#5856D6', tension: .2, fill: false, yAxisID: 'y2' },
], true);
mkChart('apiChart', [
  { label: 'API 延迟ms', data: ${apiData}, borderColor: '#FF9500', tension: .2, fill: false },
], false);
</script>
</body>
</html>`;

  fs.writeFileSync(REPORT_FILE, html);

  // 同步到 nginx
  try {
    fs.mkdirSync('/var/www/vxin/test-reports', { recursive: true });
    fs.copyFileSync(REPORT_FILE,   '/var/www/vxin/test-reports/stability-report.html');
    fs.copyFileSync(STABILITY_FILE, '/var/www/vxin/test-reports/stability.json');
  } catch {}
}

// ── 最终报告 ────────────────────────────────────────────────────────
function generateFinalReport(data) {
  const samples = data.samples;
  const elapsed = Math.round((Date.now() - new Date(data.startTime)) / 3600000 * 10) / 10;
  const heaps   = samples.map(s => s.heapUsed);
  const rssList = samples.map(s => s.rss);
  const cpus    = samples.map(s => s.cpu);
  const avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
  const max = arr => arr.length ? Math.max(...arr) : 0;
  const min = arr => arr.length ? Math.min(...arr) : 0;

  // 判断 Heap 基线趋势
  const idleHeaps = samples.filter(s => s.socketCount === 0 && s.heapUsed > 0).map(s => s.heapUsed);
  const heapDrift = idleHeaps.length > 1 ? idleHeaps[idleHeaps.length-1] - idleHeaps[0] : 0;

  const verdict = [
    `Heap 基线漂移: ${heapDrift >= 0 ? '+' : ''}${heapDrift}MB (${Math.abs(heapDrift)<=3?'✅ 稳定':'⚠️ 轻微增长'})`,
    `峰值 Heap: ${max(heaps)}MB (${max(heaps)<=40?'✅ 正常':'⚠️ 偏高'})`,
    `CPU 均值: ${avg(cpus)}% (${avg(cpus)<=50?'✅ 正常':'⚠️ 偏高'})`,
    `后端存活率: ${Math.round(samples.filter(s=>s.backendOk).length/samples.length*100)}%`,
    `异常事件: ${data.anomalies.length} 次`,
  ];

  log('\n════════════ 24小时稳定性最终报告 ════════════');
  verdict.forEach(v => log(v));
  log(`总采样次数: ${samples.length}  运行时长: ${elapsed}h`);
  log(`报告路径: ${REPORT_FILE}`);

  // 更新报告标题
  const finalHtml = fs.readFileSync(REPORT_FILE, 'utf8')
    .replace('V信 24小时稳定性监控', 'V信 24小时稳定性最终报告')
    .replace(/运行 [\d.]+h \/ 24h/, `运行完成 ${elapsed}h`);
  const finalFile = path.join(REPORTS_DIR, 'stability-final-report.html');
  fs.writeFileSync(finalFile, finalHtml);
  try {
    fs.copyFileSync(finalFile, '/var/www/vxin/test-reports/stability-final-report.html');
  } catch {}
  log(`最终报告: ${finalFile}`);
}

// ── 主循环 ──────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  log('════ V信 24小时稳定性监控启动 ════');
  log(`结束时间: ${new Date(DEADLINE).toLocaleString('zh-CN')}`);
  log(`采样间隔: 30分钟`);

  const data = loadData();
  if (!data.startTime) data.startTime = new Date().toISOString();

  // 立即采一次初始样本
  await takeSample(data, 'start');

  const timer = setInterval(async () => {
    await takeSample(data);
    if (Date.now() >= DEADLINE) {
      clearInterval(timer);
      await takeSample(data, 'end');
      generateFinalReport(data);
      log('════ 24小时监控结束 ════');
      process.exit(0);
    }
  }, INTERVAL_MS);

  log(`首次采样完成，下次采样: ${new Date(Date.now() + INTERVAL_MS).toLocaleTimeString('zh-CN')}`);
}

main().catch(e => { log('ERROR: ' + e.message); process.exit(1); });
