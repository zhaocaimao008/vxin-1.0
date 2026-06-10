'use strict';
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const adminAuth = require('../../middleware/adminAuth');
const c = require('./admin.controller');

// 后台登录限流：15分钟 10 次
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { error: '登录尝试过于频繁，请稍后再试' },
  standardHeaders: true, legacyHeaders: false,
});

// ── 认证 ────────────────────────────────────────────────────────
router.post('/login',  adminLoginLimiter, c.login);
router.post('/logout',                    c.logout);
router.get ('/me',     adminAuth,         c.me);

// ── 总览 ────────────────────────────────────────────────────────
router.get ('/stats',  adminAuth, c.stats);

// ── 安全（谷歌验证 + 可信设备/IP）──────────────────────────────
router.get   ('/security',              adminAuth, c.securityStatus);
router.post  ('/security/totp/setup',   adminAuth, c.totpSetup);
router.post  ('/security/totp/enable',  adminAuth, c.totpEnable);
router.post  ('/security/totp/disable', adminAuth, c.totpDisable);
router.delete('/security/trusted/:id',  adminAuth, c.revokeTrusted);

// ── 用户管理 ────────────────────────────────────────────────────
router.get   ('/users',                adminAuth, c.listUsers);
router.get   ('/users/:id',            adminAuth, c.userDetail);
router.post  ('/users/:id/ban',        adminAuth, c.ban);
router.post  ('/users/:id/unban',      adminAuth, c.unban);
router.post  ('/users/:id/reset-password', adminAuth, c.resetPassword);
router.delete('/users/:id',            adminAuth, c.deleteUser);

// ── 消息监控 ────────────────────────────────────────────────────
router.get('/messages', adminAuth, c.listMessages);

// ── 群管理 ──────────────────────────────────────────────────────
router.get   ('/groups',     adminAuth, c.listGroups);
router.get   ('/groups/:id', adminAuth, c.groupDetail);
router.delete('/groups/:id', adminAuth, c.dismissGroup);

// ── 邀请码 ──────────────────────────────────────────────────────
router.get ('/invite-code',          adminAuth, c.getInviteCode);
router.put ('/invite-code',          adminAuth, c.setInviteCode);
router.post('/invite-code/generate', adminAuth, c.generateInviteCode);

// ── 功能开关（朋友圈 / 收藏 显隐）──────────────────────────────
router.get('/features', adminAuth, c.getFeatures);
router.put('/features', adminAuth, c.setFeatures);

module.exports = router;
