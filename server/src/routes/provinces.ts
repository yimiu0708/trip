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

// 获取省份详情及景区
router.get('/:id', (req, res) => {
  const db = getDb();
  const provinceId = Number(req.params.id);
  const province = db.prepare('SELECT * FROM provinces WHERE id = ?').get(provinceId);
  if (!province) {
    res.status(404).json({ error: '省份不存在' });
    return;
  }

  const attractions = db
    .prepare(
      `SELECT a.*, c.name as category_name
       FROM attractions a
       LEFT JOIN categories c ON a.category_id = c.id
       WHERE a.province_id = ?
       ORDER BY a.level DESC, a.pinyin ASC`
    )
    .all(provinceId);

  res.json({ province, attractions });
});

export default router;
