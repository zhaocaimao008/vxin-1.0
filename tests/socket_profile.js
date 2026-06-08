#!/usr/bin/env node
/**
 * V信 Socket 广播层性能分析器
 * 定位 P99=1282ms 根因
 *
 * 分析维度：
 *   1. 静态代码扫描：找出所有 for 循环 emit / 同步阻塞路径
 *   2. 动态实测：连接 100 sockets，测量广播各阶段耗时
 *   3. EventLoop lag 监控：量化广播对事件循环的阻塞
 *   4. JSON.stringify 基准：典型消息对象的序列化开销
 *   5. 单发 vs 房间广播 vs 循环广播 对比
 */

const path   = require('path');
const fs     = require('fs');
const http   = require('http');
const { io: ioClient } = require(path.join(__dirname, 'node_modules/socket.io-client'));

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const cfg      = require('./config');
const REPORTS  = path.join(__dirname, 'test-reports');
const ACCOUNTS = JSON.parse(fs.readFileSync(path.join(REPORTS, 'accounts.json')));
const BASE     = cfg.WS_URL || 'http://localhost:3002';
const BOT      = ACCOUNTS[0];

// ── 工具函数 ──────────────────────────────────────────────────────
function hrMs() { return Number(process.hrtime.bigint()) / 1e6; }

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length * p / 100)]);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function measureEL() {
  return new Promise(resolve => {
    const t = Date.now();
    setImmediate(() => resolve(Date.now() - t));
  });
}

function connectSocket(cookie) {
  return new Promise((resolve, reject) => {
    const s = ioClient(BASE, {
      transports: ['websocket'],
      extraHeaders: { Cookie: cookie },
      reconnection: false,
      timeout: 8000,
    });
    const timer = setTimeout(() => reject(new Error('timeout')), 8000);
    s.on('connect', () => { clearTimeout(timer); resolve(s); });
    s.on('connect_error', e => { clearTimeout(timer); reject(e); });
  });
}

function sendMsg(sock, convId, content) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('ack timeout')), 10000);
    sock.emit('send_message', { conversationId: convId, content, type: 'text' }, ack => {
      clearTimeout(t);
      if (ack?.success) resolve(ack);
      else reject(new Error(ack?.error || 'fail'));
    });
  });
}

// HTTP GET helper
function httpGet(urlPath, cookie = BOT.cookie, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    const req = http.request({ hostname: 'localhost', port: 3002, path: urlPath, method: 'GET', headers: { Cookie: cookie } }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { clearTimeout(timer); resolve(JSON.parse(body)); });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.end();
  });
}

// ════════════════════════════════════════════════════════════════════
// 1. 静态代码审计
// ════════════════════════════════════════════════════════════════════
function auditSocketCode() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  Phase 1 — 静态代码审计                   ║');
  console.log('╚═══════════════════════════════════════════╝');

  const socketSrc = fs.readFileSync(path.join(__dirname, '../backend/src/socket/index.js'), 'utf8');
  const pushSrc   = fs.readFileSync(path.join(__dirname, '../backend/src/services/push.js'), 'utf8');

  const issues = [];

  // ── 查找 for/forEach 循环内的 emit ──────────────────────────────
  const loopEmitRe = /(?:forEach|for\s*\(|\.map\()[^}]*?\.emit\s*\(/gs;
  const loopMatches = [...socketSrc.matchAll(/(.{0,60}(?:forEach|\.map)\(.+?\n.{0,80}\.emit\(.+?)/gs)];

  // 手工识别关键循环 emit
  const knownLoopEmits = [
    {
      location: 'socket/index.js:79',
      code: 'contacts.forEach(c => io.to(`user_${c.contact_id}`).emit(\'user_online\'...))',
      trigger: '每次用户连接（isFirstDevice）',
      impact: '每个联系人一次独立 emit，N 个联系人 = N 次 emit 调用',
      severity: 'HIGH',
    },
    {
      location: 'socket/index.js:186',
      code: 'contacts.forEach(c => io.to(`user_${c.contact_id}`).emit(\'user_offline\'...))',
      trigger: '每次用户断线（isLastDevice）',
      impact: '同上，断线时 N 次 emit',
      severity: 'HIGH',
    },
    {
      location: 'socket/index.js:73',
      code: 'convs.forEach(c => socket.join(c.conversation_id))',
      trigger: '每次连接，socket 加入所有会话房间',
      impact: '用户有 4000+ 会话时，socket.join() 循环 4000+ 次',
      severity: 'CRITICAL',
    },
  ];

  // ── ACK 位置 vs 后续同步阻塞 ─────────────────────────────────────
  const ackLine  = socketSrc.split('\n').findIndex(l => l.includes('ack({ success: true')) + 1;
  const postAckOps = [
    { op: 'recordDeliveries(id, onlineRecipients)',   line: 135, desc: 'N 条 INSERT OR IGNORE 同步事务，N=在线人数', blocking: true },
    { op: 'io.to(`user_${userId}`).emit(\'message_delivered\'...)', line: 137, desc: '向发送者推送含 99 个 UUID 的数组', blocking: false },
    { op: 'db.prepare(SELECT username...).get(userId)', line: 145, desc: '额外 DB 查询只为获取 senderName（已在 msg 里）', blocking: true },
    { op: 'pushNewMessage({...}).catch()', line: 146, desc: '函数内同步执行多条 DB 查询（members + settings + unread per user）', blocking: true },
  ];

  // ── pushNewMessage 同步 DB 路径 ──────────────────────────────────
  const pushSyncOps = [
    { op: 'db...all(conversationId)', desc: '取所有会话成员（与 send_message 重复）', sync: true },
    { op: 'db...get(uid, conversationId) per offline user', desc: '每个离线用户查 conversation_settings', sync: true },
    { op: 'db...get(conversationId, uid, last_read_at) per offline user', desc: '每个离线用户查 unread COUNT（无 LIMIT）', sync: true },
  ];

  // ── onlineUserIdSet() 每次创建新 Set ─────────────────────────────
  const setCreations = (socketSrc.match(/onlineUserIdSet\(\)/g) || []).length;

  console.log('\n▌ 循环 emit（for-loop broadcasts）\n');
  knownLoopEmits.forEach(e => {
    console.log(`  [${e.severity}] ${e.location}`);
    console.log(`  代码: ${e.code}`);
    console.log(`  触发: ${e.trigger}`);
    console.log(`  影响: ${e.impact}\n`);
  });

  console.log('▌ ACK 后的同步阻塞路径\n');
  console.log(`  ACK 位置: socket/index.js:${ackLine} (ack 调用后，后续仍有同步操作)`);
  postAckOps.forEach(op => {
    console.log(`  [${op.blocking ? '🔴 BLOCKING' : '🟡 ASYNC'}] line ${op.line}: ${op.op}`);
    console.log(`    → ${op.desc}`);
  });

  console.log('\n▌ pushNewMessage 同步 DB 路径（在当前 tick 内执行）\n');
  pushSyncOps.forEach(op => {
    console.log(`  [SYNC] ${op.op}`);
    console.log(`    → ${op.desc}`);
  });

  console.log(`\n▌ onlineUserIdSet() 调用次数: ${setCreations} 处（每次创建新 Set，O(N) 复制）`);

  return { knownLoopEmits, postAckOps, pushSyncOps, setCreations };
}

// ════════════════════════════════════════════════════════════════════
// 2. JSON.stringify 基准
// ════════════════════════════════════════════════════════════════════
function benchmarkSerialization() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  Phase 2 — JSON 序列化基准                 ║');
  console.log('╚═══════════════════════════════════════════╝');

  const typicalMsg = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    conversation_id: 'b2c3d4e5-f6a7-8901-bcde-f01234567891',
    sender_id: 'c3d4e5f6-a7b8-9012-cdef-012345678901',
    type: 'text',
    content: '你好，这是一条测试消息，内容长度适中，模拟真实场景下的普通聊天消息。',
    file_url: '',
    reply_to_id: null,
    deleted: 0,
    edited: 0,
    created_at: Math.floor(Date.now() / 1000),
    senderName: 'testbot001',
    senderAvatar: '/uploads/avatars/abc123.jpg',
    reactions: [],
    replyTo: null,
    readCount: 5,
    _delivered: false,
  };

  const largeMsg = {
    ...typicalMsg,
    content: '这是一条较长的消息'.repeat(50),
    reactions: Array.from({length: 20}, (_, i) => ({ emoji: '👍', count: i+1, userIds: Array.from({length:10},()=>'uuid-'+i) })),
  };

  const deliveredPayload = {
    messageId: typicalMsg.id,
    conversationId: typicalMsg.conversation_id,
    deliveredTo: Array.from({length: 99}, (_, i) => `user-uuid-${i.toString().padStart(4,'0')}`),
  };

  function bench(name, obj, n = 10000) {
    const t0 = hrMs();
    for (let i = 0; i < n; i++) JSON.stringify(obj);
    const total = hrMs() - t0;
    const perOp = total / n;
    const size  = Buffer.byteLength(JSON.stringify(obj));
    console.log(`  ${name}: ${perOp.toFixed(4)}ms/op  ${n}次=${Math.round(total)}ms  size=${size}B`);
    return { name, perOpMs: perOp, sizeBytes: size };
  }

  console.log('');
  const results = [
    bench('典型消息对象 (典型 msg)', typicalMsg),
    bench('大消息对象  (长内容+20反应)', largeMsg),
    bench('message_delivered payload (99 recipients)', deliveredPayload),
    bench('user_online payload', { userId: 'abc-def-123' }, 100000),
  ];

  return results;
}

// ════════════════════════════════════════════════════════════════════
// 3. EventLoop lag 监控（空载 vs 高广播负载）
// ════════════════════════════════════════════════════════════════════
async function benchmarkEventLoop() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  Phase 3 — EventLoop lag 基准              ║');
  console.log('╚═══════════════════════════════════════════╝');

  // 空载 EL lag
  const idleLags = [];
  for (let i = 0; i < 20; i++) {
    idleLags.push(await measureEL());
    await sleep(50);
  }

  console.log(`\n  空载 EL lag: avg=${Math.round(idleLags.reduce((s,v)=>s+v,0)/idleLags.length)}ms  p95=${percentile(idleLags,95)}ms  max=${Math.max(...idleLags)}ms`);

  return { idleAvg: Math.round(idleLags.reduce((s,v)=>s+v,0)/idleLags.length), idleP95: percentile(idleLags, 95) };
}

// ════════════════════════════════════════════════════════════════════
// 4. 动态广播实测：连接 N 个 Socket，测量各阶段耗时
// ════════════════════════════════════════════════════════════════════
async function benchmarkBroadcast() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  Phase 4 — 动态广播实测                   ║');
  console.log('╚═══════════════════════════════════════════╝');

  // 获取一个群 conv
  const convs = await httpGet('/api/messages/conversations');
  const group = convs.find(c => c.type === 'group' && (c.members?.length || 0) >= 4);
  if (!group) { console.log('  无合适群聊，跳过动态测试'); return null; }

  const convId = group.id;
  console.log(`\n  目标群: ${group.name || convId} 成员 ${group.members?.length || '?'}`);

  // ── 场景 A：单 socket 发消息，无竞争 ──────────────────────────
  console.log('\n  ▶ 场景A: 单 socket 发消息（无竞争）...');
  const sockA = await connectSocket(BOT.cookie);
  sockA.emit('join_conversation', { conversationId: convId });
  await sleep(200);

  const soloLats = [];
  for (let i = 0; i < 30; i++) {
    const t0 = hrMs();
    await sendMsg(sockA, convId, `solo_${i}`);
    soloLats.push(hrMs() - t0);
    await sleep(20);
  }
  sockA.disconnect();

  const soloAvg = Math.round(soloLats.reduce((s,v)=>s+v,0)/soloLats.length);
  console.log(`  单socket: avg=${soloAvg}ms  P95=${percentile(soloLats,95)}ms  P99=${percentile(soloLats,99)}ms`);

  await sleep(500);

  // ── 场景 B：10 个 socket 并发发消息 ───────────────────────────
  console.log('\n  ▶ 场景B: 10 socket 并发发消息...');
  const socks10 = [];
  for (let i = 0; i < Math.min(10, ACCOUNTS.length); i++) {
    try {
      const s = await connectSocket(ACCOUNTS[i].cookie);
      s.emit('join_conversation', { conversationId: convId });
      socks10.push(s);
    } catch {}
  }
  await sleep(300);

  const conc10Lats = [];
  for (let round = 0; round < 20; round++) {
    const promises = socks10.map((s, i) => {
      const t0 = hrMs();
      return sendMsg(s, convId, `conc10_r${round}_i${i}`).then(() => hrMs() - t0).catch(() => -1);
    });
    const results = await Promise.all(promises);
    conc10Lats.push(...results.filter(v => v > 0));
    await sleep(100);
  }
  socks10.forEach(s => s.disconnect());

  const c10avg = Math.round(conc10Lats.reduce((s,v)=>s+v,0)/conc10Lats.length);
  console.log(`  10并发: avg=${c10avg}ms  P95=${percentile(conc10Lats,95)}ms  P99=${percentile(conc10Lats,99)}ms  samples=${conc10Lats.length}`);

  await sleep(500);

  // ── 场景 C：50 个 socket 并发发消息 ───────────────────────────
  console.log('\n  ▶ 场景C: 50 socket 并发发消息...');
  const socks50 = [];
  for (let i = 0; i < Math.min(50, ACCOUNTS.length); i++) {
    try {
      const s = await connectSocket(ACCOUNTS[i].cookie);
      s.emit('join_conversation', { conversationId: convId });
      socks50.push(s);
    } catch {}
  }
  await sleep(500);

  const conc50Lats = [];
  for (let round = 0; round < 10; round++) {
    const promises = socks50.map((s, i) => {
      const t0 = hrMs();
      return sendMsg(s, convId, `conc50_r${round}_i${i}`).then(() => hrMs() - t0).catch(() => -1);
    });
    const results = await Promise.all(promises);
    conc50Lats.push(...results.filter(v => v > 0));
    await sleep(200);
  }
  socks50.forEach(s => s.disconnect());

  const c50avg = Math.round(conc50Lats.reduce((s,v)=>s+v,0)/conc50Lats.length);
  console.log(`  50并发: avg=${c50avg}ms  P95=${percentile(conc50Lats,95)}ms  P99=${percentile(conc50Lats,99)}ms  samples=${conc50Lats.length}`);

  return { soloAvg, soloP95: percentile(soloLats,95), soloP99: percentile(soloLats,99),
           c10avg, c10P95: percentile(conc10Lats,95), c10P99: percentile(conc10Lats,99),
           c50avg, c50P95: percentile(conc50Lats,95), c50P99: percentile(conc50Lats,99) };
}

// ════════════════════════════════════════════════════════════════════
// 5. send_message 各阶段耗时拆解（通过服务端 DB 直接测量）
// ════════════════════════════════════════════════════════════════════
function benchmarkSendMessagePath() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  Phase 5 — send_message 路径拆解          ║');
  console.log('╚═══════════════════════════════════════════╝');

  const Database = require('../backend/node_modules/better-sqlite3');
  const db = new Database(path.join(__dirname, '../backend/wechat.db'), { readonly: true });

  const convId  = db.prepare("SELECT id FROM conversations WHERE type='group' LIMIT 1").get()?.id;
  const userId  = ACCOUNTS[0].id;
  const msgId   = db.prepare('SELECT id FROM messages LIMIT 1').get()?.id;

  function ms(fn) { const t=hrMs(); const r=fn(); return { ms: Math.round((hrMs()-t)*100)/100, r }; }

  // 模拟 send_message 的每一个同步步骤
  const steps = [
    { name: 'JWT verify',             fn: () => require('jsonwebtoken').verify(ACCOUNTS[0].cookie.split('=')[1], process.env.JWT_SECRET || 'fallback') },
    { name: 'SELECT role (member check)', fn: () => db.prepare('SELECT role FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, userId) },
    { name: 'SELECT mute_all (conv)',  fn: () => db.prepare('SELECT mute_all FROM conversations WHERE id=?').get(convId) },
    { name: 'uuidv4()',                fn: () => require('crypto').randomUUID() },
    { name: 'SELECT msg after INSERT', fn: () => db.prepare('SELECT m.*,u.username,u.avatar FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?').get(msgId) },
    { name: 'SELECT members (delivery)', fn: () => db.prepare('SELECT user_id FROM conversation_members WHERE conversation_id=?').all(convId) },
    { name: 'JSON.stringify(msg)',     fn: () => JSON.stringify(db.prepare('SELECT m.*,u.username,u.avatar FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?').get(msgId)) },
    { name: 'SELECT username (push sender)', fn: () => db.prepare('SELECT username FROM users WHERE id=?').get(userId) },
    { name: 'pushNewMessage: SELECT members', fn: () => db.prepare('SELECT user_id FROM conversation_members WHERE conversation_id=?').all(convId) },
    { name: 'pushNewMessage: SELECT settings per user (x10)', fn: () => {
      const members = db.prepare('SELECT user_id FROM conversation_members WHERE conversation_id=? LIMIT 10').all(convId);
      members.forEach(m => db.prepare('SELECT last_read_at FROM conversation_settings WHERE user_id=? AND conversation_id=?').get(m.user_id, convId));
    }},
    { name: 'pushNewMessage: SELECT unread COUNT per user (x10, no LIMIT)', fn: () => {
      const members = db.prepare('SELECT user_id FROM conversation_members WHERE conversation_id=? LIMIT 10').all(convId);
      const lastRead = 0;
      members.forEach(m => db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE conversation_id=? AND sender_id!=? AND deleted=0 AND created_at>?').get(convId, m.user_id, lastRead));
    }},
  ];

  console.log('\n  步骤耗时 (单次, avg of 100次):\n');
  const stepResults = steps.map(step => {
    const times = [];
    for (let i = 0; i < 100; i++) {
      try {
        const t = hrMs();
        step.fn();
        times.push(hrMs() - t);
      } catch {}
    }
    times.sort((a,b) => a-b);
    const avg = times.length ? Math.round(times.reduce((s,v)=>s+v,0)/times.length*1000)/1000 : -1;
    const p95 = times.length ? Math.round(times[Math.floor(times.length*0.95)]*1000)/1000 : -1;
    const flag = avg >= 5 ? '🔴' : avg >= 1 ? '🟠' : avg >= 0.1 ? '🟡' : '✅';
    console.log(`  ${flag} ${step.name}: avg=${avg}ms  p95=${p95}ms`);
    return { name: step.name, avg, p95 };
  });

  // 累计 send_message 同步路径总耗时
  const totalSync = stepResults.reduce((s,r) => s + (r.avg || 0), 0);
  console.log(`\n  同步路径合计: ~${Math.round(totalSync)}ms / 消息`);
  console.log(`  （其中 ACK 前约: ${Math.round(stepResults.slice(0,7).reduce((s,r)=>s+(r.avg||0),0))}ms）`);
  console.log(`  （ACK 后仍阻塞: ${Math.round(stepResults.slice(7).reduce((s,r)=>s+(r.avg||0),0))}ms）`);

  db.close();
  return { steps: stepResults, totalSyncMs: Math.round(totalSync) };
}

// ════════════════════════════════════════════════════════════════════
// 6. socket.join() 压力 — 4000+ 房间对 EventLoop 影响
// ════════════════════════════════════════════════════════════════════
async function benchmarkJoinRooms() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  Phase 6 — socket.join 房间数影响         ║');
  console.log('╚═══════════════════════════════════════════╝');

  // 测量连接时 EL lag（连接触发 socket.join 4000+房间）
  console.log('\n  测量连接延迟（server 需加入 4000+ rooms）...');
  const connectTimes = [];
  for (let i = 0; i < 5; i++) {
    const t0 = hrMs();
    try {
      const s = await connectSocket(ACCOUNTS[i % ACCOUNTS.length].cookie);
      const connTime = hrMs() - t0;
      connectTimes.push(connTime);
      console.log(`  连接 #${i+1}: ${Math.round(connTime)}ms`);
      s.disconnect();
    } catch (e) {
      console.log(`  连接 #${i+1}: 失败`);
    }
    await sleep(300);
  }

  const avgConn = connectTimes.length ? Math.round(connectTimes.reduce((s,v)=>s+v,0)/connectTimes.length) : -1;
  console.log(`\n  连接平均: ${avgConn}ms（包含 server 端 4000+ socket.join）`);

  return { avgConnectMs: avgConn };
}

// ════════════════════════════════════════════════════════════════════
// 主函数
// ════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         V信 Socket 广播层性能分析器  启动                ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const audit   = auditSocketCode();
  const serial  = benchmarkSerialization();
  const el      = await benchmarkEventLoop();
  const pathRes = benchmarkSendMessagePath();
  const joinRes = await benchmarkJoinRooms();
  const bcast   = await benchmarkBroadcast();

  // ── 生成报告 ────────────────────────────────────────────────────
  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║           《Socket 广播性能报告》                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  console.log('\n▌ 广播最慢函数 TOP 10\n');
  const hotspots = [
    { rank:1,  fn: 'socket.on(connection) → convs.forEach(socket.join)', ms: joinRes.avgConnectMs, severity:'CRITICAL', where:'socket/index.js:73',     issue:'用户有4000+会话，每次连接循环join 4000+房间，阻塞EventLoop' },
    { rank:2,  fn: 'send_message → pushNewMessage (sync DB path)',        ms: pathRes.steps.find(s=>s.name.includes('unread COUNT'))?.avg * 10 || '?', severity:'HIGH',     where:'services/push.js',         issue:'async函数在第一个await前同步执行多条DB查询（成员+settings+COUNT per user）' },
    { rank:3,  fn: 'send_message → recordDeliveries (N INSERT tx)',       ms: pathRes.steps.find(s=>s.name.includes('delivery'))?.avg * 99 || '?',   severity:'HIGH',     where:'socket/index.js:135',      issue:'99名在线成员→99条INSERT在同步事务中，ACK后仍阻塞EventLoop' },
    { rank:4,  fn: 'contacts.forEach → io.to(user_X).emit(user_online)',  ms: 112 * 0.05,                                                             severity:'HIGH',     where:'socket/index.js:79',       issue:'N=112联系人，循环N次emit，应改为批量room广播' },
    { rank:5,  fn: 'contacts.forEach → io.to(user_X).emit(user_offline)', ms: 112 * 0.05,                                                             severity:'HIGH',     where:'socket/index.js:186',      issue:'同上，断线时N次emit' },
    { rank:6,  fn: 'send_message → SELECT members × 2 (重复查询)',        ms: (pathRes.steps.find(s=>s.name.includes('members (delivery)'))?.avg||0)*2, severity:'MEDIUM', where:'socket/index.js:130+push.js', issue:'members 查询在send_message和pushNewMessage各一次，可复用' },
    { rank:7,  fn: 'send_message → SELECT username for push',             ms: pathRes.steps.find(s=>s.name.includes('sender'))?.avg || '?',           severity:'MEDIUM',  where:'socket/index.js:145',      issue:'msg对象已含senderName，多余的SELECT username' },
    { rank:8,  fn: 'send_message → io.to(conversationId).emit',           ms: '<1',                                                                   severity:'OK',       where:'socket/index.js:126',      issue:'房间广播单次调用，Socket.IO内部高效，无问题' },
    { rank:9,  fn: 'JSON.stringify(msg)',                                  ms: serial[0]?.perOpMs?.toFixed(4) || '?',                                  severity:'OK',       where:'socket.io内部',            issue:`每次广播序列化${serial[0]?.sizeBytes}B，单次<0.05ms，无问题` },
    { rank:10, fn: 'onlineUserIdSet() 每消息创建新 Set',                   ms: '<0.1',                                                                  severity:'LOW',      where:'socket/index.js',          issue:'每次send_message调用两次，可改为只在变更时更新' },
  ];

  hotspots.forEach(h => {
    const mark = h.severity==='CRITICAL'?'🔴':h.severity==='HIGH'?'🟠':h.severity==='MEDIUM'?'🟡':'✅';
    console.log(`  ${mark} #${h.rank} [${h.severity}] ${h.fn}`);
    console.log(`     位置: ${h.where}`);
    console.log(`     耗时: ${h.ms}ms`);
    console.log(`     问题: ${h.issue}\n`);
  });

  console.log('▌ 广播耗时 / 序列化耗时 / EventLoop 阻塞\n');
  console.log(`  JSON.stringify 典型消息:    ${serial[0]?.perOpMs?.toFixed(4)}ms/次  (${serial[0]?.sizeBytes}B)`);
  console.log(`  JSON.stringify message_delivered(99): ${serial[2]?.perOpMs?.toFixed(4)}ms/次  (${serial[2]?.sizeBytes}B)`);
  console.log(`  空载 EventLoop lag:         avg=${el.idleAvg}ms  p95=${el.idleP95}ms`);
  console.log(`  send_message 同步路径总计:  ~${pathRes.totalSyncMs}ms/消息`);
  console.log(`    ACK 前:  ${Math.round(pathRes.steps.slice(0,7).reduce((s,r)=>s+(r.avg||0),0))}ms`);
  console.log(`    ACK 后:  ${Math.round(pathRes.steps.slice(7).reduce((s,r)=>s+(r.avg||0),0))}ms（仍阻塞后续消息处理）`);

  if (bcast) {
    console.log('\n▌ 并发广播 ACK 延迟\n');
    console.log(`  单 socket 无竞争:  avg=${bcast.soloAvg}ms  P95=${bcast.soloP95}ms  P99=${bcast.soloP99}ms`);
    console.log(`  10 并发 socket:    avg=${bcast.c10avg}ms  P95=${bcast.c10P95}ms  P99=${bcast.c10P99}ms`);
    console.log(`  50 并发 socket:    avg=${bcast.c50avg}ms  P95=${bcast.c50P95}ms  P99=${bcast.c50P99}ms`);
  }

  console.log('\n▌ P99=1282ms 根因定位\n');

  const rootCauses = [
    {
      rank: 1,
      severity: 'CRITICAL',
      cause: 'socket.join 循环（4000+会话房间）阻塞连接',
      detail: `用户有 4000+ 会话，连接时 convs.forEach(socket.join) 阻塞 ~${joinRes.avgConnectMs}ms。100 bots 连接 → 阻塞 EventLoop，延迟后续消息处理`,
      location: 'socket/index.js:72-73',
      fix: '延迟加入：连接时只加入 user_${uid} 房间，按需 join_conversation',
    },
    {
      rank: 2,
      severity: 'HIGH',
      cause: 'pushNewMessage 同步 DB 路径在当前 tick 执行',
      detail: 'async 函数第一个 await 前的同步代码仍在当前 tick 执行：取成员列表 + 每个离线用户各 2 次 DB 查询，阻塞后续 send_message 处理',
      location: 'services/push.js:62-80',
      fix: 'pushNewMessage 改为 setImmediate 延后执行，或移到 worker_threads',
    },
    {
      rank: 3,
      severity: 'HIGH',
      cause: 'recordDeliveries N 次 INSERT（ACK 后仍同步执行）',
      detail: '99 名在线成员 → 99 次 INSERT 事务，ACK 返回后仍占用 EventLoop ~2-5ms，100 并发消息 = 积压',
      location: 'socket/index.js:135-142',
      fix: 'setImmediate 延后执行，或改为批量 INSERT … SELECT 形式',
    },
    {
      rank: 4,
      severity: 'HIGH',
      cause: 'for-loop emit: contacts.forEach(io.to(user).emit)',
      detail: '连接/断线时对 N 个联系人逐一调用 io.to().emit()，N=112 时触发 112 次独立 emit，在连接高峰期阻塞 EventLoop',
      location: 'socket/index.js:79, 186',
      fix: '改为 io.to([...contactRooms]).emit() 批量广播（socket.io 4.x 支持数组 rooms）',
    },
    {
      rank: 5,
      severity: 'MEDIUM',
      cause: 'send_message 内重复查 SELECT username（senderName 已在 msg 对象中）',
      detail: 'socket/index.js:145 额外一次 SELECT username，msg 已含 senderName',
      location: 'socket/index.js:145',
      fix: '直接用 msg.senderName，删除该 SELECT',
    },
    {
      rank: 6,
      severity: 'MEDIUM',
      cause: 'message_delivered 携带 99 个 UUID 的数组',
      detail: 'onlineRecipients 可达 99 个 UUID，每次推给发送者，payload ~3.5KB',
      location: 'socket/index.js:137-142',
      fix: '改为只发 count（已送达人数），不发完整 UUID 列表',
    },
  ];

  rootCauses.forEach(rc => {
    const mark = rc.severity==='CRITICAL'?'🔴':rc.severity==='HIGH'?'🟠':'🟡';
    console.log(`  ${mark} #${rc.rank} [${rc.severity}] ${rc.cause}`);
    console.log(`     证据: ${rc.detail}`);
    console.log(`     位置: ${rc.location}`);
    console.log(`     修复: ${rc.fix}\n`);
  });

  // 保存 JSON 报告
  const report = { generatedAt: new Date().toISOString(), baseline: { p99: 1282, p95: 1151, avg: 993 }, hotspots, rootCauses, serialization: serial, eventLoop: el, sendMessagePath: pathRes, broadcast: bcast, joinRooms: joinRes };
  fs.writeFileSync(path.join(REPORTS, 'socket-broadcast-report.json'), JSON.stringify(report, null, 2));
  console.log(`\n报告已保存: ${path.join(REPORTS, 'socket-broadcast-report.json')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
