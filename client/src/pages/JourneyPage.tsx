import { useEffect, useMemo, useState } from 'react';
import { Award, CalendarDays, Map as MapIcon, MapPin, Sparkles } from 'lucide-react';
import { api } from '../api/client';

interface LitItem {
  id: number;
  name: string;
  level: string;
  province_name: string;
  city_name?: string;
  category_name: string;
  lit_at: string;
}

interface AchievementItem {
  id: number;
  name: string;
  type: string;
  condition_desc: string;
  unlocked_at: string | null;
}

interface TimelineEvent {
  id: string;
  type: 'visit' | 'achievement';
  date: string;
  year: string;
  title: string;
  subtitle: string;
  meta: string;
  level?: string;
}

function getYear(value: string) {
  return value?.slice(0, 4) || '未知年份';
}

function formatDate(value: string) {
  return value?.slice(0, 10).replace(/-/g, '.') || '未知日期';
}

export default function JourneyPage() {
  const [litList, setLitList] = useState<LitItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('all');

  useEffect(() => {
    Promise.all([api.user.litList(), api.achievements.mine()])
      .then(([visits, achievementList]) => {
        setLitList(visits);
        setAchievements(achievementList);
      })
      .finally(() => setLoading(false));
  }, []);

  const timeline = useMemo<TimelineEvent[]>(() => {
    const visitEvents = litList.map((item, index) => ({
      id: `visit-${item.id}-${item.lit_at}-${index}`,
      type: 'visit' as const,
      date: item.lit_at,
      year: getYear(item.lit_at),
      title: item.name,
      subtitle: [item.city_name, item.province_name].filter(Boolean).join(' · '),
      meta: item.category_name || '景区点亮',
      level: item.level,
    }));

    const achievementEvents = achievements
      .filter((item) => item.unlocked_at)
      .map((item) => ({
        id: `achievement-${item.id}`,
        type: 'achievement' as const,
        date: item.unlocked_at!,
        year: getYear(item.unlocked_at!),
        title: item.name,
        subtitle: item.condition_desc,
        meta: '成就解锁',
      }));

    return [...visitEvents, ...achievementEvents].sort((a, b) => b.date.localeCompare(a.date));
  }, [achievements, litList]);

  const years = useMemo(() => {
    return Array.from(new Set(timeline.map((event) => event.year))).sort((a, b) => b.localeCompare(a));
  }, [timeline]);

  const visibleEvents = selectedYear === 'all'
    ? timeline
    : timeline.filter((event) => event.year === selectedYear);

  const groupedByYear = visibleEvents.reduce<Record<string, TimelineEvent[]>>((acc, event) => {
    acc[event.year] = acc[event.year] || [];
    acc[event.year].push(event);
    return acc;
  }, {});

  const distinctAttractions = new Set(litList.map((item) => item.id)).size;
  const unlockedAchievements = achievements.filter((item) => item.unlocked_at).length;
  const activeYears = years.length;

  if (loading) return <div className="page-loading">加载中...</div>;

  return (
    <div className="journey-page">
      <div className="journey-header journey-memory-header">
        <div>
          <h1>旅程回忆</h1>
          <p>按年份回看点亮过的地方，以及一路解锁的成就。</p>
        </div>
        <div className="journey-stats">
          <div className="j-stat">
            <div className="j-stat-num">{distinctAttractions}</div>
            <div className="j-stat-label">点亮景区</div>
          </div>
          <div className="j-stat">
            <div className="j-stat-num">{litList.length}</div>
            <div className="j-stat-label">旅行记录</div>
          </div>
          <div className="j-stat">
            <div className="j-stat-num">{unlockedAchievements}</div>
            <div className="j-stat-label">解锁成就</div>
          </div>
          <div className="j-stat">
            <div className="j-stat-num">{activeYears}</div>
            <div className="j-stat-label">年度足迹</div>
          </div>
        </div>
      </div>

      {timeline.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><MapIcon size={48} aria-hidden="true" /></div>
          <p>还没有旅程记录</p>
          <p className="sub">点亮景区后，这里会生成你的年度回忆线</p>
        </div>
      ) : (
        <>
          <div className="journey-year-tabs" aria-label="按年份筛选旅程">
            <button className={selectedYear === 'all' ? 'active' : ''} onClick={() => setSelectedYear('all')}>
              全部
            </button>
            {years.map((year) => (
              <button key={year} className={selectedYear === year ? 'active' : ''} onClick={() => setSelectedYear(year)}>
                {year}
              </button>
            ))}
          </div>

          <div className="journey-timeline">
            {Object.entries(groupedByYear)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([year, events]) => (
                <section key={year} className="journey-year-section">
                  <div className="journey-year-marker">
                    <span>{year}</span>
                    <em>{events.length} 条回忆</em>
                  </div>
                  <div className="journey-event-list">
                    {events.map((event) => (
                      <article key={event.id} className={`journey-event ${event.type}`}>
                        <div className="journey-event-date">
                          <CalendarDays size={15} aria-hidden="true" />
                          {formatDate(event.date)}
                        </div>
                        <div className="journey-event-body">
                          <div className="journey-event-icon">
                            {event.type === 'achievement' ? <Award size={18} aria-hidden="true" /> : <MapPin size={18} aria-hidden="true" />}
                          </div>
                          <div className="journey-event-content">
                            <div className="journey-event-title-row">
                              {event.level && <span className={`level-tag level-${event.level}`}>{event.level}</span>}
                              <h2>{event.title}</h2>
                            </div>
                            <p>{event.subtitle}</p>
                            <span className="journey-event-meta">
                              {event.type === 'achievement' && <Sparkles size={14} aria-hidden="true" />}
                              {event.meta}
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
