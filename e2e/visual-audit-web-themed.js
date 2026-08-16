/**
 * Web Visual Audit - 主题匹配版
 * 根据参考图的实际主题来截图
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5177';
const BACKEND_URL = 'http://localhost:3002';
const OUTPUT_DIR = path.join(__dirname, '..', 'ui-audit', 'web', 'actual');
const THEME_DATA = require('../ui-audit/reference-themes.json');

// 创建输出目录
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 主题映射
const themeMap = new Map();
THEME_DATA.results.forEach(r => {
  themeMap.set(r.page, r.theme);
});

async function setTheme(page, theme) {
  if (theme === 'DARK') {
    // 使用产品现有的主题机制：localStorage + classList
    await page.evaluate(() => {
      localStorage.setItem('darkMode', 'true');
      document.body.classList.add('dark-mode');
    });
  } else {
    // LIGHT 模式（默认）
    await page.evaluate(() => {
      localStorage.setItem('darkMode', 'false');
      document.body.classList.remove('dark-mode');
    });
  }
  await page.waitForTimeout(300); // 等待 CSS 变量生效
}

async function captureWithTheme(page, pageName, theme, filename) {
  console.log(`📸 ${pageName} (${theme} mode)...`);
  await setTheme(page, theme);
  
  const screenshotPath = path.join(OUTPUT_DIR, filename);
  await page.screenshot({ 
    path: screenshotPath, 
    fullPage: false 
  });
  
  console.log(`   ✓ ${filename}`);
  return screenshotPath;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ 
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log('\n=== Web Visual Audit (主题匹配) ===\n');

  // 1. 登录页 - DARK
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('.auth-page', { timeout: 10000 });
  await page.waitForSelector('input[type="tel"]', { timeout: 5000 });
  await page.waitForTimeout(500);
  await captureWithTheme(page, '登录页', themeMap.get('login'), 'login.png');

  // 2. 注册页 - DARK
  await page.goto(`${BASE_URL}/register`);
  await page.waitForSelector('.auth-page', { timeout: 10000 });
  await page.waitForSelector('input[type="tel"]', { timeout: 5000 });
  await page.waitForTimeout(500);
  await captureWithTheme(page, '注册页', 'DARK', 'register.png');

  // === 登录获取 token ===
  console.log('\n🔐 登录测试账号...');
  
  const loginRes = await page.request.post(`${BACKEND_URL}/api/auth/login`, {
    data: { phone: '13900000001', password: 'visualaudit2024' },
  });
  
  if (!loginRes.ok()) {
    throw new Error(`登录失败: ${loginRes.status()}`);
  }
  
  const loginData = await loginRes.json();
  const token = loginData.token;
  
  if (!token) {
    throw new Error('未获取到 token');
  }
  
  console.log('   ✓ Token 已获取\n');

  // === 启动拦截，在页面加载之前就开始 ===

  // 1. 拦截远程配置请求，强制返回本地 API 地址
  await page.route('**/config.json', async (route) => {
    console.log('   拦截配置请求，返回本地 API 地址');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        api: BACKEND_URL,
        socket: BACKEND_URL,
        cdn: BACKEND_URL,
        version: '2.0.0-local-test'
      }),
    });
  });

  // 2. 拦截所有 API 请求，路由到本地后端
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    // 重写为本地后端
    const newUrl = `${BACKEND_URL}${url.pathname}${url.search}`;
    console.log(`   拦截: ${request.method()} ${url.pathname} -> ${newUrl}`);

    try {
      // 构建请求头，确保 Authorization 正确传递
      const headers = { ...request.headers() };

      // 如果请求头中没有 Authorization，添加 token
      if (!headers['authorization'] && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 移除可能导致问题的 headers
      delete headers['host'];
      delete headers['origin'];
      delete headers['referer'];

      const response = await fetch(newUrl, {
        method: request.method(),
        headers,
        body: request.postDataBuffer(),
      });

      console.log(`   响应: ${response.status} ${url.pathname}`);

      const body = await response.arrayBuffer();
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        // 移除 CORS headers，让浏览器认为这是同源请求
        const lowerKey = key.toLowerCase();
        if (lowerKey.startsWith('access-control-')) return;
        responseHeaders[key] = value;
      });

      await route.fulfill({
        status: response.status,
        headers: responseHeaders,
        body: Buffer.from(body),
      });
    } catch (error) {
      console.log(`   错误: ${url.pathname} - ${error.message}`);
      await route.abort('failed');
    }
  });

  // 访问主页
  await page.goto(`${BASE_URL}/home`);

  // 设置 localStorage
  await page.evaluate(({ token: t }) => {
    localStorage.removeItem('vxin_server_url');
    localStorage.setItem('vxin_electron_token', t);
  }, { token });

  // 监听所有控制台消息和错误
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
  });

  page.on('pageerror', error => {
    pageErrors.push(error.toString());
  });

  // 刷新以触发 AuthContext 验证
  console.log('   重新加载页面...');
  await page.reload();
  await page.waitForTimeout(3000);

  // 调试：检查页面状态
  await page.waitForTimeout(3000);

  // 打印错误
  if (pageErrors.length > 0) {
    console.log('\n   ❌ 页面错误:');
    pageErrors.forEach(err => console.log('      ', err));
  }

  if (consoleMessages.length > 0) {
    console.log('\n   📝 控制台消息（前15条）:');
    consoleMessages.slice(0, 15).forEach(msg => console.log('      ', msg));
  }

  // 截图看看实际状态
  await page.screenshot({ path: `${OUTPUT_DIR}/actual/debug-after-login.png` });

  const url = page.url();
  const title = await page.title();
  const body = await page.evaluate(() => document.body.className);

  console.log(`   调试: url=${url}`);
  console.log(`   调试: title=${title}`);
  console.log(`   调试: body.className=${body}`);

  // 检查控制台错误
  page.on('console', msg => console.log('   浏览器控制台:', msg.text()));

  const hasLogin = await page.locator('[data-testid="login-phone-input"]').count();
  const hasSidebar = await page.locator('.wc-sidebar').count();
  const hasHome = await page.locator('.wc-main-container').count();
  console.log(`   调试: hasLogin=${hasLogin}, hasSidebar=${hasSidebar}, hasHome=${hasHome}`);

  // 检查 localStorage
  const storage = await page.evaluate(() => ({
    token: localStorage.getItem('vxin_electron_token'),
    serverUrl: localStorage.getItem('vxin_server_url'),
  }));
  console.log(`   localStorage: token=${storage.token ? 'exists' : 'null'}, serverUrl=${storage.serverUrl}`);

  // 如果还在登录页，尝试手动导航到 /home
  if (hasLogin > 0 && hasSidebar === 0) {
    console.log('   还在登录页，尝试导航到 /home...');
    await page.goto(`${BASE_URL}/home`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUTPUT_DIR}/actual/debug-after-nav-home.png` });
    const newUrl = page.url();
    const newSidebar = await page.locator('.wc-sidebar').count();
    console.log(`   导航后: url=${newUrl}, sidebar=${newSidebar}`);
  }

  await page.waitForSelector('.wc-sidebar', { timeout: 10000 });
  await page.waitForTimeout(800);
  await captureWithTheme(page, '主界面', themeMap.get('home'), 'home.png');

  // 4. 聊天详情页 - LIGHT
  const convItems = await page.locator('.wc-conv-item').all();
  if (convItems.length > 0) {
    await convItems[0].click();
    await page.waitForTimeout(600);
    await captureWithTheme(page, '聊天详情页', themeMap.get('chat'), 'chat.png');
  } else {
    console.log('   ⚠️  无会话，跳过聊天页');
  }

  // 5. 联系人页 - LIGHT
  await page.goto(`${BASE_URL}/contacts`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000); // 等待数据加载
  try {
    await page.waitForSelector('.wc-panel', { timeout: 8000 });
  } catch (e) {
    console.log('   ⚠️  联系人页面未完全加载，继续截图');
  }
  await captureWithTheme(page, '联系人页', themeMap.get('contacts'), 'contacts.png');

  // 6. 动态页 - LIGHT
  await page.goto(`${BASE_URL}/moments`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  try {
    await page.waitForSelector('.wc-discover', { timeout: 8000 });
  } catch (e) {
    console.log('   ⚠️  动态页面未完全加载，继续截图');
  }
  await captureWithTheme(page, '动态页', themeMap.get('moments'), 'moments.png');

  // 7. 设置页 - LIGHT
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  try {
    await page.waitForSelector('.wc-settings', { timeout: 8000 });
  } catch (e) {
    console.log('   ⚠️  设置页面未完全加载，继续截图');
  }
  await captureWithTheme(page, '设置页', themeMap.get('settings'), 'settings.png');

  // 8. 个人资料页 - LIGHT
  await page.goto(`${BASE_URL}/me`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  try {
    await page.waitForSelector('.wc-me', { timeout: 8000 });
  } catch (e) {
    console.log('   ⚠️  个人资料页面未完全加载，继续截图');
  }
  await captureWithTheme(page, '个人资料页', themeMap.get('profile'), 'profile.png');

  await browser.close();
  
  console.log('\n✅ Web 8 页截图完成（主题匹配）\n');
})();
