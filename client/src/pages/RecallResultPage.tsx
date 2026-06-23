import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Footprints, Map, MapPinned, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { useRecall } from '../context/RecallContext';
import { trackRecallEvent } from '../lib/analytics';
import { api } from '../api/client';
import NextGoalCard, { type NextGoalData } from '../components/goal/NextGoalCard';
import NextTripRecommendations, { type NextTripItem } from '../components/recommendation/NextTripRecommendations';
import FavoriteToast, { type FavoriteToastState } from '../components/favorite/FavoriteToast';
import AchievementUnlockModal, { type UnlockedAchievement } from '../components/achievement/AchievementUnlockModal';

export default function RecallResultPage() {
  const navigate = useNavigate();
  const { lastResult, resetRecall, selectedCities } = useRecall();
  const [nextGoal, setNextGoal] = useState<NextGoalData | null>(null);
  const [recommendations, setRecommendations] = useState<NextTripItem[]>([]);
  const [favoriteToast, setFavoriteToast] = useState<FavoriteToastState | null>(null);
  const [unlockModalOpen, setUnlockModalOpen] = useState(true);
  const [unlockedAchievements, setUnlockedAchievements] = useState<UnlockedAchievement[]>([]);

  const delta = lastResult?.delta || {
    provinces: 0,
    cities: 0,
    attractions: lastResult?.litIds.length || 0,
    visits: lastResult?.litIds.length || 0,
  };
  const cumulative = lastResult?.cumulative || {
    provinces: 0,
    cities: 0,
    attractions: 0,
  };
  const achievementCount = lastResult?.newAchievements.length || 0;

  useEffect(() => {
    if (!lastResult) return;
    trackRecallEvent('recall_result_view', {
      delta_provinces: delta.provinces,
      delta_cities: delta.cities,
      delta_attractions: delta.attractions,
      delta_visits: delta.visits,
      achievement_count: achievementCount,
    });
  }, [achievementCount, delta.attractions, delta.cities, delta.provinces, delta.visits, lastResult]);

  useEffect(() => {
    if (!lastResult) return;
    Promise.all([
      api.user.nextGoal().catch(() => null),
      api.recommendations.nextTrip({ source: 'completion', limit: 3, cityIds: selectedCities.map((city) => city.id) }).catch(() => ({ items: [] })),
    ]).then(([goal, recommendationResult]) => {
      setNextGoal(goal);
      setRecommendations(recommendationResult.items || []);
    }).catch(() => undefined);

    api.achievements.mine().then((achievements) => {
      const details = new globalThis.Map((Array.isArray(achievements) ? achievements : []).map((item: any) => [item.id, item]));
      setUnlockedAchievements(lastResult.newAchievements.map((item) => ({ ...item, ...(details.get(item.id) || {}) })));
    }).catch(() => setUnlockedAchievements(lastResult.newAchievements));
  }, [lastResult, selectedCities]);

  if (!lastResult) {
    return (
      <div className="recall-page">
        <section className="recall-card">
          <h1>还没有点亮结果</h1>
          <p>完成一次找回足迹后，这里会展示本次新增和累计点亮数据。</p>
          <button type="button" className="recall-primary-btn" onClick={() => navigate('/recall')}>
            去找回足迹
          </button>
        </section>
      </div>
    );
  }

  const recallAgain = () => {
    trackRecallEvent('recall_continue_click', {
      source: 'result',
    });
    resetRecall();
    navigate('/recall/cities');
  };

  const viewMap = () => {
    trackRecallEvent('recall_view_map_click', {
      source: 'result',
    });
    window.dispatchEvent(new Event('trip:progress-updated'));
    navigate('/map');
  };

  return (
    <div className="recall-page recall-result-page">
      <section className="recall-result-hero">
        <div className="recall-result-mark" aria-hidden="true">
          <img src="/images/shijie-logo-mark.png" alt="" />
          <CheckCircle2 size={30} />
        </div>
        <h1>你的旅行地图已被点亮</h1>
        <p>这次找回的足迹已经写入地图和旅程记录。</p>
      </section>

      <ResultSection title="本次新增" icon={<Sparkles size={18} aria-hidden="true" />} compact>
          <div className="recall-result-grid three">
          <ResultMetric label="省份" value={delta.provinces} />
          <ResultMetric label="城市" value={delta.cities} />
          <ResultMetric label="景区" value={delta.attractions} />
        </div>
      </ResultSection>

      <ResultSection title="累计点亮" icon={<MapPinned size={18} aria-hidden="true" />} compact>
        <div className="recall-result-grid three">
          <ResultMetric label="省份" value={cumulative.provinces} />
          <ResultMetric label="城市" value={cumulative.cities} />
          <ResultMetric label="景区" value={cumulative.attractions} />
        </div>
      </ResultSection>

      <ResultSection title={achievementCount > 0 ? '新解锁成就' : '成就进度'} icon={<Trophy size={18} aria-hidden="true" />}>
        {achievementCount > 0 ? (
          <div className="recall-achievement-list">
            {lastResult.newAchievements.map((achievement) => (
              <span key={achievement.id}>{achievement.display_name || achievement.name}</span>
            ))}
          </div>
        ) : (
          <div className="recall-result-empty">本次暂未解锁新成就，继续补录会更接近下一枚徽章。</div>
        )}
      </ResultSection>

      {nextGoal && <NextGoalCard goal={nextGoal} onAction={(route) => navigate(route)} />}
      {recommendations.length > 0 && <NextTripRecommendations items={recommendations} title="也可以收藏为下一次出行" onAction={(route) => navigate(route)} onMessage={(text, undo) => { setFavoriteToast({ text, undo }); window.setTimeout(() => setFavoriteToast(null), 6000); }} />}
      <FavoriteToast toast={favoriteToast} onClose={() => setFavoriteToast(null)} />

      <section className="recall-next-actions" aria-label="下一步操作">
        <ResultAction label="查看我的地图" onAction={viewMap} variant="primary" icon={<Map size={18} aria-hidden="true" />} />
        <ResultAction label="继续补录城市" onAction={recallAgain} variant="secondary" icon={<RotateCcw size={18} aria-hidden="true" />} />
        <ResultAction label="查看旅程记录" onAction={() => navigate('/journeys')} variant="text" icon={<Footprints size={17} aria-hidden="true" />} />
      </section>
      {unlockModalOpen && unlockedAchievements.length > 0 && (
        <AchievementUnlockModal
          achievements={unlockedAchievements}
          source="recall"
          continueLabel="返回点亮结果"
          onClose={() => setUnlockModalOpen(false)}
          onViewAchievements={() => navigate('/achievements')}
          onContinue={() => setUnlockModalOpen(false)}
        />
      )}
    </div>
  );
}

function ResultAction({
  label,
  onAction,
  variant,
  icon,
}: {
  label?: string;
  onAction?: () => void;
  variant: 'primary' | 'secondary' | 'text';
  icon?: ReactNode;
}) {
  if (!label?.trim() || typeof onAction !== 'function') return null;

  return (
    <button type="button" className={`recall-result-action ${variant}`} onClick={onAction}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ResultSection({
  title,
  icon,
  children,
  compact = false,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`recall-card recall-result-section${compact ? ' compact' : ''}`}>
      <h2>{icon}<span>{title}</span></h2>
      {children}
    </section>
  );
}

function ResultMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="recall-result-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
