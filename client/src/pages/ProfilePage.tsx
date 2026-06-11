import { useEffect, useState } from 'react';
import { api } from '../api/client';
import * as echarts from 'echarts';

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

export default function ProfilePage() {
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
      title: { text: '省份点亮进度', left: 'center', textStyle: { fontSize: 16, color: '#0f172a' } },
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

  const provinceLine = achievements.filter((a) => a.type === 'province');
  const attractionLine = achievements.filter((a) => a.type === 'attraction');
  const specialLine = achievements.filter((a) => a.type === 'special');

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>个人中心</h1>
        <div className="profile-stats">
          <div className="p-stat">
            <div className="p-stat-num">{provinceStats.lit_provinces}</div>
            <div className="p-stat-label">点亮省份</div>
          </div>
          <div className="p-stat">
            <div className="p-stat-num">{attractionStats.lit_attractions}</div>
            <div className="p-stat-label">点亮景区</div>
          </div>
          <div className="p-stat">
            <div className="p-stat-num">{achievements.filter((a) => a.unlocked_at).length}</div>
            <div className="p-stat-label">获得成就</div>
          </div>
        </div>
      </div>

      <div className="profile-section">
        <div className="chart-box">
          <div id="province-chart" style={{ width: '100%', height: 320 }} />
          <div className="chart-center-text">
            <div className="cct-num">{provinceStats.lit_provinces}/{provinceStats.total_provinces}</div>
            <div className="cct-label">省份</div>
          </div>
        </div>
      </div>

      <div className="profile-section">
        <h2>🏷️ 分类点亮进度</h2>
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
          <h2>🏅 成就墙</h2>
          <div className="achievement-filters">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部</button>
            <button className={filter === 'unlocked' ? 'active' : ''} onClick={() => setFilter('unlocked')}>已解锁</button>
            <button className={filter === 'locked' ? 'active' : ''} onClick={() => setFilter('locked')}>未解锁</button>
          </div>
        </div>

        <div className="achievement-group">
          <h3>省份探索</h3>
          <div className="badge-grid">
            {provinceLine.map((a) => <Badge key={a.id} a={a} />)}
          </div>
        </div>

        <div className="achievement-group">
          <h3>景区达人</h3>
          <div className="badge-grid">
            {attractionLine.map((a) => <Badge key={a.id} a={a} />)}
          </div>
        </div>

        <div className="achievement-group">
          <h3>🎉 彩蛋成就</h3>
          <div className="badge-grid">
            {specialLine.map((a) => <Badge key={a.id} a={a} special />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ a, special }: { a: Achievement; special?: boolean }) {
  const unlocked = !!a.unlocked_at;
  return (
    <div className={`badge ${unlocked ? 'unlocked' : 'locked'} ${a.badge_style}`} title={unlocked ? a.condition_desc : '???'}>
      <div className="badge-icon">{unlocked ? (a.icon === 'mountain' ? '⛰️' : a.icon === 'footprint' ? '👣' : a.icon === 'compass' ? '🧭' : a.icon === 'map' ? '🗺️' : a.icon === 'crown' ? '👑' : a.icon === 'ticket' ? '🎫' : a.icon === 'camera' ? '📷' : a.icon === 'landscape' ? '🏞️' : a.icon === 'scroll' ? '📜' : a.icon === 'album' ? '📒' : a.icon === 'compass2' ? '🧭' : a.icon === 'hiking' ? '🥾' : a.icon === 'long-scroll' ? '🗺️' : a.icon === 'star-trail' ? '✨' : a.icon === 'galaxy' ? '🌌' : a.icon === 'torch' ? '✨' : a.icon === 'meteor' ? '☄️' : a.icon === 'moon' ? '🌙' : a.icon === 'trophy' ? '🏆' : a.icon === 'crown2' ? '👑' : a.icon === 'diamond5' ? '💎' : a.icon === 'calendar' ? '📅' : a.icon === 'flame' ? '✨' : '🏅') : '❓'}</div>
      <div className="badge-name">{unlocked ? a.name : special ? '???' : a.name}</div>
      {unlocked && <div className="badge-level">Lv.{a.level}</div>}
    </div>
  );
}
