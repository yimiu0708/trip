import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import { Building2, GitBranch, Map as MapIcon, Medal, PartyPopper, Search, Sparkles, Tag, Trophy } from 'lucide-react';
import AchievementBadge from '../components/AchievementBadge';

interface Achievement {
  id: number;
  name: string;
  display_name?: string;
  display_desc?: string;
  type: string;
  level: number | null;
  condition_value?: number | null;
  condition_desc: string;
  icon: string;
  badge_style: string;
  unlocked_at: string | null;
  unlock_count?: number;
  snapshot_lit?: number | null;
  snapshot_total?: number | null;
  snapshot_percent?: number | null;
  is_current_max?: number | null;
}

const TYPE_LABELS: Record<string, string> = {
  province: '省份探索',
  city: '城市漫游',
  attraction: '景区集邮',
  collector: '收藏家',
  special: '彩蛋成就',
};

type AchievementTabKey = 'footprint' | 'skill' | 'easterEgg';

const ACHIEVEMENT_TABS: {
  key: AchievementTabKey;
  label: string;
  icon: ReactNode;
}[] = [
  { key: 'footprint', label: '足迹版图', icon: <MapIcon size={16} aria-hidden="true" /> },
  { key: 'skill', label: '技能树', icon: <GitBranch size={16} aria-hidden="true" /> },
  { key: 'easterEgg', label: '彩蛋猎人', icon: <Search size={16} aria-hidden="true" /> },
];

export default function AchievementPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AchievementTabKey>('footprint');

  useEffect(() => {
    api.achievements.mine()
      .then((a) => {
        setAchievements(a);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">加载中...</div>;

  const unlockedAchievements = achievements.filter((a) => a.unlocked_at);
  const gloryTop3 = [...unlockedAchievements]
    .sort((a, b) => {
      const levelDiff = (b.level || 0) - (a.level || 0);
      if (levelDiff !== 0) return levelDiff;
      return String(b.unlocked_at).localeCompare(String(a.unlocked_at));
    })
    .slice(0, 3);

  const grouped = buildAchievementGroups(achievements, activeTab);
  const unlockedCount = unlockedAchievements.length;

  return (
    <div className="achievement-page achievement-vault-page">
      <header className="achievement-vault-titlebar floating-page-titlebar">
        <div>
          <h1 className="achievement-vault-heading floating-page-heading">
            <Medal className="achievement-title-icon floating-page-icon" size={22} aria-hidden="true" />
            <span>成就</span>
          </h1>
          <p>已获得 {unlockedCount} 枚成就徽章</p>
        </div>
      </header>

      <section className="achievement-vault-section">
        <div className="achievement-glory">
          <div className="achievement-glory-title">
            <Trophy size={18} aria-hidden="true" />
            <span>荣耀区 TOP3</span>
          </div>
          {gloryTop3.length > 0 ? (
            <div className="achievement-glory-grid">
              {gloryTop3.map((a) => (
                <AchievementBadge key={`glory-${a.id}`} a={a} special={a.type === 'special'} variant="glory" />
              ))}
            </div>
          ) : (
            <div className="achievement-glory-empty">点亮景点后，这里会展示等级最高的三枚徽章</div>
          )}
        </div>

        <div className="achievement-tabbar-shell">
          <div className="achievement-tabbar" role="tablist" aria-label="成就分类">
            {ACHIEVEMENT_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={activeTab === tab.key ? 'active' : ''}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {grouped.map((group, index) => (
          <details className="achievement-group" key={group.key} open={index < 4}>
            <summary>
              <span>{group.icon}{group.title}</span>
              <em>{group.unlocked}/{group.items.length}</em>
            </summary>
            <div className="badge-grid">
              {group.items.map((a) => <AchievementBadge key={a.id} a={a} special={a.type === 'special'} variant="compact" />)}
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}

function buildAchievementGroups(achievements: Achievement[], activeTab: AchievementTabKey) {
  const fixedTypesByTab: Record<AchievementTabKey, string[]> = {
    footprint: ['province', 'city', 'attraction'],
    skill: [],
    easterEgg: ['collector', 'special'],
  };
  const fixedTypes = fixedTypesByTab[activeTab];
  const groups: { key: string; title: string; icon: ReactNode; items: Achievement[]; unlocked: number }[] = [];

  const iconMap: Record<string, ReactNode> = {
    province: <Sparkles size={16} aria-hidden="true" />,
    city: <Building2 size={16} aria-hidden="true" />,
    attraction: <Medal size={16} aria-hidden="true" />,
    collector: <Trophy size={16} aria-hidden="true" />,
    special: <PartyPopper size={16} aria-hidden="true" />,
  };

  for (const type of fixedTypes) {
    const items = sortAchievementsForDisplay(achievements.filter((a) => a.type === type));
    if (!items.length) continue;
    groups.push({
      key: type,
      title: TYPE_LABELS[type] || type,
      icon: iconMap[type],
      items,
      unlocked: items.filter((a) => a.unlocked_at).length,
    });
  }

  if (activeTab !== 'skill') return groups;

  const categoryMap = new Map<number, Achievement[]>();
  achievements
    .filter((a) => a.type === 'category')
    .forEach((achievement) => {
      const key = achievement.condition_value || 0;
      categoryMap.set(key, [...(categoryMap.get(key) || []), achievement]);
    });

  for (const [categoryId, items] of categoryMap) {
    const sortedItems = sortAchievementsForDisplay(items);
    const lineName = items[0]?.condition_desc?.replace(/\s+Lv\.\d+$/, '') || `分类 ${categoryId}`;
    groups.push({
      key: `category-${categoryId}`,
      title: lineName,
      icon: <Tag size={16} aria-hidden="true" />,
      items: sortedItems,
      unlocked: sortedItems.filter((a) => a.unlocked_at).length,
    });
  }

  return groups;
}

function sortAchievementsForDisplay(items: Achievement[]) {
  return [...items].sort((a, b) => {
    const unlockDiff = Number(!!b.unlocked_at) - Number(!!a.unlocked_at);
    if (unlockDiff !== 0) return unlockDiff;

    const levelDiff = getAchievementLevel(a) - getAchievementLevel(b);
    if (levelDiff !== 0) return levelDiff;

    return a.id - b.id;
  });
}

function getAchievementLevel(achievement: Achievement) {
  return achievement.level ?? Number.MAX_SAFE_INTEGER;
}
