const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on('console', m => { if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 200)); });
  page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 200)));

  const PHONE = '18800001559', PWD = 'Test1234';
  try {
    console.log('=== 打开前端页面 ===');
    await page.goto('https://vxinchat.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);

    console.log('=== URL:', page.url());
    const title = await page.title().catch(() => '(no title)');
    console.log('=== Title:', title);

    // 等登录字段出现
    await page.waitForSelector('[data-testid="login-phone-input"]', { timeout: 15000 })
      .catch(() => console.log('  ! login-phone-input 未出现，尝试找其它输入框'));

    const inputs = await page.locator('input').count().catch(() => 0);
    console.log('=== input数量:', inputs);

    // 填手机号
    const phoneSel = '[data-testid="login-phone-input"], input[placeholder*="手机号"], input[type="tel"]';
    await page.fill(phoneSel, PHONE).catch(e => console.log('  ! 填手机号失败:', e.message.split('\n')[0]));

    // 填密码
    const pwdSel = '[data-testid="login-password-input"], input[placeholder*="密码"], input[type="password"]';
    await page.fill(pwdSel, PWD).catch(e => console.log('  ! 填密码失败:', e.message.split('\n')[0]));

    console.log('=== 已填表单，截图登录页 ===');
    await page.screenshot({ path: '/root/vxin-1.0/e2e/vxin-login-filled.png' });

    // 截图按钮
    const btnText = await page.locator('button:has-text("登录")').first().textContent().catch(() => '(找不到登录按钮)');
    console.log('=== 登录按钮文案:', btnText);

    console.log('=== 点击登录 ===');
    await page.locator('button:has-text("登录")').first().click({ timeout: 8000 }).catch(e => console.log('  ! 点击登录失败:', e.message.split('\n')[0]));

    // 等待跳转/进入主界面
    await page.waitForTimeout(4000);
    console.log('=== 点击后URL:', page.url());

    // 判断是否进入主界面
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const loggedInMarkers = ['聊天', '通讯录', '发现', '我', '消息', '会话'];
    const hit = loggedInMarkers.filter(m => bodyText.includes(m));
    console.log('=== 主界面标记命中:', hit.length ? hit.join(',') : '(无)');

    await page.screenshot({ path: '/root/vxin-1.0/e2e/vxin-after-login.png', fullPage: false });
    console.log('=== 登录后截图已存');
  } catch (e) {
    console.log('=== 失败:', e.message.split('\n')[0]);
    await page.screenshot({ path: '/root/vxin-1.0/e2e/vxin-error.png' }).catch(() => {});
  } finally {
    await browser.close();
  }
  console.log('DONE');
})();
