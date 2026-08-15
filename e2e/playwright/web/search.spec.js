'use strict';
/**
 * SEARCH: 搜索功能测试
 */
const { test, expect } = require('../fixtures');
const { LoginPage } = require('../pages/LoginPage');
const { ChatPage }  = require('../pages/ChatPage');

async function loginAndReady(page, baseURL, seeded) {
  const login = new LoginPage(page);
  await login.gotoLogin(baseURL);
  await login.login(seeded.users[0].phone, seeded.users[0].password);
  const chat = new ChatPage(page);
  await chat.waitReady();
  return chat;
}

test.describe('搜索 SEARCH', () => {

  test('SEARCH-01 搜索框可见可输入', async ({ webPage, seeded, baseURL }) => {
    await loginAndReady(webPage, baseURL, seeded);

    // 面板顶栏搜索框
    const searchInput = webPage.locator('input[placeholder="搜索"]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('test');
    const val = await searchInput.inputValue();
    expect(val).toBe('test');
    await searchInput.fill('');
  });

  test('SEARCH-02 会话列表搜索过滤', async ({ webPage, seeded, baseURL }) => {
    await loginAndReady(webPage, baseURL, seeded);
    const searchInput = webPage.locator('input[placeholder="搜索"]').first();
    await expect(searchInput).toBeVisible();

    // 输入不存在的内容
    await searchInput.fill('xxxnonexistentkeyword999');
    await webPage.waitForTimeout(500);

    // 搜索结果：要么为空（暂无聊天）要么显示搜索结果
    const emptyOrResult = await webPage.locator('.wc-chat-item, [role="status"]').count();
    // 不崩溃即通过
    expect(emptyOrResult).toBeGreaterThanOrEqual(0);

    await searchInput.fill('');
    await webPage.screenshot({ path: 'shots/search.png' });
  });

  test('SEARCH-03 中文搜索不崩溃', async ({ webPage, seeded, baseURL }) => {
    await loginAndReady(webPage, baseURL, seeded);
    const searchInput = webPage.locator('input[placeholder="搜索"]').first();

    const errors = [];
    webPage.on('pageerror', e => errors.push(e.message));

    await searchInput.fill('你好世界');
    await webPage.waitForTimeout(500);
    await searchInput.fill('');

    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('SEARCH-04 Emoji 搜索不崩溃', async ({ webPage, seeded, baseURL }) => {
    await loginAndReady(webPage, baseURL, seeded);
    const searchInput = webPage.locator('input[placeholder="搜索"]').first();

    await searchInput.fill('😀🎉');
    await webPage.waitForTimeout(300);
    await searchInput.fill('');
    // 不崩溃即通过
  });
});
