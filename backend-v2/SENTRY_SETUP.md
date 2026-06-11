# v信 后端 — Sentry 错误追踪部署指南

## 快速开始

### 1. 使用 Sentry Cloud（推荐）

访问 https://sentry.io，创建免费账户并新建项目：

1. 登录 Sentry
2. 创建新项目
3. 选择平台: Node.js
4. 复制 DSN (Data Source Name)
5. 设置环境变量

### 2. 本地部署 Sentry

#### 方式 A: Docker 容器（单容器简化版）

```bash
cd /root/v信/backend-v2
docker run -d \
  --name sentry \
  -p 9000:9000 \
  -e SENTRY_SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))') \
  getsentry/sentry:latest
```

#### 方式 B: Docker Compose（完整部署）

```bash
cat > docker-compose-sentry.yml << 'COMPOSE'
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: sentry
      POSTGRES_USER: sentry
      POSTGRES_PASSWORD: sentry
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    volumes:
      - redis_data:/data

  sentry:
    image: getsentry/sentry:latest
    environment:
      SENTRY_SECRET_KEY: ${SENTRY_SECRET_KEY}
      SENTRY_POSTGRES_HOST: postgres
      SENTRY_POSTGRES_USER: sentry
      SENTRY_POSTGRES_PASSWORD: sentry
      SENTRY_REDIS_HOST: redis
    ports:
      - "9000:9000"
    depends_on:
      - postgres
      - redis

  sentry-worker:
    image: getsentry/sentry:latest
    command: sentry run worker
    environment:
      SENTRY_SECRET_KEY: ${SENTRY_SECRET_KEY}
      SENTRY_POSTGRES_HOST: postgres
      SENTRY_POSTGRES_USER: sentry
      SENTRY_POSTGRES_PASSWORD: sentry
      SENTRY_REDIS_HOST: redis
    depends_on:
      - sentry

  sentry-beat:
    image: getsentry/sentry:latest
    command: sentry run beat
    environment:
      SENTRY_SECRET_KEY: ${SENTRY_SECRET_KEY}
      SENTRY_POSTGRES_HOST: postgres
      SENTRY_POSTGRES_USER: sentry
      SENTRY_POSTGRES_PASSWORD: sentry
      SENTRY_REDIS_HOST: redis
    depends_on:
      - sentry

volumes:
  postgres_data:
  redis_data:
COMPOSE

docker-compose -f docker-compose-sentry.yml up -d
```

### 3. 配置后端

#### 环境变量

```bash
# .env 文件
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% 的请求采样
```

#### 配置文件

编辑 `src/config.js`：

```javascript
module.exports = {
  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'development',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  },
  // ... 其他配置
};
```

### 4. 验证集成

```bash
# 启动后端
npm start

# 发送一个测试错误
curl http://localhost:3002/test-error

# 检查 Sentry 是否收到错误
# 访问 Sentry 仪表板，应该能看到新错误
```

## 核心概念

### DSN (Data Source Name)

```
https://<key>@<ingest-domain>/projects/<organization-slug>/<project-slug>
```

- 格式: `https://publicKey@ingest.sentry.io/projectId`
- 作用: 告诉 SDK 将错误发送到哪个 Sentry 项目
- 安全: 只包含公钥，不包含私钥

### 事件类型

1. **异常 (Exception)**
   - 未捕获的错误
   - 手动 `captureException()`

2. **消息 (Message)**
   - 日志消息
   - 手动 `captureMessage()`

3. **交易 (Transaction)**
   - 请求追踪
   - 性能监控
   - 自动捕获

### 面包屑 (Breadcrumb)

事件发生前的用户操作链：

```javascript
Sentry.addBreadcrumb({
  category: 'user-action',
  message: 'User clicked button',
  level: 'info',
  data: { buttonId: 'submit' }
});
```

## 使用示例

### 基础错误捕获

```javascript
const sentry = require('./utils/sentry');

try {
  // 业务逻辑
} catch (error) {
  sentry.captureException(error, {
    userId: req.user.id,
    tags: {
      operation: 'upload',
      fileSize: file.size,
    },
    extra: {
      fileName: file.name,
      mimeType: file.mimetype,
    },
  });
}
```

### 性能监控

```javascript
const startTime = Date.now();
const result = await heavyOperation();
const duration = Date.now() - startTime;

sentry.capturePerformance('heavyOperation', duration, {
  resultSize: result.length,
  recordCount: result.count,
});
```

### 用户追踪

```javascript
// 登录时设置用户
sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.username,
});

// 登出时清除用户
sentry.clearUser();
```

### 自定义消息

```javascript
sentry.captureMessage('重要操作完成', 'info', {
  operation: 'bulk-delete',
  count: 100,
  duration: 5000,
});
```

## 告警配置

### 创建告警规则

在 Sentry 仪表板：

1. Alerts → Create Alert Rule
2. 条件设置:

```
when (for the above data)
  event.exception.values.0.type equals ValidationError
  event.exception.values.0.type equals DatabaseError

then
  send a notification to [integration] (Slack, PagerDuty等)
```

### 常见告警场景

**1. 错误率告警**
- 条件: 错误数 > 100 in 5m
- 通知: 发送到 Slack

**2. 新错误告警**
- 条件: 首次出现的错误
- 通知: 邮件通知

**3. 关键错误告警**
- 条件: 标签 severity=critical
- 通知: 页面通知 + 邮件

**4. 性能下降告警**
- 条件: 事务响应时间 p95 > 2s
- 通知: Slack 通知

## 仪表板和报告

### 关键指标

1. **崩溃率 (Crash-free Users)**
   - 没有遇到错误的用户百分比
   - 目标: > 99.5%

2. **错误频率 (Error Frequency)**
   - 每天的错误数
   - 趋势分析

3. **受影响用户 (Affected Users)**
   - 遇到错误的用户数量
   - 便于评估影响范围

4. **响应时间 (Response Time)**
   - 请求的 p50, p95, p99
   - 性能趋势

### 自定义仪表板

1. Dashboards → Create Dashboard
2. 添加小部件:
   - 错误趋势
   - 用户增长
   - 崩溃率

## 源码映射 (Source Maps)

对于生产环境的 minified 代码，需要上传源码映射以获得精确的堆栈跟踪：

```bash
# 生成源码映射
npm run build

# 上传源码映射到 Sentry
sentry-cli releases files upload-sourcemaps \
  --org=org-slug \
  --project=project-slug \
  ./dist
```

## 隐私和合规

### 敏感数据过滤

Sentry 会自动过滤某些敏感数据（密码、token等），但可以自定义：

```javascript
beforeSend: (event, hint) => {
  // 过滤信用卡信息
  if (event.request && event.request.body) {
    event.request.body = event.request.body.replace(/\d{16}/, '****');
  }
  
  return event;
},
```

### GDPR 合规

- 启用数据保留期设置
- 定期删除用户数据
- 设置数据导出政策

## 故障排除

### Sentry 无法接收事件

1. 检查 DSN 是否正确
   ```bash
   echo $SENTRY_DSN
   ```

2. 验证网络连接
   ```bash
   curl https://o0.ingest.sentry.io/api/0/store/?sentry_key=<key>
   ```

3. 检查采样率
   ```javascript
   tracesSampleRate: 0.1  // 应该设置 > 0
   ```

4. 查看本地日志
   ```bash
   # 启用 Sentry 调试
   DEBUG=* npm start
   ```

### 事件丢失或延迟

- 检查 Sentry 的 quota
- 减少 `tracesSampleRate`
- 检查网络连接

### 隐私泄露

- 检查 `beforeSend` 过滤器
- 移除敏感上下文
- 审查上传的信息

## 生产部署建议

### 1. 分级采样

```javascript
{
  tracesSampleRate: (context) => {
    // 100% 采样错误和性能问题
    if (context.op === 'http.server' && context.status >= 500) {
      return 1.0;
    }
    // 10% 采样其他请求
    return 0.1;
  },
}
```

### 2. 性能监控

```javascript
integrations: [
  new Sentry.Integrations.Http({ tracing: true }),
  new Sentry.Integrations.OnUncaughtException(),
  new Sentry.Integrations.OnUnhandledRejection(),
  new Tracing.Integrations.Express({
    app: true,
    request: true,
  }),
],
```

### 3. 错误分组

自动分组相似的错误便于管理：

```javascript
grouping: {
  fingerprint: [
    '{{ default }}',
    '{{ http.method }}',
    '{{ transaction }}',
  ],
},
```

### 4. 告警策略

- 立即告警: 关键错误 (severity=critical)
- 5分钟汇总: 高频错误 (> 50 in 5m)
- 每小时报告: 趋势变化

## 集成第三方服务

### Slack 通知

1. Alerts → Add Integration → Slack
2. 授权 Sentry 访问 Slack
3. 选择通知频道

### PagerDuty 告警

1. Integrations → PagerDuty
2. 配置告警规则
3. 设置升级策略

### GitHub Issue 创建

1. Integrations → GitHub
2. 连接仓库
3. 配置自动创建 Issue

## 相关文档

- Sentry SDK 文档: https://docs.sentry.io/platforms/node/
- Express 集成: https://docs.sentry.io/platforms/node/guides/express/
- 性能监控: https://docs.sentry.io/product/performance/

## 成本优化

### 免费额度

- Sentry Cloud: 5000 错误事件/月
- 本地部署: 无限制

### 成本控制

1. **采样率**
   - 生产: 10-20%
   - 开发: 100%

2. **事务采样**
   - 只采样性能缓慢的请求
   - 基于用户 ID 的一致采样

3. **数据保留**
   - 免费用户: 90 天
   - 付费用户: 可自定义

4. **Quota 管理**
   - 设置每月上限
   - 到达限制时丢弃低优先级事件

---

**部署时间**: 15-30 分钟
**资源需求**: 2GB RAM (本地部署), 10GB 存储
**学习成本**: 低 (直观的 UI 和丰富的文档)
**投资回报**: 高 (快速定位和修复生产问题)
