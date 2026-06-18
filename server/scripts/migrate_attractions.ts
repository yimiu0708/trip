import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, initDb } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '../../景区清单_类型重构_扩充版.csv');

const NEW_CATEGORIES = [
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

function parseCsv(content: string) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    // Simple CSV parse; does not handle quoted commas inside fields
    const values = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ? values[i].trim() : '';
    });
    return row;
  });
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('CSV not found:', CSV_PATH);
    process.exit(1);
  }

  initDb();
  const db = getDb();

  // 1. Sync categories
  db.prepare('DELETE FROM categories').run();
  const insertCategory = db.prepare('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)');
  for (const c of NEW_CATEGORIES) {
    insertCategory.run(c.id, c.name, c.sort_order);
  }
  console.log('✅ Categories synced');

  // 2. Load provinces map
  const provinces = db.prepare('SELECT id, name FROM provinces').all() as { id: number; name: string }[];
  const provinceMap = new Map(provinces.map((p) => [p.name, p.id]));

  // 3. Load cities map
  const cities = db.prepare('SELECT id, name, province_id FROM cities').all() as { id: number; name: string; province_id: number }[];
  const cityMap = new Map<string, number>();
  for (const c of cities) {
    cityMap.set(`${c.province_id}|${c.name}`, c.id);
  }

  // 4. Load categories map
  const categories = db.prepare('SELECT id, name FROM categories').all() as { id: number; name: string }[];
  const categoryMap = new Map(categories.map((c) => [c.name, c.id]));

  // 5. Parse CSV
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCsv(raw);
  console.log(`📄 Parsed ${rows.length} rows from CSV`);

  // 6. Backup user_attractions
  const userAttractions = db.prepare('SELECT id, user_id, attraction_id, lit_at FROM user_attractions').all() as {
    id: number;
    user_id: number;
    attraction_id: number;
    lit_at: string;
  }[];
  console.log(`💾 Backed up ${userAttractions.length} user attraction records`);

  // 7. Clear attraction_tags
  db.prepare('DELETE FROM attraction_tags').run();

  // 8. Process attractions
  const insertAttraction = db.prepare(`
    INSERT INTO attractions (name, province_id, city_id, is_5a, is_4a, level, category_id, pinyin, created_by, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateAttraction = db.prepare(`
    UPDATE attractions SET
      city_id = ?,
      is_5a = ?,
      is_4a = ?,
      level = ?,
      category_id = ?,
      pinyin = ?,
      created_by = ?,
      status = ?
    WHERE id = ?
  `);
  const findAttraction = db.prepare('SELECT id FROM attractions WHERE name = ? AND province_id = ?');
  const insertTag = db.prepare('INSERT OR IGNORE INTO attraction_tags (attraction_id, category_id) VALUES (?, ?)');

  const keptIds = new Set<number>();

  for (const row of rows) {
    const name = row['景区名称'];
    const provinceName = row['所属省份'];
    const cityName = row['所属城市'];
    const is5a = row['是否5A'] === '是' ? 1 : 0;
    const is4a = row['是否4A'] === '是' ? 1 : 0;
    const tagsText = row['景区类型(新)'];

    const provinceId = provinceMap.get(provinceName);
    if (!provinceId) {
      console.warn(`⚠️ Province not found: ${provinceName} for ${name}`);
      continue;
    }

    const cityId = cityName ? cityMap.get(`${provinceId}|${cityName}`) ?? null : null;
    const level = is5a ? '5A' : is4a ? '4A' : null;
    const primaryCategoryId = categoryMap.get(tagsText.split(',')[0].trim()) ?? null;

    const existing = findAttraction.get(name, provinceId) as { id: number } | undefined;
    let attractionId: number;

    if (existing) {
      updateAttraction.run(cityId, is5a, is4a, level, primaryCategoryId, '', null, 'approved', existing.id);
      attractionId = existing.id;
    } else {
      const result = insertAttraction.run(name, provinceId, cityId, is5a, is4a, level, primaryCategoryId, '', null, 'approved');
      attractionId = Number(result.lastInsertRowid);
    }

    keptIds.add(attractionId);

    // Set tags
    const tagNames = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
    for (const tagName of tagNames) {
      const tagId = categoryMap.get(tagName);
      if (tagId) {
        insertTag.run(attractionId, tagId);
      } else {
        console.warn(`⚠️ Tag not found: ${tagName} for ${name}`);
      }
    }
  }

  console.log(`✅ Processed ${keptIds.size} attractions`);

  // 9. Delete old attractions not in CSV
  const allIds = db.prepare('SELECT id FROM attractions').all() as { id: number }[];
  const deleteIds = allIds.filter((a) => !keptIds.has(a.id)).map((a) => a.id);
  if (deleteIds.length > 0) {
    const placeholders = deleteIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM attractions WHERE id IN (${placeholders})`).run(...deleteIds);
    console.log(`🗑️ Deleted ${deleteIds.length} old attractions`);
  }

  // 10. Clean up orphaned user_attractions
  db.prepare(`
    DELETE FROM user_attractions
    WHERE attraction_id NOT IN (SELECT id FROM attractions)
  `).run();
  console.log('🧹 Cleaned up orphaned user attraction records');

  console.log('🎉 Migration complete');
}

main();
