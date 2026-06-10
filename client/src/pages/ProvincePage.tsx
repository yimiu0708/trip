import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Attraction {
  id: number;
  name: string;
  level: string;
  category_name: string;
  province_name: string;
}

interface Category {
  id: number;
  name: string;
}

export default function ProvincePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [province, setProvince] = useState<any>(null);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [litIds, setLitIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const provinceId = Number(id);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await api.provinces.detail(provinceId);
      setProvince(detail.province);
      setAttractions(detail.attractions);
      // fetch categories from achievements endpoint workaround
      await api.achievements.list();
      // We'll build categories from attractions data instead
      const catMap = new Map<number, string>();
      detail.attractions.forEach((a: any) => {
        if (a.category_id && a.category_name) catMap.set(a.category_id, a.category_name);
      });
      setCategories(Array.from(catMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.id - b.id));

      if (user) {
        const list = await api.user.litList();
        const ids = new Set<number>(list.filter((a: any) => a.province_name === detail.province.name).map((a: any) => a.id));
        setLitIds(ids);
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

  const filtered = attractions.filter((a) => {
    if (search && !a.name.includes(search)) return false;
    if (categoryFilter !== '' && a.category_name !== categories.find((c) => c.id === categoryFilter)?.name) return false;
    if (levelFilter && a.level !== levelFilter) return false;
    return true;
  });

  const grouped5A = filtered.filter((a) => a.level === '5A');
  const grouped4A = filtered.filter((a) => a.level === '4A');

  const toggleSelect = (aid: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(aid)) next.delete(aid);
      else next.add(aid);
      return next;
    });
  };

  const handleBatchLit = async () => {
    if (!user) { setMessage('请先登录'); return; }
    if (selectedIds.size === 0) return;
    try {
      await api.attractions.batchLit(Array.from(selectedIds));
      setLitIds((prev) => new Set([...prev, ...selectedIds]));
      setSelectedIds(new Set());
      setMessage(`成功点亮 ${selectedIds.size} 个景区`);
      setTimeout(() => setMessage(''), 2000);
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const handleSingleLit = async (aid: number, lit: boolean) => {
    if (!user) { setMessage('请先登录'); return; }
    try {
      if (lit) {
        await api.attractions.unlit(aid);
        setLitIds((prev) => {
          const next = new Set(prev);
          next.delete(aid);
          return next;
        });
      } else {
        await api.attractions.lit(aid);
        setLitIds((prev) => new Set(prev).add(aid));
      }
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const selectAllInView = () => {
    const unlit = filtered.filter((a) => !litIds.has(a.id)).map((a) => a.id);
    if (unlit.length === 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      unlit.forEach((id) => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  if (loading) return <div className="page-loading">加载中...</div>;
  if (!province) return <div className="page-loading">省份不存在</div>;

  return (
    <div className="province-page">
      <div className="province-header">
        <button className="back-btn" onClick={() => navigate('/')}>← 返回地图</button>
        <h1>{province.name}</h1>
        <div className="province-meta">
          已点亮 {litIds.size}/{attractions.length} 个景区
        </div>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="搜索景区名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-input"
        />
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
        <button className="btn-primary" onClick={handleBatchLit} disabled={selectedIds.size === 0}>
          确认点亮 ({selectedIds.size})
        </button>
      </div>

      {grouped5A.length > 0 && (
        <section className="attraction-section">
          <h2>🏆 5A级景区 ({grouped5A.length})</h2>
          <div className="attraction-grid">
            {grouped5A.map((a) => (
              <AttractionCard
                key={a.id}
                a={a}
                lit={litIds.has(a.id)}
                selected={selectedIds.has(a.id)}
                onToggle={() => litIds.has(a.id) ? handleSingleLit(a.id, true) : toggleSelect(a.id)}
              />
            ))}
          </div>
        </section>
      )}

      {grouped4A.length > 0 && (
        <section className="attraction-section">
          <h2>⭐ 4A级景区 ({grouped4A.length})</h2>
          <div className="attraction-grid">
            {grouped4A.map((a) => (
              <AttractionCard
                key={a.id}
                a={a}
                lit={litIds.has(a.id)}
                selected={selectedIds.has(a.id)}
                onToggle={() => litIds.has(a.id) ? handleSingleLit(a.id, true) : toggleSelect(a.id)}
              />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && <div className="empty-state">未找到匹配的景区</div>}
    </div>
  );
}

function AttractionCard({ a, lit, selected, onToggle }: { a: Attraction; lit: boolean; selected: boolean; onToggle: () => void }) {
  return (
    <div className={`attraction-card ${lit ? 'lit' : ''} ${selected ? 'selected' : ''}`}>
      <div className="card-header">
        <span className={`level-tag level-${a.level}`}>{a.level}</span>
        {a.category_name && <span className="category-tag">{a.category_name}</span>}
      </div>
      <div className="card-name">{a.name}</div>
      <label className="card-check">
        <input
          type="checkbox"
          checked={lit || selected}
          onChange={onToggle}
        />
        <span>{lit ? '已点亮' : selected ? '待点亮' : '未点亮'}</span>
      </label>
    </div>
  );
}
