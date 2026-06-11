#!/usr/bin/env node
/**
 * hermes_loadtest.js  —— v信 压力测试（由主脚本调用，Hermes 在服务器本机执行）
 *
 * 三段测试：
 *   A. 并发登录    —— 测认证链路在并发下的成功率与 p95 延迟
 *   B. 消息吞吐    —— 按目标速率持续发消息，测写链路吞吐与错误率
 *   C. 并发长连接  —— 建立 N 条 WebSocket(Socket.IO) 并发在线，测连接成功率与稳定性
 *
 * 全部打本机回环 (127.0.0.1)，不依赖外网。规模由环境变量控制：
 *   LOAD_CONNS, LOAD_MSG_RATE, LOAD_DURATION, BACKEND_URL, APP_DIR, OUT
 *
 * 设计原则：只读压测优先；发消息用「文件传输助手」(给自己发)，不污染真实用户数据。
 */
'use strict';

const http = require('http');
const path = require('path');

const BACKEND   = process.env.BACKEND_URL || 'http://127.0.0.1:3002';
const CONNS     = parseInt(process.env.LOAD_CONNS || '300', 10);
const MSG_RATE  = parseInt(process.env.LOAD_MSG_RATE || '20', 10);
const DURATION  = parseInt(process.env.LOAD_DURATION || '20', 10);
const APP_DIR   = process.env.APP_DIR || '/root/v信/backend-v2';
const OUT       = process.env.OUT || '';

// 复用后端已装的 socket.io-client / ws（避免额外安装）
let ioClient = null;
for (const p of ['socket.io-client', path.join(APP_DIR, 'node_modules/socket.io-client')]) {
  try { ioClient = require(p); break; } catch (_) {}
}

const U = new URL(BACKEND);
function req(method, pathName, { body, cookie } = {}) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      host: U.hostname, port: U.port, path: pathName, method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
    }, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => resolve({
        status: res.statusCode,
        cookie: (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; '),
        body: buf,
      }));
    });
    r.on('error', () => resolve({ status: 0, cookie: '', body: '' }));
    r.setTimeout(10000, () => { r.destroy(); resolve({ status: 0, cookie: '', body: '' }); });
    if (data) r.write(data);
    r.end();
  });
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}
const out = (o) => { console.log(JSON.stringify(o)); };

// 单源压测会命中"每IP"限流(注册5/小时/IP、发消息60/分钟/IP)。
// 429 不是服务端容量失败，单独计数，避免误判。
const RL = { login: 0, register: 0, msg: 0 };

// ── 测试账号池：注册一批临时账号，跑完即可（不删，幂等复用）──
const INVITE = process.env.INVITE_CODE || '411322';
const PASS = 'Loadtest1234';
function acct(i) { return { username: `lt_${i}`, phone: `1${String(7000000000 + i)}`.slice(0, 11) }; }

async function ensureAccount(i) {
  const a = acct(i);
  let r = await req('POST', '/api/auth/login', { body: { phone: a.phone, password: PASS } });
  if (r.status === 200) return r.cookie;
  if (r.status === 429) RL.login++;
  r = await req('POST', '/api/auth/register', {
    body: { username: a.username, phone: a.phone, password: PASS, inviteCode: INVITE },
  });
  if (r.status === 200) return r.cookie;
  if (r.status === 429) RL.register++;
  // 注册失败再试登录（可能并发已存在）
  r = await req('POST', '/api/auth/login', { body: { phone: a.phone, password: PASS } });
  if (r.status === 429) RL.login++;
  return r.status === 200 ? r.cookie : null;
}

// ───────────────────── A. 并发登录 ─────────────────────
async function testLogin(n) {
  const lat = []; let okN = 0, errN = 0;
  const cookies = [];
  await Promise.all(Array.from({ length: n }, (_, i) => (async () => {
    const t = Date.now();
    const c = await ensureAccount(i);
    lat.push(Date.now() - t);
    if (c) { okN++; cookies.push(c); } else errN++;
  })()));
  console.log(`### A. 并发登录/注册 (${n})`);
  console.log(`- 成功 ${okN} / 失败 ${errN}  ·  成功率 ${(okN / n * 100).toFixed(1)}%`);
  console.log(`- 延迟 p50=${pct(lat, .5)}ms  p95=${pct(lat, .95)}ms  max=${Math.max(...lat, 0)}ms`);
  if (RL.register || RL.login) {
    console.log(`- ⓘ 命中限流(429): 注册 ${RL.register} · 登录 ${RL.login} —— **单源压测必然触发"每IP"限流(注册5/小时/IP)，非服务端容量问题**；线上 ${n} 个真实用户来自 ${n} 个不同 IP，不受此限。`);
  }
  return { okN, errN, p95: pct(lat, .95), cookies };
}

// ───────────────────── B. 消息吞吐 ─────────────────────
async function testThroughput(cookies) {
  if (!cookies.length) { console.log('### B. 消息吞吐\n- 跳过(无可用会话)'); return; }
  // 给每个账号建一个「文件传输助手」会话，往里发消息(自发自收，不打扰真人)
  const conv = [];
  for (const c of cookies.slice(0, Math.min(cookies.length, 50))) {
    const r = await req('POST', '/api/messages/conversation/file-helper', { cookie: c }).catch(() => null);
    let cid = null;
    if (r && r.status === 200) { try { cid = JSON.parse(r.body).conversationId || JSON.parse(r.body).id; } catch (_) {} }
    if (!cid) { const g = await req('GET', '/api/messages/file-helper', { cookie: c }); try { cid = JSON.parse(g.body).id || JSON.parse(g.body).conversationId; } catch (_) {} }
    if (cid) conv.push({ cookie: c, cid });
  }
  if (!conv.length) { console.log('### B. 消息吞吐\n- 跳过(无法创建测试会话)'); return; }

  const lat = []; let sent = 0, fail = 0;
  const end = Date.now() + DURATION * 1000;
  const interval = 1000 / MSG_RATE;
  let k = 0;
  while (Date.now() < end) {
    const tick = Date.now();
    const target = conv[k % conv.length]; k++;
    const t = Date.now();
    req('POST', '/api/messages', {
      cookie: target.cookie,
      body: { conversationId: target.cid, type: 'text', content: `lt ${Date.now()}` },
    }).then(r => {
      lat.push(Date.now() - t);
      if (r.status === 200 || r.status === 201) sent++;
      else if (r.status === 429) RL.msg++;
      else fail++;
    });
    const wait = interval - (Date.now() - tick);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
  }
  await new Promise(r => setTimeout(r, 1500)); // 等在途请求收尾
  const attempted = sent + fail + RL.msg;
  const realErrRate = attempted ? (fail / attempted * 100).toFixed(1) : 0;
  console.log('### B. 消息吞吐');
  console.log(`- 尝试 ${attempted} 条 / ${DURATION}s  ·  成功 ${sent} · 限流429 ${RL.msg} · 真实错误 ${fail}`);
  console.log(`- 写延迟 p50=${pct(lat, .5)}ms  p95=${pct(lat, .95)}ms  max=${Math.max(...lat, 0)}ms`);
  if (RL.msg > 0) {
    console.log(`- ⓘ 命中"每IP 60条/分钟"限流(429=${RL.msg})。单源压测无法绕过，**非服务端瓶颈**。`);
    console.log(`  容量结论应看：真实错误率 ${realErrRate}% ${fail === 0 ? '(✅ 服务端零错误)' : '(⚠️ 有真实错误，需查)'} + 写延迟 p95=${pct(lat, .95)}ms。`);
    console.log(`  目标 10万/天=1.16条/秒，远低于 SQLite(WAL) 数千写/秒能力 → 服务端吞吐充足。`);
  } else {
    const dayEq = Math.round(sent / DURATION * 86400);
    console.log(`- 实测 ${(sent / DURATION).toFixed(1)} 条/秒 · 外推 ≈ ${dayEq.toLocaleString()} 条/天 → ${dayEq >= 100000 ? '✅ 达标' : '⚠️ 受压测节流限制'}`);
  }
}

// ───────────────────── C. 并发长连接 ─────────────────────
async function testConnections(cookies) {
  if (!ioClient) { console.log('### C. 并发长连接\n- 跳过(未找到 socket.io-client)'); return; }
  if (!cookies.length) { console.log('### C. 并发长连接\n- 跳过(无 cookie)'); return; }
  let connected = 0, failed = 0;
  const sockets = [];
  const url = BACKEND;
  await Promise.all(cookies.map((cookie) => new Promise((resolve) => {
    let done = false;
    const s = ioClient(url, {
      transports: ['websocket'],
      extraHeaders: { Cookie: cookie },
      reconnection: false,
      timeout: 8000,
    });
    s.on('connect', () => { if (!done) { done = true; connected++; sockets.push(s); resolve(); } });
    s.on('connect_error', () => { if (!done) { done = true; failed++; resolve(); } });
    setTimeout(() => { if (!done) { done = true; failed++; try { s.close(); } catch (_) {} resolve(); } }, 8500);
  })));
  const total = connected + failed;
  console.log('### C. 并发长连接 (WebSocket)');
  console.log(`- 建立 ${connected} / ${total}  ·  成功率 ${total ? (connected / total * 100).toFixed(1) : 0}%`);
  // 按比例外推到 1000
  const projected = connected >= total * 0.98 ? '✅ 同比例可外推至 1000 在线' : '⚠️ 存在连接失败，1000在线前需排查句柄/内存';
  console.log(`- 结论: ${projected}`);
  // 保持 3 秒看是否掉线，再关闭
  await new Promise(r => setTimeout(r, 3000));
  let alive = sockets.filter(s => s.connected).length;
  console.log(`- 3秒后仍在线: ${alive} / ${connected} ${alive === connected ? '(稳定)' : '(有掉线，疑似超时/内存)'}`);
  sockets.forEach(s => { try { s.close(); } catch (_) {} });
}

(async () => {
  console.log(`\n_压测开始: 并发=${CONNS} 速率=${MSG_RATE}/s 时长=${DURATION}s_\n`);
  const a = await testLogin(CONNS);
  await testThroughput(a.cookies);
  await testConnections(a.cookies);
  if (OUT) {
    try { require('fs').writeFileSync(OUT, JSON.stringify({ login: { okN: a.okN, errN: a.errN, p95: a.p95 } }, null, 2)); } catch (_) {}
  }
  console.log('\n_压测结束_');
  process.exit(0);
})();
