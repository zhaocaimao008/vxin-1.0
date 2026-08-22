const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const failed = [];
  page.on('requestfailed', r => failed.push(`[FAIL] ${r.url().slice(0,90)} :: ${r.failure()?.errorText}`));
  page.on('response', r => { if (r.status() >= 400) failed.push(`[HTTP${r.status()}] ${r.url().slice(0,90)}`); });

  const PHONE = '18800001559', PWD = 'Test1234';
  try {
    console.log('=== 打开网页版 ===');
    const resp = await page.goto('https://www.vxinchat.com/app/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('=== 初始状态码:', resp && resp.status());
    console.log('=== 最终URL:', page.url());
    await page.waitForTimeout(5000);

    // 等登录表单或主界面任一出现
    await page.waitForSelector('input', { timeout: 20000 }).then(() => {
      console.log('=== input 出现!');
    }).catch(() => console.log('=== ! 无 input, 页面内容如下 ==='));

    const body = await page.locator('body').innerText().catch(() => '(empty)');
    console.log('=== body 前600字 ===');
    console.log(body.slice(0, 600));

    console.log('=== 网络失败/4xx ===');
    failed.forEach(f => console.log(' ', f));
    if (!failed.length) console.log('  (无失败)');

    await page.screenshot({ path: '/root/vxin-1.0/e2e/vxin-app-initial.png' });
    console.log('=== 已截图 vxin-app-initial.png');
  } catch (e) {
    console.log('=== 异常:', e.message.split('\n')[0]);
    await page.screenshot({ path: '/root/vxin-1.0/e2e/vxin-app-error.png' }).catch(() => {});
  } finally {
    await browser.close();
  }
  console.log('DONE');
})();
