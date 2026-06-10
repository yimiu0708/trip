import { getDb, initDb } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  { id: 1, name: '山岳', sort_order: 1 },
  { id: 2, name: '湖泊', sort_order: 2 },
  { id: 3, name: '森林公园', sort_order: 3 },
  { id: 4, name: '历史文化', sort_order: 4 },
  { id: 5, name: '海岛', sort_order: 5 },
  { id: 6, name: '古镇古村', sort_order: 6 },
  { id: 7, name: '现代建筑', sort_order: 7 },
  { id: 8, name: '动物园/植物园', sort_order: 8 },
  { id: 9, name: '博物馆', sort_order: 9 },
  { id: 10, name: '宗教场所', sort_order: 10 },
];

const ACHIEVEMENTS = [
  // 省份探索线
  { id: 1, name: '初见山河', type: 'province', level: 1, condition_value: 1, condition_desc: '点亮1个省份', icon: 'mountain', badge_style: 'bronze' },
  { id: 2, name: '足迹初绽', type: 'province', level: 2, condition_value: 5, condition_desc: '点亮5个省份', icon: 'footprint', badge_style: 'silver' },
  { id: 3, name: '行者无疆', type: 'province', level: 3, condition_value: 10, condition_desc: '点亮10个省份', icon: 'compass', badge_style: 'gold' },
  { id: 4, name: '华夏行者', type: 'province', level: 4, condition_value: 20, condition_desc: '点亮20个省份', icon: 'map', badge_style: 'platinum' },
  { id: 5, name: '九州征服者', type: 'province', level: 5, condition_value: 34, condition_desc: '点亮全部34个省级行政区', icon: 'crown', badge_style: 'diamond' },
  // 景区达人线
  { id: 10, name: '景区访客', type: 'attraction', level: 1, condition_value: 1, condition_desc: '点亮1个景区', icon: 'ticket', badge_style: 'bronze' },
  { id: 11, name: '赏景新手', type: 'attraction', level: 2, condition_value: 5, condition_desc: '点亮5个景区', icon: 'camera', badge_style: 'bronze' },
  { id: 12, name: '赏景达人', type: 'attraction', level: 3, condition_value: 15, condition_desc: '点亮15个景区', icon: 'landscape', badge_style: 'silver' },
  { id: 13, name: '风景爱好者', type: 'attraction', level: 4, condition_value: 30, condition_desc: '点亮30个景区', icon: 'scroll', badge_style: 'silver' },
  { id: 14, name: '风景收藏家', type: 'attraction', level: 5, condition_value: 60, condition_desc: '点亮60个景区', icon: 'album', badge_style: 'gold' },
  { id: 15, name: '旅途行者', type: 'attraction', level: 6, condition_value: 100, condition_desc: '点亮100个景区', icon: 'compass2', badge_style: 'gold' },
  { id: 16, name: '跋山涉水', type: 'attraction', level: 7, condition_value: 160, condition_desc: '点亮160个景区', icon: 'hiking', badge_style: 'platinum' },
  { id: 17, name: '万里行者', type: 'attraction', level: 8, condition_value: 250, condition_desc: '点亮250个景区', icon: 'long-scroll', badge_style: 'platinum' },
  { id: 18, name: '旅途传奇', type: 'attraction', level: 9, condition_value: 400, condition_desc: '点亮400个景区', icon: 'star-trail', badge_style: 'diamond' },
  { id: 19, name: '山河百科', type: 'attraction', level: 10, condition_value: 600, condition_desc: '点亮600个景区', icon: 'galaxy', badge_style: 'diamond' },
  // 特殊成就
  { id: 101, name: '旅途起点', type: 'special', level: null, condition_value: null, condition_desc: 'first_lit', icon: 'torch', badge_style: 'special' },
  { id: 102, name: '七日新星', type: 'special', level: null, condition_value: null, condition_desc: '7days_10lit', icon: 'meteor', badge_style: 'special' },
  { id: 103, name: '夜游神', type: 'special', level: null, condition_value: null, condition_desc: 'same_day_5_provinces', icon: 'moon', badge_style: 'special' },
  { id: 104, name: '分类大师', type: 'special', level: null, condition_value: null, condition_desc: 'full_category', icon: 'trophy', badge_style: 'special' },
  { id: 105, name: '完美省份', type: 'special', level: null, condition_value: null, condition_desc: 'full_province', icon: 'crown2', badge_style: 'special' },
  { id: 106, name: '5A征服者', type: 'special', level: null, condition_value: null, condition_desc: 'all_5a', icon: 'diamond5', badge_style: 'special' },
  { id: 107, name: '年度旅人', type: 'special', level: null, condition_value: null, condition_desc: '1year_10lit', icon: 'calendar', badge_style: 'special' },
  { id: 108, name: '坚持旅者', type: 'special', level: null, condition_value: null, condition_desc: '30days_streak', icon: 'flame', badge_style: 'special' },
];

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
    'INSERT OR IGNORE INTO achievements (id, name, type, level, condition_value, condition_desc, icon, badge_style) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const a of ACHIEVEMENTS) {
    insertAchievement.run(a.id, a.name, a.type, a.level, a.condition_value, a.condition_desc, a.icon, a.badge_style);
  }
  console.log('✅ Achievements seeded');

  // 景区
  const attractionsPath = path.join(__dirname, '../data/attractions.json');
  if (fs.existsSync(attractionsPath)) {
    const raw = fs.readFileSync(attractionsPath, 'utf-8');
    const attractions = JSON.parse(raw) as { name: string; province_id: number; level: string; category_id: number; pinyin: string }[];
    const insertAttraction = db.prepare(
      'INSERT OR IGNORE INTO attractions (name, province_id, level, category_id, pinyin) VALUES (?, ?, ?, ?, ?)'
    );
    for (const a of attractions) {
      insertAttraction.run(a.name, a.province_id, a.level, a.category_id, a.pinyin);
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
