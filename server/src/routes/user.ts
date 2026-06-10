import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// 用户统计与进度
router.get('/progress', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.user!.id;

  // 省份统计
  const provinceStats = db.prepare(`
    SELECT COUNT(DISTINCT a.province_id) as lit_provinces,
           (SELECT COUNT(*) FROM provinces) as total_provinces
    FROM user_attractions ua
    JOIN attractions a ON ua.attraction_id = a.id
    WHERE ua.user_id = ?
  `).get(userId) as { lit_provinces: number; total_provinces: number };

  // 景区统计
  const attractionStats = db.prepare(`
    SELECT COUNT(*) as lit_attractions,
           (SELECT COUNT(*) FROM attractions) as total_attractions
    FROM user_attractions
    WHERE user_id = ?
  `).get(userId) as { lit_attractions: number; total_attractions: number };

  // 各省份点亮数
  const provinceBreakdown = db.prepare(`
    SELECT p.id, p.name, p.region, COUNT(DISTINCT ua.attraction_id) as lit_count,
           (SELECT COUNT(*) FROM attractions WHERE province_id = p.id) as total_count
    FROM provinces p
    LEFT JOIN attractions a ON a.province_id = p.id
    LEFT JOIN user_attractions ua ON ua.attraction_id = a.id AND ua.user_id = ?
    GROUP BY p.id
    ORDER BY p.id
  `).all(userId);

  // 各分类点亮数
  const categoryBreakdown = db.prepare(`
    SELECT c.id, c.name, COUNT(DISTINCT ua.attraction_id) as lit_count,
           (SELECT COUNT(*) FROM attractions WHERE category_id = c.id) as total_count
    FROM categories c
    LEFT JOIN attractions a ON a.category_id = c.id
    LEFT JOIN user_attractions ua ON ua.attraction_id = a.id AND ua.user_id = ?
    GROUP BY c.id
    ORDER BY lit_count DESC, c.sort_order
  `).all(userId);

  // 已解锁成就数
  const achievementCount = db.prepare(`
    SELECT COUNT(*) as count FROM user_achievements WHERE user_id = ?
  `).get(userId) as { count: number };

  res.json({
    provinceStats,
    attractionStats,
    provinceBreakdown,
    categoryBreakdown,
    achievementCount: achievementCount.count,
  });
});

// 用户点亮记录
router.get('/lit-list', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.user!.id;

  const list = db.prepare(`
    SELECT a.id, a.name, a.level, p.name as province_name, c.name as category_name, ua.lit_at
    FROM user_attractions ua
    JOIN attractions a ON ua.attraction_id = a.id
    JOIN provinces p ON a.province_id = p.id
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE ua.user_id = ?
    ORDER BY ua.lit_at DESC
  `).all(userId);

  res.json(list);
});

export default router;
