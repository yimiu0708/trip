import { ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Achievement } from '../AchievementBadge';

export default function AchievementDetailModal({ items, initialId, onClose, onEquip }: {
  items: Achievement[];
  initialId: number;
  onClose: () => void;
  onEquip: (achievement: Achievement) => Promise<void>;
}) {
  const itemIds = items.map((item) => item.id).join(',');
  const initialIndex = Math.max(0, itemIds.split(',').indexOf(String(initialId)));
  const [index, setIndex] = useState(initialIndex);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const positionedRef = useRef(false);
  const dragRef = useRef<{ pointerId: number; startX: number; scrollLeft: number } | null>(null);
  const current = items[index] || items[0];

  const moveTo = useCallback((nextIndex: number, behavior: ScrollBehavior = 'smooth') => {
    const boundedIndex = Math.max(0, Math.min(items.length - 1, nextIndex));
    const track = trackRef.current;
    if (track) track.scrollTo({ left: boundedIndex * track.clientWidth, behavior });
    setIndex(boundedIndex);
  }, [items.length]);

  useLayoutEffect(() => {
    const nextIndex = Math.max(0, itemIds.split(',').indexOf(String(initialId)));
    positionedRef.current = false;
    setIndex(nextIndex);
    const frame = requestAnimationFrame(() => {
      const track = trackRef.current;
      if (track) track.scrollLeft = nextIndex * track.clientWidth;
      positionedRef.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [initialId, itemIds]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') moveTo(index - 1);
      if (event.key === 'ArrowRight') moveTo(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, moveTo, onClose]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  const syncIndexFromScroll = () => {
    if (!positionedRef.current) return;
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      const track = trackRef.current;
      if (!track?.clientWidth) return;
      const nextIndex = Math.max(0, Math.min(items.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
      setIndex((value) => value === nextIndex ? value : nextIndex);
    });
  };

  const startMouseDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: event.currentTarget.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const continueMouseDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
  };

  const finishMouseDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    const nextIndex = event.currentTarget.clientWidth ? Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth) : index;
    moveTo(nextIndex);
  };

  return <div className="achievement-detail-overlay" onClick={onClose}>
    <section className="achievement-detail-modal" role="dialog" aria-modal="true" aria-label="徽章等级详情" onClick={(event) => event.stopPropagation()}>
      <button className="achievement-detail-close" type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button>
      <div
        ref={trackRef}
        className={`achievement-detail-track ${dragging ? 'dragging' : ''}`}
        tabIndex={0}
        aria-label="左右滑动查看不同等级徽章"
        onScroll={syncIndexFromScroll}
        onPointerDown={startMouseDrag}
        onPointerMove={continueMouseDrag}
        onPointerUp={finishMouseDrag}
        onPointerCancel={finishMouseDrag}
      >
        {items.map((item, slideIndex) => {
          const secret = item.type === 'special' && !item.unlocked_at;
          return <article className="achievement-detail-slide" key={item.id} aria-hidden={slideIndex !== index}>
            <div className={`achievement-detail-artwork ${item.unlocked_at ? 'unlocked' : 'locked'} ${secret ? 'secret' : ''}`} aria-hidden="true">
              {item.artwork_path ? <img src={item.artwork_path} alt="" draggable="false" /> : <span className="achievement-detail-artwork-fallback" />}
            </div>
            {items.length > 1 && <div className="achievement-detail-dots" aria-label={`第 ${index + 1} 级，共 ${items.length} 级`}>{items.map((dotItem, dot) => <button key={dotItem.id} type="button" tabIndex={slideIndex === index ? 0 : -1} className={dot === index ? 'active' : ''} onClick={() => moveTo(dot)} aria-label={`查看第 ${dot + 1} 级`} aria-current={dot === index ? 'step' : undefined} />)}</div>}
            <div className="achievement-detail-slide-copy" aria-live={slideIndex === index ? 'polite' : 'off'}>
              <h2>{secret ? '神秘彩蛋' : (item.display_name || item.name)}</h2>
              <p>{secret ? '继续探索识界，解锁后即可查看获得条件。' : (item.display_desc || item.condition_desc)}</p>
            </div>
          </article>;
        })}
      </div>
      {current.unlocked_at && <button className={`achievement-equip-button ${current.is_equipped ? 'equipped' : ''}`} disabled={busy} onClick={async () => { setBusy(true); try { await onEquip(current); } finally { setBusy(false); } }}><ShieldCheck size={18} />{current.is_equipped ? '取消佩戴' : '佩戴这枚徽章'}</button>}
    </section>
  </div>;
}
