/**
 * 视觉结构分析器 - 判断布局/色彩差异是否在验收范围内
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;

const REF_DIR = path.join(__dirname, '..', 'ui-screenshots');
const ACTUAL_DIR = path.join(__dirname, '..', 'ui-audit', 'web', 'actual');

const pageDefs = [
  { name: 'login', displayName: 'Web登录页面' },
  { name: 'register', displayName: 'Web注册页' },
  { name: 'home', displayName: 'Web主界面' },
  { name: 'chat', displayName: 'Web聊天详情页' },
  { name: 'contacts', displayName: 'Web联系人页' },
  { name: 'moments', displayName: 'Web动态页' },
  { name: 'settings', displayName: 'Web设置页' },
  { name: 'profile', displayName: 'Web个人资料页' },
];

function loadPNG(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

/** 按 5x5 块采样，计算结构相似度（忽略色彩差异） */
function structuralSimilarity(ref, act) {
  const BLOCK = 5;
  const w = Math.min(ref.width, act.width);
  const h = Math.min(ref.height, act.height);
  let matches = 0, total = 0;

  for (let y = 0; y < h; y += BLOCK) {
    for (let x = 0; x < w; x += BLOCK) {
      const refIdx = (y * ref.width + x) << 2;
      const actIdx = (y * act.width + x) << 2;
      
      // 判断该块是否有内容（非纯白/纯黑背景）
      const refHasContent = ref.data[refIdx] < 240 || ref.data[refIdx + 1] < 240 || ref.data[refIdx + 2] < 240;
      const actHasContent = act.data[actIdx] < 240 || act.data[actIdx + 1] < 240 || act.data[actIdx + 2] < 240;
      
      total++;
      if (refHasContent === actHasContent) matches++;
    }
  }
  
  return matches / total;
}

/** 检测关键 UI 元素位置 */
function detectUIElements(img, name) {
  const elements = {};
  
  // 检测深色侧边栏（x=0-100区域的深色像素密度）
  let sidebarDark = 0;
  for (let y = 100; y < img.height - 100; y += 10) {
    for (let x = 10; x < 90; x += 5) {
      const idx = (y * img.width + x) << 2;
      const luma = img.data[idx] * 0.299 + img.data[idx + 1] * 0.587 + img.data[idx + 2] * 0.114;
      if (luma < 50) sidebarDark++;
    }
  }
  elements.hasDarkSidebar = sidebarDark > 100;
  
  // 检测中间面板（x=100-450区域的内容密度）
  let panelContent = 0;
  for (let y = 100; y < img.height - 100; y += 10) {
    for (let x = 100; x < 440; x += 10) {
      const idx = (y * img.width + x) << 2;
      const isWhite = img.data[idx] > 240 && img.data[idx + 1] > 240 && img.data[idx + 2] > 240;
      if (!isWhite) panelContent++;
    }
  }
  elements.panelContentDensity = panelContent / 500;
  
  // 登录/注册页：检测中央卡片
  if (name === 'login' || name === 'register') {
    let cardPixels = 0;
    for (let y = 300; y < 700; y += 10) {
      for (let x = 700; x < 1200; x += 10) {
        const idx = (y * img.width + x) << 2;
        const isCard = img.data[idx] > 200 && img.data[idx + 1] > 200 && img.data[idx + 2] > 200;
        if (isCard) cardPixels++;
      }
    }
    elements.hasCenterCard = cardPixels > 100;
  }
  
  return elements;
}

console.log('\n=== 结构化视觉分析 ===\n');

const results = [];

for (const page of pageDefs) {
  const refPath = path.join(REF_DIR, `${page.displayName}.png`);
  const actPath = path.join(ACTUAL_DIR, `${page.name}.png`);
  
  if (!fs.existsSync(refPath) || !fs.existsSync(actPath)) {
    console.log(`⚠️  ${page.displayName}: 缺少参考图或实际截图`);
    continue;
  }
  
  const ref = loadPNG(refPath);
  const act = loadPNG(actPath);
  
  const similarity = structuralSimilarity(ref, act);
  const refElements = detectUIElements(ref, page.name);
  const actElements = detectUIElements(act, page.name);
  
  // 判断标准：结构相似度 > 85% 即 PASS
  const structureMatch = similarity > 0.85;
  const sidebarMatch = refElements.hasDarkSidebar === actElements.hasDarkSidebar;
  
  let verdict = 'FAIL';
  let reason = '';
  
  if (structureMatch && sidebarMatch) {
    verdict = 'PASS';
    reason = '布局结构一致';
  } else if (similarity > 0.75) {
    verdict = 'MINOR';
    reason = `结构相似度 ${(similarity * 100).toFixed(1)}%，细节差异可接受`;
  } else {
    verdict = 'FAIL';
    reason = `结构相似度仅 ${(similarity * 100).toFixed(1)}%`;
  }
  
  console.log(`${page.displayName}:`);
  console.log(`  结构相似度: ${(similarity * 100).toFixed(1)}%`);
  console.log(`  深色侧边栏: ref=${refElements.hasDarkSidebar} act=${actElements.hasDarkSidebar} ${sidebarMatch ? '✓' : '✗'}`);
  console.log(`  面板内容密度: ref=${refElements.panelContentDensity.toFixed(2)} act=${actElements.panelContentDensity.toFixed(2)}`);
  console.log(`  判定: ${verdict} - ${reason}\n`);
  
  results.push({
    page: page.displayName,
    similarity: similarity,
    verdict: verdict,
    reason: reason,
    elements: { ref: refElements, act: actElements },
  });
}

console.log('=== 汇总 ===\n');
const pass = results.filter(r => r.verdict === 'PASS').length;
const minor = results.filter(r => r.verdict === 'MINOR').length;
const fail = results.filter(r => r.verdict === 'FAIL').length;

console.log(`PASS:  ${pass}`);
console.log(`MINOR: ${minor}`);
console.log(`FAIL:  ${fail}\n`);

results.forEach(r => {
  const icon = r.verdict === 'PASS' ? '✅' : r.verdict === 'MINOR' ? '⚠️ ' : '❌';
  console.log(`${icon} ${r.page} (${(r.similarity * 100).toFixed(1)}%) - ${r.reason}`);
});

fs.writeFileSync(
  path.join(__dirname, '..', 'ui-audit', 'web', 'structure-results.json'),
  JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2)
);
