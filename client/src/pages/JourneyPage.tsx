import { useEffect, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { api } from '../api/client';

interface LitItem {
  id: number;
  name: string;
  level: string;
  province_name: string;
  category_name: string;
  lit_at: string;
}

interface VisitGroup {
  id: number;
  name: string;
  level: string;
  province_name: string;
  category_name: string;
  visits: { lit_at: string }[];
}

export default function JourneyPage() {
  const [list, setList] = useState<LitItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.user.litList()
      .then((data: LitItem[]) => {
        setList(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">加载中...</div>;

  // 按景区分组，汇总多次访问
  const groupMap = new Map<number, VisitGroup>();
  list.forEach((item) => {
    const existing = groupMap.get(item.id);
    if (existing) {
      existing.visits.push({ lit_at: item.lit_at });
    } else {
      groupMap.set(item.id, {
        id: item.id,
        name: item.name,
        level: item.level,
        province_name: item.province_name,
        category_name: item.category_name,
        visits: [{ lit_at: item.lit_at }],
      });
    }
  });
  const groups = Array.from(groupMap.values()).sort((a, b) => b.visits[0].lit_at.localeCompare(a.visits[0].lit_at));

  const distinctCount = groups.length;
  const totalVisits = list.length;
  const total5A = groups.filter((g) => g.level === '5A').length;
  const total4A = groups.filter((g) => g.level === '4A').length;

  return (
    <div className="journey-page">
      <div className="journey-header">
        <h1>我的旅程</h1>
        <div className="journey-stats">
          <div className="j-stat">
            <div className="j-stat-num">{distinctCount}</div>
            <div className="j-stat-label">已点亮景区</div>
          </div>
          <div className="j-stat">
            <div className="j-stat-num">{totalVisits}</div>
            <div className="j-stat-label">总访问次数</div>
          </div>
          <div className="j-stat">
            <div className="j-stat-num">{total5A}</div>
            <div className="j-stat-label">5A景区</div>
          </div>
          <div className="j-stat">
            <div className="j-stat-num">{total4A}</div>
            <div className="j-stat-label">4A景区</div>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><MapIcon size={48} aria-hidden="true" /></div>
          <p>还没有点亮任何景区</p>
          <p className="sub">去地图上探索吧</p>
        </div>
      ) : (
        <div className="journey-list">
          {groups.map((g) => (
            <div key={g.id} className="journey-item">
              <div className="journey-main">
                <span className={`level-tag level-${g.level}`}>{g.level}</span>
                <span className="journey-name">{g.name}</span>
                {g.visits.length > 1 && (
                  <span className="visit-badge">{g.visits.length}次</span>
                )}
              </div>
              <div className="journey-meta">
                <span>{g.province_name}</span>
                {g.category_name && <span>· {g.category_name}</span>}
              </div>
              <div className="visit-dates">
                {g.visits.map((v, i) => (
                  <span key={i} className="visit-date">{v.lit_at?.slice(0, 10)}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
