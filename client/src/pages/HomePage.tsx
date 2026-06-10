import { useEffect, useState, useCallback } from 'react';
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
        setStats(provinces.map((p: any) => ({ id: p.id, name: p.name, region: p.region, lit_count: 0, total_count: 0 })));
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
      <div className="map-wrapper">
        {loading ? <div className="loading">地图加载中...</div> : (
          <ChinaMap stats={stats} onSelectProvince={(id: number) => navigate(`/province/${id}`)} />
        )}
      </div>
      {!user && (
        <div className="guest-tip">登录后可点亮景区、解锁成就</div>
      )}
    </div>
  );
}
