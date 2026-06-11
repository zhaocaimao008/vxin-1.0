# v信 后端 — Grafana 监控仪表板部署指南

## 快速开始

### 1. 启动监控栈

```bash
cd /root/v信/backend-v2/grafana
docker-compose up -d
```

### 2. 访问服务

- **Grafana UI**: http://localhost:3000
  - 用户名: admin
  - 密码: admin123

- **Prometheus**: http://localhost:9090
  - 数据源配置: http://localhost:9090

### 3. 验证数据收集

```bash
# 检查后端是否暴露指标
curl http://localhost:3002/metrics

# 检查Prometheus是否正常抓取
curl http://localhost:9090/api/v1/query?query=vxin_requests_total
```

## 仪表板说明

v信 Backend Dashboard 包含以下面板：

### 核心指标

1. **Request Rate (5m)** - 实时请求速率（请求/秒）
   - 绿色: 正常
   - 红色: 超过阈值 (80 req/s)

2. **Request Duration (ms) - p95/p99** - 响应时间分布
   - p95: 95% 的请求响应时间
   - p99: 99% 的请求响应时间
   - 用于识别性能瓶颈

3. **Cache Hit Rate** - 缓存命中率
   - 目标: > 70% 表示缓存有效
   - < 50% 表示缓存配置需要优化

4. **Request Rate by Status** - 按状态码分类的请求
   - 绿线: 成功 (2xx/3xx)
   - 橙线: 错误 (4xx/5xx)

5. **Database Query Duration** - 数据库查询耗时
   - 监控是否有慢查询
   - 目标: < 100ms

6. **Success Rate %** - 成功率百分比
   - 目标: > 99.5%
   - < 99% 表示需要调查

7. **Request Duration Distribution** - 响应时间百分位数
   - p50, p90, p95, p99 分布
   - 用于深入分析性能

## 告警配置

### 配置告警规则

1. 进入 Grafana → Alerting → Alert Rules
2. 创建新告警:

```yaml
# 高错误率告警 (> 1%)
- alert: HighErrorRate
  expr: (sum(rate(vxin_requests_total{status=~"5.."}[5m])) / sum(rate(vxin_requests_total[5m]))) > 0.01
  for: 5m
  annotations:
    summary: "Error rate too high: {{ $value }}"

# 响应时间告警 (p99 > 1s)
- alert: SlowResponse
  expr: histogram_quantile(0.99, rate(vxin_request_duration_seconds_bucket[5m])) > 1
  for: 5m
  annotations:
    summary: "Response time too slow: {{ $value }}s"

# 缓存命中率过低 (< 50%)
- alert: LowCacheHitRate
  expr: vxin_cache_hit_rate < 0.5
  for: 10m
  annotations:
    summary: "Cache hit rate too low: {{ $value }}"
```

## 导入其他仪表板

Grafana 官方提供的推荐仪表板:

1. **Node Exporter Full** (ID: 1860)
   - 系统资源监控 (CPU, 内存, 磁盘, 网络)

2. **Redis** (ID: 763)
   - Redis 缓存监控

3. **PostgreSQL** (ID: 9628)
   - 如果使用 PostgreSQL 数据库

导入步骤:
1. Grafana → Dashboards → Import
2. 输入仪表板 ID
3. 选择 Prometheus 数据源
4. 点击 Import

## 日志收集集成 (ELK Stack)

### 配置 Logstash 收集后端日志

```bash
# 1. 安装 Logstash
docker run -d --name logstash \
  -v /root/v信/backend-v2/logs:/logs:ro \
  -e "LOGSTASH_PIPELINE_BATCH_SIZE=50" \
  docker.elastic.co/logstash/logstash:latest

# 2. 配置管道文件 (logstash.conf)
input {
  file {
    path => "/logs/combined.log"
    start_position => "beginning"
    codec => json
  }
}

output {
  elasticsearch {
    hosts => "localhost:9200"
    index => "v信-logs-%{+YYYY.MM.dd}"
  }
}
```

## 性能调优建议

基于仪表板数据:

1. **如果缓存命中率 < 60%**
   - 增加缓存 TTL
   - 检查是否有重复的相同查询
   - 考虑添加更多缓存键

2. **如果 p99 响应时间 > 500ms**
   - 检查数据库查询
   - 优化慢 SQL
   - 考虑添加索引

3. **如果错误率 > 0.5%**
   - 查看错误日志
   - 检查第三方服务可用性
   - 验证业务逻辑

4. **如果请求速率突增**
   - 检查是否有 DDoS 攻击
   - 验证客户端行为
   - 调整速率限制

## 故障排除

### Prometheus 无法连接到后端

```bash
# 检查后端是否运行
curl http://localhost:3002/health

# 检查指标端点
curl http://localhost:3002/metrics

# 检查防火墙
telnet localhost 3002
```

### Grafana 无法显示数据

1. 检查数据源连接
   - Settings → Data Sources → Prometheus
   - 点击 "Test" 按钮

2. 检查 Prometheus 是否有数据
   - http://localhost:9090 → Graph
   - 输入查询: `vxin_requests_total`

3. 检查时间范围
   - Grafana 仪表板右上角时间选择器
   - 确保包含了数据时间范围

### Docker 容器无法启动

```bash
# 查看日志
docker logs vxin-prometheus
docker logs vxin-grafana

# 检查端口占用
lsof -i :3000
lsof -i :9090

# 清理容器和卷
docker-compose down -v
docker-compose up -d
```

## 常用 PromQL 查询

```promql
# 请求速率
rate(vxin_requests_total[5m])

# 响应时间 p95
histogram_quantile(0.95, rate(vxin_request_duration_seconds_bucket[5m]))

# 缓存命中率
vxin_cache_hit_rate

# 错误率
sum(rate(vxin_requests_total{status=~"5.."}[5m])) / sum(rate(vxin_requests_total[5m]))

# 数据库查询耗时 (平均)
rate(vxin_db_query_duration_seconds_sum[5m]) / rate(vxin_db_query_duration_seconds_count[5m])
```

## 备份和恢复

### 备份 Grafana 配置

```bash
# 备份数据库
docker exec vxin-grafana grafana-cli admin export-dashboard

# 备份卷
docker run --rm -v grafana_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/grafana-backup.tar.gz -C /data .
```

### 恢复

```bash
docker run --rm -v grafana_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/grafana-backup.tar.gz -C /data
```

## 相关文档

- 后端监控指标: `src/utils/monitoring.js`
- P2 优化报告: `P2完成报告_20260611.md`
- 性能测试: `tests/performance.test.js`

---

**部署时间**: 5-10 分钟
**资源需求**: 512MB RAM, 2GB 存储
**维护周期**: 每周检查一次关键指标
