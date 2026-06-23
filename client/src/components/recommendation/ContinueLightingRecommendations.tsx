import { ArrowRight, MapPinned } from 'lucide-react';

export interface LightingRecommendation {
  type: string;
  title: string;
  reason: string;
  progress: number;
  tags: string[];
  actionText: string;
  actionRoute: string;
}

export default function ContinueLightingRecommendations({ items, onAction, title = '继续点亮推荐', variant = 'default' }: {
  items: LightingRecommendation[];
  onAction: (route: string) => void;
  title?: string;
  variant?: 'default' | 'compact';
}) {
  return (
    <section className={`lighting-recommendations ${variant === 'compact' ? 'compact' : ''}`}>
      <div className="lighting-recommendations-head"><MapPinned size={19} /><div><h2>{title}</h2><p>顺着已有足迹，下一步会更轻松</p></div></div>
      <div className="lighting-recommendation-list">
        {items.slice(0, 3).map((item, index) => (
          <article className="lighting-recommendation-card" key={`${item.actionRoute}-${index}`}>
            <div><h3>{item.title}</h3><p>{item.reason}</p></div>
            {item.progress > 0 && <div className="lighting-recommendation-progress"><i style={{ width: `${item.progress}%` }} /></div>}
            <div className="lighting-recommendation-foot">
              <span>{item.tags.slice(0, 2).map((tag) => <em key={tag}>{tag}</em>)}</span>
              <button type="button" onClick={() => onAction(item.actionRoute)}>{item.actionText}<ArrowRight size={15} /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
