import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { checkAchievements } from '../utils/achievements.js';

const router = Router();

const ALLOWED_PRECISIONS = new Set(['exact', 'day', 'month', 'season', 'year', 'unknown']);
const ALLOWED_SEASONS = new Set(['spring', 'summer', 'autumn', 'winter']);
const MAX_BATCH_SIZE = 100;
const SEASON_LABELS: Record<string, string> = {
  spring: '春天',
  summer: '夏天',
  autumn: '秋天',
  winter: '冬天',
};

interface NormalizedRecallItem {
  attractionId: number;
  litAt: string | null;
  timePrecision: string;
  season: string | null;
  displayTimeText: string | null;
  source: string;
}

function getLimit(value: unknown, fallback = 20, max = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.floor(parsed));
}

function attachTags(attractions: any[]) {
  const db = getDb();
  const tagStmt = db.prepare(`
    SELECT c.id, c.name
    FROM attraction_tags at
    JOIN categories c ON at.category_id = c.id
    WHERE at.attraction_id = ?
    ORDER BY c.sort_order
  `);
  for (const attraction of attractions) {
    attraction.tags = tagStmt.all(attraction.id);
    attraction.category_name = attraction.tags.map((tag: any) => tag.name).join(', ');
  }
  return attractions;
}

function normalizeDate(value: unknown) {
  if (value === undefined || value === null || value === '') return new Date().toISOString();
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function normalizePrecision(value: unknown) {
  const text = normalizeText(value, 20) || 'exact';
  return ALLOWED_PRECISIONS.has(text) ? text : 'unknown';
}

function normalizeSeason(value: unknown) {
  const text = normalizeText(value, 20);
  if (!text) return null;
  return ALLOWED_SEASONS.has(text) ? text : null;
}

function formatDisplayTimeText(litAt: string, precision: string, season: string | null, fallbackText: string | null) {
  if (fallbackText) return fallbackText;
  if (precision === 'unknown') return '时间待补充';

  const date = new Date(litAt);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  if (precision === 'month') return `${year}年${month}月`;
  if (precision === 'season') return `${year}年${SEASON_LABELS[season || ''] || '某个季节'}`;
  if (precision === 'year') return `${year}年`;
  return `${year}年${month}月${date.getUTCDate()}日`;
}

function readGuideState(userId: number) {
  const db = getDb();
  const row = db.prepare(`
    SELECT user_id, seen_at, skipped_at, completed_at, updated_at
    FROM user_recall_guides
    WHERE user_id = ?
  `).get(userId) as any;

  return {
    seen: !!row?.seen_at,
    skipped: !!row?.skipped_at,
    completed: !!row?.completed_at,
    shouldShow: !(row?.seen_at || row?.skipped_at || row?.completed_at),
    seen_at: row?.seen_at || null,
    skipped_at: row?.skipped_at || null,
    completed_at: row?.completed_at || null,
    updated_at: row?.updated_at || null,
  };
}

function markGuideState(userId: number, action: 'seen' | 'skipped' | 'completed') {
  const db = getDb();
  const column = action === 'seen' ? 'seen_at' : action === 'skipped' ? 'skipped_at' : 'completed_at';
  db.prepare(`
    INSERT INTO user_recall_guides (user_id, ${column}, updated_at)
    VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      ${column} = COALESCE(${column}, CURRENT_TIMESTAMP),
      updated_at = CURRENT_TIMESTAMP
  `).run(userId);
  return readGuideState(userId);
}

function getCitiesBaseSql(whereSql = '') {
  return `
    SELECT c.id, c.name, c.province_id, c.type, p.name as province_name,
           COUNT(a.id) as total_attractions
    FROM cities c
    JOIN provinces p ON p.id = c.province_id
    JOIN attractions a ON a.city_id = c.id AND a.status = 'approved'
    ${whereSql}
    GROUP BY c.id
  `;
}

// 热门城市：按已发布景区数排序
router.get('/cities/hot', (req, res) => {
  const db = getDb();
  const limit = getLimit(req.query.limit);
  const cities = db.prepare(`
    ${getCitiesBaseSql()}
    ORDER BY total_attractions DESC, c.id ASC
    LIMIT ?
  `).all(limit);
  res.json(cities);
});

// 城市搜索
router.get('/cities/search', (req, res) => {
  const db = getDb();
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.json([]);
    return;
  }
  const limit = getLimit(req.query.limit);
  const keyword = `%${q}%`;
  const prefix = `${q}%`;
  const cities = db.prepare(`
    ${getCitiesBaseSql('WHERE c.name LIKE ? OR p.name LIKE ?')}
    ORDER BY
      CASE
        WHEN c.name LIKE ? THEN 0
        WHEN p.name LIKE ? THEN 1
        ELSE 2
      END,
      total_attractions DESC,
      c.id ASC
    LIMIT ?
  `).all(keyword, keyword, prefix, prefix, limit);
  res.json(cities);
});

// 按省份获取城市
router.get('/provinces/:provinceId/cities', (req, res) => {
  const db = getDb();
  const provinceId = Number(req.params.provinceId);
  const province = db.prepare('SELECT id, name, code, region FROM provinces WHERE id = ?').get(provinceId);
  if (!province) {
    res.status(404).json({ error: '省份不存在' });
    return;
  }
  const cities = db.prepare(`
    SELECT c.id, c.name, c.province_id, c.type, p.name as province_name,
           COUNT(a.id) as total_attractions
    FROM cities c
    JOIN provinces p ON p.id = c.province_id
    LEFT JOIN attractions a ON a.city_id = c.id AND a.status = 'approved'
    WHERE c.province_id = ?
    GROUP BY c.id
    ORDER BY c.id ASC
  `).all(provinceId);
  res.json({ province, cities });
});

// 城市下景区列表
router.get('/cities/:cityId/attractions', (req, res) => {
  const db = getDb();
  const cityId = Number(req.params.cityId);
  const city = db.prepare(`
    SELECT c.id, c.name, c.province_id, c.type, p.name as province_name
    FROM cities c
    JOIN provinces p ON p.id = c.province_id
    WHERE c.id = ?
  `).get(cityId);
  if (!city) {
    res.status(404).json({ error: '城市不存在' });
    return;
  }
  const attractions = db.prepare(`
    SELECT a.id, a.name, a.province_id, a.city_id, a.is_5a, a.is_4a,
           CASE WHEN a.is_5a THEN '5A' WHEN a.is_4a THEN '4A' ELSE '' END as level,
           a.pinyin, p.name as province_name, c.name as city_name
    FROM attractions a
    JOIN provinces p ON p.id = a.province_id
    JOIN cities c ON c.id = a.city_id
    WHERE a.city_id = ? AND a.status = 'approved'
    ORDER BY a.is_5a DESC, a.is_4a DESC, a.pinyin ASC, a.name ASC
  `).all(cityId) as any[];
  res.json({ city, attractions: attachTags(attractions) });
});

// 找回足迹首次引导状态
router.get('/guide', authMiddleware, (req: AuthRequest, res) => {
  res.json(readGuideState(req.user!.id));
});

router.put('/guide', authMiddleware, (req: AuthRequest, res) => {
  const action = String((req.body || {}).action || '').trim();
  if (!['seen', 'skipped', 'completed'].includes(action)) {
    res.status(400).json({ error: 'action必须是seen、skipped或completed' });
    return;
  }
  res.json(markGuideState(req.user!.id, action as 'seen' | 'skipped' | 'completed'));
});

// 批量找回足迹点亮
router.post('/batch', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.user!.id;
  const body = (req.body || {}) as any;
  const rawItems = Array.isArray(body.items)
    ? body.items
    : Array.isArray(body.ids)
      ? body.ids.map((id: number) => ({ ...body, id }))
      : [];

  if (rawItems.length === 0) {
    res.status(400).json({ error: 'ids或items不能为空' });
    return;
  }
  if (rawItems.length > MAX_BATCH_SIZE) {
    res.status(400).json({ error: `单次最多找回${MAX_BATCH_SIZE}个景区` });
    return;
  }

  const items: NormalizedRecallItem[] = rawItems.map((item: any) => {
    const attractionId = Number(item.attraction_id ?? item.attractionId ?? item.id);
    const litAt = normalizeDate(item.lit_at ?? item.litAt);
    const timePrecision = normalizePrecision(item.time_precision ?? item.timePrecision);
    const season = normalizeSeason(item.season);
    return {
      attractionId,
      litAt,
      timePrecision,
      season,
      displayTimeText: litAt
        ? formatDisplayTimeText(litAt, timePrecision, season, normalizeText(item.display_time_text ?? item.displayTimeText, 80))
        : null,
      source: normalizeText(item.source, 40) || 'recall',
    };
  });

  if (items.some((item) => !Number.isInteger(item.attractionId) || item.attractionId <= 0)) {
    res.status(400).json({ error: '景区ID不合法' });
    return;
  }
  if (items.some((item) => item.litAt === null)) {
    res.status(400).json({ error: 'lit_at时间格式不合法' });
    return;
  }

  const approvedIds = db.prepare(`
    SELECT id FROM attractions
    WHERE status = 'approved' AND id IN (${items.map(() => '?').join(',')})
  `).all(...items.map((item) => item.attractionId)) as { id: number }[];
  const approvedIdSet = new Set(approvedIds.map((item) => item.id));
  const litIds: number[] = [];
  const skippedIds: number[] = [];
  const insert = db.prepare(`
    INSERT INTO user_attractions (
      user_id, attraction_id, lit_at, time_precision, season, display_time_text, source
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const item of items) {
      if (!approvedIdSet.has(item.attractionId)) {
        skippedIds.push(item.attractionId);
        continue;
      }
      insert.run(
        userId,
        item.attractionId,
        item.litAt,
        item.timePrecision,
        item.season,
        item.displayTimeText,
        item.source,
      );
      litIds.push(item.attractionId);
    }
  });
  transaction();

  const newAchievements = checkAchievements(userId);
  if (litIds.length > 0) markGuideState(userId, 'completed');
  res.json({
    success: true,
    litIds,
    skippedIds,
    newAchievements,
  });
});

export default router;
