import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Lightbulb, MapPin, Search } from 'lucide-react';
import { api } from '../api/client';
import ProvinceOutlineMap from '../components/ProvinceOutlineMap';
import RegionSelect from '../components/RegionSelect';
import { useAuth } from '../context/AuthContext';
import {
  buildVisitMap,
  getLightingStatus,
  getProvincialCapitalName,
  getRegionHero,
  SPECIAL_PROVINCE_IDS,
  type ProvinceAttraction,
  type ProvinceDetail,
  type VisitMap,
} from '../lib/provinceDetail';

type StatusFilter = 'all' | 'unlit' | 'in_progress' | 'completed';
type CitySort = 'smart' | 'attractions_desc' | 'name_asc';

const cityNameCollator = new Intl.Collator('zh-CN-u-co-pinyin');

interface CitySummary {
  id: number | 'unassigned';
  name: string;
  attractions: ProvinceAttraction[];
  total: number;
  lit: number;
  visits: number;
  fiveA: number;
  fourA: number;
  status: ReturnType<typeof getLightingStatus>;
}

export default function ProvincePage() {
  const { id } = useParams<{ id: string }>();
  const provinceId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [detail, setDetail] = useState<ProvinceDetail | null>(null);
  const [visits, setVisits] = useState<VisitMap>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [citySort, setCitySort] = useState<CitySort>('smart');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const provinceDetail = await api.provinces.detail(provinceId) as ProvinceDetail;
      setDetail(provinceDetail);
      if (user) {
        const list = await api.user.litList();
        setVisits(buildVisitMap(list, provinceDetail.province.name));
      } else {
        setVisits({});
      }
    } finally {
      setLoading(false);
    }
  }, [provinceId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
    document.querySelector<HTMLElement>('.app-main')?.scrollTo({ top: 0, left: 0 });
  }, [provinceId]);

  useEffect(() => {
    if (detail && SPECIAL_PROVINCE_IDS.has(detail.province.id)) {
      navigate(`/province/${detail.province.id}/cities/all`, { replace: true });
    }
  }, [detail, navigate]);

  const citySummaries = useMemo(() => {
    if (!detail) return [];
    const cityMap = new Map(detail.cities.map((city) => [city.id, city]));
    const byCity = new Map<number | 'unassigned', ProvinceAttraction[]>();
    detail.attractions.forEach((attraction) => {
      const key = attraction.city_id && cityMap.has(attraction.city_id) ? attraction.city_id : 'unassigned';
      byCity.set(key, [...(byCity.get(key) || []), attraction]);
    });

    return Array.from(byCity.entries()).map(([cityId, attractions]) => {
      const lit = attractions.filter((item) => visits[item.id]?.length).length;
      return {
        id: cityId,
        name: cityId === 'unassigned' ? '其他 / 未归属城市' : cityMap.get(cityId)?.name || '其他 / 未归属城市',
        attractions,
        total: attractions.length,
        lit,
        visits: attractions.reduce((sum, item) => sum + (visits[item.id]?.length || 0), 0),
        fiveA: attractions.filter((item) => item.level === '5A').length,
        fourA: attractions.filter((item) => item.level === '4A').length,
        status: getLightingStatus(lit, attractions.length),
      } satisfies CitySummary;
    });
  }, [detail, visits]);

  const filteredCities = useMemo(() => {
    const query = search.trim().toLowerCase();
    const capitalName = detail ? getProvincialCapitalName(detail.province.name) : undefined;
    const items = citySummaries.filter((city) => {
      const matchesSearch = !query || city.name.toLowerCase().includes(query)
        || city.attractions.some((item) => item.name.toLowerCase().includes(query));
      return matchesSearch && (statusFilter === 'all' || city.status.key === statusFilter);
    });
    return items.sort((a, b) => {
      if (a.id === 'unassigned') return 1;
      if (b.id === 'unassigned') return -1;
      if (citySort === 'attractions_desc') return b.total - a.total || cityNameCollator.compare(a.name, b.name);
      if (citySort === 'name_asc') return cityNameCollator.compare(a.name, b.name);
      if (a.name === capitalName && b.name !== capitalName) return -1;
      if (b.name === capitalName && a.name !== capitalName) return 1;
      if (a.lit !== b.lit) return b.lit / b.total - a.lit / a.total;
      if (a.lit > 0 !== (b.lit > 0)) return a.lit > 0 ? -1 : 1;
      return b.total - a.total || cityNameCollator.compare(a.name, b.name);
    });
  }, [citySummaries, citySort, detail, search, statusFilter]);

  if (loading) return <div className="page-loading">加载中...</div>;
  if (!detail) return <div className="page-loading">省份不存在</div>;
  if (SPECIAL_PROVINCE_IDS.has(detail.province.id)) return <div className="page-loading">正在进入全域景区...</div>;

  const { province, attractions } = detail;
  const litCount = attractions.filter((item) => visits[item.id]?.length).length;
  const progress = attractions.length ? Math.round(litCount / attractions.length * 100) : 0;
  const litCities = citySummaries.filter((city) => city.lit > 0).length;
  const provinceStatus = getLightingStatus(litCount, attractions.length);
  const allVisits = attractions.flatMap((item) => (visits[item.id] || []).map((visit) => ({ ...visit, attraction: item })));
  const firstVisit = allVisits.sort((a, b) => a.lit_at.localeCompare(b.lit_at))[0];

  return (
    <div className="province-page region-flow-page">
      <RegionHero
        title={province.name}
        subtitle={`中国 · ${province.region}`}
        status={provinceStatus.label}
        statusKey={provinceStatus.key}
        image={getRegionHero(province.id)}
        onBack={() => navigate('/map')}
      >
        <ProvinceOutlineMap provinceName={province.name} />
      </RegionHero>

      <section className="region-stat-grid" aria-label="省份点亮概览">
        <StatCard label="点亮进度" value={<>{progress}<small>%</small></>} progress={progress} detail={`已点亮 ${litCount}/${attractions.length} 个景点`} />
        <StatCard
          label="首次点亮"
          value={<span className="region-stat-date">{firstVisit ? firstVisit.lit_at.slice(0, 10).replace(/-/g, '.') : '--'}</span>}
          detail={firstVisit ? `首次点亮${firstVisit.attraction.city_name || province.name} · ${firstVisit.attraction.name}` : '点亮后记录时间'}
        />
      </section>

      <main className="province-city-panel region-content-panel">
        <header className="region-section-head">
          <h2>按城市点亮</h2>
          <span>已点亮 <strong>{litCities}</strong>/{citySummaries.length} 城市</span>
        </header>
        <div className="province-city-tools">
          <label className="region-search-box">
            <Search size={19} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索城市或景区" />
          </label>
          <RegionSelect
            value={statusFilter}
            options={[{ value: 'all', label: '全部状态' }, { value: 'unlit', label: '未点亮' }, { value: 'in_progress', label: '点亮中' }, { value: 'completed', label: '已全亮' }]}
            onChange={setStatusFilter}
            ariaLabel="点亮状态"
          />
          <RegionSelect
            value={citySort}
            options={[{ value: 'smart', label: '智能排序' }, { value: 'attractions_desc', label: '景区数量优先' }, { value: 'name_asc', label: '城市名称优先' }]}
            onChange={setCitySort}
            ariaLabel="城市排序"
          />
        </div>
        <div className="province-guide-strip"><Lightbulb size={18} /> 先选择城市，再进入城市页批量点亮景区</div>

        <div className="province-city-list">
          {filteredCities.map((city) => (
            <CityCard
              key={city.id}
              city={city}
              hero={getRegionHero(province.id)}
              query={search.trim()}
              onOpen={() => navigate(`/province/${province.id}/cities/${city.id}`)}
            />
          ))}
          {filteredCities.length === 0 && <div className="region-empty">没有找到匹配的城市</div>}
        </div>
        <footer className="province-city-footer"><MapPin size={20} /> 选择一个城市，开启你的点亮之旅</footer>
      </main>
    </div>
  );
}
function RegionHero({ title, subtitle, status, statusKey, image, onBack, children }: {
  title: string; subtitle: string; status: string; statusKey: string; image: string; onBack: () => void; children?: React.ReactNode;
}) {
  return (
    <section className="region-hero" style={{ backgroundImage: `url(${image})` }}>
      <button className="region-back" type="button" onClick={onBack} aria-label="返回"><ChevronRight size={32} /></button>
      {children}
      <div className="region-hero-copy"><h1>{title}</h1><p><MapPin size={18} /> {subtitle}</p><span className={`region-status-chip ${statusKey}`}><i />{status}</span></div>
    </section>
  );
}

function StatCard({ label, value, progress, detail }: { label: string; value: React.ReactNode; progress?: number; detail: string }) {
  return <article className="region-stat-card"><h3>{label}</h3><strong>{value}</strong>{progress !== undefined && <div className="region-progress"><i style={{ width: `${progress}%` }} /></div>}<p>{detail}</p></article>;
}

function CityCard({ city, hero, query, onOpen }: { city: CitySummary; hero: string; query: string; onOpen: () => void }) {
  const progress = city.total ? Math.round(city.lit / city.total * 100) : 0;
  return (
    <article className={`province-city-card ${city.status.key}`} onClick={onOpen}>
      <div className="city-cover" style={{ backgroundImage: `url(${hero})`, backgroundPosition: `${24 + (typeof city.id === 'number' ? city.id % 5 : 0) * 13}% center` }} />
      <div className="city-card-body">
        <div className="city-title-row"><h3>{city.name}</h3><span>{city.lit}/{city.total} 已点亮</span></div>
        <div className="region-progress"><i style={{ width: `${progress}%` }} /></div>
        <p>{city.fiveA ? `5A ${city.fiveA} 个` : '5A 0 个'} · {city.fourA ? `4A ${city.fourA} 个` : '4A 0 个'}</p>
        <p className="city-representatives">代表景点：{city.attractions.slice(0, 3).map((item) => item.name).join('、')}</p>
        {query && city.attractions.some((item) => item.name.includes(query)) && <em>包含“{query}”</em>}
      </div>
      <button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }}>进入点亮 <ChevronRight size={18} /></button>
    </article>
  );
}
