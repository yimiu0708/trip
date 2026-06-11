import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function HomePage() {
  const [stats, setStats] = useState<ProvinceStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  const top5 = useMemo(() => {
    return stats
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
    setSelectedProvinceId((prev) => (prev === id ? null : id));
    setSidebarOpen(false);
  }, []);

  const handleDoubleClickProvince = useCallback((id: number) => {
    navigate(`/province/${id}`);
  }, [navigate]);

  return (
    <div className="home-page">
      <div className="stats-bar-home">
        <div className="stat-card">
          <div className="stat-value">{litProvinces}<span className="stat-total">/34</span></div>
          <div className="stat-label">已点亮省份</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{litAttractions}<span className="stat-total">/{totalAttractions}</span></div>
          <div className="stat-label">已点亮景区</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalAttractions > 0 ? Math.round((litAttractions / totalAttractions) * 100) : 0}%</div>
          <div className="stat-label">点亮率</div>
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
          <div className="map-watermark">识界 🌍 light your life</div>

          {/* 悬浮侧边栏 */}
          {sidebarOpen ? (
            <div className="home-sidebar-float">
              <button
                className="sidebar-toggle"
                onClick={() => setSidebarOpen(false)}
                title="收起"
              >
                ✕
              </button>
              <h3 className="sidebar-title">✨ 点亮进度 TOP5</h3>
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
                          <div className="sidebar-detail-hint">💡 双击进入景区列表</div>
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
                      <div className="sidebar-detail-hint">💡 双击进入景区列表</div>
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
              ✨
            </button>
          )}
        </div>
      </div>
      {!user && (
        <div className="guest-tip">登录后可点亮景区、解锁成就</div>
      )}
    </div>
  );
}
