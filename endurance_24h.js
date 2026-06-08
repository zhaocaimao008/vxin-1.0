/**
 * 24小时耐久测试 — 每10分钟跑一轮完整压力测试
 * 
 * 每轮：1500 并发查资料 + 随机发消息 + 随机搜索 + 查好友
 * 日志：/root/v信/backend/endurance.log
 * 仅失败时输出详情，正常时只更新计数
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const BASE = 'http://localhost:3002';
const LOG = '/root/v信/backend/endurance.log';
const LOG_MAX = 5000; // 行数上限

// ── 统计 ──────────────────────────────────────
const report = {
  cycles: 0, total: 0, ok: 0, fail: 0,
  start: Date.now(), errors: [],
};

let bots = [];
let tokens = {};
let lastReport = Date.now();

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    const existing = fs.readFileSync(LOG, 'utf-8').split('\n').filter(Boolean);
    if (existing.length > LOG_MAX) existing.splice(0, existing.length - LOG_MAX + 1);
    existing.push(line);
    fs.writeFileSync(LOG, existing.join('\n') + '\n');
  } catch {}
}

// ── API 工具 ──────────────────────────────────
function api(method, ep, body, token) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost',
      port: 3002,
      path: ep,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    };
    if (token) opts.headers['Cookie'] = `vxin_token=${encodeURIComponent(token)}`;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', () => resolve({ status: 0, data: null }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: null }); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function bot() { return { pick: () => bots[Math.floor(Math.random() * bots.length)], all: () => bots }; }

// ── 单轮测试 ──────────────────────────────────
async function runCycle(cycleNum) {
  const start = Date.now();
  let cycleTotal = 0, cycleOk = 0;

  // 1. 1500 并发查资料（分6批，每批250）
  let ok1 = 0;
  for (let batch = 0; batch < bots.length; batch += 250) {
    const batchBots = bots.slice(batch, batch + 250);
    const r1 = await Promise.all(batchBots.map(b => api('GET', `/api/users/${b.id}`, null, b.token)));
    ok1 += r1.filter(r => r.status === 200).length;
  }
  cycleTotal += bots.length; cycleOk += ok1;
  if (ok1 < 1490) {
    const err = `Cycle ${cycleNum}: 资料查询异常 (${ok1}/${bots.length})`;
    report.errors.push(err); log(err);
  }

  // 2. 1500 并发查好友（分6批）
  let ok2 = 0;
  for (let batch = 0; batch < bots.length; batch += 250) {
    const batchBots = bots.slice(batch, batch + 250);
    const r2 = await Promise.all(batchBots.map(b => api('GET', '/api/users/contacts', null, b.token)));
    ok2 += r2.filter(r => r.status === 200).length;
  }
  cycleTotal += bots.length; cycleOk += ok2;
  if (ok2 < 1490) {
    const err = `Cycle ${cycleNum}: 好友查询异常 (${ok2}/${bots.length})`;
    report.errors.push(err); log(err);
  }

  // 3. 500 并发搜索（分2批）
  const queries = ['机器人', '测试', '好友', '用户', 'bot'];
  let ok3 = 0;
  for (let batch = 0; batch < 500; batch += 250) {
    const batchReqs = Array.from({ length: Math.min(250, 500 - batch) }, () => {
      const b = bots[Math.floor(Math.random() * bots.length)];
      const q = queries[Math.floor(Math.random() * queries.length)];
      return api('GET', `/api/users/search?q=${encodeURIComponent(q)}`, null, b.token);
    });
    const r3 = await Promise.all(batchReqs);
    ok3 += r3.filter(r => r.status === 200).length;
  }
  cycleTotal += 500; cycleOk += ok3;
  if (ok3 < 490) {
    const err = `Cycle ${cycleNum}: 搜索异常 (${ok3}/500)`;
    report.errors.push(err); log(err);
  }

  // 4. 发消息 (200条)
  const msgSender = bots.slice(0, 100);
  const msgReqs = msgSender.map((s, i) => {
    const r = bots[(i + 1) % bots.length];
    return api('POST', '/api/messages/conversation/private', { userId: r.id }, s.token)
      .then(conv => {
        if (conv.status === 200 && conv.data?.conversationId)
          return api('POST', `/api/messages/${conv.data.conversationId}`, {
            content: `耐久测试 #${cycleNum} @${Date.now()}`,
            type: 'text',
          }, s.token);
        return conv;
      });
  });
  const r4 = await Promise.all(msgReqs);
  const ok4 = r4.filter(r => r.status === 200).length;
  cycleTotal += r4.length; cycleOk += ok4;

  // 5. 200 并发混合
  const mixed = [];
  for (let i = 0; i < 200; i++) {
    const b = bots[i % bots.length];
    const choice = i % 4;
    if (choice === 0) mixed.push(api('GET', `/api/users/${b.id}`, null, b.token));
    else if (choice === 1) mixed.push(api('GET', '/api/users/contacts', null, b.token));
    else if (choice === 2) mixed.push(api('GET', '/api/messages/conversations', null, b.token));
    else mixed.push(api('PUT', '/api/users/profile', { bio: `耐久${cycleNum}_${Date.now()}` }, b.token));
  }
  const r5 = await Promise.all(mixed);
  const ok5 = r5.filter(r => r.status === 200).length;
  cycleTotal += r5.length; cycleOk += ok5;

  report.cycles++;
  report.total += cycleTotal;
  report.ok += cycleOk;
  report.fail += cycleTotal - cycleOk;

  const elapsed = (Date.now() - start) / 1000;
  const rate = (cycleOk / cycleTotal * 100).toFixed(1);
  
  // 每5分钟报一次进展
  if (Date.now() - lastReport > 300000) {
    const totalElapsed = ((Date.now() - report.start) / 1000 / 60).toFixed(0);
    const totalRate = (report.ok / report.total * 100).toFixed(1);
    log(`[${totalElapsed}min] Cycle ${cycleNum}: ${cycleOk}/${cycleTotal} (${rate}%) | 累计: ${report.ok}/${report.total} (${totalRate}%) | 错误: ${report.errors.length}`);
    lastReport = Date.now();
  }

  return { ok: cycleOk, total: cycleTotal, rate, elapsed: elapsed.toFixed(1) };
}

// ── 主循环 ────────────────────────────────────
async function main() {
  log('══════════════════════════════════════════════');
  log('  vxin 24小时耐久测试 启动');
  log(`  时间: ${new Date().toISOString()}`);
  log('══════════════════════════════════════════════');

  // 加载数据
  const db = new Database('/root/v信/backend/wechat.db');
  const rows = db.prepare('SELECT id, username, phone FROM users WHERE phone >= 17700000000 ORDER BY phone').all();
  db.close();

  tokens = JSON.parse(fs.readFileSync('/root/v信/backend/.bot_tokens.json', 'utf-8'));
  bots = rows.map(r => ({ ...r, token: tokens[r.phone] || '' })).filter(b => b.token);
  log(`已加载 ${bots.length} 个机器人`);

  if (bots.length === 0) {
    log('错误：无可用机器人');
    process.exit(1);
  }

  const END_TIME = Date.now() + 24 * 60 * 60 * 1000; // 24h
  const CYCLE_INTERVAL = 10 * 60 * 1000; // 每10分钟
  let cycleNum = 1;

  while (Date.now() < END_TIME) {
    const remaining = ((END_TIME - Date.now()) / 1000 / 60 / 60).toFixed(1);
    log(`\n--- Cycle ${cycleNum} (剩余 ${remaining}h) ---`);

    try {
      const result = await runCycle(cycleNum);
      const totalRate = (report.ok / report.total * 100).toFixed(1);
      
      // 检查是否需要通知
      if (result.ok < result.total * 0.95) {
        log(`⚠ 警告! Cycle ${cycleNum} 成功率 ${result.rate}% (${result.ok}/${result.total})`);
      }

      // 每6小时输出汇总
      if (cycleNum % 36 === 0) {
        const hours = ((Date.now() - report.start) / 1000 / 60 / 60).toFixed(1);
        log(`\n[${hours}h 汇总] Cycles: ${report.cycles} | 请求: ${report.ok}/${report.total} | 错误: ${report.errors.length}`);
        if (report.errors.length > 0) {
          log(`最近错误:`);
          report.errors.slice(-5).forEach(e => log(`  ${e}`));
        }
      }
    } catch (e) {
      log(`Cycle ${cycleNum} 崩溃: ${e.message}`);
      report.errors.push(`Cycle ${cycleNum} crash: ${e.message}`);
    }

    cycleNum++;

    // 等10分钟
    const waitMs = Math.min(CYCLE_INTERVAL, END_TIME - Date.now());
    if (waitMs > 0) {
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  // ── 总结 ──
  const totalHours = ((Date.now() - report.start) / 1000 / 60 / 60).toFixed(1);
  const rate = (report.ok / report.total * 100).toFixed(1);

  log('\n══════════════════════════════════════════════');
  log('  24小时耐久测试 完成');
  log('══════════════════════════════════════════════');
  log(`  运行时间: ${totalHours}h`);
  log(`  总轮次:   ${report.cycles}`);
  log(`  总请求:   ${report.total}`);
  log(`  成功:     ${report.ok}`);
  log(`  失败:     ${report.fail}`);
  log(`  成功率:   ${rate}%`);
  log(`  错误:     ${report.errors.length}`);
  if (report.errors.length > 0) {
    log(`\n  错误列表:`);
    report.errors.forEach(e => log(`    ✗ ${e}`));
  }

  if (report.fail === 0) {
    log('\n  ✅ 完美运行，零错误！');
  }

  // 最终数据库状态
  const dbf = new Database('/root/v信/backend/wechat.db');
  const u = dbf.prepare("SELECT COUNT(*) as c FROM users WHERE phone >= 17700000000").get().c;
  const m = dbf.prepare('SELECT COUNT(*) as c FROM messages').get().c;
  const conv = dbf.prepare('SELECT COUNT(*) as c FROM conversations').get().c;
  dbf.close();
  log(`\n  最终数据: 用户=${u} 会话=${conv} 消息=${m}`);

  process.exit(report.fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
