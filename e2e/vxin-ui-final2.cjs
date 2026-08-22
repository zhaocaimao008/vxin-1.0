const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const results = [];
  let loginResp = null;

  // 抓 auth 相关请求/响应
  page.on('response', async r => {
    if (r.url().includes('/api/auth/')) {
      const body = await r.text().catch(() => '(no body)');
      console.log(`  [API ${r.status()}] ${r.request().method()} ${r.url().replace('https://www.vxinchat.com','')} :: ${body.slice(0, 200)}`);
      if (r.url().includes('/login')) loginResp = { status: r.status(), body: body.slice(0, 300) };
    }
  });

  const PHONE = '18800001559', PWD = 'Test1234';
  try {
    console.log('=== ① 打开登录页 ===');
    const resp = await page.goto('https://www.vxinchat.com/app/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    results.push(['打开登录页', resp && resp.status()]);
    await page.waitForSelector('input', { timeout: 20000 });
    await page.waitForTimeout(1500);

    // 填表单
    const phoneInput = page.locator('input[placeholder*="手机号"]').first();
    const pwdInput = page.locator('input[placeholder*="密码"]').first();
    await phoneInput.fill(PHONE);
    await pwdInput.fill(PWD);
    results.push(['填表单', 'OK']);

    // 检查 checkbox 们：label 文本
    const cbCount = await page.locator('input[type="checkbox"]').count();
    console.log('=== ② checkbox 数量:', cbCount);
    const cbLabels = await page.locator('input[type="checkbox"]').evaluateAll(els =>
      els.map((e, i) => {
        const label = e.closest('label')?.innerText?.trim() || e.parentElement?.innerText?.trim() || '';
        return `${i}: checked=${e.checked} label="${label.slice(0, 40)}"`;
      })).catch(() => []);
    cbLabels.forEach(l => console.log('   ', l));

    // 检查登录按钮是否 disabled
    const loginBtn = page.locator('button').filter({ hasText: /登\s*录/ }).first();
    const btnDisabled = await loginBtn.isDisabled().catch(() => false);
    console.log('=== ③ 登录按钮 disabled:', btnDisabled);

    // 勾选所有未勾选的 checkbox（记住密码 + 协议）
    const cbs = page.locator('input[type="checkbox"]');
    for (let i = 0; i < cbCount; i++) {
      const checked = await cbs.nth(i).isChecked().catch(() => false);
      if (!checked) {
        await cbs.nth(i).check({ force: true }).catch(async () => {
          await cbs.nth(i).click({ force: true }).catch(() => {});
        });
        console.log(`  checkbox[${i}] 已勾选`);
      }
    }
    await page.waitForTimeout(500);

    const btnDisabled2 = await loginBtn.isDisabled().catch(() => false);
    console.log('=== ④ 勾选后按钮 disabled:', btnDisabled2);
    results.push(['勾选协议', btnDisabled2 ? '按钮仍禁用' : 'OK']);

    await page.screenshot({ path: '/root/vxin-1.0/e2e/ui2-01-checked.png' });

    // 点登录
    console.log('=== ⑤ 点击登录 ===');
    await loginBtn.click({ timeout: 8000 }).catch(e => console.log('  ! 点击失败:', e.message.split('\n')[0]));
    results.push(['点击登录', 'OK']);

    // 等待跳转
    await page.waitForTimeout(7000);
    console.log('=== ⑥ 登录后URL:', page.url());

    const bodyText = await page.locator('body').innerText().catch(() => '');
    const markers = ['聊天', '通讯录', '发现', '消息', '会话', '退出登录', '设置'];
    const hit = markers.filter(m => bodyText.includes(m));
    const stillLogin = bodyText.includes('欢迎登录') || bodyText.includes('请输入手机号');
    console.log('=== 主界面标记:', hit.length ? hit.join(',') : '(无)');
    console.log('=== 仍在登录页:', stillLogin ? '是' : '否');
    console.log('=== body 前350字:', bodyText.slice(0, 350).replace(/\n+/g, ' | '));
    results.push(['进入主界面', hit.length ? '✅ ' + hit.join(',') : stillLogin ? '❌ 仍停留登录页' : '⚠️ 未知']);

    await page.screenshot({ path: '/root/vxin-1.0/e2e/ui2-02-result.png' });
    console.log('=== 已截图 ui2-02-result.png');
  } catch (e) {
    console.log('=== 异常:', e.message.split('\n')[0]);
    results.push(['异常', e.message.split('\n')[0]]);
    await page.screenshot({ path: '/root/vxin-1.0/e2e/ui2-03-error.png' }).catch(() => {});
  } finally {
    await browser.close();
  }
  console.log('\n=== 结果汇总 ===');
  results.forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log('登录API响应:', loginResp ? `${loginResp.status} ${loginResp.body}` : '(未捕获)');
  console.log('DONE');
})();
