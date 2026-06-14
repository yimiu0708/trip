import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../data/database.sqlite');

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
      city_id INTEGER,
      level TEXT CHECK(level IN ('4A', '5A')) NOT NULL,
      category_id INTEGER,
      pinyin TEXT,
      UNIQUE(name, province_id)
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
      lit_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('province', 'attraction', 'special')),
      level INTEGER,
      condition_value INTEGER,
      condition_desc TEXT NOT NULL,
      icon TEXT,
      badge_style TEXT
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, achievement_id)
    );

    CREATE INDEX IF NOT EXISTS idx_attractions_province ON attractions(province_id);
    CREATE INDEX IF NOT EXISTS idx_attractions_city ON attractions(city_id);
    CREATE INDEX IF NOT EXISTS idx_attractions_category ON attractions(category_id);
    CREATE INDEX IF NOT EXISTS idx_cities_province ON cities(province_id);
    CREATE INDEX IF NOT EXISTS idx_user_attractions_user ON user_attractions(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
  `);

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
        lit_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO user_attractions_new (id, user_id, attraction_id, lit_at)
        SELECT id, user_id, attraction_id, lit_at FROM user_attractions;
      DROP TABLE user_attractions;
      ALTER TABLE user_attractions_new RENAME TO user_attractions;
      CREATE INDEX idx_user_attractions_user ON user_attractions(user_id);
    `);
  }

  return database;
}
