import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { checkAchievements } from '../utils/achievements.js';

const router = Router();
const TARGET_TYPES = new Set(['city', 'attraction']);

function isTargetLit(userId: number, targetType: string, targetId: number) {
  const db = getDb();
  if (targetType === 'city') {
    return !!db.prepare(`
      SELECT 1 FROM user_attractions ua
      JOIN attractions a ON a.id = ua.attraction_id AND a.status = 'approved'
      WHERE ua.user_id = ? AND a.city_id = ? LIMIT 1
    `).get(userId, targetId);
  }
  return !!db.prepare(`
    SELECT 1 FROM user_attractions ua
    JOIN attractions a ON a.id = ua.attraction_id AND a.status = 'approved'
    WHERE ua.user_id = ? AND ua.attraction_id = ? LIMIT 1
  `).get(userId, targetId);
}

function targetExists(targetType: string, targetId: number) {
  const db = getDb();
  if (targetType === 'city') return !!db.prepare('SELECT 1 FROM cities WHERE id = ?').get(targetId);
  return !!db.prepare("SELECT 1 FROM attractions WHERE id = ? AND status = 'approved'").get(targetId);
}

function readFavoriteItems(userId: number) {
  const db = getDb();
  const cities = db.prepare(`
    SELECT f.id, f.target_type AS targetType, f.target_id AS targetId, f.source,
      f.last_favorited_at AS favoritedAt, c.name, c.province_id AS provinceId, p.name AS provinceName, p.region,
      COUNT(DISTINCT a.id) AS totalCount,
      COUNT(DISTINCT ua.attraction_id) AS litCount,
      GROUP_CONCAT(DISTINCT CASE WHEN a.id IN (
        SELECT id FROM attractions WHERE city_id = c.id AND status = 'approved' ORDER BY is_5a DESC, is_4a DESC, id LIMIT 3
      ) THEN a.name END) AS representativeNames,
      MAX(a.is_5a) AS has5A
    FROM user_favorites f
    JOIN cities c ON f.target_type = 'city' AND c.id = f.target_id
    JOIN provinces p ON p.id = c.province_id
    LEFT JOIN attractions a ON a.city_id = c.id AND a.status = 'approved'
    LEFT JOIN user_attractions ua ON ua.attraction_id = a.id AND ua.user_id = f.user_id
    WHERE f.user_id = ? AND f.deleted_at IS NULL
    GROUP BY f.id
  `).all(userId) as any[];
  const attractions = db.prepare(`
    SELECT f.id, f.target_type AS targetType, f.target_id AS targetId, f.source,
      f.last_favorited_at AS favoritedAt, a.name, p.name AS provinceName, p.region,
      c.name AS cityName, a.city_id AS cityId, a.province_id AS provinceId,
      CASE WHEN a.is_5a THEN '5A' WHEN a.is_4a THEN '4A' ELSE NULL END AS level,
      GROUP_CONCAT(DISTINCT category.name) AS categoryNames,
      CASE WHEN COUNT(ua.id) > 0 THEN 1 ELSE 0 END AS isLit,
      a.is_5a AS has5A
    FROM user_favorites f
    JOIN attractions a ON f.target_type = 'attraction' AND a.id = f.target_id AND a.status = 'approved'
    JOIN provinces p ON p.id = a.province_id
    JOIN cities c ON c.id = a.city_id
    LEFT JOIN attraction_tags tag ON tag.attraction_id = a.id
    LEFT JOIN categories category ON category.id = tag.category_id
    LEFT JOIN user_attractions ua ON ua.attraction_id = a.id AND ua.user_id = f.user_id
    WHERE f.user_id = ? AND f.deleted_at IS NULL
    GROUP BY f.id
  `).all(userId) as any[];

  return [
    ...cities.map((item) => ({
      ...item,
      isLit: item.litCount > 0,
      progress: item.totalCount ? Math.round(item.litCount / item.totalCount * 100) : 0,
      representativeNames: item.representativeNames ? String(item.representativeNames).split(',').slice(0, 3) : [],
      actionRoute: `/province/${item.provinceId}/cities/${item.targetId}`,
    })),
    ...attractions.map((item) => ({
      ...item,
      isLit: !!item.isLit,
      progress: item.isLit ? 100 : 0,
      categoryNames: item.categoryNames ? String(item.categoryNames).split(',') : [],
      actionRoute: `/province/${item.provinceId}/cities/${item.cityId}?highlight=${item.targetId}`,
    })),
  ];
}

router.get('/keys', authMiddleware, (req: AuthRequest, res) => {
  const rows = getDb().prepare(`
    SELECT id, target_type AS targetType, target_id AS targetId
    FROM user_favorites WHERE user_id = ? AND deleted_at IS NULL
    ORDER BY id
  `).all(req.user!.id);
  res.json(rows);
});

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const targetType = String(req.query.targetType || 'all');
  const status = String(req.query.status || 'all');
  const sort = String(req.query.sort || 'unlit_first');
  if (!['all', 'city', 'attraction'].includes(targetType) || !['all', 'lit', 'unlit'].includes(status)) {
    return res.status(400).json({ error: '收藏筛选条件不合法' });
  }

  const all = readFavoriteItems(req.user!.id);
  const stats = {
    cities: all.filter((item) => item.targetType === 'city').length,
    attractions: all.filter((item) => item.targetType === 'attraction').length,
    lit: all.filter((item) => item.isLit).length,
    total: all.length,
  };
  const items = all.filter((item) => (
    (targetType === 'all' || item.targetType === targetType)
    && (status === 'all' || (status === 'lit' ? item.isLit : !item.isLit))
  )).sort((a, b) => {
    if (sort === 'recent') return String(b.favoritedAt).localeCompare(String(a.favoritedAt));
    if (sort === 'progress_desc') return b.progress - a.progress || String(b.favoritedAt).localeCompare(String(a.favoritedAt));
    return Number(a.isLit) - Number(b.isLit)
      || String(b.favoritedAt).localeCompare(String(a.favoritedAt))
      || Number(b.has5A) - Number(a.has5A)
      || b.progress - a.progress;
  });
  res.json({ stats, items });
});

router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const targetType = String(req.body?.targetType || '');
  const targetId = Number(req.body?.targetId);
  const source = String(req.body?.source || 'manual').trim().slice(0, 40) || 'manual';
  if (!TARGET_TYPES.has(targetType) || !Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ error: '收藏目标不合法' });
  }
  if (!targetExists(targetType, targetId)) return res.status(404).json({ error: '收藏目标不存在' });

  const db = getDb();
  const unlit = !isTargetLit(userId, targetType, targetId);
  db.prepare(`
    INSERT INTO user_favorites (
      user_id, target_type, target_id, source, first_unlit_favorited_at
    ) VALUES (?, ?, ?, ?, CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END)
    ON CONFLICT(user_id, target_type, target_id) DO UPDATE SET
      source = excluded.source,
      last_favorited_at = CURRENT_TIMESTAMP,
      first_unlit_favorited_at = CASE
        WHEN user_favorites.first_unlit_favorited_at IS NULL AND ? THEN CURRENT_TIMESTAMP
        ELSE user_favorites.first_unlit_favorited_at
      END,
      deleted_at = NULL,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, targetType, targetId, source, unlit ? 1 : 0, unlit ? 1 : 0);
  const favorite = db.prepare(`
    SELECT id, target_type AS targetType, target_id AS targetId, last_favorited_at AS favoritedAt
    FROM user_favorites WHERE user_id = ? AND target_type = ? AND target_id = ?
  `).get(userId, targetType, targetId);
  res.status(201).json({ success: true, favorite, newAchievements: checkAchievements(userId) });
});

router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  const result = getDb().prepare(`
    UPDATE user_favorites SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND deleted_at IS NULL
  `).run(Number(req.params.id), req.user!.id);
  if (!result.changes) return res.status(404).json({ error: '收藏不存在或已取消' });
  res.json({ success: true });
});

export default router;
