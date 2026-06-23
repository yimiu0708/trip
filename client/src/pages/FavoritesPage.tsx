import { Compass, Heart, Landmark, MapPin, Sparkles, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import FavoriteButton from '../components/favorite/FavoriteButton';
import NextTripRecommendations, { type NextTripItem } from '../components/recommendation/NextTripRecommendations';

type FavoriteItem = any;

export default function FavoritesPage() {
  const navigate = useNavigate();
  const [targetType, setTargetType] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('unlit_first');
  const [data, setData] = useState<{ stats: any; items: FavoriteItem[] }>({ stats: { cities: 0, attractions: 0, lit: 0, total: 0 }, items: [] });
  const [recommendations, setRecommendations] = useState<NextTripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const notify = (text: string, undo?: () => void) => { setToast({ text, undo }); window.setTimeout(() => setToast(null), 6000); };
  const load = () => { setLoading(true); Promise.all([api.favorites.list({ targetType, status, sort }), api.recommendations.nextTrip({ source: 'favorites', limit: 3 })]).then(([favorites, recs]) => { setData(favorites); setRecommendations(recs.items || []); }).finally(() => setLoading(false)); };
  useEffect(load, [targetType, status, sort]);

  return <div className="favorites-page"><header className="favorites-hero"><div><span><Heart size={18} fill="currentColor" />我的收藏</span><h1>把想去的地方先存起来</h1><p>从一颗心开始，慢慢长成下一次真实出发。</p></div></header><section className="favorite-stats"><article><Landmark size={18} /><strong>{data.stats.cities}</strong><span>城市</span></article><article><MapPin size={18} /><strong>{data.stats.attractions}</strong><span>景区</span></article><article><Sparkles size={18} /><strong>{data.stats.lit}</strong><span>已点亮</span></article></section><section className="favorite-controls"><div><span>类型</span>{[['all','全部'],['city','城市'],['attraction','景区']].map(([value,label]) => <button className={targetType === value ? 'active' : ''} onClick={() => setTargetType(value)} key={value}>{label}</button>)}</div><div><span>状态</span>{[['all','全部'],['unlit','未点亮'],['lit','已点亮']].map(([value,label]) => <button className={status === value ? 'active' : ''} onClick={() => setStatus(value)} key={value}>{label}</button>)}</div><label>排序<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="unlit_first">未点亮优先</option><option value="recent">最近收藏</option><option value="progress_desc">城市进度高</option></select></label></section>{loading ? <div className="page-loading">正在整理收藏...</div> : data.items.length ? <section className="favorite-list">{data.items.map((item) => <article className="favorite-card" key={item.id}><div className={`favorite-card-mark ${item.targetType}`}><span>{item.targetType === 'city' ? <Landmark /> : <MapPin />}</span></div><div className="favorite-card-main"><div><small>{item.provinceName}{item.region ? ` · ${item.region}` : ''}</small><h2>{item.name}</h2><p>{item.targetType === 'city' ? (item.representativeNames?.join(' · ') || '从这座城市开始下一程') : `${item.cityName}${item.level ? ` · ${item.level}` : ''}`}</p></div>{item.targetType === 'city' && <div className="favorite-card-progress"><span>城市进度 {item.progress}%</span><i><b style={{ width: `${item.progress}%` }} /></i></div>}<div className="favorite-card-actions"><button type="button" onClick={() => navigate(item.actionRoute)}>{item.isLit ? '查看记录' : item.targetType === 'city' ? '查看城市' : '去点亮'}</button><FavoriteButton targetType={item.targetType} targetId={item.targetId} initial={{ id: item.id, active: true }} source="favorites" onChange={(state) => { if (!state.active) window.setTimeout(load, 80); }} onMessage={notify} /></div></div></article>)}</section> : <section className="favorite-empty"><Heart size={34} /><h2>还没有符合条件的收藏</h2><p>在推荐卡片或景区列表中，点击心形图标即可收藏。</p><button type="button" onClick={() => navigate('/map')}><Compass size={17} />去看看推荐</button></section>}<NextTripRecommendations items={recommendations} title="从收藏继续发现" onAction={navigate} onMessage={notify} onFavoriteChange={() => window.setTimeout(load, 120)} />{toast && <div className="favorite-toast"><span>{toast.text}</span>{toast.undo && <button onClick={() => { toast.undo?.(); setToast(null); window.setTimeout(load, 120); }}><Undo2 size={15} />撤销</button>}</div>}</div>;
}
