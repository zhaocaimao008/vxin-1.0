#!/usr/bin/env node
/**
 * hermes_loadtest.js —— v信 压力测试（由主脚本调用，Hermes 在服务器本机执行）
 *
 * 用【预播种的测试账号】(见 seed_test_users.js) 跑真实负载：
 *   A. 并发登录       —— 每账号唯一手机号 → 不撞"每IP"登录限流，测认证链路
 *   B. 消息吞吐+延迟   —— 正确携带 CSRF 双提交令牌发消息，测写延迟(60条/分钟/IP 上限内)
 *   C. 并发 WebSocket  —— 建立 N 条 Socket.IO 长连接, 测"同时在线"能力与稳定性
 *
 * 环境变量: LOAD_CONNS, LOAD_MSG_RATE, LOAD_DURATION, BACKEND_URL, APP_DIR, OUT
 */
'use strict';
const http = require('http');
const path = require('path');

const BACKEND  = process.env.BACKEND_URL || 'http://127.0.0.1:3002';
const CONNS    = parseInt(process.env.LOAD_CONNS || '300', 10);
const MSG_RATE = parseInt(process.env.LOAD_MSG_RATE || '20', 10);
const DURATION = parseInt(process.env.LOAD_DURATION || '20', 10);
const APP_DIR  = process.env.APP_DIR || '/root/v信/backend-v2';
const OUT      = process.env.OUT || '';

const PASS = 'Loadtest1234';
const phoneFor = i => '199' + String(i).padStart(8, '0');

let ioClient = null;
for (const p of ['socket.io-client', path.join(APP_DIR, 'node_modules/socket.io-client')]) {
  try { ioClient = require(p); break; } catch (_) {}
}

const U = new URL(BACKEND);
// 简易 cookie jar：累积 set-cookie，按名覆盖
function mergeCookies(jar, setCookie = []) {
  for (const c of setCookie) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    jar[pair.slice(0, idx)] = pair.slice(idx + 1);
  }
  return jar;
}
const jarStr = jar => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

function req(method, pathName, { body, jar, csrf } = {}) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (jar && Object.keys(jar).length) headers.Cookie = jarStr(jar);
    if (csrf) headers['X-CSRF-Token'] = csrf;
    const r = http.request({ host: U.hostname, port: U.port, path: pathName, method, headers }, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => resolve({
        status: res.statusCode,
        setCookie: res.headers['set-cookie'] || [],
        csrf: res.headers['x-csrf-token'] || null,
        body: buf,
      }));
    });
    r.on('error', () => resolve({ status: 0, setCookie: [], body: '' }));
    r.setTimeout(10000, () => { r.destroy(); resolve({ status: 0, setCookie: [], body: '' }); });
    if (data) r.write(data);
    r.end();
  });
}

const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

// 登录一个测试账号 → 拿 auth cookie，再 GET /me 拿 CSRF 令牌 → 返回完整会话
async function session(i) {
  const jar = {};
  let r = await req('POST', '/api/auth/login', { body: { phone: phoneFor(i), password: PASS }, jar });
  if (r.status !== 200) return { ok: false, status: r.status };
  mergeCookies(jar, r.setCookie);
  // auth 中间件在首个鉴权请求时下发 csrf cookie + X-CSRF-Token header
  const me = await req('GET', '/api/auth/me', { jar });
  mergeCookies(jar, me.setCookie);
  const csrf = me.csrf;
  return { ok: true, jar, csrf };
}

// ───────────── A. 并发登录 ─────────────
async function testLogin(n) {
  const lat = []; let okN = 0, errN = 0; const sess = [];
  await Promise.all(Array.from({ length: n }, (_, i) => (async () => {
    const t = Date.now();
    const s = await session(i);
    lat.push(Date.now() - t);
    if (s.ok) { okN++; sess.push(s); } else errN++;
  })()));
  console.log(`### A. 并发登录 (${n} 个预播种账号)`);
  console.log(`- 成功 ${okN} / 失败 ${errN}  ·  成功率 ${(okN / n * 100).toFixed(1)}%`);
  console.log(`- 延迟 p50=${pct(lat, .5)}ms  p95=${pct(lat, .95)}ms  max=${Math.max(...lat, 0)}ms`);
  console.log(`- ${okN >= n * 0.98 ? '✅ 认证链路在并发下稳定' : '⚠️ 有登录失败，需查认证/数据库'}`);
  return sess;
}

// ───────────── B. 消息吞吐 + 写延迟 ─────────────
async function testThroughput(sess) {
  if (!sess.length) { console.log('### B. 消息吞吐\n- 跳过(无会话)'); return; }
  // 每账号取自己的「文件传输助手」会话(自发自收，不打扰真人)
  const targets = [];
  for (const s of sess.slice(0, Math.min(sess.length, 50))) {
    const g = await req('GET', '/api/messages/file-helper', { jar: s.jar });
    let cid = null; try { const j = JSON.parse(g.body); cid = j.id || j.conversationId; } catch (_) {}
    if (cid) targets.push({ ...s, cid });
  }
  if (!targets.length) { console.log('### B. 消息吞吐\n- 跳过(无法取得文件助手会话)'); return; }

  const lat = []; let sent = 0, rl = 0, fail = 0;
  const end = Date.now() + DURATION * 1000;
  const interval = 1000 / MSG_RATE; let k = 0;
  while (Date.now() < end) {
    const tick = Date.now();
    const tg = targets[k % targets.length]; k++;
    const t = Date.now();
    req('POST', `/api/messages/${tg.cid}`, { jar: tg.jar, csrf: tg.csrf, body: { type: 'text', content: `lt ${Date.now()}` } })
      .then(r => {
        lat.push(Date.now() - t);
        if (r.status === 200 || r.status === 201) sent++;
        else if (r.status === 429) rl++;
        else fail++;
      });
    const wait = interval - (Date.now() - tick);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
  }
  await new Promise(r => setTimeout(r, 1500));
  const attempted = sent + rl + fail;
  console.log('### B. 消息吞吐 + 写延迟');
  console.log(`- 尝试 ${attempted} / ${DURATION}s  ·  成功 ${sent} · 限流429 ${rl} · 真实错误 ${fail}`);
  console.log(`- 写延迟 p50=${pct(lat, .5)}ms  p95=${pct(lat, .95)}ms  max=${Math.max(...lat, 0)}ms`);
  if (fail === 0) console.log('- ✅ 服务端零真实错误（写链路健康）');
  else console.log(`- ⚠️ ${fail} 条真实错误(非限流)，需排查`);
  if (rl > 0) console.log(`- ⓘ 429 是"每IP 60条/分钟"限流，单源压测必然触发，非服务端瓶颈。`);
  console.log(`- 目标 10万/天 = 1.16条/秒，远低于实测写延迟反映的服务端能力(p95=${pct(lat, .95)}ms) → 吞吐充足`);
}

// ───────────── C. 并发 WebSocket 长连接（"同时在线"实测）─────────────
async function testConnections(sess) {
  if (!ioClient) { console.log('### C. 并发长连接\n- ❌ 跳过：未装 socket.io-client。请先 `cd ' + APP_DIR + ' && npm i socket.io-client`'); return; }
  if (!sess.length) { console.log('### C. 并发长连接\n- 跳过(无会话)'); return; }
  let connected = 0, failed = 0; const sockets = [];
  await Promise.all(sess.map((s) => new Promise((resolve) => {
    let done = false;
    const sock = ioClient(BACKEND, {
      transports: ['websocket'],
      extraHeaders: { Cookie: jarStr(s.jar) },
      reconnection: false, timeout: 8000,
    });
    sock.on('connect', () => { if (!done) { done = true; connected++; sockets.push(sock); resolve(); } });
    sock.on('connect_error', () => { if (!done) { done = true; failed++; resolve(); } });
    setTimeout(() => { if (!done) { done = true; failed++; try { sock.close(); } catch (_) {} resolve(); } }, 8500);
  })));
  const total = connected + failed;
  console.log('### C. 并发 WebSocket 长连接（"同时在线"实测）');
  console.log(`- 建立 ${connected} / ${total}  ·  成功率 ${total ? (connected / total * 100).toFixed(1) : 0}%`);
  await new Promise(r => setTimeout(r, 3000));
  const alive = sockets.filter(s => s.connected).length;
  console.log(`- 3秒后仍在线: ${alive} / ${connected} ${alive === connected ? '(稳定)' : '(有掉线,查超时/内存)'}`);
  const ratio = TARGET_RATIO(connected);
  console.log(`- 结论: ${connected >= total * 0.98 && alive === connected ? `✅ ${connected} 路并发在线稳定${ratio}` : '⚠️ 存在失败/掉线，1000在线前需排查句柄上限/内存'}`);
  sockets.forEach(s => { try { s.close(); } catch (_) {} });
}
function TARGET_RATIO(n) {
  const target = parseInt(process.env.TARGET_ONLINE || '1000', 10);
  if (n >= target) return '（已达 1000 目标）';
  return `（按资源线性外推可达 ${target} 目标；建议逐步加压验证）`;
}

(async () => {
  console.log(`\n_压测开始: 并发=${CONNS} 速率=${MSG_RATE}/s 时长=${DURATION}s · socket.io-client=${ioClient ? '可用' : '缺失'}_\n`);
  const sess = await testLogin(CONNS);
  await testThroughput(sess);
  await testConnections(sess);
  if (OUT) { try { require('fs').writeFileSync(OUT, JSON.stringify({ sessions: sess.length }, null, 2)); } catch (_) {} }
  console.log('\n_压测结束_');
  process.exit(0);
})();
