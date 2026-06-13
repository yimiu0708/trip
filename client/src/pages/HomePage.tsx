import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Flame, Lightbulb, Globe2, Footprints, Target, MapPin, Landmark, Flag } from 'lucide-react';
import ChinaMap from '../components/ChinaMap';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface ProvinceStat {
  id: number;
  name: string;
  lit_count: number;
  total_count: number;
  region: string;
}

interface TravelGoal {
  provinceId: number;
  targetProgress: number;
  targetDate?: string;
}

const GOAL_KEY = 'trip_next_goal';

export default function HomePage() {
  const [stats, setStats] = useState<ProvinceStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [goal, setGoal] = useState<TravelGoal | null>(() => {
    const raw = localStorage.getItem(GOAL_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TravelGoal;
    } catch {
      return null;
    }
  });
  const [draftGoal, setDraftGoal] = useState<TravelGoal>(() => ({
    provinceId: 1,
    targetProgress: 80,
    targetDate: '',
  }));
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchStats = useCallback(async () => {
    try {
      const provinces = await api.provinces.list();
      if (user) {
        const progress = await api.user.progress();
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

  const litProvinces = stats.filter((s) => s.lit_count > 0).length;
  const litAttractions = stats.reduce((sum, s) => sum + s.lit_count, 0);
  const totalAttractions = stats.reduce((sum, s) => sum + s.total_count, 0);
  const litProvincePct = Math.round((litProvinces / 34) * 100);
  const litAttractionPct = totalAttractions > 0 ? Math.round((litAttractions / totalAttractions) * 100) : 0;
  const exploredCityCount = litProvinces;
  const exploredCityPct = litProvincePct;

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

  const goalStat = useMemo(() => {
    if (!goal) return null;
    return stats.find((s) => s.id === goal.provinceId) || null;
  }, [goal, stats]);

  const goalProgress = goalStat && goalStat.total_count > 0
    ? Math.round((goalStat.lit_count / goalStat.total_count) * 100)
    : 0;

  const goalCountdown = useMemo(() => {
    if (!goal?.targetDate) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(goal.targetDate);
    if (Number.isNaN(target.getTime())) return '';
    target.setHours(0, 0, 0, 0);
    return `${Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86400000))} days`;
  }, [goal]);

  const handleClickProvince = useCallback((id: number) => {
    setSelectedProvinceId((prev) => (prev === id ? null : id));
  }, []);

  const handleDoubleClickProvince = useCallback((id: number) => {
    navigate(`/province/${id}`);
  }, [navigate]);

  const openGoalModal = () => {
    setDraftGoal(goal || {
      provinceId: stats[0]?.id || 1,
      targetProgress: 80,
      targetDate: '',
    });
    setTargetOpen(true);
  };

  const saveGoal = () => {
    const normalized = {
      ...draftGoal,
      targetProgress: Math.min(100, Math.max(0, Math.round(draftGoal.targetProgress / 5) * 5)),
      targetDate: draftGoal.targetDate || undefined,
    };
    setGoal(normalized);
    localStorage.setItem(GOAL_KEY, JSON.stringify(normalized));
    setTargetOpen(false);
  };

  return (
    <div className="home-page">
      <div className="map-hero-panel">
        <div>
          <div className="map-hero-label">点亮中国</div>
          <div className="map-hero-percent">{litProvincePct}<span>%</span></div>
          <div className="map-hero-copy">已点亮 {litProvinces} 个省份</div>
        </div>
        <div className="map-action-stack" aria-label="地图操作">
          <button type="button" className="map-action-pill" onClick={() => alert('世界地图将在后续版本开放')}>
            <Globe2 size={18} aria-hidden="true" />
            <span>世界地图</span>
          </button>
          <button type="button" className="map-action-pill" onClick={() => setSidebarOpen(true)}>
            <Footprints size={18} aria-hidden="true" />
            <span>足迹</span>
          </button>
          <button type="button" className="map-action-pill" onClick={openGoalModal}>
            <Target size={18} aria-hidden="true" />
            <span>目标</span>
          </button>
        </div>
      </div>
      <div className="home-main">
        <div className="map-wrapper">
          {loading ? <div className="loading">地图加载中...</div> : (
            <ChinaMap
              stats={stats}
              onClickProvince={handleClickProvince}
              onDoubleClickProvince={handleDoubleClickProvince}
              highlightProvinceId={selectedProvinceId}
            />
          )}
          <div className="map-watermark">识界 · Light your life</div>

          {/* 悬浮侧边栏 */}
          {sidebarOpen ? (
            <div className="home-sidebar-float">
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
      <div className="home-insight-dock">
        <div className="home-insight-card">
          <MapPin size={18} aria-hidden="true" />
          <span>点亮省份</span>
          <strong>{litProvinces}<small>/34</small></strong>
          <em>{litProvincePct}%</em>
        </div>
        <div className="home-insight-card">
          <Landmark size={18} aria-hidden="true" />
          <span>探索城市</span>
          <strong>{exploredCityCount}<small>/34</small></strong>
          <em>{exploredCityPct}%</em>
        </div>
        <div className="home-insight-card">
          <Flag size={18} aria-hidden="true" />
          <span>打卡景点</span>
          <strong>{litAttractions}<small>/{totalAttractions}</small></strong>
          <em>{litAttractionPct}%</em>
        </div>
      </div>
      {goal && goalStat && (
        <button className="home-goal-strip" type="button" onClick={openGoalModal}>
          <span>下一目标：点亮 {goalStat.name} 至 {goal.targetProgress}%{goalCountdown ? `，倒计时 ${goalCountdown}` : ''}</span>
          <strong>{goalProgress}%</strong>
          <div className="home-goal-progress" aria-hidden="true">
            <div style={{ width: `${Math.min(goalProgress, 100)}%` }} />
          </div>
        </button>
      )}
      {!user && (
        <div className="guest-tip">登录后可点亮景区、解锁成就</div>
      )}
      {targetOpen && (
        <div className="modal-overlay" onClick={() => setTargetOpen(false)}>
          <div className="modal-content goal-modal" onClick={(e) => e.stopPropagation()}>
            <h3>设置点亮目标</h3>
            <label>
              省份
              <select
                value={draftGoal.provinceId}
                onChange={(e) => setDraftGoal((prev) => ({ ...prev, provinceId: Number(e.target.value) }))}
              >
                {stats.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>
              目标进度
              <div className="goal-range-row">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={draftGoal.targetProgress}
                  onChange={(e) => setDraftGoal((prev) => ({ ...prev, targetProgress: Number(e.target.value) }))}
                />
                <strong>{draftGoal.targetProgress}%</strong>
              </div>
            </label>
            <label>
              期望达成时间
              <input
                type="date"
                value={draftGoal.targetDate || ''}
                onChange={(e) => setDraftGoal((prev) => ({ ...prev, targetDate: e.target.value }))}
              />
            </label>
            <div className="goal-modal-actions">
              <button type="button" className="btn-small" onClick={() => setTargetOpen(false)}>取消</button>
              <button type="button" className="btn-primary" onClick={saveGoal}>保存目标</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
