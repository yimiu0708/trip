const SEASON_LABELS: Record<string, string> = {
  spring: '春天',
  summer: '夏天',
  autumn: '秋天',
  winter: '冬天',
};

interface RecallTimeLike {
  lit_at?: string;
  time_precision?: string | null;
  season?: string | null;
  display_time_text?: string | null;
}

export function formatRecallTime(value: RecallTimeLike) {
  if (value.display_time_text) return value.display_time_text;
  if (value.time_precision === 'unknown') return '时间待补充';
  if (!value.lit_at) return '时间待补充';

  const date = new Date(value.lit_at);
  if (Number.isNaN(date.getTime())) return '时间待补充';

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (value.time_precision === 'month') return `${year}年${month}月`;
  if (value.time_precision === 'season') return `${year}年${SEASON_LABELS[value.season || ''] || '某个季节'}`;
  if (value.time_precision === 'year') return `${year}年`;
  return `${String(month).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}
