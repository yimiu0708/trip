interface Achievement {
  id: number;
  name: string;
  display_name?: string;
  display_desc?: string;
  type: string;
  level: number | null;
  condition_desc: string;
  icon: string;
  badge_style: string;
  unlocked_at: string | null;
  unlock_count?: number;
  snapshot_lit?: number | null;
  snapshot_total?: number | null;
  snapshot_percent?: number | null;
  is_current_max?: number | null;
}

interface Props {
  a: Achievement;
  special?: boolean;
  variant?: 'default' | 'glory' | 'compact';
}

export default function AchievementBadge({ a, special, variant = 'default' }: Props) {
  const unlocked = !!a.unlocked_at;
  const name = a.display_name || a.name;
  const desc = a.display_desc || a.condition_desc;

  return (
    <div
      className={`badge badge-${variant} ${unlocked ? 'unlocked' : 'locked'} ${a.badge_style || ''} ${special ? 'special' : ''} ${a.is_current_max ? 'current-max' : ''}`}
      title={desc}
    >
      <div className="badge-icon" aria-hidden="true">
        {a.icon || '🏅'}
      </div>
      <div className="badge-name">{name}</div>
      {a.level !== null && a.level > 0 && (
        <div className="badge-level">Lv.{a.level}</div>
      )}
      {unlocked && !!a.unlock_count && a.unlock_count > 1 && (
        <div className="badge-count">x{a.unlock_count}</div>
      )}
      {unlocked && a.is_current_max ? (
        <div className="badge-corner">当前最高</div>
      ) : null}
      {unlocked && a.snapshot_total ? (
        <div className="badge-snapshot">
          {a.snapshot_percent !== null && a.snapshot_percent !== undefined
            ? `${a.snapshot_percent}%`
            : `${a.snapshot_lit || 0}/${a.snapshot_total}`}
        </div>
      ) : null}
    </div>
  );
}
