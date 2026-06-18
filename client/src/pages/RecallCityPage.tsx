import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Search, X } from 'lucide-react';
import { api } from '../api/client';
import { useRecall, type RecallCity } from '../context/RecallContext';
import { trackRecallEvent } from '../lib/analytics';
import { formatLocation } from '../lib/location';

interface ProvinceOption {
  id: number;
  name: string;
  total_count?: number;
}

const MAX_SELECTED_CITIES = 20;
type CityBrowseMode = 'hot' | 'province';

export default function RecallCityPage() {
  const navigate = useNavigate();
  const { selectedCities, toggleCity, removeCity } = useRecall();
  const [query, setQuery] = useState('');
  const [browseMode, setBrowseMode] = useState<CityBrowseMode>('hot');
  const [hotCities, setHotCities] = useState<RecallCity[]>([]);
  const [searchResults, setSearchResults] = useState<RecallCity[]>([]);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [activeProvinceId, setActiveProvinceId] = useState<number | ''>('');
  const [provinceCities, setProvinceCities] = useState<RecallCity[]>([]);
  const [hotLoading, setHotLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [provinceLoading, setProvinceLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectionMessage, setSelectionMessage] = useState('');

  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const selectedCityIds = useMemo(() => new Set(selectedCities.map((city) => city.id)), [selectedCities]);

  useEffect(() => {
    let ignore = false;
    setHotLoading(true);
    setError('');
    Promise.all([
      api.recall.hotCities(18),
      api.provinces.list(),
    ])
      .then(([cities, provinceList]) => {
        if (ignore) return;
        setHotCities(Array.isArray(cities) ? cities : []);
        setProvinces(Array.isArray(provinceList) ? provinceList : []);
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof Error ? err.message : '城市数据加载失败');
      })
      .finally(() => {
        if (!ignore) setHotLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let ignore = false;
    setSearchLoading(true);
    api.recall.searchCities(trimmedQuery, 30)
      .then((cities) => {
        if (!ignore) setSearchResults(Array.isArray(cities) ? cities : []);
      })
      .catch(() => {
        if (!ignore) setSearchResults([]);
      })
      .finally(() => {
        if (!ignore) setSearchLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [trimmedQuery]);

  useEffect(() => {
    if (!activeProvinceId) {
      setProvinceCities([]);
      return;
    }

    let ignore = false;
    setProvinceLoading(true);
    api.recall.provinceCities(Number(activeProvinceId))
      .then((data) => {
        if (!ignore) setProvinceCities(Array.isArray(data.cities) ? data.cities : []);
      })
      .catch(() => {
        if (!ignore) setProvinceCities([]);
      })
      .finally(() => {
        if (!ignore) setProvinceLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [activeProvinceId]);

  const handleToggleCity = (city: RecallCity, source: 'search' | 'hot' | 'province') => {
    const alreadySelected = selectedCityIds.has(city.id);
    if (!alreadySelected && selectedCities.length >= MAX_SELECTED_CITIES) {
      setSelectionMessage(`一次最多选择 ${MAX_SELECTED_CITIES} 个城市`);
      window.setTimeout(() => setSelectionMessage(''), 2200);
      return;
    }
    trackRecallEvent('recall_city_select', {
      city_id: city.id,
      city_name: city.name,
      province_id: city.province_id,
      selected: !alreadySelected,
      selected_city_count: alreadySelected ? selectedCities.length - 1 : selectedCities.length + 1,
      source,
    });
    toggleCity(city);
    setSelectionMessage('');
  };

  const goNext = () => {
    if (selectedCities.length === 0) return;
    trackRecallEvent('recall_city_next_click', {
      selected_city_count: selectedCities.length,
    });
    navigate('/recall/confirm');
  };

  return (
    <div className="recall-page recall-city-page">
      <section className="recall-city-tools" aria-label="查找城市">
        <div className="recall-city-search-head">
          <h2>从哪座城市开始？</h2>
          <span>{trimmedQuery ? `${searchResults.length} 个结果` : '最多选择 20 个'}</span>
        </div>
        <label className="recall-search" aria-label="搜索城市">
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索北京 / 上海 / 成都"
          />
        </label>
        <div className="recall-city-tabs" role="tablist" aria-label="城市浏览方式">
          <button
            type="button"
            role="tab"
            aria-selected={browseMode === 'hot'}
            className={browseMode === 'hot' ? 'active' : ''}
            onClick={() => setBrowseMode('hot')}
          >
            热门城市
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={browseMode === 'province'}
            className={browseMode === 'province' ? 'active' : ''}
            onClick={() => setBrowseMode('province')}
          >
            按省份找
          </button>
        </div>
      </section>

      {trimmedQuery ? (
        <section className="recall-city-section" aria-label="城市搜索结果">
          <div className="recall-section-head">
            <h2>搜索结果</h2>
            <span>{searchLoading ? '正在查找' : `${searchResults.length} 个城市`}</span>
          </div>
          <CityGrid
            cities={searchResults}
            loading={searchLoading}
            selectedCityIds={selectedCityIds}
            onToggleCity={handleToggleCity}
            source="search"
            emptyText="没有找到匹配城市"
          />
        </section>
      ) : browseMode === 'hot' ? (
        <section className="recall-city-section" role="tabpanel" aria-label="热门城市">
        <div className="recall-section-head">
          <h2>热门城市</h2>
          <span>轻点即可选择</span>
        </div>
        {error && <div className="recall-empty">{error}</div>}
        {!error && (
          <CityPills
            cities={hotCities}
            loading={hotLoading}
            selectedCityIds={selectedCityIds}
            onToggleCity={handleToggleCity}
            source="hot"
            emptyText="暂无热门城市"
          />
        )}
        </section>
      ) : (
        <section className="recall-city-section" role="tabpanel" aria-label="按省份找城市">
          <div className="recall-section-head">
            <h2>按省份找城市</h2>
            <span>{provinceCities.length > 0 ? `${provinceCities.length} 个城市` : '先选择省份'}</span>
          </div>
          <label className="recall-field recall-province-picker">
            <span>省份</span>
            <select value={activeProvinceId} onChange={(event) => setActiveProvinceId(event.target.value ? Number(event.target.value) : '')}>
              <option value="">请选择省份</option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>{province.name}</option>
              ))}
            </select>
          </label>
          {activeProvinceId ? (
            <CityPills
              cities={provinceCities}
              loading={provinceLoading}
              selectedCityIds={selectedCityIds}
              onToggleCity={handleToggleCity}
              source="province"
              emptyText="这个省份暂无可补录城市"
            />
          ) : (
            <div className="recall-province-placeholder">选择一个省份，这里的城市会立即更新。</div>
          )}
        </section>
      )}

      {selectionMessage && (
        <div className="recall-floating-message" role="status" aria-live="polite">{selectionMessage}</div>
      )}

      <div className="recall-selected-bar">
        <div className="recall-selected-summary">
          <strong>已选 {selectedCities.length} 个城市</strong>
          <span>{selectedCities.length === 0 ? '至少选择 1 个城市' : selectedCities.map((city) => city.name).join('、')}</span>
        </div>
        {selectedCities.length > 0 && (
          <div className="recall-selected-chips" aria-label="已选城市">
            {selectedCities.map((city) => (
              <button key={city.id} type="button" onClick={() => removeCity(city.id)} aria-label={`移除${city.name}`}>
                <span>{city.name}</span>
                <X size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="recall-primary-btn"
          disabled={selectedCities.length === 0}
          onClick={goNext}
        >
          下一步 · 确认景区
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function CityPills({
  cities,
  loading,
  selectedCityIds,
  onToggleCity,
  source,
  emptyText,
}: {
  cities: RecallCity[];
  loading: boolean;
  selectedCityIds: Set<number>;
  onToggleCity: (city: RecallCity, source: 'search' | 'hot' | 'province') => void;
  source: 'hot' | 'province';
  emptyText: string;
}) {
  if (loading) return <div className="recall-empty">城市加载中...</div>;
  if (cities.length === 0) return <div className="recall-empty">{emptyText}</div>;

  return (
    <div className="recall-city-pills">
      {cities.map((city) => {
        const selected = selectedCityIds.has(city.id);
        return (
          <button
            key={city.id}
            type="button"
            className={selected ? 'selected' : ''}
            onClick={() => onToggleCity(city, source)}
            aria-pressed={selected}
          >
            <span>{city.name}</span>
            {selected && <Check size={15} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

function CityGrid({
  cities,
  loading,
  selectedCityIds,
  onToggleCity,
  source,
  emptyText,
}: {
  cities: RecallCity[];
  loading: boolean;
  selectedCityIds: Set<number>;
  onToggleCity: (city: RecallCity, source: 'search' | 'hot' | 'province') => void;
  source: 'search' | 'hot' | 'province';
  emptyText: string;
}) {
  if (loading) return <div className="recall-empty">城市加载中...</div>;
  if (cities.length === 0) return <div className="recall-empty">{emptyText}</div>;

  return (
    <div className="recall-city-grid">
      {cities.map((city) => {
        const selected = selectedCityIds.has(city.id);
        return (
          <button
            key={city.id}
            type="button"
            className={`recall-city-tile${selected ? ' selected' : ''}`}
            onClick={() => onToggleCity(city, source)}
            aria-pressed={selected}
          >
            <span className="recall-city-check" aria-hidden="true">
              {selected && <Check size={14} />}
            </span>
            <strong>{city.name}</strong>
            <em>{formatLocation(city.province_name, city.name)} · {city.total_attractions || 0} 个景区</em>
          </button>
        );
      })}
    </div>
  );
}
