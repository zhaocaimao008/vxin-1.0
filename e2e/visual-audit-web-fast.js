/**
 * Web 端视觉验收 - 主题匹配版
 * 根据参考图主题（DARK/LIGHT）注入 localStorage wc_theme，
 * 使用产品原生 SettingsContext 切换主题，不改生产代码。
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

// 参考图主题映射（已由 ref-theme-scan 生成）
const themeMap = JSON.parse(fs.readFileSync(THEME_MAP_FILE, 'utf-8'));

/** 根据参考图名称查找对应主题 ('dark' | 'light') */
function refThemeFor(displayName) {
  const entry = themeMap.find(t => displayName.includes(t.file));
  return (entry?.theme === 'DARK') ? 'dark' : 'light';
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
  console.log('\n=== Web 视觉验收（主题匹配模式）===\n');

  const backend = await startBackend({ fresh: true });
  console.log(`✓ 后端: ${env.BACKEND_URL}`);

  const users = await seedUsers([
    { username: 'VisualA', phone: uniquePhone() },
    { username: 'VisualB', phone: uniquePhone() },
  ]);
  console.log(`✓ 账号: ${users[0].phone} / ${users[0].password}`);

  let convAB = null;
  try {
    convAB = await befriendAndOpenConv(users[0], users[1]);
    console.log(`✓ 好友+会话建立`);
  } catch (e) { console.warn(`⚠️  ${e.message}`); }

  const webServer = await startWebServer(env.BACKEND_URL, users[0].token);
  console.log(`✓ Web: ${env.WEB_URL}`);

  const browser = await chromium.launch({
    headless: true, executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const results = [];

  // 页面定义
  const pageDefs = [
    { name: 'login',    displayName: 'Web登录页面',  auth: false },
    { name: 'register', displayName: 'Web注册页',    auth: false },
    { name: 'home',     displayName: 'Web主界面',    auth: true },
    { name: 'chat',     displayName: 'Web聊天详情页', auth: true },
    { name: 'contacts', displayName: 'Web联系人页',  auth: true },
    { name: 'moments',  displayName: 'Web动态页',    auth: true },
    { name: 'settings', displayName: 'Web设置页',    auth: true },
    { name: 'profile',  displayName: 'Web个人资料页', auth: true },
  ];

  // ── 先整体登录，保留 cookie/token 到 localStorage 持久化
  // 为每个页面单独开 context，以便独立注入主题
  for (const pageDef of pageDefs) {
    const refTheme = refThemeFor(pageDef.displayName);
    console.log(`\n截图: ${pageDef.displayName}  [ref theme: ${refTheme.toUpperCase()}]`);

    // 每页单独 context：
    //  1. 注入后端 URL（使 web 指向测试后端）
    //  2. 注入 wc_theme（产品原生主题 key）
    //  3. 如果需要登录，注入 token
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

    await ctx.addInitScript(({ backendUrl, theme }) => {
      try {
        localStorage.setItem('vxin_server_url', backendUrl);
        // 产品原生主题切换：SettingsContext 读取 wc_theme
        localStorage.setItem('wc_theme', theme);
      } catch {}
    }, { backendUrl: env.BACKEND_URL, theme: refTheme });

    const page = await ctx.newPage();

    try {
      if (!pageDef.auth) {
        // 登录/注册页 - 直接导航，不需要登录态
        const url = pageDef.name === 'register' ? '/register' : '/login';
        await page.goto(env.WEB_URL + url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(800);

      } else {
        // 需要认证的页面：先登录
        await page.goto(env.WEB_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.locator('[data-testid="login-phone-input"]').fill(users[0].phone);
        await page.locator('[data-testid="login-password-input"]').fill(users[0].password);
        await page.locator('[data-testid="login-agreement-checkbox"]').check();
        await page.waitForTimeout(200);
        await page.locator('[data-testid="login-submit-btn"]').click();
        await page.waitForSelector('[data-testid="nav-tab-chats"]', { timeout: 12000 });
        await page.waitForTimeout(1500);

        // 页面特定导航
        if (pageDef.name === 'home') {
          // 默认已在主界面
          await page.waitForTimeout(500);

        } else if (pageDef.name === 'chat') {
          const items = page.locator('[data-testid^="conv-item-"]');
          if (await items.count() > 0) {
            await items.first().click();
            await page.waitForSelector('[data-testid="chat-msg-input"]', { timeout: 8000 });
            await page.waitForTimeout(600);
          }

        } else if (pageDef.name === 'contacts') {
          await page.locator('[data-testid="nav-tab-contacts"]').first().click();
          await page.waitForTimeout(1200);

        } else if (pageDef.name === 'moments') {
          await page.locator('[data-testid="nav-tab-moments"]').first().click();
          await page.waitForTimeout(1200);

        } else if (pageDef.name === 'settings') {
          await page.locator('[data-testid="nav-tab-me"]').first().click();
          await page.waitForSelector('.wc-settings-nav', { timeout: 5000 });
          await page.waitForTimeout(800);

        } else if (pageDef.name === 'profile') {
          await page.locator('[data-testid="nav-tab-me"]').first().click();
          await page.waitForSelector('.wc-settings-nav', { timeout: 5000 });
          await page.waitForTimeout(500);
          const profileItem = page.locator('.wc-settings-nav-item').filter({ hasText: '个人资料' }).first();
          if (await profileItem.count() > 0) {
            await profileItem.click();
            await page.waitForTimeout(800);
          }
        }
      }

      // 验证实际主题
      const actualTheme = await page.evaluate(() =>
        document.body.classList.contains('dark-mode') ? 'dark' : 'light'
      );
      const themeMatch = actualTheme === refTheme;
      console.log(`  实际主题: ${actualTheme.toUpperCase()} ${themeMatch ? '✓ 匹配' : '✗ 不匹配'}`);

      const outPath = path.join(ACTUAL_DIR, `${pageDef.name}.png`);
      await page.screenshot({ path: outPath });
      console.log(`  ✓ 已保存: ${pageDef.name}.png`);

      results.push({
        page: pageDef.displayName,
        name: pageDef.name,
        refTheme,
        actualTheme,
        themeMatch,
        status: 'ok',
      });

    } catch (err) {
      console.log(`  ✗ 失败: ${err.message}`);
      results.push({
        page: pageDef.displayName,
        name: pageDef.name,
        refTheme,
        status: 'fail',
        error: err.message,
      });
    } finally {
      await ctx.close();
    }
  }

  await browser.close();
  webServer.close();
  await backend.stop();

  console.log('\n=== 截图汇总 ===');
  results.forEach(r => {
    const icon = r.status === 'ok' ? '✓' : '✗';
    const tm = r.themeMatch ? '' : ` ⚠️ theme mismatch(ref=${r.refTheme} act=${r.actualTheme})`;
    console.log(`  ${icon} ${r.page}${tm}`);
  });
  console.log(`\n完成: ${results.filter(r => r.status === 'ok').length}/${results.length}`);

  fs.writeFileSync(
    path.join(ACTUAL_DIR, '..', 'results.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2)
  );
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
