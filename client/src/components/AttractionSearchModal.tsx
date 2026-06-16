import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, MapPin, Search, Sparkles, X } from 'lucide-react';
import { api } from '../api/client';

interface AttractionSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AttractionResult {
  id: number;
  name: string;
  level?: string;
  province_name: string;
  city_name?: string;
  category_name?: string;
}

interface LitItem {
  id: number;
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AttractionSearchModal({ isOpen, onClose }: AttractionSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AttractionResult[]>([]);
  const [litIds, setLitIds] = useState<Set<number>>(new Set());
  const [litLoadingId, setLitLoadingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [litDate, setLitDate] = useState(() => formatDateInputValue(new Date()));

  const normalizedQuery = query.trim();
  const limitedResults = useMemo(() => results.slice(0, 18), [results]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setResults([]);
    setMessage('');
    setLitDate(formatDateInputValue(new Date()));
    api.user.litList()
      .then((items: LitItem[]) => {
        setLitIds(new Set(items.map((item) => item.id)));
      })
      .catch(() => setLitIds(new Set()));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!normalizedQuery) {
      setResults([]);
      setLoading(false);
      return;
    }

    let ignore = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      api.attractions.list({ q: normalizedQuery })
        .then((items: AttractionResult[]) => {
          if (!ignore) setResults(items);
        })
        .catch((err: Error) => {
          if (!ignore) {
            setResults([]);
            setMessage(err.message || '搜索失败');
          }
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }, 260);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, normalizedQuery]);

  const handleLight = async (attraction: AttractionResult) => {
    setLitLoadingId(attraction.id);
    setMessage('');
    try {
      const isoDate = new Date(`${litDate}T12:00:00`).toISOString();
      await api.attractions.lit(attraction.id, isoDate);
      setLitIds((prev) => new Set(prev).add(attraction.id));
      setMessage(`已点亮：${attraction.name}`);
      window.dispatchEvent(new Event('trip:progress-updated'));
      window.setTimeout(() => setMessage(''), 1800);
    } catch (err: any) {
      setMessage(err.message || '点亮失败');
    } finally {
      setLitLoadingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay attraction-search-overlay" onClick={onClose}>
      <div className="modal-content attraction-search-modal" onClick={(event) => event.stopPropagation()}>
        <button className="attraction-search-close" type="button" onClick={onClose} aria-label="关闭搜索">
          <X size={18} aria-hidden="true" />
        </button>

        <div className="attraction-search-head">
          <div className="attraction-search-icon">
            <Search size={22} aria-hidden="true" />
          </div>
          <div>
            <h2>搜索景点</h2>
            <p>找到去过的地方，一键点亮地图。</p>
          </div>
        </div>

        <label className="attraction-search-box">
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索景点名称或拼音"
          />
          {loading && <Loader2 className="attraction-search-spin" size={17} aria-hidden="true" />}
        </label>

        <label className="attraction-search-date">
          <span>点亮日期</span>
          <input
            type="date"
            value={litDate}
            onChange={(event) => setLitDate(event.target.value)}
          />
        </label>

        {message && <div className="attraction-search-message">{message}</div>}

        <div className="attraction-search-results">
          {!normalizedQuery && (
            <div className="attraction-search-empty">
              <Sparkles size={22} aria-hidden="true" />
              <span>输入景点名，快速记录你的旅行足迹</span>
            </div>
          )}
          {normalizedQuery && !loading && limitedResults.length === 0 && (
            <div className="attraction-search-empty">
              <MapPin size={22} aria-hidden="true" />
              <span>没有找到匹配景点</span>
            </div>
          )}
          {limitedResults.map((attraction) => {
            const isLit = litIds.has(attraction.id);
            const isLighting = litLoadingId === attraction.id;
            return (
              <article className="attraction-search-item" key={attraction.id}>
                <div className="attraction-search-item-main">
                  <div className="attraction-search-title-row">
                    <h3>{attraction.name}</h3>
                    {attraction.level && <span>{attraction.level}</span>}
                  </div>
                  <p>
                    {attraction.province_name}
                    {attraction.city_name ? ` · ${attraction.city_name}` : ''}
                  </p>
                  {attraction.category_name && <em>{attraction.category_name}</em>}
                </div>
                <button
                  type="button"
                  className={isLit ? 'lit' : ''}
                  disabled={isLighting}
                  onClick={() => handleLight(attraction)}
                >
                  {isLighting ? (
                    <Loader2 className="attraction-search-spin" size={15} aria-hidden="true" />
                  ) : isLit ? (
                    <CheckCircle2 size={15} aria-hidden="true" />
                  ) : (
                    <Sparkles size={15} aria-hidden="true" />
                  )}
                  <span>{isLit ? '再点亮' : '点亮'}</span>
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
