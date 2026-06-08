#!/bin/bash
set -e
cd "$(dirname "$0")/web"
echo "构建前端..."
npm run build
echo "同步静态文件..."
cp -r dist/* /var/www/vxin/
echo "重启后端..."
pm2 restart vxin-server
echo "✅ 部署完成: http://104.244.95.70:8086"
