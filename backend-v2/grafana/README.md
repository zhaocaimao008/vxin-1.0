# V信后端监控系统 - Grafana 配置

本目录包含完整的监控堆栈配置（Prometheus + Grafana）。

## 快速启动

### 1. 启动监控堆栈

```bash
cd grafana/
docker-compose up -d
```

服务地址：
- **Grafana**: http://localhost:3000 (用户: admin, 密码: admin)
- **Prometheus**: http://localhost:9090

### 2. 访问仪表板

登录 Grafana 后，自动加载仪表板：
- **V信后端监控面板** - 展示性能指标、缓存命中率、错误率、数据库查询等

## 核心指标

| 指标 | 说明 | 告警阈值 |
|------|------|--------|
| Response Time (P95) | 95分位响应时间 | > 2s |
| Request Rate | 每秒请求数 | - |
| Cache Hit Rate | 缓存命中率 | < 80% |
| Error Rate | 错误率 | > 1% |
| DB Query Duration | 数据库查询耗时 | > 500ms |

## 告警规则

所有告警规则定义在 `prometheus-rules.yml`：

1. **HighResponseTime** (warning) - P95响应时间 > 2秒
2. **HighErrorRate** (critical) - 错误率 > 1%
3. **LowCacheHitRate** (warning) - 缓存命中率 < 80%
4. **SlowDatabaseQuery** (warning) - P95查询耗时 > 500ms
5. **ServiceDown** (critical) - 服务离线

## 集成步骤

### 第一步：确保后端导出指标

检查后端是否在运行监控中间件：

```bash
curl http://localhost:3002/metrics
```

应该返回 Prometheus 格式的指标。

### 第二步：修改 prometheus.yml

将 `host.docker.internal:3002` 替换为你的后端地址：

```yaml
scrape_configs:
  - job_name: 'vxin-backend'
    static_configs:
      - targets: ['your-backend-host:3002']  # <- 修改这里
```

### 第三步：重启容器

```bash
docker-compose restart prometheus
```

## 自定义仪表板

### 添加新图表

1. 在 Grafana UI 中编辑 "V信后端监控面板"
2. 点击 "Add Panel" → "Prometheus"
3. 输入 PromQL 查询，例如：

```promql
rate(http_requests_total{method="POST"}[5m])
```

4. 保存图表（会自动同步到 `dashboards/vxin-backend.json`）

### 常用 PromQL 查询

```promql
# 请求速率
rate(http_requests_total[5m])

# 响应时间 P95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# 缓存命中率
100 * (redis_cache_hits_total / (redis_cache_hits_total + redis_cache_misses_total))

# 按状态码分组的请求
sum(rate(http_requests_total[5m])) by (status)

# 数据库查询耗时
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))
```

## 生产部署

### Docker Compose 变更（生产环境）

```yaml
grafana:
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=your-secure-password
    - GF_SECURITY_SECRET_KEY=your-secret-key
  volumes:
    - grafana_data_prod:/var/lib/grafana
```

### Prometheus 持久化

```yaml
volumes:
  prometheus_data:
    driver: local
```

## 故障排查

### Prometheus 无法连接后端

```bash
# 查看 Prometheus 日志
docker logs vxin-prometheus

# 检查网络连接
docker exec vxin-prometheus curl http://host.docker.internal:3002/metrics
```

### Grafana 显示无数据

1. 检查 Prometheus 数据源是否可达
2. 确认后端正在导出指标
3. 在 Prometheus UI (http://localhost:9090) 查询指标是否存在

### 重置 Grafana 密码

```bash
docker exec vxin-grafana grafana-cli admin reset-admin-password newpassword
```

## 停止监控堆栈

```bash
cd grafana/
docker-compose down -v  # 包括删除数据卷
```

## 文件清单

```
grafana/
├── docker-compose.yml            # Docker Compose 配置
├── prometheus.yml                # Prometheus 配置
├── prometheus-rules.yml          # 告警规则
├── grafana-datasources.yml       # 数据源配置
├── grafana-dashboards.yml        # 仪表板配置
├── dashboards/
│   └── vxin-backend.json         # 主仪表板定义
└── README.md                     # 本文档
```

## 相关文档

- [Prometheus 文档](https://prometheus.io/docs/)
- [Grafana 文档](https://grafana.com/docs/grafana/latest/)
- [PromQL 查询](https://prometheus.io/docs/prometheus/latest/querying/basics/)
