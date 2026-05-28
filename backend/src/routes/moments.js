const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/moments'),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// 获取朋友圈
router.get('/', auth, (req, res) => {
  const contacts = db.prepare('SELECT contact_id FROM contacts WHERE user_id=?').all(req.user.id).map(c => c.contact_id);
  const ids = [req.user.id, ...contacts];
  const placeholders = ids.map(() => '?').join(',');

  const moments = db.prepare(`
    SELECT m.*, u.username, u.avatar
    FROM moments m
    JOIN users u ON u.id=m.user_id
    WHERE m.user_id IN (${placeholders})
    ORDER BY m.created_at DESC
    LIMIT 50
  `).all(...ids);

  const result = moments.map(m => {
    const comments = db.prepare(`
      SELECT mc.*, u.username FROM moment_comments mc
      JOIN users u ON u.id=mc.user_id
      WHERE mc.moment_id=?
      ORDER BY mc.created_at
    `).all(m.id);
    const likes = JSON.parse(m.likes || '[]');
    let likedUsers = [];
    if (likes.length > 0) {
      const ph = likes.map(() => '?').join(',');
      likedUsers = db.prepare(`SELECT id, username FROM users WHERE id IN (${ph})`).all(...likes);
    }
    return { ...m, images: JSON.parse(m.images || '[]'), likes, likedUsers, comments };
  });

  res.json(result);
});

// 发布朋友圈
router.post('/', auth, upload.array('images', 9), (req, res) => {
  const { content } = req.body;
  const images = (req.files || []).map(f => `/uploads/moments/${f.filename}`);
  if (!content && !images.length) return res.status(400).json({ error: '内容不能为空' });

  const id = uuidv4();
  db.prepare('INSERT INTO moments (id,user_id,content,images) VALUES (?,?,?,?)').run(id, req.user.id, content || '', JSON.stringify(images));
  const moment = db.prepare('SELECT m.*, u.username, u.avatar FROM moments m JOIN users u ON u.id=m.user_id WHERE m.id=?').get(id);
  res.json({ ...moment, images, likes: [], likedUsers: [], comments: [] });
});

// 点赞/取消点赞
router.post('/:id/like', auth, (req, res) => {
  const moment = db.prepare('SELECT * FROM moments WHERE id=?').get(req.params.id);
  if (!moment) return res.status(404).json({ error: '不存在' });

  let likes = JSON.parse(moment.likes || '[]');
  const idx = likes.indexOf(req.user.id);
  if (idx > -1) likes.splice(idx, 1);
  else likes.push(req.user.id);

  db.prepare('UPDATE moments SET likes=? WHERE id=?').run(JSON.stringify(likes), req.params.id);
  res.json({ likes });
});

// 删除自己的朋友圈
router.delete('/:id', auth, (req, res) => {
  const moment = db.prepare('SELECT user_id FROM moments WHERE id=?').get(req.params.id);
  if (!moment) return res.status(404).json({ error: '不存在' });
  if (moment.user_id !== req.user.id) return res.status(403).json({ error: '无权删除' });
  db.prepare('DELETE FROM moment_comments WHERE moment_id=?').run(req.params.id);
  db.prepare('DELETE FROM moments WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// 评论
router.post('/:id/comment', auth, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: '评论不能为空' });

  const id = uuidv4();
  db.prepare('INSERT INTO moment_comments (id,moment_id,user_id,content) VALUES (?,?,?,?)').run(id, req.params.id, req.user.id, content);
  const comment = db.prepare('SELECT mc.*, u.username FROM moment_comments mc JOIN users u ON u.id=mc.user_id WHERE mc.id=?').get(id);
  res.json(comment);
});

module.exports = router;
