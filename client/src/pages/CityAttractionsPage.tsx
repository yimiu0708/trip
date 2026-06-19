import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Check, ChevronRight, Diamond, MapPin, Search, Star } from 'lucide-react';
import { api } from '../api/client';
import RegionSelect from '../components/RegionSelect';
import {
  buildVisitMap,
  getLightingStatus,
  getRegionHero,
  SPECIAL_PROVINCE_IDS,
  type ProvinceAttraction,
  type ProvinceDetail,
  type VisitMap,
} from '../lib/provinceDetail';

type StatusFilter = 'all' | 'unlit' | 'lit';

export default function CityAttractionsPage() {
  const { id, cityId = '' } = useParams<{ id: string; cityId: string }>();
  const provinceId = Number(id);
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ProvinceDetail | null>(null);
  const [visits, setVisits] = useState<VisitMap>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [litDate, setLitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const provinceDetail = await api.provinces.detail(provinceId) as ProvinceDetail;
      const list = await api.user.litList();
      setDetail(provinceDetail);
      setVisits(buildVisitMap(list, provinceDetail.province.name));
    } finally {
      setLoading(false);
    }
  }, [provinceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
    document.querySelector<HTMLElement>('.app-main')?.scrollTo({ top: 0, left: 0 });
  }, [cityId, provinceId]);

  const scopedAttractions = useMemo(() => {
    if (!detail) return [];
    if (cityId === 'all') return detail.attractions;
    if (cityId === 'unassigned') {
      const knownCityIds = new Set(detail.cities.map((city) => city.id));
      return detail.attractions.filter((item) => !item.city_id || !knownCityIds.has(item.city_id));
    }
    return detail.attractions.filter((item) => item.city_id === Number(cityId));
  }, [cityId, detail]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scopedAttractions.filter((item) => {
      const tags = (item.tags || []).map((tag) => tag.name);
      if (query && ![item.name, item.pinyin, ...tags].filter(Boolean).join(' ').toLowerCase().includes(query)) return false;
      if (status === 'lit' && !visits[item.id]?.length) return false;
      if (status === 'unlit' && visits[item.id]?.length) return false;
      if (category !== 'all' && !tags.includes(category)) return false;
      return true;
    });
  }, [category, scopedAttractions, search, status, visits]);

  const categories = useMemo(() => Array.from(new Set(scopedAttractions.flatMap((item) => (item.tags || []).map((tag) => tag.name)))), [scopedAttractions]);
  const litCount = scopedAttractions.filter((item) => visits[item.id]?.length).length;
  const totalVisits = scopedAttractions.reduce((sum, item) => sum + (visits[item.id]?.length || 0), 0);
  const statusMeta = getLightingStatus(litCount, scopedAttractions.length);
  const city = detail?.cities.find((item) => item.id === Number(cityId));
  const cityName = cityId === 'all' ? detail?.province.name : cityId === 'unassigned' ? '其他 / 未归属城市' : city?.name;
  const recentVisit = scopedAttractions
    .flatMap((item) => (visits[item.id] || []).map((visit) => ({ ...visit, attraction: item })))
    .sort((a, b) => b.lit_at.localeCompare(a.lit_at))[0];

  const recommended = useMemo(() => [...filtered]
    .sort((a, b) => Number(Boolean(visits[a.id]?.length)) - Number(Boolean(visits[b.id]?.length))
      || (b.level === '5A' ? 2 : b.level === '4A' ? 1 : 0) - (a.level === '5A' ? 2 : a.level === '4A' ? 1 : 0)
      || (a.pinyin || a.name).localeCompare(b.pinyin || b.name))
    .slice(0, 3), [filtered, visits]);

  const groups = useMemo(() => [
    { key: 'fiveA', title: '5A 景区', items: filtered.filter((item) => item.level === '5A') },
    { key: 'fourA', title: '4A 景区', items: filtered.filter((item) => item.level === '4A') },
    { key: 'other', title: '其他景区', items: filtered.filter((item) => !item.level) },
  ].filter((group) => group.items.length > 0), [filtered]);

  const toggle = (attractionId: number) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(attractionId)) next.delete(attractionId);
    else next.add(attractionId);
    return next;
  });

  const handleConfirm = async () => {
    if (!selected.size || submitting) return;
    setSubmitting(true);
    try {
      const result = await api.attractions.batchLit(Array.from(selected), new Date(`${litDate}T12:00:00`).toISOString());
      const achievementText = result.newAchievements?.length
        ? `，恭喜解锁：${result.newAchievements.map((item: any) => item.name).join('、')}` : '';
      setMessage(`点亮成功，新增 ${result.litIds?.length || selected.size} 条记录${achievementText}`);
      setSelected(new Set());
      await fetchData();
      window.setTimeout(() => setMessage(''), 3200);
    } catch (error: any) {
      setMessage(error.message || '点亮失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-loading">加载中...</div>;
  if (!detail || !cityName) return <div className="page-loading">城市不存在</div>;

  const progress = scopedAttractions.length ? Math.round(litCount / scopedAttractions.length * 100) : 0;
  const areaLabel = cityId === 'all' ? (provinceId <= 22 ? '全市景区' : '全区景区') : '景区点亮';

  return (
    <div className="city-attractions-page region-flow-page">
      <section className="region-hero" style={{ backgroundImage: `url(${getRegionHero(detail.province.id)})` }}>
        <button className="region-back" type="button" onClick={() => navigate(SPECIAL_PROVINCE_IDS.has(provinceId) ? '/map' : `/province/${provinceId}`)} aria-label={SPECIAL_PROVINCE_IDS.has(provinceId) ? '返回地图' : '返回省份'}><ChevronRight size={32} /></button>
        <div className="region-hero-copy"><h1>{cityName}</h1><p><MapPin size={18} /> {detail.province.name} · {areaLabel}</p><span className={`region-status-chip ${statusMeta.key}`}><i />{statusMeta.key === 'unlit' ? '城市未点亮' : statusMeta.key === 'completed' ? '城市已全亮' : '城市已点亮中'}</span></div>
      </section>

      <section className="region-stat-grid" aria-label="城市点亮概览">
        <article className="region-stat-card"><h3>城市进度</h3><strong>{litCount}<small>/{scopedAttractions.length}</small></strong><div className="region-progress"><i style={{ width: `${progress}%` }} /></div><p>已点亮 {litCount} 个景区</p></article>
        <article className="region-stat-card"><h3>最近点亮</h3><strong><span className="region-stat-date">{recentVisit ? recentVisit.lit_at.slice(0, 10).replace(/-/g, '.') : '--'}</span></strong><p>{recentVisit ? `${recentVisit.attraction.name} · ${recentVisit.attraction.tags?.[0]?.name || recentVisit.attraction.level || '旅行足迹'}` : '点亮后记录时间'}</p></article>
      </section>

      <main className="city-attraction-panel region-content-panel">
        <header className="region-section-head"><h2>{areaLabel}</h2><span>总访问 <strong>{totalVisits}</strong> 次</span></header>
        <div className="province-city-tools city-attraction-tools">
          <label className="region-search-box">
            <Search size={19} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索景区名称" />
          </label>
          <RegionSelect
            value={status}
            options={[{ value: 'all', label: '全部状态' }, { value: 'unlit', label: '未点亮' }, { value: 'lit', label: '已点亮' }]}
            onChange={setStatus}
            ariaLabel="点亮状态"
          />
          <RegionSelect
            value={category}
            options={[{ value: 'all', label: '全部分类' }, ...categories.map((item) => ({ value: item, label: item }))]}
            onChange={setCategory}
            ariaLabel="景区分类"
          />
        </div>

        {filtered.length > 0 ? <div className="attraction-groups">
          <AttractionGroup title="推荐优先点亮" icon={<Star size={19} fill="currentColor" />} items={recommended} selected={selected} visits={visits} onToggle={toggle} alwaysOpen />
          {groups.map((group) => <AttractionGroup key={group.key} title={group.title} icon={<Diamond size={18} />} items={group.items} selected={selected} visits={visits} onToggle={toggle} expanded={expanded.has(group.key)} onExpand={() => setExpanded((current) => {
            const next = new Set(current);
            if (next.has(group.key)) next.delete(group.key);
            else next.add(group.key);
            return next;
          })} />)}
        </div> : <div className="region-empty">没有找到匹配的景区</div>}
      </main>

      {message && <div className="region-toast">{message}</div>}
      <footer className="lighting-action-bar">
        <button type="button" className="clear-selection" onClick={() => setSelected(new Set())}>取消选择</button>
        <button type="button" className="confirm-lighting" disabled={!selected.size || submitting} onClick={handleConfirm}>{submitting ? '正在点亮...' : `确认点亮（${selected.size}）`}</button>
        <label className="lighting-date"><span>点亮日期</span><input type="date" value={litDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setLitDate(event.target.value)} /><CalendarDays size={21} /></label>
      </footer>
    </div>
  );
}

function AttractionGroup({ title, icon, items, selected, visits, onToggle, expanded = false, onExpand, alwaysOpen = false }: {
  title: string; icon: React.ReactNode; items: ProvinceAttraction[]; selected: Set<number>; visits: VisitMap; onToggle: (id: number) => void; expanded?: boolean; onExpand?: () => void; alwaysOpen?: boolean;
}) {
  const visible = alwaysOpen || expanded ? items : items.slice(0, 3);
  const hiddenCount = Math.max(0, items.length - 3);
  return <section className="attraction-group"><header><h3>{icon}{title}</h3>{hiddenCount > 0 && onExpand && <button type="button" onClick={onExpand}>{expanded ? '收起' : '查看全部'} <ChevronRight size={16} /></button>}</header><div>{visible.map((item) => <AttractionRow key={item.id} attraction={item} selected={selected.has(item.id)} visits={visits[item.id]?.length || 0} onToggle={() => onToggle(item.id)} />)}</div>{hiddenCount > 0 && onExpand && <button className="group-more" type="button" onClick={onExpand}>{expanded ? '收起景区' : `查看更多 ${hiddenCount} 个景区`} <ChevronRight size={16} /></button>}</section>;
}

function AttractionRow({ attraction, selected, visits, onToggle }: { attraction: ProvinceAttraction; selected: boolean; visits: number; onToggle: () => void }) {
  return <label className={`attraction-row ${selected ? 'selected' : ''}`}><input type="checkbox" checked={selected} onChange={onToggle} /><span className="attraction-check">{selected && <Check size={17} />}</span><span className="attraction-thumb" style={{ backgroundImage: 'url(/images/province-hero-qinghai-v022.png)' }} /><strong>{attraction.name}</strong>{attraction.level && <em className={`level-${attraction.level.toLowerCase()}`}>{attraction.level}</em>}<span className="attraction-tags">{(attraction.tags || []).slice(0, 2).map((tag) => <i key={tag.id}>{tag.name}</i>)}</span>{visits > 0 && <small>已点亮 {visits} 次</small>}</label>;
}
