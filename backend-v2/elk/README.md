# V信后端日志聚合系统 - ELK Stack

## 简介

ELK Stack（Elasticsearch + Logstash + Kibana）用于集中化日志管理和分析。

## 快速启动

### 1. 启动 ELK 堆栈

```bash
cd elk/
docker-compose up -d
```

服务地址：
- **Kibana**: http://localhost:5601
- **Elasticsearch**: http://localhost:9200
- **Logstash**: 监听 5000 端口

### 2. 验证部署

```bash
# 检查 Elasticsearch 状态
curl http://localhost:9200/_cluster/health

# 查看索引
curl http://localhost:9200/_cat/indices
```

## 集成步骤

### 第一步：配置后端日志导出

确保后端 Winston 日志输出到文件：

```javascript
// src/utils/logger.js
const transports = [
  new winston.transports.File({ filename: 'logs/combined.log' }),
  new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
];
```

### 第二步：配置 Logstash

修改 `logstash.conf` 中的日志路径：

```conf
input {
  file {
    path => "/path/to/logs/combined.log"
    start_position => "beginning"
    codec => json
  }
}
```

### 第三步：创建 Kibana 索引

1. 访问 http://localhost:5601
2. 点击 "Stack Management"
3. 选择 "Index Patterns"
4. 点击 "Create index pattern"
5. 输入 `vxin-logs-*`
6. 选择时间字段 `@timestamp` 或 `timestamp`

### 第四步：创建仪表板

1. 点击 "Discover" 查看日志
2. 点击 "Visualize" 创建图表
3. 点击 "Dashboards" 创建仪表板

## 常用 Kibana 查询

### 按日志级别过滤

```
level:"error"
level:"warn"
level:"info"
```

### 按响应时间过滤

```
duration > 2000           # 响应时间 > 2秒
duration < 100            # 响应时间 < 100ms
```

### 按路由过滤

```
path:"/api/messages/*"
method:"POST"
statusCode:500
```

### 按用户过滤

```
userId:"user-id-123"
```

### 复杂查询示例

```
# 查找所有超过 2 秒且返回错误的请求
(duration > 2000) AND (statusCode >= 400)

# 查找某个时间范围内的错误日志
level:"error" AND timestamp:[2024-06-11 TO 2024-06-12]

# 查找慢查询
tag:"slow-request"
```

## 仪表板示例

### 错误监控仪表板

1. **错误率趋势** - 显示错误日志随时间的变化
2. **错误类型分布** - 按错误类型分组统计
3. **受影响的用户** - 显示遇到错误的用户列表
4. **错误日志详情** - 实时错误日志流

### 性能分析仪表板

1. **响应时间分布** - Histogram 或 Box plot
2. **最慢的端点** - Top 10 响应时间最长的路由
3. **请求量趋势** - 请求速率随时间的变化
4. **状态码分布** - 按 HTTP 状态码分组统计

### 用户行为分析仪表板

1. **活跃用户数** - 每小时/每天的用户数
2. **热门操作** - 最常见的 API 调用
3. **地理位置分布** - 用户地理位置热力图
4. **用户会话分析** - 会话持续时间、操作序列等

## 告警配置

### Watcher 规则（Elasticsearch 5.0+）

```json
{
  "trigger": {
    "schedule": {
      "interval": "5m"
    }
  },
  "input": {
    "search": {
      "request": {
        "index": "vxin-logs-*",
        "body": {
          "query": {
            "bool": {
              "must": [
                {
                  "term": {
                    "level": "error"
                  }
                }
              ]
            }
          }
        }
      }
    }
  },
  "condition": {
    "compare": {
      "ctx.payload.hits.total": {
        "gt": 10
      }
    }
  },
  "actions": {
    "send_email": {
      "email": {
        "to": "admin@example.com",
        "subject": "高错误率告警",
        "body": "过去 5 分钟内检测到 {{ctx.payload.hits.total}} 个错误"
      }
    }
  }
}
```

## 性能优化

### 日志采样

对于高流量应用，可以采样日志以减少存储：

```javascript
// 只记录 10% 的成功日志
if (statusCode < 400 && Math.random() > 0.1) {
  return; // 跳过
}
```

### 索引管理

配置索引生命周期管理（ILM）：

```bash
curl -X PUT "localhost:9200/_ilm/policy/vxin-logs-policy" \
  -H 'Content-Type: application/json' \
  -d '{
    "policy": "vxin-logs-policy",
    "phases": {
      "hot": {
        "min_age": "0d",
        "actions": {
          "rollover": {
            "max_size": "50GB",
            "max_age": "1d"
          }
        }
      },
      "warm": {
        "min_age": "3d",
        "actions": {
          "set_priority": {
            "priority": 50
          }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "set_priority": {
            "priority": 0
          }
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": {
          "delete": {}
        }
      }
    }
  }'
```

## 故障排查

### Logstash 无法连接 Elasticsearch

```bash
# 检查 Logstash 日志
docker logs vxin-logstash

# 验证 Elasticsearch 可达
docker exec vxin-logstash curl elasticsearch:9200
```

### Kibana 无法加载数据

1. 检查索引是否存在：
   ```bash
   curl http://localhost:9200/_cat/indices
   ```

2. 检查索引内是否有数据：
   ```bash
   curl http://localhost:9200/vxin-logs-*/_count
   ```

3. 重新创建索引模式

### 日志没有被摄取

1. 检查日志文件权限
2. 验证 Logstash 配置中的路径
3. 查看 Logstash 日志输出

## 最佳实践

### 日志采集

- ✅ 记录所有错误和异常
- ✅ 记录关键业务操作
- ✅ 记录性能指标
- ❌ 不记录敏感信息（密码、令牌）

### 日志字段

使用结构化日志和一致的字段名：

```javascript
{
  "timestamp": "2024-06-11T10:30:00Z",
  "level": "info",
  "service": "vxin-backend",
  "message": "User login successful",
  "userId": "user-123",
  "method": "POST",
  "path": "/api/auth/login",
  "statusCode": 200,
  "duration": 45,
  "ip": "192.168.1.100"
}
```

### 索引命名

使用时间戳前缀便于管理：

```
vxin-logs-2024.06.11
vxin-logs-2024.06.12
```

## 升级和维护

### 备份数据

```bash
# 创建快照仓库
curl -X PUT "localhost:9200/_snapshot/backup" \
  -H 'Content-Type: application/json' \
  -d'{
    "type": "fs",
    "settings": {
      "location": "/mnt/data/elasticsearch-snapshots"
    }
  }'

# 创建快照
curl -X PUT "localhost:9200/_snapshot/backup/snapshot-1"
```

### 升级 ELK

```bash
# 停止服务
docker-compose down

# 更新镜像标签
# 编辑 docker-compose.yml

# 启动新版本
docker-compose up -d
```

## 相关文档

- [Elasticsearch 官方文档](https://www.elastic.co/guide/en/elasticsearch/reference/current/)
- [Kibana 用户指南](https://www.elastic.co/guide/en/kibana/current/)
- [Logstash 配置指南](https://www.elastic.co/guide/en/logstash/current/)
- [Winston 日志库](https://github.com/winstonjs/winston)
