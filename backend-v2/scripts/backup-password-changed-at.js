'use strict';
/**
 * 备份全部用户的 password_changed_at 原值快照（BATCH4 migration 104 执行前必须运行）。
 *
 * 用法：
 *   node scripts/backup-password-changed-at.js [输出路径]
 *
 * 说明：
 *   - 以只读模式打开 SQLite，绝不触发 applySchema / migration 104
 *   - 输出 JSON：{ exported_at, count, users: [{ id, password_changed_at }] }
 *   - 默认输出到 backend-v2/backups/password-changed-at-<UTC时间戳>.json
 *
 * 回滚（禁一律置 0，须按此快照逐用户恢复原值）：
 *   node scripts/restore-password-changed-at.js <快照文件>
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../src/config');

const dbPath = process.env.DB_PATH || config.dbPath;
const outPath = process.argv[2] || path.join(
  __dirname, '..', 'backups',
  `password-changed-at-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
);

if (!fs.existsSync(dbPath)) {
  console.error(`[backup] DB 不存在: ${dbPath}`);
  process.exit(1);
}

// 只读打开，绝不执行 migration
const db = new Database(dbPath, { readonly: true });
const rows = db.prepare('SELECT id, password_changed_at FROM users').all();
db.close();

const snapshot = {
  exported_at: new Date().toISOString(),
  db_path: dbPath,
  count: rows.length,
  users: rows.map(r => ({ id: r.id, password_changed_at: r.password_changed_at })),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

console.log(`[backup] ✅ 已导出 ${rows.length} 个用户的 password_changed_at 原值`);
console.log(`[backup] 快照文件: ${outPath}`);
console.log('[backup] 请妥善保存此文件；回滚时执行 restore-password-changed-at.js <该文件>');
