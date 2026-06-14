import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// 获取所有省份（含统计）
router.get('/', (req, res) => {
  const db = getDb();
  const provinces = db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM attractions WHERE province_id = p.id) as total_count
    FROM provinces p
    ORDER BY p.id
  `).all();
  res.json(provinces);
});

// 获取省份详情及景区（按城市分组）
router.get('/:id', (req, res) => {
  const db = getDb();
  const provinceId = Number(req.params.id);
  const province = db.prepare('SELECT * FROM provinces WHERE id = ?').get(provinceId);
  if (!province) {
    res.status(404).json({ error: '省份不存在' });
    return;
  }

  const cities = db
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM attractions WHERE city_id = c.id) as total_count,
        COALESCE((SELECT COUNT(DISTINCT ua.attraction_id)
                  FROM user_attractions ua
                  JOIN attractions a ON ua.attraction_id = a.id
                  WHERE a.city_id = c.id), 0) as lit_count
       FROM cities c
       WHERE c.province_id = ?
       ORDER BY c.id`
    )
    .all(provinceId);

  const attractions = db
    .prepare(
      `SELECT a.id, a.name, a.province_id, a.city_id, a.is_5a, a.is_4a,
              CASE WHEN a.is_5a THEN '5A' WHEN a.is_4a THEN '4A' ELSE '' END as level,
              a.pinyin, ci.name as city_name
       FROM attractions a
       LEFT JOIN cities ci ON a.city_id = ci.id
       WHERE a.province_id = ?
       ORDER BY a.city_id, a.is_5a DESC, a.is_4a DESC, a.pinyin ASC`
    )
    .all(provinceId) as any[];

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

  res.json({ province, cities, attractions });
});

export default router;
