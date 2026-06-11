# Sentry 错误追踪集成指南

## 简介

Sentry 是一个实时错误追踪和性能监控平台，可以自动捕获：
- 未处理的异常
- 性能问题
- 用户操作面包屑
- 会话信息

## 快速开始

### 1. 安装依赖

```bash
npm install --save @sentry/node @sentry/tracing
```

### 2. 获取 DSN

1. 访问 [Sentry](https://sentry.io)
2. 创建账户并登录
3. 创建新项目，选择 "Node.js"
4. 复制 DSN（格式：`https://<key>@<project>.ingest.sentry.io/<id>`）

### 3. 配置环境变量

```bash
# .env.local
SENTRY_DSN=https://your-key@your-project.ingest.sentry.io/your-id
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### 4. 在应用启动时初始化 Sentry

```javascript
// src/server.js
const { initSentry, attachSentryMiddleware, attachSentryErrorHandler } = require('./utils/sentry');

// 初始化 Sentry
initSentry();

const app = require('./app');

// 在路由之前附加 Sentry 中间件
attachSentryMiddleware(app);

// 在路由之后附加错误处理
attachSentryErrorHandler(app);

// 启动服务器
const server = app.listen(3002, () => {
  console.log('🚀 V信后端运行在 http://localhost:3002');
});
```

## 使用示例

### 捕获异常

```javascript
const { captureException } = require('../utils/sentry');

try {
  // 某些操作
  throw new Error('Something went wrong');
} catch (err) {
  captureException(err, {
    userId: user.id,
    tags: {
      operation: 'send-message',
      conversationId: convId,
    },
    extra: {
      messageContent: message.content,
    },
  });
}
```

### 捕获消息

```javascript
const { captureMessage } = require('../utils/sentry');

// 记录重要事件
captureMessage('Unusual login pattern detected', 'warning', {
  userId: user.id,
  loginCount: logins,
  lastLoginTime: lastLogin,
});
```

### 设置用户信息

```javascript
const { setUser, clearUser } = require('../utils/sentry');

// 登录时
app.post('/api/auth/login', (req, res) => {
  // ... 认证逻辑
  setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
});

// 登出时
app.post('/api/auth/logout', (req, res) => {
  clearUser();
  // ... 登出逻辑
});
```

### 添加面包屑（用户操作追踪）

```javascript
const { addBreadcrumb } = require('../utils/sentry');

// 在关键操作中
addBreadcrumb({
  category: 'user-action',
  message: 'User sent a message',
  level: 'info',
  data: {
    conversationId: convId,
    messageLength: content.length,
  },
});
```

### 记录性能指标

```javascript
const { capturePerformance } = require('../utils/sentry');

const startTime = Date.now();
const result = await database.query('SELECT * FROM users');
const duration = Date.now() - startTime;

capturePerformance('database-query', duration, {
  query: 'SELECT * FROM users',
  rowCount: result.length,
});
```

## Express 集成

### 自动错误处理

```javascript
// src/app.js
const { createErrorCatcherMiddleware } = require('./utils/sentry');

// 在错误处理中间件中使用
app.use(createErrorCatcherMiddleware());
```

### 请求上下文

Sentry 会自动捕获：
- HTTP 方法和 URL
- 请求头（敏感信息已过滤）
- 查询参数
- 请求体
- 客户端 IP

## Sentry 仪表板功能

### 1. 问题追踪

- 自动分组相似的错误
- 追踪错误的历史和状态
- 标记为已解决/忽略

### 2. 发布追踪

```javascript
// 在发布新版本时标记 release
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: '1.0.0-beta', // 版本号
});
```

### 3. 性能监控

- 追踪缓慢的事务
- 识别性能瓶颈
- 查看 Web Vitals

### 4. 用户反馈

```javascript
const { getSentry } = require('./utils/sentry');
const Sentry = getSentry();

// 捕获错误并显示用户反馈表单
try {
  // 风险操作
} catch (err) {
  const eventId = Sentry.captureException(err);
  // 显示用户反馈表单
  Sentry.showReportDialog({ eventId });
}
```

## 告警规则

在 Sentry 中配置告警：

1. **高错误率**
   - 条件：错误数 > 100 / 小时
   - 动作：发送通知

2. **性能退化**
   - 条件：P95 响应时间增加 > 50%
   - 动作：创建问题 / 发送 Slack

3. **新错误**
   - 条件：第一次出现的错误
   - 动作：立即通知

## 隐私和合规

### 数据过滤

```javascript
// 自动过滤敏感信息
Sentry.init({
  beforeSend(event) {
    // 移除密码字段
    if (event.request && event.request.data) {
      delete event.request.data.password;
    }
    
    // 移除信用卡信息
    if (event.request && event.request.body) {
      event.request.body = event.request.body.replace(
        /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
        'XXXX-XXXX-XXXX-XXXX'
      );
    }

    return event;
  },
});
```

### GDPR 合规

```javascript
// 用户数据管理
const { clearUser } = require('./utils/sentry');

// 用户请求删除数据时
app.delete('/api/users/:userId', async (req, res) => {
  await deleteUserData(req.params.userId);
  clearUser(); // 从 Sentry 中清除用户信息
});
```

## 常见场景

### 登录失败告警

```javascript
const { captureMessage, addBreadcrumb } = require('./utils/sentry');

app.post('/api/auth/login', async (req, res) => {
  try {
    const user = await authenticateUser(req.body);
    if (!user) {
      const failureCount = await getLoginFailureCount(req.ip);
      
      addBreadcrumb({
        category: 'auth',
        message: 'Login failed',
        level: 'warning',
        data: { ip: req.ip, failureCount },
      });

      if (failureCount > 5) {
        captureMessage(
          `Brute force attack detected from ${req.ip}`,
          'error'
        );
      }
    }
  } catch (err) {
    captureException(err);
  }
});
```

### 支付失败处理

```javascript
const { captureException } = require('./utils/sentry');

app.post('/api/payments/process', async (req, res) => {
  try {
    const result = await processPayment(req.body);
  } catch (err) {
    captureException(err, {
      userId: req.user.id,
      tags: {
        operation: 'payment-processing',
        paymentId: req.body.paymentId,
      },
      extra: {
        amount: req.body.amount,
        currency: req.body.currency,
        errorMessage: err.message,
      },
    });
    
    // 不要暴露支付错误细节给用户
    res.status(500).json({ error: 'Payment processing failed' });
  }
});
```

### 数据库连接池监控

```javascript
const { capturePerformance, captureMessage } = require('./utils/sentry');

const pool = createConnectionPool();

pool.on('error', (err) => {
  captureMessage(
    `Database pool error: ${err.message}`,
    'error'
  );
});

// 监控连接获取时间
const originalQuery = pool.query.bind(pool);
pool.query = function(...args) {
  const startTime = Date.now();
  const callback = args[args.length - 1];
  
  args[args.length - 1] = function(...callbackArgs) {
    const duration = Date.now() - startTime;
    capturePerformance('db-query', duration);
    callback(...callbackArgs);
  };
  
  return originalQuery(...args);
};
```

## 与其他工具集成

### Slack 通知

1. 在 Sentry 项目中，点击 "Integrations"
2. 搜索并安装 "Slack"
3. 选择 Slack 工作区和频道
4. 配置告警规则发送到 Slack

### GitHub 集成

1. 连接 GitHub 账户
2. 链接 Sentry 项目到 GitHub 仓库
3. 自动创建 Issue 和 PR

### PagerDuty 集成

用于关键错误的页面告警

## 配置参考

```javascript
{
  // Sentry DSN
  dsn: 'https://key@project.ingest.sentry.io/id',

  // 环境
  environment: 'production',

  // 版本号
  release: '1.0.0',

  // 性能追踪采样率（0.0 - 1.0）
  tracesSampleRate: 0.1,

  // 集成
  integrations: [
    new Sentry.Integrations.Http(),
    new Tracing.Integrations.Express(),
  ],

  // 在发送前处理事件
  beforeSend: (event, hint) => {
    // 过滤敏感数据
    return event;
  },

  // 忽略特定错误
  ignoreErrors: [
    // 浏览器扩展错误
    'chrome-extension://',
    'moz-extension://',
  ],
}
```

## 最佳实践

1. ✅ 为每个发布版本标记 release
2. ✅ 在登录时设置用户信息
3. ✅ 为关键操作添加面包屑
4. ✅ 过滤敏感数据
5. ✅ 定期审查 Sentry 仪表板
6. ✅ 配置告警规则
7. ✅ 链接到源代码仓库
8. ❌ 不要发送过多事件（影响性能和成本）

## 成本优化

### 事件采样

```javascript
Sentry.init({
  sampleRate: 0.9, // 只捕获 90% 的事件
});
```

### 性能监控采样

```javascript
Sentry.init({
  tracesSampleRate: 0.1, // 只追踪 10% 的事务
});
```

### 动态采样

```javascript
{
  beforeSend: (event) => {
    // 对非错误事件进行采样
    if (event.level !== 'error') {
      if (Math.random() > 0.1) return null;
    }
    return event;
  },
}
```

## 常见问题

### Q: 如何测试 Sentry 是否工作？

```javascript
const { getSentry } = require('./utils/sentry');
const Sentry = getSentry();

// 发送测试事件
Sentry.captureMessage('Test Sentry integration');
```

### Q: Sentry 会影响应用性能吗？

答：影响最小。Sentry 使用异步发送，不会阻塞请求。

### Q: 如何禁用 Sentry？

```javascript
// .env.local
SENTRY_DSN=  # 留空以禁用
```

## 更多资源

- [Sentry 官方文档](https://docs.sentry.io/)
- [Node.js SDK 文档](https://docs.sentry.io/platforms/node/)
- [Express 集成](https://docs.sentry.io/platforms/node/guides/express/)
