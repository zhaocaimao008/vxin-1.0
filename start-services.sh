#!/bin/bash

echo "=========================================="
echo "v信后端 + 监控栈 启动脚本"
echo "=========================================="

cd /root/v信

# 1. 启动后端应用 (后台运行)
echo -e "\n[1/3] 启动后端应用..."
cd backend-v2
npm start > /tmp/vxin-backend.log 2>&1 &
BACKEND_PID=$!
echo "后端应用 PID: $BACKEND_PID"
sleep 3

# 2. 启动 Grafana + Prometheus
echo -e "\n[2/3] 启动 Grafana 和 Prometheus..."
cd grafana
docker-compose up -d
sleep 5

# 3. 启动 ELK Stack
echo -e "\n[3/3] 启动 ELK Stack..."
cd ../elk
docker-compose up -d
sleep 5

echo -e "\n=========================================="
echo "✅ 所有服务已启动"
echo "=========================================="
echo ""
echo "服务地址:"
echo "  后端应用: http://localhost:3002"
echo "  API 文档: http://localhost:3002/api-docs"
echo "  性能指标: http://localhost:3002/metrics"
echo "  Grafana:  http://localhost:3000 (admin/admin123)"
echo "  Kibana:   http://localhost:5601"
echo ""
echo "后端日志: tail -f /tmp/vxin-backend.log"
echo ""

# 等待后端启动完成
echo "等待后端应用启动..."
for i in {1..30}; do
  if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    echo "✅ 后端应用已就绪"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ 后端应用启动超时"
    exit 1
  fi
  sleep 1
done

echo ""
echo "所有服务启动完成！"
