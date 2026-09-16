// Run against an isolated same-origin installation. No routing: Chromium's HTTP cache stays enabled.
const { chromium, expect } = require('@playwright/test');
const { LoginPage } = require('../playwright/pages/LoginPage');
const { ChatPage } = require('../playwright/pages/ChatPage');
const base = process.env.WEB_ORIGIN || 'http://127.0.0.1:18400';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Use an isolated local installation');
const password = 'Cache-test-20260916';
async function api(method, route, data, token) {
  const res = await fetch(base + route, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  if (!res.ok) throw Error(`${route}: ${res.status} ${await res.text()}`);
  return res.json();
}
(async () => {
  const saved = process.env.CONTACTS_REUSE_STATE;
  const users = saved ? JSON.parse(require('fs').readFileSync(saved, 'utf8')) : [];
  const stamp = String(Date.now()).slice(-6);
  for (let i = users.length; i < 3; i++) {
    const phone = `138${i}0${stamp}`;
    users.push({ ...await api('POST', '/api/auth/register', { phone, password, username: `Cache${i}${stamp}`, inviteCode: process.env.INVITE_CODE || '123456' }), phone });
  }
  const [alice, bob, carol] = users;
  require('fs').writeFileSync(process.env.CONTACTS_STATE || '/tmp/vxin-contact-test-state.json', JSON.stringify(users), { mode: 0o600 });
  const browser = await chromium.launch();
  let debugPage, debugContext;
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    debugPage = page; debugContext = context;
    page.on('pageerror', e => console.error('pageerror', e.message));
    const login = new LoginPage(page), chat = new ChatPage(page);
    await login.gotoLogin(base + '/app');
    await login.login(bob.phone, password); await chat.waitReady();
    const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/users/contacts');
    await page.getByTestId('nav-tab-contacts').click();
    expect((await response).headers()['cache-control']).toContain('no-store');
    if (!saved) {
    await expect(page.locator('.cl-empty-text').filter({ hasText: '暂无联系人' })).toBeVisible();
    await api('POST', '/api/users/friend-request', { toId: bob.user.id }, alice.token);
    const requests = await api('GET', '/api/users/friend-requests', null, bob.token);
    await api('POST', `/api/users/friend-request/${requests[0].id}/handle`, { action: 'accepted' }, bob.token);
    }
    await expect(page.locator('.wc-contact-item-name').filter({ hasText: alice.user.username })).toBeVisible();
    await page.reload(); await chat.waitReady();
    await page.getByTestId('nav-tab-contacts').click();
    await expect(page.locator('.wc-contact-item-name').filter({ hasText: alice.user.username })).toBeVisible();
    const added = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
    const reloaded = page.waitForEvent('domcontentloaded');
    await chat.addAccount(carol.phone, password);
    expect((await added).status()).toBe(200);
    await reloaded;
    await chat.waitReady();
    await page.getByTestId('nav-tab-contacts').click();
    await expect(page.locator('.cl-empty-text').filter({ hasText: '暂无联系人' })).toBeVisible();
    await expect(page.locator('.wc-contact-item-name').filter({ hasText: alice.user.username })).toHaveCount(0);
    console.log('Contacts: no-store, accepted friend, reload and account isolation passed with browser caching enabled.');
  } catch (error) {
    console.error('URL:', debugPage?.url());
    console.error('Page:', await debugPage?.locator('body').innerText());
    console.error('Cookies:', (await debugContext?.cookies())?.map(({name,secure,sameSite,domain,path}) => ({name,secure,sameSite,domain,path})));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
