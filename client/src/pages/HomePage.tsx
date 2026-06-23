import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Flame, Lightbulb, Globe2, Footprints, MapPin, Landmark, Flag, Sparkles, Trophy, Maximize2, MapPinned, Compass, ChevronUp } from 'lucide-react';
import ChinaMap from '../components/ChinaMap';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import NextTripRecommendations, { type NextTripItem } from '../components/recommendation/NextTripRecommendations';
import FavoriteToast, { type FavoriteToastState } from '../components/favorite/FavoriteToast';

interface ProvinceStat {
  id: number;
  name: string;
  lit_count: number;
  total_count: number;
  region: string;
}

interface RecallGuideState {
  seen: boolean;
  skipped: boolean;
  completed: boolean;
  shouldShow: boolean;
}

const TOTAL_CITY_NODES = 347;
const EMPTY_ACHIEVEMENT_STATS = { unlocked: 0, total: 0 };
export default function HomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ProvinceStat[]>([]);
  const [cityStats, setCityStats] = useState({ lit_cities: 0, total_cities: TOTAL_CITY_NODES });
  const [achievementStats, setAchievementStats] = useState(EMPTY_ACHIEVEMENT_STATS);
  const [loading, setLoading] = useState(true);
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [worldNoticeOpen, setWorldNoticeOpen] = useState(false);
  const [mapCleanMode, setMapCleanMode] = useState(false);
  const [hasUserLitRecord, setHasUserLitRecord] = useState(true);
  const [recallGuide, setRecallGuide] = useState<RecallGuideState | null>(null);
  const [nextTrips, setNextTrips] = useState<NextTripItem[]>([]);
  const [nextTripOpen, setNextTripOpen] = useState(false);
  const [favoriteToast, setFavoriteToast] = useState<FavoriteToastState | null>(null);
  const nextTripCloseRef = useRef<HTMLButtonElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    api.recommendations.nextTrip({ source: 'home', limit: 2 })
      .then((result) => setNextTrips(result.items || []))
      .catch(() => setNextTrips([]));
  }, [user]);

  useEffect(() => {
    if (!nextTripOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNextTripOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    nextTripCloseRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextTripOpen]);

  const fetchStats = useCallback(async () => {
    try {
      const provinces = await api.provinces.list();
      if (user) {
        const [progress, achievements, guide] = await Promise.all([
          api.user.progress(),
          api.achievements.mine().catch(() => []),
          api.recall.guide().catch(() => null),
        ]);
        setCityStats(progress.cityStats || { lit_cities: 0, total_cities: TOTAL_CITY_NODES });
        setAchievementStats({
          unlocked: achievements.filter((item: any) => item.unlocked_at).length,
          total: achievements.length,
        });
        setHasUserLitRecord(
          (progress.attractionStats?.lit_attractions || 0) > 0
          || (progress.attractionStats?.total_visits || 0) > 0,
        );
        setRecallGuide(guide);
        const map = new Map<number, any>(progress.provinceBreakdown.map((p: any) => [p.id, p]));
        setStats(provinces.map((p: any) => {
          const item = map.get(p.id);
          return {
            id: p.id,
            name: p.name,
            region: p.region,
            lit_count: item?.lit_count || 0,
            total_count: item?.total_count || 0,
          };
        }));
      } else {
        const achievements = await api.achievements.list().catch(() => []);
        setAchievementStats({ unlocked: 0, total: achievements.length });
        setCityStats({ lit_cities: 0, total_cities: TOTAL_CITY_NODES });
        setHasUserLitRecord(false);
        setRecallGuide(null);
        setStats(provinces.map((p: any) => ({ id: p.id, name: p.name, region: p.region, lit_count: 0, total_count: p.total_count || 0 })));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    window.addEventListener('trip:progress-updated', fetchStats);
    return () => window.removeEventListener('trip:progress-updated', fetchStats);
  }, [fetchStats]);

  useEffect(() => {
    if (loading || !user || hasUserLitRecord || !recallGuide?.shouldShow) return;
    navigate('/recall', { replace: true });
  }, [hasUserLitRecord, loading, navigate, recallGuide?.shouldShow, user]);

  const litProvinces = stats.filter((s) => s.lit_count > 0).length;
  const litAttractions = stats.reduce((sum, s) => sum + s.lit_count, 0);
  const totalAttractions = stats.reduce((sum, s) => sum + s.total_count, 0);
  const litProvincePct = Math.round((litProvinces / 34) * 100);
  const exploredCityCount = cityStats.lit_cities || 0;
  const totalCities = cityStats.total_cities || TOTAL_CITY_NODES;

  const top5 = useMemo(() => {
    return [...stats]
      .filter((s) => s.lit_count > 0)
      .sort((a, b) => {
        const rateA = a.total_count > 0 ? a.lit_count / a.total_count : 0;
        const rateB = b.total_count > 0 ? b.lit_count / b.total_count : 0;
        return rateB - rateA;
      })
      .slice(0, 5);
  }, [stats]);

  const selectedStat = useMemo(() => {
    return stats.find((s) => s.id === selectedProvinceId) || null;
  }, [stats, selectedProvinceId]);


  const handleClickProvince = useCallback((id: number) => {
    setMapCleanMode(false);
    setNextTripOpen(false);
    setSelectedProvinceId((prev) => (prev === id ? null : id));
    setSidebarOpen(false);
    setWorldNoticeOpen(false);
  }, []);

  const handleDoubleClickProvince = useCallback((id: number) => {
    navigate(`/province/${id}`);
  }, [navigate]);

  return (
    <div className={`home-page ${mapCleanMode ? 'map-clean' : ''}`}>
      {!user && (
        <div className="guest-header-bar">
          <div className="guest-header-brand">
            <img src="/images/shijie-logo-mark.png" alt="识界" />
            <div className="guest-header-text">
              <span className="guest-header-name">识界</span>
              <span className="guest-header-tagline brand-script">Light your life</span>
            </div>
          </div>
        </div>
      )}
      {!mapCleanMode && selectedProvinceId === null && nextTrips.length > 0 && (
        <>
          <button
            type="button"
            className="home-next-trip-trigger"
            aria-haspopup="dialog"
            aria-expanded={nextTripOpen}
            onClick={() => setNextTripOpen(true)}
          >
            <span className="home-next-trip-trigger-icon"><Compass size={18} aria-hidden="true" /></span>
            <span className="home-next-trip-trigger-copy">
              <small>下一站推荐</small>
              <strong>{nextTrips[0].title}</strong>
            </span>
            <span className="home-next-trip-trigger-count">{nextTrips.length} 个建议</span>
            <ChevronUp size={17} aria-hidden="true" />
          </button>
          {nextTripOpen && (
            <div className="home-next-trip-overlay" onMouseDown={() => setNextTripOpen(false)}>
              <section
                className="home-next-trip-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="home-next-trip-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <header>
                  <div>
                    <span><Compass size={18} aria-hidden="true" /></span>
                    <div><h2 id="home-next-trip-title">下一站推荐</h2><p>把心动的地方，留给下一次出发</p></div>
                  </div>
                  <button ref={nextTripCloseRef} type="button" onClick={() => setNextTripOpen(false)} aria-label="关闭下一站推荐"><X size={18} /></button>
                </header>
                <NextTripRecommendations
                  items={nextTrips}
                  onAction={(route) => { setNextTripOpen(false); navigate(route); }}
                  onMessage={(text, undo) => { setFavoriteToast({ text, undo }); window.setTimeout(() => setFavoriteToast(null), 6000); }}
                />
              </section>
            </div>
          )}
        </>
      )}
      <FavoriteToast toast={favoriteToast} onClose={() => setFavoriteToast(null)} />

      {user ? (
        <div className="map-hero-panel">
          <div>
            <div className="map-hero-label">点亮中国</div>
            <div className="map-hero-percent">{litProvincePct}<span>%</span></div>
            <div className="map-hero-copy">已点亮 {litProvinces} 个省份</div>
          </div>
          <div className="map-action-stack" aria-label="地图操作">
            <button
              type="button"
              className="map-action-pill"
              onClick={(event) => {
                event.stopPropagation();
                setWorldNoticeOpen(true);
                setSidebarOpen(false);
              }}
            >
              <Globe2 size={18} aria-hidden="true" />
              <span>世界地图</span>
            </button>
            <button
              type="button"
              className={`map-action-pill ${sidebarOpen ? 'active' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                setSidebarOpen((open) => !open);
                setWorldNoticeOpen(false);
              }}
            >
              <Footprints size={18} aria-hidden="true" />
              <span>足迹</span>
            </button>
            <button
              type="button"
              className="map-action-pill"
              onClick={(event) => {
                event.stopPropagation();
                navigate('/recall/cities');
              }}
            >
              <MapPinned size={18} aria-hidden="true" />
              <span>找回</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="map-hero-panel guest-stats-panel">
          <div>
            <div className="map-hero-label">点亮中国</div>
            <div className="map-hero-percent">{litProvincePct}<span>%</span></div>
            <div className="map-hero-copy">已点亮 {litProvinces} 个省份</div>
          </div>
        </div>
      )}
      <div className="home-main">
        <div className="map-wrapper">
          {loading ? <div className="loading">地图加载中...</div> : (
            <ChinaMap
              stats={stats}
              onClickProvince={handleClickProvince}
              onClickEmpty={() => {
                setMapCleanMode((prev) => !prev);
                setNextTripOpen(false);
                setSelectedProvinceId(null);
                setSidebarOpen(false);
                setWorldNoticeOpen(false);
              }}
              highlightProvinceId={selectedProvinceId}
            />
          )}
          {/* 选中省份的引导浮层 */}
          {selectedStat && (
            <div className="province-guide-float" onClick={(event) => event.stopPropagation()}>
              <div className="province-guide-title">
                <MapPin size={14} aria-hidden="true" />
                <span>{selectedStat.name}</span>
              </div>
              <button
                type="button"
                className="province-guide-content"
                onClick={() => navigate(`/province/${selectedStat.id}`)}
              >
                <Sparkles size={16} aria-hidden="true" />
                <span>
                  {selectedStat.lit_count >= selectedStat.total_count && selectedStat.total_count > 0
                    ? '查看'
                    : '去点亮'}
                </span>
                <span className="province-guide-arrow" aria-hidden="true">›</span>
              </button>
              <div className="province-guide-meta">
                已点亮 {selectedStat.lit_count}/{selectedStat.total_count} 个景点
              </div>
              <button
                className="province-guide-close"
                onClick={() => setSelectedProvinceId(null)}
                aria-label="关闭"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="map-watermark">识界 · Light your life</div>

          {/* 悬浮侧边栏 */}
          {sidebarOpen ? (
            <div className="home-sidebar-float" onClick={(event) => event.stopPropagation()}>
              <button
                className="sidebar-toggle"
                onClick={() => setSidebarOpen(false)}
                title="收起"
                aria-label="收起侧边栏"
              >
                <X size={16} aria-hidden="true" />
              </button>
              <h3 className="sidebar-title"><Flame size={16} aria-hidden="true" /> 点亮进度 Top</h3>
              <div className="sidebar-list">
                {top5.length === 0 && (
                  <div className="sidebar-empty">暂无数据</div>
                )}
                {top5.map((stat) => {
                  const rate = stat.total_count > 0 ? Math.round((stat.lit_count / stat.total_count) * 100) : 0;
                  const isSelected = selectedProvinceId === stat.id;
                  return (
                    <div
                      key={stat.id}
                      className={`sidebar-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleClickProvince(stat.id)}
                      onDoubleClick={() => handleDoubleClickProvince(stat.id)}
                    >
                      <div className="sidebar-item-header">
                        <span className="sidebar-item-name">{stat.name}</span>
                        <span className="sidebar-item-rate">{rate}%</span>
                      </div>
                      <div className="sidebar-progress-bar">
                        <div className="sidebar-progress-fill" style={{ width: `${rate}%` }} />
                      </div>
                      {isSelected && (
                        <div className="sidebar-item-detail">
                          <div className="sidebar-detail-row">
                            <span>已点亮</span>
                            <span className="sidebar-detail-num">{stat.lit_count} / {stat.total_count}</span>
                          </div>
                          <div className="sidebar-detail-hint"><Lightbulb size={14} aria-hidden="true" /> 双击进入景区列表</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {selectedStat && !top5.find((s) => s.id === selectedStat.id) && (
                <div className="sidebar-selected-outside">
                  <div className="sidebar-item selected">
                    <div className="sidebar-item-header">
                      <span className="sidebar-item-name">{selectedStat.name}</span>
                      <span className="sidebar-item-rate">
                        {selectedStat.total_count > 0 ? Math.round((selectedStat.lit_count / selectedStat.total_count) * 100) : 0}%
                      </span>
                    </div>
                    <div className="sidebar-progress-bar">
                      <div
                        className="sidebar-progress-fill"
                        style={{ width: `${selectedStat.total_count > 0 ? Math.round((selectedStat.lit_count / selectedStat.total_count) * 100) : 0}%` }}
                      />
                    </div>
                    <div className="sidebar-item-detail">
                      <div className="sidebar-detail-row">
                        <span>已点亮</span>
                        <span className="sidebar-detail-num">{selectedStat.lit_count} / {selectedStat.total_count}</span>
                      </div>
                      <div className="sidebar-detail-hint"><Lightbulb size={14} aria-hidden="true" /> 双击进入景区列表</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              className="sidebar-float-btn"
              onClick={() => setSidebarOpen(true)}
              title="展开进度"
            >
              <Flame size={20} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {worldNoticeOpen && (
        <div className="world-map-notice" role="status" onClick={() => setWorldNoticeOpen(false)}>
          <Globe2 size={20} aria-hidden="true" />
          <span>世界地图正在积极探索中<br />请玩家耐心等待……</span>
        </div>
      )}
      {!mapCleanMode && selectedProvinceId === null && user && (
        <div className="home-insight-dock">
          <div className="home-insight-card">
            <MapPin size={18} aria-hidden="true" />
            <span>点亮省份</span>
            <strong>{litProvinces}<small>/34</small></strong>
          </div>
          <div className="home-insight-card">
            <Landmark size={18} aria-hidden="true" />
            <span>探索城市</span>
            <strong>{exploredCityCount}<small>/{totalCities}</small></strong>
          </div>
          <div className="home-insight-card">
            <Flag size={18} aria-hidden="true" />
            <span>打卡景点</span>
            <strong>{litAttractions}<small>/{totalAttractions}</small></strong>
          </div>
          <div className="home-insight-card">
            <Trophy size={18} aria-hidden="true" />
            <span>成就徽章</span>
            <strong>{achievementStats.unlocked}<small>/{achievementStats.total}</small></strong>
          </div>
        </div>
      )}
      {!user && (
        <div className="guest-tip">
          <Sparkles size={18} aria-hidden="true" />
          <div className="guest-tip-text">
            <strong>登录开启你的旅行印记</strong>
            <span>点亮省份、记录足迹、解锁成就</span>
          </div>
          <button className="guest-tip-btn" onClick={() => navigate('/login')}>
            去登录
          </button>
        </div>
      )}
      {mapCleanMode && (
        <button
          type="button"
          className="map-restore-ui"
          onClick={() => setMapCleanMode(false)}
          aria-label="显示操作栏"
        >
          <Maximize2 size={18} aria-hidden="true" />
          <span>显示面板</span>
        </button>
      )}
    </div>
  );
}
