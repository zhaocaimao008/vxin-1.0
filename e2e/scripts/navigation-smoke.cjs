// Requires isolated local web/API servers; creates disposable test users.
const {
  chromium,
  expect
} = require('@playwright/test');
const fs = require('fs');
const root = process.env.EVIDENCE_DIR || require('path').resolve(__dirname, '../test-results/navigation');
fs.mkdirSync(root, {
  recursive: true
});
const base = (process.env.WEB_ORIGIN || 'http://127.0.0.1:18387').replace(/\/$/, '');
const apiBase = process.env.API_ORIGIN || 'http://127.0.0.1:18386';
const results = [];
async function main() {
  const stamp = String(Date.now()).slice(-6),
    password = 'Page-check-20260916';
  const response = await fetch(apiBase + '/api/auth/register', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      phone: '13903' + stamp,
      password,
      username: 'PageCheck' + stamp,
      inviteCode: process.env.INVITE_CODE || '123456'
    })
  });
  const account = await response.json();
  if (!response.ok) throw Error(JSON.stringify(account));
  const groupName = 'NavigationGroup' + stamp;
  const groupResponse = await fetch(apiBase + '/api/messages/conversation/group', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + account.token
    },
    body: JSON.stringify({
      name: groupName,
      memberIds: []
    })
  });
  if (!groupResponse.ok) throw Error('Group setup failed: ' + (await groupResponse.text()));
  const browser = await chromium.launch({
    args: ['--no-sandbox']
  });
  try {
    for (const [mode, viewport] of [['desktop', {
      width: 1365,
      height: 900
    }], ['mobile', {
      width: 390,
      height: 844
    }]]) {
      const context = await browser.newContext({
        viewport,
        serviceWorkers: "block"
      });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', route => {
        const u = new URL(route.request().url());
        if (u.pathname.endsWith('/config.json') && u.hostname !== '127.0.0.1') return route.fulfill({
          json: {
            api: base,
            socket: base,
            cdn: base
          }
        });
        if (!['127.0.0.1', 'localhost'].includes(u.hostname)) return route.abort();
        return route.continue();
      });
      const record = async (name, action) => {
        const start = errors.length;
        try {
          await action();
          await page.waitForTimeout(200);
          const crash = await page.getByText('页面出了点小问题', {
            exact: true
          }).isVisible();
          if (crash) throw Error(await page.locator('body').innerText());
          if (errors.length > start) throw Error(errors.slice(start).join(';'));
          results.push({
            mode,
            name,
            ok: true
          });
        } catch (e) {
          results.push({
            mode,
            name,
            ok: false,
            error: e.message.slice(0, 1200)
          });
          await page.screenshot({
            path: root + '/' + mode + '-' + results.length + '.png'
          });
        }
        console.log(JSON.stringify(results.at(-1)));
      };
      for (const [path, selector] of [['register', 'input[placeholder*=邀请码]'], ['forgot-password', 'input[placeholder*=手机号]']]) await record('public:' + path, async () => {
        await page.goto(base + '/app/' + path);
        await expect(page.locator(selector).first()).toBeVisible();
      });
      await page.goto(base + '/app/login');
      await page.locator('input[placeholder*="手机号"]').first().fill(account.user.phone);
      await page.locator('input[placeholder*="密码"]').first().fill(password);
      for (const c of await page.locator('input[type=checkbox]').all()) await c.check();
      await page.locator('form button[type=submit]').click();
      await page.getByTestId('nav-tab-chats').waitFor();
      const reset = async (tab = 'me') => {
        await page.goto(base + '/app/');
        await page.getByTestId('nav-tab-' + tab).click();
        await page.waitForTimeout(200);
      };
      for (const tab of ['chats', 'contacts', 'moments', 'favorites', ...(mode === 'mobile' ? ['calls'] : []), 'me']) await record('tab:' + tab, async () => {
        await reset(tab);
        await expect(page.getByTestId('nav-tab-' + tab)).toHaveAttribute('aria-selected', 'true');
      });
      if (mode === 'desktop') {
        for (const label of ['账号与安全', '隐私设置', '通知设置', '通用设置', '快捷键', '个人资料', '关于 v信']) await record('settings:' + label, async () => {
          await reset();
          await page.locator('.wc-settings-nav-item').filter({
            hasText: label
          }).click();
          await expect(page.locator('.wc-settings-content')).not.toBeEmpty();
        });
        for (const [label, button, title] of [['手机号', '修改', '换绑手机号'], ['登录密码', '修改', '修改登录密码'], ['设备管理', '管理', '设备管理']]) await record('account:' + label, async () => {
          await reset();
          await page.locator('.wc-crow').filter({
            has: page.locator('.wc-crow-label', {
              hasText: label
            })
          }).getByRole('button', {
            name: button,
            exact: true
          }).click();
          await expect(page.locator('.wc-page-header-title')).toContainText(title);
          await page.locator('.wc-page-header-back').click();
          await expect(page.getByTestId('nav-tab-me')).toHaveAttribute('aria-selected', 'true');
        });
        for (const [label, title] of [['用户名', '修改昵称'], ['个性签名', '个性签名'], ['手机', '换绑手机号']]) await record('profile:' + label, async () => {
          await reset();
          await page.locator('.wc-settings-nav-item').filter({
            hasText: '个人资料'
          }).click();
          await page.locator('.wc-crow-clickable').filter({
            has: page.locator('.wc-crow-label', {
              hasText: label
            })
          }).click();
          await expect(page.locator('.wc-page-header-title')).toContainText(title);
          await page.locator('.wc-page-header-back').click();
          await expect(page.getByTestId('nav-tab-me')).toHaveAttribute('aria-selected', 'true');
        });
      } else {
        for (const [label, title] of [['钱包', '钱包'], ['邀请好友', '邀请好友'], ['通用设置', '通用设置'], ['设备管理', '设备管理'], ['隐私与安全', '隐私'], ['外观', '外观'], ['通知', '通知']]) await record('profile:' + label, async () => {
          await reset();
          await page.locator('.wc-crow-clickable').filter({
            has: page.getByText(label, {
              exact: true
            })
          }).click();
          await expect(page.locator('.wc-page-header-title')).toContainText(title);
          await page.locator('.wc-page-header-back').click();
          await expect(page.getByTestId('nav-tab-me')).toHaveAttribute('aria-selected', 'true');
        });
        await record('profile:detail', async () => {
          await reset();
          await page.locator('.wc-me-header').click();
          await expect(page.locator('.wc-page-header-title')).toContainText('个人');
        });
      }
      for (const label of ['新的朋友', '群聊', '好友标签', '黑名单']) await record('contacts:' + label, async () => {
        await reset('contacts');
        await page.getByText(label, {
          exact: true
        }).first().click();
        await expect(page.locator('.cl-section-back')).toBeVisible();
        await page.locator('.cl-section-back').click();
        await expect(page.getByText('新的朋友', {
          exact: true
        }).first()).toBeVisible();
      });
      await record('menu:create-group', async () => {
        await reset('chats');
        await page.getByTestId('add-menu-btn').click();
        await page.getByText('发起群聊', {
          exact: true
        }).first().click();
        await expect(page.getByTestId('group-name-input')).toBeVisible();
      });
      if (mode === 'mobile') for (const [label, title] of [['昵称', '修改昵称'], ['个性签名', '修改个性签名'], ['手机号', '换绑手机号']]) await record('profile:detail:' + label, async () => {
        await reset();
        await page.locator('.wc-me-header').click();
        await page.locator('.wc-crow-clickable').filter({
          has: page.getByText(label, {
            exact: true
          })
        }).click();
        await expect(page.locator('.wc-page-header-title')).toContainText(title);
        await page.locator('.wc-page-header-back').click();
        await expect(page.locator('.wc-me-header')).toBeVisible();
      });
      await record('privacy:add-methods-back', async () => {
        await reset();
        if (mode === 'desktop') await page.locator('.wc-settings-nav-item').filter({
          hasText: '隐私设置'
        }).click();else await page.locator('.wc-crow-clickable').filter({
          has: page.getByText('隐私与安全', {
            exact: true
          })
        }).click();
        await page.getByText('添加我的方式', {
          exact: true
        }).click();
        await expect(page.locator('.wc-page-header-title')).toContainText('添加我的方式');
        await page.locator('.wc-page-header-back').click();
        await expect(page.getByText('添加我的方式', {
          exact: true
        })).toBeVisible();
      });
      await record('menu:add-friend', async () => {
        await reset('chats');
        await page.getByTestId('add-menu-btn').click();
        await page.getByText('添加朋友', {
          exact: true
        }).click();
        await expect(page.getByRole('dialog', {
          name: '添加好友'
        })).toBeVisible();
        await page.getByRole('dialog', {
          name: '添加好友'
        }).getByRole('button', {
          name: '关闭',
          exact: true
        }).click();
        await expect(page.getByRole('dialog', {
          name: '添加好友'
        })).toHaveCount(0);
      });
      await record('menu:scan', async () => {
        await reset('chats');
        await page.getByTestId('add-menu-btn').click();
        await page.getByTestId('scan-qr-entry').click();
        await expect(page.getByRole('dialog', {
          name: '扫一扫'
        })).toBeVisible();
        await page.getByRole('dialog', {
          name: '扫一扫'
        }).getByLabel('关闭', {
          exact: true
        }).click();
        await expect(page.getByRole('dialog', {
          name: '扫一扫'
        })).toHaveCount(0);
      });
      const openChat = async () => {
        await reset('chats');
        await page.getByTestId('conv-item-name').filter({
          hasText: groupName
        }).click();
        await expect(page.getByTestId('chat-msg-input')).toBeVisible();
      };
      await record('chat:open-search-return', async () => {
        await openChat();
        await page.getByTestId('chat-search-btn').click();
        await expect(page.getByPlaceholder('搜索聊天记录…')).toBeVisible();
        await page.getByRole('button', {
          name: '关闭搜索',
          exact: true
        }).click();
        await expect(page.getByPlaceholder('搜索聊天记录…')).toHaveCount(0);
        if (mode === 'mobile') {
          await page.locator('.wc-chat-header-back').click();
          await expect(page.getByTestId('nav-tab-chats')).toBeVisible();
        }
      });
      await record('chat:send-reload-search', async () => {
        await openChat();
        const message = '导航回归消息 ' + mode + ' ' + stamp;
        await page.getByTestId('chat-msg-input').fill(message);
        await page.getByTestId('chat-send-btn').click();
        await expect(page.locator('[data-testid^="msg-bubble-"]', {
          hasText: message
        })).toBeVisible();
        await page.reload();
        await page.getByTestId('conv-item-name').filter({
          hasText: groupName
        }).click();
        await expect(page.locator('[data-testid^="msg-bubble-"]', {
          hasText: message
        })).toBeVisible();
        await page.getByTestId('chat-search-btn').click();
        await page.getByPlaceholder('搜索聊天记录…').fill(message);
        await expect(page.locator('mark').filter({
          hasText: message
        })).toBeVisible();
        await page.getByRole('button', {
          name: '关闭搜索',
          exact: true
        }).click();
      });
      await record('chat:group-info-files', async () => {
        await openChat();
        await page.getByTestId('chat-group-info-btn').click();
        await expect(page.locator('.gi-panel')).toBeVisible();
        await page.getByText('聊天文件', {
          exact: true
        }).click();
        await expect(page.getByRole('dialog', {
          name: '聊天文件'
        })).toBeVisible();
        await page.getByRole('button', {
          name: '关闭聊天文件'
        }).click();
        await expect(page.getByRole('dialog', {
          name: '聊天文件'
        })).toHaveCount(0);
      });
      await record('chat:group-qr', async () => {
        await openChat();
        await page.getByTestId('chat-group-info-btn').click();
        await page.getByText('群二维码', {
          exact: true
        }).click();
        await expect(page.getByRole('dialog', {
          name: '群二维码'
        })).toBeVisible();
        await page.getByRole('button', {
          name: '关闭二维码'
        }).click();
        await page.getByRole('button', {
          name: '关闭群聊信息'
        }).click();
        await expect(page.locator('.gi-panel')).toHaveCount(0);
      });
      await record('moments:compose-cancel', async () => {
        await reset('moments');
        await page.locator('.wc-moment-composer').click();
        await expect(page.getByLabel('发布动态', {
          exact: true
        })).toBeVisible();
        await page.getByRole('button', {
          name: '取消',
          exact: true
        }).click();
        await expect(page.locator('.wc-moment-composer')).toBeVisible();
      });
      await record('moments:settings', async () => {
        await reset('moments');
        await page.getByRole('button', {
          name: '动态设置',
          exact: true
        }).click();
        await expect(page.getByRole('dialog', {
          name: '动态设置'
        })).toBeVisible();
        await page.getByRole('dialog', {
          name: '动态设置'
        }).getByRole('button', {
          name: '关闭',
          exact: true
        }).click();
      });
      await record('favorites:filter', async () => {
        await reset('favorites');
        await page.getByTestId('collection-type-image').click();
        await expect(page.getByTestId('collection-empty')).toBeVisible();
        await page.getByTestId('collection-type-all').click();
      });
      await record('offline:banner-buttons-remain-clickable', async () => {
        await reset('chats');
        await page.waitForFunction(() => window.__vxinSocket?.connected);
        await page.evaluate(() => window.__vxinSocket.disconnect());
        await expect(page.getByTestId('net-banner')).toHaveAttribute('data-state', 'reconnecting');
        await expect(page.getByTestId('call-sound-guide')).toBeVisible();
        await page.getByTestId('add-menu-btn').click();
        await page.getByTestId('create-group-entry').click();
        await expect(page.getByTestId('group-name-input')).toBeVisible();
        await page.evaluate(() => window.__vxinSocket.connect());
      });
      for (const button of ['重试', '返回首页']) await record('failed-chunk:' + button, async () => {
        const block = route => route.abort();
        await page.route('**/Moments-*.js', block);
        await reset('moments');
        await expect(page.getByText('页面出了点小问题', {
          exact: true
        })).toBeVisible();
        errors.length = 0;
        await page.unroute('**/Moments-*.js', block);
        await page.getByRole('button', {
          name: button,
          exact: true
        }).click();
        await expect(page.getByTestId('nav-tab-chats')).toBeVisible();
        await expect(page).toHaveURL(base + '/app/');
        await page.getByTestId('nav-tab-moments').click();
        await expect(page.locator('.wc-moment-composer')).toBeVisible();
      });
      await record('chat:failed-chunk-retry', async () => {
        await reset('chats');
        const block = route => route.abort();
        await page.route('**/ChatWindow-*.js', block);
        await page.getByTestId('conv-item-name').filter({
          hasText: groupName
        }).click();
        await expect(page.getByText('消息加载出错', {
          exact: true
        })).toBeVisible();
        errors.length = 0;
        await page.unroute('**/ChatWindow-*.js', block);
        await page.getByRole('button', {
          name: '重试',
          exact: true
        }).click();
        await page.getByTestId('conv-item-name').filter({
          hasText: groupName
        }).click();
        await expect(page.getByTestId('chat-msg-input')).toBeVisible();
      });
      await page.screenshot({
        path: root + '/' + mode + '-final.png'
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
main().then(() => {
  if (results.some(r => !r.ok)) process.exitCode = 1;
}).catch(e => {
  console.error(e);
  process.exitCode = 1;
}).finally(() => fs.writeFileSync(root + '/' + (process.env.SCAN_LABEL || 'baseline') + '-pages.json', JSON.stringify(results, null, 2)));
