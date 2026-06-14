interface Achievement {
  id: number;
  name: string;
  type: string;
  level: number | null;
  condition_desc: string;
  icon: string;
  badge_style: string;
  unlocked_at: string | null;
}

interface Props {
  a: Achievement;
  special?: boolean;
}

export default function AchievementBadge({ a, special }: Props) {
  const unlocked = !!a.unlocked_at;

  return (
    <div
      className={`badge ${unlocked ? 'unlocked' : 'locked'} ${a.badge_style || ''} ${special ? 'special' : ''}`}
      title={a.condition_desc}
    >
      <div className="badge-icon" aria-hidden="true">
        {a.icon || '🏅'}
      </div>
      <div className="badge-name">{a.name}</div>
      {a.level !== null && a.level > 0 && (
        <div className="badge-level">Lv.{a.level}</div>
      )}
    </div>
  );
}
