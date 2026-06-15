import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { CalendarDays, CheckCircle2, MapPin, Route, Sparkles } from 'lucide-react';

interface LitItem {
  id: number;
  name: string;
  level: string;
  province_name: string;
  city_name?: string;
  category_name: string;
  lit_at: string;
}

interface VisitGroup {
  id: number;
  name: string;
  level: string;
  province_name: string;
  city_name?: string;
  category_name: string;
  visits: { lit_at: string }[];
}

interface YearGroup {
  year: string;
  items: VisitGroup[];
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
        city_name: item.city_name,
        category_name: item.category_name,
        visits: [{ lit_at: item.lit_at }],
      });
    }
  });
  const groups = Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      visits: [...group.visits].sort((a, b) => b.lit_at.localeCompare(a.lit_at)),
    }))
    .sort((a, b) => b.visits[0].lit_at.localeCompare(a.visits[0].lit_at));

  const distinctCount = groups.length;
  const totalVisits = list.length;
  const travelDays = new Set(list.map((item) => item.lit_at?.slice(0, 10)).filter(Boolean)).size;
  const total5A = groups.filter((g) => g.level === '5A').length;
  const yearGroups = groups.reduce<YearGroup[]>((acc, item) => {
    const year = item.visits[0].lit_at?.slice(0, 4) || '未知';
    const existing = acc.find((group) => group.year === year);
    if (existing) {
      existing.items.push(item);
    } else {
      acc.push({ year, items: [item] });
    }
    return acc;
  }, []);

  return (
    <div className="journey-page">
      <header className="journey-titlebar floating-page-titlebar">
        <div>
          <h1 className="journey-page-heading floating-page-heading">
            <Route className="journey-title-icon floating-page-icon" size={22} aria-hidden="true" />
            <span>旅程</span>
          </h1>
          <p>把每一次点亮串成路线，回看自己走过的城市与风景。</p>
        </div>
      </header>

      <div className="journey-header">
        <div className="journey-stats">
          <div className="j-stat">
            <div className="j-stat-num">{distinctCount}</div>
            <div className="j-stat-label">累计点亮</div>
          </div>
          <div className="j-stat">
            <div className="j-stat-num">{totalVisits}</div>
            <div className="j-stat-label">总访问次数</div>
          </div>
          <div className="j-stat">
            <div className="j-stat-num">{travelDays}</div>
            <div className="j-stat-label">旅行天数</div>
          </div>
          <div className="j-stat">
            <div className="j-stat-num">{total5A}</div>
            <div className="j-stat-label">5A景区</div>
          </div>
        </div>
      </div>

      <div className="journey-slogan">
        <Sparkles size={13} aria-hidden="true" />
        <span>每一次出发，都是世界的又一次点亮</span>
        <Sparkles size={13} aria-hidden="true" />
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🗺️</div>
          <p>还没有点亮任何景区</p>
          <p className="sub">去地图上探索吧</p>
        </div>
      ) : (
        <div className="journey-timeline">
          {yearGroups.map((yearGroup) => (
            <section className="journey-year-section" key={yearGroup.year}>
              <div className="journey-year-marker">
                <span>{yearGroup.year}</span>
                <em>{yearGroup.items.length} 处记忆</em>
              </div>
              <div className="journey-event-list">
                {yearGroup.items.map((g) => (
                  <article key={g.id} className="journey-event">
                    <div className="journey-event-date">
                      <CalendarDays size={15} aria-hidden="true" />
                      <span>{formatDateRange(g.visits)}</span>
                    </div>
                    <div className="journey-event-body">
                      <div className="journey-event-card-main">
                        <div className="journey-event-icon">
                          <Route size={20} aria-hidden="true" />
                        </div>
                        <div className="journey-event-content">
                          <div className="journey-event-title-row">
                            <h2>{g.name}</h2>
                            {g.level && <span className={`level-tag level-${g.level}`}>{g.level}</span>}
                          </div>
                          <p>{g.province_name}{g.city_name ? ` · ${g.city_name}` : ''}</p>
                          <div className="journey-event-meta">
                            <MapPin size={13} aria-hidden="true" />
                            <span>{g.category_name || '未分类景点'}</span>
                          </div>
                        </div>
                        <span className="journey-lit-status">
                          <CheckCircle2 size={13} aria-hidden="true" />
                          已点亮
                        </span>
                      </div>
                      <div className="journey-event-footer">
                        <span>点亮 {g.visits.length} 次</span>
                        <span>最近 {formatDate(g.visits[0].lit_at)}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return '未知日期';
  const [, month, day] = value.slice(0, 10).split('-');
  return `${month}.${day}`;
}

function formatDateRange(visits: { lit_at: string }[]) {
  if (!visits.length) return '未知日期';
  const dates = visits.map((visit) => visit.lit_at).sort((a, b) => a.localeCompare(b));
  const first = formatDate(dates[0]);
  const last = formatDate(dates[dates.length - 1]);
  return first === last ? first : `${first}-${last}`;
}
