'use strict';
/**
 * /api/messages —— 会话 + 消息 + 群管理 + 红包（原 messages.js 全部挂这）。
 *
 * ⚠⚠ 路由顺序就是契约。三个单段通配必须在同方法的具体路由之后：
 *     GET  /:conversationId   ← 必须晚于 GET  /conversations /search /missed /media …
 *     POST /:conversationId   ← 必须晚于 POST /forward /batch-delete
 *     DELETE /:msgId          ← 其余 DELETE 均为多段，安全
 * 多段路由（/conversation/* /red-packet/* /:id/upload /:msgId/react 等）不会被单段通配命中。
 *
 * 唯一与原版的顺序差异：GET /media 上移到 /:conversationId 之前——
 * 原版它被通配吃掉（死代码，前端也未调用），此处修正使其可达。
 */
const router = require('express').Router();
const auth = require('../../middleware/auth');
const { sendMsgLimiter } = require('../../middleware/rateLimiters');

const conv = require('../conversations/conversations.controller');
const msg  = require('./messages.controller');
const grp  = require('../groups/groups.controller');
const rp   = require('../redpackets/redpackets.controller');

// ── 会话创建 / 列表 ─────────────────────────────────────────────
router.post('/conversation/private', auth, conv.createPrivate);
router.post('/conversation/group',   auth, conv.createGroup);
router.get ('/file-helper',          auth, conv.fileHelper);
router.get ('/conversations',        auth, conv.list);
router.get ('/conversation/:conversationId/members', auth, conv.members);
router.get ('/unread-counts',        auth, conv.unreadCounts);
router.get ('/my-groups',            auth, conv.myGroups);

// ── 全局搜索 ────────────────────────────────────────────────────
router.get ('/search', auth, msg.searchGlobal);

// ── 群：昵称 / 邀请链接 / 二维码 / 扫码进群 ──────────────────────
router.put ('/conversation/:convId/nickname',    auth, grp.setNickname);
router.post('/conversation/:convId/invite-link', auth, grp.createInviteLink);
router.get ('/conversation/:convId/qr-code',     auth, grp.qrCode);
router.post('/join/:token',                      auth, grp.join);

// ── 断线补拉 ────────────────────────────────────────────────────
router.get ('/missed', auth, msg.missed);

// ── 群管理 ──────────────────────────────────────────────────────
router.put   ('/conversation/:convId',               auth, grp.updateInfo);
router.put   ('/conversation/:convId/avatar',         auth, ...grp.avatarMiddlewares, grp.setAvatar);
router.post  ('/conversation/:convId/invite',         auth, grp.invite);
router.delete('/conversation/:convId/members/:uid',   auth, grp.kick);
router.post  ('/conversation/:convId/leave',          auth, grp.leave);
router.get   ('/conversation/:convId/info',           auth, grp.info);
router.put   ('/conversation/:convId/manage',         auth, grp.manage);
router.put   ('/conversation/:convId/members/:uid/role', auth, grp.setRole);

// ── 会话设置 ────────────────────────────────────────────────────
router.post  ('/conversation/:convId/pin',  auth, conv.pin);
router.post  ('/conversation/:convId/mute', auth, conv.mute);
router.post  ('/conversation/:convId/read', auth, conv.read);
router.delete('/conversation/:convId/messages', auth, conv.clearConversation);
router.delete('/conversations/messages',        auth, conv.clearAll);
router.get   ('/conversation/:convId/search',   auth, msg.searchInConv);

// ── 媒体列表（修正：上移到 /:conversationId 之前）───────────────
router.get('/media', auth, conv.media);

// ── 单段 GET 通配：消息历史 ─────────────────────────────────────
router.get('/:conversationId', auth, msg.history);

// ── 转发 / 批量撤回（POST 单段字面量，必须早于 POST /:conversationId）──
router.post('/forward',      auth, msg.forward);
router.post('/batch-delete', auth, msg.batchDelete);

// ── 单段 POST 通配：HTTP 发消息 ─────────────────────────────────
router.post('/:conversationId', auth, sendMsgLimiter, msg.send);

// ── 文件上传：权限门控 → multer+魔数 → 入库广播 ─────────────────
router.post('/:conversationId/upload', auth, msg.uploadGuard, ...msg.uploadMiddlewares, msg.uploadHandle);

// ── 单段 DELETE 通配：撤回消息 ──────────────────────────────────
router.delete('/:msgId', auth, msg.remove);

// ── 消息操作 ────────────────────────────────────────────────────
router.post('/:msgId/react', auth, msg.react);
router.put ('/:msgId/edit',  auth, msg.edit);

// ── 置顶消息 ────────────────────────────────────────────────────
router.post  ('/conversation/:convId/pin-message',         auth, grp.pinMessage);
router.delete('/conversation/:convId/pin-message/:msgId',  auth, grp.unpinMessage);
router.get   ('/conversation/:convId/pinned-messages',     auth, grp.listPinned);

// ── 收藏 ────────────────────────────────────────────────────────
router.post('/:msgId/collect', auth, msg.collect);

// ── 红包 ────────────────────────────────────────────────────────
router.post('/red-packet/send',            auth, rp.send);
router.get ('/red-packet/:packetId',       auth, rp.detail);
router.post('/red-packet/:packetId/claim', auth, rp.claim);

module.exports = router;
