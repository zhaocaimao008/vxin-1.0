'use strict';
/**
 * PERSIST: 消息持久化测试
 */
const { test, expect } = require('../fixtures');
const { LoginPage } = require('../pages/LoginPage');
const { ChatPage }  = require('../pages/ChatPage');
const A = require('../../shared/anchors');

test.describe('消息持久化 PERSIST', () => {

  test('PERSIST-01 发消息后刷新仍存在', async ({ webPage, seeded, baseURL }) => {
    test.skip(!seeded.convAB, '无测试会话');

    const login = new LoginPage(webPage);
    await login.gotoLogin(baseURL);
    await login.login(seeded.users[0].phone, seeded.users[0].password);
    const chat = new ChatPage(webPage);
    await chat.waitReady();
    await chat.openConv(seeded.convAB);

    const text = `persist-test-${Date.now()}`;
    await chat.sendText(text);
    await chat.expectMessageVisible(text);

    // 刷新页面
    await webPage.reload();
    await webPage.waitForTimeout(3000);

    // 重新登录（如有需要）
    const onLogin = await webPage.locator(`[data-testid="${A.loginPhone}"]`).isVisible().catch(() => false);
    if (onLogin) {
      await login.login(seeded.users[0].phone, seeded.users[0].password);
      await chat.waitReady();
      await chat.openConv(seeded.convAB);
    } else {
      await chat.waitReady();
      await chat.openConv(seeded.convAB);
    }

    // 消息应该还在
    await expect(webPage.locator(`text="${text}"`).first()).toBeVisible({ timeout: 10000 });
  });

  test('PERSIST-02 切换会话后再返回历史消息存在', async ({ webPage, seeded, baseURL }) => {
    test.skip(!seeded.convAB, '无测试会话');

    const login = new LoginPage(webPage);
    await login.gotoLogin(baseURL);
    await login.login(seeded.users[0].phone, seeded.users[0].password);
    const chat = new ChatPage(webPage);
    await chat.waitReady();
    await chat.openConv(seeded.convAB);

    const text = `switch-test-${Date.now()}`;
    await chat.sendText(text);
    await chat.expectMessageVisible(text);

    // 切换到其他会话（如有）
    const allConvs = webPage.locator('[data-testid^="conv-item-"]');
    const count = await allConvs.count();
    if (count >= 2) {
      await allConvs.nth(1).click().catch(() => {});
      await webPage.waitForTimeout(1000);
      // 再切回来
      await chat.openConv(seeded.convAB);
      await expect(webPage.locator(`text="${text}"`).first()).toBeVisible({ timeout: 10000 });
    }
  });
});
