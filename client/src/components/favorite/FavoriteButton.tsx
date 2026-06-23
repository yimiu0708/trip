import { Heart } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export interface FavoriteState {
  id: number | null;
  active: boolean;
}

export default function FavoriteButton({ targetType, targetId, initial, source = 'manual', compact = false, onChange, onMessage }: {
  targetType: 'city' | 'attraction';
  targetId: number;
  initial?: FavoriteState;
  source?: string;
  compact?: boolean;
  onChange?: (state: FavoriteState) => void;
  onMessage?: (message: string, undo?: () => void) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState<FavoriteState>(initial || { id: null, active: false });
  const [busy, setBusy] = useState(false);

  const update = (next: FavoriteState) => { setState(next); onChange?.(next); };
  const add = async () => {
    const result = await api.favorites.add(targetType, targetId, source);
    update({ id: result.favorite.id, active: true });
    onMessage?.('已加入收藏');
  };
  const toggle = async (event: React.MouseEvent) => {
    event.preventDefault(); event.stopPropagation();
    if (!user) { onMessage?.('登录后可收藏想去的地方'); navigate('/login'); return; }
    if (busy) return;
    setBusy(true);
    try {
      if (!state.active || !state.id) await add();
      else {
        const previous = state;
        await api.favorites.remove(state.id);
        update({ id: state.id, active: false });
        onMessage?.('已取消收藏', async () => {
          const result = await api.favorites.add(targetType, targetId, 'undo');
          update({ id: result.favorite.id || previous.id, active: true });
        });
      }
    } catch (error: any) { onMessage?.(error.message || '收藏操作失败'); }
    finally { setBusy(false); }
  };

  return <button type="button" className={`favorite-button ${state.active ? 'active' : ''} ${compact ? 'compact' : ''}`} disabled={busy} onClick={toggle} aria-pressed={state.active} aria-label={state.active ? '取消收藏' : '收藏'}><Heart size={compact ? 18 : 19} fill={state.active ? 'currentColor' : 'none'} />{!compact && <span>{state.active ? '已收藏' : '收藏'}</span>}</button>;
}
