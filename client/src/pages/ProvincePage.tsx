import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Clock3 } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ProvinceOutlineMap from '../components/ProvinceOutlineMap';
import { shortLocationName } from '../lib/location';
import { formatRecallTime } from '../lib/recallTime';

interface Attraction {
  id: number;
  name: string;
  level: string;
  category_name?: string;
  province_name: string;
  city_name?: string;
  tags?: { id: number; name: string }[];
}

interface LitVisit {
  lit_at: string;
  time_precision?: string | null;
  season?: string | null;
  display_time_text?: string | null;
  source?: string | null;
}

interface Category {
  id: number;
  name: string;
}

interface City {
  id: number;
  name: string;
  total_count: number;
  lit_count: number;
}

export default function ProvincePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [province, setProvince] = useState<any>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [litVisits, setLitVisits] = useState<Record<number, LitVisit[]>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [dateModal, setDateModal] = useState<{ open: boolean; ids: number[] }>({ open: false, ids: [] });
  const [litDate, setLitDate] = useState(() => new Date().toISOString().slice(0, 10));

  const provinceId = Number(id);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await api.provinces.detail(provinceId);
      setProvince(detail.province);
      setCities(detail.cities || []);
      setAttractions(detail.attractions);

      const catMap = new Map<number, string>();
      detail.attractions.forEach((a: any) => {
        (a.tags || []).forEach((t: any) => {
          if (t.id && t.name) catMap.set(t.id, t.name);
        });
      });
      setCategories(Array.from(catMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.id - b.id));

      if (user) {
        const list = await api.user.litList();
        const visits: Record<number, LitVisit[]> = {};
        list.forEach((item: any) => {
          if (item.province_name === detail.province.name) {
            visits[item.id] = visits[item.id] || [];
            visits[item.id].push({
              lit_at: item.lit_at,
              time_precision: item.time_precision,
              season: item.season,
              display_time_text: item.display_time_text,
              source: item.source,
            });
          }
        });
        Object.values(visits).forEach((items) => {
          items.sort((a, b) => b.lit_at.localeCompare(a.lit_at));
        });
        setLitVisits(visits);
      } else {
        setLitVisits({});
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [provinceId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const [cityFilter, setCityFilter] = useState<number | ''>('');

  const filtered = attractions.filter((a: any) => {
    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch) {
      const tagNames = (a.tags || []).map((t: any) => t.name).join(' ');
      const haystack = [a.name, tagNames, a.city_name, a.level]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(normalizedSearch)) return false;
    }
    if (cityFilter !== '' && a.city_name !== cities.find((c) => c.id === cityFilter)?.name) return false;
    if (categoryFilter !== '') {
      const hasTag = (a.tags || []).some((t: any) => t.id === categoryFilter);
      if (!hasTag) return false;
    }
    if (levelFilter && a.level !== levelFilter) return false;
    return true;
  });

  // 按城市分组展示
  const groupedByCity = filtered.reduce<Record<string, Attraction[]>>((acc, a) => {
    const key = a.city_name || province?.name;
    if (!key) return acc;
    acc[key] = acc[key] || [];
    acc[key].push(a);
    return acc;
  }, {});
  // 保持城市顺序：按 cities 列表顺序，然后是未匹配的城市
  const cityOrder = cities
    .filter((c) => groupedByCity[c.name])
    .map((c) => c.name)
    .concat(Object.keys(groupedByCity).filter((name) => !cities.some((c) => c.name === name)));

  const toggleSelect = (aid: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(aid)) next.delete(aid);
      else next.add(aid);
      return next;
    });
  };

  const openDateModal = (ids: number[]) => {
    setLitDate(new Date().toISOString().slice(0, 10));
    setDateModal({ open: true, ids });
  };

  const handleConfirmLit = async () => {
    if (!user || dateModal.ids.length === 0) return;
    const isoDate = new Date(litDate).toISOString();
    try {
      let confirmedIds = dateModal.ids;
      let skippedCount = 0;
      if (dateModal.ids.length === 1) {
        await api.attractions.lit(dateModal.ids[0], isoDate);
      } else {
        const result = await api.attractions.batchLit(dateModal.ids, isoDate);
        confirmedIds = Array.isArray(result.litIds) ? result.litIds : dateModal.ids;
        skippedCount = Array.isArray(result.skippedIds) ? result.skippedIds.length : 0;
      }
      setLitVisits((prev) => {
        const next = { ...prev };
        confirmedIds.forEach((id) => {
          next[id] = [{ lit_at: isoDate }, ...(next[id] || [])];
        });
        return next;
      });
      setSelectedIds(new Set());
      setMessage(skippedCount > 0
        ? `成功记录 ${confirmedIds.length} 个景区，跳过 ${skippedCount} 个不可点亮景区`
        : `成功记录 ${confirmedIds.length} 个景区`);
      setDateModal({ open: false, ids: [] });
      setTimeout(() => setMessage(''), 2000);
    } catch (err: any) {
      setMessage(err.message);
      setDateModal({ open: false, ids: [] });
    }
  };

  const handleUnlit = async (aid: number) => {
    if (!user) { setMessage('请先登录'); return; }
    try {
      await api.attractions.unlit(aid);
      setLitVisits((prev) => {
        const next = { ...prev };
        const visits = next[aid]?.slice(1) || [];
        if (visits.length > 0) next[aid] = visits;
        else delete next[aid];
        return next;
      });
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const selectAllInView = () => {
    const unlit = filtered.filter((a) => !litVisits[a.id]?.length).map((a) => a.id);
    if (unlit.length === 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      unlit.forEach((id) => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const litAttractionsCount = Object.keys(litVisits).length;
  const totalVisits = Object.values(litVisits).reduce((sum, visits) => sum + visits.length, 0);
  const progressPct = attractions.length > 0 ? Math.round((litAttractionsCount / attractions.length) * 100) : 0;
  const firstLitDate = Object.values(litVisits)
    .flat()
    .map((visit) => visit.lit_at)
    .sort((a, b) => a.localeCompare(b))[0];
  const heroImage = getProvinceHeroImage(province?.id);

  if (loading) return <div className="page-loading">加载中...</div>;
  if (!province) return <div className="page-loading">省份不存在</div>;

  return (
    <div className="province-page">
      <section
        className={`province-hero-detail ${heroImage ? 'has-image' : ''}`}
        style={heroImage ? { backgroundImage: `linear-gradient(180deg, rgba(8,42,68,0.16), rgba(8,42,68,0.52)), url(${heroImage})` } : undefined}
      >
        <button className="province-hero-back" onClick={() => navigate('/map')} aria-label="返回地图">‹</button>
        <ProvinceOutlineMap provinceName={province.name} />
        <div className="province-hero-content">
          <h1>{province.name}</h1>
          <p><MapPin size={15} aria-hidden="true" /> 中国 · {province.region}</p>
          <span className={litAttractionsCount > 0 ? 'province-lit-chip' : 'province-lit-chip muted'}>
            {litAttractionsCount > 0 ? '已点亮' : '未点亮'}
          </span>
        </div>
      </section>

      <div className="province-summary-grid">
        <div className="province-summary-card">
          <span>点亮进度</span>
          <strong>{progressPct}<small>%</small></strong>
          <div className="province-summary-progress"><div style={{ width: `${progressPct}%` }} /></div>
          <p>已点亮 {litAttractionsCount}/{attractions.length} 个景点</p>
        </div>
        <div className="province-summary-card">
          <span>首次点亮</span>
          <strong className="date-strong">{firstLitDate ? firstLitDate.slice(0, 10).replace(/-/g, '.') : '--'}</strong>
          <p><Clock3 size={14} aria-hidden="true" /> {firstLitDate ? '首次点亮此地区' : '点亮后记录时间'}</p>
        </div>
      </div>

      <div className="province-header province-record-header">
        <h2>点亮记录</h2>
        <div className="province-meta">
          总访问 {totalVisits} 次
        </div>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="搜索景点名称、类型或所在城市..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-input"
        />
        <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value === '' ? '' : Number(e.target.value))} className="filter-select">
          <option value="">全部城市</option>
          {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value === '' ? '' : Number(e.target.value))} className="filter-select">
          <option value="">全部分类</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="filter-select">
          <option value="">全部等级</option>
          <option value="5A">5A</option>
          <option value="4A">4A</option>
        </select>
      </div>

      {message && <div className="toast">{message}</div>}

      <div className="batch-actions">
        <button className="btn-small" onClick={selectAllInView}>全选未点亮</button>
        <button className="btn-small" onClick={clearSelection}>取消选择</button>
        <button className="btn-primary" onClick={() => openDateModal(Array.from(selectedIds))} disabled={selectedIds.size === 0}>
          确认点亮 ({selectedIds.size})
        </button>
      </div>

      {cityOrder.map((cityName) => {
        const cityAttractions = groupedByCity[cityName];
        return (
          <section key={cityName} className="attraction-section">
            <h2>
              <MapPin size={16} aria-hidden="true" /> {shortLocationName(cityName)}
              <span className="city-count">{cityAttractions.length}</span>
            </h2>
            <div className="attraction-grid">
              {cityAttractions.map((a) => (
                <AttractionCard
                  key={a.id}
                  a={a}
                  visits={litVisits[a.id] || []}
                  selected={selectedIds.has(a.id)}
                  onToggle={() => litVisits[a.id]?.length ? handleUnlit(a.id) : toggleSelect(a.id)}
                  onLitDate={() => openDateModal([a.id])}
                />
              ))}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 && <div className="empty-state">未找到匹配的景区</div>}

      {/* 日期选择弹窗 */}
      {dateModal.open && (
        <div className="modal-overlay" onClick={() => setDateModal({ open: false, ids: [] })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: '17px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={20} aria-hidden="true" /> 选择游览日期
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#64748b' }}>
              将记录 {dateModal.ids.length} 个景区的点亮时间
            </p>
            <input
              type="date"
              value={litDate}
              onChange={(e) => setLitDate(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                fontSize: '15px',
                marginBottom: '16px',
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-small"
                style={{ flex: 1 }}
                onClick={() => setDateModal({ open: false, ids: [] })}
              >
                取消
              </button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleConfirmLit}>
                确认记录
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AttractionCard({
  a,
  visits,
  selected,
  onToggle,
  onLitDate,
}: {
  a: Attraction;
  visits: LitVisit[];
  selected: boolean;
  onToggle: () => void;
  onLitDate: () => void;
}) {
  const count = visits.length;

  return (
    <div className={`attraction-card ${count > 0 ? 'lit' : ''} ${selected ? 'selected' : ''}`}>
      <div className="card-header">
        {a.level && <span className={`level-tag level-${a.level}`}>{a.level}</span>}
        {(a.tags || []).map((t) => (
          <span key={t.id} className="category-tag">{t.name}</span>
        ))}
      </div>
      <div className="card-name">{a.name}</div>
      {count > 0 && (
        <>
          <div style={{ fontSize: '11px', color: '#2F9EAA', fontWeight: 600, marginBottom: '8px' }}>
            已点亮 {count} 次
          </div>
          <div className="visit-dates" aria-label={`${a.name} 点亮日期`}>
            {visits.map((visit, index) => (
              <span key={`${visit.lit_at}-${index}`} className="visit-date">
                {formatRecallTime(visit)}
              </span>
            ))}
          </div>
        </>
      )}
      <div className="card-actions">
        {count > 0 ? (
          <>
            <button className="btn-lit-again" onClick={onLitDate}>+ 再次点亮</button>
            <button className="btn-unlit" onClick={onToggle}>取消</button>
          </>
        ) : (
          <label className="card-check">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
            />
            <span>{selected ? '待点亮' : '未点亮'}</span>
          </label>
        )}
      </div>
    </div>
  );
}

function getProvinceHeroImage(provinceId?: number) {
  if (provinceId === 25) return '/images/province-hero-yunnan.png';
  return '';
}
