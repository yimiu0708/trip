import csv
import sqlite3
import sys
from pathlib import Path

CSV_PATH = Path(__file__).resolve().parent.parent.parent / '景区清单_类型重构_扩充版.csv'
DB_PATH = Path(__file__).resolve().parent.parent / 'data' / 'database.sqlite'

NEW_CATEGORIES = [
    (1, '人文古迹', 1),
    (2, '水域风光', 2),
    (3, '山岳风光', 3),
    (4, '地质奇观', 4),
    (5, '森林生态', 5),
    (6, '城市休闲', 6),
    (7, '宗教文化', 7),
    (8, '主题娱乐', 8),
    (9, '古镇村落', 9),
    (10, '红色旅游', 10),
    (11, '博物展馆', 11),
]


def main():
    if not CSV_PATH.exists():
        print(f'CSV not found: {CSV_PATH}')
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA foreign_keys = OFF')
    cur = conn.cursor()

    # 1. Recreate attractions table without NOT NULL on level
    cur.execute("""
        CREATE TABLE IF NOT EXISTS attractions_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            province_id INTEGER NOT NULL,
            city_id INTEGER,
            is_5a INTEGER DEFAULT 0,
            is_4a INTEGER DEFAULT 0,
            level TEXT CHECK(level IN ('4A', '5A')),
            category_id INTEGER,
            pinyin TEXT,
            created_by INTEGER DEFAULT NULL,
            status TEXT DEFAULT 'approved' CHECK(status IN ('pending', 'approved', 'rejected')),
            UNIQUE(name, province_id)
        )
    """)
    cur.execute("""
        INSERT INTO attractions_new (id, name, province_id, city_id, is_5a, is_4a, level, category_id, pinyin, created_by, status)
        SELECT id, name, province_id, city_id,
            CASE WHEN level = '5A' THEN 1 ELSE 0 END,
            CASE WHEN level = '4A' THEN 1 ELSE 0 END,
            level, category_id, pinyin, NULL, 'approved'
        FROM attractions
    """)
    cur.execute("DROP TABLE attractions")
    cur.execute("ALTER TABLE attractions_new RENAME TO attractions")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_attractions_province ON attractions(province_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_attractions_city ON attractions(city_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_attractions_category ON attractions(category_id)")
    print('✅ Attractions table recreated with is_5a/is_4a')

    # 2. Create attraction_tags table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS attraction_tags (
            attraction_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            PRIMARY KEY (attraction_id, category_id),
            FOREIGN KEY (attraction_id) REFERENCES attractions(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_attraction_tags_attraction ON attraction_tags(attraction_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_attraction_tags_category ON attraction_tags(category_id)")
    cur.execute("DELETE FROM attraction_tags")

    # 3. Sync categories
    cur.execute('DELETE FROM categories')
    cur.executemany('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)', NEW_CATEGORIES)
    print('✅ Categories synced')

    # 4. Load maps
    provinces = {name: pid for pid, name in cur.execute('SELECT id, name FROM provinces')}
    cities = {(prov_id, name): cid for cid, name, prov_id in cur.execute('SELECT id, name, province_id FROM cities')}
    categories = {name: cid for cid, name, _ in NEW_CATEGORIES}

    # 5. Parse CSV
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f'📄 Parsed {len(rows)} rows from CSV')

    # 6. Process attractions
    find_sql = 'SELECT id FROM attractions WHERE name = ? AND province_id = ?'
    insert_sql = '''
        INSERT INTO attractions (name, province_id, city_id, is_5a, is_4a, level, category_id, pinyin, created_by, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    '''
    update_sql = '''
        UPDATE attractions SET city_id = ?, is_5a = ?, is_4a = ?, level = ?, category_id = ?, pinyin = ?, created_by = ?, status = ?
        WHERE id = ?
    '''
    insert_tag_sql = 'INSERT OR IGNORE INTO attraction_tags (attraction_id, category_id) VALUES (?, ?)'

    kept_ids = set()

    for row in rows:
        name = row['景区名称'].strip()
        province_name = row['所属省份'].strip()
        city_name = row['所属城市'].strip()
        is_5a = 1 if row['是否5A'].strip() == '是' else 0
        is_4a = 1 if row['是否4A'].strip() == '是' else 0
        tags_text = row['景区类型(新)'].strip()

        province_id = provinces.get(province_name)
        if not province_id:
            print(f'⚠️ Province not found: {province_name} for {name}')
            continue

        city_id = cities.get((province_id, city_name)) if city_name else None
        level = '5A' if is_5a else ('4A' if is_4a else None)

        tag_names = [t.strip() for t in tags_text.split(',') if t.strip()]
        primary_category_id = categories.get(tag_names[0]) if tag_names else None

        existing = cur.execute(find_sql, (name, province_id)).fetchone()
        if existing:
            attraction_id = existing[0]
            cur.execute(update_sql, (city_id, is_5a, is_4a, level, primary_category_id, '', None, 'approved', attraction_id))
        else:
            cur.execute(insert_sql, (name, province_id, city_id, is_5a, is_4a, level, primary_category_id, '', None, 'approved'))
            attraction_id = cur.lastrowid

        kept_ids.add(attraction_id)

        for tag_name in tag_names:
            tag_id = categories.get(tag_name)
            if tag_id:
                cur.execute(insert_tag_sql, (attraction_id, tag_id))
            else:
                print(f'⚠️ Tag not found: {tag_name} for {name}')

    print(f'✅ Processed {len(kept_ids)} attractions')

    # 7. Delete old attractions not in CSV
    cur.execute('SELECT id FROM attractions')
    all_ids = {r[0] for r in cur.fetchall()}
    delete_ids = list(all_ids - kept_ids)
    if delete_ids:
        placeholders = ','.join('?' * len(delete_ids))
        cur.execute(f'DELETE FROM attractions WHERE id IN ({placeholders})', delete_ids)
        print(f'🗑️ Deleted {len(delete_ids)} old attractions')

    # 8. Clean up orphaned user_attractions
    cur.execute('DELETE FROM user_attractions WHERE attraction_id NOT IN (SELECT id FROM attractions)')
    print('🧹 Cleaned up orphaned user attraction records')

    conn.commit()
    conn.execute('PRAGMA foreign_keys = ON')
    conn.close()
    print('🎉 Migration complete')


if __name__ == '__main__':
    main()
