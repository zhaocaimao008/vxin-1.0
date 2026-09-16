'use strict';
/**
 * LOGIN-EDGE: 登录异常场景测试
 * 
 * P3 修复：
 * - LOGIN-01：改用 isDisabled() 断言提交按钮，不对禁用按钮强制 click()
 *   产品契约：phone='' 或 password='' 时 submit button disabled=true，这是正确行为
 */
const { test, expect } = require('../fixtures');
const { LoginPage } = require('../pages/LoginPage');
const { ChatPage }  = require('../pages/ChatPage');
const A = require('../../shared/anchors');

test.describe('登录异常 LOGIN-EDGE', () => {

  test('LOGIN-01 空手机号时提交按钮禁用', async ({ webPage, baseURL }) => {
    /**
     * 产品契约：phone 为空时，submit button 应处于 disabled 状态。
     * 测试验证：按钮 disabled，而非尝试 click 它（disabled 按钮不应被点击）。
     */
    const login = new LoginPage(webPage);
    await login.gotoLogin(baseURL);

    // 只填密码，不填手机号
    await webPage.locator(`[data-testid="${A.loginPassword}"]`).fill('somepassword123');

    const submitBtn = webPage.locator(`[data-testid="${A.loginSubmit}"]`);
    await expect(submitBtn).toBeVisible();

    // 核心断言：submit 按钮应为 disabled（产品正确行为）
    await expect(submitBtn).toBeDisabled();

    // 页面保持在登录页，无错误
    const errors = [];
    webPage.on('pageerror', e => errors.push(e.message));
    await webPage.waitForTimeout(500);
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('LOGIN-01b 空密码时提交按钮禁用', async ({ webPage, baseURL }) => {
    /**
     * 产品契约：password 为空时，submit button 应处于 disabled 状态。
     */
    const login = new LoginPage(webPage);
    await login.gotoLogin(baseURL);

    // 只填手机号，不填密码
    await webPage.locator(`[data-testid="${A.loginPhone}"]`).fill('13800000000');

    const submitBtn = webPage.locator(`[data-testid="${A.loginSubmit}"]`);
    await expect(submitBtn).toBeDisabled();
  });

  test('LOGIN-02 错误密码提示错误', async ({ webPage, seeded, baseURL }) => {
    const login = new LoginPage(webPage);
    await login.gotoLogin(baseURL);
    await webPage.locator(`[data-testid="${A.loginPhone}"]`).fill(seeded.users[0].phone);
    await webPage.locator(`[data-testid="${A.loginPassword}"]`).fill('wrongpassword999');
    // 登录页新增协议勾选：未勾选时提交按钮 disabled，需先勾选才能触发提交
    await webPage.locator('[data-testid="login-agreement-checkbox"]').check({ force: true });
    await webPage.locator(`[data-testid="${A.loginSubmit}"]`).click();
    await expect(webPage.getByTestId(A.authError)).toBeVisible();
    await expect(webPage.getByTestId(A.authError)).toContainText(/密码|账号/);
    await expect(webPage.getByTestId(A.loginPhone)).toBeVisible();
  });

  test('LOGIN-03 正确账号登录成功', async ({ webPage, seeded, baseURL }) => {
    const login = new LoginPage(webPage);
    await login.gotoLogin(baseURL);
    await login.login(seeded.users[0].phone, seeded.users[0].password);
    const chat = new ChatPage(webPage);
    await chat.waitReady();

    const chatsTab = webPage.locator(`[data-testid="${A.navTab('chats')}"]`).first();
    await expect(chatsTab).toBeVisible();
    await webPage.screenshot({ path: 'shots/login-success.png' });
  });

  test('LOGIN-04 登录状态刷新保留', async ({ webPage, seeded, baseURL }) => {
    const login = new LoginPage(webPage);
    await login.gotoLogin(baseURL);
    await login.login(seeded.users[0].phone, seeded.users[0].password);
    const chat = new ChatPage(webPage);
    await chat.waitReady();

    // 刷新页面
    await webPage.reload();
    await chat.waitReady();
    await expect(webPage.getByTestId(A.navTab('chats')).first()).toBeVisible();
    await expect(webPage.getByTestId(A.loginPhone)).toHaveCount(0);
  });

  test('LOGIN-05 连续双击登录不重复提交', async ({ webPage, seeded, baseURL }) => {
    const login = new LoginPage(webPage);
    await login.gotoLogin(baseURL);
    await webPage.locator(`[data-testid="${A.loginPhone}"]`).fill(seeded.users[0].phone);
    await webPage.locator(`[data-testid="${A.loginPassword}"]`).fill(seeded.users[0].password);
    // 登录页新增协议勾选：未勾选时提交按钮 disabled，需先勾选才能触发提交
    await webPage.locator('[data-testid="login-agreement-checkbox"]').check({ force: true });

    let requests = 0;
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await webPage.route('**/api/auth/login', async route => {
      requests++;
      await held;
      await route.continue();
    });
    const submitBtn = webPage.getByTestId(A.loginSubmit);
    try {
      await submitBtn.click();
      await expect(submitBtn).toBeDisabled();
      await webPage.locator('form.auth-form').evaluate(form => form.requestSubmit());
      await expect.poll(() => requests).toBe(1);
    } finally { release(); }
    await new ChatPage(webPage).waitReady();
    expect(requests).toBe(1);
  });

});
