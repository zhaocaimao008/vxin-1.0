#!/usr/bin/env node
'use strict';
/**
 * 真实环境（生产 https://vxinchat.com）只读端到端验证。不 mock 任何接口。
 *
 * 账号密码只能通过环境变量传入，禁止写死在本文件或任何调用它的脚本/文档里：
 *   E2E_ACCOUNT=xxxx E2E_PASSWORD=xxxx node real-env-check.js
 *
 * 只做导航/点击查看类操作（切 tab、点会话、点联系人、点设置分类），
 * 不做任何写操作（不发消息、不改资料、不退群、不删好友、不提交任何表单）。
 * 登录失败（密码错/风控/验证码）会直接停止并退出非 0，不会重试或换账号。
 *
 * 截图前会对页面里形如 1XXXXXXXXXX / 1XX****XXXX 的手机号文本做 DOM 级打码，
 * 再存盘，避免真实手机号出现在图片里。
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../../e2e/node_modules/@playwright/test'));

const ACCOUNT = process.env.E2E_ACCOUNT;
const PASSWORD = process.env.E2E_PASSWORD;
const OUT = path.resolve(process.cwd(), 'shots/real');
const BASE_URL = process.env.E2E_BASE_URL || 'https://vxinchat.com/app/';

if (!ACCOUNT || !PASSWORD) {
  console.error('缺少 E2E_ACCOUNT / E2E_PASSWORD 环境变量，已中止（不会用任何内置默认账号）。');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

const PHONE_RE = /1\d{10}|1\d{2}\*{4}\d{4}/g;

async function redactPhones(page) {
  await page.evaluate((reSource) => {
    const re = new RegExp(reSource, 'g');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (const node of nodes) {
      if (re.test(node.nodeValue)) {
        node.nodeValue = node.nodeValue.replace(re, '1**********');
      }
      re.lastIndex = 0;
    }
    // input value 也可能回显手机号（如登录态下的账号设置输入框）
    document.querySelectorAll('input').forEach(inp => {
      if (re.test(inp.value || '')) inp.value = '1**********';
      re.lastIndex = 0;
    });
  }, PHONE_RE.source);
}

async function shot(page, name) {
  await redactPhones(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('  ✓', `${name}.png`);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });

  console.log('打开', BASE_URL, '...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  const phoneInput = page.locator('input[placeholder*="手机"]').first();
  await phoneInput.waitFor({ timeout: 15000 });
  await phoneInput.fill(ACCOUNT);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('[data-testid="login-agreement-checkbox"]').check();
  await page.waitForTimeout(200);
  await page.locator('[data-testid="login-submit-btn"]').click();
  await page.waitForTimeout(3000);

  const errMsg = await page.locator('text=/账号或密码错误|验证码|风控|异常/').first().textContent().catch(() => null);
  if (errMsg) {
    console.error('登录失败，页面提示:', errMsg);
    console.error('已停止，不重试、不换账号。');
    await browser.close();
    process.exit(2);
  }

  const stillOnLogin = await page.locator('[data-testid="login-submit-btn"]').count();
  if (stillOnLogin) {
    console.error('登录后仍停留在登录页（未见明确错误文案，可能是风控静默拦截），已停止。');
    await shot(page, '00-login-stuck');
    await browser.close();
    process.exit(2);
  }

  console.log('登录成功，开始只读浏览...');
  await shot(page, '00-home');

  if (await page.locator('[data-testid="nav-tab-chats"]').count()) {
    await page.locator('[data-testid="nav-tab-chats"]').click();
    await shot(page, '01-chatlist');

    const firstConv = page.locator('[data-testid^="conv-item-"]').first();
    if (await firstConv.count()) {
      await firstConv.click();
      await shot(page, '02-chatwindow');
    }

    // 找一个群聊会话打开群信息面板（只读查看，不做任何修改）
    const groupConv = page.locator('.wc-chat-item', { has: page.locator('.wc-chat-item-badge, svg') }).first();
    const convs = await page.locator('[data-testid^="conv-item-"]').all();
    for (const c of convs) {
      await c.click();
      await page.waitForTimeout(300);
      const title = await page.locator('.wc-chat-item-name').first().textContent().catch(() => '');
      // 简单启发式：找一个能点开"更多"且弹出群信息面板的会话；找不到就跳过，不强求
      const moreBtn = page.locator('.wc-chat-header button, .wc-chat-header [role="button"]').last();
      if (await moreBtn.count()) {
        await moreBtn.click().catch(() => {});
        await page.waitForTimeout(400);
        if (await page.locator('.gi-panel').count()) {
          await shot(page, '02b-groupinfo');
          break;
        }
      }
    }
  }

  if (await page.locator('[data-testid="nav-tab-contacts"]').count()) {
    await page.locator('[data-testid="nav-tab-contacts"]').click();
    await shot(page, '03-contactlist');

    const contactRows = page.locator('.wc-contact-item');
    const n = await contactRows.count();
    for (let i = 0; i < n; i++) {
      const text = await contactRows.nth(i).textContent().catch(() => '');
      if (['新的朋友', '群聊', '添加好友', '黑名单', '好友标签', '文件传输助手'].some(k => text.includes(k))) continue;
      await contactRows.nth(i).click();
      await page.waitForTimeout(500);
      await shot(page, '04-userprofile');
      await page.keyboard.press('Escape').catch(() => {});
      break;
    }
  }

  if (await page.locator('[data-testid="nav-tab-me"]').count()) {
    await page.locator('[data-testid="nav-tab-me"]').click();
    await shot(page, '05a-me-websettingsshell-account');

    const profileNav = page.locator('.wc-settings-nav-item', { hasText: '个人资料' });
    if (await profileNav.count()) { await profileNav.click(); await shot(page, '05b-me-profiledetail'); }
    const privacyNav = page.locator('.wc-settings-nav-item', { hasText: '隐私设置' });
    if (await privacyNav.count()) { await privacyNav.click(); await shot(page, '05c-settings-privacy'); }
    const notifNav = page.locator('.wc-settings-nav-item', { hasText: '通知设置' });
    if (await notifNav.count()) { await notifNav.click(); await shot(page, '05d-settings-notifications'); }
    const generalNav = page.locator('.wc-settings-nav-item', { hasText: '通用设置' });
    if (await generalNav.count()) { await generalNav.click(); await shot(page, '05e-settings-general'); }

    await page.setViewportSize({ width: 480, height: 900 });
    await page.waitForTimeout(500);
    await page.locator('[data-testid="nav-tab-me"]').click().catch(() => {});
    await shot(page, '06-me-singlecolumn');
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT, 'errors.json'), JSON.stringify(errors, null, 2));
  console.log('\npageerror/console-error count:', errors.length);
  errors.forEach(e => console.log('  -', e));
  console.log('\n完成，未做任何写操作（未发消息/未改资料/未退群/未删好友/未提交任何表单）。');
})().catch(e => {
  console.error('脚本异常:', e.message);
  process.exit(1);
});
