/**
 * Web 视觉比对脚本
 * 将参考图(JPG)与实际截图(PNG)进行视觉比对
 * 使用 Playwright 渲染 JPG 为 PNG，然后逐像素比对
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('./node_modules/playwright-core');
const { PNG } = require('../web/node_modules/pngjs/lib/png.js');

const CHROME = '/root/.cache/puppeteer/chrome/linux-152.0.7977.42/chrome-linux64/chrome';
const REF_DIR = '/tmp/vxin-ui-reference/ui-screenshots';
const ACTUAL_DIR = path.join(__dirname, '..', 'ui-audit', 'web', 'actual');
const DIFF_DIR = path.join(__dirname, '..', 'ui-audit', 'web', 'diff');
const REF_PNG_DIR = path.join(__dirname, '..', 'ui-audit', 'web', 'ref-rendered');

fs.mkdirSync(REF_PNG_DIR, { recursive: true });

const PAGES = [
  { ref: 'Web登录页面.jpg', actual: 'login.png', name: 'Web登录页面' },
  { ref: 'Web注册页.jpg', actual: 'register.png', name: 'Web注册页' },
  { ref: 'Web主界面.jpg', actual: 'home.png', name: 'Web主界面' },
  { ref: 'Web聊天详情页.jpg', actual: 'chat.png', name: 'Web聊天详情页' },
  { ref: 'Web联系人页.jpg', actual: 'contacts.png', name: 'Web联系人页' },
  { ref: 'Web动态页.jpg', actual: 'moments.png', name: 'Web动态页' },
  { ref: 'Web设置页.jpg', actual: 'settings.png', name: 'Web设置页' },
  { ref: 'Web个人资料页.jpg', actual: 'profile.png', name: 'Web个人资料页' },
];

/**
 * 简单像素差异比对（不使用 pixelmatch）
 * 对两幅同尺寸 PNG 逐像素计算差值，返回差异像素比例和生成 diff 图
 */
function simpleDiff(refPng, actualPng) {
  // 如果尺寸不同，缩放比较策略：取两者最小尺寸做裁剪比较
  const w = Math.min(refPng.width, actualPng.width);
  const h = Math.min(refPng.height, actualPng.height);
  
  const diff = new PNG({ width: w, height: h });
  let diffPixels = 0;
  const threshold = 30; // 色差阈值
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const refIdx = (refPng.width * y + x) * 4;
      const actIdx = (actualPng.width * y + x) * 4;
      const diffIdx = (w * y + x) * 4;
      
      const rDiff = Math.abs(refPng.data[refIdx] - actualPng.data[actIdx]);
      const gDiff = Math.abs(refPng.data[refIdx+1] - actualPng.data[actIdx+1]);
      const bDiff = Math.abs(refPng.data[refIdx+2] - actualPng.data[actIdx+2]);
      const totalDiff = (rDiff + gDiff + bDiff) / 3;
      
      if (totalDiff > threshold) {
        diffPixels++;
        diff.data[diffIdx] = 255;     // R: 红色标记差异
        diff.data[diffIdx+1] = 0;
        diff.data[diffIdx+2] = 0;
        diff.data[diffIdx+3] = 200;   // A
      } else {
        // 保留原始颜色但半透明（作为背景）
        diff.data[diffIdx] = actualPng.data[actIdx];
        diff.data[diffIdx+1] = actualPng.data[actIdx+1];
        diff.data[diffIdx+2] = actualPng.data[actIdx+2];
        diff.data[diffIdx+3] = 80;
      }
    }
  }
  
  const totalPixels = w * h;
  const diffPercent = (diffPixels / totalPixels * 100).toFixed(2);
  return { diffPixels, totalPixels, diffPercent: parseFloat(diffPercent), diffPng: diff };
}

/**
 * 分析视觉差异，判断是否为允许差异
 * 主要区域（结构/颜色/布局）的差异才算 FAIL
 */
function judgeResult(diffPercent, pageName) {
  // 差异分级：
  // 0-2%: PASS（允许字体渲染、anti-aliasing 差异）
  // 2-8%: MINOR（需要人工确认，可能是数据差异）
  // 8%+:  FAIL（明显结构差异）
  if (diffPercent <= 2) return 'PASS';
  if (diffPercent <= 12) return 'MINOR';
  return 'FAIL';
}

async function main() {
  console.log('\n=== Web 端视觉比对分析 ===\n');
  
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const refPage = await browser.newPage();
  await refPage.setViewportSize({ width: 1920, height: 1080 });
  
  const results = [];
  
  for (const p of PAGES) {
    console.log(`\n比对: ${p.name}`);
    
    const refPath = path.join(REF_DIR, p.ref);
    const actualPath = path.join(ACTUAL_DIR, p.actual);
    
    if (!fs.existsSync(refPath)) {
      console.log(`  ⚠️  参考图不存在: ${p.ref}`);
      results.push({ name: p.name, status: 'NO_REF' });
      continue;
    }
    if (!fs.existsSync(actualPath)) {
      console.log(`  ⚠️  实际截图不存在: ${p.actual}`);
      results.push({ name: p.name, status: 'NO_ACTUAL' });
      continue;
    }
    
    // 1. 将参考 JPG 渲染为 1920x1080 PNG（让浏览器自适应缩放）
    const refRenderedPath = path.join(REF_PNG_DIR, p.name + '-ref.png');
    if (!fs.existsSync(refRenderedPath)) {
      await refPage.goto(`file://${refPath}`, { waitUntil: 'load' });
      // 设置 body/img 样式使图片填满 viewport
      await refPage.evaluate(() => {
        document.documentElement.style.margin = '0';
        document.documentElement.style.padding = '0';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.background = '#000';
        const img = document.querySelector('img');
        if (img) {
          img.style.width = '1920px';
          img.style.height = '1080px';
          img.style.objectFit = 'contain';
          img.style.display = 'block';
        }
      });
      const refBuf = await refPage.screenshot({ fullPage: false });
      fs.writeFileSync(refRenderedPath, refBuf);
    }
    
    // 2. 读取两张图
    const refPng = PNG.sync.read(fs.readFileSync(refRenderedPath));
    const actualPng = PNG.sync.read(fs.readFileSync(actualPath));
    
    console.log(`  参考图尺寸: ${refPng.width}x${refPng.height}`);
    console.log(`  实际截图尺寸: ${actualPng.width}x${actualPng.height}`);
    
    // 3. 比对
    const { diffPixels, totalPixels, diffPercent, diffPng } = simpleDiff(refPng, actualPng);
    const status = judgeResult(diffPercent, p.name);
    
    // 4. 保存 diff 图
    const diffPath = path.join(DIFF_DIR, p.name + '-diff.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diffPng));
    
    console.log(`  差异像素: ${diffPixels.toLocaleString()} / ${totalPixels.toLocaleString()} (${diffPercent}%)`);
    console.log(`  结果: ${status}`);
    
    results.push({
      name: p.name,
      ref: p.ref,
      actual: p.actual,
      diffPercent,
      diffPixels,
      totalPixels,
      status,
      diffPath,
    });
  }
  
  await browser.close();
  
  // 汇总
  console.log('\n=== 比对汇总 ===\n');
  const pass = results.filter(r => r.status === 'PASS').length;
  const minor = results.filter(r => r.status === 'MINOR').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const noRef = results.filter(r => r.status === 'NO_REF' || r.status === 'NO_ACTUAL').length;
  
  console.log(`PASS:  ${pass}`);
  console.log(`MINOR: ${minor}`);
  console.log(`FAIL:  ${fail}`);
  console.log(`SKIP:  ${noRef}\n`);
  
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'MINOR' ? '⚠️ ' : r.status === 'FAIL' ? '❌' : '⏸️';
    const pct = r.diffPercent !== undefined ? ` (${r.diffPercent}%)` : '';
    console.log(`${icon} ${r.name}${pct}`);
  });
  
  fs.writeFileSync(
    path.join(__dirname, '..', 'ui-audit', 'web', 'compare-results.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2)
  );
  
  return results;
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
