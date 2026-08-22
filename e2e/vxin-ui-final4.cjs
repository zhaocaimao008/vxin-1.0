const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });

  page.on('request', r => {
    if (r.url().includes('/api/auth/')) console.log(`  [REQ] ${r.method()} ${r.url().replace('https://','')}`);
  });
  page.on('requestfailed', r => console.log(`  [FAIL] ${r.method()} ${r.url().replace('https://','')} :: ${r.failure()?.errorText}`));
  page.on('response', async r => {
    if (r.url().includes('/api/auth/')) {
      const body = await r.text().catch(() => '(no body)');
      console.log(`  [RES ${r.status()}] ${r.request().method()} ${r.url().replace('https://','')} :: ${body.slice(0,200)}`);
    }
  });
  page.on('console', m => { if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 200)); });
  page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 300)));

  const PHONE = '18800001559', PWD = 'Test1234';
  try {
    console.log('=== ① 打开登录页 ===');
    await page.goto('https://www.vxinchat.com/app/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input', { timeout: 20000 });
    await page.waitForTimeout(3000);

    console.log('=== ② 所有按钮 ===');
    const btns = await page.locator('button').allTextContents().catch(() => []);
    btns.forEach((b, i) => console.log(`  [${i}] "${b.trim().slice(0,30)}"`));
    const submitBtn = page.locator('[data-testid="login-submit-btn"]');
    console.log('=== submit按钮(data-testid) 数量:', await submitBtn.count());

    console.log('=== ③ 填表单 ===');
    await page.locator('input[placeholder*="手机号"]').first().fill(PHONE);
    await page.locator('input[placeholder*="密码"]').first().fill(PWD);
    // 勾协议（记住密码可不勾）
    const cbs = page.locator('input[type="checkbox"]');
    for (let i = 0; i < await cbs.count(); i++) {
      const label = await cbs.nth(i).evaluate(e => (e.closest('label')?.innerText || '').trim()).catch(() => '');
      if (label.includes('协议')) {
        if (!(await cbs.nth(i).isChecked().catch(() => false)))
          await cbs.nth(i).check({ force: true }).catch(() => cbs.nth(i).click({ force: true }).catch(() => {}));
        console.log('  已勾选协议 checkbox');
      }
    }
    await page.waitForTimeout(800);

    console.log('=== ④ 点击 submit (data-testid) ===');
    if (await submitBtn.count() > 0) {
      const disabled = await submitBtn.isDisabled().catch(() => false);
      console.log('  submit disabled:', disabled);
      if (!disabled) {
        await submitBtn.click({ timeout: 8000 }).catch(e => console.log('  ! 点击失败:', e.message.split('\n')[0]));
      } else {
        console.log('  ! submit 被禁用，无法点击');
      }
    } else {
      // 兜底：找 form 里的 type=submit
      console.log('  ! 无 data-testid，尝试 form button[type=submit]');
      const fb = page.locator('form button[type="submit"]');
      console.log('  form submit 数量:', await fb.count());
      if (await fb.count() > 0) await fb.first().click({ timeout: 8000 }).catch(e => console.log('  !', e.message.split('\n')[0]));
    }

    await page.waitForTimeout(7000);
    console.log('=== ⑤ 登录后URL:', page.url());
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const markers = ['聊天', '通讯录', '发现', '消息', '会话', '退出登录', '设置'];
    const hit = markers.filter(m => bodyText.includes(m));
    const stillLogin = bodyText.includes('欢迎登录') || bodyText.includes('请输入手机号');
    console.log('=== 主界面标记:', hit.length ? hit.join(',') : '(无)');
    console.log('=== 仍在登录页:', stillLogin ? '是' : '否');
    console.log('=== body 前250字:', bodyText.slice(0, 250).replace(/\n+/g, ' | '));
    const errLines = bodyText.split('\n').filter(l => l.includes('失败') || l.includes('错误') || l.includes('不正确'));
    if (errLines.length) console.log('=== 页面错误提示:', errLines.join(' | '));

    await page.screenshot({ path: '/root/vxin-1.0/e2e/ui4-final.png' });
    console.log('=== 截图 ui4-final.png');
  } catch (e) {
    console.log('=== 异常:', e.message.split('\n')[0]);
    await page.screenshot({ path: '/root/vxin-1.0/e2e/ui4-error.png' }).catch(() => {});
  } finally {
    await browser.close();
  }
  console.log('DONE');
})();
