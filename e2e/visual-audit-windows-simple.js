/**
 * Windows 端视觉验收 - Electron 截图（简化版，使用现有后端）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { _electron: electron } = require('@playwright/test');

const ACTUAL_DIR = path.join(__dirname, '..', 'ui-audit', 'windows', 'actual');
const ELECTRON_DIR = path.join(__dirname, '..', 'desktop-electron');

// Windows 8 页
const PAGES = [
  { name: 'Windows登录页', file: 'windows-login.png' },
  { name: 'Windows注册页', file: 'windows-register.png', clickRegister: true },
  { name: 'Windows端主要界面', file: 'windows-home.png', needsLogin: true },
  { name: 'Windows聊天详情页', file: 'windows-chat.png', needsLogin: true },
  { name: 'Windows联系人页', file: 'windows-contacts.png', needsLogin: true },
  { name: 'Windows动态页', file: 'windows-moments.png', needsLogin: true },
  { name: 'Windows端设置页', file: 'windows-settings.png', needsLogin: true },
  { name: 'Windows端个人资料页', file: 'windows-profile.png', needsLogin: true },
];

// 测试账号（使用 Web audit 创建的）
const TEST_PHONE = '13800000001';
const TEST_PASS = 'test123456';

async function main() {
  // 1. 准备目录
  if (!fs.existsSync(ACTUAL_DIR)) {
    fs.mkdirSync(ACTUAL_DIR, { recursive: true });
  }

  console.log('🖥️  启动 Electron...');

  const app = await electron.launch({
    executablePath: path.join(ELECTRON_DIR, 'node_modules', '.bin', 'electron'),
    args: [
      path.join(ELECTRON_DIR, 'src', 'main.js'),
      '--no-sandbox',
    ],
    env: {
      ...process.env,
      NODE_ENV: 'development',
      ELECTRON_ENABLE_LOGGING: '1',
    },
    timeout: 60000,
  });

  console.log('⏳ 等待窗口创建...');

  // Electron 窗口设置了 show:false，需要等待它被创建（即使隐藏）
  let window;
  const startTime = Date.now();
  while (!window && Date.now() - startTime < 30000) {
    const windows = app.windows();
    if (windows.length > 0) {
      window = windows[0];
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!window) {
    throw new Error('无法获取 Electron 窗口');
  }

  console.log('✓ 窗口已创建');
  await window.waitForLoadState('domcontentloaded', { timeout: 30000 });
  await window.waitForTimeout(3000);
  console.log('✅ Electron 启动成功');

  const results = [];
  let loggedIn = false;

  try {
    for (const page of PAGES) {
      console.log(`\n📸 ${page.name}...`);
      
      try {
        // 处理登录
        if (page.needsLogin && !loggedIn) {
          console.log('   → 登录中...');
          const phoneInput = await window.locator('input[placeholder*="手机"]').first();
          await phoneInput.waitFor({ timeout: 5000 });
          await phoneInput.fill(TEST_PHONE);
          await window.locator('input[type="password"]').fill(TEST_PASS);
          
          // 勾选协议
          const checkbox = await window.locator('input[type="checkbox"]').first();
          if (await checkbox.isVisible().catch(() => false)) {
            await checkbox.check();
          }
          
          await window.locator('button:has-text("登录")').click();
          await window.waitForTimeout(3000);
          loggedIn = true;
          console.log('   ✓ 登录成功');
        }

        // 注册页面
        if (page.clickRegister) {
          const registerLink = await window.locator('a:has-text("注册")').first();
          await registerLink.click();
          await window.waitForTimeout(1500);
        }

        // 截图
        const filepath = path.join(ACTUAL_DIR, page.file);
        await window.screenshot({ path: filepath });
        console.log(`   ✓ ${page.file}`);
        
        results.push({ page: page.name, status: 'ok', file: page.file });

        // 登录后页面需要导航回主页
        if (page.clickRegister) {
          await window.locator('a:has-text("登录")').first().click();
          await window.waitForTimeout(1000);
        }

      } catch (err) {
        console.error(`   ✗ 失败: ${err.message}`);
        results.push({ page: page.name, status: 'error', error: err.message });
      }
    }

    const resultsFile = path.join(ACTUAL_DIR, '..', 'windows-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));

  } finally {
    await app.close();
  }

  const okCount = results.filter(r => r.status === 'ok').length;
  console.log(`\n✅ Windows 截图完成: ${okCount}/${PAGES.length}`);
  
  if (okCount < PAGES.length) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
