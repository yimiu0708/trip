import { ChevronLeft, ChevronRight, Medal, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { trackEvent } from '../../lib/analytics';

export interface UnlockedAchievement {
  id: number;
  name: string;
  display_name?: string;
  condition_desc?: string;
  display_desc?: string;
  icon?: string;
  artwork_path?: string;
  badge_style?: string;
  unlocked_at?: string | null;
}

export default function AchievementUnlockModal({
  achievements,
  onClose,
  onViewAchievements,
  onContinue,
  continueLabel = '继续点亮',
  source = 'unknown',
}: {
  achievements: UnlockedAchievement[];
  onClose: () => void;
  onViewAchievements: () => void;
  onContinue: () => void;
  continueLabel?: string;
  source?: 'recall' | 'city' | 'personality' | 'unknown';
}) {
  const [index, setIndex] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const current = achievements[index] || achievements[0];

  useEffect(() => {
    if (!achievements.length) return;
    setIndex(0);
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    trackEvent('achievement_celebration_view', { source, count: achievements.length, achievement_id: achievements[0].id });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        trackEvent('achievement_celebration_close', { source, method: 'escape' });
        onClose();
      }
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1));
      if (event.key === 'ArrowRight') setIndex((value) => Math.min(achievements.length - 1, value + 1));
      if (event.key === 'Tab') {
        const dialog = closeRef.current?.closest('[role="dialog"]');
        const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled)')) : [];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [achievements, onClose, source]);

  if (!current) return null;
  const multiple = achievements.length > 1;
  const close = (method: 'button' | 'backdrop') => {
    trackEvent('achievement_celebration_close', { source, method, achievement_id: current.id });
    onClose();
  };

  return (
    <div className="achievement-celebration-overlay" role="presentation" onClick={() => close('backdrop')}>
      <section className={`achievement-celebration ${current.badge_style || ''}`} role="dialog" aria-modal="true" aria-labelledby="achievement-celebration-title" onClick={(event) => event.stopPropagation()}>
        <button ref={closeRef} className="achievement-celebration-close" type="button" onClick={() => close('button')} aria-label="关闭徽章庆祝"><X size={21} /></button>
        <div className="achievement-celebration-sparkles" aria-hidden="true">
          <Sparkles size={22} /><Sparkles size={15} /><Sparkles size={18} /><Sparkles size={13} />
        </div>

        <header>
          <span>{multiple ? `本次获得 ${achievements.length} 枚徽章` : '恭喜获得新徽章'}</span>
          <p>你的旅行世界，又亮了一处</p>
        </header>

        <div className="achievement-celebration-stage">
          {multiple && <button type="button" className="achievement-celebration-nav previous" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))} aria-label="上一枚徽章"><ChevronLeft size={22} /></button>}
          <div className="achievement-celebration-art" key={current.id} aria-hidden="true">
            {current.artwork_path ? <img src={current.artwork_path} alt="" /> : <Medal size={88} />}
          </div>
          {multiple && <button type="button" className="achievement-celebration-nav next" disabled={index === achievements.length - 1} onClick={() => setIndex((value) => Math.min(achievements.length - 1, value + 1))} aria-label="下一枚徽章"><ChevronRight size={22} /></button>}
        </div>

        {multiple && <div className="achievement-celebration-pages" aria-label={`第 ${index + 1} 枚，共 ${achievements.length} 枚`}>{achievements.map((item, itemIndex) => <button key={item.id} type="button" className={itemIndex === index ? 'active' : ''} onClick={() => setIndex(itemIndex)} aria-label={`查看第 ${itemIndex + 1} 枚徽章`} aria-current={itemIndex === index ? 'true' : undefined} />)}</div>}

        <div className="achievement-celebration-copy" key={`copy-${current.id}`}>
          <h2 id="achievement-celebration-title">{current.display_name || current.name}</h2>
          <p>{current.display_desc || current.condition_desc || '每一处风景，都正在组成你的旅行地图。'}</p>
        </div>

        <div className="achievement-celebration-actions">
          <button type="button" onClick={() => { trackEvent('achievement_celebration_continue', { source, achievement_id: current.id }); onContinue(); }}>{continueLabel}</button>
          <button type="button" className="primary" onClick={() => { trackEvent('achievement_celebration_view_wall', { source, achievement_id: current.id }); onViewAchievements(); }}>查看徽章墙</button>
        </div>
      </section>
    </div>
  );
}
