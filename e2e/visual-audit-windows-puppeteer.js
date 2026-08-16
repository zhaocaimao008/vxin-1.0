const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

const ELECTRON_DIR = path.join(__dirname, '..', 'desktop-electron');
const OUTPUT_DIR = path.join(__dirname, '..', 'ui-audit', 'windows', 'actual');
const REF_DIR = path.join(__dirname, '..', 'ui-screenshots');

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // 启动 Electron with remote debugging
  console.log('🖥️  启动 Electron...');
  const electronPath = path.join(ELECTRON_DIR, 'node_modules', '.bin', 'electron');
  const mainPath = path.join(ELECTRON_DIR, 'src', 'main.js');
  
  const electronProcess = spawn('xvfb-run', [
    '--auto-servernum',
    '--server-args=-screen 0 1920x1080x24',
    electronPath,
    mainPath,
    '--no-sandbox',
    '--remote-debugging-port=9223'
  ], {
    env: {
      ...process.env,
      VISUAL_AUDIT: '1',
      NODE_ENV: 'development',
      DISPLAY: ':99'
    }
  });

  electronProcess.stdout.on('data', (data) => console.log(data.toString()));
  electronProcess.stderr.on('data', (data) => console.error(data.toString()));

  // 等待调试端口就绪
  console.log('⏳ 等待远程调试端口...');
  let debugUrl;
  for (let i = 0; i < 30; i++) {
    try {
      const response = await fetch('http://localhost:9223/json/version');
      const data = await response.json();
      debugUrl = data.webSocketDebuggerUrl;
      if (debugUrl) {
        console.log('✓ 调试端口就绪');
        break;
      }
    } catch (e) {
      // 继续等待
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!debugUrl) {
    throw new Error('无法连接到 Electron 调试端口');
  }

  // 连接到 Electron
  const browser = await puppeteer.connect({
    browserWSEndpoint: debugUrl,
    defaultViewport: { width: 1920, height: 1080 }
  });

  const pages = await browser.pages();
  console.log(`找到 ${pages.length} 个页面`);
  
  if (pages.length === 0) {
    throw new Error('没有找到页面');
  }

  const page = pages[0];
  await page.setViewport({ width: 1920, height: 1080 });
  
  // 等待页面加载
  console.log('⏳ 等待页面加载...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 截图
  console.log('📸 开始截图...');
  const screenshotPath = path.join(OUTPUT_DIR, 'main.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`✓ 保存截图: ${screenshotPath}`);

  // 清理
  await browser.disconnect();
  electronProcess.kill();
  
  console.log('✅ 完成');
}

main().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
