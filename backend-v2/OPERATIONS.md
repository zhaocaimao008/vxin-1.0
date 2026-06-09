# v信 后端运维手册（backend-v2）

最后更新：2026-06-09

## 当前状态

| 项 | 值 |
|----|----|
| 线上后端 | **backend-v2**（`vxin-server-v2`，pm2 id 129），端口 **3002** |
| 旧后端 | `vxin-server`（pm2 id 103），**已停止**，保留作回滚 |
| 数据库 | `/root/v信/backend/wechat.db`（v1/v2 共用同一个库） |
| 前端 | 静态文件 `/var/www/vxin/`，nginx 服务 `chat.91aigu.com` |
| 反代 | nginx 把 `/api` `/socket.io` `/uploads` → `127.0.0.1:3002` |
| 后台管理 | https://chat.91aigu.com/admin/ |

## 架构

```
chat.91aigu.com
 ├─ /            → /var/www/vxin/index.html      (IM 前端 SPA)
 ├─ /admin/      → /var/www/vxin/admin/index.html (后台管理)
 ├─ /download/   → /var/www/vxin/download/        (下载落地页)
 ├─ /api/*       → 127.0.0.1:3002  (backend-v2)
 ├─ /socket.io/* → 127.0.0.1:3002
 └─ /uploads/*   → 127.0.0.1:3002

backend-v2/src/
 ├─ config/      环境与常量唯一入口
 ├─ db/          connection(读写分离) schema worker writer
 ├─ middleware/  auth csrf adminAuth rateLimiters error
 ├─ utils/       cookies http cloudStorage upload push
 ├─ modules/     auth users contacts conversations messages groups
 │               redpackets notifications upload admin
 │               每模块 = routes + controller + service
 ├─ realtime/    index presence + handlers/{message,file,typing,call}
 ├─ app.js  server.js
```

## 常用命令

```bash
# 查看状态 / 日志
pm2 status
pm2 logs vxin-server-v2 --lines 50

# 重启（优雅退出，worker flush 落盘不丢写）
pm2 restart vxin-server-v2

# 改完代码后重启即可生效（无需 build）
```

## 回滚到 v1（秒级）

```bash
pm2 stop vxin-server-v2
pm2 start vxin-server      # v1 已含红包修复
pm2 save
```

## 后台管理

- 地址：https://chat.91aigu.com/admin/
- 账号：`admin`　密码：见 `.env` 的 `ADMIN_PASSWORD`
- 改密码：编辑 `/root/v信/backend/.env` 的 `ADMIN_PASSWORD` → `pm2 restart vxin-server-v2`
- 功能：数据总览（可点击钻取）、用户管理（封禁/解封/改密/删除）、群管理（查看成员/解散）、邀请码（手动设置 / 随机生成）

## 注册邀请码

- 当前值存 `admin_settings` 表（key=`invite_code`），后台可改，即时生效
- 未设置时回退 `.env` 的 `INVITE_CODE`（888888）

## 回归测试

```bash
cd /root/v信/backend-v2
E2E_BASE=http://localhost:3002 node test/e2e.js   # 30 项，自动清理测试数据
```

## 已修复的历史 bug（v1 遗留）

1. **红包领取恒报 500**：`.exclusive()()` 双重调用 → 改 `.exclusive()`。v1 已热补，v2 已修。
2. **解散群报 500**：删会话前未删消息，外键约束失败 → `purgeConversation()` 按依赖顺序级联清理。

## 切换确认稳定后的收尾（暂不执行）

```bash
# 观察数日确认 v2 稳定后再做：
pm2 delete vxin-server                 # 移除旧 v1 进程定义
# 可选：归档 backend/ → 把 backend-v2/ 扶正
```
