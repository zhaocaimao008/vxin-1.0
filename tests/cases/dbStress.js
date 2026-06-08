/**
 * 数据库压力测试
 * - 并发写入（多账号同时发消息 → 触发大量 INSERT）
 * - 全文搜索（GET /conversation/:id/search?q=xxx）
 * - 分页拉取（GET /messages/:convId?limit=20&before=xxx）
 * - 统计每种操作的 P50 / P95 / P99 延迟
 */
const api  = require('../utils/api');
const rep  = require('../utils/reporter');
const { connectSocket, sendMessage } = require('../utils/socket');
const cfg  = require('../config');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function percentile(arr, p) {
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length * p / 100)] ?? 0;
}

async function runDbStressTests(accounts, convId) {
  rep.log('\n══ 数据库压力测试 ══');

  if (!convId) {
    rep.fail('dbStress:noConv', new Error('无会话 ID'), 'medium');
    return {};
  }

  const WORKERS    = Math.min(20, accounts.length);
  const WRITE_N    = 200;   // 每 worker 写入消息数
  const SEARCH_N   = 50;    // 搜索次数
  const PAGE_N     = 50;    // 分页次数

  const writeLatencies  = [];
  const searchLatencies = [];
  const pageLatencies   = [];
  let writeErrors = 0, searchErrors = 0, pageErrors = 0;

  // ── 1. 并发写入 ────────────────────────────────────────────
  rep.log(`  并发写入: ${WORKERS} workers × ${WRITE_N} 条...`);

  const sockets = [];
  for (let i = 0; i < WORKERS; i++) {
    try {
      const s = await connectSocket(api.clientFromAccount(accounts[i]).getCookie());
      s.emit('join_conversation', { conversationId: convId });
      sockets.push(s);
    } catch {}
    await sleep(20);
  }
  await sleep(300);

  const writeWorker = async (sock, idx) => {
    for (let n = 0; n < WRITE_N; n++) {
      const t0 = Date.now();
      try {
        await sendMessage(sock, convId, `DB压测_w${idx}_m${n}`);
        writeLatencies.push(Date.now() - t0);
      } catch {
        writeErrors++;
      }
      await sleep(10);
    }
  };

  await Promise.all(sockets.map((s, i) => writeWorker(s, i)));
  sockets.forEach(s => s.disconnect());

  const totalWrite = writeLatencies.length;
  rep.log(`  写入完成: ${totalWrite} 成功 / ${writeErrors} 失败`);
  rep.log(`  写入延迟: P50=${percentile(writeLatencies,50)}ms P95=${percentile(writeLatencies,95)}ms P99=${percentile(writeLatencies,99)}ms`);

  if (writeErrors === 0) {
    rep.pass('dbStress:write', `${totalWrite} 条写入全部成功 P95=${percentile(writeLatencies,95)}ms`);
  } else {
    rep.fail('dbStress:write', new Error(`写入错误 ${writeErrors} 次`), writeErrors > WORKERS * 5 ? 'high' : 'medium');
  }

  // ── 2. 全文搜索 ────────────────────────────────────────────
  rep.log(`  全文搜索: ${SEARCH_N} 次...`);
  const searchClient = api.clientFromAccount(accounts[0]);
  const keywords = ['DB压测', 'w0', 'w1', '消息', 'test'];

  for (let i = 0; i < SEARCH_N; i++) {
    const q = keywords[i % keywords.length];
    const t0 = Date.now();
    try {
      await searchClient.get(`/api/messages/conversation/${convId}/search`, { params: { q, limit: 20 } });
      searchLatencies.push(Date.now() - t0);
    } catch {
      searchErrors++;
    }
    await sleep(50);
  }

  rep.log(`  搜索延迟: P50=${percentile(searchLatencies,50)}ms P95=${percentile(searchLatencies,95)}ms P99=${percentile(searchLatencies,99)}ms`);
  searchErrors === 0
    ? rep.pass('dbStress:search', `${SEARCH_N} 次搜索 P95=${percentile(searchLatencies,95)}ms`)
    : rep.fail('dbStress:search', new Error(`搜索失败 ${searchErrors} 次`), 'medium');

  // ── 3. 分页拉取 ────────────────────────────────────────────
  rep.log(`  分页拉取: ${PAGE_N} 次...`);
  let before = undefined;

  for (let i = 0; i < PAGE_N; i++) {
    const t0 = Date.now();
    try {
      const params = { limit: 20 };
      if (before) params.before = before;
      const msgs = await searchClient.get(`/api/messages/${convId}`, { params }).then(r => r.data);
      pageLatencies.push(Date.now() - t0);
      // 用最后一条消息的 ID 作为下一页游标
      if (Array.isArray(msgs) && msgs.length) {
        before = msgs[msgs.length - 1].id;
      }
    } catch {
      pageErrors++;
    }
    await sleep(30);
  }

  rep.log(`  分页延迟: P50=${percentile(pageLatencies,50)}ms P95=${percentile(pageLatencies,95)}ms P99=${percentile(pageLatencies,99)}ms`);
  pageErrors === 0
    ? rep.pass('dbStress:pagination', `${PAGE_N} 次分页 P95=${percentile(pageLatencies,95)}ms`)
    : rep.fail('dbStress:pagination', new Error(`分页失败 ${pageErrors} 次`), 'medium');

  return {
    write:  { total: totalWrite, errors: writeErrors, p50: percentile(writeLatencies,50), p95: percentile(writeLatencies,95), p99: percentile(writeLatencies,99) },
    search: { total: SEARCH_N,  errors: searchErrors, p50: percentile(searchLatencies,50), p95: percentile(searchLatencies,95), p99: percentile(searchLatencies,99) },
    page:   { total: PAGE_N,    errors: pageErrors,   p50: percentile(pageLatencies,50),   p95: percentile(pageLatencies,95),   p99: percentile(pageLatencies,99) },
  };
}

module.exports = { runDbStressTests };
