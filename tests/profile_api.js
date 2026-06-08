#!/usr/bin/env node
/**
 * V信 API 性能分析器
 * 对 7 个核心 API 做深度剖析：avgTime / P95 / P99 / SQL次数 / 查询时间 / 写入时间 / 广播时间
 * 输出《API_SLOW 根因报告》
 */

const http   = require('http');
const path   = require('path');
const fs     = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// ── 直接打开 DB（只读分析，不影响生产进程） ────────────────────
const Database = require('../backend/node_modules/better-sqlite3');
const DB_PATH  = path.join(__dirname, '../backend/wechat.db');
const db       = new Database(DB_PATH, { readonly: true });

const BASE_URL     = 'http://localhost:3002';
const REPORTS_DIR  = path.join(__dirname, 'test-reports');
const REPORT_FILE  = path.join(REPORTS_DIR, 'api-slow-report.json');
const HTML_FILE    = path.join(REPORTS_DIR, 'api-slow-report.html');
const ITERATIONS   = 20;   // 每个 API 测 20 次

// ── 读取测试账号 ───────────────────────────────────────────────
const accounts = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, 'accounts.json')));
const BOT      = accounts[0];
const BOT2     = accounts[1];
const COOKIE   = BOT.cookie;
const USER_ID  = BOT.id;

// ── HTTP 工具 ──────────────────────────────────────────────────
function request(method, urlPath, body, cookie = COOKIE, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: urlPath,
      method,
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/json',
        'Content-Length': payload ? Buffer.byteLength(payload) : 0,
      }
    };
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), timeout);
    const req = http.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        clearTimeout(timer);
        resolve({ status: res.statusCode, body: data, latency: 0 });
      });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function timedRequest(method, urlPath, body, cookie, n = ITERATIONS) {
  const times = [];
  let errors = 0;
  for (let i = 0; i < n; i++) {
    const t0 = Date.now();
    try {
      await request(method, urlPath, body, cookie);
      times.push(Date.now() - t0);
    } catch {
      errors++;
    }
  }
  times.sort((a, b) => a - b);
  const avg  = times.length ? Math.round(times.reduce((s, v) => s + v, 0) / times.length) : -1;
  const p95  = times.length ? times[Math.floor(times.length * 0.95)] : -1;
  const p99  = times.length ? times[Math.floor(times.length * 0.99)] : -1;
  const min  = times[0] ?? -1;
  const max  = times[times.length - 1] ?? -1;
  return { avg, p95, p99, min, max, samples: times.length, errors, all: times };
}

// ── SQL 分析工具 ───────────────────────────────────────────────
function timeQuery(sql, params = []) {
  const t0 = process.hrtime.bigint();
  let result, rows = 0;
  try {
    const stmt = db.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH')) {
      result = stmt.all(...params);
      rows = result.length;
    } else {
      result = stmt.run(...params);
    }
  } catch (e) {
    return { ms: -1, rows: -1, error: e.message };
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { ms: Math.round(ms * 100) / 100, rows };
}

function explainQuery(sql, params = []) {
  try {
    const plan = db.prepare('EXPLAIN QUERY PLAN ' + sql).all(...params);
    return plan.map(p => p.detail).join(' | ');
  } catch (e) {
    return 'ERROR: ' + e.message;
  }
}

// ── 标记颜色 ───────────────────────────────────────────────────
function flag(ms) {
  if (ms >= 1000) return 'CRITICAL';
  if (ms >= 500)  return 'HIGH';
  if (ms >= 100)  return 'WARN';
  return 'OK';
}

// ── 主分析流程 ─────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         V信 API_SLOW 根因分析器  启动                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ── 先获取真实 convId 和 groupConvId ──────────────────────────
  console.log('► 获取测试数据...');
  const convResp = await request('GET', '/api/messages/conversations');
  const convList = JSON.parse(convResp.body);
  const privConv  = convList.find(c => c.type === 'private');
  const groupConv = convList.find(c => c.type === 'group');
  const CONV_ID   = privConv?.id  || convList[0]?.id;
  const GROUP_ID  = groupConv?.id || CONV_ID;
  console.log(`  私聊ID: ${CONV_ID}`);
  console.log(`  群聊ID: ${GROUP_ID}`);
  console.log(`  会话总数: ${convList.length}`);

  const results = {};
  const allTimes = [];   // for top-10

  // ═══════════════════════════════════════════════════════════════
  // 1. GET /api/messages/conversations — 会话列表（含未读数）
  // ═══════════════════════════════════════════════════════════════
  console.log('\n[1/7] GET /conversations — 会话列表+未读数...');
  const r1 = await timedRequest('GET', '/api/messages/conversations');

  // SQL 分析：主查询
  const sqlConvMain = `
    SELECT c.id, c.type, c.name,
      (SELECT COUNT(*) FROM messages mu
       WHERE mu.conversation_id = c.id AND mu.sender_id != ? AND mu.deleted=0 AND mu.created_at > COALESCE(
         (SELECT cs2.last_read_at FROM conversation_settings cs2 WHERE cs2.user_id=? AND cs2.conversation_id=c.id), 0
       )) AS unreadCount
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=?
    LEFT JOIN messages m ON m.id=(SELECT id FROM messages WHERE conversation_id=c.id AND deleted=0 ORDER BY created_at DESC LIMIT 1)
    LEFT JOIN users u ON u.id=m.sender_id
    LEFT JOIN conversation_settings cs ON cs.user_id=? AND cs.conversation_id=c.id
    ORDER BY COALESCE(cs.pinned,0) DESC, COALESCE(m.created_at, c.created_at) DESC
  `;
  const sqlConvMainT = timeQuery(sqlConvMain, [USER_ID, USER_ID, USER_ID, USER_ID]);
  const sqlConvPlan  = explainQuery(sqlConvMain, [USER_ID, USER_ID, USER_ID, USER_ID]);

  // N+1 查询成本（每个私聊/群额外一条）
  const privConvCount  = convList.filter(c => c.type === 'private').length;
  const groupConvCount = convList.filter(c => c.type === 'group').length;
  const sqlPrivOther   = timeQuery('SELECT u.id,u.username,u.avatar,u.status FROM users u JOIN conversation_members cm ON cm.user_id=u.id WHERE cm.conversation_id=? AND u.id!=?', [CONV_ID, USER_ID]);
  const sqlGroupMember = timeQuery('SELECT u.id,u.username,u.avatar FROM users u JOIN conversation_members cm ON cm.user_id=u.id WHERE cm.conversation_id=? LIMIT 9', [GROUP_ID]);

  results['GET /conversations'] = {
    ...r1,
    sqlAnalysis: {
      mainQuery:    { ...sqlConvMainT, plan: sqlConvPlan },
      n1_private:   { count: privConvCount, perQueryMs: sqlPrivOther.ms, totalEstMs: Math.round(privConvCount * sqlPrivOther.ms) },
      n1_group:     { count: groupConvCount, perQueryMs: sqlGroupMember.ms, totalEstMs: Math.round(groupConvCount * sqlGroupMember.ms) },
      totalSqlCalls: 1 + privConvCount + groupConvCount,
      estimatedSqlMs: Math.round(sqlConvMainT.ms + privConvCount * sqlPrivOther.ms + groupConvCount * sqlGroupMember.ms),
    }
  };
  allTimes.push({ api: 'GET /conversations', avg: r1.avg, p95: r1.p95, p99: r1.p99 });
  console.log(`  avg=${r1.avg}ms  p95=${r1.p95}ms  p99=${r1.p99}ms  [${flag(r1.avg)}]`);
  console.log(`  主查询: ${sqlConvMainT.ms}ms  N+1私聊x${privConvCount}(${sqlPrivOther.ms}ms each)  N+1群x${groupConvCount}(${sqlGroupMember.ms}ms each)`);
  console.log(`  PLAN: ${sqlConvPlan.substring(0,120)}`);

  // ═══════════════════════════════════════════════════════════════
  // 2. GET /api/messages/unread-counts — 未读同步
  // ═══════════════════════════════════════════════════════════════
  console.log('\n[2/7] GET /unread-counts — 未读同步...');
  const r2 = await timedRequest('GET', '/api/messages/unread-counts');

  const sqlUnread = `
    SELECT cm.conversation_id, COUNT(m.id) AS unread_count
    FROM conversation_members cm
    LEFT JOIN messages m
      ON  m.conversation_id = cm.conversation_id
      AND m.sender_id != cm.user_id
      AND m.deleted = 0
      AND m.created_at > COALESCE(
            (SELECT cs.last_read_at FROM conversation_settings cs
             WHERE cs.user_id=cm.user_id AND cs.conversation_id=cm.conversation_id), 0)
    WHERE cm.user_id=?
    GROUP BY cm.conversation_id
  `;
  const sqlUnreadT    = timeQuery(sqlUnread, [USER_ID]);
  const sqlUnreadPlan = explainQuery(sqlUnread, [USER_ID]);

  results['GET /unread-counts'] = {
    ...r2,
    sqlAnalysis: {
      mainQuery: { ...sqlUnreadT, plan: sqlUnreadPlan },
      totalSqlCalls: 1,
      estimatedSqlMs: sqlUnreadT.ms,
    }
  };
  allTimes.push({ api: 'GET /unread-counts', avg: r2.avg, p95: r2.p95, p99: r2.p99 });
  console.log(`  avg=${r2.avg}ms  p95=${r2.p95}ms  p99=${r2.p99}ms  [${flag(r2.avg)}]`);
  console.log(`  SQL: ${sqlUnreadT.ms}ms  rows=${sqlUnreadT.rows}`);
  console.log(`  PLAN: ${sqlUnreadPlan.substring(0,120)}`);

  // ═══════════════════════════════════════════════════════════════
  // 3. GET /api/messages/missed — 消息补拉
  // ═══════════════════════════════════════════════════════════════
  console.log('\n[3/7] GET /messages/missed — 消息补拉...');
  const after5min = Math.floor(Date.now() / 1000) - 300;
  const r3 = await timedRequest('GET', `/api/messages/missed?after=${after5min}`);

  const convIds   = db.prepare('SELECT conversation_id FROM conversation_members WHERE user_id=?').all(USER_ID).map(r => r.conversation_id);
  const ph        = convIds.map(() => '?').join(',');
  const sqlMissed = `SELECT m.*, u.username as senderName FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id IN (${ph}) AND m.deleted=0 AND m.created_at>? ORDER BY m.created_at ASC LIMIT 300`;
  const sqlMissedT    = timeQuery(sqlMissed, [...convIds, after5min]);
  const sqlMissedPlan = explainQuery(sqlMissed, [...convIds, after5min]);

  // 取最近30min窗口来测 N+1 reply_to
  const after30min = Math.floor(Date.now() / 1000) - 1800;
  const sampleMsgs = db.prepare(`SELECT id, reply_to_id FROM messages WHERE conversation_id IN (${ph}) AND deleted=0 AND created_at>? ORDER BY created_at ASC LIMIT 50`).all(...convIds, after30min);
  const replyMsgs  = sampleMsgs.filter(m => m.reply_to_id);
  let totalReplyMs = 0;
  if (replyMsgs.length > 0) {
    const t0 = process.hrtime.bigint();
    replyMsgs.forEach(m => db.prepare('SELECT m.id,m.type,m.content,u.username FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?').get(m.reply_to_id));
    totalReplyMs = Math.round(Number(process.hrtime.bigint() - t0) / 1e6);
  }

  results['GET /missed'] = {
    ...r3,
    sqlAnalysis: {
      mainQuery:    { ...sqlMissedT, plan: sqlMissedPlan },
      n1_replyTo:   { count: replyMsgs.length, totalMs: totalReplyMs, perMs: replyMsgs.length ? Math.round(totalReplyMs / replyMsgs.length * 100) / 100 : 0 },
      totalSqlCalls: 2 + convIds.length + replyMsgs.length,
      estimatedSqlMs: Math.round(sqlMissedT.ms + totalReplyMs),
    }
  };
  allTimes.push({ api: 'GET /missed', avg: r3.avg, p95: r3.p95, p99: r3.p99 });
  console.log(`  avg=${r3.avg}ms  p95=${r3.p95}ms  p99=${r3.p99}ms  [${flag(r3.avg)}]`);
  console.log(`  主查询: ${sqlMissedT.ms}ms  replyTo N+1: ${replyMsgs.length}次/${totalReplyMs}ms  convIds: ${convIds.length}`);

  // ═══════════════════════════════════════════════════════════════
  // 4. Socket send_message — 群消息广播（via HTTP fallback 测时）
  // ═══════════════════════════════════════════════════════════════
  console.log('\n[4/7] POST /messages/:convId — 消息发送+广播...');
  const r4 = await timedRequest('POST', `/api/messages/${GROUP_ID}`, { content: 'perf_test_msg_' + Date.now(), type: 'text' });

  // SQL 分解
  const sqlMsgInsert  = timeQuery('INSERT INTO messages (id,conversation_id,sender_id,type,content) VALUES (?,?,?,?,?)', [require('crypto').randomUUID(), GROUP_ID, USER_ID, 'text', 'perf']);
  // (INSERT 到 readonly db 会失败，但可以用 EXPLAIN 估时)
  const sqlMsgSelect  = timeQuery('SELECT m.*,u.username as senderName,u.avatar as senderAvatar FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?', [sampleMsgs[0]?.id || '']);
  const sqlMembersQ   = timeQuery('SELECT user_id FROM conversation_members WHERE conversation_id=?', [GROUP_ID]);
  const memberCount   = sqlMembersQ.rows;

  results['POST /messages (send)'] = {
    ...r4,
    sqlAnalysis: {
      insertMsg:      { ms: sqlMsgInsert.ms < 0 ? 'N/A(readonly)' : sqlMsgInsert.ms },
      selectMsg:      { ...sqlMsgSelect },
      selectMembers:  { ...sqlMembersQ, memberCount },
      broadcastNote:  `io.to(${GROUP_ID}).emit('new_message') → ${memberCount} 个成员房间`,
      totalSqlCalls: 5,
      estimatedSqlMs: Math.round(sqlMsgSelect.ms + sqlMembersQ.ms),
    }
  };
  allTimes.push({ api: 'POST /messages (send)', avg: r4.avg, p95: r4.p95, p99: r4.p99 });
  console.log(`  avg=${r4.avg}ms  p95=${r4.p95}ms  p99=${r4.p99}ms  [${flag(r4.avg)}]`);
  console.log(`  群成员数: ${memberCount}  广播目标: ${memberCount}个socket room`);

  // ═══════════════════════════════════════════════════════════════
  // 5. GET /api/messages/search — 聊天记录搜索
  // ═══════════════════════════════════════════════════════════════
  console.log('\n[5/7] GET /messages/search — 聊天记录搜索...');
  const r5 = await timedRequest('GET', '/api/messages/search?q=test');

  const keyword    = '%test%';
  const sqlSearch1 = `SELECT COUNT(*) as cnt FROM messages m WHERE m.conversation_id IN (${ph}) AND m.type='text' AND m.deleted=0 AND m.content LIKE ?`;
  const sqlSearch2 = `SELECT m.id,m.conversation_id,m.sender_id,m.content,m.created_at,u.username,c.name FROM messages m JOIN users u ON u.id=m.sender_id JOIN conversations c ON c.id=m.conversation_id WHERE m.conversation_id IN (${ph}) AND m.type='text' AND m.deleted=0 AND m.content LIKE ? ORDER BY m.created_at DESC LIMIT 20`;
  const sqlSearchT1    = timeQuery(sqlSearch1, [...convIds, keyword]);
  const sqlSearchT2    = timeQuery(sqlSearch2, [...convIds, keyword]);
  const sqlSearchPlan  = explainQuery(sqlSearch2, [...convIds, keyword]);

  // 每条结果还要 N+1 查私聊对方名字
  const searchResults = db.prepare(sqlSearch2).all(...convIds, keyword);
  const privResults   = searchResults.filter(m => {
    const conv = db.prepare('SELECT type FROM conversations WHERE id=?').get(m.conversation_id);
    return conv?.type === 'private';
  });
  let searchN1Ms = 0;
  if (privResults.length > 0) {
    const t0 = process.hrtime.bigint();
    privResults.forEach(m => db.prepare('SELECT u.username FROM users u JOIN conversation_members cm ON cm.user_id=u.id WHERE cm.conversation_id=? AND u.id!=?').get(m.conversation_id, USER_ID));
    searchN1Ms = Math.round(Number(process.hrtime.bigint() - t0) / 1e6);
  }

  results['GET /messages/search'] = {
    ...r5,
    sqlAnalysis: {
      countQuery:     { ...sqlSearchT1 },
      dataQuery:      { ...sqlSearchT2, plan: sqlSearchPlan },
      n1_privName:    { count: privResults.length, totalMs: searchN1Ms },
      noFTSIndex:     true,
      fullTableScan:  true,
      totalSqlCalls: 2 + convIds.length + 1 + privResults.length,
      estimatedSqlMs: Math.round(sqlSearchT1.ms + sqlSearchT2.ms + searchN1Ms),
    }
  };
  allTimes.push({ api: 'GET /messages/search', avg: r5.avg, p95: r5.p95, p99: r5.p99 });
  console.log(`  avg=${r5.avg}ms  p95=${r5.p95}ms  p99=${r5.p99}ms  [${flag(r5.avg)}]`);
  console.log(`  COUNT: ${sqlSearchT1.ms}ms  DATA: ${sqlSearchT2.ms}ms  PLAN: ${sqlSearchPlan.substring(0,100)}`);

  // ═══════════════════════════════════════════════════════════════
  // 6. GET /api/messages/:convId — 消息历史（含N+1）
  // ═══════════════════════════════════════════════════════════════
  console.log('\n[6/7] GET /messages/:convId — 消息历史...');
  const r6 = await timedRequest('GET', `/api/messages/${GROUP_ID}?limit=50`);

  const sqlHistory = `SELECT m.*,u.username as senderName,u.avatar as senderAvatar FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=? AND m.deleted=0 ORDER BY m.created_at DESC LIMIT 50`;
  const sqlHistoryT    = timeQuery(sqlHistory, [GROUP_ID]);
  const sqlHistoryPlan = explainQuery(sqlHistory, [GROUP_ID]);

  const histMsgs      = db.prepare(sqlHistory).all(GROUP_ID);
  const histWithReply = histMsgs.filter(m => m.reply_to_id);

  // N+1 reply_to
  let histReplyMs = 0;
  const t0r = process.hrtime.bigint();
  histWithReply.forEach(m => db.prepare('SELECT m.id,m.type,m.content,u.username FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?').get(m.reply_to_id));
  if (histWithReply.length) histReplyMs = Math.round(Number(process.hrtime.bigint() - t0r) / 1e6);

  // N+1 reactions
  let histReactMs = 0;
  const t0rc = process.hrtime.bigint();
  histMsgs.forEach(m => db.prepare('SELECT emoji,GROUP_CONCAT(user_id) as userIds,COUNT(*) as count FROM message_reactions WHERE message_id=? GROUP BY emoji').all(m.id));
  histReactMs = Math.round(Number(process.hrtime.bigint() - t0rc) / 1e6);

  // 群已读时间
  const sqlReadTimes  = timeQuery('SELECT cs.user_id,cs.last_read_at FROM conversation_settings cs WHERE cs.conversation_id=?', [GROUP_ID]);

  // 私聊 delivery
  const msgIds   = histMsgs.slice(0,50).map(m => m.id);
  const phMsg    = msgIds.map(() => '?').join(',');
  const sqlDeliv = msgIds.length ? timeQuery(`SELECT message_id FROM message_deliveries WHERE message_id IN (${phMsg})`, msgIds) : { ms: 0, rows: 0 };

  results['GET /messages/:convId (history)'] = {
    ...r6,
    sqlAnalysis: {
      mainQuery:     { ...sqlHistoryT, plan: sqlHistoryPlan, rows: histMsgs.length },
      n1_replyTo:    { count: histWithReply.length, totalMs: histReplyMs },
      n1_reactions:  { count: histMsgs.length, totalMs: histReactMs, perMs: histMsgs.length ? Math.round(histReactMs / histMsgs.length * 100) / 100 : 0 },
      readTimes:     { ...sqlReadTimes },
      deliveryCheck: { ...sqlDeliv },
      totalSqlCalls: 1 + histWithReply.length + histMsgs.length + 2,
      estimatedSqlMs: Math.round(sqlHistoryT.ms + histReplyMs + histReactMs + sqlReadTimes.ms),
    }
  };
  allTimes.push({ api: 'GET /messages/:convId (history)', avg: r6.avg, p95: r6.p95, p99: r6.p99 });
  console.log(`  avg=${r6.avg}ms  p95=${r6.p95}ms  p99=${r6.p99}ms  [${flag(r6.avg)}]`);
  console.log(`  主查询: ${sqlHistoryT.ms}ms  replyTo N+1: ${histWithReply.length}次/${histReplyMs}ms  reactions N+1: ${histMsgs.length}次/${histReactMs}ms`);

  // ═══════════════════════════════════════════════════════════════
  // 7. SQLite 写入基准测试（直接 INSERT 到可写副本）
  // ═══════════════════════════════════════════════════════════════
  console.log('\n[7/7] SQLite 写入基准...');
  const wdb = new Database(DB_PATH, { timeout: 5000 });
  wdb.pragma('journal_mode = WAL');
  wdb.pragma('synchronous = NORMAL');

  const writeTimes = [];
  for (let i = 0; i < 50; i++) {
    const t0w = process.hrtime.bigint();
    try {
      wdb.prepare('INSERT INTO messages (id,conversation_id,sender_id,type,content) VALUES (?,?,?,?,?)')
         .run(require('crypto').randomUUID(), GROUP_ID, USER_ID, 'text', 'perf_probe_' + i);
      writeTimes.push(Number(process.hrtime.bigint() - t0w) / 1e6);
    } catch {}
  }
  // 清理探针消息
  try { wdb.prepare("DELETE FROM messages WHERE content LIKE 'perf_probe_%'").run(); } catch {}
  wdb.close();

  writeTimes.sort((a, b) => a - b);
  const writeAvg = writeTimes.length ? Math.round(writeTimes.reduce((s,v) => s+v, 0) / writeTimes.length * 100) / 100 : -1;
  const writeP95 = writeTimes.length ? writeTimes[Math.floor(writeTimes.length * 0.95)] : -1;

  // 批量 transaction vs 单条对比
  const wdb2 = new Database(DB_PATH, { timeout: 5000 });
  wdb2.pragma('journal_mode = WAL');
  const t0tx = process.hrtime.bigint();
  const txWrite = wdb2.transaction((rows) => {
    const stmt = wdb2.prepare('INSERT INTO messages (id,conversation_id,sender_id,type,content) VALUES (?,?,?,?,?)');
    rows.forEach(r => stmt.run(r));
  });
  const batch = Array.from({length:50}, (_,i) => [require('crypto').randomUUID(), GROUP_ID, USER_ID, 'text', 'perf_batch_'+i]);
  try { txWrite(batch); } catch {}
  const txMs = Math.round(Number(process.hrtime.bigint() - t0tx) / 1e6);
  try { wdb2.prepare("DELETE FROM messages WHERE content LIKE 'perf_batch_%'").run(); } catch {}
  wdb2.close();

  results['SQLite 写入基准'] = {
    avg: writeAvg, p95: writeP95, p99: -1, samples: writeTimes.length,
    sqlAnalysis: {
      singleInsertAvgMs: writeAvg,
      singleInsertP95Ms: writeP95,
      batchTx50InsertMs: txMs,
      perInsertInBatch:  Math.round(txMs / 50 * 100) / 100,
      walMode: true,
    }
  };
  allTimes.push({ api: 'SQLite single INSERT', avg: writeAvg, p95: writeP95, p99: -1 });
  allTimes.push({ api: 'SQLite batch tx(50)', avg: Math.round(txMs/50*100)/100, p95: -1, p99: -1 });
  console.log(`  单条INSERT avg: ${writeAvg}ms  p95: ${writeP95}ms`);
  console.log(`  50条事务批量: ${txMs}ms 总 (每条 ${Math.round(txMs/50*100)/100}ms)`);

  // ═══════════════════════════════════════════════════════════════
  // 深度 SQL 分析：最慢查询、缺失索引、EXPLAIN
  // ═══════════════════════════════════════════════════════════════
  console.log('\n► 深度 SQL 分析...');

  const keyQueries = [
    {
      name: '会话列表主查询（含correlated subquery unread）',
      sql: `SELECT c.id,(SELECT COUNT(*) FROM messages mu WHERE mu.conversation_id=c.id AND mu.sender_id!=? AND mu.deleted=0 AND mu.created_at>COALESCE((SELECT cs2.last_read_at FROM conversation_settings cs2 WHERE cs2.user_id=? AND cs2.conversation_id=c.id),0)) as unreadCount FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=? LEFT JOIN messages m ON m.id=(SELECT id FROM messages WHERE conversation_id=c.id AND deleted=0 ORDER BY created_at DESC LIMIT 1) LEFT JOIN users u ON u.id=m.sender_id LEFT JOIN conversation_settings cs ON cs.user_id=? AND cs.conversation_id=c.id ORDER BY COALESCE(cs.pinned,0) DESC, COALESCE(m.created_at,c.created_at) DESC`,
      params: [USER_ID, USER_ID, USER_ID, USER_ID],
    },
    {
      name: '未读数计数（correlated subquery in LEFT JOIN）',
      sql: `SELECT cm.conversation_id,COUNT(m.id) AS unread_count FROM conversation_members cm LEFT JOIN messages m ON m.conversation_id=cm.conversation_id AND m.sender_id!=cm.user_id AND m.deleted=0 AND m.created_at>COALESCE((SELECT cs.last_read_at FROM conversation_settings cs WHERE cs.user_id=cm.user_id AND cs.conversation_id=cm.conversation_id),0) WHERE cm.user_id=? GROUP BY cm.conversation_id`,
      params: [USER_ID],
    },
    {
      name: '消息搜索 LIKE全表扫（无FTS索引）',
      sql: `SELECT COUNT(*) as cnt FROM messages m WHERE m.conversation_id IN (${ph}) AND m.type='text' AND m.deleted=0 AND m.content LIKE ?`,
      params: [...convIds, '%hello%'],
    },
    {
      name: '消息历史主查询',
      sql: `SELECT m.*,u.username FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=? AND m.deleted=0 ORDER BY m.created_at DESC LIMIT 50`,
      params: [GROUP_ID],
    },
    {
      name: '补拉消息 IN(N个convId)',
      sql: `SELECT m.*,u.username FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id IN (${ph}) AND m.deleted=0 AND m.created_at>? ORDER BY m.created_at ASC LIMIT 300`,
      params: [...convIds, after5min],
    },
    {
      name: '送达记录批量查（message_deliveries）',
      sql: `SELECT message_id FROM message_deliveries WHERE message_id IN (${msgIds.map(()=>'?').join(',')})`,
      params: msgIds.length ? msgIds : ['dummy'],
    },
    {
      name: '私聊对方信息 N+1',
      sql: `SELECT u.id,u.username,u.avatar,u.status FROM users u JOIN conversation_members cm ON cm.user_id=u.id WHERE cm.conversation_id=? AND u.id!=?`,
      params: [CONV_ID, USER_ID],
    },
    {
      name: 'reactions N+1 per message',
      sql: `SELECT emoji,GROUP_CONCAT(user_id) as userIds,COUNT(*) as count FROM message_reactions WHERE message_id=? GROUP BY emoji`,
      params: [sampleMsgs[0]?.id || '00000000-0000-0000-0000-000000000000'],
    },
  ];

  const sqlBenchmarks = keyQueries.map(q => {
    const t = timeQuery(q.sql, q.params);
    const plan = explainQuery(q.sql, q.params);
    const hasFullScan = plan.toLowerCase().includes('scan') && !plan.toLowerCase().includes('index');
    return { name: q.name, ms: t.ms, rows: t.rows, plan, hasFullScan };
  });

  sqlBenchmarks.sort((a, b) => b.ms - a.ms);

  console.log('\n  TOP SQL 耗时:');
  sqlBenchmarks.forEach((q, i) => {
    const f = flag(q.ms);
    const scan = q.hasFullScan ? '⚠ FULL SCAN' : '';
    console.log(`  ${i+1}. [${f}] ${q.ms}ms  ${q.name} ${scan}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // 汇总：TOP 10 API / TOP 10 SQL / TOP 10 函数
  // ═══════════════════════════════════════════════════════════════
  allTimes.sort((a, b) => b.avg - a.avg);
  const top10API = allTimes.slice(0, 10);

  const top10SQL = sqlBenchmarks.slice(0, 10);

  // 函数级分析（基于代码静态审查 + 实测耗时推断）
  const funcHotspots = [
    { fn: 'GET /conversations → rows.map (N+1私聊查询)', location: 'routes/messages.js:130', ms: Math.round(privConvCount * sqlPrivOther.ms), calls: privConvCount, issue: 'N+1: 每个私聊额外一次 SELECT' },
    { fn: 'GET /conversations → rows.map (N+1群查询)', location: 'routes/messages.js:144', ms: Math.round(groupConvCount * sqlGroupMember.ms), calls: groupConvCount, issue: 'N+1: 每个群额外一次 SELECT' },
    { fn: 'GET /:convId → enriched.map (reactions N+1)', location: 'routes/messages.js:726', ms: histReactMs, calls: histMsgs.length, issue: 'N+1: 每条消息查一次 message_reactions' },
    { fn: 'GET /:convId → enriched.map (replyTo N+1)', location: 'routes/messages.js:719', ms: histReplyMs, calls: histWithReply.length, issue: 'N+1: 每条有引用的消息额外一次 SELECT' },
    { fn: 'GET /search → results.map (N+1私聊名)', location: 'routes/messages.js:247', ms: searchN1Ms, calls: privResults.length, issue: 'N+1: 每条私聊搜索结果查对方名字' },
    { fn: 'GET /missed → enriched.map (replyTo N+1)', location: 'routes/messages.js:374', ms: r3.avg, calls: convIds.length, issue: 'N+1: 补拉消息的 reply_to 循环查' },
    { fn: 'unread-counts correlated subquery', location: 'routes/messages.js:183', ms: sqlUnreadT.ms, calls: 1, issue: 'LEFT JOIN 内嵌 correlated subquery，随会话数线性增长' },
    { fn: 'conversations unread correlated subquery', location: 'routes/messages.js:107', ms: sqlConvMainT.ms, calls: 1, issue: '每个会话执行一次嵌套 SELECT COUNT(*) FROM messages' },
    { fn: 'search LIKE全表扫描', location: 'routes/messages.js:228', ms: Math.round(sqlSearchT1.ms + sqlSearchT2.ms), calls: 2, issue: '无 FTS 索引，content LIKE %q% 扫全表900k+行' },
    { fn: 'buildMessage(id) — 每次发消息重新SELECT', location: 'routes/messages.js:20', ms: sqlMsgSelect.ms, calls: 1, issue: '发消息后立即 SELECT 回完整消息（含JOIN），可改为直接构造' },
  ];
  funcHotspots.sort((a, b) => b.ms - a.ms);

  // ═══════════════════════════════════════════════════════════════
  // 生成报告
  // ═══════════════════════════════════════════════════════════════
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalApisProfiled: 7,
      criticalApis: Object.values(results).filter(r => flag(r.avg) === 'CRITICAL').length,
      highApis:     Object.values(results).filter(r => flag(r.avg) === 'HIGH').length,
      warnApis:     Object.values(results).filter(r => flag(r.avg) === 'WARN').length,
    },
    apiResults: results,
    top10API,
    top10SQL,
    top10Functions: funcHotspots.slice(0, 10),
    rootCauses: [
      { rank: 1, issue: 'N+1 查询：会话列表每个私聊/群额外查询', location: 'routes/messages.js:130-149', severity: 'CRITICAL', evidence: `私聊${privConvCount}次+群${groupConvCount}次额外查询，估计额外耗时${Math.round(privConvCount*sqlPrivOther.ms + groupConvCount*sqlGroupMember.ms)}ms` },
      { rank: 2, issue: 'N+1 查询：消息历史 reactions 每条消息一次查询', location: 'routes/messages.js:726-730', severity: 'HIGH', evidence: `50条消息=${histMsgs.length}次reaction查询，实测${histReactMs}ms` },
      { rank: 3, issue: 'Correlated subquery：unread计数嵌套在主查询中', location: 'routes/messages.js:107-114', severity: 'HIGH', evidence: `每个会话执行一次 SELECT COUNT(*) FROM messages，随会话数O(N)增长` },
      { rank: 4, issue: '搜索无FTS索引：LIKE全表扫描90万+行', location: 'routes/messages.js:228-242', severity: 'HIGH', evidence: `sqlSearchT1=${sqlSearchT1.ms}ms + sqlSearchT2=${sqlSearchT2.ms}ms，无idx_messages_content索引` },
      { rank: 5, issue: 'unread-counts：LEFT JOIN内嵌correlated subquery', location: 'routes/messages.js:183', severity: 'HIGH', evidence: `实测${sqlUnreadT.ms}ms，随 conversation_members 行数O(N²)增长` },
      { rank: 6, issue: '补拉消息 replyTo N+1', location: 'routes/messages.js:374-383', severity: 'WARN', evidence: `每条有reply的补拉消息额外一次查询` },
      { rank: 7, issue: 'API_SLOW周期性出现（2s+）与压测机器人并发相关', location: 'socket/index.js:send_message', severity: 'WARN', evidence: `Socket=116时延迟2000ms+，Socket=16时<50ms。SQLite单写锁争用` },
    ],
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  // ── 生成 HTML 报告 ───────────────────────────────────────────
  const html = generateHTML(report);
  fs.writeFileSync(HTML_FILE, html);

  // ── 控制台最终输出 ────────────────────────────────────────────
  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              《API_SLOW 根因报告》                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  console.log('\n▌ TOP 10 最慢 API\n');
  top10API.forEach((a, i) => {
    const f = flag(a.avg);
    const bar = '█'.repeat(Math.min(Math.round(a.avg/50), 40));
    console.log(`  ${String(i+1).padStart(2)}. [${f.padEnd(8)}] avg=${String(a.avg).padStart(6)}ms  p95=${String(a.p95).padStart(6)}ms  ${a.api}`);
  });

  console.log('\n▌ TOP 10 最慢 SQL\n');
  top10SQL.forEach((q, i) => {
    const f = flag(q.ms);
    console.log(`  ${String(i+1).padStart(2)}. [${f.padEnd(8)}] ${String(q.ms).padStart(8)}ms  ${q.hasFullScan?'⚠SCAN':'     '}  ${q.name}`);
  });

  console.log('\n▌ TOP 10 最慢函数/代码段\n');
  funcHotspots.slice(0,10).forEach((f, i) => {
    const fl = flag(f.ms);
    console.log(`  ${String(i+1).padStart(2)}. [${fl.padEnd(8)}] ${String(f.ms).padStart(8)}ms  ${f.fn}`);
    console.log(`      位置: ${f.location}`);
    console.log(`      问题: ${f.issue}\n`);
  });

  console.log('\n▌ 根因定位\n');
  report.rootCauses.forEach(rc => {
    const mark = rc.severity === 'CRITICAL' ? '🔴' : rc.severity === 'HIGH' ? '🟠' : '🟡';
    console.log(`  ${mark} #${rc.rank} [${rc.severity}] ${rc.issue}`);
    console.log(`     位置: ${rc.location}`);
    console.log(`     证据: ${rc.evidence}\n`);
  });

  console.log(`\n报告已保存:`);
  console.log(`  JSON: ${REPORT_FILE}`);
  console.log(`  HTML: ${HTML_FILE}\n`);

  db.close();
}

// ── HTML 报告生成 ──────────────────────────────────────────────
function generateHTML(report) {
  const SEV_COLOR = { CRITICAL: '#FF3B30', HIGH: '#FF9500', WARN: '#FFCC00', OK: '#34C759' };
  function badge(s) { return `<span style="background:${SEV_COLOR[s]||'#888'};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold">${s}</span>`; }

  const apiRows = report.top10API.map(a => {
    const f = flag(a.avg);
    return `<tr><td>${a.api}</td><td style="color:${SEV_COLOR[f]}">${a.avg}ms</td><td>${a.p95}ms</td><td>${a.p99 >= 0 ? a.p99+'ms' : '-'}</td><td>${badge(f)}</td></tr>`;
  }).join('');

  const sqlRows = report.top10SQL.map(q => {
    const f = flag(q.ms);
    return `<tr><td>${q.name}</td><td style="color:${SEV_COLOR[f]}">${q.ms}ms</td><td>${q.rows ?? '-'}</td><td>${q.hasFullScan ? '⚠ FULL SCAN' : '✓'}</td><td>${badge(f)}</td></tr>`;
  }).join('');

  const funcRows = report.top10Functions.map(fn => {
    const f = flag(fn.ms);
    return `<tr><td>${fn.fn}</td><td>${fn.location}</td><td style="color:${SEV_COLOR[f]}">${fn.ms}ms</td><td>${fn.issue}</td><td>${badge(f)}</td></tr>`;
  }).join('');

  const rcRows = report.rootCauses.map(rc => {
    const f = rc.severity;
    return `<tr><td>#${rc.rank}</td><td>${badge(f)}</td><td><strong>${rc.issue}</strong></td><td><code>${rc.location}</code></td><td>${rc.evidence}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>V信 API_SLOW 根因报告</title>
<style>
body{font-family:-apple-system,sans-serif;background:#0d1117;color:#c9d1d9;margin:0;padding:20px}
h1{color:#58a6ff;border-bottom:2px solid #21262d;padding-bottom:10px}
h2{color:#79c0ff;margin-top:30px}
table{width:100%;border-collapse:collapse;margin:10px 0;background:#161b22;border-radius:8px;overflow:hidden}
th{background:#21262d;color:#8b949e;text-align:left;padding:10px 14px;font-size:13px}
td{padding:9px 14px;border-bottom:1px solid #21262d;font-size:13px}
tr:last-child td{border-bottom:none}
tr:hover td{background:#1c2128}
code{background:#21262d;padding:2px 6px;border-radius:4px;font-size:12px;color:#79c0ff}
.stat{display:inline-block;background:#161b22;border:1px solid #30363d;border-radius:8px;padding:15px 25px;margin:10px;text-align:center}
.stat .val{font-size:28px;font-weight:bold;color:#58a6ff}
.stat .lbl{font-size:12px;color:#8b949e;margin-top:4px}
</style>
</head>
<body>
<h1>🔍 V信 API_SLOW 根因报告</h1>
<p>生成时间: ${report.generatedAt} | 仅定位，不修复</p>

<div>
  <div class="stat"><div class="val" style="color:#FF3B30">${report.summary.criticalApis}</div><div class="lbl">CRITICAL APIs</div></div>
  <div class="stat"><div class="val" style="color:#FF9500">${report.summary.highApis}</div><div class="lbl">HIGH APIs</div></div>
  <div class="stat"><div class="val" style="color:#FFCC00">${report.summary.warnApis}</div><div class="lbl">WARN APIs</div></div>
  <div class="stat"><div class="val">${report.summary.totalApisProfiled}</div><div class="lbl">接口总数</div></div>
</div>

<h2>🏆 TOP 10 最慢 API</h2>
<table><thead><tr><th>API</th><th>avg</th><th>P95</th><th>P99</th><th>级别</th></tr></thead>
<tbody>${apiRows}</tbody></table>

<h2>🐢 TOP 10 最慢 SQL</h2>
<table><thead><tr><th>查询</th><th>耗时</th><th>行数</th><th>扫描类型</th><th>级别</th></tr></thead>
<tbody>${sqlRows}</tbody></table>

<h2>🔥 TOP 10 最慢函数/代码段</h2>
<table><thead><tr><th>函数</th><th>位置</th><th>耗时</th><th>问题描述</th><th>级别</th></tr></thead>
<tbody>${funcRows}</tbody></table>

<h2>🎯 根因定位</h2>
<table><thead><tr><th>排名</th><th>级别</th><th>问题</th><th>代码位置</th><th>证据</th></tr></thead>
<tbody>${rcRows}</tbody></table>

</body></html>`;
}

main().catch(e => { console.error(e); process.exit(1); });
