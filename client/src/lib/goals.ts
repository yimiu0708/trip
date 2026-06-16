export interface TravelGoal {
  provinceId: number;
  targetProgress: number;
  targetDate?: string;
}

export interface GoalHistoryEntry extends TravelGoal {
  id: string;
  archivedAt: string;
  progressAtArchive?: number;
  achievedAt?: string;
}

export const GOAL_KEY = 'trip_next_goal';
export const GOAL_HISTORY_KEY = 'trip_goal_history';

export function readCurrentGoal() {
  return readJson<TravelGoal | null>(GOAL_KEY, null);
}

export function writeCurrentGoal(goal: TravelGoal) {
  localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
}

export function clearCurrentGoal() {
  localStorage.removeItem(GOAL_KEY);
}

export function readGoalHistory() {
  const history = readJson<GoalHistoryEntry[]>(GOAL_HISTORY_KEY, []);
  return Array.isArray(history) ? history : [];
}

export function archiveGoal(goal: TravelGoal, progressAtArchive?: number) {
  const history = readGoalHistory();
  const archivedAt = new Date().toISOString();
  const achieved = progressAtArchive !== undefined && progressAtArchive >= goal.targetProgress;
  const existingIndex = history.findIndex((item) => (
    item.provinceId === goal.provinceId &&
    item.targetProgress === goal.targetProgress &&
    (item.targetDate || '') === (goal.targetDate || '') &&
    !!item.achievedAt === achieved
  ));
  const entry: GoalHistoryEntry = {
    ...goal,
    id: `${Date.now()}-${goal.provinceId}-${goal.targetProgress}`,
    archivedAt,
    progressAtArchive,
    achievedAt: achieved ? archivedAt : undefined,
  };

  const next = existingIndex >= 0
    ? [entry, ...history.filter((_, index) => index !== existingIndex)]
    : [entry, ...history];
  localStorage.setItem(GOAL_HISTORY_KEY, JSON.stringify(next.slice(0, 20)));
}

export function isSameGoal(a: TravelGoal | null, b: TravelGoal | null) {
  if (!a || !b) return a === b;
  return (
    a.provinceId === b.provinceId &&
    a.targetProgress === b.targetProgress &&
    (a.targetDate || '') === (b.targetDate || '')
  );
}

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
