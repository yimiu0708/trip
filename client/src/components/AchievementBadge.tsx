export interface Achievement {
  id: number;
  name: string;
  display_name?: string;
  display_desc?: string;
  type: string;
  level: number | null;
  condition_value?: number | null;
  condition_desc: string;
  artwork_path?: string;
  badge_style: string;
  unlocked_at: string | null;
  is_equipped?: number;
  is_current_max?: number | null;
}

export default function AchievementBadge({ a, special, variant = 'default', onClick }: {
  a: Achievement;
  special?: boolean;
  variant?: 'default' | 'glory' | 'compact' | 'series';
  onClick?: () => void;
}) {
  const unlocked = !!a.unlocked_at;
  const hiddenSpecial = special && !unlocked;
  return (
    <button
      type="button"
      className={`badge badge-${variant} ${unlocked ? 'unlocked' : 'locked'} ${a.badge_style || ''} ${special ? 'special' : ''} ${hiddenSpecial ? 'secret' : ''} ${a.is_equipped ? 'equipped' : ''}`}
      onClick={onClick}
      aria-label={hiddenSpecial ? '未解锁的彩蛋成就' : `查看${a.display_name || a.name}`}
    >
      <span className="badge-icon" aria-hidden="true">
        {a.artwork_path ? <img src={a.artwork_path} alt="" /> : <span className="badge-art-fallback" />}
      </span>
      <span className="badge-name">{hiddenSpecial ? '???' : (a.display_name || a.name)}</span>
      {a.level ? <span className="badge-level">Lv.{a.level}</span> : null}
      {a.is_equipped ? <span className="badge-equipped-mark">佩戴中</span> : null}
    </button>
  );
}
