import { getDb } from '../db.js';
import { getAchievementCatalog, getCategoryThreshold } from './achievementCatalog.js';
import { getV04AchievementStats } from './v04Achievements.js';

export interface AchievementProgress {
  current: number;
  target: number;
  remaining: number;
  progress: number;
  unit: string;
}

export interface NextGoal extends AchievementProgress {
  type: 'achievement' | 'city_completion' | 'province_completion' | 'attraction_milestone' | 'city_milestone';
  title: string;
  description: string;
  recommendation: string;
  actionText: string;
  actionRoute: string;
  icon?: string;
}

type NumericStats = {
  provinces: number;
  cities: number;
  attractions: number;
  totalAttractions: number;
  unlocked: number;
  published: number;
  categories: Map<number, { lit: number; total: number }>;
};

function getNumericStats(userId: number): NumericStats {
  const db = getDb();
  const footprint = db.prepare(`
    SELECT COUNT(DISTINCT a.province_id) AS provinces,
           COUNT(DISTINCT a.city_id) AS cities,
           COUNT(DISTINCT ua.attraction_id) AS attractions
    FROM user_attractions ua
    JOIN attractions a ON a.id = ua.attraction_id
    WHERE ua.user_id = ? AND a.status = 'approved'
  `).get(userId) as { provinces: number; cities: number; attractions: number };
  const totalAttractions = (db.prepare("SELECT COUNT(*) AS count FROM attractions WHERE status = 'approved'").get() as { count: number }).count;
  const unlocked = (db.prepare('SELECT COUNT(DISTINCT achievement_id) AS count FROM user_achievements WHERE user_id = ?').get(userId) as { count: number }).count;
  const catalog = getAchievementCatalog();
  const published = catalog.filter((item) => item.type !== 'collector' && !item.badge_style.includes('personality')).length;
  const categoryRows = db.prepare(`
    SELECT c.id, COUNT(DISTINCT ua.attraction_id) AS lit, COUNT(DISTINCT a.id) AS total
    FROM categories c
    LEFT JOIN attraction_tags at ON at.category_id = c.id
    LEFT JOIN attractions a ON a.id = at.attraction_id AND a.status = 'approved'
    LEFT JOIN user_attractions ua ON ua.attraction_id = a.id AND ua.user_id = ?
    GROUP BY c.id
  `).all(userId) as { id: number; lit: number; total: number }[];
  return {
    ...footprint,
    totalAttractions,
    unlocked,
    published,
    categories: new Map(categoryRows.map((row) => [row.id, row])),
  };
}

export function getAchievementProgress(userId: number, achievement: any): AchievementProgress | null {
  if (achievement.unlocked_at) return null;
  const stats = getNumericStats(userId);
  let current = 0;
  let target = Number(achievement.condition_value || 0);
  let unit = '个景区';

  if (achievement.type === 'province') {
    current = stats.provinces;
    unit = '个省份';
  } else if (achievement.type === 'city') {
    current = stats.cities;
    unit = '座城市';
  } else if (achievement.type === 'attraction') {
    if (Number(achievement.level || 0) >= 4) {
      current = stats.totalAttractions > 0 ? Math.floor(stats.attractions / stats.totalAttractions * 100) : 0;
      unit = '%';
    } else {
      current = stats.attractions;
    }
  } else if (achievement.type === 'category') {
    const category = stats.categories.get(Number(achievement.condition_value));
    if (!category || category.total <= 0) return null;
    current = category.lit;
    target = getCategoryThreshold(category.total, Number(achievement.level || 1));
  } else if (achievement.type === 'collector') {
    current = stats.unlocked;
    target = target || stats.published;
    unit = '枚成就';
  } else if (achievement.type === 'season') {
    const v04 = getV04AchievementStats(userId);
    current = achievement.condition_desc === 'all_seasons'
      ? v04.seasonsCovered
      : v04.seasons[achievement.condition_desc as keyof typeof v04.seasons] || 0;
    unit = achievement.condition_desc === 'all_seasons' ? '个季节' : '个景区';
  } else if (achievement.type === 'region') {
    const v04 = getV04AchievementStats(userId);
    current = v04.touchedRegions;
    target = Number(achievement.level) === 4 ? v04.totalRegions : target;
    unit = '个片区';
  } else if (achievement.type === 'favorite') {
    const v04 = getV04AchievementStats(userId);
    current = achievement.condition_desc === 'converted'
      ? v04.convertedFavorites
      : achievement.condition_desc === 'active_unlit'
        ? v04.activeUnlitFavorites
        : v04.favoriteHistory;
    unit = '个目标';
  } else {
    return null;
  }

  const remaining = Math.max(0, target - current);
  return {
    current,
    target,
    remaining,
    progress: target > 0 ? Math.min(100, Math.round(current / target * 100)) : 0,
    unit,
  };
}

export function getNextGoal(userId: number): NextGoal {
  const db = getDb();
  const achievements = db.prepare(`
    SELECT a.*, ua.unlocked_at
    FROM achievements a
    LEFT JOIN (
      SELECT achievement_id, MAX(unlocked_at) AS unlocked_at
      FROM user_achievements WHERE user_id = ? GROUP BY achievement_id
    ) ua ON ua.achievement_id = a.id
  `).all(userId) as any[];

  const candidates = achievements
    .map((achievement) => ({ achievement, progress: getAchievementProgress(userId, achievement) }))
    .filter((item): item is { achievement: any; progress: AchievementProgress } => !!item.progress && item.progress.remaining > 0)
    .sort((a, b) => b.progress.progress - a.progress.progress || a.progress.remaining - b.progress.remaining);

  const next = candidates[0];
  if (!next) {
    return {
      type: 'achievement', title: '先点亮第一个熟悉的城市', description: '从你去过的地方开始，识界会帮你记录旅行进度。',
      current: 0, target: 1, remaining: 1, progress: 0, unit: '座城市', recommendation: '从最熟悉的城市开始', actionText: '开始点亮', actionRoute: '/recall/cities',
    };
  }
  const { achievement, progress } = next;
  const seasonRoute = achievement.type === 'season' && achievement.condition_desc !== 'all_seasons'
    ? `/recall/cities?season=${achievement.condition_desc}`
    : '/recall/cities';
  return {
    type: 'achievement', title: achievement.name, description: achievement.condition_desc,
    ...progress, icon: achievement.icon,
    recommendation: achievement.type === 'category' ? '继续点亮对应分类景区'
      : achievement.type === 'season' ? '补录对应季节的旅行足迹'
        : achievement.type === 'favorite' ? '从收藏的地方开始下一次出发'
          : achievement.type === 'region' ? '选择一个尚未点亮的片区'
            : '继续点亮你去过的城市',
    actionText: achievement.type === 'favorite' ? '查看收藏' : '继续点亮',
    actionRoute: achievement.type === 'favorite' ? '/favorites' : achievement.type === 'region' ? '/map' : seasonRoute,
  };
}

export function getLightingRecommendations(userId: number, sourceCityIds: number[] = [], limit = 3) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.id, c.name, c.province_id, p.name AS province_name,
           COUNT(DISTINCT ua.attraction_id) AS lit_count,
           COUNT(DISTINCT a.id) AS total_count
    FROM cities c
    JOIN provinces p ON p.id = c.province_id
    LEFT JOIN attractions a ON a.city_id = c.id AND a.status = 'approved'
    LEFT JOIN user_attractions ua ON ua.attraction_id = a.id AND ua.user_id = ?
    GROUP BY c.id
    HAVING lit_count > 0 AND total_count > lit_count
  `).all(userId) as any[];
  const sourceSet = new Set(sourceCityIds);
  const items = rows
    .sort((a, b) => Number(sourceSet.has(b.id)) - Number(sourceSet.has(a.id))
      || (b.lit_count / b.total_count) - (a.lit_count / a.total_count)
      || (a.total_count - a.lit_count) - (b.total_count - b.lit_count))
    .slice(0, Math.max(1, Math.min(3, limit)))
    .map((row) => {
      const remaining = row.total_count - row.lit_count;
      const progress = Math.round(row.lit_count / row.total_count * 100);
      return {
        type: 'city', title: remaining <= 2 ? `快完成${row.name}了` : `继续点亮${row.name}`,
        reason: `已点亮 ${row.lit_count}/${row.total_count} 个景区，还差 ${remaining} 个`,
        progress, tags: [`还差 ${remaining} 个`, `城市进度 ${progress}%`], actionText: '继续点亮',
        actionRoute: `/province/${row.province_id}/cities/${row.id}`, cityId: row.id, provinceName: row.province_name,
      };
    });
  if (items.length) return items;
  return [{
    type: 'map', title: '从地图继续探索', reason: '选择一个去过的省份，继续补录旅行足迹', progress: 0,
    tags: ['地图推荐'], actionText: '选择省份', actionRoute: '/map',
  }];
}
