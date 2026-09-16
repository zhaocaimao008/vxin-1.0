'use strict';
const { test, expect } = require('../fixtures');
const { LoginPage } = require('../pages/LoginPage');
const { ChatPage } = require('../pages/ChatPage');

async function gotoSettings(page, baseURL, seeded) {
  const login = new LoginPage(page);
  await login.gotoLogin(baseURL);
  await login.login(seeded.users[0].phone, seeded.users[0].password);
  await new ChatPage(page).waitReady();
  await page.getByTestId('nav-tab-me').click();
}

test.describe('设置/我的 SETTINGS', () => {
  test('SETTINGS-01 账号信息显示当前用户', async ({ webPage, seeded, baseURL }) => {
    await gotoSettings(webPage, baseURL, seeded);
    await expect(webPage.locator('.wc-page-header-title')).toHaveText('账号与安全');
    await expect(webPage.locator('.wc-account-info-name')).toContainText(seeded.users[0].username);
  });
  test('SETTINGS-02 设置页退出登录后返回登录页', async ({ webPage, seeded, baseURL }) => {
    await gotoSettings(webPage, baseURL, seeded);
    await webPage.getByRole('button', { name: '退出登录', exact: true }).click();
    await expect(webPage.getByTestId('login-phone-input')).toBeVisible();
  });
  test('SETTINGS-03 个人资料可编辑并返回', async ({ webPage, seeded, baseURL }) => {
    await gotoSettings(webPage, baseURL, seeded);
    await webPage.locator('.wc-settings-nav-item').filter({ hasText: '个人资料' }).click();
    await expect(webPage.locator('.wc-page-header-title')).toHaveText('个人资料');
    await webPage.locator('.wc-crow-clickable').filter({ has: webPage.getByText('用户名', { exact: true }) }).click();
    await expect(webPage.getByLabel('修改昵称', { exact: true })).toHaveValue(seeded.users[0].username);
    await webPage.locator('.wc-page-header-back').click();
    await expect(webPage.locator('.wc-settings-nav')).toBeVisible();
  });
  test('SETTINGS-04 深色设置页与亮色设置页使用对应背景', async ({ webPage, seeded, baseURL }) => {
    await gotoSettings(webPage, baseURL, seeded);
    await webPage.getByRole('button', { name: '切换皮肤', exact: true }).click();
    await expect(webPage.locator('body')).toHaveClass(/dark-mode/);
    await expect(webPage.locator('.wc-page-bg')).toHaveCSS('background-color', 'rgb(21, 23, 26)');
    await webPage.getByRole('button', { name: '切换皮肤', exact: true }).click();
    await expect(webPage.locator('body')).not.toHaveClass(/dark-mode/);
    await expect(webPage.locator('.wc-page-bg')).toHaveCSS('background-color', 'rgb(247, 248, 250)');
  });
  test('SETTINGS-05 服务器检测拒绝错误响应，取消切换保留登录和草稿', async ({ webPage, seeded, baseURL }) => {
    await gotoSettings(webPage, baseURL, seeded);
    const chat = new ChatPage(webPage);
    await webPage.getByTestId('nav-tab-chats').click();
    await chat.openConv(seeded.convAB);
    await chat.typeText('取消切换后保留的草稿');
    await webPage.evaluate(() => {
      window.__ELECTRON_CONFIG__ = {};
      window.electronAPI = { setServerUrl: async () => false };
    });
    await webPage.getByTestId('nav-tab-me').click();
    await webPage.getByText('服务器地址', { exact: true }).click();
    const address = webPage.getByRole('textbox', { name: '服务器地址', exact: true });
    await webPage.route('**/probe/health', route => route.fulfill({ status: 404, body: 'missing' }));
    await address.fill(seeded.backendUrl + '/probe');
    await webPage.getByRole('button', { name: '测试连接', exact: true }).click();
    await expect(webPage.locator('.wc-server-pad [role="status"]')).toContainText('服务器返回 404');
    await address.fill(seeded.backendUrl);
    await webPage.getByRole('button', { name: '测试连接', exact: true }).click();
    await expect(webPage.locator('.wc-server-pad [role="status"]')).toContainText('连接成功');
    let logoutRequests = 0;
    webPage.on('request', req => { if (req.url().endsWith('/api/auth/logout')) logoutRequests++; });
    const before = await webPage.evaluate(() => ({ ...localStorage }));
    await address.fill('https://cancelled.example.test');
    await webPage.getByRole('button', { name: '保存并切换', exact: true }).click();
    await expect(webPage.getByRole('button', { name: '保存并切换', exact: true })).toBeEnabled();
    expect(await webPage.evaluate(() => ({ ...localStorage }))).toEqual(before);
    expect(logoutRequests).toBe(0);
    await webPage.evaluate(() => { delete window.__ELECTRON_CONFIG__; delete window.electronAPI; });
    await webPage.reload();
    await chat.waitReady();
    await chat.openConv(seeded.convAB);
    await expect(webPage.getByTestId('chat-msg-input')).toHaveValue('取消切换后保留的草稿');
  });
});
