const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });

  page.on('request', r => {
    if (r.url().includes('/api/auth/')) console.log(`  [REQ] ${r.method()} ${r.url().replace('https://','')}`);
  });
  page.on('response', async r => {
    if (r.url().includes('/api/auth/')) {
      const body = await r.text().catch(() => '(no body)');
      console.log(`  [RES ${r.status()}] ${r.request().method()} ${r.url().replace('https://','')} :: ${body.slice(0,250)}`);
    }
  });
  page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 300)));

  const PHONE = '18800001559', PWD = 'Test1234';
  try {
    console.log('=== ① 打开登录页 ===');
    await page.goto('https://www.vxinchat.com/app/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input', { timeout: 20000 });
    await page.waitForTimeout(3000);

    console.log('=== ② 填表单 ===');
    await page.locator('input[placeholder*="手机号"]').first().fill(PHONE);
    await page.locator('input[placeholder*="密码"]').first().fill(PWD);

    // 勾协议 checkbox（索引1），用 label 点击最可靠
    const agreeLabel = page.locator('label:has-text("我已阅读并同意")');
    const agreeLabelCnt = await agreeLabel.count().catch(() => 0);
    console.log('=== ③ 协议 label 数量:', agreeLabelCnt);
    if (agreeLabelCnt > 0) {
      await agreeLabel.first().click({ timeout: 5000 }).catch(e => console.log('  ! label点击失败:', e.message.split('\n')[0]));
    } else {
      // 兜底：直接点击第2个 checkbox
      const cb1 = page.locator('input[type="checkbox"]').nth(1);
      await cb1.check({ force: true }).catch(() => cb1.click({ force: true }).catch(() => {}));
      console.log('  (label未找到，直接勾 checkbox[1])');
    }
    await page.waitForTimeout(1000);

    const submitBtn = page.locator('[data-testid="login-submit-btn"]');
    const disabled = await submitBtn.isDisabled().catch(() => true);
    console.log('=== ④ submit disabled:', disabled);

    if (!disabled) {
      console.log('=== ⑤ 点击登录 submit ===');
      await submitBtn.click({ timeout: 8000 });
      await page.waitForTimeout(7000);
      console.log('=== ⑥ 登录后URL:', page.url());
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const markers = ['聊天', '通讯录', '发现', '消息', '会话', '退出登录', '设置'];
      const hit = markers.filter(m => bodyText.includes(m));
      const stillLogin = bodyText.includes('欢迎登录') || bodyText.includes('请输入手机号');
      console.log('=== 主界面标记:', hit.length ? hit.join(',') : '(无)');
      console.log('=== 仍在登录页:', stillLogin ? '是' : '否');
      console.log('=== body 前300字:', bodyText.slice(0, 300).replace(/\n+/g, ' | '));
      const errLines = bodyText.split('\n').filter(l => l.includes('失败') || l.includes('错误') || l.includes('不正确'));
      if (errLines.length) console.log('=== 页面错误:', errLines.join(' | '));
    } else {
      console.log('=== ! submit 仍禁用，无法继续 ===');
    }

    await page.screenshot({ path: '/root/vxin-1.0/e2e/ui5-final.png' });
    console.log('=== 截图 ui5-final.png');
  } catch (e) {
    console.log('=== 异常:', e.message.split('\n')[0]);
    await page.screenshot({ path: '/root/vxin-1.0/e2e/ui5-error.png' }).catch(() => {});
  } finally {
    await browser.close();
  }
  console.log('DONE');
})();
