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
    await expect(searchInput).toHaveValue('test');
    await searchInput.fill('');
  });

  test('SEARCH-02 会话列表搜索过滤', async ({ webPage, seeded, baseURL }) => {
    await loginAndReady(webPage, baseURL, seeded);
    const searchInput = webPage.locator('input[placeholder="搜索"]').first();
    await expect(searchInput).toBeVisible();

    // 输入不存在的内容
    await searchInput.fill('xxxnonexistentkeyword999');
    await webPage.waitForTimeout(500);

    await expect(webPage.getByRole('button', { name: /未找到相关本地结果.*xxxnonexistentkeyword999/ })).toBeVisible();

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
