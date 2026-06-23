import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Compass, RefreshCw, Share2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import PersonalitySharePoster from '../components/personality/PersonalitySharePoster';
import AchievementUnlockModal, { type UnlockedAchievement } from '../components/achievement/AchievementUnlockModal';
import type { PersonalityResult } from '../lib/personality';

export default function PersonalityResultPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<PersonalityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [posterOpen, setPosterOpen] = useState(false);
  const [retestOpen, setRetestOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [unlockedAchievements, setUnlockedAchievements] = useState<UnlockedAchievement[]>([]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    api.personality.mine()
      .then((payload) => {
        if (!payload.hasResult) navigate('/personality/test', { replace: true });
        else setResult(payload);
      })
      .catch(() => setToast('旅行人格加载失败'))
      .finally(() => setLoading(false));
    const stored = sessionStorage.getItem('trip_personality_new_achievements');
    if (stored) {
      sessionStorage.removeItem('trip_personality_new_achievements');
      try {
        const items = JSON.parse(stored) as UnlockedAchievement[];
        if (items.length) {
          api.achievements.mine().then((details) => {
            const detailMap = new Map((Array.isArray(details) ? details : []).map((item: UnlockedAchievement) => [item.id, item]));
            setUnlockedAchievements(items.map((item) => ({ ...item, ...(detailMap.get(item.id) || {}) })));
          }).catch(() => setUnlockedAchievements(items));
        }
      } catch { /* Ignore invalid transient state. */ }
    }
  }, [navigate]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleAchievements = useCallback((items: Array<{ id: number; name: string }>) => {
    if (!items.length) return;
    api.achievements.mine().then((details) => {
      const detailMap = new Map((Array.isArray(details) ? details : []).map((item: UnlockedAchievement) => [item.id, item]));
      setUnlockedAchievements(items.map((item) => ({ ...item, ...(detailMap.get(item.id) || {}) })));
    }).catch(() => setUnlockedAchievements(items));
  }, []);

  if (loading) return <div className="page-loading">正在读取你的旅行人格...</div>;
  if (!result) return <div className="personality-page personality-error">没有找到旅行人格结果</div>;

  return (
    <div className="personality-page personality-result-page">
      <button className="personality-back" type="button" onClick={() => navigate('/profile')} aria-label="返回我的"><ArrowLeft size={20} /></button>
      <section className="personality-result-hero">
        <div className="personality-result-brand"><img src="/images/shijie-logo-mark.png" alt="" /><span>识界旅行人格</span></div>
        <Compass className="personality-result-compass" size={40} aria-hidden="true" />
        <div className="personality-result-code">{result.typeCode}</div>
        <h1>{result.typeName}</h1>
        <p>{result.summary}</p>
        <div className="personality-result-pills">{result.dimensionLabels.map((label) => <span key={label}>{label}</span>)}</div>
      </section>

      <section className="personality-result-section"><h2><Sparkles size={18} />像这样的你</h2>{result.description.split('\n\n').map((text) => <p key={text}>{text}</p>)}</section>
      <section className="personality-result-section"><h2><Compass size={18} />适合你的旅行方式</h2><ul>{result.travelTips.map((tip) => <li key={tip}>{tip}</li>)}</ul></section>

      <button className="personality-primary personality-share-button" type="button" onClick={() => setPosterOpen(true)}><Share2 size={18} />生成我的人格海报</button>
      <button className="personality-retest" type="button" onClick={() => setRetestOpen(true)}><RefreshCw size={15} />重新测试</button>

      {posterOpen && <PersonalitySharePoster result={result} onClose={() => setPosterOpen(false)} onAchievements={handleAchievements} />}
      {unlockedAchievements.length > 0 && <AchievementUnlockModal achievements={unlockedAchievements} source="personality" continueLabel="返回人格结果" onClose={() => setUnlockedAchievements([])} onContinue={() => setUnlockedAchievements([])} onViewAchievements={() => navigate('/achievements')} />}
      {retestOpen && (
        <div className="modal-overlay" onClick={() => setRetestOpen(false)}>
          <div className="personality-confirm" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2>重新认识自己？</h2><p>重新测试会更新当前旅行人格结果，历史成就会继续保留。</p>
            <div><button type="button" onClick={() => setRetestOpen(false)}>取消</button><button type="button" className="primary" onClick={() => navigate('/personality/test')}>重新测试</button></div>
          </div>
        </div>
      )}
      {toast && <div className="personality-toast">{toast}</div>}
    </div>
  );
}
