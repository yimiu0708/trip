import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type UIEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Check, ChevronDown, CircleAlert, Clock3, LoaderCircle, Search, SlidersHorizontal, X } from 'lucide-react';
import { api } from '../api/client';
import RegionSelect from '../components/RegionSelect';
import { useRecall, type RecallAttraction } from '../context/RecallContext';
import { trackRecallEvent } from '../lib/analytics';

type RecallPrecision = 'exact' | 'month' | 'year' | 'season' | 'unknown';
type RecallSeason = 'spring' | 'summer' | 'autumn' | 'winter';
type LevelFilter = 'all' | '5A' | '4A';

interface LitVisit {
  id: number;
}

interface UserProgressSnapshot {
  provinces: number;
  cities: number;
  attractions: number;
  visits: number;
}

const SEASON_START_MONTH: Record<RecallSeason, string> = {
  spring: '03',
  summer: '06',
  autumn: '09',
  winter: '12',
};

const SEASON_LABELS: Record<RecallSeason, string> = {
  spring: '春天',
  summer: '夏天',
  autumn: '秋天',
  winter: '冬天',
};

const MIN_RECALL_YEAR = 1980;
const YEAR_WHEEL_ITEM_HEIGHT = 44;
const YEAR_OPTIONS = Array.from(
  { length: new Date().getFullYear() - MIN_RECALL_YEAR + 1 },
  (_, index) => String(new Date().getFullYear() - index),
);

function todayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentMonthValue() {
  return todayDateValue().slice(0, 7);
}

function currentYearValue() {
  return String(new Date().getFullYear());
}

function YearWheelPicker({ value, onChange }: { value: string; onChange: (year: string) => void }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, YEAR_OPTIONS.indexOf(value));

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const targetTop = selectedIndex * YEAR_WHEEL_ITEM_HEIGHT;
    if (Math.abs(scroller.scrollTop - targetTop) > YEAR_WHEEL_ITEM_HEIGHT / 2 + 1) {
      scroller.scrollTop = targetTop;
    }
  }, [selectedIndex]);

  const selectIndex = (index: number, smooth = false) => {
    const nextIndex = Math.max(0, Math.min(YEAR_OPTIONS.length - 1, index));
    const nextYear = YEAR_OPTIONS[nextIndex];
    if (nextYear !== value) onChange(nextYear);
    scrollerRef.current?.scrollTo({
      top: nextIndex * YEAR_WHEEL_ITEM_HEIGHT,
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    selectIndex(Math.round(event.currentTarget.scrollTop / YEAR_WHEEL_ITEM_HEIGHT));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectIndex(selectedIndex - 1, true);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectIndex(selectedIndex + 1, true);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectIndex(0, true);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectIndex(YEAR_OPTIONS.length - 1, true);
    }
  };

  return (
    <div className="recall-year-wheel-wrap">
      <div
        ref={scrollerRef}
        className="recall-year-wheel"
        role="listbox"
        aria-label="选择年份"
        aria-activedescendant={`recall-year-${value}`}
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
      >
        {YEAR_OPTIONS.map((year) => (
          <button
            id={`recall-year-${year}`}
            key={year}
            type="button"
            role="option"
            aria-selected={year === value}
            className={year === value ? 'selected' : ''}
            onClick={() => selectIndex(YEAR_OPTIONS.indexOf(year), true)}
          >
            <span>{year}</span>
            <small>年</small>
          </button>
        ))}
      </div>
      <span className="recall-year-wheel-hint">上下滑动选择</span>
    </div>
  );
}

export default function RecallConfirmPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedSeason = searchParams.get('season') as RecallSeason | null;
  const {
    draftReady,
    selectedCity,
    selectedCities,
    selectedAttractionIds,
    toggleAttraction,
    setLastResult,
  } = useRecall();
  const [attractions, setAttractions] = useState<RecallAttraction[]>([]);
  const [litVisitCount, setLitVisitCount] = useState<Map<number, number>>(() => new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeCityId, setActiveCityId] = useState<number | null>(() => selectedCities[0]?.id || null);
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [timeOptionsOpen, setTimeOptionsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [precision, setPrecision] = useState<RecallPrecision>(requestedSeason && ['spring', 'summer', 'autumn', 'winter'].includes(requestedSeason) ? 'season' : 'unknown');
  const [exactDate, setExactDate] = useState(todayDateValue);
  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [yearValue, setYearValue] = useState(currentYearValue);
  const [seasonYear, setSeasonYear] = useState(currentYearValue);
  const [season, setSeason] = useState<RecallSeason>(requestedSeason && ['spring', 'summer', 'autumn', 'winter'].includes(requestedSeason) ? requestedSeason : 'summer');

  useEffect(() => {
    if (selectedCities.length === 0) return;
    let ignore = false;
    setLoading(true);
    setError('');

    Promise.all([
      Promise.all(selectedCities.map((city) => api.recall.cityAttractions(city.id))),
      api.user.litList().catch(() => []),
    ])
      .then(([cityResults, litList]) => {
        if (ignore) return;
        const merged = cityResults.flatMap((data) => (Array.isArray(data.attractions) ? data.attractions : []));
        const counts = new Map<number, number>();
        if (Array.isArray(litList)) {
          litList.forEach((visit: LitVisit) => {
            counts.set(visit.id, (counts.get(visit.id) || 0) + 1);
          });
        }
        setAttractions(merged);
        setLitVisitCount(counts);
      })
      .catch((err) => {
        if (ignore) return;
        setAttractions([]);
        setError(err instanceof Error ? err.message : '景区加载失败');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [selectedCities]);

  useEffect(() => {
    if (selectedCities.length === 0) {
      setActiveCityId(null);
      return;
    }
    if (!selectedCities.some((city) => city.id === activeCityId)) {
      setActiveCityId(selectedCities[0].id);
    }
  }, [activeCityId, selectedCities]);

  const activeCity = useMemo(
    () => selectedCities.find((city) => city.id === activeCityId) || selectedCities[0],
    [activeCityId, selectedCities],
  );

  const activeCityAttractions = useMemo(
    () => attractions.filter((attraction) => attraction.city_id === activeCity?.id),
    [activeCity?.id, attractions],
  );

  const categoryOptions = useMemo(() => {
    const names = new Set<string>();
    activeCityAttractions.forEach((attraction) => {
      getAttractionCategories(attraction).forEach((name) => names.add(name));
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [activeCityAttractions]);

  const filteredAttractions = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-Hans-CN');
    return activeCityAttractions.filter((attraction) => {
      if (keyword && !attraction.name.toLocaleLowerCase('zh-Hans-CN').includes(keyword)) return false;
      if (levelFilter !== 'all' && attraction.level !== levelFilter) return false;
      if (categoryFilter !== 'all' && !getAttractionCategories(attraction).includes(categoryFilter)) return false;
      return true;
    });
  }, [activeCityAttractions, categoryFilter, levelFilter, query]);

  const cityTabs = useMemo(() => {
    return selectedCities.map((city) => ({
      city,
      total: attractions.filter((attraction) => attraction.city_id === city.id).length,
      selected: attractions.filter(
        (attraction) => attraction.city_id === city.id && selectedAttractionIds.includes(attraction.id),
      ).length,
    }));
  }, [attractions, selectedAttractionIds, selectedCities]);

  const selectedAttractions = useMemo(
    () => attractions.filter((attraction) => selectedAttractionIds.includes(attraction.id)),
    [attractions, selectedAttractionIds],
  );

  const selectedLitAgainCount = selectedAttractionIds.filter((id) => litVisitCount.has(id)).length;
  const submitStats = useMemo(() => {
    const selectedCityIds = new Set(
      selectedAttractions
        .map((attraction) => attraction.city_id)
        .filter((cityId): cityId is number => typeof cityId === 'number'),
    );
    return {
      cities: selectedCityIds.size || (selectedAttractionIds.length > 0 ? selectedCities.length : 0),
      attractions: selectedAttractionIds.length,
      visits: selectedAttractionIds.length,
    };
  }, [selectedAttractionIds.length, selectedAttractions, selectedCities.length]);
  const timePreview = useMemo(() => buildRecallTimePayload(precision, {
    exactDate,
    monthValue,
    yearValue,
    seasonYear,
    season,
  }), [exactDate, monthValue, precision, season, seasonYear, yearValue]);

  const handleToggleAttraction = (attraction: RecallAttraction) => {
    const alreadySelected = selectedAttractionIds.includes(attraction.id);
    trackRecallEvent('recall_attraction_select', {
      attraction_id: attraction.id,
      attraction_name: attraction.name,
      city_id: attraction.city_id || null,
      selected: !alreadySelected,
      already_lit: litVisitCount.has(attraction.id),
      selected_attraction_count: alreadySelected ? selectedAttractionIds.length - 1 : selectedAttractionIds.length + 1,
    });
    toggleAttraction(attraction.id);
  };

  const handleCityChange = (cityId: number) => {
    setActiveCityId(cityId);
    setQuery('');
    setCategoryFilter('all');
  };

  const openConfirmModal = () => {
    if (selectedAttractionIds.length === 0) return;
    trackRecallEvent('recall_confirm_modal_view', {
      selected_city_count: submitStats.cities,
      selected_attraction_count: submitStats.attractions,
      visit_count: submitStats.visits,
      repeat_visit_count: selectedLitAgainCount,
    });
    setModalOpen(true);
  };

  const submitRecall = async () => {
    if (selectedAttractionIds.length === 0 || submitting) return;
    if (timePreview.error) {
      setSubmitError(timePreview.error);
      return;
    }
    setSubmitting(true);
    setSubmitError('');

    const payload = buildRecallPayload(selectedAttractionIds, precision, {
      exactDate,
      monthValue,
      yearValue,
      seasonYear,
      season,
    });

    try {
      const beforeProgress = await api.user.progress().then(toProgressSnapshot).catch(() => null);
      const result = await api.recall.batch(payload);
      const afterProgress = await api.user.progress().then(toProgressSnapshot).catch(() => null);
      const fallbackDelta = {
        provinces: 0,
        cities: submitStats.cities,
        attractions: Array.isArray(result.litIds) ? result.litIds.length : selectedAttractionIds.length,
        visits: Array.isArray(result.litIds) ? result.litIds.length : selectedAttractionIds.length,
      };
      setLastResult({
        litIds: Array.isArray(result.litIds) ? result.litIds : [],
        skippedIds: Array.isArray(result.skippedIds) ? result.skippedIds : [],
        newAchievements: Array.isArray(result.newAchievements) ? result.newAchievements : [],
        delta: buildProgressDelta(beforeProgress, afterProgress, fallbackDelta),
        cumulative: afterProgress
          ? {
              provinces: afterProgress.provinces,
              cities: afterProgress.cities,
              attractions: afterProgress.attractions,
            }
          : undefined,
      });
      trackRecallEvent('recall_submit_success', {
        city_count: submitStats.cities,
        attraction_count: Array.isArray(result.litIds) ? result.litIds.length : selectedAttractionIds.length,
        visit_count: Array.isArray(result.litIds) ? result.litIds.length : selectedAttractionIds.length,
        achievement_count: Array.isArray(result.newAchievements) ? result.newAchievements.length : 0,
        time_precision: precision,
      });
      setModalOpen(false);
      window.dispatchEvent(new Event('trip:progress-updated'));
      navigate('/recall/result');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!draftReady) return <div className="page-loading">正在恢复选择...</div>;

  if (!selectedCity || selectedCities.length === 0) {
    return (
      <div className="recall-page">
        <section className="recall-card">
          <h1>还没有选择城市</h1>
          <p>请先选择至少 1 个城市，再确认要找回的景区。</p>
          <button type="button" className="recall-primary-btn" onClick={() => navigate('/recall/cities')}>
            去选择城市
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="recall-page recall-confirm-page">
      <section className="recall-card recall-filter-panel" aria-label="城市与景区筛选">
        <div className="recall-confirm-city-switcher-head">
          <div>
            <strong>逐个确认城市</strong>
            <span>选择会自动保留</span>
          </div>
          <em>{selectedCities.length} 个城市</em>
        </div>
        <div className="recall-confirm-city-tabs" role="tablist" aria-label="已选城市">
          {cityTabs.map(({ city, selected, total }) => (
            <button
              key={city.id}
              type="button"
              role="tab"
              aria-selected={activeCity?.id === city.id}
              className={activeCity?.id === city.id ? 'active' : ''}
              onClick={() => handleCityChange(city.id)}
            >
              <strong>{city.name}</strong>
              <span>{selected}/{total}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="recall-filter-toggle"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <span><SlidersHorizontal size={16} aria-hidden="true" />搜索与筛选</span>
          <span>{query || levelFilter !== 'all' || categoryFilter !== 'all' ? '已筛选' : '按需使用'}<ChevronDown size={16} aria-hidden="true" /></span>
        </button>
        {filtersOpen && <div className="province-city-tools city-attraction-tools recall-attraction-tools">
          <label className="region-search-box" aria-label="搜索当前城市景区">
            <Search size={18} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索${activeCity?.name || '当前城市'}景区`} />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="清空景区搜索">
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </label>
          <RegionSelect
            value={levelFilter}
            options={[
              { value: 'all', label: '全部等级' },
              { value: '5A', label: '5A' },
              { value: '4A', label: '4A' },
            ]}
            onChange={setLevelFilter}
            ariaLabel="景区等级"
          />
          <RegionSelect
            value={categoryFilter}
            options={[
              { value: 'all', label: '全部分类' },
              ...categoryOptions.map((category) => ({ value: category, label: category })),
            ]}
            onChange={setCategoryFilter}
            ariaLabel="景区分类"
          />
        </div>}
      </section>

      <section className="recall-current-attractions" aria-busy={loading} aria-live="polite">
        {loading && <div className="recall-empty">景区加载中...</div>}
        {!loading && error && <div className="recall-empty">{error}</div>}
        {!loading && !error && attractions.length === 0 && <div className="recall-empty">已选城市暂无可补录景区</div>}
        {!loading && !error && activeCityAttractions.length > 0 && filteredAttractions.length === 0 && (
          <div className="recall-empty">当前搜索或筛选下暂无景区</div>
        )}
        {!loading && !error && filteredAttractions.length > 0 && (
          <div className="recall-attraction-grid">
            {filteredAttractions.map((attraction) => (
              <AttractionCard
                key={attraction.id}
                attraction={attraction}
                selected={selectedAttractionIds.includes(attraction.id)}
                litCount={litVisitCount.get(attraction.id) || 0}
                onToggle={handleToggleAttraction}
              />
            ))}
          </div>
        )}
      </section>

      <div className="recall-attraction-bar">
        <div className="recall-selected-summary">
          <strong>已选 {selectedAttractionIds.length} 个景区</strong>
          <span>
            {selectedAttractionIds.length === 0
              ? '至少选择 1 个景区后确认点亮'
              : selectedAttractions.map((attraction) => attraction.name).join('、')}
          </span>
        </div>
        {selectedLitAgainCount > 0 && (
          <div className="recall-repeat-note">其中 {selectedLitAgainCount} 个已点亮景区，本次会记录为新的访问</div>
        )}
        <button
          type="button"
          className="recall-primary-btn"
          disabled={selectedAttractionIds.length === 0}
          onClick={openConfirmModal}
        >
          确认点亮（{selectedAttractionIds.length}）
        </button>
      </div>

      {modalOpen && (
        <div className="recall-modal-backdrop" role="presentation">
          <div className="recall-modal" role="dialog" aria-modal="true" aria-labelledby="recall-modal-title">
            <button type="button" className="recall-modal-close" disabled={submitting} onClick={() => setModalOpen(false)} aria-label="关闭">
              <X size={18} aria-hidden="true" />
            </button>
            <h2 id="recall-modal-title">确认点亮</h2>
            <p className="recall-modal-summary">本次将统一记录以下旅行足迹</p>
            <div className="recall-submit-stats" aria-label="本次点亮统计">
              <div>
                <strong>{submitStats.cities}</strong>
                <span>城市</span>
              </div>
              <div>
                <strong>{submitStats.attractions}</strong>
                <span>景区</span>
              </div>
              <div>
                <strong>{submitStats.visits}</strong>
                <span>访问记录</span>
              </div>
            </div>
            {selectedLitAgainCount > 0 && (
              <p className="recall-modal-note">其中 {selectedLitAgainCount} 个已点亮景区，本次会记录为新的访问。</p>
            )}

            <button
              type="button"
              className={`recall-time-toggle${timeOptionsOpen ? ' open' : ''}`}
              aria-expanded={timeOptionsOpen}
              onClick={() => setTimeOptionsOpen((value) => !value)}
            >
              <Clock3 size={18} aria-hidden="true" />
              <div>
                <strong>{precision === 'unknown' ? '补充统一时间（可选）' : `统一时间：${timePreview.display_time_text}`}</strong>
                <span>{precision === 'unknown' ? '暂时不记得也可以直接点亮' : `${selectedAttractionIds.length} 个景区将使用同一时间`}</span>
              </div>
              <ChevronDown size={18} aria-hidden="true" />
            </button>

            {timeOptionsOpen && <div className="recall-time-options">
              <label className="recall-field recall-time-precision-field">
              <span>选择时间精度</span>
              <select
                value={precision}
                onChange={(event) => {
                  const nextPrecision = event.target.value as RecallPrecision;
                  setPrecision(nextPrecision);
                  trackRecallEvent('recall_time_precision_select', {
                    time_precision: nextPrecision,
                  });
                }}
              >
                <option value="exact">具体日期</option>
                <option value="month">年月</option>
                <option value="year">年份</option>
                <option value="season">季节</option>
                <option value="unknown">暂时不记得</option>
              </select>
              </label>

            {precision === 'exact' && (
              <label className="recall-field">
                <span>具体日期</span>
                <input
                  type="date"
                  value={exactDate}
                  max={todayDateValue()}
                  onInput={(event) => setExactDate(event.currentTarget.value)}
                  onChange={(event) => setExactDate(event.target.value)}
                />
              </label>
            )}

            {precision === 'month' && (
              <label className="recall-field">
                <span>年月</span>
                <input
                  type="month"
                  value={monthValue}
                  max={currentMonthValue()}
                  onInput={(event) => setMonthValue(event.currentTarget.value)}
                  onChange={(event) => setMonthValue(event.target.value)}
                />
              </label>
            )}

            {precision === 'year' && (
              <div className="recall-field">
                <span>年份</span>
                <YearWheelPicker value={yearValue} onChange={setYearValue} />
              </div>
            )}

            {precision === 'season' && (
              <div className="recall-field-row recall-season-field-row">
                <div className="recall-field">
                  <span>年份</span>
                  <YearWheelPicker value={seasonYear} onChange={setSeasonYear} />
                </div>
                <label className="recall-field">
                  <span>季节</span>
                  <select value={season} onChange={(event) => setSeason(event.target.value as RecallSeason)}>
                    {(['spring', 'summer', 'autumn', 'winter'] as RecallSeason[]).map((item) => (
                      <option key={item} value={item} disabled={isFutureSeason(seasonYear, item)}>
                        {SEASON_LABELS[item]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {precision === 'unknown' && (
              <div className="recall-time-placeholder">
                <CalendarDays size={16} aria-hidden="true" />
                <span>暂时不记得，先点亮，之后可补充。</span>
              </div>
            )}

            {precision !== 'unknown' && (
              <div className={`recall-time-placeholder${timePreview.error ? ' invalid' : ''}`}>
                <CalendarDays size={16} aria-hidden="true" />
                <span>
                  {timePreview.error
                    || `本次选择的 ${selectedAttractionIds.length} 个景区将统一记录为“${timePreview.display_time_text}”。`}
                </span>
              </div>
            )}

              {precision !== 'unknown' && <div className="recall-batch-tip">
                <CircleAlert size={17} aria-hidden="true" />
                <span>如果这些景区不是同一次旅行，建议返回后分批点亮，以便分别记录时间。</span>
              </div>}
            </div>}

            {submitError && <div className="recall-error">{submitError}</div>}

            <div className="recall-modal-actions">
              <button type="button" disabled={submitting} onClick={() => setModalOpen(false)}>返回修改</button>
              <button
                type="button"
                className="recall-primary-btn"
                disabled={submitting || !!timePreview.error}
                aria-busy={submitting}
                onClick={submitRecall}
              >
                {submitting && <LoaderCircle className="recall-loading-icon" size={17} aria-hidden="true" />}
                <span>{submitting ? '正在点亮...' : '确认点亮'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AttractionCard({
  attraction,
  selected,
  litCount,
  onToggle,
}: {
  attraction: RecallAttraction;
  selected: boolean;
  litCount: number;
  onToggle: (attraction: RecallAttraction) => void;
}) {
  const categories = getAttractionCategories(attraction);

  return (
    <button
      type="button"
      className={`recall-attraction-card${selected ? ' selected' : ''}${litCount > 0 ? ' already-lit' : ''}`}
      onClick={() => onToggle(attraction)}
      aria-pressed={selected}
    >
      <span className="recall-card-check" aria-hidden="true">{selected && <Check size={15} />}</span>
      <strong>{attraction.name}</strong>
      <span className="recall-attraction-meta">
        {attraction.level && <em>{attraction.level}</em>}
        {categories.length > 0 ? categories.map((category) => <em key={category}>{category}</em>) : <em>未分类</em>}
      </span>
      {litCount > 0 && (
        <span className="recall-lit-hint">
          已点亮 {litCount} 次，本次会记录为一次新的访问
        </span>
      )}
    </button>
  );
}

function getAttractionCategories(attraction: RecallAttraction) {
  if (Array.isArray(attraction.tags) && attraction.tags.length > 0) {
    return attraction.tags.map((tag) => tag.name).filter(Boolean);
  }
  return String(attraction.category_name || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildRecallPayload(
  ids: number[],
  precision: RecallPrecision,
  values: {
    exactDate: string;
    monthValue: string;
    yearValue: string;
    seasonYear: string;
    season: RecallSeason;
  },
) {
  const timePayload = buildRecallTimePayload(precision, values);
  return {
    ids,
    time_precision: precision,
    lit_at: timePayload.lit_at,
    season: timePayload.season || undefined,
    display_time_text: timePayload.display_time_text,
    source: 'recall',
  };
}

function buildRecallTimePayload(
  precision: RecallPrecision,
  values: {
    exactDate: string;
    monthValue: string;
    yearValue: string;
    seasonYear: string;
    season: RecallSeason;
  },
) {
  const today = todayDateValue();
  const currentMonth = currentMonthValue();
  const currentYear = Number(currentYearValue());

  if (precision === 'exact') {
    if (!values.exactDate) return { error: '请选择具体日期', display_time_text: '', lit_at: '', season: null };
    if (values.exactDate > today) return { error: '不能选择未来日期', display_time_text: '', lit_at: '', season: null };
    return {
      lit_at: values.exactDate,
      display_time_text: formatDateText(values.exactDate),
      season: null,
    };
  }

  if (precision === 'month') {
    const monthValue = values.monthValue || currentMonth;
    if (monthValue > currentMonth) return { error: '不能选择未来月份', display_time_text: '', lit_at: '', season: null };
    return {
      lit_at: `${monthValue}-01`,
      display_time_text: formatMonthText(monthValue),
      season: null,
    };
  }

  if (precision === 'year') {
    const year = Number(values.yearValue || currentYear);
    if (!Number.isInteger(year) || year < 1980) return { error: '请输入有效年份', display_time_text: '', lit_at: '', season: null };
    if (year > currentYear) return { error: '不能选择未来年份', display_time_text: '', lit_at: '', season: null };
    return {
      lit_at: `${year}-01-01`,
      display_time_text: `${year}年`,
      season: null,
    };
  }

  if (precision === 'season') {
    const year = Number(values.seasonYear || currentYear);
    if (!Number.isInteger(year) || year < 1980) return { error: '请输入有效年份', display_time_text: '', lit_at: '', season: null };
    if (year > currentYear || isFutureSeason(String(year), values.season)) {
      return { error: '不能选择未来季节', display_time_text: '', lit_at: '', season: null };
    }
    return {
      lit_at: `${year}-${SEASON_START_MONTH[values.season]}-01`,
      display_time_text: `${year}年${SEASON_LABELS[values.season]}`,
      season: values.season,
    };
  }

  return {
    lit_at: today,
    display_time_text: '时间待补充',
    season: null,
  };
}

function formatDateText(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

function formatMonthText(value: string) {
  const [year, month] = value.split('-').map(Number);
  return `${year}年${month}月`;
}

function isFutureSeason(yearValue: string, season: RecallSeason) {
  const year = Number(yearValue || currentYearValue());
  const currentYear = Number(currentYearValue());
  const currentMonth = Number(currentMonthValue().slice(5, 7));
  const seasonStartMonth = Number(SEASON_START_MONTH[season]);
  return year > currentYear || (year === currentYear && seasonStartMonth > currentMonth);
}

function toProgressSnapshot(progress: any): UserProgressSnapshot {
  return {
    provinces: progress?.provinceStats?.lit_provinces || 0,
    cities: progress?.cityStats?.lit_cities || 0,
    attractions: progress?.attractionStats?.lit_attractions || 0,
    visits: progress?.attractionStats?.total_visits || 0,
  };
}

function buildProgressDelta(
  before: UserProgressSnapshot | null,
  after: UserProgressSnapshot | null,
  fallback: UserProgressSnapshot,
) {
  if (!before || !after) return fallback;
  return {
    provinces: Math.max(0, after.provinces - before.provinces),
    cities: Math.max(0, after.cities - before.cities),
    attractions: Math.max(0, after.attractions - before.attractions),
    visits: Math.max(0, after.visits - before.visits),
  };
}
