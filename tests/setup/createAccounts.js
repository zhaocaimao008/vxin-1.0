/**
 * 第一步：批量创建 / 登录测试账号
 * 直接写入 DB 绕过 rate limit，再登录获取 cookie
 */
const api  = require('../utils/api');
const cfg  = require('../config');
const rep  = require('../utils/reporter');
const fs   = require('fs');
const path = require('path');

const ACCOUNTS_FILE = path.join(cfg.REPORTS_DIR, 'accounts.json');

// 直接操作 DB（绕过 rate limit）
let dbModule;
function getDb() {
  if (!dbModule) {
    dbModule = require('../../backend/src/models/db');
  }
  return dbModule;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function createAccounts(count = cfg.BOT_COUNT) {
  rep.log(`▶ 开始创建 ${count} 个测试账号（直接写 DB）`);

  const bcrypt = require('bcryptjs');
  const { v4: uuidv4 } = require('uuid');
  const db = getDb();
  const hash = await bcrypt.hash(cfg.BOT_PASS, 6); // rounds=6 加快批量速度

  const accounts = [];

  for (let i = 1; i <= count; i++) {
    const username = `${cfg.BOT_PREFIX}${String(i).padStart(3, '0')}`;
    const phone    = `${cfg.BOT_PHONE_BASE}${String(i).padStart(3, '0')}`;

    // 检查是否已存在
    let user = db.prepare('SELECT id FROM users WHERE phone=?').get(phone);
    if (!user) {
      const id = uuidv4();
      db.prepare('INSERT INTO users (id,username,phone,password) VALUES (?,?,?,?)').run(id, username, phone, hash);
      user = { id };
    }

    accounts.push({ username, phone, password: cfg.BOT_PASS, id: user.id, cookie: '' });
    if (i % 20 === 0) rep.log(`  创建进度: ${i}/${count}`);
  }

  rep.log(`  DB 写入完成，直接生成 JWT token...`);

  // 直接用 JWT secret 生成 token（绕过 rate limit）
  require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET;
  const MAX_AGE = 30 * 24 * 3600;

  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i];
    try {
      const token = jwt.sign({ id: a.id, username: a.username }, JWT_SECRET, { expiresIn: `${MAX_AGE}s` });
      a.cookie = `vxin_token=${token}`;
    } catch (e) {
      rep.fail(`genToken:${a.username}`, e, 'medium');
    }
  }

  fs.mkdirSync(cfg.REPORTS_DIR, { recursive: true });
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));

  const ready = accounts.filter(a => a.cookie).length;
  rep.log(`✅ 账号就绪: ${ready}/${count}`);
  rep.pass('createAccounts', `${ready} 个账号就绪`);
  return accounts;
}

async function loadAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE)) return createAccounts();
  const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE));

  require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });
  const jwt = require('jsonwebtoken');
  const MAX_AGE = 30 * 24 * 3600;
  rep.log(`▶ 为 ${accounts.length} 个账号生成 JWT token`);
  for (const a of accounts) {
    if (!a.id) continue;
    const token = jwt.sign({ id: a.id, username: a.username }, process.env.JWT_SECRET, { expiresIn: `${MAX_AGE}s` });
    a.cookie = `vxin_token=${token}`;
  }
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  rep.pass('loadAccounts', `${accounts.filter(a => a.cookie).length} 个账号已就绪`);
  return accounts;
}

async function setupFriendships(accounts) {
  rep.log('▶ 建立好友关系 (前10个互为好友)');
  const db = getDb();
  const { v4: uuidv4 } = require('uuid');
  const first10 = accounts.slice(0, 10);

  const insertContact = db.prepare('INSERT OR IGNORE INTO contacts (id,user_id,contact_id) VALUES (?,?,?)');
  const addFriends = db.transaction(() => {
    for (let i = 0; i < first10.length; i++) {
      for (let j = i + 1; j < first10.length; j++) {
        insertContact.run(uuidv4(), first10[i].id, first10[j].id);
        insertContact.run(uuidv4(), first10[j].id, first10[i].id);
      }
    }
  });
  addFriends();
  rep.pass('setupFriendships', '前10个账号互为好友');
}

if (require.main === module) {
  (async () => {
    const accounts = await createAccounts();
    await setupFriendships(accounts);
    rep.save();
  })();
}

module.exports = { createAccounts, loadAccounts, setupFriendships };
