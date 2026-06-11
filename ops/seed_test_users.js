#!/usr/bin/env node
/**
 * seed_test_users.js —— 为压测准备/清理一批临时账号（Hermes 在服务器本机执行）
 *
 * 单源压测无法靠"注册"拿到上千账号(每IP 5次/小时限流)，故直接在库里幂等播种，
 * 跑完即清理，绝不污染真实用户数据。
 *
 * 标记：username 以 "__loadtest_" 前缀；phone 用保留段 199+8位序号。
 * 清理只删带该前缀的账号及其会话/消息/成员，绝不触碰真实用户。
 *
 * 用法（在 backend-v2 同机执行）：
 *   APP_DIR=/root/v信/backend-v2 node seed_test_users.js create 300
 *   APP_DIR=/root/v信/backend-v2 node seed_test_users.js cleanup
 */
'use strict';
const path = require('path');
const APP_DIR = process.env.APP_DIR || '/root/v信/backend-v2';
const Database = require(path.join(APP_DIR, 'node_modules/better-sqlite3'));
const bcrypt = require(path.join(APP_DIR, 'node_modules/bcryptjs'));
// 不要 require('src/config')！它在缺 JWT_SECRET 时会 process.exit(1)，从 ops/ 目录跑必崩。
const DB_PATH = process.env.DB_PATH || path.join(APP_DIR, 'wechat.db');

const PREFIX = '__loadtest_';
const PASS = 'Loadtest1234';
// 手机号用非手机号格式的保留标记 "LT"+序号，绝不会与真实 11 位手机号碰撞。
// 登录接口只做 phone 精确匹配、不校验格式，故合法可用。
const phoneFor = i => 'LT' + String(i).padStart(9, '0');

const db = new Database(DB_PATH);
db.pragma('busy_timeout = 8000');

function cleanup() {
  const ids = db.prepare(`SELECT id FROM users WHERE username LIKE '${PREFIX}%'`).all().map(r => r.id);
  if (!ids.length) { console.log('cleanup: 无测试账号'); return; }
  const ph = ids.map(() => '?').join(',');
  const tx = db.transaction(() => {
    // 删测试账号参与的会话相关数据（只涉及测试账号自己的 filehelper 会话）
    const convs = db.prepare(`SELECT DISTINCT conversation_id FROM conversation_members WHERE user_id IN (${ph})`).all(...ids).map(r => r.conversation_id);
    for (const t of ['messages', 'conversation_members', 'conversation_settings']) {
      try { db.prepare(`DELETE FROM ${t} WHERE user_id IN (${ph})`).run(...ids); } catch (_) {}
    }
    if (convs.length) {
      const cph = convs.map(() => '?').join(',');
      try { db.prepare(`DELETE FROM messages WHERE conversation_id IN (${cph})`).run(...convs); } catch (_) {}
      try { db.prepare(`DELETE FROM conversation_members WHERE conversation_id IN (${cph})`).run(...convs); } catch (_) {}
      try { db.prepare(`DELETE FROM conversations WHERE id IN (${cph})`).run(...convs); } catch (_) {}
    }
    for (const t of ['user_sessions', 'contacts']) {
      try { db.prepare(`DELETE FROM ${t} WHERE user_id IN (${ph})`).run(...ids); } catch (_) {}
    }
    db.prepare(`DELETE FROM users WHERE id IN (${ph})`).run(...ids);
  });
  tx();
  console.log(`cleanup: 已删除 ${ids.length} 个测试账号及其会话/消息`);
}

function create(n) {
  cleanup(); // 先清旧的，保证幂等
  const hash = bcrypt.hashSync(PASS, 10);
  const { v4: uuidv4 } = require(path.join(APP_DIR, 'node_modules/uuid'));
  const ins = db.prepare("INSERT INTO users (id,username,phone,password,wechat_id,status) VALUES (?,?,?,?,?,'offline')");
  const tx = db.transaction(() => {
    for (let i = 0; i < n; i++) {
      ins.run(uuidv4(), `${PREFIX}${i}`, phoneFor(i), hash, '7' + String(100000 + i).slice(-5));
    }
  });
  tx();
  console.log(`create: 已播种 ${n} 个测试账号 (phone ${phoneFor(0)}..${phoneFor(n - 1)}, 密码 ${PASS})`);
}

const cmd = process.argv[2];
const n = parseInt(process.argv[3] || '300', 10);
if (cmd === 'create') create(n);
else if (cmd === 'cleanup') cleanup();
else { console.log('用法: node seed_test_users.js create <N> | cleanup'); process.exit(1); }
db.close();
