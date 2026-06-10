import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { generateToken } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();

// 注册
router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: '用户名和密码不能为空' });
    return;
  }
  if (!/^\w{3,20}$/.test(username) && !/[\u4e00-\u9fa5a-zA-Z0-9_]{3,20}/.test(username)) {
    res.status(400).json({ error: '用户名需3-20位' });
    return;
  }
  if (password.length < 6 || password.length > 20) {
    res.status(400).json({ error: '密码需6-20位' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(409).json({ error: '用户名已存在' });
    return;
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'user')").run(username, hash);

  const token = generateToken(Number(result.lastInsertRowid), username, 'user');
  res.json({ token, user: { id: result.lastInsertRowid, username, role: 'user' } });
});

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: '用户名和密码不能为空' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
    | { id: number; username: string; password_hash: string; role: string }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const token = generateToken(user.id, user.username, user.role);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// 获取当前用户
router.get('/me', (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const db = getDb();
  const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// 修改密码
router.put('/password', (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword || newPassword.length < 6 || newPassword.length > 20) {
    res.status(400).json({ error: '密码格式不正确' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id) as
    | { password_hash: string }
    | undefined;
  if (!user || !bcrypt.compareSync(oldPassword, user.password_hash)) {
    res.status(401).json({ error: '原密码错误' });
    return;
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ success: true });
});

export default router;
