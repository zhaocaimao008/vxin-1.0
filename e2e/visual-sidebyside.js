/**
 * 生成 side-by-side 对比截图
 * 参考图 | 实际截图 并排，供目视检查
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('./node_modules/playwright-core');

const CHROME = '/root/.cache/puppeteer/chrome/linux-152.0.7977.42/chrome-linux64/chrome';
const REF_PNG_DIR = path.join(__dirname, '..', 'ui-audit', 'web', 'ref-rendered');
const ACTUAL_DIR = path.join(__dirname, '..', 'ui-audit', 'web', 'actual');
const DIFF_DIR = path.join(__dirname, '..', 'ui-audit', 'web', 'diff');

const PAGES = [
  { name: 'Web登录页面', actual: 'login' },
  { name: 'Web注册页', actual: 'register' },
  { name: 'Web主界面', actual: 'home' },
  { name: 'Web聊天详情页', actual: 'chat' },
  { name: 'Web联系人页', actual: 'contacts' },
  { name: 'Web动态页', actual: 'moments' },
  { name: 'Web设置页', actual: 'settings' },
  { name: 'Web个人资料页', actual: 'profile' },
];

async function main() {
  const browser = await chromium.launch({
    headless: true, executablePath: CHROME,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
  });
  const context = await browser.newContext({ viewport: { width: 3840, height: 1200 } });
  const page = await context.newPage();

  for (const p of PAGES) {
    const refPath = path.join(REF_PNG_DIR, p.name + '-ref.png');
    const actPath = path.join(ACTUAL_DIR, p.actual + '.png');

    if (!fs.existsSync(refPath) || !fs.existsSync(actPath)) {
      console.log(`跳过: ${p.name} (文件缺失)`);
      continue;
    }

    const refB64 = fs.readFileSync(refPath).toString('base64');
    const actB64 = fs.readFileSync(actPath).toString('base64');

    const html = `<!DOCTYPE html>
<html><head><style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#222;display:flex;gap:4px;width:3840px;}
.col{flex:1;position:relative;}
.label{position:absolute;top:4px;left:4px;background:rgba(0,0,0,.7);color:#fff;
  font:700 16px monospace;padding:4px 8px;border-radius:4px;z-index:10;}
img{width:100%;height:1080px;object-fit:contain;display:block;}
</style></head><body>
<div class="col"><div class="label">参考 (origin/main)</div>
<img src="data:image/png;base64,${refB64}"/></div>
<div class="col"><div class="label">实际 (当前构建)</div>
<img src="data:image/png;base64,${actB64}"/></div>
</body></html>`;

    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(300);

    const outPath = path.join(DIFF_DIR, p.name + '-compare.png');
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 3840, height: 1100 } });
    console.log(`✓ ${p.name} → ${outPath}`);
  }

  await browser.close();
  console.log('\n比对截图生成完成');
}

main().catch(e => { console.error(e); process.exit(1); });
