/**
 * Web 端视觉验收脚本
 * 启动隔离测试后端 + 造测试账号 + 截取登录后6个页面 + 与参考图比对
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { startBackend } = require('./shared/backend/fixture');
const { seedUsers, uniquePhone, befriendAndOpenConv } = require('./shared/backend/seed');
const env = require('./shared/env');

const CHROME = '/root/.cache/puppeteer/chrome/linux-152.0.7977.42/chrome-linux64/chrome';
const REF_DIR = '/tmp/vxin-ui-reference/ui-screenshots';
const ACTUAL_DIR = path.join(__dirname, '..', 'ui-audit', 'web', 'actual');
const DIFF_DIR = path.join(__dirname, '..', 'ui-audit', 'web', 'diff');
const WEB_DIST = path.join(__dirname, '..', 'web', 'dist');

// 参考图映射到页面路径和操作
const WEB_PAGES = [
  { ref: 'Web登录页面.jpg', name: 'login', path: '/login', needsAuth: false, action: null },
  { ref: 'Web注册页.jpg', name: 'register', path: '/register', needsAuth: false, action: null },
  { ref: 'Web主界面.jpg', name: 'home', path: '/', needsAuth: true, action: async (page) => {
    await page.waitForSelector('[data-testid="nav-tab-chats"]', { timeout: 15000 });
    await page.waitForTimeout(1000); // 等会话列表加载
  }},
  { ref: 'Web聊天详情页.jpg', name: 'chat', path: '/', needsAuth: true, action: async (page, ctx) => {
    await page.waitForSelector('[data-testid="nav-tab-chats"]', { timeout: 15000 });
    await page.waitForTimeout(800);
    // 打开第一个会话或使用预建会话
    const convItems = page.locator('[data-testid^="conv-item-"]');
    const count = await convItems.count();
    if (count > 0) {
      await convItems.first().click();
      await page.waitForSelector('[data-testid="chat-msg-input"]', { timeout: 10000 });
      await page.waitForTimeout(500);
    }
  }},
  { ref: 'Web联系人页.jpg', name: 'contacts', path: '/', needsAuth: true, action: async (page) => {
    await page.waitForSelector('[data-testid="nav-tab-chats"]', { timeout: 15000 });
    await page.waitForTimeout(500);
    const contactsTab = page.locator('[data-testid="nav-tab-contacts"]').first();
    if (await contactsTab.count() > 0) {
      await contactsTab.click();
      await page.waitForTimeout(1000);
    }
  }},
  { ref: 'Web动态页.jpg', name: 'moments', path: '/', needsAuth: true, action: async (page) => {
    await page.waitForSelector('[data-testid="nav-tab-chats"]', { timeout: 15000 });
    await page.waitForTimeout(500);
    const momentsTab = page.locator('[data-testid="nav-tab-moments"]').first();
    if (await momentsTab.count() > 0) {
      await momentsTab.click();
      await page.waitForTimeout(1000);
    }
  }},
  { ref: 'Web设置页.jpg', name: 'settings', path: '/', needsAuth: true, action: async (page) => {
    await page.waitForSelector('[data-testid="nav-tab-chats"]', { timeout: 15000 });
    await page.waitForTimeout(500);
    const meTab = page.locator('[data-testid="nav-tab-me"]').first();
    if (await meTab.count() > 0) {
      await meTab.click();
      await page.waitForTimeout(800);
      // 点击设置按钮
      const settingsBtn = page.locator('[data-testid="settings-btn"]').first();
      if (await settingsBtn.count() > 0) {
        await settingsBtn.click();
        await page.waitForTimeout(800);
      }
    }
  }},
  { ref: 'Web个人资料页.jpg', name: 'profile', path: '/', needsAuth: true, action: async (page) => {
    await page.waitForSelector('[data-testid="nav-tab-chats"]', { timeout: 15000 });
    await page.waitForTimeout(500);
    const meTab = page.locator('[data-testid="nav-tab-me"]').first();
    if (await meTab.count() > 0) {
      await meTab.click();
      await page.waitForTimeout(800);
      // 点击个人资料区域（头像或名字）
      const profileBtn = page.locator('[data-testid="profile-btn"]').first();
      if (await profileBtn.count() > 0) {
        await profileBtn.click();
        await page.waitForTimeout(800);
      } else {
        // 备选：点击头像
        const avatar = page.locator('.wc-sidebar-me-avatar').first();
        if (await avatar.count() > 0) {
          await avatar.click();
          await page.waitForTimeout(800);
        }
      }
    }
  }},
];

async function startWebServer(backendUrl, token) {
  const http = require('http');
  const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
    '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  };
  
  const backend = new URL(backendUrl);
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rawPath = req.url.split('?')[0];
      
      // 反代 /uploads 和 /downloads
      if (rawPath.startsWith('/uploads') || rawPath.startsWith('/downloads')) {
        const proxyReq = http.request({
          hostname: backend.hostname,
          port: backend.port,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: backend.host, authorization: `Bearer ${token}` },
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
          proxyRes.pipe(res);
        });
        proxyReq.on('error', () => { res.writeHead(502); res.end('proxy error'); });
        req.pipe(proxyReq);
        return;
      }
      
      let p = decodeURIComponent(rawPath);
      if (p === '/') p = '/index.html';
      let file = path.join(WEB_DIST, p);
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        file = path.join(WEB_DIST, 'index.html');
      }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    server.listen(4178, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  console.log('\n=== Phase 1: Web 端视觉验收 ===\n');
  
  // 1. 启动隔离测试后端
  console.log('启动测试后端...');
  const backend = await startBackend({ fresh: true });
  console.log(`✓ 后端就绪: ${env.BACKEND_URL}`);
  
  // 2. 造测试账号
  console.log('创建测试账号...');
  const users = await seedUsers([
    { username: 'VisualTestA', phone: uniquePhone() },
    { username: 'VisualTestB', phone: uniquePhone() },
  ]);
  console.log(`✓ 已创建 ${users.length} 个测试账号`);
  
  // 3. A↔B 建好友+会话
  let convAB = null;
  try {
    convAB = await befriendAndOpenConv(users[0], users[1]);
    console.log(`✓ 已建好友关系和会话`);
  } catch (e) {
    console.warn(`⚠️  建好友失败: ${e.message}`);
  }
  
  // 4. 启动 web 静态服务器
  console.log('启动 web 静态服务器...');
  const webServer = await startWebServer(env.BACKEND_URL, users[0].token);
  console.log(`✓ web 服务就绪: ${env.WEB_URL}`);
  
  // 5. 启动浏览器
  console.log('启动浏览器...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  
  // 注入后端地址到 localStorage
  await context.addInitScript((url) => {
    try { localStorage.setItem('vxin_server_url', url); } catch {}
  }, env.BACKEND_URL);
  
  const page = await context.newPage();
  console.log('✓ 浏览器就绪\n');
  
  // 6. 逐页截图
  const results = [];
  
  for (const pageInfo of WEB_PAGES) {
    console.log(`截图: ${pageInfo.name} (${pageInfo.ref})`);
    
    try {
      // 导航
      await page.goto(env.WEB_URL + pageInfo.path, { waitUntil: 'networkidle', timeout: 20000 });
      
      // 需要登录的页面先登录
      if (pageInfo.needsAuth) {
        const needLogin = await page.locator('[data-testid="login-phone-input"]').count() > 0;
        if (needLogin) {
          console.log(`  → 登录中...`);
          await page.locator('[data-testid="login-phone-input"]').fill(users[0].phone);
          await page.locator('[data-testid="login-password-input"]').fill(users[0].password);
          // 勾选协议复选框
          await page.locator('[data-testid="login-agreement-checkbox"]').check();
          await page.waitForTimeout(200);
          await page.locator('[data-testid="login-submit-btn"]').click();
          await page.waitForTimeout(2000);
        }
      }
      
      // 执行页面特定操作
      if (pageInfo.action) {
        await pageInfo.action(page, { users, convAB });
      }
      
      // 截图
      const actualPath = path.join(ACTUAL_DIR, `${pageInfo.name}.png`);
      await page.screenshot({ path: actualPath, fullPage: false });
      console.log(`  ✓ 已保存: ${actualPath}`);
      
      results.push({
        name: pageInfo.name,
        ref: pageInfo.ref,
        actual: actualPath,
        status: 'captured',
      });
      
    } catch (error) {
      console.error(`  ✗ 失败: ${error.message}`);
      results.push({
        name: pageInfo.name,
        ref: pageInfo.ref,
        status: 'failed',
        error: error.message,
      });
    }
    
    await page.waitForTimeout(300);
  }
  
  // 7. 清理
  await browser.close();
  webServer.close();
  await backend.stop();
  
  console.log('\n=== 截图完成 ===\n');
  
  // 8. 生成报告
  const pass = results.filter(r => r.status === 'captured').length;
  const fail = results.filter(r => r.status === 'failed').length;
  
  console.log(`总计: ${WEB_PAGES.length} 页`);
  console.log(`成功: ${pass} 页`);
  console.log(`失败: ${fail} 页\n`);
  
  if (fail > 0) {
    console.log('失败页面:');
    results.filter(r => r.status === 'failed').forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
  
  // 保存结果
  fs.writeFileSync(
    path.join(__dirname, '..', 'ui-audit', 'web', 'results.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2)
  );
  
  console.log('\n下一步: 运行视觉比对生成差异图');
  console.log('命令: node /root/v信/e2e/visual-compare-web.js\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
