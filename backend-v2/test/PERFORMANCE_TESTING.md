# V信后端性能基准测试指南

## 概述

本目录包含两套性能基准测试工具：
1. **K6** - 高级压力测试框架
2. **Autocannon** - Node.js 性能基准测试

## K6 压力测试

### 安装

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo apt-get install k6

# 或使用 Docker
docker run -i grafana/k6 run - <script.js
```

### 运行测试

#### 基础运行

```bash
k6 run test/performance.js
```

#### 自定义配置

```bash
# 指定后端地址
BASE_URL=http://your-backend:3002 k6 run test/performance.js

# 指定测试阶段
k6 run --vus 100 --duration 60s test/performance.js
```

#### Docker 运行

```bash
docker run -v $PWD:/scripts grafana/k6 run /scripts/test/performance.js
```

### K6 测试覆盖

1. **列表对话** - 测试缓存效果
2. **消息历史** - 测试缓存命中率
3. **全局搜索** - 测试搜索性能
4. **发送消息** - 测试写操作
5. **用户详情** - 测试用户缓存
6. **指标端点** - 验证监控

### K6 输出

测试完成后生成：
- `summary` - 控制台摘要
- `performance-results.json` - 详细的 JSON 报告

## Autocannon 基准测试

### 安装依赖

```bash
npm install --save-dev autocannon
```

### 运行测试

```bash
# 基础运行
node test/autocannon-benchmark.js

# 自定义参数
BASE_URL=http://your-backend:3002 \
DURATION=60 \
CONNECTIONS=20 \
node test/autocannon-benchmark.js
```

### 测试场景

1. **无缓存首次请求** - 基准测试
2. **有缓存重复请求** - 缓存效果对比
3. **搜索查询** - 动态缓存测试
4. **消息历史** - 大数据缓存
5. **用户详情** - 小数据缓存

### Autocannon 输出

```
📊 运行: 无缓存场景 - 首次请求...
   ✅ 吞吐量: 1250.45 req/s
   ✅ 平均延迟: 8.12ms
   ✅ P99 延迟: 45.23ms
   ✅ 错误数: 0
```

## 性能指标解读

### 吞吐量 (Throughput)

单位：req/s（每秒请求数）

- **目标**: > 1000 req/s
- **优秀**: > 2000 req/s
- **警告**: < 500 req/s

### 延迟 (Latency)

单位：毫秒 (ms)

| 指标 | 目标 | 优秀 | 警告 |
|------|------|------|------|
| 平均 | < 50ms | < 20ms | > 100ms |
| P90 | < 100ms | < 50ms | > 200ms |
| P95 | < 200ms | < 100ms | > 500ms |
| P99 | < 500ms | < 200ms | > 1000ms |

### 错误率

- **目标**: < 0.1%
- **优秀**: < 0.01%
- **警告**: > 1%

## 缓存效果验证

### 预期改进

根据 P2 优化：

| 操作 | 无缓存 | 有缓存 | 改进 |
|------|--------|--------|------|
| 列表对话 | 10ms | 2ms | 80% |
| 用户信息 | 5ms | 1ms | 80% |
| 搜索消息 | 15ms | 5ms | 65% |

### 验证步骤

1. **清空缓存运行**
   ```bash
   curl -X POST http://localhost:3002/api/admin/cache/flush \
     -H "Authorization: Bearer admin-token"
   BASE_URL=http://localhost:3002 node test/autocannon-benchmark.js
   ```

2. **预热缓存运行**
   ```bash
   # 先预热（多次请求）
   for i in {1..100}; do
     curl http://localhost:3002/api/messages/conversations
   done
   
   # 然后运行基准测试
   BASE_URL=http://localhost:3002 node test/autocannon-benchmark.js
   ```

3. **对比结果** - 应该看到 P2 优化中预期的性能改进

## 压力测试场景

### 轻量级测试

```bash
k6 run test/performance.js \
  --vus 10 \
  --duration 30s
```

- 10 个并发用户
- 30 秒运行时间
- 适合快速验证

### 中等压力

```bash
k6 run test/performance.js \
  --vus 50 \
  --duration 5m
```

- 50 个并发用户
- 5 分钟运行时间
- 适合常规性能测试

### 高压力测试

```bash
k6 run test/performance.js \
  --vus 200 \
  --duration 10m
```

- 200 个并发用户
- 10 分钟运行时间
- 适合压力边界测试

## 生成性能报告

### JSON 格式报告

```bash
k6 run test/performance.js \
  --out json=results.json
```

### HTML 报告

使用 k6 插件生成 HTML：

```bash
k6 run test/performance.js \
  --out json=results.json

# 然后转换为 HTML（需要额外工具）
```

## 监控集成

### 实时监控

在运行测试时，同时监控 Grafana 仪表板：

1. 打开 http://localhost:3000（Grafana）
2. 选择 "V信后端监控面板"
3. 查看实时性能指标
4. 运行性能测试
5. 观察指标变化

### 性能告警

Prometheus 规则会自动触发告警：

- 高响应时间 (>2s) → 警告
- 高错误率 (>1%) → 严重
- 低缓存命中率 (<80%) → 警告
- 缓慢查询 (>500ms) → 警告

## 最佳实践

### 测试前

- [ ] 确保后端正在运行
- [ ] 确保 Redis 可用
- [ ] 清空日志和缓存
- [ ] 关闭不必要的应用

### 测试中

- [ ] 监控系统资源
- [ ] 检查 Grafana 仪表板
- [ ] 记录关键指标
- [ ] 观察错误日志

### 测试后

- [ ] 分析结果
- [ ] 生成报告
- [ ] 对比历史数据
- [ ] 识别瓶颈

## 故障排查

### 连接超时

```
Error: connect ECONNREFUSED 127.0.0.1:3002
```

解决方案：
- 确保后端运行在 3002 端口
- 检查防火墙规则
- 验证 BASE_URL 配置

### 高错误率

```
errors: 150+ errors
```

解决方案：
- 检查后端日志
- 验证数据库连接
- 检查认证令牌有效性
- 降低并发数

### 内存不足

解决方案：
- 减少并发用户数
- 缩短测试时间
- 检查内存泄漏
- 增加系统内存

## 性能优化建议

基于测试结果，优化方向：

1. **缓存优化**
   - 增加 Redis 连接池
   - 调整 TTL 参数
   - 实施缓存预热

2. **数据库优化**
   - 添加数据库索引
   - 优化查询语句
   - 启用连接池

3. **应用优化**
   - 实施 Gzip 压缩
   - 优化序列化
   - 异步处理

4. **基础设施**
   - 水平扩展
   - 负载均衡
   - CDN 加速

## 参考资源

- [K6 官方文档](https://k6.io/docs/)
- [Autocannon GitHub](https://github.com/mcollina/autocannon)
- [性能测试最佳实践](https://en.wikipedia.org/wiki/Software_performance_testing)
