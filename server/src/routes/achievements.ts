import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// 获取所有成就配置
router.get('/', (req, res) => {
  const db = getDb();
  const achievements = db.prepare('SELECT * FROM achievements ORDER BY type, level, id').all();
  res.json(achievements);
});

// 获取当前用户成就
router.get('/mine', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.user!.id;

  const userAchievements = db
    .prepare(
      `SELECT a.*, ua.unlocked_at
       FROM achievements a
       LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?`
    )
    .all(userId);

  res.json(userAchievements);
});

export default router;
