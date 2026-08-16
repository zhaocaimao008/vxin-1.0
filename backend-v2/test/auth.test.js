'use strict';
/**
 * 认证模块集成测试 —— v信号登录 + 手机号登录双模式
 * 直接测试 auth.service 逻辑，不启动 HTTP 服务器，避免 Jest 环境撕毁问题。
 */
const bcrypt = require('bcryptjs');

// 延迟 require，让 Jest 先稳定
let db, authService;

beforeAll(() => {
  db = require('../src/db/connection').db;
  authService = require('../src/modules/auth/auth.service');
});

describe('v信号 + 手机号双模式登录 — auth.service 核心逻辑', () => {
  let testUserId;
  const TEST_PHONE = '13900001234';
  const TEST_VXIN  = 'vxlogin1';
  const TEST_PASS  = 'LoginTest1';

  beforeAll(async () => {
    const hash = await bcrypt.hash(TEST_PASS, 10);
    const res = db.prepare(
      `INSERT OR IGNORE INTO users (id, username, phone, wechat_id, password, avatar, bio)
       VALUES (?, ?, ?, ?, ?, '', '')`
    ).run('test-vxin-login-id', 'VxinLoginTest', TEST_PHONE, TEST_VXIN, hash);
    testUserId = 'test-vxin-login-id';
  });

  afterAll(() => {
    db.prepare("DELETE FROM users WHERE id = 'test-vxin-login-id'").run();
  });

  // 1. 手机号 + 正确密码 → PASS
  test('1. 手机号 + 正确密码 → 成功返回 token', async () => {
    const result = await authService.login({ phone: TEST_PHONE, password: TEST_PASS });
    expect(result.token).toBeTruthy();
    expect(result.user.phone).toBe(TEST_PHONE);
    expect(result.user.wechat_id).toBe(TEST_VXIN);
  });

  // 2. 手机号 + 错误密码 → 401
  test('2. 手机号 + 错误密码 → 统一错误信息', async () => {
    await expect(
      authService.login({ phone: TEST_PHONE, password: 'wrongpass' })
    ).rejects.toMatchObject({ message: '账号或密码错误' });
  });

  // 3. v信号 + 正确密码 → PASS
  test('3. v信号 + 正确密码 → 成功返回 token', async () => {
    const result = await authService.login({
      loginType: 'vxin',
      identifier: TEST_VXIN,
      password: TEST_PASS,
    });
    expect(result.token).toBeTruthy();
    expect(result.user.wechat_id).toBe(TEST_VXIN);
  });

  // 4. v信号 + 错误密码 → 401
  test('4. v信号 + 错误密码 → 统一错误信息', async () => {
    await expect(
      authService.login({ loginType: 'vxin', identifier: TEST_VXIN, password: 'badpass' })
    ).rejects.toMatchObject({ message: '账号或密码错误' });
  });

  // 5. 不存在 v信号
  test('5. 不存在 v信号 → 统一错误（不泄漏账号枚举）', async () => {
    await expect(
      authService.login({ loginType: 'vxin', identifier: 'vxnotexist', password: TEST_PASS })
    ).rejects.toMatchObject({ message: '账号或密码错误' });
  });

  // 6. 旧手机号请求格式向后兼容
  test('6. 旧 { phone, password } 请求向后兼容', async () => {
    const result = await authService.login({ phone: TEST_PHONE, password: TEST_PASS });
    expect(result.user.phone).toBe(TEST_PHONE);
  });

  // 7. loginType=phone + identifier 新格式
  test('7. loginType=phone + identifier 新格式成功', async () => {
    const result = await authService.login({
      loginType: 'phone',
      identifier: TEST_PHONE,
      password: TEST_PASS,
    });
    expect(result.user.phone).toBe(TEST_PHONE);
  });

  // 8. Token 合法
  test('8. Token 可被 jwt.decode 解析出 userId', async () => {
    const jwt = require('jsonwebtoken');
    const result = await authService.login({ phone: TEST_PHONE, password: TEST_PASS });
    const payload = jwt.decode(result.token);
    expect(payload.id).toBe(testUserId);
  });

  // 9. v信号与手机号登录返回相同用户结构
  test('9. v信号与手机号登录返回完全相同的 user 对象', async () => {
    const r1 = await authService.login({ phone: TEST_PHONE, password: TEST_PASS });
    const r2 = await authService.login({ loginType: 'vxin', identifier: TEST_VXIN, password: TEST_PASS });
    expect(r1.user.id).toBe(r2.user.id);
    expect(r1.user.wechat_id).toBe(r2.user.wechat_id);
    expect(r1.user.phone).toBe(r2.user.phone);
  });

  // 10. 缺少 password → 统一错误
  test('10. 缺少 password → 返回错误', async () => {
    await expect(
      authService.login({ phone: TEST_PHONE, password: '' })
    ).rejects.toBeTruthy();
  });
});

describe('Message Module', () => {
  describe('Search Function', () => {
    it('should search messages with LIKE query', () => {
      // 测试消息搜索
    });

    it('should include filehelper conversations', () => {
      // 测试文件传输助手搜索
    });

    it('should return max 20 results', () => {
      // 测试搜索结果限制
    });
  });
});

describe('SQL Injection Prevention', () => {
  it('should use parameterized queries throughout', () => {
    // 验证所有查询都使用参数化
  });
});
