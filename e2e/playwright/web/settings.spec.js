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
});
