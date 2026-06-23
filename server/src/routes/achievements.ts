import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { checkAchievements } from '../utils/achievements.js';
import { getAchievementGrouping, getCategoryThreshold, getSpecialConditionDescription } from '../utils/achievementCatalog.js';
import { getAchievementProgress } from '../utils/progressRecommendations.js';

const router = Router();

// 获取所有成就配置
router.get('/', (_req, res) => {
  const db = getDb();
  const achievements = db.prepare(`
    SELECT * FROM achievements
    ORDER BY
      CASE type
        WHEN 'province' THEN 1
        WHEN 'city' THEN 2
        WHEN 'attraction' THEN 3
        WHEN 'category' THEN 4
        WHEN 'collector' THEN 5
        WHEN 'special' THEN 6
        ELSE 9
      END,
      condition_value,
      level,
      id
  `).all();
  res.json(achievements);
});

// 获取当前用户成就
router.get('/mine', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.user!.id;

  checkAchievements(userId);

  const userAchievements = db
    .prepare(
      `SELECT a.*,
              latest.unlocked_at,
              latest.snapshot_lit,
              latest.snapshot_total,
              latest.snapshot_percent,
              latest.is_current_max,
              COALESCE(counts.unlock_count, 0) as unlock_count,
              CASE WHEN a.id = u.equipped_achievement_id THEN 1 ELSE 0 END as is_equipped
       FROM achievements a
       CROSS JOIN users u
       LEFT JOIN (
         SELECT ua.*
         FROM user_achievements ua
         JOIN (
           SELECT achievement_id, MAX(id) as id
           FROM user_achievements
           WHERE user_id = ?
           GROUP BY achievement_id
         ) picked
           ON picked.id = ua.id
         WHERE ua.user_id = ?
       ) latest ON latest.achievement_id = a.id
       LEFT JOIN (
         SELECT achievement_id, COUNT(*) as unlock_count
         FROM user_achievements
         WHERE user_id = ?
         GROUP BY achievement_id
       ) counts ON counts.achievement_id = a.id
       WHERE u.id = ?
       ORDER BY
        CASE a.type
          WHEN 'province' THEN 1
          WHEN 'city' THEN 2
          WHEN 'attraction' THEN 3
          WHEN 'category' THEN 4
          WHEN 'collector' THEN 5
          WHEN 'special' THEN 6
          ELSE 9
        END,
        a.condition_value,
        a.level,
        a.id`
    )
    .all(userId, userId, userId, userId) as any[];

  const categoryStats = new Map((db.prepare(`
    SELECT c.id, c.name, COUNT(DISTINCT a.id) AS total
    FROM categories c
    LEFT JOIN attraction_tags at ON at.category_id = c.id
    LEFT JOIN attractions a ON a.id = at.attraction_id AND a.status = 'approved'
    GROUP BY c.id, c.name
  `).all() as { id: number; name: string; total: number }[]).map((category) => [category.id, category]));

  res.json(userAchievements.map((achievement) => {
    if (achievement.type === 'special' && !achievement.unlocked_at && !achievement.badge_style.includes('personality')) {
      return {
        ...achievement,
        display_name: '???',
        display_desc: '继续探索，解开彩蛋成就',
      };
    }
    const progress = getAchievementProgress(userId, achievement);
    let displayDesc = achievement.condition_desc;
    if (achievement.type === 'category') {
      const category = categoryStats.get(Number(achievement.condition_value));
      displayDesc = category && category.total > 0
        ? `点亮${getCategoryThreshold(category.total, Number(achievement.level || 1))}个${category.name}景区`
        : '点亮对应分类景区';
    } else if (achievement.type === 'special' && !achievement.badge_style.includes('personality')) {
      displayDesc = getSpecialConditionDescription(achievement.condition_desc);
    } else if (achievement.type === 'season') {
      const seasonLabels: Record<string, string> = { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' };
      displayDesc = achievement.condition_desc === 'all_seasons'
        ? '春夏秋冬四季均至少点亮1个景区'
        : `${seasonLabels[achievement.condition_desc] || '对应季节'}点亮${achievement.condition_value}个不同景区`;
    } else if (achievement.type === 'favorite') {
      displayDesc = achievement.condition_desc === 'converted'
        ? '点亮1个收藏时尚未点亮的目标'
        : achievement.condition_desc === 'active_unlit'
          ? '收藏5个尚未点亮的目标'
          : '首次收藏城市或景区';
    }
    return {
      ...achievement,
      ...getAchievementGrouping(achievement),
      display_name: achievement.name,
      display_desc: displayDesc,
      ...(progress || {}),
    };
  }));
});

router.put('/equipped', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.user!.id;
  const achievementId = Number(req.body?.achievementId);
  if (!Number.isInteger(achievementId)) return res.status(400).json({ error: '请选择有效徽章' });
  const unlocked = db.prepare('SELECT 1 FROM user_achievements WHERE user_id = ? AND achievement_id = ? LIMIT 1').get(userId, achievementId);
  if (!unlocked) return res.status(400).json({ error: '只能佩戴已解锁徽章' });
  db.prepare('UPDATE users SET equipped_achievement_id = ? WHERE id = ?').run(achievementId, userId);
  res.json({ success: true, achievementId });
});

router.delete('/equipped', authMiddleware, (req: AuthRequest, res) => {
  getDb().prepare('UPDATE users SET equipped_achievement_id = NULL WHERE id = ?').run(req.user!.id);
  res.json({ success: true });
});

export default router;
