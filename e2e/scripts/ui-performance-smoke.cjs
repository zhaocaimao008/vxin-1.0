const {
  chromium,
  expect
} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
// Requires an isolated API and Web server at the same origin; creates disposable users.
const BASE = (process.env.WEB_ORIGIN || 'http://127.0.0.1:18387').replace(/\/$/, '');
const ROOT = process.env.EVIDENCE_DIR || path.resolve(__dirname, '../test-results/ui-performance');
const label = process.env.LABEL || 'review';
fs.mkdirSync(ROOT, {
  recursive: true
});
const results = {
  ui: [],
  errors: []
};
async function api(path, body, token) {
  const r = await fetch(BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? {
        authorization: 'Bearer ' + token
      } : {})
    },
    ...(body ? {
      body: JSON.stringify(body)
    } : {})
  });
  const data = await r.json();
  if (!r.ok) throw Error(path + ' ' + r.status + ' ' + JSON.stringify(data));
  return data;
}
async function setup(context, theme = 'light') {
  await context.addInitScript(({
    base,
    theme
  }) => {
    localStorage.setItem('wc_theme', theme);
    const f = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      return url?.endsWith('/config.json') ? Promise.resolve(new Response(JSON.stringify({
        api: base,
        socket: base,
        cdn: base
      }), {
        headers: {
          'content-type': 'application/json'
        }
      })) : f(input, init);
    };
    window.__measures = {
      longTasks: [],
      shifts: []
    };
    for (const type of ['longtask', 'layout-shift']) try {
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) {
          if (type === 'longtask') window.__measures.longTasks.push(e.duration);else if (!e.hadRecentInput) window.__measures.shifts.push(e.value);
        }
      }).observe({
        type,
        buffered: true
      });
    } catch {}
  }, {
    base: BASE,
    theme
  });
}
async function login(page, user, password) {
  await page.goto(BASE + '/app/login');
  await page.getByTestId('login-phone-input').fill(user.phone);
  await page.getByTestId('login-password-input').fill(password);
  await page.getByTestId('login-agreement-checkbox').check();
  await page.getByTestId('login-submit-btn').click();
  await page.getByTestId('nav-tab-chats').waitFor();
}
(async () => {
  const stamp = String(Date.now()).slice(-7),
    password = 'Full-check-20260916';
  const a = await api('/api/auth/register', {
    phone: '1381' + stamp,
    password,
    username: 'Review' + stamp,
    inviteCode: process.env.INVITE_CODE || '123456'
  });
  const groupName = '界面检查群 ' + stamp;
  const {
    conversationId: cid
  } = await api('/api/messages/conversation/group', {
    name: groupName,
    memberIds: []
  }, a.token);
  for (let i = 0; i < 18; i++) await api('/api/messages/' + cid, {
    type: 'text',
    content: i % 3 === 0 ? '这是一段用于检查界面排版与长消息换行的文字。'.repeat(8) : '测试消息 ' + i
  }, a.token);
  const browser = await chromium.launch({
    args: ['--no-sandbox']
  });
  try {
    for (const [name, viewport] of [['small', {
      width: 320,
      height: 568
    }], ['phone', {
      width: 390,
      height: 844
    }], ['tablet', {
      width: 768,
      height: 1024
    }], ['desktop', {
      width: 1365,
      height: 900
    }], ['landscape', {
      width: 844,
      height: 390
    }]]) for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({
        viewport,
        serviceWorkers: 'block'
      });
      await setup(ctx, theme);
      const page = await ctx.newPage();
      page.setDefaultTimeout(7000);
      page.on('pageerror', e => results.errors.push({
        name,
        theme,
        error: e.message
      }));
      await login(page, a.user, password);
      const snap = async view => {
        await page.waitForTimeout(250);
        const geometry = await page.evaluate(() => {
          const nav = document.querySelector('.m-tabbar'),
            input = document.querySelector('[data-testid=chat-msg-input]'),
            dialog = document.querySelector('[role=dialog]');
          const rect = el => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              bottom: r.bottom,
              right: r.right
            };
          };
          return {
            width: innerWidth,
            height: innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
            nav: rect(nav),
            input: rect(input),
            dialog: rect(dialog),
            bodyBg: getComputedStyle(document.body).backgroundColor,
            panelBg: document.querySelector('.wc-page-bg') ? getComputedStyle(document.querySelector('.wc-page-bg')).backgroundColor : null
          };
        });
        const issues = [];
        if (view === 'group-dialog' && !geometry.dialog) issues.push('group dialog not accessible');
        if (geometry.scrollWidth > viewport.width + 1) issues.push('horizontal overflow');
        for (const key of ['nav', 'input', 'dialog']) {
          const r = geometry[key];
          if (r && (r.x < -1 || r.right > viewport.width + 1 || r.y < 0 || r.bottom > viewport.height + 1)) issues.push(key + ' outside viewport');
        }
        const row = {
          name,
          theme,
          view,
          geometry,
          issues
        };
        results.ui.push(row);
        console.log(JSON.stringify(row));
        await page.screenshot({
          path: ROOT + '/' + label + '-' + name + '-' + theme + '-' + view + '.png'
        });
      };
      await snap('chats');
      await page.getByTestId('conv-item-name').filter({
        hasText: groupName
      }).click();
      await page.getByTestId('chat-msg-input').waitFor();
      await snap('conversation');
      if (name === 'desktop' && theme === 'light') {
        await page.getByTestId('chat-msg-input').fill('必须恢复的未发送草稿');
        await page.getByTestId('nav-tab-me').click();
        await page.getByTestId('nav-tab-chats').click();
        await page.getByTestId('conv-item-name').filter({
          hasText: groupName
        }).click();
        results.draftAfterReopen = await page.getByTestId('chat-msg-input').inputValue();
        await page.reload();
        await page.getByTestId('conv-item-name').filter({
          hasText: groupName
        }).click();
        results.draftAfterReload = await page.getByTestId('chat-msg-input').inputValue();
        console.log('DRAFT', results.draftAfterReopen, results.draftAfterReload);
      }
      await page.goto(BASE + '/app/');
      await page.getByTestId('nav-tab-me').click();
      await snap('settings');
      await page.getByTestId('nav-tab-moments').click();
      await page.locator('.wc-moment-composer').waitFor();
      await snap('moments');
      await page.getByTestId('nav-tab-chats').click();
      await page.getByTestId('add-menu-btn').click();
      await page.getByTestId('create-group-entry').click();
      await page.getByTestId('group-name-input').waitFor();
      await snap('group-dialog');
      await ctx.close();
    }
    const ctx = await browser.newContext({
      serviceWorkers: 'allow'
    });
    await setup(ctx);
    const page = await ctx.newPage();
    await login(page, a.user, password);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(path.resolve(__dirname, '../fixtures/sample.png'))], {
      type: 'image/png'
    }), 'private.png');
    const upload = await fetch(BASE + '/api/messages/' + cid + '/upload', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + a.token
      },
      body: form
    });
    const msg = await upload.json();
    if (!upload.ok) throw Error('upload ' + JSON.stringify(msg));
    const file = msg.file_url || msg.message?.file_url;
    results.mediaFirst = await page.evaluate(async p => {
      const r = await fetch(p);
      return {
        status: r.status,
        size: (await r.arrayBuffer()).byteLength,
        cache: r.headers.get('cache-control')
      };
    }, file);
    await ctx.clearCookies();
    results.mediaAfterLogout = await page.evaluate(async p => {
      const r = await fetch(p);
      return {
        status: r.status,
        size: (await r.arrayBuffer()).byteLength
      };
    }, file);
    results.mediaWithoutSession = (await fetch(BASE + file)).status;
    console.log('MEDIA', results.mediaFirst, results.mediaAfterLogout, results.mediaWithoutSession);
    await ctx.close();
    expect(results.errors).toEqual([]);
    expect(results.ui.flatMap(row => row.issues)).toEqual([]);
    expect(results.draftAfterReopen).toBe('必须恢复的未发送草稿');
    expect(results.draftAfterReload).toBe('必须恢复的未发送草稿');
    expect(results.mediaFirst.status).toBe(200);
    expect(results.mediaAfterLogout.status).toBe(401);
    expect(results.mediaWithoutSession).toBe(401);
    const perfCtx = await browser.newContext({
      serviceWorkers: 'block'
    });
    await setup(perfCtx);
    const perfPage = await perfCtx.newPage();
    const cdp = await perfCtx.newCDPSession(perfPage);
    await cdp.send('Emulation.setCPUThrottlingRate', {
      rate: 4
    });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 80,
      downloadThroughput: 200000,
      uploadThroughput: 100000
    });
    const start = Date.now();
    await perfPage.goto(BASE + '/app/login');
    await perfPage.getByTestId('login-phone-input').waitFor();
    results.performance = await perfPage.evaluate(() => ({
      paint: performance.getEntriesByType('paint').map(x => ({
        name: x.name,
        startTime: x.startTime
      })),
      ...window.__measures,
      resources: performance.getEntriesByType('resource').map(r => ({
        url: new URL(r.name).pathname,
        bytes: r.transferSize,
        duration: r.duration
      }))
    }));
    results.performance.loginReadyMs = Date.now() - start;
    console.log('PERF', results.performance.loginReadyMs);
    await perfCtx.close();
  } finally {
    await browser.close();
  }
})().catch(e => {
  results.failure = e.stack;
  console.error(e);
  process.exitCode = 1;
}).finally(() => fs.writeFileSync(ROOT + '/' + label + '-inspection.json', JSON.stringify(results, null, 2)));
