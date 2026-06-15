import { getDb, initDb } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAchievementCatalog } from './utils/achievementCatalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROVINCES = [
  { id: 1, name: '北京市', code: 'BJ', region: '华北' },
  { id: 2, name: '天津市', code: 'TJ', region: '华北' },
  { id: 3, name: '河北省', code: 'HE', region: '华北' },
  { id: 4, name: '山西省', code: 'SX', region: '华北' },
  { id: 5, name: '内蒙古自治区', code: 'NM', region: '华北' },
  { id: 6, name: '辽宁省', code: 'LN', region: '东北' },
  { id: 7, name: '吉林省', code: 'JL', region: '东北' },
  { id: 8, name: '黑龙江省', code: 'HL', region: '东北' },
  { id: 9, name: '上海市', code: 'SH', region: '华东' },
  { id: 10, name: '江苏省', code: 'JS', region: '华东' },
  { id: 11, name: '浙江省', code: 'ZJ', region: '华东' },
  { id: 12, name: '安徽省', code: 'AH', region: '华东' },
  { id: 13, name: '福建省', code: 'FJ', region: '华东' },
  { id: 14, name: '江西省', code: 'JX', region: '华东' },
  { id: 15, name: '山东省', code: 'SD', region: '华东' },
  { id: 16, name: '河南省', code: 'HA', region: '华中' },
  { id: 17, name: '湖北省', code: 'HB', region: '华中' },
  { id: 18, name: '湖南省', code: 'HN', region: '华中' },
  { id: 19, name: '广东省', code: 'GD', region: '华南' },
  { id: 20, name: '广西壮族自治区', code: 'GX', region: '华南' },
  { id: 21, name: '海南省', code: 'HI', region: '华南' },
  { id: 22, name: '重庆市', code: 'CQ', region: '西南' },
  { id: 23, name: '四川省', code: 'SC', region: '西南' },
  { id: 24, name: '贵州省', code: 'GZ', region: '西南' },
  { id: 25, name: '云南省', code: 'YN', region: '西南' },
  { id: 26, name: '西藏自治区', code: 'XZ', region: '西南' },
  { id: 27, name: '陕西省', code: 'SN', region: '西北' },
  { id: 28, name: '甘肃省', code: 'GS', region: '西北' },
  { id: 29, name: '青海省', code: 'QH', region: '西北' },
  { id: 30, name: '宁夏回族自治区', code: 'NX', region: '西北' },
  { id: 31, name: '新疆维吾尔自治区', code: 'XJ', region: '西北' },
  { id: 32, name: '台湾省', code: 'TW', region: '港澳台' },
  { id: 33, name: '香港特别行政区', code: 'HK', region: '港澳台' },
  { id: 34, name: '澳门特别行政区', code: 'MO', region: '港澳台' },
];

const CATEGORIES = [
  { id: 1, name: '人文古迹', sort_order: 1 },
  { id: 2, name: '水域风光', sort_order: 2 },
  { id: 3, name: '山岳风光', sort_order: 3 },
  { id: 4, name: '地质奇观', sort_order: 4 },
  { id: 5, name: '森林生态', sort_order: 5 },
  { id: 6, name: '城市休闲', sort_order: 6 },
  { id: 7, name: '宗教文化', sort_order: 7 },
  { id: 8, name: '主题娱乐', sort_order: 8 },
  { id: 9, name: '古镇村落', sort_order: 9 },
  { id: 10, name: '红色旅游', sort_order: 10 },
  { id: 11, name: '博物展馆', sort_order: 11 },
];

const ACHIEVEMENTS = getAchievementCatalog();

async function seed() {
  initDb();
  const db = getDb();

  // 省份
  const insertProvince = db.prepare('INSERT OR IGNORE INTO provinces (id, name, code, region) VALUES (?, ?, ?, ?)');
  for (const p of PROVINCES) {
    insertProvince.run(p.id, p.name, p.code, p.region);
  }
  console.log('✅ Provinces seeded');

  // 分类
  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES (?, ?, ?)');
  for (const c of CATEGORIES) {
    insertCategory.run(c.id, c.name, c.sort_order);
  }
  console.log('✅ Categories seeded');

  // 成就
  const insertAchievement = db.prepare(
    `INSERT INTO achievements (id, name, type, level, condition_value, condition_desc, icon, badge_style)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       type = excluded.type,
       level = excluded.level,
       condition_value = excluded.condition_value,
       condition_desc = excluded.condition_desc,
       icon = excluded.icon,
       badge_style = excluded.badge_style`
  );
  for (const a of ACHIEVEMENTS) {
    insertAchievement.run(a.id, a.name, a.type, a.level, a.condition_value, a.condition_desc, a.icon, a.badge_style);
  }
  const achievementIds = ACHIEVEMENTS.map((a) => a.id);
  if (achievementIds.length > 0) {
    const placeholders = achievementIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM achievements WHERE id NOT IN (${placeholders})`).run(...achievementIds);
  }
  console.log(`✅ Achievements seeded: ${ACHIEVEMENTS.length}`);

  // 城市（地级市/地区/自治州/盟）
  const citiesPath = path.join(__dirname, '../data/cities.json');
  if (fs.existsSync(citiesPath)) {
    const raw = fs.readFileSync(citiesPath, 'utf-8');
    const cities = JSON.parse(raw) as { id: number; name: string; province_id: number; type: string }[];
    const insertCity = db.prepare(`
      INSERT INTO cities (id, name, province_id, type)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        province_id = excluded.province_id,
        type = excluded.type
    `);
    for (const c of cities) {
      insertCity.run(c.id, c.name, c.province_id, c.type);
    }
    const cityIds = cities.map((c) => c.id);
    if (cityIds.length > 0) {
      const placeholders = cityIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM cities WHERE id NOT IN (${placeholders})`).run(...cityIds);
    }
    console.log(`✅ Cities seeded: ${cities.length}`);
  } else {
    console.log('⚠️ cities.json not found, skipping cities seed');
  }

  // 景区
  const attractionsPath = path.join(__dirname, '../data/attractions.json');
  if (fs.existsSync(attractionsPath)) {
    const raw = fs.readFileSync(attractionsPath, 'utf-8');
    const attractions = JSON.parse(raw) as {
      name: string;
      province_id: number;
      city_id?: number | null;
      is_5a?: boolean;
      is_4a?: boolean;
      pinyin?: string;
      tags?: number[];
    }[];

    // Sync tags
    db.prepare('DELETE FROM attraction_tags').run();

    const insertAttraction = db.prepare(`
      INSERT INTO attractions (name, province_id, city_id, is_5a, is_4a, level, category_id, pinyin, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name, province_id) DO UPDATE SET
        city_id = excluded.city_id,
        is_5a = excluded.is_5a,
        is_4a = excluded.is_4a,
        level = excluded.level,
        category_id = excluded.category_id,
        pinyin = excluded.pinyin,
        created_by = excluded.created_by,
        status = excluded.status
    `);
    const insertTag = db.prepare('INSERT OR IGNORE INTO attraction_tags (attraction_id, category_id) VALUES (?, ?)');

    for (const a of attractions) {
      const is5a = a.is_5a ? 1 : 0;
      const is4a = a.is_4a ? 1 : 0;
      const level = is5a ? '5A' : is4a ? '4A' : null;
      const primaryCategoryId = a.tags?.[0] ?? null;
      insertAttraction.run(
        a.name,
        a.province_id,
        a.city_id ?? null,
        is5a,
        is4a,
        level,
        primaryCategoryId,
        a.pinyin ?? '',
        null,
        'approved'
      );
      const row = db.prepare('SELECT id FROM attractions WHERE name = ? AND province_id = ?').get(a.name, a.province_id) as { id: number };
      const attractionId = row.id;
      for (const tagId of (a.tags ?? [])) {
        insertTag.run(attractionId, tagId);
      }
    }
    console.log(`✅ Attractions seeded: ${attractions.length}`);
  } else {
    console.log('⚠️ attractions.json not found, skipping attractions seed');
  }

  // 默认管理员
  const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (!adminExists) {
    const bcrypt = await import('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run('admin', hash);
    console.log('✅ Default admin created: admin / admin123');
  }

  // 默认系统配置
  const defaultSettings = [
    { key: 'site_name', value: '旅行足迹', description: '网站名称' },
    { key: 'site_subtitle', value: '点亮中国，记录每一段旅程', description: '网站副标题' },
    { key: 'allow_register', value: 'true', description: '是否允许新用户注册 (true/false)' },
    { key: 'home_stats_display', value: 'card', description: '首页统计展示方式 (card/progress)' },
  ];
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)');
  for (const s of defaultSettings) {
    insertSetting.run(s.key, s.value, s.description);
  }
  console.log('✅ Default settings seeded');

  console.log('🎉 Seed complete!');
}

seed();
