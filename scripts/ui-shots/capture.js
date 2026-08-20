#!/usr/bin/env node
'use strict';
/**
 * v信 Web UI 改版本地截图/回归工具。不连真实后端——用 Playwright route 拦截
 * config.json（逼远程配置走内置默认 api:'' 同源相对路径）和 /api/**（用本文件
 * 同目录 mock-data.js 里的假数据 fulfill），因此不需要任何测试账号或网络访问。
 *
 * 用法：
 *   node capture.js --port 4175 --prefix after [--dataset edge] [--out DIR] [--boxes]
 *
 * 参数：
 *   --port     Vite dev server 端口（调用方自己先起好: npx vite --port <port>）
 *   --prefix   截图文件名前缀（如 before / after）
 *   --dataset  normal（默认）| edge（超长文本/空态/缺字段边界值，见 mock-data.js）
 *   --out      截图输出目录（默认 ./shots，相对当前工作目录）
 *   --boxes    额外对"我的"两屏（WebSettingsShell 双栏 + 单栏卡片列表）关键容器
 *              做 boundingBox 快照，写到 <out>/<prefix>-boxes.json，供
 *              compare-boxes.js 做结构化位移比对
 *
 * 不连真实环境；真实环境验证见同目录 real-env-check.js（需要环境变量传入账号密码）。
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../../e2e/node_modules/@playwright/test'));
const { NORMAL, EDGE } = require('./mock-data');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const PORT = arg('port', '4175');
const PREFIX = arg('prefix', 'shot');
const DATASET = arg('dataset', 'normal');
const OUT = path.resolve(process.cwd(), arg('out', 'shots'));
const WANT_BOXES = !!arg('boxes', false);

fs.mkdirSync(OUT, { recursive: true });

const D = DATASET === 'edge' ? EDGE : NORMAL;

function json(route, body, status = 200) {
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installMocks(page, { emptyConversations = false, emptyContacts = false, singleMember = false, emptyMessages = false } = {}) {
  await page.route('**/config.json', route => route.abort());
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', route => {
    const p = new URL(route.request().url()).pathname;
    if (p === '/api/auth/me') return json(route, D.me);
    if (p === '/api/config') return json(route, { features: { moments: true, collect: true, inviteRequired: false } });
    if (p === '/api/messages/conversations') return json(route, emptyConversations ? [] : D.conversations);
    if (p === '/api/messages/unread-counts') return json(route, { chats: 4, contacts: 0 });
    if (/^\/api\/messages\/\d+$/.test(p)) return json(route, emptyMessages ? [] : D.messages);
    if (p === '/api/users/contacts') return json(route, emptyContacts ? [] : D.contacts);
    if (p === '/api/users/friend-requests') return json(route, []);
    if (p === '/api/users/friend-requests/sent') return json(route, []);
    if (p === '/api/users/me/blocked') return json(route, []);
    if (p === '/api/messages/my-groups') return json(route, [{ id: 2, name: D.conversations[1]?.name || '产品设计组', avatar: '', memberCount: D.conversations[1]?.memberCount || 8 }]);
    if (p === '/api/friend-labels') return json(route, [{ id: 1, name: '同事', color: '#07C160', memberCount: 3 }]);
    if (p === '/api/users/me/settings') return json(route, { addByVxinId: true, addByPhone: true, requireVerify: true, noDirectGroupInvite: false, profileVisible: true, blockUnknownMessages: false });
    const allMembers = D.groupMembers || D.groupMembersSingle || NORMAL.groupMembers;
    if (p.includes('/groups/2') || p.includes('/group-settings') || p.includes('/conversation/2')) {
      const members = singleMember ? (D.groupMembersSingle || [allMembers[0]]) : allMembers;
      return json(route, { id: 2, name: D.conversations[1]?.name || '产品设计组', memberCount: members.length, members, announcement: '本周五下午三点评审新版设计稿，请大家提前准备好素材。', canManage: true, muteAll: false, noPrivateChat: false, noAddFriend: false });
    }
    if (p.includes('/members')) return json(route, singleMember ? (D.groupMembersSingle || [allMembers[0]]) : allMembers);
    return json(route, []);
  });
}

async function shot(page, name) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${PREFIX}-${name}.png`) });
  console.log('  ✓', `${PREFIX}-${name}.png`);
}

// 抓取一组选择器的 boundingBox，用于结构化位移比对（Part 1）
async function collectBoxes(page, selectors) {
  const out = {};
  for (const [label, sel] of selectors) {
    const loc = page.locator(sel);
    const count = await loc.count();
    if (count === 0) { out[label] = null; continue; }
    if (count === 1) {
      out[label] = await loc.boundingBox();
    } else {
      out[label] = [];
      for (let i = 0; i < count; i++) out[label].push(await loc.nth(i).boundingBox());
    }
  }
  return out;
}

const ME_DOUBLE_COL_SELECTORS = [
  ['shell', '.wc-settings-shell'],
  ['nav', '.wc-settings-nav'],
  ['nav-items', '.wc-settings-nav-item'],
  ['content', '.wc-settings-content'],
  ['cards', '.wc-settings-content .wc-card'],
  // settings-page 改版：账号与安全分组卡片(账号信息/安全设置/其他)回归用
  ['slabels', '.wc-settings-content .wc-slabel'],
  ['crow-rows', '.wc-settings-content .wc-crow'],
  ['account-info-row', '.wc-account-info-row'],
];

const ME_SINGLE_COL_SELECTORS = [
  ['page-bg', '.wc-page-bg'],
  ['me-header', '.wc-me-header'],
  ['cards', '.wc-card'],
  ['crow-rows', '.wc-crow'],
];

// profile-page 改版：桌面「个人资料」大卡片 + 信息列表回归用
const PROFILE_DETAIL_SELECTORS = [
  ['hero', '.wc-profile-hero'],
  ['hero-avatar', '.wc-profile-hero-avatar-wrap'],
  ['hero-name', '.wc-profile-hero-name'],
  ['cards', '.wc-settings-content .wc-card'],
  ['crow-rows', '.wc-settings-content .wc-crow'],
];

const CONTACTS_SELECTORS = [
  ['panel', '.cl-panel'],
  ['alpha-index', '.wc-alpha-index'],
  ['items', '.wc-contact-item'],
  ['item-names', '.wc-contact-item-name'],
  // contacts-page 改版：桌面右栏「全部联系人」详情面板回归用
  ['overview-panel', '.cop-panel'],
  ['overview-tabs', '.cop-tab'],
  ['overview-rows', '.cop-row'],
  ['overview-names', '.cop-name'],
];

// chat-window 改版回归用：既盯住聊天主区改了的元素，也盯住聊天区以外的
// 结构(sidebar/会话列表面板/顶栏)确认零位移——后者不应因为这轮改动产生任何偏移。
const CHATWINDOW_SELECTORS = [
  ['sidebar', '.wc-sidebar'],
  ['conv-panel', '.wc-panel'],
  ['chat-header', '.wc-chat-header'],
  ['messages-wrap', '.wc-messages-wrap'],
  ['input-area', '.wc-input-area'],
  ['input-toolbar', '.wc-input-toolbar'],
  ['toolbar-btns', '.wc-input-toolbar .wc-tool-btn'],
  ['input-box', '.wc-input-box'],
  ['input-footer', '.wc-input-footer'],
  ['voice-toggle-btn', '.wc-voice-toggle-btn'],
  ['send-btn', '.wc-send-btn'],
  ['msg-bubbles', '.wc-msg-bubble'],
  ['msg-avatars', '.wc-msg-avatar'],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });

  await installMocks(page, {
    emptyConversations: arg('empty-conversations', false),
    emptyContacts: arg('empty-contacts', false),
    singleMember: arg('single-member', false),
    emptyMessages: arg('empty-messages', false),
  });

  await page.goto(`http://localhost:${PORT}/app/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  await page.locator('[data-testid="nav-tab-chats"]').click();
  await shot(page, '01-chatlist');

  let boxesChatWindow = null;
  if (await page.locator('[data-testid="conv-item-1"]').count()) {
    await page.locator('[data-testid="conv-item-1"]').click();
    await page.waitForTimeout(400);
    await shot(page, '02-chatwindow');
    if (WANT_BOXES) boxesChatWindow = await collectBoxes(page, CHATWINDOW_SELECTORS);
  }

  if (await page.locator('[data-testid="conv-item-2"]').count()) {
    await page.locator('[data-testid="conv-item-2"]').click();
    await page.waitForTimeout(400);
    const moreBtn = page.locator('.wc-chat-header button, .wc-chat-header [role="button"]').last();
    if (await moreBtn.count()) await moreBtn.click().catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, '02b-groupinfo');
  }

  await page.locator('[data-testid="nav-tab-contacts"]').click();
  await shot(page, '03-contactlist');
  let boxesContacts = null;
  if (WANT_BOXES) boxesContacts = await collectBoxes(page, CONTACTS_SELECTORS);

  const firstContactRow = page.locator('.wc-contact-item').filter({ hasNotText: '新的朋友' }).filter({ hasNotText: '群聊' }).filter({ hasNotText: '添加好友' }).filter({ hasNotText: '黑名单' }).filter({ hasNotText: '好友标签' }).filter({ hasNotText: '文件传输助手' }).first();
  if (await firstContactRow.count()) {
    await firstContactRow.click();
    await page.waitForTimeout(500);
    await shot(page, '04-userprofile');
    await page.keyboard.press('Escape').catch(() => {});
  }

  // 我的：宽视口 -> WebSettingsShell 双栏
  await page.locator('[data-testid="nav-tab-me"]').click();
  await shot(page, '05a-me-websettingsshell-account');
  let boxesDouble = null;
  if (WANT_BOXES) boxesDouble = await collectBoxes(page, ME_DOUBLE_COL_SELECTORS);

  const profileNav = page.locator('.wc-settings-nav-item', { hasText: '个人资料' });
  let boxesProfileDetail = null;
  if (await profileNav.count()) {
    await profileNav.click();
    await shot(page, '05b-me-profiledetail');
    if (WANT_BOXES) boxesProfileDetail = await collectBoxes(page, PROFILE_DETAIL_SELECTORS);
  }
  const privacyNav = page.locator('.wc-settings-nav-item', { hasText: '隐私设置' });
  if (await privacyNav.count()) { await privacyNav.click(); await shot(page, '05c-settings-privacy'); }
  const notifNav = page.locator('.wc-settings-nav-item', { hasText: '通知设置' });
  if (await notifNav.count()) { await notifNav.click(); await shot(page, '05d-settings-notifications'); }
  const generalNav = page.locator('.wc-settings-nav-item', { hasText: '通用设置' });
  if (await generalNav.count()) { await generalNav.click(); await shot(page, '05e-settings-general'); }

  // 我的：窄视口 -> 单栏卡片列表
  await page.setViewportSize({ width: 480, height: 900 });
  await page.waitForTimeout(500);
  await page.locator('[data-testid="nav-tab-me"]').click().catch(() => {});
  await shot(page, '06-me-singlecolumn');
  let boxesSingle = null;
  if (WANT_BOXES) boxesSingle = await collectBoxes(page, ME_SINGLE_COL_SELECTORS);

  // profile-page 改版：移动端单栏的个人资料详情页原样未动，点进去确认没被牵连
  const meHeader = page.locator('.wc-me-header');
  if (await meHeader.count()) {
    await meHeader.click();
    await page.waitForTimeout(300);
    await shot(page, '06b-me-profiledetail-mobile');
  }

  // contacts-page 改版：窄视口(<768) 联系人页应保持现状单栏 ContactList，
  // 不应出现桌面右栏(.cop-panel)——回归确认两栏新版式没有漏判断进移动端。
  await page.locator('[data-testid="nav-tab-contacts"]').click().catch(() => {});
  await shot(page, '07-contacts-singlecolumn');

  if (WANT_BOXES) {
    fs.writeFileSync(path.join(OUT, `${PREFIX}-boxes.json`), JSON.stringify({ double: boxesDouble, single: boxesSingle, contacts: boxesContacts, chatWindow: boxesChatWindow, profileDetail: boxesProfileDetail }, null, 2));
    console.log('  ✓', `${PREFIX}-boxes.json`);
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT, `${PREFIX}-errors.json`), JSON.stringify(errors, null, 2));
  console.log(`\n[${PREFIX}] pageerror/console-error count:`, errors.length);
  errors.forEach(e => console.log('  -', e));
})().catch(e => { console.error(e); process.exit(1); });
