# VXin v2 安全审计报告

**审计日期**: 2026-06-18
**项目路径**: `/root/v信/backend-v2/src/`
**审计算法**: 静态代码分析 (全部 `.js` 文件逐一审查，约 40 个文件)
**审计范围**: 权限校验、会话成员校验、手机号隐私、文件上传、CSRF/XSS、邀请码、管理后台、日志、密码策略、JWT 实现

---

## 风险等级说明

| 等级 | 含义 |
|------|------|
| 🔴 **高** | 直接可利用的安全漏洞，可能导致数据泄漏、越权操作或系统被攻陷 |
| 🟠 **中** | 存在一定风险，需要特定条件才可利用，或影响纵深防御体系 |
| 🟢 **低** | 最佳实践偏离，单独不构成漏洞，但叠加可能产生风险 |

---

## 🔴 高风险 (9 项)

### H1: 修改密码密码强度要求低于注册要求

**文件**: `modules/auth/auth.service.js`
- 第 69 行 (注册): `^(?=.*[a-zA-Z])(?=.*\d).{8,}$` — 至少 8 位 + 字母 + 数字
- 第 117 行 (修改密码): `newPassword.length < 6` — 仅要求 6 位
- `modules/admin/admin.service.js` 第 117 行 (管理员重置密码): 同样仅要求 6 位

**问题**: 修改密码 / 重置密码的强度要求大幅弱于注册。攻击者获取长期有效的 session 后可将密码改为弱口令，或社工管理员重置他人密码。

**建议修复**:
```javascript
// auth.service.js changePassword 方法
if (newPassword.length < 6) throw badRequest('新密码至少6位');
// → 改为与注册一致
if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(newPassword))
  throw badRequest('密码必须至少8位，且至少包含1个字母和1个数字');
```
对 admin.service.js `resetPassword` 做同样修改。

---

### H2: Token 黑名单异步检查降级为"放行"(Race Condition)

**文件**: `middleware/auth.js`

**代码**:
```javascript
isBlacklisted(token).then(blacklisted => {
  if (blacklisted) { /* 拒绝 */ }
  else { /* 校验 JWT 并放行 */ }
}).catch(err => {
  // ★ 降级：允许通过
  try { req.user = jwt.verify(token, config.jwtSecret); ... next(); }
  catch { /* 401 */ }
});
```

**问题**: 当 Redis 不可达或黑名单检查抛出异常时，系统**降级为允许请求通过**而非拒绝。攻击者可利用 Redis 故障（或 DoS Redis）使所有已注销/被盗 token 继续有效。

**建议修复**:
```javascript
isBlacklisted(token).then(blacklisted => {
  if (blacklisted) { /* 拒绝 */ }
  else { /* 校验 JWT 并放行 */ }
}).catch(err => {
  console.error('[Auth] Blacklist check error:', err);
  return res.status(503).json({ error: '服务暂时不可用' });  // ★ 降级为拒绝
});
```
或使用 `async/await` 避免 Promise 分支逻辑。

---

### H3: 用户 JWT Token 有效期长达 30 天

**文件**: `config/index.js` 第 29 行

```javascript
tokenMaxAge: 30 * 24 * 60 * 60, // 30天（秒）
```

**问题**:
- Electron 桌面端使用 `Authorization: Bearer` header（保存在可读内存/localStorage），token 泄漏后攻击者有 30 天窗口
- 修改密码后旧 token 不会主动吊销（见 H6），30 天的有效期放大了攻击面
- 对比：管理后台 token 有效期仅 12 小时，差距悬殊

**建议修复**:
```javascript
tokenMaxAge: 7 * 24 * 60 * 60, // 7天（建议缩短至7天）
// 或 24 * 60 * 60 // 24小时（更安全）
```

---

### H4: 登录错误消息可枚举注册用户

**文件**: `modules/auth/auth.service.js`

```javascript
// 第 87-89 行
const user = db.prepare('SELECT * FROM users WHERE phone=?').get(phone);
if (!user) throw badRequest('用户不存在');
if (!await bcrypt.compare(password, user.password)) throw badRequest('密码错误');
```

**问题**: 两种不同的错误消息（"用户不存在" vs "密码错误"）允许攻击者通过暴力枚举确认哪些手机号已注册。这是典型的用户枚举漏洞（OWASP 排名 Top 10）。

**建议修复**: 返回统一消息：
```javascript
if (!user || !await bcrypt.compare(password, user.password))
  throw badRequest('手机号或密码错误');
```

---

### H5: 管理后台 Token 未加入黑名单

**文件**:
- `middleware/adminAuth.js` — 未调用 `isBlacklisted()`
- `modules/admin/admin.controller.js` — `logout` 仅清除 cookie，未将 token 加入黑名单

**问题**: 管理员登出后，已签发的 `vxin_admin_token` 仍可使用直至 12 小时过期。若设备被物理访问或存在 XSS，攻击者可利用已登出的 admin token。

**建议修复**:
```javascript
// middleware/adminAuth.js - 在 JWT 验证后检查黑名单
const { isBlacklisted } = require('../utils/tokenBlacklist');
try {
  const payload = jwt.verify(token, config.jwtSecret);
  if (!payload.admin) return res.status(403).json({ error: '无后台权限' });
  const blacklisted = await isBlacklisted(token);  // ★ 需要改为 async
  if (blacklisted) { /* 拒绝 */ }
  // ...
}

// modules/admin/admin.controller.js - logout 函数
exports.logout = asyncHandler(async (req, res) => {
  const tok = req.cookies?.[config.admin.cookieName];
  if (tok) {
    const { addToBlacklist } = require('../../utils/tokenBlacklist');
    try {
      const payload = jwt.verify(tok, config.jwtSecret);
      await addToBlacklist(tok, payload.exp);
    } catch {}
  }
  res.clearCookie(config.admin.cookieName, { path: '/' });
  res.json({ success: true });
});
```

---

### H6: 修改密码后未自动吊销已有会话

**文件**: `modules/auth/auth.service.js`

```javascript
async function changePassword(userId, { oldPassword, newPassword }) {
  // ... 验证旧密码、更新密码 ...
  db.prepare('UPDATE users SET password=? WHERE id=?').run(hash, userId);
  return signToken(user);  // ★ 仅签发新 token，不注销旧会话
}
```

**问题**: 密码修改后，所有已有的 JWT token 仍然有效。攻击者若已窃取 token，即便用户改了密码仍可继续访问。`deleteSession` 需要用户手动操作，不具备强制性。

**建议修复**:
```javascript
async function changePassword(userId, { oldPassword, newPassword }) {
  // ... 验证旧密码 ...
  db.transaction(() => {
    db.prepare('UPDATE users SET password=? WHERE id=?').run(hash, userId);
    db.prepare('DELETE FROM user_sessions WHERE user_id=?').run(userId);  // ★ 强制注销所有会话
  })();
  return signToken(user);
}
```

---

### H7: 管理后台与用户端共享同一 JWT 签名密钥

**文件**: `config/index.js`

```javascript
jwtSecret: process.env.JWT_SECRET,  // ★ 用户和管理员共用
```

**问题**: 用户 JWT 和 Admin JWT 使用同一个 `jwtSecret` 签名。`JWT_SECRET` 泄漏将同时危及两个系统。且无法分别轮换密钥。

**建议修复**: 增加独立的管理后台密钥：
```javascript
// config/index.js
jwtSecret: process.env.JWT_SECRET,
adminJwtSecret: process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET,  // 可选独立密钥

// middleware/adminAuth.js 改用 config.adminJwtSecret
const payload = jwt.verify(token, config.adminJwtSecret);
```

---

### H8: 后台登录成功后初次无 CSRF Cookie，首次 POST 操作无 CSRF 防护

**文件**: `modules/admin/admin.controller.js` `setAdminCookie` 函数

**问题**: 管理员登录成功后，`setAdminCookie` 将 CSRF token 嵌入 JWT payload 但**未将其设置为独立 cookie**。这导致登录后的第一次 POST 请求（如 `/admin/invite-code`）在 CSRF middleware 中检测不到 `csrf_token` cookie → 直接放行。后续请求的 CSRF 防护在 adminAuth middleware 设置 cookie 后才生效。

**建议修复**: 在 `setAdminCookie` 中也设置 CSRF cookie：
```javascript
function setAdminCookie(req, res) {
  const csrf = uuidv4();
  // ... 签名 token ...
  res.cookie(config.csrfCookie, csrf, csrfCookieOptions(req));  // ★ 新增
  res.setHeader('X-CSRF-Token', csrf);                           // ★ 新增
}
```

---

### H9: 文件 Served 无 `Content-Disposition` 保护和下载配置可探测命名规则

**文件**: `app.js`

```javascript
app.use('/uploads', express.static(config.uploadsRoot));  // ★ 无保护
```

**问题**: 
- 上传的文件（头像、聊天文件等）以 UUID 命名，但 `MIME_TO_EXT` 映射表暴露了完整的扩展名派生规则
- `/uploads` 静态服务未设置 `X-Content-Type-Options: nosniff`（Helmet 默认有，但静态文件处理可覆盖）
- 上传目录被直接暴露为静态文件服务，不区分鉴权：任何知道文件 URL 的人都能访问

**建议修复**: 添加下载鉴权中间件或使用 `express.static` 配合验证：
```javascript
app.use('/uploads', auth, express.static(config.uploadsRoot));
// 或在上传文件 controller 中 serve，加入成员校验
```

---

## 🟠 中风险 (8 项)

### M1: 搜索接口可枚举已注册手机号

**文件**: `modules/users/users.service.js` `search` 函数

```javascript
return db.prepare(`
  SELECT u.id, u.username, u.avatar, u.bio, u.wechat_id
  FROM users u LEFT JOIN user_settings s ...
  WHERE u.id != ? AND (
    u.username LIKE ?
    OR (u.wechat_id = ? AND COALESCE(s.add_by_vxin_id, 1) = 1)
    OR (u.phone = ? AND COALESCE(s.add_by_phone, 1) = 1)
  ) LIMIT 20
`).all(userId, `%${q}%`, q, q);
```

**问题**: 虽然搜索不返回 `phone` 字段，但攻击者可以通过精确搜索手机号（`q` 参数），根据是否返回结果来判断该手机号是否已注册。`add_by_phone` 默认为 1（允许通过手机搜索）。

**建议修复**:
```javascript
// 选项 A: 移除 phone 搜索条件，仅允许通过 wechat_id 搜索
OR (u.wechat_id = ? AND ...)
// 改为仅保留：
OR (u.wechat_id = ? AND ...)
// 去掉 OR (u.phone = ? AND ...)

// 选项 B: 对非好友的 phone 搜索返回空结果，或对 phone 搜索增加速率限制
```

---

### M2: 修改密码接口无速率限制

**文件**: `modules/auth/auth.routes.js`

**问题**: 所有受保护的 POST 路由中，`changePassword` 是唯一没有应用速率限制的路由。攻击者在获取有效 session 后，可以通过高频请求暴力尝试猜测旧密码。

```javascript
// auth.routes.js — changePassword 无限流中间件
router.put('/password', auth, c.changePassword);
```

**建议修复**:
```javascript
// 添加密码修改限流器（如每小时 5 次）
const changePasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  message: JSON.stringify({ error: '修改密码尝试过于频繁' }),
});

router.put('/password', changePasswordLimiter, auth, c.changePassword);
```

---

### M3: 消息内容无服务端 HTML 净化

**文件**: `modules/messages/messages.service.js`

```javascript
async function send(io, convId, userId, { content, type = 'text', reply_to_id }) {
  // ... 直接存储原始 content
  db.prepare('INSERT INTO messages ...').run(id, convId, userId, type, content, reply_to_id || null);
}
```

**问题**: 消息内容未经任何 HTML / 脚本净化直接入库。若前端（Electron WebView 或 Web 端）渲染消息时未做转义，将导致存储型 XSS。虽然服务端可推卸给前端，但作为安全纵深应做净化。

**建议修复**:
```javascript
const striptags = require('striptags');
// 入库前净化
const safeContent = type === 'text' ? striptags(content) : content;
db.prepare('INSERT INTO messages ...').run(id, convId, userId, type, safeContent, reply_to_id || null);
```

---

### M4: 登录 / 注册 API 缺少防自动化攻击措施

**文件**: `modules/auth/auth.routes.js`

**问题**: 虽然登录有 10 分钟 5 次的速率限制、注册有 1 小时 5 次的限制，但没有任何 CAPTCHA 或人机验证（如 reCAPTCHA / Turnstile / hCaptcha）。攻击者可以通过旋转代理 IP（每个 IP 5 次/10分钟）进行大规模扫描。

**建议修复**: 集成 Turnstile 或 reCAPTCHA v3（无感验证）到登录/注册流程。

---

### M5: 管理后台 API 的 IP 白名单在 IPv6 环境可能被绕过

**文件**: `modules/admin/admin.routes.js`

```javascript
const normIp = ip => (ip || '').replace(/^::ffff:/, '');
router.use((req, res, next) => {
  const wl = config.admin.ipWhitelist;
  if (!wl.length) return next();
  const ip = normIp(req.ip);
  if (wl.includes(ip)) return next();
  return res.status(403).json({ error: '后台仅限白名单 IP 访问' });
});
```

**问题**: IP 白名单只处理了 IPv4-mapped IPv6 格式，但未处理纯 IPv6 地址。如果环境支持双栈且攻击者通过纯 IPv6 访问，而白名单中只配置了 IPv4 地址，则对 IPv6 流量无效。此外，`X-Forwarded-For` 头可以被伪造。

**建议修复**:
```javascript
const normIp = ip => {
  if (!ip) return '';
  const clean = ip.replace(/^::ffff:/, '');
  // 如果是 IPv6，检查是否在白名单中（需同时存储规范化的 IPv6 地址）
  return clean;
};
// 同时建议使用 X-Real-IP 而非 X-Forwarded-For 用于内部反代
```

---

### M6: CORS 源白名单包含生产域名，源码泄漏会暴露内部基础设施

**文件**: `config/index.js`

```javascript
const defaults = [
  'https://chat.91aigu.com',
  'https://vxin.91aigu.com',
  'https://91aigu.com',
  'https://www.91aigu.com',
  'https://dipsin.com',
  'https://www.dipsin.com',
  'http://dipsin.com',
  // ...
];
```

**问题**: 硬编码的生产域名暴露了项目内部基础设施信息。代码泄漏（如 GitHub 误推送、npm 包等）会直接暴露所有前端域和 IP。

**建议修复**:
```javascript
// 完全托管到环境变量
allowedOrigins: (() => {
  const origins = process.env.CORS_ORIGINS;
  if (!origins) {
    console.error('[config] 未配置 CORS_ORIGINS');
    return ['http://localhost:3000', 'http://localhost:5173'];  // 仅开发域
  }
  return origins.split(',').map(s => s.trim()).filter(Boolean);
})(),
```

---

### M7: `X-Forwarded-For` 信任不当，IP 白名单可被绕过

**文件**: `modules/admin/security.service.js`

```javascript
function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '0.0.0.0';
}
```

**问题**: 直接信任 `X-Forwarded-For` 头第一个 IP。如果 Nginx 未配置内部代理链，外部攻击者可以直接伪造请求头。虽然设置了 `trust proxy: 1`，但 `X-Forwarded-For` 的伪造防护取决于 reverse proxy 的正确配置。

**建议修复**: 确保 Nginx 配置 `proxy_set_header X-Real-IP $remote_addr;` 并优先使用 `X-Real-IP` 而非 `X-Forwarded-For`。

---

### M8: `/api/config` 未鉴权，泄漏功能开关信息

**文件**: `app.js`

```javascript
app.get('/api/config', (req, res) => res.json({ features: getFeatures() }));
```

**问题**: 无需任何认证即可获取功能开关状态（朋友圈、收藏功能的显隐）。虽然不属于敏感数据，但给未授权用户提供了额外的应用信息。

**建议修复**:
```javascript
app.get('/api/config', auth, (req, res) => res.json({ features: getFeatures() }));
// 或保留公开但限制返回字段
```

---

## 🟢 低风险 (6 项)

### L1: 搜索接口未限制搜索频率

**文件**: `modules/users/users.routes.js`

```javascript
router.get ('/search', auth, u.search);
// 社区多用户搜索、消息搜索均无速率限制
```

**问题**: 搜索接口没有专门的速率限制，攻击者可以利用单个 session 高频查询。

**建议修复**: 为搜索路由添加 1 分钟 30 次的速率限制：
```javascript
const searchLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: '搜索过于频繁' } });
router.get('/search', searchLimiter, auth, u.search);
```

---

### L2: 未设置 `access_token` 的安全传输头

**文件**: `middleware/auth.js`

**问题**: Bearer token 通过 `Authorization` header 传输，但 HTTPS 之外的场景（如开发环境 HTTP）未强制要求加密。Cookie 有 `Secure` 标记保障（通过 `cookies.js`），但 Bearer header 无此保障。

**建议修复**: 在生产环境拒绝非 HTTPS 请求的 Bearer token：
```javascript
if (bearerHeader && !req.secure && req.headers['x-forwarded-proto'] !== 'https') {
  return res.status(403).json({ error: 'Bearer token 仅支持 HTTPS' });
}
```

---

### L3: 错误日志可能暴露请求体中的查询参数

**文件**: `utils/logger.js`

```javascript
res.on('finish', () => {
  logger[logLevel]('HTTP Request', {
    query: Object.keys(req.query).length ? req.query : undefined,  // ★ 记录完整 query
    userId: req.user?.id,
    ip: req.ip,
  });
});
```

**问题**: `req.query` 被完整记录。如果搜索参数中包含敏感查询词（如手机号、密码重置 token 等），将明文记录在日志文件中。

**建议修复**: 对 query 参数做字段白名单或屏蔽敏感字段：
```javascript
const sensitiveKeys = ['password', 'token', 'secret', 'code', 'oldPassword', 'newPassword'];
const safeQuery = { ...req.query };
sensitiveKeys.forEach(k => { if (safeQuery[k]) safeQuery[k] = '***'; });
const logQuery = Object.keys(safeQuery).length ? safeQuery : undefined;
```

---

### L4: 忘记密码/找回密码流程缺失

**项目范围缺陷**: 整个应用中**不存在密码找回/重置功能**。用户如果忘记密码将无法恢复账号，只能通过管理员在后台重置。

**建议修复**: 增加基于手机验证码的密码重置流程，或至少在管理后台提供用户自助密码重置邮件功能。

---

### L5: TOTP 密钥存储在 admin_settings 表（明文）

**文件**: `modules/admin/security.service.js`

```javascript
function totpSecret() {
  return getSetting('totp_secret');
}
```

**问题**: TOTP 密钥存储在 SQLite 数据库的 `admin_settings` 表中，以明文形式保存。任何能够读取数据库文件（SQLite 文件系统访问、SQL 注入等）的人都可以获取 TOTP 密钥。

**建议修复**:
```javascript
// 使用环境变量或加密存储
const encryptedSecret = encryptAES(getSetting('totp_secret'), config.jwtSecret);
```

---

### L6: 数据目录路径可配置但缺省值集中，数据库文件路径可预测

**文件**: `config/index.js`

```javascript
dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../wechat.db'),
uploadsRoot: process.env.UPLOADS_ROOT || (/* 自动检测 legacy */}
```

**问题**: 数据库文件默认路径为硬编码的相对路径 `../../wechat.db`，在默认部署中位置可预测。攻击者可利用路径遍历或 LFI 漏洞下载数据库。

**建议修复**:
```javascript
dbPath: process.env.DB_PATH,  // 强制要求显式配置
// 若未配置则在启动时终止
if (!config.dbPath) {
  console.error('[config] 致命错误：未设置 DB_PATH');
  process.exit(1);
}
```

---

## 总结

| 等级 | 数量 | 关键领域 |
|------|------|---------|
| 🔴 高 | 9 | JWT 黑名单降级、密码策略不一致、用户枚举、token 过长、会话吊销缺失 |
| 🟠 中 | 8 | 手机号搜索枚举、速率限制不足、XSS 纵深、IP 白名单缺陷、配置泄漏 |
| 🟢 低 | 6 | 日志过度记录、搜索频率、数据路径可预测、TOTP 存储 |

### 建议优先修复（Top 5）

1. **H2** — Token 黑名单降级为放行 (被利用可导致任意已注销 token 持续有效)
2. **H1** — 修改密码强度不足 (攻击者可降级密码质量)
3. **H6** — 修改密码后旧会话持续有效 (需等待 30 天过期)
4. **H4** — 登录用户枚举 (可大量枚举有效手机号)
5. **H5** — 管理后台 token 无黑名单 (管理员登出后 token 仍可用 12 小时)

### 非功能性建议

- 考虑集成 WAF（如 Cloudflare WAF / ModSecurity）增加 HTTP 层防护
- 为敏感操作（封号、删用户、重置密码）增加操作人审计日志
- 增加 `npm audit` / Snyk 依赖扫描到 CI 流程
- 考虑为 SQLite 数据库增加加密层（如 SQLCipher）
