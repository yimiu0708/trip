import { getDb } from '../db.js';

export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';

export interface V04AchievementStats {
  seasons: Record<SeasonKey, number>;
  seasonsCovered: number;
  touchedRegions: number;
  totalRegions: number;
  favoriteHistory: number;
  activeUnlitFavorites: number;
  convertedFavorites: number;
}

export function getV04AchievementStats(userId: number): V04AchievementStats {
  const db = getDb();
  const seasonRows = db.prepare(`
    WITH normalized AS (
      SELECT DISTINCT ua.attraction_id,
        CASE
          WHEN ua.time_precision IN ('year', 'unknown') THEN NULL
          WHEN ua.season IN ('spring', 'summer', 'autumn', 'winter') THEN ua.season
          WHEN CAST(strftime('%m', ua.lit_at) AS INTEGER) BETWEEN 3 AND 5 THEN 'spring'
          WHEN CAST(strftime('%m', ua.lit_at) AS INTEGER) BETWEEN 6 AND 8 THEN 'summer'
          WHEN CAST(strftime('%m', ua.lit_at) AS INTEGER) BETWEEN 9 AND 11 THEN 'autumn'
          WHEN strftime('%m', ua.lit_at) IS NOT NULL THEN 'winter'
          ELSE NULL
        END AS season_key
      FROM user_attractions ua
      JOIN attractions a ON a.id = ua.attraction_id AND a.status = 'approved'
      WHERE ua.user_id = ?
    )
    SELECT season_key, COUNT(*) AS count
    FROM normalized
    WHERE season_key IS NOT NULL
    GROUP BY season_key
  `).all(userId) as { season_key: SeasonKey; count: number }[];

  const seasons: Record<SeasonKey, number> = { spring: 0, summer: 0, autumn: 0, winter: 0 };
  seasonRows.forEach((row) => { seasons[row.season_key] = row.count; });

  const region = db.prepare(`
    SELECT
      COUNT(DISTINCT CASE WHEN ua.id IS NOT NULL THEN p.region END) AS touched,
      COUNT(DISTINCT p.region) AS total
    FROM provinces p
    LEFT JOIN attractions a ON a.province_id = p.id AND a.status = 'approved'
    LEFT JOIN user_attractions ua ON ua.attraction_id = a.id AND ua.user_id = ?
  `).get(userId) as { touched: number; total: number };

  const favorites = db.prepare(`
    SELECT
      COUNT(*) AS history,
      SUM(CASE WHEN f.deleted_at IS NULL AND NOT (
        (f.target_type = 'attraction' AND EXISTS (
          SELECT 1 FROM user_attractions ua WHERE ua.user_id = f.user_id AND ua.attraction_id = f.target_id
        )) OR
        (f.target_type = 'city' AND EXISTS (
          SELECT 1 FROM user_attractions ua
          JOIN attractions a ON a.id = ua.attraction_id AND a.status = 'approved'
          WHERE ua.user_id = f.user_id AND a.city_id = f.target_id
        ))
      ) THEN 1 ELSE 0 END) AS active_unlit,
      SUM(CASE WHEN f.first_unlit_favorited_at IS NOT NULL AND (
        (f.target_type = 'attraction' AND EXISTS (
          SELECT 1 FROM user_attractions ua
          WHERE ua.user_id = f.user_id AND ua.attraction_id = f.target_id
            AND datetime(ua.lit_at) > datetime(f.first_unlit_favorited_at)
        )) OR
        (f.target_type = 'city' AND EXISTS (
          SELECT 1 FROM user_attractions ua
          JOIN attractions a ON a.id = ua.attraction_id AND a.status = 'approved'
          WHERE ua.user_id = f.user_id AND a.city_id = f.target_id
            AND datetime(ua.lit_at) > datetime(f.first_unlit_favorited_at)
        ))
      ) THEN 1 ELSE 0 END) AS converted
    FROM user_favorites f
    WHERE f.user_id = ?
  `).get(userId) as { history: number; active_unlit: number | null; converted: number | null };

  return {
    seasons,
    seasonsCovered: Object.values(seasons).filter((count) => count > 0).length,
    touchedRegions: region.touched,
    totalRegions: region.total,
    favoriteHistory: favorites.history,
    activeUnlitFavorites: favorites.active_unlit || 0,
    convertedFavorites: favorites.converted || 0,
  };
}

export function getRegionProgress(userId: number) {
  const db = getDb();
  return db.prepare(`
    WITH province_progress AS (
      SELECT p.id, p.name, p.region,
        CASE WHEN EXISTS (
          SELECT 1 FROM attractions a
          JOIN user_attractions ua ON ua.attraction_id = a.id
          WHERE a.province_id = p.id AND a.status = 'approved' AND ua.user_id = ?
        ) THEN 1 ELSE 0 END AS is_lit
      FROM provinces p
    )
    SELECT region,
      SUM(is_lit) AS litProvinces,
      COUNT(*) AS totalProvinces,
      GROUP_CONCAT(CASE WHEN is_lit = 1 THEN name END) AS litNames,
      GROUP_CONCAT(CASE WHEN is_lit = 0 THEN name END) AS unlitNames
    FROM province_progress
    GROUP BY region
    ORDER BY region
  `).all(userId).map((row: any) => ({
    region: row.region,
    litProvinces: row.litProvinces,
    totalProvinces: row.totalProvinces,
    progress: row.totalProvinces ? Math.round(row.litProvinces / row.totalProvinces * 100) : 0,
    litProvinceNames: row.litNames ? String(row.litNames).split(',') : [],
    unlitProvinceNames: row.unlitNames ? String(row.unlitNames).split(',') : [],
  }));
}
