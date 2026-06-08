module.exports = {
  BASE_URL:   'http://localhost:3002',
  WS_URL:     'http://localhost:3002',

  // 账号
  BOT_COUNT:        500,
  BOT_PREFIX:       'testbot',
  BOT_PASS:         'Test@123456',
  BOT_PHONE_BASE:   '17000000',   // 170-00000001 ~ 170-00000500

  // 压测规模
  STRESS_BOTS:          100,      // 并发机器人数
  STRESS_WORKERS:        50,      // 实际发消息 worker 数
  GROUP_COUNT:          100,      // 群数量
  GROUP_MEMBER_MAX:     100,      // 单群最大成员（受限于账号数）
  MSG_COUNT:         100000,      // 压测消息总数
  STRESS_DURATION_S:    300,      // 压测最长持续秒数（5分钟）

  // 随机机器人
  BOT_ACTIVE_COUNT:     100,      // 随机机器人并发数
  BOT_ACTIVE_DURATION: 120_000,   // 每轮机器人活动时长 ms

  // 内存监控
  MEM_INTERVAL_MS:   600_000,     // 每 10 分钟采样一次

  // 24h 运行
  LOOP_INTERVAL_MS:  300_000,     // 轮间隔 5 分钟
  LOOP_DURATION_H:        24,     // 总运行时长（小时）

  // 路径
  REPORTS_DIR:      __dirname + '/test-reports',
  SCREENSHOTS_DIR:  __dirname + '/test-reports/screenshots',
};
