import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface LitItem {
  id: number;
  name: string;
  level: string;
  province_name: string;
  category_name: string;
  lit_at: string;
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

  const total5A = list.filter((a) => a.level === '5A').length;
  const total4A = list.filter((a) => a.level === '4A').length;

  return (
    <div className="journey-page">
      <div className="journey-header">
        <h1>我的旅程</h1>
        <div className="journey-stats">
          <div className="j-stat">
            <div className="j-stat-num">{list.length}</div>
            <div className="j-stat-label">已点亮</div>
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

      {list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🗺️</div>
          <p>还没有点亮任何景区</p>
          <p className="sub">去地图上探索吧</p>
        </div>
      ) : (
        <div className="journey-list">
          {list.map((item) => (
            <div key={item.id} className="journey-item">
              <div className="journey-main">
                <span className={`level-tag level-${item.level}`}>{item.level}</span>
                <span className="journey-name">{item.name}</span>
              </div>
              <div className="journey-meta">
                <span>{item.province_name}</span>
                {item.category_name && <span>· {item.category_name}</span>}
                <span>· {item.lit_at?.slice(0, 10)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
