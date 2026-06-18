import { getDb } from '../db.js';
import {
  ATTRACTION_ACHIEVEMENTS,
  CATEGORY_LEVEL_TITLES,
  COLLECTOR_ACHIEVEMENTS,
  getAchievementCatalog,
  getCategoryThreshold,
  type AchievementDefinition,
} from './achievementCatalog.js';

interface UnlockSnapshot {
  lit?: number;
  total?: number;
  percent?: number;
  isCurrentMax?: boolean;
}

export function checkAchievements(userId: number): { id: number; name: string }[] {
  const db = getDb();
  const newAchievements: { id: number; name: string }[] = [];
  const catalog = getAchievementCatalog();

  const provinceLit = db.prepare(`
    SELECT COUNT(DISTINCT a.province_id) as count
    FROM user_attractions ua
    JOIN attractions a ON ua.attraction_id = a.id
    WHERE ua.user_id = ? AND a.status = 'approved'
  `).get(userId) as { count: number };

  const cityLit = db.prepare(`
    SELECT COUNT(DISTINCT a.city_id) as count
    FROM user_attractions ua
    JOIN attractions a ON ua.attraction_id = a.id
    WHERE ua.user_id = ? AND a.status = 'approved' AND a.city_id IS NOT NULL
  `).get(userId) as { count: number };

  const cityTotal = db.prepare(`
    SELECT COUNT(*) as count FROM cities
  `).get() as { count: number };

  const attractionLit = db.prepare(`
    SELECT COUNT(DISTINCT ua.attraction_id) as count
    FROM user_attractions ua
    JOIN attractions a ON ua.attraction_id = a.id
    WHERE ua.user_id = ? AND a.status = 'approved'
  `).get(userId) as { count: number };

  const totalApproved = db.prepare(`
    SELECT COUNT(*) as count FROM attractions WHERE status = 'approved'
  `).get() as { count: number };

  const attractionPercent = totalApproved.count > 0
    ? Math.floor((attractionLit.count / totalApproved.count) * 100)
    : 0;

  const unlockedRows = db.prepare(`
    SELECT achievement_id, snapshot_total
    FROM user_achievements
    WHERE user_id = ?
  `).all(userId) as { achievement_id: number; snapshot_total: number | null }[];
  const unlockedIds = new Set(unlockedRows.map((row) => row.achievement_id));

  const unlock = (achievement: AchievementDefinition, snapshot: UnlockSnapshot = {}) => {
    db.prepare(`
      INSERT INTO user_achievements
        (user_id, achievement_id, snapshot_lit, snapshot_total, snapshot_percent, is_current_max)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      achievement.id,
      snapshot.lit ?? null,
      snapshot.total ?? null,
      snapshot.percent ?? null,
      snapshot.isCurrentMax ? 1 : 0,
    );
    unlockedIds.add(achievement.id);
    unlockedRows.push({ achievement_id: achievement.id, snapshot_total: snapshot.total ?? null });
    newAchievements.push({ id: achievement.id, name: achievement.name });
  };

  for (const ach of catalog) {
    if (ach.type === 'province' && ach.condition_value !== null && !unlockedIds.has(ach.id)) {
      if (provinceLit.count >= ach.condition_value) {
        unlock(ach, { lit: provinceLit.count, total: 34 });
      }
    }

    if (ach.type === 'city' && ach.condition_value !== null && !unlockedIds.has(ach.id)) {
      if (cityLit.count >= ach.condition_value) {
        unlock(ach, { lit: cityLit.count, total: cityTotal.count });
      }
    }

    if (ach.type === 'attraction' && ach.condition_value !== null) {
      const isPercentLevel = (ach.level ?? 0) >= 4;
      if (!isPercentLevel && !unlockedIds.has(ach.id) && attractionLit.count >= ach.condition_value) {
        unlock(ach, { lit: attractionLit.count, total: totalApproved.count });
      }
      if (isPercentLevel && attractionPercent >= ach.condition_value) {
        const hasSameTotalRecord = unlockedRows.some((row) => (
          row.achievement_id === ach.id && row.snapshot_total === totalApproved.count
        ));
        if (!hasSameTotalRecord) {
          unlock(ach, {
            lit: attractionLit.count,
            total: totalApproved.count,
            percent: attractionPercent,
          });
        }
      }
    }
  }

  unlockCategoryAchievements(userId, unlockedIds, unlock);
  unlockSpecialAchievements(userId, catalog, unlockedIds, unlock);
  unlockCollectorAchievements(userId, catalog, unlockedIds, unlock);

  return newAchievements;
}

function unlockCategoryAchievements(
  userId: number,
  unlockedIds: Set<number>,
  unlock: (achievement: AchievementDefinition, snapshot?: UnlockSnapshot) => void,
) {
  const db = getDb();
  const categoryStats = db.prepare(`
    SELECT c.id,
           COUNT(DISTINCT ua.attraction_id) as lit,
           COUNT(DISTINCT a.id) as total
    FROM categories c
    LEFT JOIN attraction_tags at ON at.category_id = c.id
    LEFT JOIN attractions a ON a.id = at.attraction_id AND a.status = 'approved'
    LEFT JOIN user_attractions ua ON ua.attraction_id = a.id AND ua.user_id = ?
    GROUP BY c.id
  `).all(userId) as { id: number; lit: number; total: number }[];

  for (const stat of categoryStats) {
    const config = CATEGORY_LEVEL_TITLES[stat.id];
    if (!config || stat.total <= 0) continue;

    for (let level = 1; level <= config.titles.length; level += 1) {
      const threshold = getCategoryThreshold(stat.total, level);
      const achievementId = 1000 + stat.id * 100 + level;
      if (unlockedIds.has(achievementId) || stat.lit < threshold) continue;
      unlock({
        id: achievementId,
        name: config.titles[level - 1],
        type: 'category',
        level,
        condition_value: stat.id,
        condition_desc: `${config.line} Lv.${level}`,
        icon: '🏅',
        badge_style: level >= 10 ? 'mythic category' : 'category',
      }, {
        lit: stat.lit,
        total: stat.total,
        percent: stat.total > 0 ? Math.floor((stat.lit / stat.total) * 100) : 0,
        isCurrentMax: level === 10,
      });
    }
  }
}

function unlockSpecialAchievements(
  userId: number,
  catalog: AchievementDefinition[],
  unlockedIds: Set<number>,
  unlock: (achievement: AchievementDefinition, snapshot?: UnlockSnapshot) => void,
) {
  for (const ach of catalog.filter((item) => item.type === 'special')) {
    if (unlockedIds.has(ach.id)) continue;
    if (checkSpecialAchievement(userId, ach.condition_desc)) {
      unlock(ach);
    }
  }
}

function unlockCollectorAchievements(
  userId: number,
  catalog: AchievementDefinition[],
  unlockedIds: Set<number>,
  unlock: (achievement: AchievementDefinition, snapshot?: UnlockSnapshot) => void,
) {
  const unlockedBadgeCount = catalog.filter((achievement) => (
    unlockedIds.has(achievement.id) && achievement.type !== 'collector'
  )).length;
  const publishedBadgeCount = catalog.filter((achievement) => achievement.type !== 'collector').length;

  for (const ach of COLLECTOR_ACHIEVEMENTS) {
    if (unlockedIds.has(ach.id)) continue;
    const target = ach.condition_value ?? publishedBadgeCount;
    if (unlockedBadgeCount >= target) {
      unlock(ach, { lit: unlockedBadgeCount, total: publishedBadgeCount });
    }
  }
}

function checkSpecialAchievement(userId: number, conditionDesc: string): boolean {
  const db = getDb();

  if (conditionDesc === 'first_lit') {
    const count = db.prepare(`
      SELECT COUNT(DISTINCT ua.attraction_id) as c
      FROM user_attractions ua
      JOIN attractions a ON ua.attraction_id = a.id
      WHERE ua.user_id = ? AND a.status = 'approved'
    `).get(userId) as { c: number };
    return count.c >= 1;
  }

  if (conditionDesc === '7days_10lit') {
    const row = db.prepare(`
      SELECT COUNT(DISTINCT ua.attraction_id) as c
      FROM users u
      JOIN user_attractions ua ON ua.user_id = u.id
      JOIN attractions a ON ua.attraction_id = a.id
      WHERE u.id = ?
        AND a.status = 'approved'
        AND julianday(ua.lit_at) - julianday(u.created_at) <= 7
    `).get(userId) as { c: number };
    return row.c >= 10;
  }

  if (conditionDesc === 'night_7days') {
    const rows = db.prepare(`
      SELECT date(ua.lit_at) as d
      FROM user_attractions ua
      JOIN attractions a ON ua.attraction_id = a.id
      WHERE ua.user_id = ? AND a.status = 'approved' AND CAST(strftime('%H', ua.lit_at) AS INTEGER) >= 20
      GROUP BY date(ua.lit_at)
      ORDER BY d
    `).all(userId) as { d: string }[];
    return hasConsecutiveDates(rows.map((row) => row.d), 7);
  }

  if (conditionDesc === 'full_category') {
    const rows = db.prepare(`
      SELECT c.id
      FROM categories c
      LEFT JOIN attraction_tags at ON at.category_id = c.id
      LEFT JOIN attractions a ON a.id = at.attraction_id AND a.status = 'approved'
      LEFT JOIN user_attractions ua ON ua.attraction_id = a.id AND ua.user_id = ?
      GROUP BY c.id
      HAVING COUNT(DISTINCT a.id) > 0 AND COUNT(DISTINCT ua.attraction_id) = COUNT(DISTINCT a.id)
      LIMIT 1
    `).all(userId) as { id: number }[];
    return rows.length > 0;
  }

  if (conditionDesc === 'full_province') {
    const rows = db.prepare(`
      SELECT p.id
      FROM provinces p
      LEFT JOIN attractions a ON a.province_id = p.id AND a.status = 'approved'
      LEFT JOIN user_attractions ua ON ua.attraction_id = a.id AND ua.user_id = ?
      GROUP BY p.id
      HAVING COUNT(DISTINCT a.id) > 0 AND COUNT(DISTINCT ua.attraction_id) = COUNT(DISTINCT a.id)
      LIMIT 1
    `).all(userId) as { id: number }[];
    return rows.length > 0;
  }

  if (conditionDesc === '1year_10lit') {
    const row = db.prepare(`
      SELECT (julianday('now') - julianday(u.created_at)) as age_days,
             COUNT(DISTINCT ua.attraction_id) as lit
      FROM users u
      LEFT JOIN user_attractions ua ON ua.user_id = u.id
      LEFT JOIN attractions a ON ua.attraction_id = a.id AND a.status = 'approved'
      WHERE u.id = ?
      GROUP BY u.id
    `).get(userId) as { age_days: number; lit: number } | undefined;
    return !!row && row.age_days >= 365 && row.lit >= 10;
  }

  if (conditionDesc === '30days_streak') {
    const rows = db.prepare(`
      SELECT date(ua.lit_at) as d
      FROM user_attractions ua
      JOIN attractions a ON ua.attraction_id = a.id
      WHERE ua.user_id = ? AND a.status = 'approved'
      GROUP BY date(ua.lit_at)
      ORDER BY d
    `).all(userId) as { d: string }[];
    return hasConsecutiveDates(rows.map((row) => row.d), 30);
  }

  if (conditionDesc === 'first_city') {
    const row = db.prepare(`
      SELECT COUNT(DISTINCT a.city_id) as c
      FROM user_attractions ua
      JOIN attractions a ON ua.attraction_id = a.id
      WHERE ua.user_id = ? AND a.status = 'approved' AND a.city_id IS NOT NULL
    `).get(userId) as { c: number };
    return row.c >= 1;
  }

  if (conditionDesc === 'first_category') {
    const row = db.prepare(`
      SELECT COUNT(DISTINCT at.category_id) as c
      FROM user_attractions ua
      JOIN attractions a ON ua.attraction_id = a.id AND a.status = 'approved'
      JOIN attraction_tags at ON at.attraction_id = a.id
      WHERE ua.user_id = ?
    `).get(userId) as { c: number };
    return row.c >= 1;
  }

  if (conditionDesc === 'first_upload_approved') {
    const row = db.prepare(`
      SELECT COUNT(*) as c
      FROM attractions
      WHERE created_by = ? AND status = 'approved'
    `).get(userId) as { c: number };
    return row.c >= 1;
  }

  return false;
}

function hasConsecutiveDates(dates: string[], target: number) {
  if (dates.length < target) return false;
  let streak = 1;
  for (let index = 1; index < dates.length; index += 1) {
    const prev = new Date(`${dates[index - 1]}T00:00:00Z`).getTime();
    const next = new Date(`${dates[index]}T00:00:00Z`).getTime();
    const diffDays = Math.round((next - prev) / 86400000);
    streak = diffDays === 1 ? streak + 1 : 1;
    if (streak >= target) return true;
  }
  return false;
}

export function isAttractionPercentAchievement(achievementId: number) {
  return ATTRACTION_ACHIEVEMENTS.some((achievement) => (
    achievement.id === achievementId && (achievement.level ?? 0) >= 4
  ));
}
