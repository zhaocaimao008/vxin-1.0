'use strict';
const { test, expect } = require('../fixtures');
const { LoginPage } = require('../pages/LoginPage');
const { ChatPage } = require('../pages/ChatPage');

async function openChat(page, baseURL, seeded) {
  const login = new LoginPage(page);
  await login.gotoLogin(baseURL);
  await login.login(seeded.users[0].phone, seeded.users[0].password);
  const chat = new ChatPage(page);
  await chat.waitReady();
  await chat.openConv(seeded.convAB);
  return chat;
}

test('SEARCH-05 较慢的旧搜索不会覆盖新结果，清空后不会复现', async ({ webPage, seeded, baseURL }) => {
  await openChat(webPage, baseURL, seeded);
  let releaseOld;
  const oldPending = new Promise(resolve => { releaseOld = resolve; });
  let sawOld;
  const oldStarted = new Promise(resolve => { sawOld = resolve; });
  await webPage.route('**/api/messages/conversation/*/search?*', async route => {
    const q = new URL(route.request().url()).searchParams.get('q');
    if (q === 'old') { sawOld(); await oldPending; }
    await route.fulfill({ json: [{ id: q, content: q + ' result', senderName: 'tester', created_at: 1700000000 }] }).catch(() => {});
  });
  await webPage.getByTestId('chat-search-btn').click();
  const input = webPage.getByPlaceholder('搜索聊天记录…');
  await input.fill('old');
  await oldStarted;
  await input.fill('new');
  await expect(webPage.getByRole('button').filter({ hasText: 'new result' })).toBeVisible();
  releaseOld();
  await webPage.waitForTimeout(350);
  await expect(webPage.getByRole('button').filter({ hasText: 'old result' })).toHaveCount(0);
  await input.fill('');
  await expect(webPage.getByRole('button').filter({ hasText: 'new result' })).toHaveCount(0);
});

test('SETTINGS-05 阅后即焚保存失败时保留服务端原设置', async ({ webPage, seeded, baseURL }) => {
  await openChat(webPage, baseURL, seeded);
  await webPage.getByTestId('chat-group-info-btn').click();
  const select = webPage.getByLabel('阅后即焚', { exact: true });
  const original = await select.inputValue();
  await webPage.route('**/burn-after', route => route.fulfill({ status: 400, json: { error: 'save rejected' } }));
  await select.selectOption(original === '30' ? '60' : '30');
  await expect(select).toBeEnabled();
  await expect(select).toHaveValue(original);
  await expect(webPage.getByText('设置失败', { exact: true })).toBeVisible();
});

test.describe('私密文件与 Service Worker', () => {
  test.use({ serviceWorkers: 'allow' });
  test('CACHE-01 私密图片退出登录后必须重新鉴权', async ({ webPage, seeded, baseURL }) => {
    await openChat(webPage, baseURL, seeded);
    await webPage.waitForFunction(() => !!navigator.serviceWorker.controller);
    const file = require('fs').readFileSync(require('path').resolve(__dirname, '../../fixtures/sample.png'));
    const upload = await webPage.request.post(seeded.backendUrl + '/api/messages/' + seeded.convAB + '/upload', {
      headers: { Authorization: 'Bearer ' + seeded.users[0].token },
      multipart: { file: { name: 'private.png', mimeType: 'image/png', buffer: file } },
    });
    expect(upload.ok()).toBe(true);
    const message = await upload.json();
    const fileUrl = message.file_url || message.message?.file_url;
    expect(fileUrl).toMatch(/^\/uploads\//);
    const before = await webPage.evaluate(async url => (await fetch(url)).status, fileUrl);
    expect(before).toBe(200);
    await webPage.context().clearCookies();
    const after = await webPage.evaluate(async url => (await fetch(url)).status, fileUrl);
    expect(after).toBe(401);
    const cached = await webPage.evaluate(async url => {
      for (const name of await caches.keys()) if (await (await caches.open(name)).match(url)) return true;
      return false;
    }, fileUrl);
    expect(cached).toBe(false);
  });
});
