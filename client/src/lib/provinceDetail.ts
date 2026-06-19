export interface AttractionTag {
  id: number;
  name: string;
}

export interface ProvinceAttraction {
  id: number;
  name: string;
  province_id: number;
  city_id?: number | null;
  city_name?: string | null;
  level?: string;
  pinyin?: string;
  tags?: AttractionTag[];
  category_name?: string;
}

export interface ProvinceCity {
  id: number;
  name: string;
  total_count: number;
}

export interface LitVisit {
  lit_at: string;
  time_precision?: string | null;
  season?: string | null;
  display_time_text?: string | null;
  source?: string | null;
}

export interface ProvinceDetail {
  province: { id: number; name: string; region: string };
  cities: ProvinceCity[];
  attractions: ProvinceAttraction[];
}

export type VisitMap = Record<number, LitVisit[]>;

export const SPECIAL_PROVINCE_IDS = new Set([1, 2, 9, 22, 32, 33, 34]);

const PROVINCIAL_CAPITALS: Record<string, string> = {
  河北省: '石家庄市', 山西省: '太原市', 内蒙古自治区: '呼和浩特市', 辽宁省: '沈阳市',
  吉林省: '长春市', 黑龙江省: '哈尔滨市', 江苏省: '南京市', 浙江省: '杭州市',
  安徽省: '合肥市', 福建省: '福州市', 江西省: '南昌市', 山东省: '济南市',
  河南省: '郑州市', 湖北省: '武汉市', 湖南省: '长沙市', 广东省: '广州市',
  广西壮族自治区: '南宁市', 海南省: '海口市', 四川省: '成都市', 贵州省: '贵阳市',
  云南省: '昆明市', 西藏自治区: '拉萨市', 陕西省: '西安市', 甘肃省: '兰州市',
  青海省: '西宁市', 宁夏回族自治区: '银川市', 新疆维吾尔自治区: '乌鲁木齐市',
};

export function getProvincialCapitalName(provinceName: string) {
  return PROVINCIAL_CAPITALS[provinceName];
}

export function buildVisitMap(list: any[], provinceName: string): VisitMap {
  const visits: VisitMap = {};
  list.forEach((item) => {
    if (item.province_name !== provinceName) return;
    visits[item.id] = visits[item.id] || [];
    visits[item.id].push({
      lit_at: item.lit_at,
      time_precision: item.time_precision,
      season: item.season,
      display_time_text: item.display_time_text,
      source: item.source,
    });
  });
  Object.values(visits).forEach((items) => items.sort((a, b) => b.lit_at.localeCompare(a.lit_at)));
  return visits;
}

export function getRegionHero(provinceId?: number) {
  if (provinceId === 29) return '/images/province-hero-qinghai-v022.png';
  if (provinceId === 25) return '/images/province-hero-yunnan.png';
  return '/images/splash-travel-bg.png';
}

export function getLightingStatus(lit: number, total: number) {
  if (lit === 0) return { key: 'unlit', label: '未点亮' } as const;
  if (total > 0 && lit >= total) return { key: 'completed', label: '已全亮' } as const;
  return { key: 'in_progress', label: '点亮中' } as const;
}
