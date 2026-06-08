'use strict';
const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
const auth = require('../middleware/auth');
const { isConfigured, getPresignedPutUrl } = require('../utils/cloudStorage');
const { ALLOWED_CHAT_MIMES, MIME_TO_EXT }  = require('../utils/upload');

const router = express.Router();

// 每个用户 10 分钟内最多申请 30 个上传凭证，防止刷爆 R2 存储
const credentialLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  // auth 中间件已在前面执行，req.user.id 一定存在，用用户 ID 做 key 最精准
  keyGenerator: req => req.user.id,
  handler: (req, res) => res.status(429).json({ error: '上传过于频繁，请稍后再试' }),
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

/**
 * POST /api/upload/credential
 *
 * 客户端上传前调用此接口，获取预签名 PUT URL。
 * 文件将由客户端直传云存储，绝不经过本服务器。
 *
 * 请求体：{ filename: string, contentType: string, conversationId: string }
 * 响应：  { uploadUrl, publicUrl, key, expiresIn }
 */
router.post('/credential', auth, credentialLimiter, async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({
      error: '云存储未配置，请在服务器 .env 中设置 CLOUD_PROVIDER 及对应密钥',
    });
  }

  const { filename, contentType, conversationId } = req.body;
  if (!filename || !contentType || !conversationId) {
    return res.status(400).json({ error: '参数缺失: filename, contentType, conversationId' });
  }

  // 鉴权：用户必须是该会话成员
  const member = db
    .prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?')
    .get(conversationId, req.user.id);
  if (!member) return res.status(403).json({ error: '无权上传至该会话' });

  // MIME 白名单校验
  if (!ALLOWED_CHAT_MIMES.has(contentType)) {
    return res.status(400).json({ error: `不支持的文件类型: ${contentType}` });
  }

  const ext = MIME_TO_EXT[contentType] || '.bin';
  // 对象路径按会话隔离，方便后续设置存储策略
  const key = `chat/${conversationId}/${uuidv4()}${ext}`;

  try {
    const { uploadUrl, publicUrl } = await getPresignedPutUrl(key, contentType);
    res.json({ uploadUrl, publicUrl, key, expiresIn: 600 });
  } catch (e) {
    console.error('[upload/credential] 生成预签名 URL 失败:', e.message);
    res.status(500).json({ error: '生成上传凭证失败，请稍后重试' });
  }
});

module.exports = router;
