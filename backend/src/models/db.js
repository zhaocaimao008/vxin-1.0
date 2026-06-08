const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../wechat.db'));

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -32000');   // 32 MB page cache
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 268435456'); // 256 MB mmap
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT DEFAULT '',
    cover_photo TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    wechat_id TEXT DEFAULT '',
    status TEXT DEFAULT 'online',
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    remark TEXT DEFAULT '',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (contact_id) REFERENCES users(id),
    UNIQUE(user_id, contact_id)
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'private',
    name TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    file_url TEXT DEFAULT '',
    reply_to_id TEXT DEFAULT NULL,
    deleted INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS message_reactions (
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    PRIMARY KEY (message_id, user_id),
    FOREIGN KEY (message_id) REFERENCES messages(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS conversation_settings (
    user_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    pinned INTEGER DEFAULT 0,
    muted INTEGER DEFAULT 0,
    last_read_at INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, conversation_id)
  );

  CREATE TABLE IF NOT EXISTS friend_requests (
    id TEXT PRIMARY KEY,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    message TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (from_id) REFERENCES users(id),
    FOREIGN KEY (to_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS moments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    images TEXT DEFAULT '[]',
    likes TEXT DEFAULT '[]',
    visibility TEXT DEFAULT 'all',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS moment_comments (
    id TEXT PRIMARY KEY,
    moment_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (moment_id) REFERENCES moments(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    extra TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS blocked_users (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    blocked_id TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (blocked_id) REFERENCES users(id),
    UNIQUE(user_id, blocked_id)
  );

  CREATE TABLE IF NOT EXISTS red_packets (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    total_amount INTEGER NOT NULL,
    total_count INTEGER NOT NULL,
    claimed_count INTEGER DEFAULT 0,
    greeting TEXT DEFAULT '恭喜发财，大吉大利',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );

  CREATE TABLE IF NOT EXISTS red_packet_claims (
    packet_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    claimed_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (packet_id, user_id),
    FOREIGN KEY (packet_id) REFERENCES red_packets(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    add_by_vxin_id INTEGER DEFAULT 1,
    add_by_phone INTEGER DEFAULT 1,
    require_verify INTEGER DEFAULT 1,
    profile_visible INTEGER DEFAULT 1,
    block_unknown_messages INTEGER DEFAULT 0,
    message_notify INTEGER DEFAULT 1,
    detail_preview INTEGER DEFAULT 1,
    sound INTEGER DEFAULT 1,
    vibrate INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Safe migrations for existing DBs
const migrations = [
  "ALTER TABLE users ADD COLUMN wechat_id TEXT DEFAULT ''",
  "ALTER TABLE users ADD COLUMN cover_photo TEXT DEFAULT ''",
  "ALTER TABLE messages ADD COLUMN reply_to_id TEXT DEFAULT NULL",
  "ALTER TABLE messages ADD COLUMN deleted INTEGER DEFAULT 0",
  "ALTER TABLE messages ADD COLUMN edited INTEGER DEFAULT 0",
  "ALTER TABLE moments ADD COLUMN visibility TEXT DEFAULT 'all'",
  "ALTER TABLE moment_comments ADD COLUMN reply_to_user TEXT DEFAULT ''",
  "ALTER TABLE conversations ADD COLUMN owner_id TEXT DEFAULT NULL",
  "ALTER TABLE conversations ADD COLUMN announcement TEXT DEFAULT ''",
  "ALTER TABLE conversations ADD COLUMN no_private_chat INTEGER DEFAULT 0",
  "ALTER TABLE conversations ADD COLUMN mute_all INTEGER DEFAULT 0",
  "ALTER TABLE conversation_members ADD COLUMN role TEXT DEFAULT 'member'",
  `CREATE TABLE IF NOT EXISTS pinned_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    pinned_by TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(conversation_id, message_id)
  )`,
  "ALTER TABLE conversation_settings ADD COLUMN last_read_message_id TEXT DEFAULT NULL",
  `CREATE TABLE IF NOT EXISTS message_deliveries (
    message_id   TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    delivered_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (message_id, user_id)
  )`,
  "CREATE INDEX IF NOT EXISTS idx_deliveries_msg ON message_deliveries(message_id)",
  "CREATE INDEX IF NOT EXISTS idx_deliveries_user ON message_deliveries(user_id)",
  // 群昵称
  "ALTER TABLE conversation_members ADD COLUMN nickname TEXT DEFAULT NULL",
  // 群邀请令牌
  `CREATE TABLE IF NOT EXISTS group_invite_tokens (
    token           TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    created_by      TEXT NOT NULL,
    expires_at      INTEGER NOT NULL,
    created_at      INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  )`,
  "CREATE INDEX IF NOT EXISTS idx_invite_conv ON group_invite_tokens(conversation_id)",
  "ALTER TABLE conversations ADD COLUMN no_add_friend INTEGER DEFAULT 0",
  "CREATE INDEX IF NOT EXISTS idx_messages_conv_time ON messages(conversation_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)",
  "CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id)",
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    subscription TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(user_id, endpoint),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS device_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    platform TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(user_id, token),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  "CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id)",
  // 覆盖索引：unread 计数 correlated subquery 专用，避免回表
  "CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, created_at, sender_id) WHERE deleted=0",
  // 历史动态点赞表保留给旧数据库迁移使用
  `CREATE TABLE IF NOT EXISTS moment_likes (
    moment_id  TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (moment_id, user_id),
    FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
  )`,
  "CREATE INDEX IF NOT EXISTS idx_moment_likes_moment ON moment_likes(moment_id)",
  `CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    add_by_vxin_id INTEGER DEFAULT 1,
    add_by_phone INTEGER DEFAULT 1,
    require_verify INTEGER DEFAULT 1,
    profile_visible INTEGER DEFAULT 1,
    block_unknown_messages INTEGER DEFAULT 0,
    message_notify INTEGER DEFAULT 1,
    detail_preview INTEGER DEFAULT 1,
    sound INTEGER DEFAULT 1,
    vibrate INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  "ALTER TABLE user_settings ADD COLUMN add_by_vxin_id INTEGER DEFAULT 1",
  "ALTER TABLE user_settings ADD COLUMN add_by_phone INTEGER DEFAULT 1",
  "ALTER TABLE user_settings ADD COLUMN require_verify INTEGER DEFAULT 1",
  "ALTER TABLE user_settings ADD COLUMN profile_visible INTEGER DEFAULT 1",
  "ALTER TABLE user_settings ADD COLUMN block_unknown_messages INTEGER DEFAULT 0",
  "ALTER TABLE user_settings ADD COLUMN message_notify INTEGER DEFAULT 1",
  "ALTER TABLE user_settings ADD COLUMN detail_preview INTEGER DEFAULT 1",
  "ALTER TABLE user_settings ADD COLUMN sound INTEGER DEFAULT 1",
  "ALTER TABLE user_settings ADD COLUMN vibrate INTEGER DEFAULT 0",
  "ALTER TABLE user_settings ADD COLUMN updated_at INTEGER DEFAULT (strftime('%s', 'now'))",
  `CREATE TABLE IF NOT EXISTS user_sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    device     TEXT DEFAULT '未知设备',
    platform   TEXT DEFAULT 'Web',
    ip         TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    last_seen  INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(user_id, device, platform),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  "CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id)",
];
migrations.forEach(sql => { try { db.prepare(sql).run(); } catch {} });

function generateNumericVxinId() {
  for (let i = 0; i < 1000; i += 1) {
    const value = String(Math.floor(100000 + Math.random() * 900000));
    const taken = db.prepare('SELECT 1 FROM users WHERE wechat_id=?').get(value);
    if (!taken) return value;
  }

  for (let n = 100000; n <= 999999; n += 1) {
    const value = String(n);
    const taken = db.prepare('SELECT 1 FROM users WHERE wechat_id=?').get(value);
    if (!taken) return value;
  }

  throw new Error('v信号已分配完');
}

function ensureNumericVxinIds() {
  const users = db.prepare(`
    SELECT id FROM users
    WHERE wechat_id IS NULL
       OR wechat_id = ''
       OR length(wechat_id) != 6
       OR wechat_id GLOB '*[^0-9]*'
  `).all();
  const update = db.prepare('UPDATE users SET wechat_id=? WHERE id=?');
  db.transaction(() => {
    for (const user of users) update.run(generateNumericVxinId(), user.id);

    const duplicates = db.prepare(`
      SELECT wechat_id FROM users
      WHERE wechat_id IS NOT NULL AND wechat_id != ''
      GROUP BY wechat_id
      HAVING COUNT(*) > 1
    `).all();
    for (const { wechat_id } of duplicates) {
      const rows = db.prepare('SELECT id FROM users WHERE wechat_id=? ORDER BY created_at, id').all(wechat_id);
      for (const row of rows.slice(1)) update.run(generateNumericVxinId(), row.id);
    }
  })();
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wechat_id_unique ON users(wechat_id)').run();
}

ensureNumericVxinIds();

// ── 将旧版 moments.likes JSON 数据迁移到 moment_likes 表 ───────
try {
  const migratedFlag = db.prepare("SELECT 1 FROM moment_likes LIMIT 1").get();
  if (!migratedFlag) {
    const rows = db.prepare("SELECT id, likes FROM moments WHERE likes IS NOT NULL AND likes != '[]'").all();
    const insert = db.prepare('INSERT OR IGNORE INTO moment_likes (moment_id, user_id) VALUES (?,?)');
    db.transaction(() => {
      for (const row of rows) {
        try {
          const ids = JSON.parse(row.likes || '[]');
          for (const uid of ids) insert.run(row.id, uid);
        } catch {}
      }
    })();
  }
} catch {}

// ── FTS5 全文索引 ──────────────────────────────────────────────
// trigram tokenizer：支持中文子串 MATCH，等价于 LIKE '%q%' 但走索引
try {
  db.prepare(`
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      message_id    UNINDEXED,
      conversation_id UNINDEXED,
      content,
      tokenize      = 'trigram'
    )
  `).run();

  // 首次填充（仅当 FTS 表为空时执行）
  const ftsEmpty = db.prepare('SELECT COUNT(*) AS n FROM messages_fts').get().n === 0;
  if (ftsEmpty) {
    db.prepare(`
      INSERT INTO messages_fts (message_id, conversation_id, content)
      SELECT id, conversation_id, content
      FROM   messages
      WHERE  type = 'text' AND deleted = 0
    `).run();
  }

  // 同步触发器（INSERT / 软删除 / 编辑）
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS fts_messages_insert
    AFTER INSERT ON messages WHEN NEW.type='text' AND NEW.deleted=0
    BEGIN
      INSERT INTO messages_fts(message_id, conversation_id, content)
      VALUES (NEW.id, NEW.conversation_id, NEW.content);
    END;

    CREATE TRIGGER IF NOT EXISTS fts_messages_delete
    AFTER UPDATE OF deleted ON messages WHEN NEW.deleted=1
    BEGIN
      DELETE FROM messages_fts WHERE message_id = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS fts_messages_edit
    AFTER UPDATE OF content ON messages WHEN NEW.type='text' AND NEW.deleted=0
    BEGIN
      DELETE FROM messages_fts WHERE message_id = OLD.id;
      INSERT INTO messages_fts(message_id, conversation_id, content)
      VALUES (NEW.id, NEW.conversation_id, NEW.content);
    END;
  `);
} catch (e) {
  console.warn('[db] FTS5 setup skipped:', e.message);
}

// ── 读写分离：只读连接供主线程高频 SELECT 使用 ─────────────────
// WAL 模式下只读连接与写连接完全并发，互不阻塞
const readDb = new Database(path.join(__dirname, '../../wechat.db'), { readonly: true });
readDb.pragma('cache_size = -32000');
readDb.pragma('temp_store = MEMORY');
readDb.pragma('mmap_size = 268435456');

module.exports = db;
module.exports.readDb = readDb;
