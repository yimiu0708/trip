import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronDown, Compass, GitBranch, Map as MapIcon, Medal, Search, Sparkles, Trophy } from 'lucide-react';
import { api } from '../api/client';
import AchievementBadge, { type Achievement } from '../components/AchievementBadge';
import AchievementDetailModal from '../components/achievement/AchievementDetailModal';

type WallTab = 'footprint' | 'skill' | 'easter';
type EasterGroupKey = 'seasons' | 'collector' | 'personality' | 'specials';
interface Series { key: string; title: string; items: Achievement[]; cover: Achievement }

export default function AchievementPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [wallTab, setWallTab] = useState<WallTab>('footprint');
  const [easterOpen, setEasterOpen] = useState<Record<EasterGroupKey, boolean>>({ seasons: true, collector: true, personality: true, specials: false });
  const [selected, setSelected] = useState<{ items: Achievement[]; id: number } | null>(null);

  useEffect(() => {
    api.achievements.mine()
      .then((items) => setAchievements(Array.isArray(items) ? items : []))
      .catch(() => setAchievements([]))
      .finally(() => setLoading(false));
  }, []);

  const series = useMemo(() => buildSeries(achievements), [achievements]);
  const unlocked = achievements.filter((item) => item.unlocked_at);
  const uniqueUnlocked = new Set(unlocked.map((item) => item.id)).size;
  const completion = achievements.length ? Math.round(uniqueUnlocked / achievements.length * 100) : 0;
  const latest = [...unlocked].sort((a, b) => String(b.unlocked_at).localeCompare(String(a.unlocked_at)))[0];
  const easterSeries = [...series.easter.seasons, ...series.easter.collector, ...series.easter.personality, ...series.easter.specials];
  const wallCategories = [
    { id: 'footprint' as const, label: '足迹版图', count: series.footprint.length, icon: <MapIcon size={17} />, series: series.footprint },
    { id: 'skill' as const, label: '技能树', count: series.skill.length, icon: <GitBranch size={17} />, series: series.skill },
    { id: 'easter' as const, label: '彩蛋猎人', count: 4, icon: <Search size={17} />, series: easterSeries },
  ];
  const activeWallCategory = wallCategories.find((category) => category.id === wallTab) || wallCategories[0];

  const openAchievement = (achievement: Achievement, items?: Achievement[]) => setSelected({ items: items || familyFor(achievement, series), id: achievement.id });
  const handleEquip = async (achievement: Achievement) => {
    if (achievement.is_equipped) await api.achievements.unequip(); else await api.achievements.equip(achievement.id);
    const updated = achievements.map((item) => ({ ...item, is_equipped: achievement.is_equipped ? 0 : Number(item.id === achievement.id) }));
    setAchievements(updated);
    setSelected((current) => current ? { ...current, items: current.items.map((item) => ({ ...item, is_equipped: achievement.is_equipped ? 0 : Number(item.id === achievement.id) })) } : current);
  };

  if (loading) return <div className="page-loading">加载中...</div>;
  return <div className="achievement-page achievement-vault-page achievement-v4">
    <header className="achievement-vault-titlebar floating-page-titlebar"><div><h1 className="achievement-vault-heading floating-page-heading"><Medal className="floating-page-icon" size={22} /><span>我的徽章</span></h1><p>每一次点亮，都留下一枚旅行印记</p></div></header>
    <section className="achievement-library-summary">
      <div className="achievement-library-count"><span>已收入图鉴</span><strong>{uniqueUnlocked}<small> / {achievements.length}</small></strong><p>{latest ? `最近获得 · ${latest.display_name || latest.name}` : '点亮第一处足迹，收下你的第一枚徽章'}</p></div>
      <div className="achievement-library-progress" role="progressbar" aria-label={`徽章完成度 ${completion}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion} style={{ '--achievement-rate': `${completion * 3.6}deg` } as CSSProperties}><span><b>{completion}</b>%</span></div>
    </section>
    <section className="achievement-wall-panel achievement-library-panel">
      <div className="achievement-wall-tabs" role="tablist" aria-label="徽章分类">
        {wallCategories.map((category) => <button
          id={`achievement-wall-tab-${category.id}`}
          key={category.id}
          type="button"
          role="tab"
          aria-selected={wallTab === category.id}
          aria-controls="achievement-wall-tabpanel"
          className={wallTab === category.id ? 'active' : ''}
          onClick={() => setWallTab(category.id)}
        >{category.icon}<span>{category.label}</span><small>{category.count}</small></button>)}
      </div>
      <section
        id="achievement-wall-tabpanel"
        className="achievement-wall-category"
        role="tabpanel"
        aria-labelledby={`achievement-wall-tab-${activeWallCategory.id}`}
      >
        {wallTab === 'easter' ? <EasterEggGroups groups={series.easter} open={easterOpen} onToggle={(key) => setEasterOpen((current) => ({ ...current, [key]: !current[key] }))} onOpen={openAchievement} /> : <AchievementGrid series={activeWallCategory.series} onOpen={openAchievement} />}
      </section>
    </section>
    {selected && <AchievementDetailModal items={selected.items} initialId={selected.id} onClose={() => setSelected(null)} onEquip={handleEquip} />}
  </div>;
}

function EasterEggGroups({ groups, open, onToggle, onOpen }: {
  groups: ReturnType<typeof buildSeries>['easter'];
  open: Record<EasterGroupKey, boolean>;
  onToggle: (key: EasterGroupKey) => void;
  onOpen: (item: Achievement, items?: Achievement[]) => void;
}) {
  const sections = [
    { key: 'seasons' as const, title: '四季旅人', count: `${groups.seasons.length} 枚`, icon: <Compass size={17} />, series: groups.seasons },
    { key: 'collector' as const, title: '收藏家', count: `${groups.collector.length} 个系列`, icon: <Trophy size={17} />, series: groups.collector },
    { key: 'personality' as const, title: '旅行人格', count: `${groups.personality.length} 枚`, icon: <Compass size={17} />, series: groups.personality },
    { key: 'specials' as const, title: '彩蛋成就', count: `${groups.specials.length} 枚`, icon: <Sparkles size={17} />, series: groups.specials },
  ];
  return <div className="achievement-easter-groups">{sections.map((section) => <section className={`achievement-easter-group ${open[section.key] ? 'open' : ''}`} key={section.key}>
    <button type="button" className="achievement-easter-group-toggle" aria-expanded={open[section.key]} aria-controls={`achievement-easter-${section.key}`} onClick={() => onToggle(section.key)}>
      <span>{section.icon}<strong>{section.title}</strong></span><span><em>{section.count}</em><ChevronDown size={17} /></span>
    </button>
    {open[section.key] && <div id={`achievement-easter-${section.key}`}><AchievementGrid series={section.series} onOpen={onOpen} /></div>}
  </section>)}</div>;
}

function AchievementGrid({ series, onOpen }: { series: Series[]; onOpen: (item: Achievement, items?: Achievement[]) => void }) {
  return <div className="achievement-series-grid">{series.map((group) => {
    const secret = group.cover.type === 'special' && !group.cover.unlocked_at;
    return <div className="achievement-series-card" key={group.key}><AchievementBadge a={group.cover} special={group.cover.type === 'special'} variant="series" onClick={() => onOpen(group.cover, group.items)} />{group.items.length > 1 && <span>{secret ? '???' : group.title}</span>}</div>;
  })}</div>;
}

function buildSeries(items: Achievement[]) {
  const make = (key: string, title: string, members: Achievement[]): Series | null => {
    const sorted = [...members].sort((a, b) => (a.level || 0) - (b.level || 0) || a.id - b.id);
    if (!sorted.length) return null;
    const cover = [...sorted].filter((item) => item.unlocked_at).sort((a, b) => (b.level || 0) - (a.level || 0))[0] || sorted[0];
    return { key, title, items: sorted, cover };
  };
  const unlockedFirst = (members: Achievement[]) => [...members].sort((a, b) => Number(Boolean(b.unlocked_at)) - Number(Boolean(a.unlocked_at)) || a.id - b.id);
  const footprint = [['province', '省份探索'], ['city', '城市漫游'], ['attraction', '景区集邮'], ['region', '八方巡游']].map(([type, title]) => make(type, title, items.filter((item) => item.type === type))).filter(Boolean) as Series[];
  const skill = Array.from({ length: 11 }, (_, index) => {
    const categoryId = index + 1; const members = items.filter((item) => item.type === 'category' && item.condition_value === categoryId);
    return make(`category-${categoryId}`, members[0]?.condition_desc.replace(/\s+Lv\.\d+$/, '') || `技能 ${categoryId}`, members);
  }).filter(Boolean) as Series[];
  const collector = make('collector', '收藏家', items.filter((item) => item.type === 'collector' || item.type === 'favorite'));
  const seasons = unlockedFirst(items.filter((item) => item.type === 'season')).map((item) => make(`season-${item.id}`, item.display_name || item.name, [item])!);
  const personality = unlockedFirst(items.filter((item) => item.type === 'special' && item.badge_style.includes('personality'))).map((item) => make(`special-${item.id}`, item.display_name || item.name, [item])!);
  const specials = unlockedFirst(items.filter((item) => item.type === 'special' && !item.badge_style.includes('personality'))).map((item) => make(`special-${item.id}`, item.display_name || item.name, [item])!);
  return { footprint, skill, easter: { seasons, collector: collector ? [collector] : [], personality, specials } };
}

function familyFor(item: Achievement, all: ReturnType<typeof buildSeries>) {
  const easter = [...all.easter.seasons, ...all.easter.collector, ...all.easter.personality, ...all.easter.specials];
  return [...all.footprint, ...all.skill, ...easter].find((series) => series.items.some((candidate) => candidate.id === item.id))?.items || [item];
}
