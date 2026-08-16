/**
 * Web 端视觉验收 - 主题匹配版
 * 根据参考图的主题（DARK/LIGHT）自动切换实际截图的主题
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { startBackend } = require('./shared/backend/fixture');
const { seedUsers, uniquePhone, befriendAndOpenConv } = require('./shared/backend/seed');
const env = require('./shared/env');

const CHROME = '/root/.cache/puppeteer/chrome/linux-152.0.7977.42/chrome-linux64/chrome';
const ACTUAL_DIR = path.join(__dirname, '..', 'ui-audit', 'web', 'actual');
const THEME_MAP_FILE = path.join(__dirname, '..', 'ui-audit', 'web', 'ref-theme-map.json');

// 读取参考图主题映射
const themeMap = JSON.parse(fs.readFileSync(THEME_MAP_FILE, 'utf-8'));

function getRefTheme(pageName) {
  const entry = themeMap.find(t => t.file.includes(pageName));
  return entry?.theme === 'DARK' ? 'dark' : 'light';
}

async function startWebServer(backendUrl, token) {
  const http = require('http');
  const WEB_DIST = path.join(__dirname, '..', 'web', 'dist');
  const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
    '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  };
  
  const backend = new URL(backendUrl);
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rawPath = req.url.split('?')[0];
      if (rawPath.startsWith('/uploads') || rawPath.startsWith('/downloads')) {
        const proxyReq = http.request({
          hostname: backend.hostname, port: backend.port, path: req.url, method: req.method,
          headers: { ...req.headers, host: backend.host, authorization: `Bearer ${token}` },
        }, (proxyRes) => { res.writeHead(proxyRes.statusCode || 502, proxyRes.headers); proxyRes.pipe(res); });
        proxyReq.on('error', () => { res.writeHead(502); res.end('proxy error'); });
        req.pipe(proxyReq);
        return;
      }
      let p = rawPath === '/' ? '/index.html' : decodeURIComponent(rawPath);
      let file = path.join(WEB_DIST, p);
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB_DIST, 'index.html');
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
  const { backendUrl, stop: stopBackend } = await startBackend();
  console.log('✓ 测试后端:', backendUrl);
  
  const users = await seedUsers(backendUrl, 2);
  console.log('✓ Seed 用户:', users.map(u => u.phone).join(', '));
  
  await befriendAndOpenConv(backendUrl, users[0].token, users[1].id);
  console.log('✓ 建立好友关系');
  
  const server = await startWebServer(backendUrl, users[0].token);
  console.log('✓ Web 静态服务: http://localhost:4178\n');
  
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  
  const results = [];
  const pages = [
    { name: 'login', displayName: 'Web登录页面', url: '/', file: 'login.png', auth: false },
    { name: 'register', displayName: 'Web注册页', url: '/#/register', file: 'register.png', auth: false },
    { name: 'home', displayName: 'Web主界面', url: '/#/home', file: 'home.png', auth: true },
    { name: 'chat', displayName: 'Web聊天详情页', url: '/#/home', file: 'chat.png', auth: true },
    { name: 'contacts', displayName: 'Web联系人页', url: '/#/contacts', file: 'contacts.png', auth: true },
    { name: 'moments', displayName: 'Web动态页', url: '/#/moments', file: 'moments.png', auth: true },
    { name: 'settings', displayName: 'Web设置页', url: '/#/home', file: 'settings.png', auth: true },
    { name: 'profile', displayName: 'Web个人资料页', url: '/#/home', file: 'profile.png', auth: true },
  ];
  
  for (const p of pages) {
    const refTheme = getRefTheme(p.displayName);
    console.log(`[${p.displayName}] 参考图主题: ${refTheme.toUpperCase()}`);
    
    const page = await context.newPage();
    
    // ⚠️ 关键：在导航前注入 localStorage，使用产品原生主题机制
    await page.addInitScript((theme) => {
      localStorage.setItem('wc_theme', theme);
    }, refTheme);
    
    if (p.auth) {
      await page.addInitScript(({ token, backend }) => {
        localStorage.setItem('wc_token', token);
        localStorage.setItem('wc_backend', backend);
      }, { token: users[0].token, backend: backendUrl });
    }
    
    try {
      await page.goto(`http://localhost:4178${p.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      
      // 等待主题应用（SettingsContext useEffect）
      await page.waitForTimeout(500);
      
      // 验证主题已应用
      const actualTheme = await page.evaluate(() => {
        return document.body.classList.contains('dark-mode') ? 'dark' : 'light';
      });
      console.log(`  实际主题: ${actualTheme.toUpperCase()} ${actualTheme === refTheme ? '✓' : '✗ 不匹配'}`);
      
      // 页面特定导航
      if (p.name === 'login') {
        await page.getByTestId('login-agreement-checkbox').check();
      }
      
      if (p.name === 'chat') {
        await page.waitForSelector('.wc-panel .conv-item', { timeout: 5000 });
        await page.click('.wc-panel .conv-item:first-child');
        await page.waitForSelector('[data-testid="chat-msg-input"]', { timeout: 3000 });
      }
      
      if (p.name === 'settings') {
        const settingsBtn = page.locator('.wc-sidebar-nav-btn').filter({ hasText: '设置' });
        await settingsBtn.click();
        await page.waitForSelector('.wc-settings-nav', { timeout: 3000 });
      }
      
      if (p.name === 'profile') {
        const settingsBtn = page.locator('.wc-sidebar-nav-btn').filter({ hasText: '设置' });
        await settingsBtn.click();
        await page.waitForSelector('.wc-settings-nav', { timeout: 3000 });
        const profileNavItem = page.locator('.wc-settings-nav-item').filter({ hasText: '个人资料' });
        await profileNavItem.click();
        await page.waitForTimeout(500);
      }
      
      await page.waitForTimeout(1000);
      
      const outPath = path.join(ACTUAL_DIR, p.file);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`  ✓ 截图: ${p.file}\n`);
      
      results.push({ 
        page: p.displayName, 
        file: p.file, 
        refTheme,
        actualTheme,
        themeMatch: actualTheme === refTheme,
        status: 'success' 
      });
      
    } catch (err) {
      console.error(`  ✗ 失败: ${err.message}\n`);
      results.push({ page: p.displayName, file: p.file, refTheme, status: 'error', error: err.message });
    }
    
    await page.close();
  }
  
  await browser.close();
  server.close();
  await stopBackend();
  
  const outFile = path.join(__dirname, '..', 'ui-audit', 'web', 'results-theme.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\n✓ 结果: ${outFile}`);
  console.log(`✓ 成功: ${results.filter(r => r.status === 'success').length}/${results.length}`);
  console.log(`✓ 主题匹配: ${results.filter(r => r.themeMatch).length}/${results.length}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
