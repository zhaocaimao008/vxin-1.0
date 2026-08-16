/**
 * Windows 端视觉验收 - Electron 截图
 * 策略：使用 Playwright Electron 启动桌面端，截图 renderer
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { _electron: electron } = require('@playwright/test');
const { startBackend } = require('./shared/backend/fixture');
const { seedUsers, uniquePhone } = require('./shared/backend/seed');
const env = require('./shared/env');

const ACTUAL_DIR = path.join(__dirname, '..', 'ui-audit', 'windows', 'actual');
const ELECTRON_DIR = path.join(__dirname, '..', 'desktop-electron');
const WEB_DIST = path.join(__dirname, '..', 'web', 'dist');

// Windows 8 页
const PAGES = [
  { name: 'Windows登录页', route: '/' },
  { name: 'Windows注册页', route: '/register' },
  { name: 'Windows端主要界面', route: '/', needsLogin: true },
  { name: 'Windows聊天详情页', route: '/', needsLogin: true, nav: 'chat' },
  { name: 'Windows联系人页', route: '/', needsLogin: true, nav: 'contacts' },
  { name: 'Windows动态页', route: '/', needsLogin: true, nav: 'moments' },
  { name: 'Windows端设置页', route: '/', needsLogin: true, nav: 'settings' },
  { name: 'Windows端个人资料页', route: '/', needsLogin: true, nav: 'settings', sub: 'profile' },
];

async function main() {
  // 1. 准备目录
  if (!fs.existsSync(ACTUAL_DIR)) {
    fs.mkdirSync(ACTUAL_DIR, { recursive: true });
  }

  // 2. 检查 Web dist
  if (!fs.existsSync(WEB_DIST)) {
    console.error('❌ Web dist 不存在，请先构建: cd web && npm run build');
    process.exit(1);
  }

  // 3. 启动隔离后端
  console.log('🚀 启动隔离后端...');
  const backend = await startBackend();
  const testPhone = uniquePhone();
  await seedUsers([{ username: 'VisualWin', phone: testPhone, password: 'e2epass1234', inviteCode: '123456', nickname: 'Test User' }]);
  console.log(`✅ 后端: ${env.BACKEND_URL}`);
  console.log(`✅ 测试账号: ${testPhone} / e2epass1234`);

  let app, window;
  const results = [];

  try {
    // 4. 启动 Electron
    console.log('🖥️  启动 Electron...');
    app = await electron.launch({
      executablePath: path.join(ELECTRON_DIR, 'node_modules', 'electron', 'dist', 'electron'),
      args: [ELECTRON_DIR, '--no-sandbox'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        VISUAL_AUDIT: '1', // 桌面端识别：禁用 sandbox（仅测试），与 --no-sandbox 一致
        VXIN_API_URL: env.BACKEND_URL, // 覆盖后端地址
      },
    });

    window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    console.log('✅ Electron 启动成功');

    // 5. 逐页截图
    for (const page of PAGES) {
      console.log(`\n📸 ${page.name}...`);
      
      try {
        if (page.needsLogin) {
          // 登录
          const loginInput = await window.locator('input[placeholder*="手机号"]').first();
          if (await loginInput.isVisible({ timeout: 2000 })) {
            await loginInput.fill(testPhone);
            await window.locator('input[type="password"]').fill('e2epass1234');
            const checkbox = await window.locator('input[type="checkbox"]').first();
            if (await checkbox.isVisible()) await checkbox.check();
            await window.locator('button:has-text("登录")').click();
            await window.waitForTimeout(2000);
          }

          // 导航
          if (page.nav === 'chat') {
            await window.locator('[data-testid="nav-chat"]').click();
          } else if (page.nav === 'contacts') {
            await window.locator('[data-testid="nav-contacts"]').click();
          } else if (page.nav === 'moments') {
            await window.locator('[data-testid="nav-moments"]').click();
          } else if (page.nav === 'settings') {
            await window.locator('[data-testid="nav-settings"]').click();
            if (page.sub === 'profile') {
              await window.waitForTimeout(500);
              await window.locator('.wc-settings-nav-item:has-text("个人资料")').click();
            }
          }
          await window.waitForTimeout(1000);
        } else if (page.route === '/register') {
          await window.locator('a:has-text("立即注册")').click();
          await window.waitForTimeout(1000);
        }

        // 截图
        const filename = `${page.name}.png`;
        const filepath = path.join(ACTUAL_DIR, filename);
        await window.screenshot({ path: filepath });
        console.log(`   ✓ ${filename}`);
        
        results.push({ page: page.name, status: 'ok', file: filename });
      } catch (err) {
        console.error(`   ✗ 失败: ${err.message}`);
        results.push({ page: page.name, status: 'error', error: err.message });
      }
    }

    // 6. 保存结果
    const resultsFile = path.join(ACTUAL_DIR, '..', 'results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n✅ 结果已保存: ${resultsFile}`);

  } finally {
    if (app) await app.close();
    if (backend) await backend.stop();
  }

  const okCount = results.filter(r => r.status === 'ok').length;
  console.log(`\n✅ Windows 截图完成: ${okCount}/${PAGES.length}`);
}

main().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
