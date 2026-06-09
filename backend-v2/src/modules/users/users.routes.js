'use strict';
/**
 * /api/users —— 用户 + 联系人/好友/黑名单（原 users.js 全部挂这）。
 * ⚠ 路由顺序敏感：GET /:id 是单段通配，必须在所有单段具体路由之后注册，
 *   否则会吃掉 /search、/contacts 等。此处严格保持原始顺序。
 */
const path = require('path');
const router = require('express').Router();
const auth = require('../../middleware/auth');
const config = require('../../config');
const { makeImageUploader } = require('../../utils/upload');
const u = require('./users.controller');
const c = require('../contacts/contacts.controller');

const AVATARS_DIR = path.join(config.uploadsRoot, 'avatars');
const uploadAvatar = makeImageUploader(AVATARS_DIR, 'avatar', 1, 5  * 1024 * 1024);
const uploadCover  = makeImageUploader(AVATARS_DIR, 'cover',  1, 10 * 1024 * 1024);

// ── 个人 ────────────────────────────────────────────────────────
router.get ('/me/qrcode',   auth, u.qrcode);
router.get ('/me/settings', auth, u.getSettings);
router.put ('/me/settings', auth, u.updateSettings);
router.get ('/search',      auth, u.search);

// ── 联系人 / 好友请求 ───────────────────────────────────────────
router.get ('/contacts',                  auth, c.listContacts);
router.post('/friend-request',            auth, c.sendFriendRequest);
router.get ('/friend-requests',           auth, c.listReceived);
router.get ('/friend-requests/sent',      auth, c.listSent);
router.post('/friend-request/:id/handle', auth, c.handleRequest);
router.delete('/contacts/:contactId',     auth, c.deleteContact);
router.put ('/contacts/:contactId/remark',auth, c.setRemark);

// ── 头像 / 封面 / 资料 ──────────────────────────────────────────
router.post('/avatar', auth, ...uploadAvatar, u.uploadAvatar);
router.post('/cover',  auth, ...uploadCover,  u.uploadCover);
router.put ('/profile', auth, u.updateProfile);

// ── 单段通配（必须在此之后不再有单段 GET 具体路由）──────────────
router.get ('/:id', auth, u.getUserDetail);

// ── 两段路由（不被 /:id 影响）──────────────────────────────────
router.get   ('/me/collections', auth, u.getCollections);
router.post  ('/block/:targetId', auth, c.block);
router.delete('/block/:targetId', auth, c.unblock);
router.get   ('/me/blocked',      auth, c.listBlocked);

module.exports = router;
