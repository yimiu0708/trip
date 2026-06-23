import { Undo2 } from 'lucide-react';

export interface FavoriteToastState { text: string; undo?: () => void }

export default function FavoriteToast({ toast, onClose }: { toast: FavoriteToastState | null; onClose: () => void }) {
  if (!toast) return null;
  return <div className="favorite-toast" role="status"><span>{toast.text}</span>{toast.undo && <button type="button" onClick={() => { toast.undo?.(); onClose(); }}><Undo2 size={15} />撤销</button>}</div>;
}
