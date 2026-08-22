const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on('console', m => { if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 180)); });
  page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 180)));

  const PHONE = '18800001559', PWD = 'Test1234';
  const results = [];
  try {
    console.log('=== ① 打开网页版登录页 ===');
    const resp = await page.goto('https://www.vxinchat.com/app/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    results.push(['打开登录页', resp && resp.status()]);
    console.log('=== 状态码:', resp && resp.status(), '| URL:', page.url());
    await page.waitForSelector('input', { timeout: 20000 });
    results.push(['登录表单渲染', 'OK']);

    // 定位手机号/密码输入框
    const inputs = page.locator('input');
    const n = await inputs.count();
    console.log('=== ② input 数量:', n);
    const placeholders = await inputs.evaluateAll(els =>
      els.map(e => `${e.placeholder}|type=${e.type}`)).catch(() => []);
    console.log('=== 输入框:', JSON.stringify(placeholders));

    // 手机号输入框：placeholder 含"手机号"或第一个
    const phoneInput = page.locator('input[placeholder*="手机号"]').first();
    const pwdInput = page.locator('input[placeholder*="密码"]').first();
    if (await phoneInput.count() === 0 || await pwdInput.count() === 0) {
      console.log('  ! 按placeholder找不到，用 index 0/1');
      results.push(['定位输入框', 'placeholder失败,用index']);
    } else {
      results.push(['定位输入框', 'OK']);
    }

    await phoneInput.fill(PHONE).catch(async () => { await inputs.nth(0).fill(PHONE); });
    await pwdInput.fill(PWD).catch(async () => { await inputs.nth(1).fill(PWD); });
    console.log('=== ③ 已填表单');
    results.push(['填表单', 'OK']);
    await page.screenshot({ path: '/root/vxin-1.0/e2e/ui-01-filled.png' });

    // 找登录按钮并点击
    const loginBtn = page.locator('button').filter({ hasText: /登\s*录/ }).first();
    const btnCnt = await loginBtn.count();
    console.log('=== ④ 登录按钮数量:', btnCnt);
    if (btnCnt > 0) {
      await loginBtn.click({ timeout: 8000 });
      results.push(['点击登录', 'OK']);
      console.log('=== 已点击登录');
    } else {
      results.push(['点击登录', '按钮未找到']);
      console.log('=== ! 登录按钮未找到');
    }

    // 等待登录跳转（可能走 SPA 路由或刷新）
    await page.waitForTimeout(6000);
    console.log('=== ⑤ 登录后URL:', page.url());

    const bodyText = await page.locator('body').innerText().catch(() => '');
    const markers = ['聊天', '通讯录', '发现', '我', '消息', '会话', '退出'];
    const hit = markers.filter(m => bodyText.includes(m));
    console.log('=== 主界面标记命中:', hit.length ? hit.join(',') : '(无)');
    const stillLogin = bodyText.includes('欢迎登录') || bodyText.includes('手机号');
    console.log('=== 仍在登录页:', stillLogin ? '是(登录失败?)' : '否');
    results.push(['进入主界面', hit.length ? hit.join(',') : stillLogin ? '仍停留登录页' : '未知状态']);
    console.log('=== body 前400字:', bodyText.slice(0, 400).replace(/\n+/g, ' | '));

    await page.screenshot({ path: '/root/vxin-1.0/e2e/ui-02-after-login.png' });
    console.log('=== 已截图 ui-02-after-login.png');
  } catch (e) {
    console.log('=== 异常:', e.message.split('\n')[0]);
    results.push(['异常', e.message.split('\n')[0]]);
    await page.screenshot({ path: '/root/vxin-1.0/e2e/ui-03-error.png' }).catch(() => {});
  } finally {
    await browser.close();
  }
  console.log('\n=== 结果汇总 ===');
  results.forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log('DONE');
})();
