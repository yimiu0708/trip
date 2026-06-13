import {
  Mountain,
  Footprints,
  Compass,
  Map,
  Crown,
  Ticket,
  Camera,
  Image,
  ScrollText,
  BookOpen,
  Flame,
  Sparkles,
  Moon,
  Trophy,
  Diamond,
  Calendar,
  Medal,
  Lock,
  type LucideIcon,
} from 'lucide-react';

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

const iconMap: Record<string, LucideIcon> = {
  mountain: Mountain,
  footprint: Footprints,
  compass: Compass,
  compass2: Compass,
  map: Map,
  'long-scroll': Map,
  crown: Crown,
  crown2: Crown,
  ticket: Ticket,
  camera: Camera,
  landscape: Image,
  scroll: ScrollText,
  album: BookOpen,
  hiking: Footprints,
  'star-trail': Sparkles,
  galaxy: Sparkles,
  torch: Flame,
  meteor: Sparkles,
  moon: Moon,
  trophy: Trophy,
  diamond5: Diamond,
  calendar: Calendar,
  flame: Flame,
};

export default function AchievementBadge({
  a,
  special,
}: {
  a: Achievement;
  special?: boolean;
}) {
  const unlocked = !!a.unlocked_at;
  const Icon = unlocked ? iconMap[a.icon] || Medal : Lock;

  return (
    <div
      className={`badge ${unlocked ? 'unlocked' : 'locked'} ${a.badge_style}`}
      title={unlocked ? a.condition_desc : '???'}
    >
      <div className="badge-icon">
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="badge-name">{unlocked ? a.name : special ? '???' : a.name}</div>
      {unlocked && a.level && <div className="badge-level">Lv.{a.level}</div>}
    </div>
  );
}
