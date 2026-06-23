import { ArrowRight, Target } from 'lucide-react';

export interface NextGoalData {
  type: string;
  title: string;
  description: string;
  current: number;
  target: number;
  remaining: number;
  progress: number;
  unit: string;
  recommendation: string;
  actionText: string;
  actionRoute: string;
  icon?: string;
}

export default function NextGoalCard({ goal, onAction, eyebrow = '下一目标' }: {
  goal: NextGoalData;
  onAction: (route: string) => void;
  eyebrow?: string;
}) {
  return (
    <section className="next-goal-card">
      <div className="next-goal-head">
        <span className="next-goal-icon" aria-hidden="true"><Target size={22} /></span>
        <div><small>{eyebrow}</small><h2>{goal.title}</h2></div>
        <strong>{goal.progress}%</strong>
      </div>
      <p>{goal.description}</p>
      <div className="next-goal-progress" aria-label={`完成进度 ${goal.progress}%`}><i style={{ width: `${goal.progress}%` }} /></div>
      <div className="next-goal-meta">
        <span>已完成 {goal.current}/{goal.target}</span>
        <em>还差 {goal.remaining}{goal.unit}</em>
      </div>
      <button type="button" onClick={() => onAction(goal.actionRoute)}>
        <span><b>推荐行动</b>{goal.recommendation}</span>
        <span>{goal.actionText}<ArrowRight size={16} /></span>
      </button>
    </section>
  );
}
