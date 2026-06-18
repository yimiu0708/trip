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
    WHERE ua.user_id = ? AND a.status = 'approved'
  `).get(userId) as { lit_provinces: number; total_provinces: number };

  // 城市统计
  const cityStats = db.prepare(`
    SELECT COUNT(DISTINCT a.city_id) as lit_cities,
           (SELECT COUNT(*) FROM cities) as total_cities
    FROM user_attractions ua
    JOIN attractions a ON ua.attraction_id = a.id
    WHERE ua.user_id = ? AND a.status = 'approved'
  `).get(userId) as { lit_cities: number; total_cities: number };

  // 景区统计
  const attractionStats = db.prepare(`
    SELECT COUNT(DISTINCT ua.attraction_id) as lit_attractions,
           COUNT(*) as total_visits,
           (SELECT COUNT(*) FROM attractions WHERE status = 'approved') as total_attractions
    FROM user_attractions ua
    JOIN attractions a ON ua.attraction_id = a.id
    WHERE ua.user_id = ? AND a.status = 'approved'
  `).get(userId) as { lit_attractions: number; total_visits: number; total_attractions: number };

  // 各省份点亮数
  const provinceBreakdown = db.prepare(`
    SELECT p.id, p.name, p.region, COUNT(DISTINCT ua.attraction_id) as lit_count,
           (SELECT COUNT(*) FROM attractions WHERE province_id = p.id AND status = 'approved') as total_count
    FROM provinces p
    LEFT JOIN attractions a ON a.province_id = p.id AND a.status = 'approved'
    LEFT JOIN user_attractions ua ON ua.attraction_id = a.id AND ua.user_id = ?
    GROUP BY p.id
    ORDER BY p.id
  `).all(userId);

  // 各城市点亮数
  const cityBreakdown = db.prepare(`
    SELECT c.id, c.name, c.province_id, COUNT(DISTINCT ua.attraction_id) as lit_count,
           (SELECT COUNT(*) FROM attractions WHERE city_id = c.id AND status = 'approved') as total_count
    FROM cities c
    LEFT JOIN attractions a ON a.city_id = c.id AND a.status = 'approved'
    LEFT JOIN user_attractions ua ON ua.attraction_id = a.id AND ua.user_id = ?
    GROUP BY c.id
    ORDER BY c.id
  `).all(userId);

  // 各分类点亮数（基于标签多对多统计）
  const categoryBreakdown = db.prepare(`
    SELECT c.id, c.name, COUNT(DISTINCT ua.attraction_id) as lit_count,
           (SELECT COUNT(DISTINCT at2.attraction_id)
            FROM attraction_tags at2
            JOIN attractions a2 ON a2.id = at2.attraction_id
            WHERE at2.category_id = c.id AND a2.status = 'approved') as total_count
    FROM categories c
    LEFT JOIN attraction_tags at ON at.category_id = c.id
    LEFT JOIN attractions a ON a.id = at.attraction_id AND a.status = 'approved'
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
    cityStats,
    attractionStats,
    provinceBreakdown,
    cityBreakdown,
    categoryBreakdown,
    achievementCount: achievementCount.count,
  });
});

// 用户点亮记录
router.get('/lit-list', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.user!.id;

  const list = db.prepare(`
    SELECT a.id, a.name, a.is_5a, a.is_4a, p.name as province_name, ci.name as city_name,
           ua.lit_at, ua.time_precision, ua.season, ua.display_time_text, ua.source
    FROM user_attractions ua
    JOIN attractions a ON ua.attraction_id = a.id
    JOIN provinces p ON a.province_id = p.id
    LEFT JOIN cities ci ON a.city_id = ci.id
    WHERE ua.user_id = ? AND a.status = 'approved'
    ORDER BY ua.lit_at DESC, ua.id DESC
  `).all(userId) as any[];

  const tagStmt = db.prepare(`
    SELECT c.id, c.name
    FROM attraction_tags at
    JOIN categories c ON at.category_id = c.id
    WHERE at.attraction_id = ?
    ORDER BY c.sort_order
  `);
  for (const item of list) {
    item.tags = tagStmt.all(item.id);
    item.category_name = item.tags.map((t: any) => t.name).join(', ');
    item.level = item.is_5a ? '5A' : item.is_4a ? '4A' : '';
  }

  res.json(list);
});

export default router;
