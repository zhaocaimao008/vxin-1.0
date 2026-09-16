// Requires isolated local web/API servers; creates disposable users and messages.
const {
  chromium
} = require('@playwright/test');
const fs = require('fs');
const assert = require('assert/strict');
const ROOT = process.env.EVIDENCE_DIR || require('path').resolve(__dirname, '../test-results/reliability');
fs.mkdirSync(ROOT, {
  recursive: true
});
const API = process.env.API_ORIGIN || 'http://127.0.0.1:18386';
const ORIGIN = process.env.WEB_ORIGIN || 'http://127.0.0.1:18387';
const findings = {};
let browser;
async function api(method, path, body, token) {
  const r = await fetch(API + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? {
        authorization: 'Bearer ' + token
      } : {})
    },
    ...(body ? {
      body: JSON.stringify(body)
    } : {})
  });
  const data = await r.json();
  if (!r.ok) throw Error(method + ' ' + path + ' ' + r.status + ' ' + JSON.stringify(data));
  return data;
}
async function main() {
  const stamp = String(Date.now()).slice(-6);
  const password = 'Audit-local-pass-20260916';
  const a = await api('POST', '/api/auth/register', {
    phone: '13901' + stamp,
    password,
    username: 'auditAlice' + stamp,
    inviteCode: process.env.INVITE_CODE || '123456'
  });
  const b = await api('POST', '/api/auth/register', {
    phone: '13902' + stamp,
    password,
    username: 'auditBob' + stamp,
    inviteCode: process.env.INVITE_CODE || '123456'
  });
  await api('POST', '/api/users/friend-request', {
    toId: b.user.id
  }, a.token);
  const reqs = await api('GET', '/api/users/friend-requests', null, b.token);
  await api('POST', '/api/users/friend-request/' + reqs.find(r => r.from_id === a.user.id).id + '/handle', {
    action: 'accept'
  }, b.token);
  const groupName = 'auditSharedGroup' + stamp;
  const group = await api('POST', '/api/messages/conversation/group', {
    name: groupName,
    memberIds: [b.user.id]
  }, a.token);
  const cid = group.conversationId;
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({
    serviceWorkers: 'block',
    viewport: {
      width: 1365,
      height: 900
    }
  });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/config.json') && url.hostname !== '127.0.0.1') return route.fulfill({
      json: {
        api: ORIGIN,
        socket: ORIGIN,
        cdn: ORIGIN
      }
    });
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    return route.continue();
  });
  await page.goto(ORIGIN + '/app/login');
  await page.locator('input[placeholder*="手机号"]').first().waitFor();
  findings.loginPage = {
    rendered: true,
    initialErrors: [...pageErrors]
  };
  const secret = 'AUDIT_ALICE_UNSENT_' + stamp;
  // Seed a legacy persisted outbox record belonging to Alice.
  // Bob then logs in through the unmodified login UI in the same browser profile.
  await page.evaluate(({
    cid,
    a,
    b,
    origin,
    secret
  }) => {
    const id = 'tmp_audit_alice_' + Date.now();
    const draft = {
      id,
      _tempId: id,
      conversation_id: cid,
      sender_id: a.id,
      senderName: a.username,
      content: secret,
      type: 'text',
      created_at: Math.floor(Date.now() / 1000),
      _status: 'error',
      deleted: 0,
      edited: 0,
      reactions: []
    };
    localStorage.setItem('outbox_' + cid, JSON.stringify([draft]));
    localStorage.setItem(`outbox_v2_${JSON.stringify([origin, a.id])}_${cid}`, JSON.stringify([draft]));
    const ownId = 'tmp_own_' + Date.now();
    localStorage.setItem(`outbox_v2_${JSON.stringify([origin, b.id])}_${cid}`, JSON.stringify([{
      ...draft, id: ownId, _tempId: ownId, sender_id: b.id, content: 'OWN_' + secret
    }]));
  }, {
    cid,
    a: a.user,
    b: b.user,
    origin: ORIGIN,
    secret
  });
  await page.locator('input[placeholder*="手机号"]').first().fill(b.user.phone);
  await page.locator('input[placeholder*="密码"]').first().fill(password);
  for (const checkbox of await page.locator('input[type=checkbox]').all()) await checkbox.check();
  await page.locator('form button[type=submit]').click();
  await page.getByTestId('conv-item-name').filter({
    hasText: groupName
  }).click({
    timeout: 20000
  });
  await page.waitForFunction(() => window.__vxinSocket?.connected, {}, {
    timeout: 15000
  });
  let sent;
  for (let i = 0; i < 25; i++) {
    sent = (await api('GET', '/api/messages/' + cid, null, b.token)).find(m => m.content === secret);
    if (sent) break;
    await new Promise(r => setTimeout(r, 200));
  }
  assert(!sent, 'Alice draft must not be sent by Bob');
  const ownSent = (await api('GET', '/api/messages/' + cid, null, b.token)).filter(m => m.content === 'OWN_' + secret);
  assert.equal(ownSent.length, 1, 'Bob must still recover his own scoped draft exactly once');
  assert.equal(ownSent[0].sender_id, b.user.id);
  findings.ownAccountOutbox = { passed: true, sentOnce: true };
  findings.crossAccountOutbox = {
    passed: true,
    originalSender: a.user.id,
    loggedInUser: b.user.id,
    sentAsDifferentAccount: false
  };
  await page.screenshot({
    path: ROOT + '/cross-account-outbox.png'
  });
  console.log('Cross-account auto-send prevented:', findings.crossAccountOutbox.passed);
  // Observe heartbeat packets and app-induced disconnect on a real idle websocket.
  await page.evaluate(() => {
    window.__auditSocket = {
      pings: 0,
      disconnects: [],
      connects: 0
    };
    const s = window.__vxinSocket;
    s.io.engine.on('packet', p => {
      if (p.type === 'ping') window.__auditSocket.pings++;
    });
    s.on('disconnect', reason => window.__auditSocket.disconnects.push({
      reason,
      at: Date.now()
    }));
    s.on('connect', () => window.__auditSocket.connects++);
  });
  await api('POST', '/api/messages/' + cid, {
    content: 'AUDIT_IDLE_TRIGGER',
    type: 'text'
  }, a.token);
  await new Promise(r => setTimeout(r, 34000));
  findings.idleSocket = await page.evaluate(() => window.__auditSocket);
  assert(findings.idleSocket.pings > 0);
  assert.equal(findings.idleSocket.disconnects.length, 0);
  console.log('Idle socket observation:', JSON.stringify(findings.idleSocket));
  // Insert messages through real HTTP endpoints while the actual browser is disconnected.
  await page.evaluate(() => window.__vxinSocket.disconnect());
  const after = Math.floor(Date.now() / 1000) - 1;
  for (let i = 0; i < 205; i++) await api('POST', '/api/messages/' + cid, {
    content: 'AUDIT_GAP_' + i,
    type: 'text'
  }, a.token);
  const rows = await api('GET', `/api/messages/${cid}?after=${after}&limit=100`, null, b.token);
  const recovery = [];
  const recoveredRows = [];
  page.on('response', async r => {
    if (r.url().includes('/api/messages/' + cid + '?') && r.url().includes('after=')) {
      recovery.push(r.url());
      recoveredRows.push(...(await r.json()));
    }
  });
  await page.evaluate(() => window.__vxinSocket.connect());
  await new Promise(r => setTimeout(r, 3000));
  findings.reconnectPagination = {
    inserted: 205,
    firstPageRows: rows.length,
    recoveredAuditRows: recoveredRows.filter(m => m.content.startsWith('AUDIT_GAP_')).length,
    lastMessageReturned: recoveredRows.some(m => m.content === 'AUDIT_GAP_204'),
    browserRecoveryRequests: recovery.length
  };
  console.log('Reconnect pagination:', JSON.stringify(findings.reconnectPagination));
  assert.equal(findings.reconnectPagination.recoveredAuditRows, 205);
  assert(findings.reconnectPagination.lastMessageReturned);
  assert.equal(new Set(recoveredRows.filter(m => m.content.startsWith('AUDIT_GAP_')).map(m => m.id)).size, 205);
  await page.getByText('AUDIT_GAP_204', {
    exact: true
  }).waitFor();
  findings.pageErrors = pageErrors;
  assert.equal(pageErrors.length, 0);
  await ctx.close();
  if (!process.env.SENTRY_DIST) return;
  // Serve Sentry-enabled production assets over the same local origin, with no external requests.
  const sentryCtx = await browser.newContext({
    serviceWorkers: 'block'
  });
  const sentryPage = await sentryCtx.newPage();
  const sentryErrors = [];
  sentryPage.on('pageerror', e => sentryErrors.push(e.message));
  await sentryPage.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/config.json')) return route.fulfill({
      json: {
        api: ORIGIN,
        socket: ORIGIN,
        cdn: ORIGIN
      }
    });
    if (u.hostname !== '127.0.0.1') return route.abort();
    if (u.pathname.startsWith('/api/') || u.pathname === '/health') return route.continue();
    let p = process.env.SENTRY_DIST + '/' + u.pathname.replace(/^\/app\/?/, '');
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = process.env.SENTRY_DIST + '/index.html';
    return route.fulfill({
      path: p,
      contentType: p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : p.endsWith('.html') ? 'text/html' : undefined
    });
  });
  await sentryPage.goto(ORIGIN + '/app/login');
  await new Promise(r => setTimeout(r, 1500));
  await sentryPage.locator('input[placeholder*=手机号]').first().waitFor();
  findings.sentryEnabled = {
    pageErrors: sentryErrors,
    rootChildCount: await sentryPage.locator('#root').evaluate(el => el.childElementCount)
  };
  assert.equal(sentryErrors.length, 0);
  await sentryPage.screenshot({
    path: ROOT + '/sentry-enabled.png'
  });
  console.log('Sentry-enabled boot:', JSON.stringify(findings.sentryEnabled));
  await sentryCtx.close();
}
main().catch(e => {
  findings.error = e.stack;
  console.error(e);
  process.exitCode = 1;
}).finally(async () => {
  fs.writeFileSync(ROOT + '/browser-findings.json', JSON.stringify(findings, null, 2));
  if (browser) await browser.close();
});
