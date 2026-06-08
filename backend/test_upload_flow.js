/**
 * 集成测试：云存储直传流程
 * 运行：node test_upload_flow.js
 */
'use strict';
const http = require('http');

// ── 工具：http 请求（提取 Set-Cookie 中的 token）────────────
function req(method, path, body, cookieToken) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 3002,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookieToken ? { Cookie: `vxin_token=${cookieToken}` } : {}),
        ...(data        ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(opts, res => {
      let buf = '';
      // 从 Set-Cookie 提取 token
      const setCookie = [].concat(res.headers['set-cookie'] || []).join(';');
      const m = setCookie.match(/vxin_token=([^;]+)/);
      const cookieOut = m ? m[1] : null;
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf), cookie: cookieOut }); }
        catch { resolve({ status: res.statusCode, body: buf, cookie: cookieOut }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); failed++; }
  else        { console.log ('  ✓ PASS:', msg); passed++; }
}

// ── 测试序列 ──────────────────────────────────────────────────
async function main() {
  console.log('\n=== v信 云存储直传集成测试 ===\n');
  const ts = Date.now();

  // T1: 注册并取 token
  console.log('[T1] 注册测试用户');
  const reg1 = await req('POST', '/api/auth/register', {
    username: `tup_a_${ts}`,
    password: 'Test1234!',
    phone:    `1${ts.toString().slice(-10)}`,
  });
  assert(reg1.status === 200, `注册成功 (status=${reg1.status})`);
  const token1 = reg1.cookie;
  const uid1   = reg1.body.user?.id;
  assert(token1, `Cookie token 存在`);

  // T2: 注册第二个用户
  console.log('[T2] 注册第二个用户');
  const reg2 = await req('POST', '/api/auth/register', {
    username: `tup_b_${ts}`,
    password: 'Test1234!',
    phone:    `1${(ts + 1).toString().slice(-10)}`,
  });
  assert(reg2.status === 200, `第二用户注册成功 (status=${reg2.status})`);
  const uid2 = reg2.body.user?.id;
  assert(uid2, `第二用户 ID 存在`);

  // T3: 创建私聊会话
  console.log('[T3] 创建私聊会话');
  const convR = await req('POST', '/api/messages/conversation/private', { userId: uid2 }, token1);
  assert(convR.status === 200, `创建会话 (status=${convR.status})`);
  const convId = convR.body.conversationId;
  assert(convId, `会话 ID 存在 (${convId})`);

  // T4: /api/upload/credential 路由存在且返回有效响应
  // 若 .env 中填了真实密钥 → 200 + uploadUrl/publicUrl
  // 若 .env 中未配置       → 503 + error
  // 若 .env 中填了占位值   → 200（签名计算不需网络，但实际上传会失败）
  console.log('[T4] /api/upload/credential 路由存在且响应合法');
  const cred = await req('POST', '/api/upload/credential', {
    filename:       'test.jpg',
    contentType:    'image/jpeg',
    conversationId: convId,
  }, token1);
  assert(
    cred.status === 200 || cred.status === 503,
    `credential 接口返回 200 或 503 (status=${cred.status})`
  );
  if (cred.status === 200) {
    assert(typeof cred.body.uploadUrl === 'string', `返回 uploadUrl 字段`);
    assert(typeof cred.body.publicUrl === 'string', `返回 publicUrl 字段`);
  } else {
    assert(typeof cred.body.error === 'string', `未配置时返回 error 字段`);
  }

  // T5: 缺少参数时返回 400
  console.log('[T5] 缺少参数时返回 400');
  const bad = await req('POST', '/api/upload/credential', { filename: 'x.jpg' }, token1);
  assert(bad.status === 400 || bad.status === 503, `缺参数被拦截 (status=${bad.status})`);

  // T6: 未登录时返回 401
  console.log('[T6] 未登录时返回 401');
  const unauth = await req('POST', '/api/upload/credential', {
    filename: 'x.jpg', contentType: 'image/jpeg', conversationId: convId,
  });
  assert(unauth.status === 401, `未登录返回 401 (status=${unauth.status})`);

  // T7: 非会话成员被 403 拒绝
  console.log('[T7] 非会话成员被 403 拒绝');
  const reg3 = await req('POST', '/api/auth/register', {
    username: `tup_c_${ts}`,
    password: 'Test1234!',
    phone:    `1${(ts + 2).toString().slice(-10)}`,
  });
  const token3 = reg3.cookie;
  const notMember = await req('POST', '/api/upload/credential', {
    filename: 'x.jpg', contentType: 'image/jpeg', conversationId: convId,
  }, token3);
  assert(notMember.status === 403, `非成员返回 403 (status=${notMember.status})`);

  // T8: 旧 HTTP 文件上传接口仍然可用（向后兼容）
  console.log('[T8] 旧 HTTP 上传接口仍然可用');
  const old = await req('POST', `/api/messages/${convId}/upload`, null, token1);
  assert(old.status === 400, `旧接口存在且无文件时返回 400 (status=${old.status})`);

  // T9: 发送普通文字消息仍然正常
  console.log('[T9] 普通文字消息 HTTP fallback');
  const txt = await req('POST', `/api/messages/${convId}`, { content: '测试消息', type: 'text' }, token1);
  assert(txt.status === 200, `文字消息发送成功 (status=${txt.status})`);
  assert(txt.body.type === 'text', `消息类型正确`);

  // T10: 消息历史中可见刚才发送的消息
  console.log('[T10] 消息历史正常');
  const hist = await req('GET', `/api/messages/${convId}`, null, token1);
  assert(hist.status === 200, `获取历史成功 (status=${hist.status})`);
  assert(Array.isArray(hist.body) && hist.body.length > 0, `历史消息非空`);

  // ── 汇总 ────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  if (failed === 0) {
    console.log(`✅ 全部 ${passed} 项测试通过\n`);
    process.exit(0);
  } else {
    console.error(`❌ ${failed} 项失败，${passed} 项通过\n`);
    process.exit(1);
  }
}

main().catch(e => { console.error('测试异常:', e); process.exit(1); });
