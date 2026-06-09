# v信后端功能冻结清单（v2 重写契约）

本文件是从零重写的**契约**：新后端必须与旧后端（`/root/v信/backend`）逐项行为一致，
作为 drop-in 替换。Web/Electron/移动端均依赖这些接口，**请求/响应结构不得变更**。

- 失败响应统一为 `{ error: "..." }`（红包领取冲突附带 `amount`）。
- 鉴权：JWT 存于 httpOnly Cookie `vxin_token`；CSRF 双提交 Cookie `csrf_token` + `X-CSRF-Token` header。
- 同库：连接生产同一个 `wechat.db`（数据是契约，绝不重建）。

---

## 1. HTTP 接口

### /api/auth
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | /register | 限流5/h | username+phone+password+inviteCode(6位)，密码≥8含字母数字 |
| POST | /login | 限流10/15m | phone+password |
| GET  | /me | ✓ | 当前用户（含 phone）|
| POST | /refresh | ✓ | 续签 Token |
| POST | /logout | — | 清 Cookie |
| GET  | /sessions | ✓ | 登录设备列表 |
| DELETE | /sessions/:id | ✓ | 移除设备 |
| PUT  | /change-password | ✓ | 旧密码校验后改 |

### /api/users（含联系人/好友/黑名单）
GET /me/qrcode · GET·PUT /me/settings · GET /search · GET /contacts ·
POST /friend-request · GET /friend-requests · GET /friend-requests/sent ·
POST /friend-request/:id/handle · DELETE /contacts/:id · PUT /contacts/:id/remark ·
POST /avatar · POST /cover · PUT /profile · **GET /:id（单段通配，必须最后）** ·
GET /me/collections · POST·DELETE /block/:targetId · GET /me/blocked
> 隐私：search/contacts/friend-requests 均**不返回 phone**（S3 修复）。

### /api/messages（含会话/群/红包）
会话：POST /conversation/private · POST /conversation/group · GET /conversations ·
GET /unread-counts · GET /my-groups · GET /conversation/:id/members ·
POST /conversation/:id/pin · /mute · /read · DELETE /conversation/:id/messages ·
DELETE /conversations/messages · GET /media
群：PUT /conversation/:id（信息）· PUT /:id/avatar · POST /:id/invite ·
DELETE /:id/members/:uid（踢，含全端离房 R2 修复）· POST /:id/leave · GET /:id/info ·
PUT /:id/manage · PUT /:id/members/:uid/role · PUT /:id/nickname ·
POST /:id/invite-link · GET /:id/qr-code · POST /join/:token ·
POST /:id/pin-message · DELETE /:id/pin-message/:msgId · GET /:id/pinned-messages
消息：GET /search（FTS5）· GET /conversation/:id/search · GET /missed ·
**GET /:conversationId（历史，单段通配）** · POST /forward · POST /batch-delete ·
**POST /:conversationId（发送，限流60/min）** · POST /:conversationId/upload ·
**DELETE /:msgId（撤回）** · POST /:msgId/react · PUT /:msgId/edit · POST /:msgId/collect
红包：POST /red-packet/send · GET /red-packet/:id · POST /red-packet/:id/claim

### /api/notifications
GET /vapid-public-key（免鉴权）· POST·DELETE /web-subscribe ·
POST·DELETE /device-token · GET /status

### /api/upload
POST /credential（限流30/10m，预签名直传云存储）

---

## 2. Socket.io 事件

握手：仅从 Cookie 读 JWT（拒绝 handshake.auth.token，S1 修复）。

**接收**：send_message · send_file_message · typing · stop_typing ·
join_conversation · join_group（入房前校验 DB 成员，S1）·
call:request/response/offer/answer/ice/end

**发出**：new_message · message_delivered · message_read · message_deleted ·
message_edited · message_reaction · message_pinned/unpinned ·
new_conversation · group_updated · group_settings_updated · group_kicked ·
group_dismissed · group_member_added · role_changed · @mention ·
user_online · user_offline · sync:unread_cleared · sync:device_connected ·
red_packet_claimed · typing · stop_typing · call:incoming/response/offer/answer/ice/end

---

## 3. 必须保留的优化（重写已逐一保留）

| 优化 | 位置 | 效果 |
|------|------|------|
| 会话列表私聊内联 + 群成员 ROW_NUMBER 批量 | conversations.service | 消除 N+1 |
| unread correlated subquery + LIMIT 99 早停 | conversations/messages.service | 1709ms→34ms |
| 消息历史 replyTo+reactions 批量化 | messages.service | N+1→2 query |
| FTS5 trigram 全文索引 | db/schema | 搜索 1325ms→毫秒 |
| 红包 EXCLUSIVE 事务 | redpackets.service | 防并发超发 |
| Worker 线程批量异步写 + 崩溃重启重放 | db/worker, db/writer | 主线程不等写锁 |
| 读写分离（readDb 只读连接）| db/connection | WAL 并发 |
| 上传魔数二次校验 + 扩展名黑名单 | utils/upload | 防伪装可执行文件 |
| 跨域 Cookie SameSite 自适配 | utils/cookies | Electron/移动端可用 |

---

## 4. 与旧版唯一的行为差异

`GET /api/messages/media`：旧版被 `/:conversationId` 单段通配吃掉（死代码，前端未调用），
v2 上移到通配之前使其可达。无前端依赖，零风险。

---

## 5. 目录结构

```
src/
  config/         环境与常量唯一入口
  db/             connection(读写分离) schema worker writer
  middleware/     auth csrf rateLimiters error
  utils/          cookies http cloudStorage upload push
  modules/        auth users contacts conversations messages groups redpackets notifications upload
                  每模块 = routes + controller + service
  realtime/       index presence + handlers/{message,file,typing,call}
  app.js          Express 装配
  server.js       HTTP+Socket 启动
```

## 6. 启动 / 切换

```bash
# 验证（与生产 3002 并存，跑 3003）
cd /root/v信/backend-v2 && PORT_V2=3003 node src/server.js

# 切换上线：停旧 → 启新于 3002
pm2 stop vxin-server
cd /root/v信/backend-v2 && PORT_V2=3002 pm2 start src/server.js --name vxin-server-v2
# 回滚：pm2 stop vxin-server-v2 && pm2 start vxin-server
```
