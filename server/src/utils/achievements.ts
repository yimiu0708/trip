import { getDb } from '../db.js';

export function checkAchievements(userId: number): { id: number; name: string }[] {
  const db = getDb();
  const newAchievements: { id: number; name: string }[] = [];

  // 省份点亮数
  const provinceLit = db.prepare(`
    SELECT COUNT(DISTINCT a.province_id) as count
    FROM user_attractions ua
    JOIN attractions a ON ua.attraction_id = a.id
    WHERE ua.user_id = ?
  `).get(userId) as { count: number };

  // 景区点亮数（去重：同一景区多次点亮只算一次）
  const attractionLit = db.prepare(`
    SELECT COUNT(DISTINCT attraction_id) as count FROM user_attractions WHERE user_id = ?
  `).get(userId) as { count: number };

  // 获取所有成就配置
  const achievements = db.prepare('SELECT * FROM achievements').all() as {
    id: number;
    name: string;
    type: string;
    level: number | null;
    condition_value: number | null;
    condition_desc: string;
  }[];

  // 获取已解锁成就
  const unlocked = new Set(
    (db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?').all(userId) as { achievement_id: number }[])
      .map((u) => u.achievement_id)
  );

  for (const ach of achievements) {
    if (unlocked.has(ach.id)) continue;

    let shouldUnlock = false;
    if (ach.type === 'province' && ach.condition_value !== null) {
      shouldUnlock = provinceLit.count >= ach.condition_value;
    } else if (ach.type === 'attraction' && ach.condition_value !== null) {
      shouldUnlock = attractionLit.count >= ach.condition_value;
    } else if (ach.type === 'special') {
      shouldUnlock = checkSpecialAchievement(userId, ach.id, ach.condition_desc);
    }

    if (shouldUnlock) {
      db.prepare('INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)').run(userId, ach.id);
      newAchievements.push({ id: ach.id, name: ach.name });
    }
  }

  return newAchievements;
}

function checkSpecialAchievement(userId: number, achievementId: number, conditionDesc: string): boolean {
  const db = getDb();

  // 旅途起点: 首次点亮
  if (achievementId === 101) {
    const count = db.prepare('SELECT COUNT(DISTINCT attraction_id) as c FROM user_attractions WHERE user_id = ?').get(userId) as { c: number };
    return count.c >= 1;
  }

  // 夜游神: 同一天点亮5个不同省份的景区
  if (achievementId === 103) {
    const rows = db.prepare(`
      SELECT COUNT(DISTINCT a.province_id) as c
      FROM user_attractions ua
      JOIN attractions a ON ua.attraction_id = a.id
      WHERE ua.user_id = ?
      GROUP BY date(ua.lit_at)
      HAVING c >= 5
      LIMIT 1
    `).all(userId) as { c: number }[];
    return rows.length > 0;
  }

  // 分类大师: 某一分类下点亮所有景区
  if (achievementId === 104) {
    const rows = db.prepare(`
      SELECT c.id, COUNT(DISTINCT ua.attraction_id) as lit, COUNT(DISTINCT a.id) as total
      FROM categories c
      LEFT JOIN attractions a ON a.category_id = c.id
      LEFT JOIN user_attractions ua ON ua.attraction_id = a.id AND ua.user_id = ?
      GROUP BY c.id
      HAVING lit > 0 AND lit = total
      LIMIT 1
    `).all(userId) as { id: number }[];
    return rows.length > 0;
  }

  // 完美省份: 某一省份的所有景区全部点亮
  if (achievementId === 105) {
    const rows = db.prepare(`
      SELECT p.id, COUNT(DISTINCT ua.attraction_id) as lit, COUNT(DISTINCT a.id) as total
      FROM provinces p
      LEFT JOIN attractions a ON a.province_id = p.id
      LEFT JOIN user_attractions ua ON ua.attraction_id = a.id AND ua.user_id = ?
      GROUP BY p.id
      HAVING total > 0 AND lit = total
      LIMIT 1
    `).all(userId) as { id: number }[];
    return rows.length > 0;
  }

  // 5A征服者: 点亮所有5A级景区（去重）
  if (achievementId === 106) {
    const total5A = db.prepare("SELECT COUNT(*) as c FROM attractions WHERE level = '5A'").get() as { c: number };
    const lit5A = db.prepare(`
      SELECT COUNT(DISTINCT ua.attraction_id) as c FROM user_attractions ua
      JOIN attractions a ON ua.attraction_id = a.id
      WHERE ua.user_id = ? AND a.level = '5A'
    `).get(userId) as { c: number };
    return lit5A.c >= total5A.c && total5A.c > 0;
  }

  return false;
}
