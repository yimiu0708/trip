import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { checkAchievements } from '../utils/achievements.js';

const router = Router();

// 获取所有景区（支持搜索、筛选）
router.get('/', (req, res) => {
  const db = getDb();
  const { provinceId, categoryId, level, q } = req.query;

  let sql = `SELECT a.*, p.name as province_name, c.name as category_name
             FROM attractions a
             JOIN provinces p ON a.province_id = p.id
             LEFT JOIN categories c ON a.category_id = c.id
             WHERE 1=1`;
  const params: (string | number)[] = [];

  if (provinceId) {
    sql += ' AND a.province_id = ?';
    params.push(Number(provinceId));
  }
  if (categoryId) {
    sql += ' AND a.category_id = ?';
    params.push(Number(categoryId));
  }
  if (level) {
    sql += ' AND a.level = ?';
    params.push(String(level));
  }
  if (q) {
    sql += ' AND a.name LIKE ?';
    params.push(`%${String(q)}%`);
  }

  sql += ' ORDER BY a.level DESC, a.pinyin ASC';

  const attractions = db.prepare(sql).all(...params);
  res.json(attractions);
});

// 批量点亮（需登录）
router.post('/batch/lit', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.user!.id;
  const { ids } = req.body as { ids: number[] };

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids不能为空' });
    return;
  }

  const insert = db.prepare('INSERT OR IGNORE INTO user_attractions (user_id, attraction_id) VALUES (?, ?)');
  const transaction = db.transaction((idsArr: number[]) => {
    for (const id of idsArr) {
      insert.run(userId, id);
    }
  });
  transaction(ids);

  const newAchievements = checkAchievements(userId);
  res.json({ success: true, newAchievements });
});

// 点亮景区（需登录）
router.post('/:id/lit', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.user!.id;
  const attractionId = Number(req.params.id);

  try {
    db.prepare('INSERT INTO user_attractions (user_id, attraction_id) VALUES (?, ?)').run(userId, attractionId);
  } catch (e: any) {
    if (e.message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: '已点亮' });
      return;
    }
    throw e;
  }

  const newAchievements = checkAchievements(userId);
  res.json({ success: true, newAchievements });
});

// 取消点亮（需登录）
router.delete('/:id/lit', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.user!.id;
  const attractionId = Number(req.params.id);

  db.prepare('DELETE FROM user_attractions WHERE user_id = ? AND attraction_id = ?').run(userId, attractionId);
  res.json({ success: true });
});

export default router;
