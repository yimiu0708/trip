import { useEffect, useState } from 'react';
import { api } from '../api/client';
import * as echarts from 'echarts';
import { Tag, Medal, PartyPopper } from 'lucide-react';
import AchievementBadge from '../components/AchievementBadge';

interface Achievement {
  id: number;
  name: string;
  type: string;
  level: number | null;
  condition_desc: string;
  icon: string;
  badge_style: string;
  unlocked_at: string | null;
}

export default function AchievementPage() {
  const [progress, setProgress] = useState<any>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  useEffect(() => {
    Promise.all([api.user.progress(), api.achievements.mine()])
      .then(([p, a]) => {
        setProgress(p);
        setAchievements(a);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!progress) return;
    const el = document.getElementById('province-chart');
    if (!el) return;
    const chart = echarts.init(el);

    const regions = ['华东', '华南', '华北', '华中', '西南', '西北', '东北', '港澳台'];
    const regionData = regions.map((r) => {
      const items = progress.provinceBreakdown.filter((p: any) => p.region === r);
      const lit = items.filter((p: any) => p.lit_count > 0).length;
      return { name: r, value: lit };
    });

    chart.setOption({
      color: ['#1594df', '#23c2d5', '#48d596', '#a6df6a', '#ffd166', '#ff8a75', '#7aa7ff', '#8bd3ff'],
      tooltip: { trigger: 'item', formatter: '{b}: {c} 省已点亮' },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '55%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
          data: regionData.map((d) => ({ name: d.name, value: d.value })),
        },
      ],
    });

    return () => chart.dispose();
  }, [progress]);

  if (loading) return <div className="page-loading">加载中...</div>;
  if (!progress) return <div className="page-loading">加载失败</div>;

  const { provinceStats, attractionStats, categoryBreakdown } = progress;

  const filtered = achievements.filter((a) => {
    if (filter === 'unlocked') return !!a.unlocked_at;
    if (filter === 'locked') return !a.unlocked_at;
    return true;
  });

  const provinceLine = filtered.filter((a) => a.type === 'province');
  const attractionLine = filtered.filter((a) => a.type === 'attraction');
  const specialLine = filtered.filter((a) => a.type === 'special');

  return (
    <div className="achievement-page">
      <div className="achievement-header-top">
        <h1>我的成就</h1>
        <div className="achievement-summary">
          <div className="a-stat">
            <div className="a-stat-num">{provinceStats.lit_provinces}/{provinceStats.total_provinces}</div>
            <div className="a-stat-label">省份</div>
          </div>
          <div className="a-stat">
            <div className="a-stat-num">{attractionStats.lit_attractions}/{attractionStats.total_attractions}</div>
            <div className="a-stat-label">景区</div>
          </div>
          <div className="a-stat">
            <div className="a-stat-num">{achievements.filter((a) => a.unlocked_at).length}/{achievements.length}</div>
            <div className="a-stat-label">成就</div>
          </div>
        </div>
      </div>

      <div className="profile-section">
        <div className="chart-box">
          <div id="province-chart" style={{ width: '100%', height: 280 }} />
          <div className="chart-center-text">
            <div className="cct-num">{provinceStats.lit_provinces}/{provinceStats.total_provinces}</div>
            <div className="cct-label">省份</div>
          </div>
        </div>
      </div>

      <div className="profile-section">
        <h2><Tag size={18} /> 分类点亮进度</h2>
        <div className="category-progress-list">
          {categoryBreakdown.map((c: any) => {
            const pct = c.total_count > 0 ? Math.round((c.lit_count / c.total_count) * 100) : 0;
            return (
              <div key={c.id} className="category-progress-item">
                <div className="cpi-header">
                  <span className="cpi-name">{c.name}</span>
                  <span className="cpi-num">{c.lit_count}/{c.total_count} ({pct}%)</span>
                </div>
                <div className="cpi-bar">
                  <div className="cpi-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="profile-section">
        <div className="achievement-header">
          <h2><Medal size={18} /> 成就墙</h2>
          <div className="achievement-filters">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部</button>
            <button className={filter === 'unlocked' ? 'active' : ''} onClick={() => setFilter('unlocked')}>已解锁</button>
            <button className={filter === 'locked' ? 'active' : ''} onClick={() => setFilter('locked')}>未解锁</button>
          </div>
        </div>

        <div className="achievement-group">
          <h3>省份探索</h3>
          <div className="badge-grid">
            {provinceLine.map((a) => <AchievementBadge key={a.id} a={a} />)}
          </div>
        </div>

        <div className="achievement-group">
          <h3>景区达人</h3>
          <div className="badge-grid">
            {attractionLine.map((a) => <AchievementBadge key={a.id} a={a} />)}
          </div>
        </div>

        <div className="achievement-group">
          <h3><PartyPopper size={18} /> 彩蛋成就</h3>
          <div className="badge-grid">
            {specialLine.map((a) => <AchievementBadge key={a.id} a={a} special />)}
          </div>
        </div>
      </div>
    </div>
  );
}
