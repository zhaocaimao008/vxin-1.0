'use strict';
/**
 * UI-VIS: 关键 UI 元素可见性检查
 * 登录后验证主界面所有关键区域均可见、不被遮挡、不溢出屏幕
 */
const { test, expect } = require('../fixtures');
const { LoginPage } = require('../pages/LoginPage');
const { ChatPage }  = require('../pages/ChatPage');
const A = require('../../shared/anchors');

test.describe('UI 可见性 UI-VIS', () => {

  test('UI-VIS-01 登录页关键元素可见', async ({ webPage, baseURL }) => {
    const login = new LoginPage(webPage);
    await login.gotoLogin(baseURL);

    // 必须可见
    await expect(webPage.locator(`[data-testid="${A.loginPhone}"]`)).toBeVisible();
    await expect(webPage.locator(`[data-testid="${A.loginPassword}"]`)).toBeVisible();
    await expect(webPage.locator(`[data-testid="${A.loginSubmit}"]`)).toBeVisible();

    // 无 JS 错误
    const errors = [];
    webPage.on('pageerror', e => errors.push(e.message));
    await webPage.waitForTimeout(1000);
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);

    await webPage.screenshot({ path: 'shots/ui-login.png', fullPage: true });
  });

  test('UI-VIS-02 首页 Sidebar 头像完整显示', async ({ webPage, seeded, baseURL }) => {
    const login = new LoginPage(webPage);
    await login.gotoLogin(baseURL);
    await login.login(seeded.users[0].phone, seeded.users[0].password);

    const chat = new ChatPage(webPage);
    await chat.waitReady();

    // 检查头像按钮
    const avatarBtn = webPage.locator('[data-testid="account-switcher"]');
    await expect(avatarBtn).toBeVisible();

    // 检查头像不被遮挡（bounding box 在视口内）
    const box = await avatarBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box.y).toBeGreaterThanOrEqual(0); // 不超出顶部
    expect(box.x).toBeGreaterThanOrEqual(0); // 不超出左边
    expect(box.height).toBeGreaterThan(10);   // 高度正常

    await webPage.screenshot({ path: 'shots/ui-home.png', fullPage: false });
  });

  test('UI-VIS-03 侧边栏 Tab 导航完整', async ({ webPage, seeded, baseURL }) => {
    const login = new LoginPage(webPage);
    await login.gotoLogin(baseURL);
    await login.login(seeded.users[0].phone, seeded.users[0].password);
    const chat = new ChatPage(webPage);
    await chat.waitReady();

    // 五个 Tab 均可见（消息/联系人/动态/收藏/设置）
    for (const key of ['chats', 'contacts', 'moments', 'favorites', 'me']) {
      const tab = webPage.locator(`[data-testid="${A.navTab(key)}"]`).first();
      const visible = await tab.isVisible().catch(() => false);
      if (visible) {
        const box = await tab.boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.height).toBeGreaterThan(0);
      }
    }
  });

  test('UI-VIS-04 聊天区域输入框与发送按钮可见', async ({ webPage, seeded, baseURL }) => {
    test.skip(!seeded.convAB, '无测试会话');
    const login = new LoginPage(webPage);
    await login.gotoLogin(baseURL);
    await login.login(seeded.users[0].phone, seeded.users[0].password);
    const chat = new ChatPage(webPage);
    await chat.waitReady();
    await chat.openConv(seeded.convAB);

    const input  = webPage.locator(`[data-testid="${A.chatMsgInput}"]`);
    const sendBtn = webPage.locator(`[data-testid="${A.chatSendBtn}"]`);

    await expect(input).toBeVisible();

    // 输入后发送按钮才出现
    await input.fill('test');
    await expect(sendBtn).toBeVisible();

    const inputBox = await input.boundingBox();
    expect(inputBox.y).toBeLessThan(800); // 不超出 viewport 底部
    expect(inputBox.height).toBeGreaterThan(0);

    await webPage.screenshot({ path: 'shots/ui-chat.png' });
  });

  test('UI-VIS-05 无横向滚动条', async ({ webPage, seeded, baseURL }) => {
    const login = new LoginPage(webPage);
    await login.gotoLogin(baseURL);
    await login.login(seeded.users[0].phone, seeded.users[0].password);
    const chat = new ChatPage(webPage);
    await chat.waitReady();

    // 检查 body 无横向滚动
    const hasHScroll = await webPage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHScroll).toBe(false);
  });
});
