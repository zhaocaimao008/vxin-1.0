'use strict';
const router = require('express').Router();
const auth = require('../../middleware/auth');
const m = require('./moments.controller');

router.get   ('/',                auth, m.timeline);       // 时间线（本人+好友）
router.post  ('/',                auth, m.create);         // 发布
router.get   ('/user/:userId',    auth, m.userMoments);    // 某用户的动态
router.delete('/comments/:commentId', auth, m.deleteComment); // 删评论（须在 /:id 之前）
router.delete('/:id',             auth, m.remove);         // 删动态
router.post  ('/:id/like',        auth, m.like);           // 点赞/取消
router.post  ('/:id/comment',     auth, m.comment);        // 评论

module.exports = router;
