'use strict';
const base = require('@playwright/test');
const { launchElectron, skipReason } = require('./launch');
const { LoginPage } = require('../pages/LoginPage');
const { ChatPage } = require('../pages/ChatPage');
const http = require('http');

const test = base.test;
const expect = base.expect;

/**
 * Electron 烟雾测试:复用 web 的 POM(同一 web/dist,锚点一致)。
 * 前置:npm run build:web。本机 headless 需 xvfb-run。
 * root 环境因 main.js enableSandbox() 限制会整体跳过(见 skipReason)。
 */
test.describe('Electron 桌面端', () => {
  let app, page, state;
  let probe, probeUrl, slowResponse;

  test.beforeAll(async () => {
    const reason = skipReason();
    test.skip(!!reason, reason || '');
    probe = http.createServer((req, res) => {
      if (req.url === '/slow/health') { slowResponse = res; return; }
      if (req.url === '/missing/health') { res.writeHead(404); res.end('missing'); return; }
      res.end('<html>homepage</html>');
    });
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    probeUrl = `http://127.0.0.1:${probe.address().port}`;
    ({ app, page, state } = await launchElectron());
  });
  test.afterAll(async () => { if (app) await app.close(); if (probe) { probe.closeAllConnections(); await new Promise(resolve => probe.close(resolve)); } });

  test('WIN-CONFIG 自定义 HTTP 服务器和临时用户目录生效', async () => {
    const config = await page.evaluate(() => window.__ELECTRON_CONFIG__);
    expect(config.serverUrl).toBe(state.backendUrl);
    expect(config.serverUrlManual).toBe(true);
    expect(app.profile).toContain('vxin-electron-e2e-');
    expect(app.logs()).not.toContain('Protocol "http:" not supported');
  });

  test('WIN-PROBE 登录前拒绝 404 和普通网页，确认真实健康响应', async () => {
    await page.getByRole('button', { name: /当前服务器/ }).click();
    const address = page.getByRole('textbox', { name: '服务器地址', exact: true });
    for (const fixture of [{ path: '/missing', error: '服务器返回 404' }, { path: '/html', error: '无法连接' }]) {
      await address.fill(probeUrl + fixture.path);
      await page.getByRole('button', { name: '测试连接', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText(fixture.error);
    }
    await address.fill(state.backendUrl);
    await page.getByRole('button', { name: '测试连接', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('连接成功');
    await page.getByRole('button', { name: '取消', exact: true }).click();
  });

  test('WIN-PROBE 修改地址后忽略旧检测结果', async () => {
    await page.getByRole('button', { name: /当前服务器/ }).click();
    const address = page.getByRole('textbox', { name: '服务器地址', exact: true });
    await address.fill(probeUrl + '/slow');
    await page.getByRole('button', { name: '测试连接', exact: true }).click();
    await expect.poll(() => !!slowResponse).toBe(true);
    await address.fill(state.backendUrl);
    await page.getByRole('button', { name: '测试连接', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('连接成功');
    slowResponse.writeHead(503); slowResponse.end('old response');
    await page.waitForTimeout(150); // Allow the earlier IPC reply to reach the renderer.
    await expect(page.getByRole('alert')).toContainText('连接成功');
    await page.getByRole('button', { name: '取消', exact: true }).click();
  });

  test('WIN-DOCS 桌面包内的隐私政策可读取并关闭', async () => {
    await page.getByRole('link', { name: '《隐私政策》', exact: true }).click();
    await expect(page.locator('dialog[open] .auth-privacy-content').getByRole('heading', { name: '隐私政策', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '关闭文档', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '隐私政策', exact: true })).not.toBeVisible();
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
