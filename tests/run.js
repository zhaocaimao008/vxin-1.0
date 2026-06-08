#!/usr/bin/env node
/**
 * V信自动化测试主入口
 * 执行: node run.js [--quick] [--stress-only]
 */
const rep     = require('./utils/reporter');
const setup   = require('./setup/createAccounts');
const single  = require('./cases/singleChat');
const group   = require('./cases/groupChat');
const multi   = require('./cases/multiDevice');
const file    = require('./cases/fileUpload');
const stress  = require('./stress/loadTest');
const report  = require('./report/generateReport');

const QUICK = process.argv.includes('--quick');
const STRESS_ONLY = process.argv.includes('--stress-only');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const T0 = Date.now();
  rep.log('════════════════════════════════════');
  rep.log('   V信 自动化测试套件');
  rep.log('════════════════════════════════════');

  // ── 第一步：账号 ──────────────────────────────────────────────
  rep.log('\n▶ STEP 1: 账号初始化');
  let accounts;
  try {
    accounts = await setup.loadAccounts();
    if (accounts.length < 10) {
      rep.fail('setup:minAccounts', new Error(`账号不足: ${accounts.length} < 10`), 'critical');
      process.exit(1);
    }
  } catch (e) {
    rep.fail('setup:accounts', e, 'critical');
    process.exit(1);
  }

  if (!STRESS_ONLY) {
    // ── 第二步：好友关系 ────────────────────────────────────────
    rep.log('\n▶ STEP 2: 建立好友关系');
    await setup.setupFriendships(accounts);
    await sleep(500);

    // ── 第三步：单聊测试 ────────────────────────────────────────
    rep.log('\n▶ STEP 3: 单聊测试');
    await single.runSingleChatTests(accounts);
    await sleep(500);

    // ── 第四步：群聊测试 ────────────────────────────────────────
    rep.log('\n▶ STEP 4: 群聊测试');
    const groupIds = await group.runGroupChatTests(accounts) || [];
    await sleep(500);

    // ── 第五步：多端同步 ────────────────────────────────────────
    rep.log('\n▶ STEP 5: 多端同步测试');
    const apiMod = require('./utils/api');
    const convClient = apiMod.clientFromAccount(accounts[0]);
    const convs = await apiMod.getConversations(convClient).catch(() => []);
    const firstPrivateConv = convs.find?.(c => c.type === 'private')?.id;
    await multi.runMultiDeviceTests(accounts, firstPrivateConv);
    await sleep(500);

    // ── 第六步：文件安全 ────────────────────────────────────────
    rep.log('\n▶ STEP 6: 文件上传测试');
    await file.runFileTests(accounts, firstPrivateConv);
    await sleep(500);

    if (!QUICK) {
      // ── 第七步：压力测试 ──────────────────────────────────────
      rep.log('\n▶ STEP 7: 压力测试');
      const apiRef = require('./utils/api');
      const client2 = apiRef.clientFromAccount(accounts[0]);
      const stressGroup = await apiRef.createGroup(client2, '压测主群', accounts.slice(1, 20).map(a => a.id)).catch(() => ({ conversationId: null }));
      var stressResult = await stress.runStressTest(accounts, [stressGroup.conversationId]);
    }
  } else {
    // 仅压测模式
    rep.log('\n▶ STRESS ONLY MODE');
    const apiRef2 = require('./utils/api');
    const client = apiRef2.clientFromAccount(accounts[0]);
    const grp = await apiRef2.createGroup(client, `压测群_${Date.now()}`, accounts.slice(1, 30).map(a => a.id));
    var stressResult = await stress.runStressTest(accounts, [grp.conversationId]);
  }

  // ── 最终报告 ────────────────────────────────────────────────
  const summary = rep.summary();
  const elapsed = Math.round((Date.now() - T0) / 1000);

  rep.log('\n════════════════════════════════════');
  rep.log(`   测试完成 (${elapsed}s)`);
  rep.log(`   通过: ${summary.passed}  失败: ${summary.failed}  总计: ${summary.total}`);
  rep.log('════════════════════════════════════');

  const reportFile = report.writeReport(summary, stressResult);
  rep.save();

  // 返回码：有 critical/high bug 则非零
  const hasCritical = summary.bugs.some(b => b.severity === 'critical' || b.severity === 'high');
  process.exit(hasCritical ? 1 : 0);
}

main().catch(e => {
  rep.fail('main:uncaught', e, 'critical');
  rep.save();
  process.exit(1);
});
