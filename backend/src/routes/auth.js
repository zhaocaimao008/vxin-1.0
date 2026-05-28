const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, phone, password } = req.body;
  if (!username || !phone || !password)
    return res.status(400).json({ error: '请填写所有字段' });

  const existing = db.prepare('SELECT id FROM users WHERE phone=? OR username=?').get(phone, username);
  if (existing) return res.status(400).json({ error: '用户名或手机号已存在' });

  const hash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  db.prepare('INSERT INTO users (id,username,phone,password) VALUES (?,?,?,?)').run(id, username, phone, hash);

  const token = jwt.sign({ id, username }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id, username, phone, avatar: '', bio: '' } });
});

router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: '请填写手机号和密码' });

  const user = db.prepare('SELECT * FROM users WHERE phone=?').get(phone);
  if (!user) return res.status(400).json({ error: '用户不存在' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: '密码错误' });

  const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, username: user.username, phone: user.phone, avatar: user.avatar, bio: user.bio } });
});

module.exports = router;
