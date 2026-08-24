'use strict';
const { test, expect } = require('../fixtures');
const { LoginPage } = require('../pages/LoginPage');
const { ChatPage } = require('../pages/ChatPage');

// 去微信化换肤 + 冷启动空状态验证（一次性）：截图输出到 /tmp/vxin-ui-verify/
const SHOT = (name) => `/tmp/vxin-ui-verify/${name}.png`;

test.describe('去微信化 + 空状态验证', () => {
  test('冷启动：零会话用户看到引导卡 + 列表空状态 CTA（亮色）', async ({ webPage, seeded, baseURL }) => {
    const cold = seeded.users[2];   // CarolE2E：无好友无会话
    const login = new LoginPage(webPage);
    const chat = new ChatPage(webPage);
    await login.gotoLogin(baseURL);
    await login.login(cold.phone, cold.password);
    await chat.waitReady();
    // Carol 列表里仍会显示自动创建的"文件传输助手"行（后端保证存在），冷启动以"无真实会话"判定
    // 中央冷启动引导卡
    const card = webPage.locator('.we-empty');
    await expect(card.locator('.we-empty-title')).toHaveText('开始你的第一场对话');
    await expect(card.locator('.cl-add-btn')).toBeVisible();
    await expect(card.locator('.we-empty-btn-ghost')).toBeVisible();
    await webPage.screenshot({ path: SHOT('cold-light') });
  });

  test('冷启动：暗色模式引导卡', async ({ webPage, seeded, baseURL }) => {
    const cold = seeded.users[2];
    const login = new LoginPage(webPage);
    const chat = new ChatPage(webPage);
    await login.gotoLogin(baseURL);
    await login.login(cold.phone, cold.password);
    await chat.waitReady();
    await webPage.evaluate(() => localStorage.setItem('wc_theme', 'dark'));
    await webPage.reload();
    await chat.waitReady();
    await expect(webPage.locator('.we-empty-title')).toHaveText('开始你的第一场对话');
    await webPage.screenshot({ path: SHOT('cold-dark') });
  });

  test('非冷启动：有会话未选中 → 保持欢迎插画（回归确认）', async ({ webPage, seeded, baseURL }) => {
    test.skip(!seeded.convAB, '无会话');
    const u = seeded.users[0];
    const login = new LoginPage(webPage);
    const chat = new ChatPage(webPage);
    await login.gotoLogin(baseURL);
    await login.login(u.phone, u.password);
    await chat.waitReady();
    await expect(webPage.locator('.we-empty-title')).toHaveText('欢迎使用 v信');
    await expect(webPage.locator('.we-empty-actions')).toHaveCount(0);
    await webPage.screenshot({ path: SHOT('normal-light') });
  });

  test('登录页：品牌色已去微信绿', async ({ webPage, baseURL }) => {
    const login = new LoginPage(webPage);
    await login.gotoLogin(baseURL);
    await webPage.screenshot({ path: SHOT('login') });
  });
});
