'use strict';
const base = require('@playwright/test');
const { launchElectron, skipReason } = require('./launch');
const { LoginPage } = require('../pages/LoginPage');
const { ChatPage } = require('../pages/ChatPage');

const test = base.test;
const expect = base.expect;

/**
 * Electron 烟雾测试:复用 web 的 POM(同一 web/dist,锚点一致)。
 * 前置:npm run build:web。本机 headless 需 xvfb-run。
 * root 环境因 main.js enableSandbox() 限制会整体跳过(见 skipReason)。
 */
test.describe('Electron 桌面端', () => {
  let app, page, state;

  test.beforeAll(async () => {
    const reason = skipReason();
    test.skip(!!reason, reason || '');
    ({ app, page, state } = await launchElectron());
  });
  test.afterAll(async () => { if (app) await app.close(); });

  test('WIN-CONFIG 自定义 HTTP 服务器和临时用户目录生效', async () => {
    const config = await page.evaluate(() => window.__ELECTRON_CONFIG__);
    expect(config.serverUrl).toBe(state.backendUrl);
    expect(config.serverUrlManual).toBe(true);
    expect(app.profile).toContain('vxin-electron-e2e-');
    expect(app.logs()).not.toContain('Protocol "http:" not supported');
  });

  test('WIN-AUTH 登录成功 → 主界面', async () => {
    const login = new LoginPage(page);
    const chat = new ChatPage(page);
    const u = state.users[0];
    // Electron=HashRouter,reload 到登录页(localStorage 已注入后端地址)
    await page.reload();
    await login.tid(require('../../shared/anchors').loginPhone).waitFor({ state: 'visible', timeout: 15000 });
    await login.login(u.phone, u.password);
    await chat.waitReady();
  });

  test('WIN-CHAT 发送文本消息', async () => {
    const chat = new ChatPage(page);
    expect(state.convAB).toBeTruthy();
    await chat.openConv(state.convAB);
    const t = 'electron-e2e-' + Date.now();
    await chat.sendText(t);
    await chat.expectMessageVisible(t);
  });

  test('WIN-RELOAD 刷新后消息仍存在，主要导航可打开', async () => {
    await page.reload();
    const chat = new ChatPage(page);
    await chat.waitReady();
    await chat.openConv(state.convAB);
    await expect(page.locator('[data-testid^="msg-bubble-"]').filter({ hasText: 'electron-e2e-' }).last()).toBeVisible();
    for (const name of ['contacts', 'moments', 'favorites', 'me', 'chats']) {
      await page.getByTestId('nav-tab-' + name).click();
      await expect(page.getByTestId('nav-tab-' + name)).toBeVisible();
      await expect(page.getByText('页面出了点小问题', { exact: true })).toHaveCount(0);
    }
  });
});
