import { ArrowRight, Compass } from 'lucide-react';
import { useState } from 'react';
import FavoriteButton, { type FavoriteState } from '../favorite/FavoriteButton';

export interface NextTripItem {
  id: string;
  recommendationType: string;
  targetType: 'city' | 'attraction';
  targetId: number;
  title: string;
  reason: string;
  tags: string[];
  progress: number;
  isLit: boolean;
  isFavorited: boolean;
  favoriteId: number | null;
  actionText: string;
  actionRoute: string;
}

export default function NextTripRecommendations({ items, onAction, title = '下一次出行推荐', onMessage, onFavoriteChange }: {
  items: NextTripItem[];
  onAction: (route: string) => void;
  title?: string;
  onMessage?: (message: string, undo?: () => void) => void;
  onFavoriteChange?: (item: NextTripItem, state: FavoriteState) => void;
}) {
  const [states, setStates] = useState<Record<string, FavoriteState>>(() => Object.fromEntries(items.map((item) => [item.id, { id: item.favoriteId, active: item.isFavorited }])));
  if (!items.length) return null;
  return <section className="next-trip-section"><header><span><Compass size={19} /></span><div><h2>{title}</h2><p>把心动的地方，留给下一次出发</p></div></header><div className="next-trip-grid">{items.map((item) => <article className="next-trip-card" key={item.id}><div className={`next-trip-cover cover-${item.recommendationType}`}><span>{item.tags[0] || '下一站'}</span><FavoriteButton targetType={item.targetType} targetId={item.targetId} source="recommendation" compact initial={states[item.id]} onChange={(state) => { setStates((current) => ({ ...current, [item.id]: state })); onFavoriteChange?.(item, state); }} onMessage={onMessage} /></div><div className="next-trip-body"><h3>{item.title}</h3><p>{item.reason}</p>{item.progress > 0 && <div className="next-trip-progress"><i style={{ width: `${item.progress}%` }} /></div>}<div className="next-trip-tags">{item.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div><button type="button" onClick={() => onAction(item.actionRoute)}>{item.actionText}<ArrowRight size={15} /></button></div></article>)}</div></section>;
}
