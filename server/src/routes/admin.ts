import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { authMiddleware, adminMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// 所有路由都需要管理员权限
router.use(authMiddleware, adminMiddleware);

// ===== 用户管理 =====

// 获取用户列表（含点亮统计）
router.get('/users', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT u.id, u.username, u.role, u.created_at,
           COUNT(DISTINCT ua.attraction_id) as lit_count
    FROM users u
    LEFT JOIN user_attractions ua ON ua.user_id = u.id
    GROUP BY u.id
    ORDER BY u.id DESC
  `).all();
  res.json(users);
});

// 修改指定用户密码
router.put('/users/:id/password', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userId = Number(req.params.id);
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6 || newPassword.length > 20) {
    res.status(400).json({ error: '密码需6-20位' });
    return;
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
  res.json({ success: true });
});

// 删除用户
router.delete('/users/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userId = Number(req.params.id);

  if (userId === req.user!.id) {
    res.status(400).json({ error: '不能删除自己' });
    return;
  }

  db.prepare('DELETE FROM user_attractions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_achievements WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_recall_guides WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  res.json({ success: true });
});

// ===== 系统配置 =====

// 获取所有配置
router.get('/settings', (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const settings = db.prepare('SELECT key, value, description, updated_at FROM settings ORDER BY key').all();
  res.json(settings);
});

// 获取单个配置
router.get('/settings/:key', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const setting = db.prepare('SELECT key, value, description, updated_at FROM settings WHERE key = ?').get(req.params.key);
  if (!setting) {
    res.status(404).json({ error: '配置不存在' });
    return;
  }
  res.json(setting);
});

// 批量更新配置
router.put('/settings', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const updates = req.body as Record<string, string>;

  const insertOrUpdate = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = db.transaction((data: Record<string, string>) => {
    for (const [key, value] of Object.entries(data)) {
      insertOrUpdate.run(key, value);
    }
  });

  transaction(updates);
  res.json({ success: true });
});

export default router;
