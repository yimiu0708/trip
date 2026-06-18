export interface AchievementDefinition {
  id: number;
  name: string;
  type: 'province' | 'city' | 'attraction' | 'category' | 'collector' | 'special';
  level: number | null;
  condition_value: number | null;
  condition_desc: string;
  icon: string;
  badge_style: string;
}

export const PROVINCE_ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 1, name: '初见山河', type: 'province', level: 1, condition_value: 1, condition_desc: '点亮1个省份', icon: '⛰️', badge_style: 'bronze' },
  { id: 2, name: '足迹初绽', type: 'province', level: 2, condition_value: 5, condition_desc: '点亮5个省份', icon: '👣', badge_style: 'silver' },
  { id: 3, name: '行者无疆', type: 'province', level: 3, condition_value: 10, condition_desc: '点亮10个省份', icon: '🧭', badge_style: 'gold' },
  { id: 4, name: '华夏行者', type: 'province', level: 4, condition_value: 20, condition_desc: '点亮20个省份', icon: '🗺️', badge_style: 'platinum' },
  { id: 5, name: '九州征服者', type: 'province', level: 5, condition_value: 34, condition_desc: '点亮全部34个省级行政区', icon: '👑', badge_style: 'diamond' },
];

export const CITY_ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 20, name: '一城一梦', type: 'city', level: 1, condition_value: 1, condition_desc: '点亮1个城市的景点', icon: '🏙️', badge_style: 'bronze' },
  { id: 21, name: '十城烟火', type: 'city', level: 2, condition_value: 10, condition_desc: '点亮10个城市的景点', icon: '🌆', badge_style: 'silver' },
  { id: 22, name: '三十城事', type: 'city', level: 3, condition_value: 30, condition_desc: '点亮30个城市的景点', icon: '🏘️', badge_style: 'gold' },
  { id: 23, name: '百城归客', type: 'city', level: 4, condition_value: 100, condition_desc: '点亮100个城市的景点', icon: '🚄', badge_style: 'platinum' },
  { id: 24, name: '城海行舟', type: 'city', level: 5, condition_value: 200, condition_desc: '点亮200个城市的景点', icon: '⛵', badge_style: 'diamond' },
  { id: 25, name: '九州通衢', type: 'city', level: 6, condition_value: 300, condition_desc: '点亮300个城市的景点', icon: '🌐', badge_style: 'mythic' },
];

export const ATTRACTION_ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 30, name: '旅途起点', type: 'attraction', level: 1, condition_value: 5, condition_desc: '点亮5个景点', icon: '🎒', badge_style: 'bronze' },
  { id: 31, name: '探索新手', type: 'attraction', level: 2, condition_value: 20, condition_desc: '点亮20个景点', icon: '📷', badge_style: 'bronze' },
  { id: 32, name: '旅途行者', type: 'attraction', level: 3, condition_value: 50, condition_desc: '点亮50个景点', icon: '🥾', badge_style: 'silver' },
  { id: 33, name: '风景猎人', type: 'attraction', level: 4, condition_value: 10, condition_desc: '点亮全站景点的10%', icon: '🏞️', badge_style: 'silver repeatable' },
  { id: 34, name: '旅途达人', type: 'attraction', level: 5, condition_value: 20, condition_desc: '点亮全站景点的20%', icon: '🧳', badge_style: 'gold repeatable' },
  { id: 35, name: '万里行者', type: 'attraction', level: 6, condition_value: 35, condition_desc: '点亮全站景点的35%', icon: '🛤️', badge_style: 'gold repeatable' },
  { id: 36, name: '旅途传奇', type: 'attraction', level: 7, condition_value: 50, condition_desc: '点亮全站景点的50%', icon: '🌟', badge_style: 'platinum repeatable' },
  { id: 37, name: '山河行者', type: 'attraction', level: 8, condition_value: 65, condition_desc: '点亮全站景点的65%', icon: '🌄', badge_style: 'platinum repeatable' },
  { id: 38, name: '旅途宗师', type: 'attraction', level: 9, condition_value: 80, condition_desc: '点亮全站景点的80%', icon: '🏆', badge_style: 'diamond repeatable' },
  { id: 39, name: '山河全图', type: 'attraction', level: 10, condition_value: 100, condition_desc: '点亮全站景点的100%', icon: '✨', badge_style: 'mythic repeatable' },
];

export const CATEGORY_LEVEL_TITLES: Record<number, { line: string; titles: string[] }> = {
  1: { line: '人文行者', titles: ['过客', '游者', '访者', '行者', '探者', '识者', '通者', '守者', '传者', '人文行者'] },
  2: { line: '水域旅人', titles: ['涉水', '临水', '观水', '游水', '戏水', '亲水', '驭水', '伴水', '知水', '水域旅人'] },
  3: { line: '山岳客', titles: ['望山', '近山', '入山', '登山', '越山', '阅山', '知山', '归山', '主山', '山岳客'] },
  4: { line: '地质迷', titles: ['见奇', '识奇', '寻奇', '探奇', '解奇', '研奇', '迷奇', '通奇', '造奇', '地质迷'] },
  5: { line: '森呼吸', titles: ['入林', '听林', '观林', '识林', '护林', '栖林', '融林', '沐林', '醉林', '森呼吸'] },
  6: { line: '都市客', titles: ['初城', '逛城', '游城', '识城', '融城', '恋城', '通城', '品城', '城主', '都市客'] },
  7: { line: '朝圣者', titles: ['问心', '寻道', '近法', '入寺', '听经', '悟理', '修行', '证道', '化境', '朝圣者'] },
  8: { line: '玩乐家', titles: ['试玩', '会玩', '爱玩', '擅玩', '精玩', '造玩', '玩主', '玩神', '乐主', '玩乐家'] },
  9: { line: '古镇客', titles: ['过镇', '入镇', '游镇', '识镇', '融镇', '恋镇', '守镇', '忆镇', '镇主', '古镇客'] },
  10: { line: '红色旅人', titles: ['初见', '追忆', '寻访', '铭记', '传承', '力行', '践行', '弘扬', '星火', '红色旅人'] },
  11: { line: '馆藏家', titles: ['入门', '观展', '研展', '集展', '藏展', '策展', '通展', '赏展', '馆主', '馆藏家'] },
};

const CATEGORY_ICONS: Record<number, string> = {
  1: '🏛️',
  2: '🌊',
  3: '⛰️',
  4: '🪨',
  5: '🌲',
  6: '🏙️',
  7: '🪷',
  8: '🎡',
  9: '🏮',
  10: '🚩',
  11: '🏺',
};

export function buildCategoryAchievements(): AchievementDefinition[] {
  return Object.entries(CATEGORY_LEVEL_TITLES).flatMap(([categoryIdText, config]) => {
    const categoryId = Number(categoryIdText);
    return config.titles.map((title, index) => {
      const level = index + 1;
      return {
        id: 1000 + categoryId * 100 + level,
        name: title,
        type: 'category' as const,
        level,
        condition_value: categoryId,
        condition_desc: `${config.line} Lv.${level}`,
        icon: CATEGORY_ICONS[categoryId] || '🏅',
        badge_style: level >= 10 ? 'mythic category' : level >= 8 ? 'diamond category' : level >= 5 ? 'gold category' : 'silver category',
      };
    });
  });
}

export const COLLECTOR_ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 500, name: '徽章新手', type: 'collector', level: 1, condition_value: 5, condition_desc: '累计拥有5枚不同徽章', icon: '🎖️', badge_style: 'bronze' },
  { id: 501, name: '徽章达人', type: 'collector', level: 2, condition_value: 15, condition_desc: '累计拥有15枚不同徽章', icon: '🏅', badge_style: 'silver' },
  { id: 502, name: '徽章大师', type: 'collector', level: 3, condition_value: 30, condition_desc: '累计拥有30枚不同徽章', icon: '🥇', badge_style: 'gold' },
  { id: 503, name: '徽章传奇', type: 'collector', level: 4, condition_value: 50, condition_desc: '累计拥有50枚不同徽章', icon: '💎', badge_style: 'diamond' },
  { id: 504, name: '全图鉴收藏家', type: 'collector', level: 5, condition_value: null, condition_desc: '累计拥有全部已发布徽章', icon: '📜', badge_style: 'mythic' },
];

export const SPECIAL_ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 101, name: '旅途起点', type: 'special', level: null, condition_value: null, condition_desc: 'first_lit', icon: '🔥', badge_style: 'special' },
  { id: 102, name: '七日新星', type: 'special', level: null, condition_value: null, condition_desc: '7days_10lit', icon: '☄️', badge_style: 'special' },
  { id: 103, name: '夜游神', type: 'special', level: null, condition_value: null, condition_desc: 'night_7days', icon: '🌙', badge_style: 'special' },
  { id: 104, name: '分类大师', type: 'special', level: null, condition_value: null, condition_desc: 'full_category', icon: '🏆', badge_style: 'special' },
  { id: 105, name: '完美省份', type: 'special', level: null, condition_value: null, condition_desc: 'full_province', icon: '👑', badge_style: 'special' },
  { id: 107, name: '年度旅人', type: 'special', level: null, condition_value: null, condition_desc: '1year_10lit', icon: '📅', badge_style: 'special' },
  { id: 108, name: '坚持旅者', type: 'special', level: null, condition_value: null, condition_desc: '30days_streak', icon: '🔥', badge_style: 'special' },
  { id: 109, name: '城市漫游者', type: 'special', level: null, condition_value: null, condition_desc: 'first_city', icon: '🏙️', badge_style: 'special' },
  { id: 110, name: '分类初探', type: 'special', level: null, condition_value: null, condition_desc: 'first_category', icon: '🔖', badge_style: 'special' },
  { id: 111, name: '上传先锋', type: 'special', level: null, condition_value: null, condition_desc: 'first_upload_approved', icon: '⬆️', badge_style: 'special' },
];

export function getAchievementCatalog(): AchievementDefinition[] {
  return [
    ...PROVINCE_ACHIEVEMENTS,
    ...CITY_ACHIEVEMENTS,
    ...ATTRACTION_ACHIEVEMENTS,
    ...buildCategoryAchievements(),
    ...COLLECTOR_ACHIEVEMENTS,
    ...SPECIAL_ACHIEVEMENTS,
  ];
}

export function getCategoryThreshold(total: number, level: number): number {
  const safeTotal = Math.max(0, total);
  const rules: Array<[number, number]> = [
    [1, 0.01],
    [3, 0.05],
    [5, 0.10],
    [10, 0.20],
    [15, 0.35],
    [20, 0.50],
    [30, 0.65],
    [40, 0.80],
    [50, 0.90],
  ];
  if (level >= 10) return safeTotal;
  const [minimum, ratio] = rules[level - 1] || [safeTotal, 1];
  return Math.min(safeTotal, Math.max(minimum, Math.ceil(safeTotal * ratio)));
}

export function getAchievementFamily(achievement: Pick<AchievementDefinition, 'id' | 'type' | 'condition_value'>): string {
  if (achievement.type === 'category') return `category:${achievement.condition_value}`;
  if (achievement.type === 'special') return `special:${achievement.id}`;
  return achievement.type;
}
