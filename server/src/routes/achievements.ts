import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { checkAchievements } from '../utils/achievements.js';

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
              COALESCE(counts.unlock_count, 0) as unlock_count
       FROM achievements a
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
    .all(userId, userId, userId) as any[];

  res.json(userAchievements.map((achievement) => {
    if (achievement.type === 'special' && !achievement.unlocked_at) {
      return {
        ...achievement,
        display_name: '???',
        display_desc: '继续探索，解开彩蛋成就',
      };
    }
    return {
      ...achievement,
      display_name: achievement.name,
      display_desc: achievement.condition_desc,
    };
  }));
});

export default router;
