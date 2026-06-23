import { getDb } from '../db.js';
import { getV04AchievementStats, type SeasonKey } from './v04Achievements.js';

export interface NextTripRecommendation {
  id: string;
  recommendationType: string;
  targetType: 'city' | 'attraction';
  targetId: number;
  title: string;
  reason: string;
  tags: string[];
  progress: number;
  isLit: boolean;
  isFavorited: boolean;
  favoriteId: number | null;
  actionText: string;
  actionRoute: string;
}

const SEASON_LABELS: Record<SeasonKey, string> = {
  spring: '春日', summer: '盛夏', autumn: '秋天', winter: '冬日',
};

export function getNextTripRecommendations(userId: number | undefined, source: string, limit: number, sourceCityIds: number[] = []) {
  const pools: NextTripRecommendation[][] = [];
  if (userId) {
    pools.push(getFavoriteCandidates(userId));
    pools.push(getAchievementCandidates(userId));
    pools.push(getCompletionCandidates(userId, sourceCityIds));
    pools.push(getRegionCandidates(userId));
  }
  pools.push(getFallbackCandidates(userId));

  const excludedFavorites = source === 'favorites' && userId
    ? new Set(getDb().prepare(`SELECT target_type || ':' || target_id AS key FROM user_favorites WHERE user_id = ? AND deleted_at IS NULL`).all(userId).map((row: any) => row.key))
    : new Set<string>();
  const selected: NextTripRecommendation[] = [];
  const seen = new Set<string>();
  const add = (item?: NextTripRecommendation) => {
    if (!item) return;
    const key = `${item.targetType}:${item.targetId}`;
    if (seen.has(key) || excludedFavorites.has(key)) return;
    seen.add(key);
    selected.push(item);
  };

  pools.forEach((pool) => add(pool[0]));
  for (const pool of pools) {
    for (const item of pool.slice(1)) {
      if (selected.length >= limit) break;
      add(item);
    }
  }
  return selected.slice(0, limit);
}

function getFavoriteCandidates(userId: number): NextTripRecommendation[] {
  const rows = getDb().prepare(`
    SELECT f.id AS favoriteId, f.target_type AS targetType, f.target_id AS targetId,
      COALESCE(a.name, c.name) AS name,
      COALESCE(a.city_id, c.id) AS cityId,
      COALESCE(a.province_id, c.province_id) AS provinceId,
      p.name AS provinceName,
      CASE WHEN f.target_type = 'attraction' THEN EXISTS(
        SELECT 1 FROM user_attractions ua WHERE ua.user_id = f.user_id AND ua.attraction_id = f.target_id
      ) ELSE EXISTS(
        SELECT 1 FROM user_attractions ua JOIN attractions ca ON ca.id = ua.attraction_id
        WHERE ua.user_id = f.user_id AND ca.city_id = f.target_id
      ) END AS isLit
    FROM user_favorites f
    LEFT JOIN attractions a ON f.target_type = 'attraction' AND a.id = f.target_id AND a.status = 'approved'
    LEFT JOIN cities c ON f.target_type = 'city' AND c.id = f.target_id
    JOIN provinces p ON p.id = COALESCE(a.province_id, c.province_id)
    WHERE f.user_id = ? AND f.deleted_at IS NULL
    ORDER BY isLit, f.last_favorited_at DESC, f.id DESC
  `).all(userId) as any[];
  return rows.filter((row) => !row.isLit).map((row) => makeItem({
    ...row,
    recommendationType: 'favorite',
    title: `把${row.name}放进下一次出发`,
    reason: `你已经收藏了这里，下一步可以从${row.provinceName}开始安排。`,
    tags: ['已收藏', row.provinceName],
    isFavorited: true,
  }));
}

function getCompletionCandidates(userId: number, sourceCityIds: number[]): NextTripRecommendation[] {
  const sourceSet = new Set(sourceCityIds);
  const rows = getDb().prepare(`
    SELECT c.id AS targetId, c.id AS cityId, c.province_id AS provinceId, c.name, p.name AS provinceName, p.region,
      COUNT(DISTINCT a.id) AS totalCount, COUNT(DISTINCT ua.attraction_id) AS litCount
    FROM cities c
    JOIN provinces p ON p.id = c.province_id
    JOIN attractions a ON a.city_id = c.id AND a.status = 'approved'
    LEFT JOIN user_attractions ua ON ua.attraction_id = a.id AND ua.user_id = ?
    GROUP BY c.id
    HAVING litCount > 0 AND litCount < totalCount
      AND ((litCount * 1.0 / totalCount) >= 0.7 OR (totalCount - litCount) <= 2)
  `).all(userId) as any[];
  return rows.sort((a, b) => Number(sourceSet.has(b.targetId)) - Number(sourceSet.has(a.targetId))
    || (b.litCount / b.totalCount) - (a.litCount / a.totalCount)
    || a.targetId - b.targetId).map((row) => {
      const progress = Math.round(row.litCount / row.totalCount * 100);
      return makeItem({
        ...row,
        targetType: 'city', recommendationType: 'completion',
        title: `${row.name}快点亮完整了`,
        reason: `已点亮 ${row.litCount}/${row.totalCount} 个景区，还差 ${row.totalCount - row.litCount} 个。`,
        tags: ['快完成', row.region, `城市进度 ${progress}%`], progress,
      }, userId);
    });
}

function getAchievementCandidates(userId: number): NextTripRecommendation[] {
  const stats = getV04AchievementStats(userId);
  const missing = (Object.entries(stats.seasons) as [SeasonKey, number][])
    .sort((a, b) => b[1] - a[1])
    .find(([, count]) => count < 3)?.[0];
  if (!missing) return [];
  const target = getFallbackCityRows(userId)[0];
  if (!target) return [];
  return [makeItem({
    ...target,
    targetType: 'city', recommendationType: 'season',
    title: `${SEASON_LABELS[missing]}的下一站`,
    reason: `可以把${target.name}安排进一次${SEASON_LABELS[missing]}出发，同时推进季节足迹。`,
    tags: [SEASON_LABELS[missing], '季节成就'],
  }, userId)];
}

function getRegionCandidates(userId: number): NextTripRecommendation[] {
  const rows = getDb().prepare(`
    WITH touched AS (
      SELECT DISTINCT p.region FROM user_attractions ua
      JOIN attractions a ON a.id = ua.attraction_id AND a.status = 'approved'
      JOIN provinces p ON p.id = a.province_id
      WHERE ua.user_id = ?
    )
    SELECT c.id AS targetId, c.id AS cityId, c.province_id AS provinceId, c.name, p.name AS provinceName, p.region,
      SUM(CASE WHEN a.is_5a THEN 1 ELSE 0 END) AS fiveACount,
      COUNT(a.id) AS totalCount
    FROM cities c
    JOIN provinces p ON p.id = c.province_id
    JOIN attractions a ON a.city_id = c.id AND a.status = 'approved'
    LEFT JOIN touched t ON t.region = p.region
    WHERE t.region IS NULL
    GROUP BY c.id
    ORDER BY fiveACount DESC, totalCount DESC, c.id
  `).all(userId) as any[];
  return rows.map((row) => makeItem({
    ...row,
    targetType: 'city', recommendationType: 'region',
    title: `从${row.name}开启${row.region}`,
    reason: `你还没有点亮${row.region}，可以先把${row.name}加入下一次计划。`,
    tags: ['八方巡游', row.region, row.provinceName],
  }, userId));
}

function getFallbackCandidates(userId?: number): NextTripRecommendation[] {
  return getFallbackCityRows(userId).map((row) => makeItem({
    ...row,
    targetType: 'city', recommendationType: 'popular',
    title: `下一次去${row.name}`,
    reason: `${row.name}有 ${row.fiveACount} 个 5A 景区，可以从一座城市开始认识${row.provinceName}。`,
    tags: ['5A目的地', row.region, row.provinceName],
  }, userId));
}

function getFallbackCityRows(userId?: number) {
  return getDb().prepare(`
    SELECT c.id AS targetId, c.id AS cityId, c.province_id AS provinceId, c.name, p.name AS provinceName, p.region,
      SUM(CASE WHEN a.is_5a THEN 1 ELSE 0 END) AS fiveACount, COUNT(a.id) AS totalCount
    FROM cities c
    JOIN provinces p ON p.id = c.province_id
    JOIN attractions a ON a.city_id = c.id AND a.status = 'approved'
    WHERE (? IS NULL OR NOT EXISTS (
      SELECT 1 FROM user_attractions ua JOIN attractions la ON la.id = ua.attraction_id
      WHERE ua.user_id = ? AND la.city_id = c.id
    ))
    GROUP BY c.id
    HAVING fiveACount > 0
    ORDER BY fiveACount DESC, totalCount DESC, c.id
    LIMIT 12
  `).all(userId ?? null, userId ?? null) as any[];
}

function makeItem(data: any, userId?: number): NextTripRecommendation {
  const targetType = data.targetType as 'city' | 'attraction';
  const targetId = Number(data.targetId);
  const favorite = userId ? getDb().prepare(`
    SELECT id FROM user_favorites
    WHERE user_id = ? AND target_type = ? AND target_id = ? AND deleted_at IS NULL
  `).get(userId, targetType, targetId) as { id: number } | undefined : undefined;
  const cityId = Number(data.cityId || targetId);
  const route = targetType === 'attraction'
    ? `/province/${data.provinceId}/cities/${cityId}?highlight=${targetId}`
    : `/province/${data.provinceId}/cities/${cityId}`;
  return {
    id: `${data.recommendationType}:${targetType}:${targetId}`,
    recommendationType: data.recommendationType,
    targetType,
    targetId,
    title: data.title,
    reason: data.reason,
    tags: data.tags || [],
    progress: Number(data.progress || 0),
    isLit: !!data.isLit,
    isFavorited: !!favorite || !!data.isFavorited,
    favoriteId: favorite?.id || data.favoriteId || null,
    actionText: targetType === 'city' ? '查看城市' : '查看景区',
    actionRoute: route,
  };
}
