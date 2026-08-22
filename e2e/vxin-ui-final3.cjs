const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });

  // 全量监听：所有请求、失败请求、响应
  page.on('request', r => {
    if (r.url().includes('/api/')) console.log(`  [REQ] ${r.method()} ${r.url().replace('https://','')}`);
  });
  page.on('requestfailed', r => {
    console.log(`  [FAIL] ${r.method()} ${r.url().replace('https://','')} :: ${r.failure()?.errorText}`);
  });
  page.on('response', async r => {
    if (r.url().includes('/api/auth/')) {
      const body = await r.text().catch(() => '(no body)');
      console.log(`  [RES ${r.status()}] ${r.request().method()} ${r.url().replace('https://','')} :: ${body.slice(0,150)}`);
    }
  });
  page.on('console', m => { if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 200)); });

  const PHONE = '18800001559', PWD = 'Test1234';
  try {
    console.log('=== ① 打开 www.vxinchat.com/app/ ===');
    const resp = await page.goto('https://www.vxinchat.com/app/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('状态码:', resp && resp.status(), '| URL:', page.url());
    await page.waitForSelector('input', { timeout: 20000 });
    await page.waitForTimeout(3000); // 等 boot 完成、探活发完

    console.log('=== ② 填表单 + 勾协议 ===');
    await page.locator('input[placeholder*="手机号"]').first().fill(PHONE);
    await page.locator('input[placeholder*="密码"]').first().fill(PWD);
    const cbs = page.locator('input[type="checkbox"]');
    for (let i = 0; i < await cbs.count(); i++) {
      if (!(await cbs.nth(i).isChecked().catch(() => false)))
        await cbs.nth(i).check({ force: true }).catch(() => cbs.nth(i).click({ force: true }).catch(() => {}));
    }
    console.log('已填: 手机号=' + PHONE);

    console.log('=== ③ 点击登录 ===');
    await page.locator('button[type="submit"], button:has-text("登录")').first().click({ timeout: 8000 }).catch(e => console.log('! 点击失败:', e.message.split('\n')[0]));

    await page.waitForTimeout(6000);
    console.log('=== ④ 登录后URL:', page.url());
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log('=== body 前300字:', bodyText.slice(0, 300).replace(/\n+/g, ' | '));
    const err = bodyText.includes('登录失败') || bodyText.includes('错误');
    console.log('=== 页面错误提示:', err ? bodyText.split('\n').filter(l => l.includes('失败') || l.includes('错误')).join(' | ') : '(无)');

    await page.screenshot({ path: '/root/vxin-1.0/e2e/ui3-final.png' });
    console.log('=== 截图 ui3-final.png');
  } catch (e) {
    console.log('=== 异常:', e.message.split('\n')[0]);
    await page.screenshot({ path: '/root/vxin-1.0/e2e/ui3-error.png' }).catch(() => {});
  } finally {
    await browser.close();
  }
  console.log('DONE');
})();
