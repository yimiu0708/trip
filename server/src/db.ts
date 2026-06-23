import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAchievementCatalog } from './utils/achievementCatalog.js';
import { PERSONALITY_CATALOG } from './utils/personalityCatalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/database.sqlite');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function initDb() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS provinces (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      region TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cities (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      province_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      UNIQUE(name, province_id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS attractions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      province_id INTEGER NOT NULL,
      city_id INTEGER NOT NULL,
      is_5a INTEGER DEFAULT 0,
      is_4a INTEGER DEFAULT 0,
      level TEXT CHECK(level IN ('4A', '5A')),
      category_id INTEGER,
      pinyin TEXT,
      created_by INTEGER DEFAULT NULL,
      status TEXT DEFAULT 'approved' CHECK(status IN ('pending', 'approved', 'rejected')),
      UNIQUE(name, province_id)
    );

    CREATE TABLE IF NOT EXISTS attraction_tags (
      attraction_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      PRIMARY KEY (attraction_id, category_id),
      FOREIGN KEY (attraction_id) REFERENCES attractions(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_attractions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      attraction_id INTEGER NOT NULL,
      lit_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      time_precision TEXT DEFAULT 'exact',
      season TEXT,
      display_time_text TEXT,
      source TEXT DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS user_recall_guides (
      user_id INTEGER PRIMARY KEY,
      seen_at TIMESTAMP,
      skipped_at TIMESTAMP,
      completed_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      target_type TEXT NOT NULL CHECK(target_type IN ('city', 'attraction')),
      target_id INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      first_favorited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_favorited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      first_unlit_favorited_at TIMESTAMP,
      deleted_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, target_type, target_id)
    );

    CREATE TABLE IF NOT EXISTS travel_personality_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      type_code TEXT NOT NULL,
      type_name TEXT NOT NULL,
      dimension_decision TEXT NOT NULL,
      dimension_pace TEXT NOT NULL,
      dimension_interest TEXT NOT NULL,
      dimension_social TEXT NOT NULL,
      answers_json TEXT NOT NULL,
      retest_count INTEGER DEFAULT 0,
      share_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      level INTEGER,
      condition_value INTEGER,
      condition_desc TEXT NOT NULL,
      icon TEXT,
      artwork_path TEXT,
      badge_style TEXT
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      snapshot_lit INTEGER,
      snapshot_total INTEGER,
      snapshot_percent INTEGER,
      is_current_max INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_attractions_province ON attractions(province_id);
    CREATE INDEX IF NOT EXISTS idx_attractions_city ON attractions(city_id);
    CREATE INDEX IF NOT EXISTS idx_attractions_category ON attractions(category_id);
    CREATE INDEX IF NOT EXISTS idx_attraction_tags_attraction ON attraction_tags(attraction_id);
    CREATE INDEX IF NOT EXISTS idx_attraction_tags_category ON attraction_tags(category_id);
    CREATE INDEX IF NOT EXISTS idx_cities_province ON cities(province_id);
    CREATE INDEX IF NOT EXISTS idx_user_attractions_user ON user_attractions(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_favorites_user_active ON user_favorites(user_id, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_travel_personality_user_id ON travel_personality_results(user_id);
  `);

  for (const column of [
    { name: 'retest_count', type: 'INTEGER DEFAULT 0' },
    { name: 'share_count', type: 'INTEGER DEFAULT 0' },
  ]) {
    const exists = database.prepare("SELECT name FROM pragma_table_info('travel_personality_results') WHERE name = ?").get(column.name);
    if (!exists) database.exec(`ALTER TABLE travel_personality_results ADD COLUMN ${column.name} ${column.type}`);
  }
  const syncPersonalityName = database.prepare(`
    UPDATE travel_personality_results SET type_name = ? WHERE type_code = ? AND type_name <> ?
  `);
  const syncPersonalityTransaction = database.transaction(() => {
    PERSONALITY_CATALOG.forEach((item) => syncPersonalityName.run(item.name, item.code, item.name));
  });
  syncPersonalityTransaction();

  // Migration: relax achievements.type CHECK constraint for V2 achievement lines.
  const achievementsSql = database.prepare(`
    SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'achievements'
  `).get() as { sql?: string } | undefined;
  if (achievementsSql?.sql?.includes("CHECK(type IN ('province', 'attraction', 'special'))")) {
    database.exec(`
      CREATE TABLE achievements_new (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        level INTEGER,
        condition_value INTEGER,
        condition_desc TEXT NOT NULL,
        icon TEXT,
        badge_style TEXT
      );
      INSERT INTO achievements_new (id, name, type, level, condition_value, condition_desc, icon, badge_style)
        SELECT id, name, type, level, condition_value, condition_desc, icon, badge_style FROM achievements;
      DROP TABLE achievements;
      ALTER TABLE achievements_new RENAME TO achievements;
    `);
  }

  // Migration: user_achievements supports repeatable percentage badges and unlock snapshots.
  const userAchievementsSql = database.prepare(`
    SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'user_achievements'
  `).get() as { sql?: string } | undefined;
  if (userAchievementsSql?.sql?.includes('UNIQUE(user_id, achievement_id)')) {
    database.exec(`
      CREATE TABLE user_achievements_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        achievement_id INTEGER NOT NULL,
        unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        snapshot_lit INTEGER,
        snapshot_total INTEGER,
        snapshot_percent INTEGER,
        is_current_max INTEGER DEFAULT 0
      );
      INSERT INTO user_achievements_new (id, user_id, achievement_id, unlocked_at)
        SELECT id, user_id, achievement_id, unlocked_at FROM user_achievements;
      DROP TABLE user_achievements;
      ALTER TABLE user_achievements_new RENAME TO user_achievements;
      CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);
    `);
  }

  const userAchievementColumns = ['snapshot_lit', 'snapshot_total', 'snapshot_percent', 'is_current_max'];
  for (const column of userAchievementColumns) {
    const exists = database.prepare("SELECT name FROM pragma_table_info('user_achievements') WHERE name = ?").get(column);
    if (!exists) {
      const type = column === 'is_current_max' ? 'INTEGER DEFAULT 0' : 'INTEGER';
      database.exec(`ALTER TABLE user_achievements ADD COLUMN ${column} ${type}`);
    }
  }
  database.exec('CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id)');
  const hasArtworkPath = database.prepare("SELECT name FROM pragma_table_info('achievements') WHERE name = 'artwork_path'").get();
  if (!hasArtworkPath) database.exec('ALTER TABLE achievements ADD COLUMN artwork_path TEXT');
  const hasEquippedAchievement = database.prepare("SELECT name FROM pragma_table_info('users') WHERE name = 'equipped_achievement_id'").get();
  if (!hasEquippedAchievement) database.exec('ALTER TABLE users ADD COLUMN equipped_achievement_id INTEGER');
  syncAchievementCatalog(database);

  // Migration: add role column if not exists
  const hasRole = database.prepare("SELECT name FROM pragma_table_info('users') WHERE name = 'role'").get();
  if (!hasRole) {
    database.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user'))");
  }

  // Migration: add cities table if not exists (for existing databases)
  const hasCities = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cities'").get();
  if (!hasCities) {
    database.exec(`
      CREATE TABLE cities (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        province_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        UNIQUE(name, province_id)
      );
      CREATE INDEX idx_cities_province ON cities(province_id);
    `);
  }

  // Migration: add city_id column to attractions if not exists
  const hasCityId = database.prepare("SELECT name FROM pragma_table_info('attractions') WHERE name = 'city_id'").get();
  if (!hasCityId) {
    database.exec(`
      ALTER TABLE attractions ADD COLUMN city_id INTEGER;
      CREATE INDEX idx_attractions_city ON attractions(city_id);
    `);
  }

  // Migration: add is_5a / is_4a columns to attractions
  const hasIs5a = database.prepare("SELECT name FROM pragma_table_info('attractions') WHERE name = 'is_5a'").get();
  if (!hasIs5a) {
    database.exec("ALTER TABLE attractions ADD COLUMN is_5a INTEGER DEFAULT 0");
  }
  const hasIs4a = database.prepare("SELECT name FROM pragma_table_info('attractions') WHERE name = 'is_4a'").get();
  if (!hasIs4a) {
    database.exec("ALTER TABLE attractions ADD COLUMN is_4a INTEGER DEFAULT 0");
  }

  // Migration: add created_by / status columns to attractions
  const hasCreatedBy = database.prepare("SELECT name FROM pragma_table_info('attractions') WHERE name = 'created_by'").get();
  if (!hasCreatedBy) {
    database.exec("ALTER TABLE attractions ADD COLUMN created_by INTEGER DEFAULT NULL");
  }
  const hasStatus = database.prepare("SELECT name FROM pragma_table_info('attractions') WHERE name = 'status'").get();
  if (!hasStatus) {
    database.exec("ALTER TABLE attractions ADD COLUMN status TEXT DEFAULT 'approved' CHECK(status IN ('pending', 'approved', 'rejected'))");
  }

  syncRequiredCityNodes(database);
  backfillAttractionCityIds(database);
  assertAttractionCityIntegrity(database);
  makeAttractionCityIdRequired(database);

  // Migration: create attraction_tags table
  const hasAttractionTags = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='attraction_tags'").get();
  if (!hasAttractionTags) {
    database.exec(`
      CREATE TABLE attraction_tags (
        attraction_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        PRIMARY KEY (attraction_id, category_id),
        FOREIGN KEY (attraction_id) REFERENCES attractions(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_attraction_tags_attraction ON attraction_tags(attraction_id);
      CREATE INDEX idx_attraction_tags_category ON attraction_tags(category_id);
    `);
  }

  // Migration: remove UNIQUE constraint on user_attractions to support multiple visits
  const hasUniqueConstraint = database.prepare(`
    SELECT COUNT(*) as c FROM sqlite_master
    WHERE type = 'index' AND name = 'sqlite_autoindex_user_attractions_1'
  `).get() as { c: number };
  if (hasUniqueConstraint.c > 0) {
    database.exec(`
      CREATE TABLE user_attractions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        attraction_id INTEGER NOT NULL,
        lit_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        time_precision TEXT DEFAULT 'exact',
        season TEXT,
        display_time_text TEXT,
        source TEXT DEFAULT 'manual'
      );
      INSERT INTO user_attractions_new (id, user_id, attraction_id, lit_at, time_precision, season, display_time_text, source)
        SELECT id, user_id, attraction_id, lit_at, 'exact', NULL, NULL, 'manual' FROM user_attractions;
      DROP TABLE user_attractions;
      ALTER TABLE user_attractions_new RENAME TO user_attractions;
      CREATE INDEX idx_user_attractions_user ON user_attractions(user_id);
    `);
  }

  const userAttractionColumns = [
    { name: 'time_precision', type: "TEXT DEFAULT 'exact'" },
    { name: 'season', type: 'TEXT' },
    { name: 'display_time_text', type: 'TEXT' },
    { name: 'source', type: "TEXT DEFAULT 'manual'" },
  ];
  for (const column of userAttractionColumns) {
    const exists = database.prepare("SELECT name FROM pragma_table_info('user_attractions') WHERE name = ?").get(column.name);
    if (!exists) {
      database.exec(`ALTER TABLE user_attractions ADD COLUMN ${column.name} ${column.type}`);
    }
  }

  return database;
}

function syncRequiredCityNodes(database: Database.Database) {
  const requiredCities = [
    { id: 1, name: '北京市', provinceId: 1, type: 'city' },
    { id: 2, name: '天津市', provinceId: 2, type: 'city' },
    { id: 73, name: '上海市', provinceId: 9, type: 'city' },
    { id: 233, name: '重庆市', provinceId: 22, type: 'city' },
    { id: 338, name: '台湾省', provinceId: 32, type: 'city' },
    { id: 339, name: '香港特别行政区', provinceId: 33, type: 'city' },
    { id: 340, name: '澳门特别行政区', provinceId: 34, type: 'city' },
    { id: 341, name: '神农架林区', provinceId: 17, type: 'region' },
    { id: 342, name: '保亭黎族苗族自治县', provinceId: 21, type: 'county' },
    { id: 343, name: '陵水黎族自治县', provinceId: 21, type: 'county' },
    { id: 344, name: '乐东黎族自治县', provinceId: 21, type: 'county' },
    { id: 345, name: '五指山市', provinceId: 21, type: 'city' },
    { id: 346, name: '昌江黎族自治县', provinceId: 21, type: 'county' },
    { id: 347, name: '琼中黎族苗族自治县', provinceId: 21, type: 'county' },
  ];
  const upsertCity = database.prepare(`
    INSERT INTO cities (id, name, province_id, type)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      province_id = excluded.province_id,
      type = excluded.type
  `);

  const transaction = database.transaction(() => {
    for (const city of requiredCities) {
      upsertCity.run(city.id, city.name, city.provinceId, city.type);
    }
  });

  transaction();
}

function backfillAttractionCityIds(database: Database.Database) {
  const provinceCityFallbacks = [
    { provinceId: 1, cityId: 1 },
    { provinceId: 2, cityId: 2 },
    { provinceId: 9, cityId: 73 },
    { provinceId: 22, cityId: 233 },
    { provinceId: 32, cityId: 338 },
    { provinceId: 33, cityId: 339 },
    { provinceId: 34, cityId: 340 },
  ];
  const attractionCityBackfills = [
    { provinceId: 17, name: '神农架', cityId: 341 },
    { provinceId: 17, name: '大九湖', cityId: 341 },
    { provinceId: 21, name: '呀诺达雨林', cityId: 342 },
    { provinceId: 21, name: '槟榔谷', cityId: 342 },
    { provinceId: 21, name: '七仙岭', cityId: 342 },
    { provinceId: 21, name: '分界洲岛', cityId: 343 },
    { provinceId: 21, name: '吊罗山', cityId: 343 },
    { provinceId: 21, name: '尖峰岭', cityId: 344 },
    { provinceId: 21, name: '五指山', cityId: 345 },
    { provinceId: 21, name: '霸王岭', cityId: 346 },
    { provinceId: 21, name: '黎母山', cityId: 347 },
    { provinceId: 10, name: '沙溪古镇', cityId: 78 },
    { provinceId: 23, name: '莲宝叶则', cityId: 252 },
  ];
  const updateByProvince = database.prepare(`
    UPDATE attractions
    SET city_id = ?
    WHERE province_id = ? AND city_id IS NULL
  `);
  const updateByName = database.prepare(`
    UPDATE attractions
    SET city_id = ?
    WHERE province_id = ? AND name = ? AND city_id IS NULL
  `);

  const transaction = database.transaction(() => {
    for (const item of attractionCityBackfills) {
      updateByName.run(item.cityId, item.provinceId, item.name);
    }
    for (const item of provinceCityFallbacks) {
      updateByProvince.run(item.cityId, item.provinceId);
    }
  });

  transaction();
}

function assertAttractionCityIntegrity(database: Database.Database) {
  const missingProvince = database.prepare(`
    SELECT COUNT(*) as count
    FROM attractions
    WHERE province_id IS NULL
  `).get() as { count: number };
  if (missingProvince.count > 0) {
    throw new Error(`Attraction province_id is required, found ${missingProvince.count} attractions without province_id`);
  }

  const invalidProvince = database.prepare(`
    SELECT COUNT(*) as count
    FROM attractions a
    LEFT JOIN provinces p ON p.id = a.province_id
    WHERE p.id IS NULL
  `).get() as { count: number };
  if (invalidProvince.count > 0) {
    throw new Error(`Attraction province_id must reference provinces.id, found ${invalidProvince.count} invalid references`);
  }

  const missingCity = database.prepare(`
    SELECT COUNT(*) as count
    FROM attractions
    WHERE city_id IS NULL
  `).get() as { count: number };
  if (missingCity.count > 0) {
    throw new Error(`Attraction city_id is required, found ${missingCity.count} attractions without city_id`);
  }

  const invalidCity = database.prepare(`
    SELECT COUNT(*) as count
    FROM attractions a
    LEFT JOIN cities c ON c.id = a.city_id
    WHERE c.id IS NULL
  `).get() as { count: number };
  if (invalidCity.count > 0) {
    throw new Error(`Attraction city_id must reference cities.id, found ${invalidCity.count} invalid references`);
  }
}

function makeAttractionCityIdRequired(database: Database.Database) {
  const cityColumn = database.prepare(`
    SELECT *
    FROM pragma_table_info('attractions')
    WHERE name = 'city_id'
  `).get() as { notnull: number } | undefined;
  if (!cityColumn || cityColumn.notnull === 1) return;

  database.exec(`
    CREATE TABLE attractions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      province_id INTEGER NOT NULL,
      city_id INTEGER NOT NULL,
      is_5a INTEGER DEFAULT 0,
      is_4a INTEGER DEFAULT 0,
      level TEXT CHECK(level IN ('4A', '5A')),
      category_id INTEGER,
      pinyin TEXT,
      created_by INTEGER DEFAULT NULL,
      status TEXT DEFAULT 'approved' CHECK(status IN ('pending', 'approved', 'rejected')),
      UNIQUE(name, province_id)
    );
    INSERT INTO attractions_new (
      id, name, province_id, city_id, is_5a, is_4a, level, category_id, pinyin, created_by, status
    )
      SELECT id, name, province_id, city_id, is_5a, is_4a, level, category_id, pinyin, created_by, status
      FROM attractions;
    DROP TABLE attractions;
    ALTER TABLE attractions_new RENAME TO attractions;
    CREATE INDEX IF NOT EXISTS idx_attractions_province ON attractions(province_id);
    CREATE INDEX IF NOT EXISTS idx_attractions_city ON attractions(city_id);
    CREATE INDEX IF NOT EXISTS idx_attractions_category ON attractions(category_id);
  `);
}

function syncAchievementCatalog(database: Database.Database) {
  const catalog = getAchievementCatalog();
  const upsertAchievement = database.prepare(`
    INSERT INTO achievements (id, name, type, level, condition_value, condition_desc, icon, artwork_path, badge_style)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      level = excluded.level,
      condition_value = excluded.condition_value,
      condition_desc = excluded.condition_desc,
      icon = excluded.icon,
      artwork_path = excluded.artwork_path,
      badge_style = excluded.badge_style
  `);

  const transaction = database.transaction(() => {
    for (const achievement of catalog) {
      upsertAchievement.run(
        achievement.id,
        achievement.name,
        achievement.type,
        achievement.level,
        achievement.condition_value,
        achievement.condition_desc,
        achievement.icon,
        achievement.artwork_path,
        achievement.badge_style,
      );
    }

    if (catalog.length > 0) {
      const placeholders = catalog.map(() => '?').join(',');
      database.prepare(`DELETE FROM achievements WHERE id NOT IN (${placeholders})`).run(...catalog.map((item) => item.id));
    }
  });

  transaction();
}
