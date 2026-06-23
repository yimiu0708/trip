import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, MapPinned, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { useRecall } from '../context/RecallContext';
import { trackRecallEvent } from '../lib/analytics';

export default function RecallIntroPage() {
  const navigate = useNavigate();
  const { selectedCity, selectedAttractionIds } = useRecall();
  const [submittingAction, setSubmittingAction] = useState<'start' | 'skip' | ''>('');

  useEffect(() => {
    trackRecallEvent('recall_intro_view');
  }, []);

  const startRecall = async () => {
    trackRecallEvent('recall_intro_start_click', {
      has_draft_city: !!selectedCity,
      selected_attraction_count: selectedAttractionIds.length,
    });
    setSubmittingAction('start');
    try {
      await api.recall.updateGuide('seen');
    } catch {
      // 引导状态不影响用户继续进入补录流程。
    } finally {
      setSubmittingAction('');
    }
    navigate('/recall/cities');
  };

  const skipRecall = async () => {
    trackRecallEvent('recall_intro_skip_click');
    setSubmittingAction('skip');
    try {
      await api.recall.updateGuide('skipped');
    } catch {
      // 跳过状态写入失败时，仍允许用户先进入地图。
    } finally {
      setSubmittingAction('');
    }
    navigate('/map', { replace: true });
  };

  return (
    <div className="recall-page recall-intro-page">
      <header className="recall-hero recall-intro-hero">
        <img className="recall-intro-brand" src="/images/shijie-logo-mark.png" alt="" aria-hidden="true" />
        <p className="recall-intro-brand-name">识界 <span>Light your life</span></p>
        <h1><span>把去过的地方</span><span>一站站点亮</span></h1>
        <p>从一座熟悉的城市开始，点亮你记忆里的旅程。</p>
      </header>

      <section className="recall-intro-content">
        <ol className="recall-intro-steps" aria-label="找回足迹步骤">
          <li>
            <span className="recall-intro-step-icon"><MapPinned size={18} aria-hidden="true" /></span>
            <span><strong>选城市</strong><small>从最熟悉的一座城市开始</small></span>
          </li>
          <li>
            <span className="recall-intro-step-icon"><Compass size={18} aria-hidden="true" /></span>
            <span><strong>找景区</strong><small>勾选那些真正去过的地方</small></span>
          </li>
          <li>
            <span className="recall-intro-step-icon"><Sparkles size={18} aria-hidden="true" /></span>
            <span><strong>点亮地图</strong><small>足迹会同步写入地图与旅程</small></span>
          </li>
        </ol>

        {(selectedCity || selectedAttractionIds.length > 0) && (
          <div className="recall-draft">
            <strong>继续上次</strong>
            <span>
              {selectedCity ? selectedCity.name : '尚未选择城市'}
              {selectedAttractionIds.length > 0 ? `，已选 ${selectedAttractionIds.length} 个景区` : ''}
            </span>
          </div>
        )}

      </section>

      <p className="recall-intro-note">不用一次补完所有足迹，先从最熟悉的地方开始。</p>
      <div className="recall-intro-actions">
        <button
          type="button"
          className="recall-primary-btn"
          disabled={!!submittingAction}
          onClick={startRecall}
        >
          <span>{submittingAction === 'start' ? '正在进入...' : '开始点亮足迹'}</span>
          <ArrowRight size={18} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="recall-secondary-btn"
          disabled={!!submittingAction}
          onClick={skipRecall}
        >
          {submittingAction === 'skip' ? '正在进入地图...' : '先看看我的地图'}
        </button>
      </div>
    </div>
  );
}
