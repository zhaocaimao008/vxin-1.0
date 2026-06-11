# v信 后端 — ELK Stack 日志聚合部署指南

## 快速开始

### 1. 启动 ELK Stack

```bash
cd /root/v信/backend-v2/elk
docker-compose up -d
```

### 2. 验证服务启动

```bash
# 检查Elasticsearch
curl http://localhost:9200/_cluster/health

# 检查Kibana
curl http://localhost:5601/api/status
```

### 3. 访问 Kibana

- **URL**: http://localhost:5601
- 默认无需认证

## 架构说明

### 数据流

```
后端日志 (Winston)
    ↓
日志文件 (/logs/combined.log, /logs/error.log)
    ↓
Logstash (日志收集和处理)
    ↓
Elasticsearch (日志存储和索引)
    ↓
Kibana (可视化和分析)
```

### 索引策略

- **v信-logs-YYYY.MM.dd**: 所有日志
- **v信-errors-YYYY.MM.dd**: 错误日志
- **v信-slow-requests-YYYY.MM.dd**: 慢请求 (>1s)

## 配置 Kibana

### 1. 创建索引模式

1. 进入 Kibana → Management → Stack Management
2. 点击 "Index Management"
3. 如果索引不存在，运行后端生成日志
4. 索引自动创建后，进入 "Index Patterns"
5. 点击 "Create index pattern"
6. 输入 `v信-logs-*`
7. 时间字段选择 `@timestamp`
8. 点击 "Create"

### 2. 创建仪表板

#### 查看日志分布
1. Discover → v信-logs-*
2. 可以看到所有日志条目
3. 可以按字段搜索过滤

#### 创建可视化
1. Visualizations → Create visualization
2. 选择图表类型 (Bar chart, Line, Table 等)
3. 配置数据源: v信-logs-*
4. 配置聚合指标

#### 常用可视化

**1. 日志级别分布**
- 类型: Pie chart
- 分桶: level 字段
- 指标: count

**2. 请求耗时分布**
- 类型: Histogram
- X轴: duration (数值)
- Y轴: count

**3. 用户活动 Top 10**
- 类型: Table
- 分桶: userId
- 指标: count
- 排序: count (降序)

**4. 错误趋势**
- 类型: Line chart
- X轴: @timestamp (日期直方图)
- Y轴: sum(error_count)

## 日志查询示例

### 简单查询

```
# 所有错误日志
level: "error"

# 特定用户的日志
userId: "user-123"

# 执行时间超过1秒的请求
duration: [1000 TO *]

# 特定操作的日志
operation: "login"
```

### 高级查询 (KQL)

```
# 错误率很高的时间段
level: "error" AND @timestamp: [2024-01-01T00:00:00 TO 2024-01-01T10:00:00]

# 缓存未命中的请求
cache.hit: false AND duration: [500 TO *]

# 数据库查询耗时超过500ms
database.duration: [500 TO *]

# 特定错误类型
errorType: "ValidationError" OR errorType: "DatabaseError"
```

### 性能分析

```
# 找出最慢的10个请求
duration: [* TO *] | stats avg(duration) as avg_duration by endpoint | sort avg_duration desc | limit 10

# 按小时统计平均响应时间
duration: [* TO *] | stats avg(duration) as avg_duration by @timestamp | ts 1h
```

## 告警配置

### 创建告警规则

1. Management → Alerting → Alert Rules
2. 点击 "Create rule"
3. 配置规则参数:

```yaml
名称: 高错误率告警
条件: count >= 100 in last 5 minutes
过滤: level: "error"
操作: Email 通知
```

### 示例告警

**1. 错误日志增多**
- 条件: 最近5分钟错误日志数 > 50
- 通知: 发送警告到团队

**2. 请求超时告警**
- 条件: 最近10分钟平均响应时间 > 2000ms
- 通知: 发送警告到运维团队

**3. 特定错误类型**
- 条件: 数据库连接错误 > 10 in 5m
- 通知: 页面通知 + 邮件

## Logstash 管道说明

### 输入阶段 (Input)

```conf
file {
  path => "/logs/combined.log"
  codec => json
}
```

- 监听日志文件变化
- 自动解析JSON格式

### 处理阶段 (Filter)

```conf
if [duration] > 1000 {
  mutate { add_tag => ["slow_request"] }
}
```

- 标记慢请求
- 提取用户ID
- 转换数据类型

### 输出阶段 (Output)

```conf
elasticsearch {
  index => "v信-logs-%{+YYYY.MM.dd}"
}
```

- 发送到Elasticsearch
- 每天创建新索引
- 自动轮转历史数据

## 日志检索和分析

### 常用统计

**按操作类型统计**
```
聚合类型: Terms
字段: operation
排序: count (降序)
```

**请求耗时百分位数**
```
聚合类型: Percentiles
字段: duration
百分位: [50, 95, 99]
```

**用户活跃度**
```
聚合类型: Date histogram
时间间隔: 1 hour
子聚合: Unique count(userId)
```

## 性能优化

### 索引管理

```bash
# 查看索引大小
curl 'localhost:9200/_cat/indices?v'

# 删除旧索引 (>30天)
curl -X DELETE 'localhost:9200/v信-logs-2024.01.*'

# 索引别名（滚动）
PUT /v信-logs-2024.02.01
  "aliases": {
    "v信-logs-write": {}
  }
```

### 日志采样

对于高流量场景，可以采样日志：

在 Winston logger 中：

```javascript
const logger = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: 'logs/combined.log',
      level: 'info',
      // 采样率: 只记录 10% 的日志
      sampler: { rate: 0.1 }
    })
  ]
});
```

### 字段裁剪

在 Logstash 中只保留关键字段：

```conf
mutate {
  keep_if_present => ["@timestamp", "level", "message", "userId", "duration", "error"]
}
```

## 故障排除

### Logstash 无法连接 Elasticsearch

```bash
# 检查Elasticsearch是否运行
curl http://localhost:9200

# 查看Logstash日志
docker logs vxin-logstash

# 检查网络连接
docker network inspect elk-network
```

### 索引不更新

```bash
# 检查日志文件
tail -f /root/v信/backend-v2/logs/combined.log

# 检查Logstash是否在读取
docker logs vxin-logstash | grep "processed"

# 重启Logstash
docker restart vxin-logstash
```

### Kibana 无法显示数据

1. 确保索引已创建
   ```bash
   curl http://localhost:9200/_cat/indices
   ```

2. 检查索引模式
   - Settings → Index Patterns → v信-logs-*
   - 验证时间字段是否正确

3. 检查时间范围
   - 右上角时间选择器
   - 选择足够大的范围（如最近7天）

## 集成 Prometheus 指标

Logstash 可以将日志派生为指标：

```conf
output {
  # 提取监控指标
  if [duration] {
    http {
      url => "http://prometheus-pushgateway:9091/metrics/job/vxin_logs"
      format => "message"
      message => "vxin_request_duration_seconds %{duration}"
    }
  }
}
```

## 备份和恢复

### 备份索引

```bash
# 创建快照仓库
curl -X PUT "localhost:9200/_snapshot/backup" -H 'Content-Type: application/json' -d'
{
  "type": "fs",
  "settings": {
    "location": "/mnt/elasticsearch-backups"
  }
}'

# 创建快照
curl -X PUT "localhost:9200/_snapshot/backup/snapshot-$(date +%Y%m%d)?wait_for_completion=true"
```

### 恢复索引

```bash
# 恢复特定索引
curl -X POST "localhost:9200/_snapshot/backup/snapshot-20240101/_restore" -H 'Content-Type: application/json' -d'
{
  "indices": "v信-logs-2024.01.01"
}'
```

## 生产部署建议

1. **资源配置**
   - Elasticsearch: 2GB+ 堆内存
   - Logstash: 512MB+ 堆内存
   - Kibana: 512MB+ 内存

2. **日志轮转**
   - 每天创建新索引
   - 保留最近30天数据
   - 通过索引生命周期管理 (ILM) 自动删除

3. **安全性**
   - 启用 X-Pack 安全认证
   - 限制 Elasticsearch 访问 IP
   - HTTPS/TLS 加密传输

4. **监控**
   - 监控 Elasticsearch 健康状态
   - 监控堆内存使用率
   - 监控索引增长速度

5. **告警**
   - 连续5分钟错误率 > 1%
   - 磁盘空间不足
   - 节点离线

## 相关文档

- Winston 日志配置: `src/utils/logger.js`
- 监控指标: `src/utils/monitoring.js`
- Grafana 仪表板: `GRAFANA_SETUP.md`

---

**部署时间**: 10-15 分钟
**资源需求**: 4GB RAM, 20GB 存储 (初期)
**日志保留**: 30天 (可配置)
**数据压缩**: 自动对7天前数据压缩
