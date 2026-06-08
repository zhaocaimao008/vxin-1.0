#!/usr/bin/env node
/**
 * V信 24/7 持续测试调度器（增强版）
 *
 * 用法:
 *   node loop.js                   # 24h 持续循环
 *   node loop.js --once            # 单轮完整测试
 *   node loop.js --quick           # 快速模式（缩短机器人+压测时间）
 *   node loop.js --interval 300    # 自定义轮间隔（秒）
 *   node loop.js --hours 24        # 自定义运行时长（小时）
 */

const rep     = require('./utils/reporter');
const mem     = require('./utils/memMonitor');
const setup   = require('./setup/createAccounts');
const single  = require('./cases/singleChat');
const group   = require('./cases/groupChat');
const multi   = require('./cases/multiDevice');
const file    = require('./cases/fileUpload');
const chaos   = require('./cases/networkChaos');
const dbTest  = require('./cases/dbStress');
const bots    = require('./bots/randomBot');
const stress  = require('./stress/loadTest');
const report  = require('./report/generateReport');
const fs      = require('fs');
const path    = require('path');
const cfg     = require('./config');

// ── 参数解析 ──────────────────────────────────────────────────
const ONCE      = process.argv.includes('--once');
const QUICK     = process.argv.includes('--quick');
const ivArg     = process.argv.indexOf('--interval');
const INTERVAL  = ivArg  !== -1 ? Number(process.argv[ivArg + 1])  * 1000 : cfg.LOOP_INTERVAL_MS;
const hrArg     = process.argv.indexOf('--hours');
const HOURS     = hrArg  !== -1 ? Number(process.argv[hrArg + 1])         : cfg.LOOP_DURATION_H;
const DEADLINE  = ONCE ? Infinity : Date.now() + HOURS * 3_600_000;

const HISTORY_FILE = path.join(cfg.REPORTS_DIR, 'history.json');
const DB_HIST_FILE = path.join(cfg.REPORTS_DIR, 'db-stress-history.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadHistory(file) {
  try { return JSON.parse(fs.readFileSync(file)); } catch { return []; }
}
function appendHistory(file, entry, max = 500) {
  const h = loadHistory(file);
  h.push(entry);
  if (h.length > max) h.splice(0, h.length - max);
  fs.writeFileSync(file, JSON.stringify(h, null, 2));
}

// ── 批量建群（100 群）────────────────────────────────────────
async function bulkCreateGroups(accounts, apiMod) {
  const TARGET = Math.min(cfg.GROUP_COUNT, 100);
  rep.log(`\n  批量创建 ${TARGET} 个群...`);
  const ids = [];
  const owner = accounts[0];
  const c = apiMod.clientFromAccount(owner);

  for (let i = 0; i < TARGET; i++) {
    const size    = Math.min(cfg.GROUP_MEMBER_MAX, accounts.length - 1);
    const start   = (i * 3) % (accounts.length - 1) + 1;
    const members = [];
    for (let j = 0; j < size; j++) members.push(accounts[(start + j) % accounts.length].id);
    try {
      const g = await apiMod.createGroup(c, `测试群${i + 1}_${Date.now()}`, members);
      ids.push(g.conversationId);
    } catch {}
    if ((i + 1) % 20 === 0) { rep.log(`  建群进度 ${i + 1}/${TARGET}`); await sleep(100); }
  }
  rep.log(`  实际创建 ${ids.length} 个群`);
  return ids;
}

// ── 单轮完整测试 ─────────────────────────────────────────────
async function runOnce(roundNum, accounts) {
  const T0 = Date.now();
  rep.log(`\n${'═'.repeat(56)}`);
  rep.log(`   第 ${roundNum} 轮   ${new Date().toLocaleString('zh-CN')}`);
  rep.log(`   剩余时间: ${Math.max(0, Math.round((DEADLINE - Date.now()) / 3600000 * 10) / 10)}h`);
  rep.log(`${'═'.repeat(56)}`);

  // 内存快照（轮次开始）
  await mem.takeSnapshot(`round-${roundNum}-start`);

  if (!accounts) {
    try { accounts = await setup.loadAccounts(); }
    catch (e) { rep.fail('loop:loadAccounts', e, 'critical'); return null; }
  }
  if (accounts.length < 10) {
    rep.fail('loop:minAccounts', new Error(`账号不足 ${accounts.length}`), 'critical');
    return null;
  }

  const apiMod = require('./utils/api');

  // ── 首轮：好友关系 ────────────────────────────────────────
  if (roundNum === 1) await setup.setupFriendships(accounts);

  // ── 功能测试套件 ──────────────────────────────────────────
  await single.runSingleChatTests(accounts);
  await sleep(200);

  const groupIds = await group.runGroupChatTests(accounts) || [];
  await sleep(200);

  const c0    = apiMod.clientFromAccount(accounts[0]);
  const convs = await apiMod.getConversations(c0).catch(() => []);
  const firstPrivate = convs.find?.(c => c.type === 'private')?.id;

  await multi.runMultiDeviceTests(accounts, firstPrivate);
  await sleep(200);

  await file.runFileTests(accounts, firstPrivate);
  await sleep(200);

  // ── 断网混沌 ──────────────────────────────────────────────
  await chaos.runNetworkChaosTests(accounts);
  await sleep(200);

  // ── 随机机器人群（100人群）───────────────────────────────
  try {
    const botCount   = Math.min(cfg.BOT_ACTIVE_COUNT, accounts.length);
    const cBot       = apiMod.clientFromAccount(accounts[0]);
    const botGroup   = await apiMod.createGroup(
      cBot, `机器人活动群_${Date.now()}`,
      accounts.slice(1, botCount).map(a => a.id)
    );
    const botDuration = QUICK ? 20_000 : cfg.BOT_ACTIVE_DURATION;
    await bots.runRandomBots(accounts, botGroup.conversationId, botDuration, botCount);
  } catch (e) { rep.fail('loop:botGroup', e, 'low'); }
  await sleep(200);

  // ── 数据库压力（使用机器人群作为写入目标）────────────────
  let dbResult;
  try {
    const cDB   = apiMod.clientFromAccount(accounts[0]);
    const dbGrp = await apiMod.createGroup(
      cDB, `DB压测群_${Date.now()}`,
      accounts.slice(1, 21).map(a => a.id)
    );
    dbResult = await dbTest.runDbStressTests(accounts, dbGrp.conversationId);
  } catch (e) { rep.fail('loop:dbStress', e, 'medium'); }
  await sleep(200);

  // ── 压力测试（专用 100 人群，100k 消息）──────────────────
  let stressResult;
  if (!QUICK) {
    rep.log('\n▶ 压力测试（100 bots / 100k 消息）');
    try {
      const cS = apiMod.clientFromAccount(accounts[0]);
      const sGrp = await apiMod.createGroup(
        cS, `压测主群_${Date.now()}`,
        accounts.slice(1, Math.min(cfg.STRESS_BOTS, accounts.length)).map(a => a.id)
      );
      stressResult = await stress.runStressTest(accounts, [sGrp.conversationId]);
    } catch (e) { rep.fail('loop:stressGroup', e, 'medium'); }
  }

  // ── 内存快照（轮次结束）──────────────────────────────────
  await mem.takeSnapshot(`round-${roundNum}-end`);

  // ── 汇总 ─────────────────────────────────────────────────
  const summary = rep.summary();
  const elapsed = Math.round((Date.now() - T0) / 1000);

  const entry = {
    round:    roundNum,
    time:     new Date().toISOString(),
    elapsed,
    passed:   summary.passed,
    failed:   summary.failed,
    total:    summary.total,
    passRate: summary.total ? Math.round(summary.passed / summary.total * 100) : 0,
    critical: summary.bugs.filter(b => b.severity === 'critical').length,
    high:     summary.bugs.filter(b => b.severity === 'high').length,
    stress:   stressResult ? {
      sent:      stressResult.sent,
      errorRate: stressResult.errorRate,
      avgLat:    stressResult.avgLat,
      p95Lat:    stressResult.p95Lat,
      p99Lat:    stressResult.p99Lat,
      throughput: stressResult.throughput,
    } : null,
    db: dbResult || null,
  };
  appendHistory(HISTORY_FILE, entry);
  if (dbResult) appendHistory(DB_HIST_FILE, { round: roundNum, time: entry.time, ...dbResult });

  const history   = loadHistory(HISTORY_FILE);
  const memSnaps  = mem.getSnapshots();
  const leaks     = mem.getLeaks();
  const reportFile = report.writeReport(summary, stressResult, history, memSnaps, leaks);

  rep.log(`\n${'═'.repeat(56)}`);
  rep.log(`   第 ${roundNum} 轮完成 (${elapsed}s)  通过:${summary.passed}  失败:${summary.failed}`);
  rep.log(`   报告: ${reportFile}`);
  rep.log(`${'═'.repeat(56)}\n`);

  rep.save();
  return accounts;
}

// ── 主函数 ───────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(cfg.REPORTS_DIR,    { recursive: true });
  fs.mkdirSync(cfg.SCREENSHOTS_DIR, { recursive: true });

  // 启动内存监控（每10分钟采样）
  mem.start();

  rep.log('════════════════════════════════════════════════════════');
  rep.log(`   V信 24/7 自动化测试  ${new Date().toLocaleString('zh-CN')}`);
  rep.log(`   运行时长: ${HOURS}h  轮间隔: ${Math.round(INTERVAL/1000)}s  Quick: ${QUICK}`);
  rep.log(`   规模: ${cfg.STRESS_BOTS} bots / ${cfg.MSG_COUNT.toLocaleString()} 消息 / ${cfg.GROUP_COUNT} 群`);
  rep.log('════════════════════════════════════════════════════════');

  // 初始化账号（500个）
  let accounts;
  try {
    accounts = await setup.loadAccounts();
    if (accounts.length < cfg.STRESS_BOTS) {
      rep.log(`▶ 账号不足 (${accounts.length})，扩充到 ${cfg.BOT_COUNT}...`);
      accounts = await setup.createAccounts(cfg.BOT_COUNT);
    }
  } catch (e) {
    rep.fail('loop:init', e, 'critical');
    mem.stop();
    process.exit(1);
  }

  let round = 1;
  while (true) {
    accounts = await runOnce(round, accounts);
    if (ONCE || !accounts || Date.now() >= DEADLINE) break;
    round++;
    rep.log(`⏱  等待 ${Math.round(INTERVAL/1000)}s 后开始第 ${round} 轮...`);
    await sleep(INTERVAL);
  }

  // ── 24h 最终报告 ──────────────────────────────────────────
  mem.stop();
  const final    = rep.summary();
  const history  = loadHistory(HISTORY_FILE);
  const memSnaps = mem.getSnapshots();
  const leaks    = mem.getLeaks();
  report.writeFinalReport(final, history, memSnaps, leaks);

  rep.log('\n════════════════════ 24h 测试结束 ════════════════════');
  rep.log(`累计轮次: ${history.length}  总通过: ${final.passed}  总失败: ${final.failed}`);

  process.exit(final.bugs.some(b => b.severity === 'critical' || b.severity === 'high') ? 1 : 0);
}

main().catch(e => {
  rep.fail('loop:uncaught', e, 'critical');
  rep.save();
  process.exit(1);
});
