'use strict';
const bcrypt = require('bcrypt');
const db = require('../src/db/connection');

describe('v信号登录核心逻辑测试', () => {
  let testUserId;

  beforeAll(async () => {
    const hashedPwd = await bcrypt.hash('test1234', 10);
    const result = db.prepare(`
      INSERT INTO users (username, phone, password, wechat_id, avatar, bio)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('测试v信用户', '13900000088', hashedPwd, 'vxtest99', '', '');
    testUserId = result.lastInsertRowid;
  });

  afterAll(() => {
    db.prepare('DELETE FROM users WHERE id=?').run(testUserId);
  });

  test('根据手机号查询用户成功', () => {
    const user = db.prepare('SELECT * FROM users WHERE phone=?').get('13900000088');
    expect(user).toBeTruthy();
    expect(user.phone).toBe('13900000088');
    expect(user.wechat_id).toBe('vxtest99');
  });

  test('根据 v信号查询用户成功', () => {
    const user = db.prepare('SELECT * FROM users WHERE wechat_id=?').get('vxtest99');
    expect(user).toBeTruthy();
    expect(user.phone).toBe('13900000088');
    expect(user.wechat_id).toBe('vxtest99');
  });

  test('密码验证成功', async () => {
    const user = db.prepare('SELECT * FROM users WHERE wechat_id=?').get('vxtest99');
    const valid = await bcrypt.compare('test1234', user.password);
    expect(valid).toBe(true);
  });

  test('密码验证失败', async () => {
    const user = db.prepare('SELECT * FROM users WHERE wechat_id=?').get('vxtest99');
    const valid = await bcrypt.compare('wrongpass', user.password);
    expect(valid).toBe(false);
  });

  test('不存在的 v信号查询返回 undefined', () => {
    const user = db.prepare('SELECT * FROM users WHERE wechat_id=?').get('notexist');
    expect(user).toBeUndefined();
  });

  test('不存在的手机号查询返回 undefined', () => {
    const user = db.prepare('SELECT * FROM users WHERE phone=?').get('19999999999');
    expect(user).toBeUndefined();
  });
});
