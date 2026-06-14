import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { checkAchievements } from '../utils/achievements.js';

const router = Router();

// 获取所有景区（支持搜索、筛选）
router.get('/', (req, res) => {
  const db = getDb();
  const { provinceId, cityId, categoryId, level, q } = req.query;

  let sql = `SELECT a.id, a.name, a.province_id, a.city_id, a.is_5a, a.is_4a,
                    CASE WHEN a.is_5a THEN '5A' WHEN a.is_4a THEN '4A' ELSE '' END as level,
                    a.pinyin, p.name as province_name, ci.name as city_name
             FROM attractions a
             JOIN provinces p ON a.province_id = p.id
             LEFT JOIN cities ci ON a.city_id = ci.id
             WHERE 1=1`;
  const params: (string | number)[] = [];

  if (provinceId) {
    sql += ' AND a.province_id = ?';
    params.push(Number(provinceId));
  }
  if (cityId) {
    sql += ' AND a.city_id = ?';
    params.push(Number(cityId));
  }
  if (categoryId) {
    sql += ' AND a.id IN (SELECT attraction_id FROM attraction_tags WHERE category_id = ?)';
    params.push(Number(categoryId));
  }
  if (level === '5A') {
    sql += ' AND a.is_5a = 1';
  } else if (level === '4A') {
    sql += ' AND a.is_4a = 1';
  }
  if (q) {
    sql += ' AND a.name LIKE ?';
    params.push(`%${String(q)}%`);
  }

  sql += ' ORDER BY a.province_id, a.city_id, a.is_5a DESC, a.is_4a DESC, a.pinyin ASC';

  const attractions = db.prepare(sql).all(...params) as any[];

  // Attach tags
  const tagStmt = db.prepare(`
    SELECT c.id, c.name
    FROM attraction_tags at
    JOIN categories c ON at.category_id = c.id
    WHERE at.attraction_id = ?
    ORDER BY c.sort_order
  `);
  for (const a of attractions) {
    a.tags = tagStmt.all(a.id);
    a.category_name = a.tags.map((t: any) => t.name).join(', ');
  }

  res.json(attractions);
});

// 批量点亮（需登录），支持自定义时间
router.post('/batch/lit', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.user!.id;
  const { ids, lit_at } = req.body as { ids: number[]; lit_at?: string };

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids不能为空' });
    return;
  }

  const litAtValue = lit_at && !isNaN(Date.parse(lit_at)) ? lit_at : new Date().toISOString();
  const insert = db.prepare('INSERT INTO user_attractions (user_id, attraction_id, lit_at) VALUES (?, ?, ?)');
  const transaction = db.transaction((idsArr: number[]) => {
    for (const id of idsArr) {
      insert.run(userId, id, litAtValue);
    }
  });
  transaction(ids);

  const newAchievements = checkAchievements(userId);
  res.json({ success: true, newAchievements });
});

// 点亮景区（需登录），支持自定义时间
router.post('/:id/lit', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.user!.id;
  const attractionId = Number(req.params.id);
  const { lit_at } = req.body as { lit_at?: string };

  const litAtValue = lit_at && !isNaN(Date.parse(lit_at)) ? lit_at : new Date().toISOString();
  db.prepare('INSERT INTO user_attractions (user_id, attraction_id, lit_at) VALUES (?, ?, ?)').run(userId, attractionId, litAtValue);

  const newAchievements = checkAchievements(userId);
  res.json({ success: true, newAchievements });
});

// 取消点亮（需登录）——删除该用户对该景区的最新一条记录
router.delete('/:id/lit', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.user!.id;
  const attractionId = Number(req.params.id);

  db.prepare(`
    DELETE FROM user_attractions
    WHERE id = (
      SELECT id FROM user_attractions
      WHERE user_id = ? AND attraction_id = ?
      ORDER BY lit_at DESC, id DESC
      LIMIT 1
    )
  `).run(userId, attractionId);
  res.json({ success: true });
});

export default router;
