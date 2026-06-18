import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Footprints, Map, MapPinned, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { useRecall } from '../context/RecallContext';
import { trackRecallEvent } from '../lib/analytics';

export default function RecallResultPage() {
  const navigate = useNavigate();
  const { lastResult, resetRecall } = useRecall();

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
        <div className="recall-result-grid four">
          <ResultMetric label="省份" value={delta.provinces} />
          <ResultMetric label="城市" value={delta.cities} />
          <ResultMetric label="景区" value={delta.attractions} />
          <ResultMetric label="访问记录" value={delta.visits} />
        </div>
      </ResultSection>

      <ResultSection title="累计点亮" icon={<MapPinned size={18} aria-hidden="true" />} compact>
        <div className="recall-result-grid three">
          <ResultMetric label="省份" value={cumulative.provinces} />
          <ResultMetric label="城市" value={cumulative.cities} />
          <ResultMetric label="景区" value={cumulative.attractions} />
        </div>
      </ResultSection>

      <ResultSection title="新解锁成就" icon={<Trophy size={18} aria-hidden="true" />}>
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

      <section className="recall-next-actions" aria-label="下一步操作">
        <ResultAction label="查看我的地图" onAction={viewMap} variant="primary" icon={<Map size={18} aria-hidden="true" />} />
        <ResultAction label="继续补录城市" onAction={recallAgain} variant="secondary" icon={<RotateCcw size={18} aria-hidden="true" />} />
        <ResultAction label="查看旅程记录" onAction={() => navigate('/journeys')} variant="text" icon={<Footprints size={17} aria-hidden="true" />} />
      </section>
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
