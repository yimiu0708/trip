import type { CSSProperties } from 'react';
import { ArrowRight, Sparkles, Target } from 'lucide-react';
import type { NextGoalData } from '../goal/NextGoalCard';

export default function AchievementJourneyCockpit({ unlockedCount, completion, latestName, goal, onAction }: {
  unlockedCount: number;
  completion: number;
  latestName?: string;
  goal: NextGoalData | null;
  onAction: (route: string) => void;
}) {
  return <section className="achievement-journey-cockpit">
    <header className="achievement-cockpit-overview">
      <div>
        <span>你的成就旅程</span>
        <strong>{unlockedCount}<small> 枚徽章已收入图鉴</small></strong>
        <p>最近解锁：{latestName || '等待第一束旅行光'}</p>
      </div>
      <div className="achievement-overview-ring" style={{ '--achievement-rate': `${completion * 3.6}deg` } as CSSProperties}><b>{completion}%</b></div>
    </header>
    {goal ? <div className="achievement-cockpit-goal">
      <div className="achievement-cockpit-goal-head">
        <span className="achievement-cockpit-target" aria-hidden="true"><Target size={20} /></span>
        <div><small>下一枚徽章</small><h2>{goal.title}</h2></div>
        <strong>{goal.progress}%</strong>
      </div>
      <p>{goal.description}</p>
      <div className="achievement-cockpit-progress" aria-label={`完成进度 ${goal.progress}%`}><i style={{ width: `${goal.progress}%` }} /></div>
      <div className="achievement-cockpit-meta"><span>已完成 {goal.current}/{goal.target}</span><em>还差 {goal.remaining}{goal.unit}</em></div>
      <button type="button" onClick={() => onAction(goal.actionRoute)}>
        <span><b>推荐行动</b>{goal.recommendation}</span>
        <span>{goal.actionText}<ArrowRight size={16} /></span>
      </button>
    </div> : <div className="achievement-cockpit-empty">
      <Sparkles size={20} aria-hidden="true" />
      <div><strong>下一枚徽章正在整理中</strong><p>继续点亮新的足迹，图鉴会自动更新。</p></div>
    </div>}
  </section>;
}
