// 输入框修复效果截图（重新生成）
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  try {
    // 登录页输入框聚焦
    await p.goto('https://touliao.cc/login', { timeout: 45000, waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    const phoneInput = p.locator('input[type=tel]').first();
    if (await phoneInput.count()) {
      await phoneInput.click();
      await p.waitForTimeout(500);
      await p.screenshot({ path: '/root/input-login-focus.png' });
      await phoneInput.fill('13943166215');
      await p.waitForTimeout(300);
      await p.screenshot({ path: '/root/input-login-filled.png' });
    }
    await p.locator('input[type=password]').fill('Passw0rd123');
    await p.locator('button[type=submit]').click();
    await p.waitForTimeout(6000);
    if (p.url().includes('login')) { console.log('LOGIN FAIL'); await b.close(); return; }

    // 搜索框聚焦
    const search = p.locator('.wc-search').first();
    if (await search.count()) {
      await search.click();
      await p.waitForTimeout(500);
      await p.screenshot({ path: '/root/input-search-focus.png' });
      await p.keyboard.press('Escape');
    }

    // 聊天输入框 idle → focus → typed
    const conv = p.locator('.wc-chat-item').first();
    if (await conv.count()) { await conv.click({ force: true }); await p.waitForTimeout(3000); }
    await p.screenshot({ path: '/root/input-chat-idle.png' });
    const ta = p.locator('textarea').first();
    if (await ta.count()) {
      await ta.click();
      await p.waitForTimeout(700);
      await p.screenshot({ path: '/root/input-chat-focus.png' });
      await ta.fill('输入框焦点环测试');
      await p.waitForTimeout(400);
      await p.screenshot({ path: '/root/input-chat-typed.png' });
    }
    console.log('DONE');
  } catch (e) { console.log('ERR:', e.message); }
  await b.close();
})();
