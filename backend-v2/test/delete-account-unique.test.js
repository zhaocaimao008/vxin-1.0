'use strict';
/**
 * delete-account 唯一约束回归测试。
 *
 * 背景：软删时 wechat_id 置 '' 会与全表唯一索引 idx_users_wechat_id_unique 冲突，
 *       第二个被注销账号触发 UNIQUE constraint failed: users.wechat_id → 500。
 * 修复：wechat_id 置 NULL（SQLite UNIQUE 允许多个 NULL），且 ensureNumericVxinIds 排除 banned。
 *
 * 覆盖：① 注销第一个账号 200；② 注销第二个账号 200（不再 500）；
 *       ③ 已注销账号唯一字段不冲突（wechat_id 均为 NULL，username/phone 随机不重复）；
 *       ④ API 全程不返回 500。
 */
const { request, app, makeUser } = require('./helpers');
const { db } = require('../src/db/connection');

async function del(user, password) {
  return request(app)
    .post('/api/auth/delete-account')
    .set('Authorization', `Bearer ${user.token}`)
    .send({ password: password ?? user.password });
}

describe('delete-account · 唯一约束', () => {
  test('注销第一个账号 → 200', async () => {
    const u = await makeUser({ username: 'du_unq_first' });
    const res = await del(u);
    expect(res.status).toBe(200);
  });

  test('连续注销两个账号均 200（第二个不再 500）', async () => {
    const u1 = await makeUser({ username: 'du_unq_a' });
    const u2 = await makeUser({ username: 'du_unq_b' });
    const r1 = await del(u1);
    expect(r1.status).toBe(200);
    const r2 = await del(u2);
    expect(r2.status).toBe(200);
  });

  test('已注销账号唯一字段不冲突（wechat_id 均为 NULL，username/phone 随机不重复）', async () => {
    const u1 = await makeUser({ username: 'du_unq_c' });
    const u2 = await makeUser({ username: 'du_unq_d' });
    await del(u1);
    await del(u2);
    const rows = db.prepare('SELECT username, phone, wechat_id FROM users WHERE id IN (?,?)').all(u1.userId, u2.userId);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.wechat_id).toBeNull();
      expect(r.username.startsWith('已注销')).toBe(true);
      expect(r.phone.startsWith('deleted_')).toBe(true);
    }
    expect(new Set(rows.map(r => r.username)).size).toBe(2);
    expect(new Set(rows.map(r => r.phone)).size).toBe(2);
    // 唯一索引仍可正常创建（无重复冲突）
    const dup = db.prepare(`
      SELECT wechat_id FROM users
      WHERE wechat_id IS NOT NULL
      GROUP BY wechat_id HAVING COUNT(*) > 1
    `).all();
    expect(dup).toHaveLength(0);
  });

  test('注销后重启补发逻辑不触碰 banned 用户（wechat_id 保持 NULL）', async () => {
    const u = await makeUser({ username: 'du_unq_e' });
    await del(u);
    // 模拟启动时 ensureNumericVxinIds 的过滤条件：banned=0 才会被补发
    const picked = db.prepare(`
      SELECT id FROM users
      WHERE banned = 0
        AND (wechat_id IS NULL OR wechat_id = ''
         OR length(wechat_id) != 6 OR wechat_id GLOB '*[^0-9]*')
    `).all();
    expect(picked.map(p => p.id)).not.toContain(u.userId);
    const row = db.prepare('SELECT wechat_id, banned FROM users WHERE id=?').get(u.userId);
    expect(row.banned).toBe(1);
    expect(row.wechat_id).toBeNull();
  });
});
