const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const failed = [];
  page.on('requestfailed', r => failed.push(`[FAIL] ${r.method()} ${r.url().slice(0,100)} :: ${r.failure()?.errorText}`));
  page.on('response', r => { if (r.status() >= 400) failed.push(`[HTTP${r.status()}] ${r.url().slice(0,100)}`); });
  page.on('console', m => console.log('  [console]', m.type(), m.text().slice(0, 150)));
  page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 200)));

  try {
    console.log('=== goto vxinchat.com ===');
    const resp = await page.goto('https://vxinchat.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('=== 初始状态码:', resp && resp.status());
    await page.waitForTimeout(6000); // 给SPA更多时间

    console.log('=== 页面文本(前800字) ===');
    const body = await page.locator('body').innerText().catch(() => '(empty)');
    console.log(body.slice(0, 800));

    console.log('=== 网络失败/4xx ===');
    failed.forEach(f => console.log(' ', f));
    if (!failed.length) console.log('  (无失败请求)');
  } catch (e) {
    console.log('=== 异常:', e.message.split('\n')[0]);
  } finally {
    await browser.close();
  }
  console.log('DONE');
})();
