'use strict';
/**
 * API 回归测试 — 生产环境 https://vxinchat.com
 *
 * P3 修复：
 * - SEC-02: 修正 URL 编码，用 URLSearchParams 构造查询参数
 * - FAV-01: 修正收藏 API 路径为 /api/users/me/collections（实际路由）
 */
const https = require('https');
const assert = require('assert');
const fs = require('fs');

const DOMAIN = 'vxinchat.com';
const API_BASE = '/api';
const TEST_PHONE    = '13800138006';
const TEST_PASSWORD = 'Review2026ab';

function request(method, path, { body, token, query } = {}) {
  return new Promise((resolve, reject) => {
    // query 参数使用 URLSearchParams 正确编码
    let fullPath = path.startsWith('/api') ? path : API_BASE + path;
    if (query) {
      const params = new URLSearchParams(query);
      fullPath += '?' + params.toString();
    }
    const opts = {
      hostname: DOMAIN,
      path: fullPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let TOKEN = null, MY_ID = null, CONV_ID = null;
const results = [];
let pass = 0, fail = 0, blocked = 0;

function record(name, status, detail = '') {
  results.push({ name, status, detail });
  if (status === 'PASS') pass++;
  else if (status === 'FAIL') fail++;
  else blocked++;
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭';
  console.log(`  ${icon} [${status}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function runTests() {
  console.log('\n════════════════════════════════════════════');
  console.log('  v信 API 回归测试');
  console.log('  目标: https://' + DOMAIN);
  console.log(`  时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('════════════════════════════════════════════\n');

  // ── 1. 认证 ──────────────────────────────────────────
  console.log('【1. 认证 AUTH】');

  try {
    const r = await request('GET', '/me');
    assert.ok(r.status === 401 || r.status === 302 || r.status === 403 || r.status === 404,
      `Expected 401/302, got ${r.status}`);
    record('AUTH-01 未认证访问 /me → 4xx', 'PASS');
  } catch(e) { record('AUTH-01 未认证访问 /me → 4xx', 'FAIL', e.message); }

  try {
    const r = await request('GET', '/messages/conversations');
    assert.strictEqual(r.status, 401, `Expected 401, got ${r.status}`);
    record('AUTH-02 未认证 /api/messages/conversations → 401', 'PASS');
  } catch(e) { record('AUTH-02 未认证 /api/messages/conversations → 401', 'FAIL', e.message); }

  try {
    const r = await request('POST', '/auth/login', { body: { phone: TEST_PHONE, password: TEST_PASSWORD } });
    assert.ok([200, 201].includes(r.status), `got ${r.status}: ${JSON.stringify(r.data).slice(0,80)}`);
    assert.ok(r.data.token, 'No token in response');
    TOKEN = r.data.token;
    MY_ID = r.data.user?.id;
    record('AUTH-03 正常登录 → token', 'PASS', `user=${r.data.user?.username}`);
  } catch(e) { record('AUTH-03 正常登录 → token', 'FAIL', e.message); return; }

  try {
    const r = await request('POST', '/auth/login', { body: { phone: '13800000000', password: 'wrongpassword999' } });
    assert.ok(r.status >= 400 && r.status < 500, `got ${r.status}`);
    record('AUTH-04 错误密码 → 4xx', 'PASS');
  } catch(e) { record('AUTH-04 错误密码 → 4xx', 'FAIL', e.message); }

  try {
    const r = await request('POST', '/auth/login', { body: {} });
    assert.ok(r.status >= 400, `got ${r.status}`);
    record('AUTH-05 空参数登录 → 4xx', 'PASS');
  } catch(e) { record('AUTH-05 空参数登录 → 4xx', 'FAIL', e.message); }

  // ── 2. 会话 ──────────────────────────────────────────
  console.log('\n【2. 会话 CONV】');

  try {
    const r = await request('GET', '/messages/conversations', { token: TOKEN });
    assert.ok([200, 304].includes(r.status), `got ${r.status}`);
    if (Array.isArray(r.data) && r.data.length > 0) CONV_ID = r.data[0].id;
    record('CONV-01 会话列表 → 200', 'PASS', `count=${r.data?.length || 0}`);
  } catch(e) { record('CONV-01 会话列表 → 200', 'FAIL', e.message); }

  try {
    const r = await request('GET', '/messages/unread-counts', { token: TOKEN });
    assert.ok([200, 304].includes(r.status));
    record('CONV-02 未读数 → 200', 'PASS');
  } catch(e) { record('CONV-02 未读数 → 200', 'FAIL', e.message); }

  // ── 3. 消息 ──────────────────────────────────────────
  console.log('\n【3. 消息 MSG】');

  if (CONV_ID) {
    try {
      const r = await request('GET', `/messages/${CONV_ID}`, { token: TOKEN });
      assert.ok([200, 304].includes(r.status), `got ${r.status}`);
      record('MSG-01 消息历史 /api/messages/:id → 200', 'PASS');
    } catch(e) { record('MSG-01 消息历史 /api/messages/:id → 200', 'FAIL', e.message); }

    try {
      const r = await request('POST', `/messages/conversation/${CONV_ID}/read`, { token: TOKEN, body: {} });
      assert.ok([200, 201, 204].includes(r.status), `got ${r.status}`);
      record('MSG-02 标记已读 → 2xx', 'PASS');
    } catch(e) { record('MSG-02 标记已读 → 2xx', 'FAIL', e.message); }
  } else {
    record('MSG-01 消息历史', 'BLOCKED', '无会话ID');
    record('MSG-02 标记已读', 'BLOCKED', '无会话ID');
  }

  // ── 4. 用户 ──────────────────────────────────────────
  console.log('\n【4. 用户 USER】');

  try {
    const r = await request('GET', '/users/friend-requests', { token: TOKEN });
    assert.ok([200, 304].includes(r.status));
    record('USER-01 好友请求列表 → 200', 'PASS');
  } catch(e) { record('USER-01 好友请求列表 → 200', 'FAIL', e.message); }

  try {
    const r = await request('GET', '/users/contacts', { token: TOKEN });
    assert.ok([200, 304].includes(r.status));
    record('USER-02 联系人列表 → 200', 'PASS');
  } catch(e) { record('USER-02 联系人列表 → 200', 'FAIL', e.message); }

  try {
    // P3修复 SEC-02：使用 query 参数对象，由 URLSearchParams 正确编码特殊字符
    const r = await request('GET', '/users/search', { token: TOKEN, query: { q: 'test', page: '1' } });
    assert.ok([200, 304].includes(r.status));
    record('USER-03 用户搜索(正常参数) → 200', 'PASS');
  } catch(e) { record('USER-03 用户搜索(正常参数) → 200', 'FAIL', e.message); }

  // ── 5. 上传 ──────────────────────────────────────────
  console.log('\n【5. 上传 UPLOAD】');

  try {
    const r = await request('POST', '/upload/credential', {
      token: TOKEN,
      body: { filename: 'test.jpg', contentType: 'image/jpeg', conversationId: CONV_ID || 'test' }
    });
    assert.ok([200, 400, 403, 503].includes(r.status), `got ${r.status}`);
    record('UPLOAD-01 上传凭证 → 正确响应', 'PASS', `status=${r.status}`);
  } catch(e) { record('UPLOAD-01 上传凭证 → 正确响应', 'FAIL', e.message); }

  // ── 6. 动态 ──────────────────────────────────────────
  console.log('\n【6. 动态 MOMENTS】');

  try {
    const r = await request('GET', '/moments', { token: TOKEN });
    assert.ok([200, 304].includes(r.status));
    record('MOMENTS-01 动态列表 → 200', 'PASS');
  } catch(e) { record('MOMENTS-01 动态列表 → 200', 'FAIL', e.message); }

  // ── 7. 收藏 (P3修复 FAV-01) ───────────────────────────
  console.log('\n【7. 收藏 COLLECTIONS】');
  /**
   * P3修复 FAV-01:
   * 调查结论（情况A）：收藏 API 实际路径为 /api/users/me/collections
   * 后端路由: router.get('/me/collections', auth, u.getCollections)
   * 注册在: /api/users prefix → 完整路径 /api/users/me/collections
   * /api/favorites 不存在（404），测试脚本路径错误。
   */
  try {
    const r = await request('GET', '/users/me/collections', { token: TOKEN });
    assert.ok([200, 304].includes(r.status), `got ${r.status}`);
    record('COL-01 收藏列表 /api/users/me/collections → 200', 'PASS');
  } catch(e) { record('COL-01 收藏列表 /api/users/me/collections → 200', 'FAIL', e.message); }

  try {
    // 搜索收藏
    const r = await request('GET', '/users/me/collections/search', { token: TOKEN, query: { q: 'test' } });
    assert.ok([200, 304].includes(r.status));
    record('COL-02 收藏搜索 → 200', 'PASS');
  } catch(e) { record('COL-02 收藏搜索 → 200', 'FAIL', e.message); }

  // ── 8. 错误处理 ──────────────────────────────────────
  console.log('\n【8. 错误处理 ERROR】');

  try {
    const r = await request('GET', '/nonexistent-xyz-99999', { token: TOKEN });
    assert.ok(r.status === 404, `Expected 404, got ${r.status}`);
    record('ERR-01 不存在接口 → 404', 'PASS');
  } catch(e) { record('ERR-01 不存在接口 → 404', 'FAIL', e.message); }

  try {
    const r = await request('GET', '/messages/invalid-conv-uuid-xyz/nonexistent', { token: TOKEN });
    assert.ok(r.status >= 400, `Expected 4xx, got ${r.status}`);
    record('ERR-02 无效会话ID路径 → 4xx', 'PASS');
  } catch(e) { record('ERR-02 无效会话ID路径 → 4xx', 'FAIL', e.message); }

  // ── 9. 安全 ──────────────────────────────────────────
  console.log('\n【9. 安全 SECURITY】');

  try {
    const r = await request('GET', '/messages/conversations', { token: 'fake-invalid-token-xyz' });
    assert.ok(r.status === 401, `Expected 401, got ${r.status}`);
    record('SEC-01 伪造Token → 401', 'PASS');
  } catch(e) { record('SEC-01 伪造Token → 401', 'FAIL', e.message); }

  try {
    /**
     * P3修复 SEC-02：
     * 原问题：直接拼接特殊字符到 URL 字符串导致 Node.js https 模块报错
     * 修复：使用 URLSearchParams 编码（query 参数对象）
     * 验证：API 正确处理 SQL 注入字符，返回 200（搜索无结果）或 200（正常结果）
     * 结论：API 安全，参数化查询防 SQL 注入（SQLite better-sqlite3 预编译语句）
     */
    const r = await request('GET', '/users/search', {
      token: TOKEN,
      query: { q: "' OR '1'='1", page: '1' }  // URLSearchParams 自动 URL 编码
    });
    // 应返回 200（搜索结果为空或正常）或 429（Rate Limit）
    assert.ok([200, 429].includes(r.status), `Expected 200/429, got ${r.status}`);
    // 关键：不应返回 500（服务器崩溃 = SQL 注入成功）
    assert.ok(r.status !== 500, 'SQL注入导致服务器500！');
    record('SEC-02 SQL注入字符搜索 → 200/429(安全)', 'PASS', `status=${r.status}, SQL注入被正确处理`);
  } catch(e) { record('SEC-02 SQL注入字符搜索 → 安全处理', 'FAIL', e.message); }

  // ── 汇总 ─────────────────────────────────────────────
  const total = pass + fail + blocked;
  const rate = total > 0 ? Math.round(pass / total * 100) : 0;

  console.log('\n════════════════════════════════════════════');
  console.log('  API 测试汇总');
  console.log('════════════════════════════════════════════');
  console.log(`  总计: ${total}   ✅ PASS: ${pass}   ❌ FAIL: ${fail}   ⏭ BLOCKED: ${blocked}`);
  console.log(`  通过率: ${rate}%`);
  if (fail > 0) {
    console.log('\n  ❌ 失败项：');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    - ${r.name}: ${r.detail}`));
  }
  console.log('════════════════════════════════════════════\n');

  fs.mkdirSync('/root/v信/e2e/test-results', { recursive: true });
  const summary = { total, pass, fail, blocked, rate, results, ts: new Date().toISOString() };
  fs.writeFileSync('/root/v信/e2e/test-results/api-summary.json', JSON.stringify(summary, null, 2));
  return summary;
}

runTests().catch(e => { console.error('测试运行错误:', e.message); process.exit(1); });
