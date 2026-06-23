import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const databasePath = path.join(os.tmpdir(), `trip-v04-${process.pid}.sqlite`);
process.env.DATABASE_PATH = databasePath;

const { initDb, getDb } = await import('../db.js');
const { getV04AchievementStats, getRegionProgress } = await import('./v04Achievements.js');
const { getNextTripRecommendations } = await import('./nextTripRecommendations.js');

const db = initDb();
db.exec(`
  INSERT INTO provinces (id, name, code, region) VALUES
    (901, '测试甲省', 'T1', '东境'),
    (902, '测试乙省', 'T2', '西境');
  INSERT INTO cities (id, name, province_id, type) VALUES
    (901, '甲城', 901, 'city'),
    (902, '乙城', 902, 'city'),
    (903, '丙城', 901, 'city');
  INSERT INTO attractions (id, name, province_id, city_id, is_5a, level, status) VALUES
    (901, '甲景一', 901, 901, 1, '5A', 'approved'),
    (902, '甲景二', 901, 901, 0, NULL, 'approved'),
    (903, '甲景三', 901, 901, 0, NULL, 'approved'),
    (904, '乙景一', 902, 902, 1, '5A', 'approved'),
    (905, '丙景一', 901, 903, 1, '5A', 'approved'),
    (906, '丙景二', 901, 903, 0, NULL, 'approved'),
    (907, '丙景三', 901, 903, 0, NULL, 'approved');
  INSERT INTO users (id, username, password_hash, role) VALUES (901, 'v04-test', 'x', 'user');
`);

after(() => {
  getDb().close();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${databasePath}${suffix}`, { force: true });
});

test('season precision excludes year-only records and deduplicates attractions', () => {
  db.exec(`
    INSERT INTO user_attractions (user_id, attraction_id, lit_at, time_precision, season) VALUES
      (901, 901, '2025-04-10T12:00:00Z', 'exact', NULL),
      (901, 901, '2026-04-10T12:00:00Z', 'exact', NULL),
      (901, 902, '2025-07-10T12:00:00Z', 'season', 'summer'),
      (901, 903, '2025-10-10T12:00:00Z', 'year', 'autumn');
  `);
  const stats = getV04AchievementStats(901);
  assert.equal(stats.seasons.spring, 1);
  assert.equal(stats.seasons.summer, 1);
  assert.equal(stats.seasons.autumn, 0);
  assert.equal(stats.seasonsCovered, 2);
});

test('region progress treats any lit province as a touched region', () => {
  const rows = getRegionProgress(901);
  const east = rows.find((item: any) => item.region === '东境');
  assert.equal(east?.litProvinces, 1);
  assert.equal(east?.totalProvinces, 1);
  assert.equal(east?.progress, 100);
});

test('favorite history converts only after a later lighting record', () => {
  db.exec(`
    INSERT INTO user_favorites (
      user_id, target_type, target_id, source, first_favorited_at,
      last_favorited_at, first_unlit_favorited_at, deleted_at
    ) VALUES (901, 'attraction', 904, 'test', '2025-01-01', '2025-01-01', '2025-01-01', '2025-01-02');
  `);
  assert.equal(getV04AchievementStats(901).convertedFavorites, 0);
  db.prepare(`INSERT INTO user_attractions (user_id, attraction_id, lit_at, time_precision) VALUES (901, 904, '2025-02-01', 'exact')`).run();
  assert.equal(getV04AchievementStats(901).convertedFavorites, 1);
  assert.equal(getV04AchievementStats(901).favoriteHistory, 1);
});

test('recommendations are target-deduplicated and include completion candidates', () => {
  db.prepare(`INSERT INTO user_attractions (user_id, attraction_id, lit_at, time_precision) VALUES (901, 905, '2025-03-01', 'exact')`).run();
  const items = getNextTripRecommendations(901, 'home', 3, [903]);
  assert.equal(new Set(items.map((item: any) => `${item.targetType}:${item.targetId}`)).size, items.length);
  assert.ok(items.some((item: any) => item.recommendationType === 'completion'));
  assert.ok(items.every((item: any) => ['city', 'attraction'].includes(item.targetType)));
});

test('guest recommendations are stable 5A city targets', () => {
  const first = getNextTripRecommendations(undefined, 'home', 2);
  const second = getNextTripRecommendations(undefined, 'home', 2);
  assert.deepEqual(first.map((item: any) => item.id), second.map((item: any) => item.id));
  assert.ok(first.every((item: any) => item.targetType === 'city'));
});
