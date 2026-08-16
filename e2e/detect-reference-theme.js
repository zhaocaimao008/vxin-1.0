/**
 * 检测参考图的主题模式（LIGHT / DARK）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;

const SHOTS_DIR = path.join(__dirname, 'shots');

// Web 参考图映射
const webRefs = [
  { file: 'ui-login.png', page: 'login', displayName: 'Web登录页面' },
  { file: '01-login.png', page: 'login-alt', displayName: 'Web登录页面(备用)' },
  { file: 'ui-home.png', page: 'home', displayName: 'Web主界面' },
  { file: '02-chatlist.png', page: 'home-alt', displayName: 'Web主界面(备用)' },
  { file: 'ui-chat.png', page: 'chat', displayName: 'Web聊天详情页' },
  { file: '03-chat.png', page: 'chat-alt', displayName: 'Web聊天详情页(备用)' },
  { file: '04-contacts.png', page: 'contacts', displayName: 'Web联系人页' },
  { file: '05-moments.png', page: 'moments', displayName: 'Web动态页' },
  { file: 'settings.png', page: 'settings', displayName: 'Web设置页' },
  { file: '06-me.png', page: 'profile', displayName: 'Web个人资料页' },
];

function detectTheme(pngPath) {
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  const { width, height, data } = png;
  
  // 采样策略：检查主背景区域（排除边缘）
  let darkPixels = 0;
  let lightPixels = 0;
  let totalSampled = 0;
  
  // 采样中央区域和侧边栏
  for (let y = 100; y < height - 100; y += 8) {
    for (let x = 50; x < width - 50; x += 8) {
      const idx = (y * width + x) << 2;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      
      totalSampled++;
      if (luma < 100) darkPixels++;
      else if (luma > 200) lightPixels++;
    }
  }
  
  const darkRatio = darkPixels / totalSampled;
  const lightRatio = lightPixels / totalSampled;
  
  // 判断标准
  let theme = 'MIXED';
  if (darkRatio > 0.4) theme = 'DARK';
  else if (lightRatio > 0.6) theme = 'LIGHT';
  
  // 额外检查：sidebar 区域（x=0-100）
  let sidebarDark = 0;
  for (let y = 100; y < height - 100; y += 10) {
    for (let x = 10; x < 90; x += 5) {
      const idx = (y * width + x) << 2;
      const luma = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
      if (luma < 50) sidebarDark++;
    }
  }
  const hasDarkSidebar = sidebarDark > 100;
  
  return {
    theme,
    darkRatio: (darkRatio * 100).toFixed(1),
    lightRatio: (lightRatio * 100).toFixed(1),
    hasDarkSidebar,
    width,
    height,
  };
}

console.log('\n=== 参考图主题检测 ===\n');

const results = [];

for (const ref of webRefs) {
  const filePath = path.join(SHOTS_DIR, ref.file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${ref.displayName}: 文件不存在 ${ref.file}`);
    continue;
  }
  
  const analysis = detectTheme(filePath);
  
  console.log(`${ref.displayName} (${ref.file}):`);
  console.log(`  主题: ${analysis.theme}`);
  console.log(`  暗色像素: ${analysis.darkRatio}%`);
  console.log(`  亮色像素: ${analysis.lightRatio}%`);
  console.log(`  深色侧边栏: ${analysis.hasDarkSidebar ? '是' : '否'}`);
  console.log(`  尺寸: ${analysis.width}×${analysis.height}\n`);
  
  results.push({
    page: ref.page,
    displayName: ref.displayName,
    file: ref.file,
    theme: analysis.theme,
    darkRatio: parseFloat(analysis.darkRatio),
    lightRatio: parseFloat(analysis.lightRatio),
    hasDarkSidebar: analysis.hasDarkSidebar,
    size: `${analysis.width}×${analysis.height}`,
  });
}

// 保存结果
const outputPath = path.join(__dirname, '..', 'ui-audit', 'reference-themes.json');
fs.writeFileSync(outputPath, JSON.stringify({ 
  timestamp: new Date().toISOString(),
  results 
}, null, 2));

console.log(`✓ 主题检测结果已保存到 ui-audit/reference-themes.json\n`);

// 汇总
const dark = results.filter(r => r.theme === 'DARK').length;
const light = results.filter(r => r.theme === 'LIGHT').length;
const mixed = results.filter(r => r.theme === 'MIXED').length;

console.log('=== 汇总 ===\n');
console.log(`DARK:  ${dark}`);
console.log(`LIGHT: ${light}`);
console.log(`MIXED: ${mixed}\n`);
