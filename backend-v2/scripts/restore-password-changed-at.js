'use strict';
/**
 * 按快照恢复每个用户 migration 104 之前的 password_changed_at 原值。
 *
 * 用法：
 *   node scripts/restore-password-changed-at.js <快照文件.json>
 *
 * 说明：
 *   - 逐用户恢复原值（UPDATE ... WHERE id=?），禁止一律置 0：
 *     置 0 会让「历史上因真实修改密码而应失效的旧 JWT」重新复活。
 *   - 只更新快照中出现的用户；快照之外的用户（上线后新注册）一律不动。
 *   - 直接打开 SQLite 执行，不触发 applySchema / 不再执行 migration 104。
 *   - 全程单事务：任一行失败则整体回滚。
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../src/config');

const snapshotFile = process.argv[2];
if (!snapshotFile) {
  console.error('[restore] 用法: node scripts/restore-password-changed-at.js <快照文件.json>');
  process.exit(1);
}
if (!fs.existsSync(snapshotFile)) {
  console.error(`[restore] 快照文件不存在: ${snapshotFile}`);
  process.exit(1);
}

const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
if (!Array.isArray(snapshot.users)) {
  console.error('[restore] 快照格式无效：缺少 users 数组');
  process.exit(1);
}

const dbPath = process.env.DB_PATH || config.dbPath;
const db = new Database(dbPath);

const update = db.prepare('UPDATE users SET password_changed_at=? WHERE id=?');
const restoreAll = db.transaction((users) => {
  let changed = 0;
  for (const u of users) {
    if (!u || typeof u.id !== 'string') continue;
    const info = update.run(u.password_changed_at ?? 0, u.id);
    changed += info.changes;
  }
  return changed;
});

const changed = restoreAll(snapshot.users);
db.close();

console.log(`[restore] ✅ 已恢复 ${changed} 个用户的 password_changed_at 原值（快照共 ${snapshot.users.length} 条）`);
console.log(`[restore] 数据源快照: ${snapshotFile}（导出时间 ${snapshot.exported_at || '未知'}）`);
