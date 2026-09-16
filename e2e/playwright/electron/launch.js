'use strict';
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const env = require('../../shared/env');
const DESKTOP_DIR = path.join(env.REPO_ROOT, 'desktop-electron');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function skipReason() {
  if (typeof process.getuid === 'function' && process.getuid() === 0) return 'Electron 沙箱需要非 root 用户';
  return null;
}

/** Own profile + main-window CDP attachment; the separate splash partition is never a test page. */
async function launchElectron() {
  const dist = path.join(env.REPO_ROOT, 'web/dist/index.html');
  if (!fs.existsSync(dist)) throw new Error('先运行 npm run build -- --mode desktop');
  if (/\b(?:src|href)="\/app\/assets\//.test(fs.readFileSync(dist, 'utf8'))) {
    throw new Error('Electron 必须使用 desktop 模式构建，相对资源路径才适用于 file://');
  }
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, '../../.e2e-state.json'), 'utf8'));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vxin-electron-e2e-'));
  fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({
    serverUrl: state.backendUrl, serverUrlManual: true, minimizeToTray: false, autoLaunch: false,
  }));
  const executable = require(path.join(DESKTOP_DIR, 'node_modules/electron'));
  const child = spawn(executable, ['.', '--user-data-dir=' + profile, '--remote-debugging-port=0', '--disable-gpu', '--no-sandbox'], {
    cwd: DESKTOP_DIR, env: { ...process.env, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '', endpoint, browser, page, exited = false, startupError;
  const exitedPromise = new Promise(resolve => child.once('exit', () => { exited = true; resolve(); }));
  child.once('error', error => { startupError = error; exited = true; });
  const collect = chunk => {
    const text = chunk.toString(); logs = (logs + text).slice(-30000);
    const match = logs.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) endpoint = match[1];
  };
  child.stdout.on('data', collect); child.stderr.on('data', collect);
  const close = async () => {
    if (page && !page.isClosed()) await page.evaluate(() => window.electronAPI?.close()).catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (!exited) {
      await Promise.race([exitedPromise, pause(1500)]);
      if (!exited) child.kill('SIGTERM');
      await Promise.race([exitedPromise, pause(3000)]);
      if (!exited) {
        child.kill('SIGKILL');
        await Promise.race([exitedPromise, pause(3000)]);
      }
    }
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  };
  try {
    const deadline = Date.now() + 30000;
    let targets;
    while (Date.now() < deadline) {
      if (startupError) throw startupError;
      if (exited) throw new Error('Electron 启动退出:\n' + logs);
      if (endpoint) {
        const origin = 'http://' + new URL(endpoint).host;
        targets = await fetch(origin + '/json/list').then(r => r.json()).catch(() => []);
        if (targets.some(t => t.url.includes('/web/dist/index.html')) && !targets.some(t => t.url.includes('/assets/splash.html'))) break;
      }
      await pause(100);
    }
    if (!targets?.some(t => t.url.includes('/web/dist/index.html')) || targets.some(t => t.url.includes('/assets/splash.html'))) throw new Error('主窗口未就绪:\n' + logs);
    browser = await chromium.connectOverCDP(endpoint);
    page = browser.contexts().flatMap(context => context.pages()).find(p => p.url().includes('/web/dist/index.html'));
    if (!page) throw new Error('无法附着主窗口');
    const context = page.context();
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['http:', 'https:'].includes(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
      return route.continue();
    });
    await page.getByTestId('login-phone-input').waitFor({ timeout: 15000 });
    return { app: { close, profile, logs: () => logs }, page, state };
  } catch (error) { await close(); throw error; }
}

module.exports = { launchElectron, skipReason };
