const fs   = require('fs');
const path = require('path');
const cfg  = require('../config');

// ── 公用函数 ──────────────────────────────────────────────────
function esc(s) { return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const SEV_COLOR = { critical: '#FF3B30', high: '#FF9500', medium: '#FFCC00', low: '#34C759' };
const SEV_ICON  = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

function severityBadge(s) {
  return `<span class="sev" style="background:${SEV_COLOR[s]}">${SEV_ICON[s]} ${s.toUpperCase()}</span>`;
}

// ── 功能覆盖矩阵 ───────────────────────────────────────────────
const FEATURES = [
  ['注册/登录',          'createAccounts', 'loadAccounts'],
  ['好友关系',           'setupFriendships'],
  ['单聊发送接收',       'singleChat:sendReceive'],
  ['消息撤回',           'singleChat:recall'],
  ['引用回复',           'singleChat:quotedReply'],
  ['未读计数',           'singleChat:unreadCleared'],
  ['消息历史',           'singleChat:history'],
  ['断线补拉',           'singleChat:reconnectCatchup'],
  ['群创建',             'groupChat:create'],
  ['群消息广播',         'groupChat:broadcast'],
  ['@成员',              'groupChat:atMention'],
  ['群公告',             'groupChat:announcement'],
  ['群昵称',             'groupChat:nickname'],
  ['全群禁言',           'groupChat:muteAll'],
  ['踢人',               'groupChat:kick'],
  ['多端消息同步',       'multiDevice:messageSyncAll3'],
  ['多端撤回同步',       'multiDevice:recallSync'],
  ['多端已读同步',       'multiDevice:readSync'],
  ['部分端断线',         'multiDevice:partialDisconnect'],
  ['全端断线离线',       'multiDevice:allDisconnect'],
  ['PNG上传',            'fileUpload:test.png'],
  ['EXE拦截',            'fileUpload:block:evil.exe'],
  ['MIME伪造拦截',       'fileUpload:block:fake.jpg'],
  ['断网补拉',           'networkChaos:reconnectCatchup'],
  ['多次随机断线',       'networkChaos:randomDisconnects'],
  ['设备切换',           'networkChaos:deviceSwitch'],
  ['并发断线恢复',       'networkChaos:massBroadcastDisconnect'],
  ['DB并发写入',         'dbStress:write'],
  ['DB全文搜索',         'dbStress:search'],
  ['DB分页拉取',         'dbStress:pagination'],
  ['随机机器人',         'randomBots:completed'],
  ['压测错误率',         'stress:errorRate'],
  ['压测延迟',           'stress:latency'],
  ['压测吞吐量',         'stress:throughput'],
];

// ── Chart.js 注入脚本 ────────────────────────────────────────
const CHART_CDN = '<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>';

function historyTrendSection(history) {
  const recent = history.slice(-30);
  if (recent.length < 2) return '';
  const labels   = JSON.stringify(recent.map(h => `#${h.round}`));
  const passes   = JSON.stringify(recent.map(h => h.passRate));
  const fails    = JSON.stringify(recent.map(h => h.failed));
  const latData  = JSON.stringify(recent.map(h => h.stress?.avgLat ?? null));
  const thruData = JSON.stringify(recent.map(h => h.stress?.throughput ?? null));

  return `
  <div class="card">
    <h2>📈 测试轮次趋势（最近 ${recent.length} 轮）</h2>
    <canvas id="trendChart" height="90"></canvas>
  </div>
  <script>
  (function(){
    const ctx = document.getElementById('trendChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${labels},
        datasets: [
          { label: '通过率%', data: ${passes}, borderColor:'#07C160', backgroundColor:'rgba(7,193,96,.08)', yAxisID:'y', tension:.3, fill:true },
          { label: '失败数',  data: ${fails},  borderColor:'#FF3B30', backgroundColor:'rgba(255,59,48,.08)', yAxisID:'y2', tension:.3, fill:false },
          { label: '平均延迟ms', data: ${latData},  borderColor:'#FF9500', yAxisID:'y2', tension:.3, fill:false, borderDash:[4,4] },
          { label: '吞吐msg/s', data: ${thruData}, borderColor:'#5856D6', yAxisID:'y2', tension:.3, fill:false, borderDash:[2,4] },
        ]
      },
      options: {
        responsive:true, interaction:{mode:'index',intersect:false},
        plugins:{legend:{position:'top'}},
        scales:{
          y:  {type:'linear',position:'left', min:0,max:100,title:{display:true,text:'通过率%'}},
          y2: {type:'linear',position:'right',min:0,grid:{drawOnChartArea:false},title:{display:true,text:'数量/ms'}},
        }
      }
    });
  })();
  </script>`;
}

function memTrendSection(memSnaps) {
  if (!memSnaps || memSnaps.length < 2) return '';
  const recent = memSnaps.slice(-50);
  const labels  = JSON.stringify(recent.map(s => s.time.slice(11, 19)));
  const rss     = JSON.stringify(recent.map(s => s.rss));
  const heap    = JSON.stringify(recent.map(s => s.heapUsed));
  const elLag   = JSON.stringify(recent.map(s => s.elLagMs));

  return `
  <div class="card">
    <h2>💾 内存趋势（最近 ${recent.length} 个采样点）</h2>
    <canvas id="memChart" height="90"></canvas>
  </div>
  <script>
  (function(){
    const ctx = document.getElementById('memChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${labels},
        datasets: [
          { label: 'RSS MB',     data: ${rss},   borderColor:'#5856D6', tension:.2, fill:false },
          { label: 'Heap MB',    data: ${heap},  borderColor:'#FF9500', tension:.2, fill:false },
          { label: 'EL Lag ms',  data: ${elLag}, borderColor:'#FF3B30', tension:.2, fill:false, yAxisID:'y2', borderDash:[4,4] },
        ]
      },
      options: {
        responsive:true, interaction:{mode:'index',intersect:false},
        plugins:{legend:{position:'top'}},
        scales:{
          y:  {type:'linear',position:'left', min:0,title:{display:true,text:'MB'}},
          y2: {type:'linear',position:'right',min:0,grid:{drawOnChartArea:false},title:{display:true,text:'ms'}},
        }
      }
    });
  })();
  </script>`;
}

// ── 主报告 HTML 生成 ─────────────────────────────────────────
function generateHTML(summary, stressResult, history = [], memSnaps = [], leaks = []) {
  const rep    = require('../utils/reporter');
  const bugs   = rep.bugs;
  const passed = rep.passed;
  const now    = new Date().toLocaleString('zh-CN');

  const criticalN = bugs.filter(b => b.severity === 'critical').length;
  const highN     = bugs.filter(b => b.severity === 'high').length;
  const mediumN   = bugs.filter(b => b.severity === 'medium').length;
  const passRate  = summary.total > 0 ? Math.round(passed.length / summary.total * 100) : 0;

  // 功能覆盖
  const passSet = new Set(passed.map(p => p.test));
  const failSet = new Set(bugs.map(b => b.test));
  const featureRows = FEATURES.map(([label, ...keys]) => {
    const ok   = keys.some(k => passSet.has(k));
    const fail = keys.some(k => failSet.has(k));
    const status = fail ? '❌ 失败' : ok ? '✅ 通过' : '⬜ 未覆盖';
    const color  = fail ? '#FF3B30' : ok ? '#07C160' : '#8E8E93';
    return `<tr><td>${label}</td><td style="color:${color};font-weight:600">${status}</td></tr>`;
  }).join('');

  // Bug 列表
  const bugRows = bugs.map(b => `
    <tr>
      <td>${b.time.replace('T',' ').slice(0,19)}</td>
      <td>${severityBadge(b.severity)}</td>
      <td><code>${esc(b.test)}</code></td>
      <td>${esc(b.error.slice(0, 160))}</td>
    </tr>`).join('');

  // 通过列表（最近 50 条）
  const passRows = passed.slice(-50).reverse().map(p =>
    `<tr><td>${p.time.slice(11,19)}</td><td><code>${esc(p.test)}</code></td><td>${esc(p.detail)}</td></tr>`
  ).join('');

  // 压测区块
  const stressSection = stressResult ? `
  <div class="card">
    <h2>⚡ 压力测试（${cfg.STRESS_BOTS} bots / ${cfg.MSG_COUNT.toLocaleString()} 消息目标）</h2>
    <div class="metrics">
      <div class="metric"><div class="val">${stressResult.sent.toLocaleString()}</div><div>发送消息</div></div>
      <div class="metric"><div class="val" style="color:${stressResult.errorRate<=5?'#07C160':'#FF3B30'}">${stressResult.errorRate}%</div><div>错误率</div></div>
      <div class="metric"><div class="val">${stressResult.throughput}</div><div>msg/s</div></div>
      <div class="metric"><div class="val" style="color:${stressResult.avgLat<=500?'#07C160':'#FF3B30'}">${stressResult.avgLat}ms</div><div>平均延迟</div></div>
      <div class="metric"><div class="val">${stressResult.p95Lat}ms</div><div>P95延迟</div></div>
      <div class="metric"><div class="val">${stressResult.p99Lat ?? '-'}ms</div><div>P99延迟</div></div>
      <div class="metric"><div class="val">${stressResult.peakRss}MB</div><div>峰值RSS</div></div>
      <div class="metric"><div class="val">${stressResult.peakHeap}MB</div><div>峰值Heap</div></div>
    </div>
  </div>` : '';

  // 泄漏报告
  const leakRows = leaks.slice(-20).map(l => `
    <tr>
      <td>${l.time.replace('T',' ').slice(0,19)}</td>
      <td><span class="sev" style="background:#FF3B30">${l.type}</span></td>
      <td>${esc(l.detail)}</td>
    </tr>`).join('');
  const leakSection = leaks.length ? `
  <div class="card">
    <h2>🔍 泄漏检测 (${leaks.length})</h2>
    <table><tr><th>时间</th><th>类型</th><th>详情</th></tr>${leakRows}</table>
  </div>` : '';

  // 历史轮次表
  const histRows = history.slice(-20).slice().reverse().map(h => `
    <tr>
      <td>#${h.round}</td>
      <td>${h.time.replace('T',' ').slice(0,19)}</td>
      <td style="color:#07C160">${h.passed}</td>
      <td style="color:${h.failed?'#FF3B30':'#07C160'}">${h.failed}</td>
      <td style="color:${h.passRate>=80?'#07C160':'#FF3B30'}">${h.passRate}%</td>
      <td>${h.elapsed}s</td>
      <td>${h.stress ? `${h.stress.sent.toLocaleString()} | ${h.stress.errorRate}% | ${h.stress.throughput}msg/s | ${h.stress.avgLat}ms` : '—'}</td>
    </tr>`).join('');
  const histSection = history.length ? `
  <div class="card">
    <h2>📋 历史轮次（最近20轮）</h2>
    <div style="overflow-x:auto">
    <table>
      <tr><th>轮</th><th>时间</th><th>通过</th><th>失败</th><th>通过率</th><th>耗时</th><th>压测：消息|错误率|吞吐|延迟</th></tr>
      ${histRows}
    </table>
    </div>
  </div>` : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width">
<meta http-equiv="refresh" content="60">
<title>V信自动化测试报告</title>
${CHART_CDN}
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F2F2F7;color:#1C1C1E}
.header{background:linear-gradient(135deg,#07C160,#06AE56);color:#fff;padding:28px 24px}
.header h1{font-size:26px;font-weight:700;margin-bottom:4px}
.header p{opacity:.8;font-size:13px}
.badge{background:rgba(255,255,255,.2);border-radius:6px;padding:1px 8px;font-size:11px;margin-left:8px}
.container{max-width:1200px;margin:20px auto;padding:0 14px}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px}
.stat{background:#fff;border-radius:12px;padding:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.stat .num{font-size:30px;font-weight:700}
.stat .lbl{font-size:11px;color:#8E8E93;margin-top:2px}
.card{background:#fff;border-radius:12px;padding:18px;margin-bottom:18px;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.card h2{font-size:15px;margin-bottom:14px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:720px){.two-col{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#F2F2F7;padding:8px 6px;text-align:left;font-weight:600}
td{padding:7px 6px;border-bottom:1px solid #F2F2F7;vertical-align:top;word-break:break-word}
tr:last-child td{border-bottom:none}
.sev{display:inline-block;padding:2px 7px;border-radius:9px;color:#fff;font-size:10px;font-weight:600}
.metrics{display:flex;flex-wrap:wrap;gap:18px}
.metric{text-align:center;min-width:80px}
.metric .val{font-size:24px;font-weight:700;color:#07C160}
code{background:#F2F2F7;padding:1px 5px;border-radius:4px;font-size:11px}
</style>
</head>
<body>
<div class="header">
  <h1>《V信自动化测试报告》<span class="badge">24/7</span></h1>
  <p>更新: ${now} · 60s自刷新 · 累计 ${history.length} 轮 · 规模: ${cfg.STRESS_BOTS} bots / ${cfg.MSG_COUNT.toLocaleString()} 消息 / ${cfg.GROUP_COUNT} 群</p>
</div>
<div class="container">

<div class="summary">
  <div class="stat"><div class="num" style="color:#07C160">${passed.length}</div><div class="lbl">本轮通过</div></div>
  <div class="stat"><div class="num" style="color:#FF3B30">${bugs.length}</div><div class="lbl">本轮失败</div></div>
  <div class="stat"><div class="num" style="color:#FF3B30">${criticalN}</div><div class="lbl">Critical</div></div>
  <div class="stat"><div class="num" style="color:#FF9500">${highN}</div><div class="lbl">High</div></div>
  <div class="stat"><div class="num" style="color:#FFCC00">${mediumN}</div><div class="lbl">Medium</div></div>
  <div class="stat"><div class="num" style="color:${passRate>=80?'#07C160':'#FF3B30'}">${passRate}%</div><div class="lbl">通过率</div></div>
  <div class="stat"><div class="num">${history.length}</div><div class="lbl">累计轮次</div></div>
  <div class="stat"><div class="num">${(memSnaps[memSnaps.length-1]?.heapUsed ?? '-')}MB</div><div class="lbl">当前Heap</div></div>
</div>

${historyTrendSection(history)}
${memTrendSection(memSnaps)}
${stressSection}

<div class="two-col">
  <div class="card">
    <h2>🗺 功能覆盖矩阵 (${FEATURES.length} 项)</h2>
    <table><tr><th>功能</th><th>状态</th></tr>${featureRows}</table>
  </div>
  <div class="card">
    <h2>❌ 失败项 (${bugs.length})</h2>
    ${bugs.length
      ? `<div style="overflow-x:auto"><table><tr><th>时间</th><th>级别</th><th>测试</th><th>错误</th></tr>${bugRows}</table></div>`
      : '<p style="color:#07C160;padding:12px 0">本轮全部通过 ✅</p>'}
  </div>
</div>

${leakSection}
${histSection}

<div class="card">
  <h2>✅ 通过项（最近 50 条）</h2>
  <table><tr><th>时间</th><th>测试</th><th>详情</th></tr>${passRows}</table>
</div>

</div>
</body>
</html>`;
}

// ── 最终报告 ──────────────────────────────────────────────────
function generateFinalHTML(summary, history, memSnaps, leaks) {
  const now       = new Date().toLocaleString('zh-CN');
  const totalRuns = history.length;
  const avgPass   = totalRuns ? Math.round(history.reduce((a, h) => a + h.passRate, 0) / totalRuns) : 0;
  const worstLat  = history.reduce((m, h) => Math.max(m, h.stress?.p99Lat ?? 0), 0);
  const bestThru  = history.reduce((m, h) => Math.max(m, h.stress?.throughput ?? 0), 0);
  const totalBugs = history.reduce((a, h) => a + h.failed, 0);
  const criticals = history.reduce((a, h) => a + h.critical, 0);
  const highs     = history.reduce((a, h) => a + h.high, 0);
  const peakHeap  = memSnaps.reduce((m, s) => Math.max(m, s.heapUsed), 0);
  const peakEl    = memSnaps.reduce((m, s) => Math.max(m, s.elLagMs), 0);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>V信 24h 最终测试报告</title>
${CHART_CDN}
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,sans-serif;background:#F2F2F7;color:#1C1C1E}
.header{background:linear-gradient(135deg,#1C1C1E,#3A3A3C);color:#fff;padding:36px 24px}
.header h1{font-size:28px;font-weight:700;margin-bottom:6px}
.header p{opacity:.7;font-size:13px}
.container{max-width:1100px;margin:24px auto;padding:0 14px}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px}
.stat{background:#fff;border-radius:12px;padding:18px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.stat .num{font-size:32px;font-weight:700}
.stat .lbl{font-size:12px;color:#8E8E93;margin-top:4px}
.card{background:#fff;border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.card h2{font-size:16px;margin-bottom:14px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#F2F2F7;padding:9px 7px;text-align:left;font-weight:600}
td{padding:8px 7px;border-bottom:1px solid #F2F2F7;vertical-align:top;word-break:break-word}
tr:last-child td{border-bottom:none}
.sev{display:inline-block;padding:2px 7px;border-radius:9px;color:#fff;font-size:10px;font-weight:600}
</style>
</head>
<body>
<div class="header">
  <h1>《V信 24小时自动化测试最终报告》</h1>
  <p>报告生成: ${now} · 测试规模: ${cfg.STRESS_BOTS} bots / ${cfg.MSG_COUNT.toLocaleString()} 消息 / ${cfg.GROUP_COUNT} 群</p>
</div>
<div class="container">

<div class="summary">
  <div class="stat"><div class="num">${totalRuns}</div><div class="lbl">总轮次</div></div>
  <div class="stat"><div class="num" style="color:${avgPass>=80?'#07C160':'#FF3B30'}">${avgPass}%</div><div class="lbl">平均通过率</div></div>
  <div class="stat"><div class="num" style="color:${totalBugs?'#FF3B30':'#07C160'}">${totalBugs}</div><div class="lbl">累计失败</div></div>
  <div class="stat"><div class="num" style="color:#FF3B30">${criticals}</div><div class="lbl">Critical</div></div>
  <div class="stat"><div class="num" style="color:#FF9500">${highs}</div><div class="lbl">High</div></div>
  <div class="stat"><div class="num">${bestThru}</div><div class="lbl">峰值吞吐msg/s</div></div>
  <div class="stat"><div class="num">${worstLat}ms</div><div class="lbl">最高P99延迟</div></div>
  <div class="stat"><div class="num">${peakHeap}MB</div><div class="lbl">峰值Heap</div></div>
  <div class="stat"><div class="num">${peakEl}ms</div><div class="lbl">最高EL延迟</div></div>
  <div class="stat"><div class="num">${leaks.length}</div><div class="lbl">泄漏事件</div></div>
</div>

${historyTrendSection(history)}
${memTrendSection(memSnaps)}

<div class="card">
  <h2>🐛 累计 Bug 列表</h2>
  <table>
    <tr><th>轮次</th><th>时间</th><th>通过</th><th>失败</th><th>通过率</th><th>压测错误率</th><th>吞吐</th><th>P95</th></tr>
    ${history.map(h => `
    <tr>
      <td>#${h.round}</td>
      <td>${h.time.replace('T',' ').slice(0,19)}</td>
      <td style="color:#07C160">${h.passed}</td>
      <td style="color:${h.failed?'#FF3B30':'#07C160'}">${h.failed}</td>
      <td style="color:${h.passRate>=80?'#07C160':'#FF3B30'}">${h.passRate}%</td>
      <td>${h.stress?.errorRate ?? '—'}%</td>
      <td>${h.stress?.throughput ?? '—'}</td>
      <td>${h.stress?.p95Lat ?? '—'}ms</td>
    </tr>`).join('')}
  </table>
</div>

</div>
</body>
</html>`;
}

// ── 导出 ──────────────────────────────────────────────────────
function writeReport(summary, stressResult, history = [], memSnaps = [], leaks = []) {
  const html = generateHTML(summary, stressResult, history, memSnaps, leaks);
  const file = path.join(cfg.REPORTS_DIR, 'test-report.html');
  fs.writeFileSync(file, html);
  console.log(`\n📄 报告: ${file}`);
  return file;
}

function writeFinalReport(summary, history, memSnaps, leaks) {
  const html = generateFinalHTML(summary, history, memSnaps, leaks);
  const file = path.join(cfg.REPORTS_DIR, 'final-report-24h.html');
  fs.writeFileSync(file, html);
  console.log(`\n📊 24h 最终报告: ${file}`);
  return file;
}

module.exports = { writeReport, writeFinalReport };
