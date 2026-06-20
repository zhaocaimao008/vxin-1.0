# v信 上线清单 (LAUNCH_CHECKLIST)

> RC 生产验收日期：2026-06-20 · 目标域名：https://dipsin.com
> 验收结论：**PASS（有条件）** — 无 P0；核心链路、1000 并发、主要安全面全部通过。
> 上线前必须先完成下方「必须修复项」。

---

## 0. 验收结果速览

| 部分 | 结果 |
|---|---|
| 一、HTTPS 全链路（账号/好友/单聊/群聊/朋友圈/文件/Cookie/Socket/CDN） | ✅ PASS |
| 二、推送：Web Push | ✅ 已配置可用；FCM/APNS ❌ 缺配置 |
| 三、Windows：窗口操作×50 + 切换100次（白屏0/ErrorBoundary0/崩溃0） | ✅ PASS |
| 四、1000 真实在线（1000/1000 连接，0丢失0重复，p99≈198ms） | ✅ PASS |
| 五、安全：JWT/SQLi/越权/路径穿越/可执行上传 | ✅ PASS；上传内容类型欺骗 ⚠️ P2（prod 未部署修复） |

关键性能数据（生产实测）：
- 消息延迟 空载 p99≈18ms（本地）/ 生产 RTT≈190ms；**1000 连接下 p50/p95/p99 = 189/193/198ms（无劣化）**
- 1000 Socket：1000/1000 成功，0 失败；后端稳定 155MB / 0.5% CPU；nginx worker_connections=8192
- 0 消息丢失、0 重复（多轮验证）

---

## 1. 上线前必须修复项（GATE）

- [x] **【P2 安全】上传内容类型校验修复** — `80b96b3` 已部署生产并验证：伪装 PNG → 400 拒绝；真实 PNG 正常。✅ 2026-06-20 已关闭。
- [x] **【P1 媒体·后端】`/uploads` 兜底鉴权** — `80b96b3` 已部署生产并验证：`?token=`/Bearer 下载成功且完整、无 token 仍 401。✅
- [ ] **【P1 媒体·前端，待办】** 后端已支持 `?token=`，但前端 `web/src/utils/url.js` 的 `mediaUrl` 尚未在 Electron/移动端为媒体 URL 追加 token；当前桌面/移动媒体仍依赖跨域 SameSite=None Cookie。**完整方案：mediaUrl 在 Electron/Capacitor 下追加 `?token=<sessionStorage token>`，再重新构建三端**；上线前须真机验证头像/图片/文件加载。
- [ ] **【文档/DNS】** `config.dipsin.com`、`api/ws/cdn.dipsin.com` 均无 DNS 解析；实际全部走 `dipsin.com`（`dipsin.com/config.json` 已正确指向）。需更新文档或补齐子域名，避免误配。

> 回滚两文件：`meta-cats:/root/v信/backend-v2/src/{utils/upload.js,app.js}` 已备份为 `*.bak-20260620_144340`。

## 2. 上线建议项（非阻断）

- [ ] 若移动端需要推送：配置 **FCM**（Firebase service account）与 **APNS**（证书）。当前 `/notifications/status` 显示 `fcm.enabled=false`，APNS 未配置；Web Push 正常。
- [ ] 断点续传未实现（聊天文件为单次 multipart，上限 50MB）。如需大文件/100MB，需引入分片上传。
- [ ] iOS 工程未验收（需 macOS+Xcode）；WebRTC 通话、原生托盘/开机启动/截图/拖拽/粘贴 未在本环境实测（需真机）。

---

## 3. 上线顺序

1. **备份**：`wechat.db`、当前 `web/dist/index.html`、当前 backend 源码（git tag）、当前 downloads 安装包。
2. **后端**：rsync `upload.js`+`app.js`(80b96b3) → meta-cats:`/root/v信/backend-v2/` → `pm2 restart vxin-server-v2` → 验证 `/health` + 伪装PNG返回400。
3. **前端 Web**：确认 meta-cats:`/root/v信/web/dist` 为最新构建（含气泡/AutoSizer/CDN 引导修复）→ `nginx -t && systemctl reload nginx`。
4. **安装包**：确认 `/var/www/downloads` 的 Windows `.exe` / Android `.apk` 为最新签名版（前端机 md5 与本地一致）。
5. **灰度**：内部账号真机验证（Electron/Android 媒体加载、登录、收发）→ 小范围用户 → 全量。
6. **配置**：如需切服务器，改 `vxin-config/config.json` → push → `purge.jsdelivr.net`。

## 4. 回滚方案

| 组件 | 回滚动作 |
|---|---|
| 后端 | `git checkout <上个tag> && pm2 restart vxin-server-v2`；数据异常则用步骤1的 `wechat.db` 备份恢复 |
| 前端 Web | 用备份的 `index.html` 覆盖 `web/dist/` → `nginx reload`（单文件，秒级回滚） |
| 安装包 | downloads 保留上一版本文件；将 `*-latest-*` 指回旧包 |
| 远程配置 | `vxin-config` `git revert` config.json + jsDelivr purge |

回滚判定：5xx>2% 持续 5 分钟 / 登录或发消息成功率<95% / 大面积白屏上报 → 立即回滚。

## 5. 监控项

- **后端**：CPU、内存（`pm2 monit`）、`:3002` ESTABLISHED 连接数、`/health`
- **Socket**：连接成功率（`prodMetrics.recordConnResult`）、消息成功率（`recordMsg`）、消息延迟
- **错误**：5xx 率、ErrorBoundary 触发、白屏 `sendBeacon` 上报、Socket 断连率
- **业务**：注册/登录成功率、消息 p50/p95/p99、Web Push 到达率
- **资源**：uploads 磁盘增长、DB 体积、nginx 连接数（上限 8192）、证书有效期（当前至 2026-09-03）
- **告警阈值**：CPU>80% / 内存>80% / 连接>6000 / p99>1s / 5xx>1% / 证书<14 天到期

---

## 6. 已确认健康项（无需动作）

- TLS 证书有效（CN=dipsin.com，至 2026-09-03）、HTTP/2、HTTPS 全通
- Cookie 鉴权（httpOnly + 跨域 SameSite=None）正常；JWT 防伪造（alg=none/弱密钥均拒绝）
- 越权读写 403、SQL 注入无效、路径穿越拒绝、可执行上传拒绝
- 1000 并发稳定、0 丢失 0 重复、虚拟列表大列表（1000+ 消息）DOM 受控无崩溃
- 远程配置中心（dipsin.com/config.json + jsDelivr 多地址兜底）可换服务器免重编译
