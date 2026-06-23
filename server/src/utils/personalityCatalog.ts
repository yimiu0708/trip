export const PERSONALITY_DIMENSIONS = {
  J: '计划攻略型', P: '随性探索型',
  F: '高效打卡型', L: '慢游沉浸型',
  N: '自然山海型', C: '人文城市型',
  S: '社交同行型', A: '独行自洽型',
} as const;

export interface PersonalityDefinition {
  code: string;
  name: string;
  summary: string;
}

export const PERSONALITY_CATALOG: PersonalityDefinition[] = [
  { code: 'JFNS', name: '山海冲锋官', summary: '攻略做满，路线拉满，用最高效率打卡自然风光' },
  { code: 'JFNA', name: '独行远征家', summary: '一个人也能高效穿越山川湖海' },
  { code: 'JFCS', name: '城市打卡队长', summary: '擅长带队扫街、逛馆、刷地标' },
  { code: 'JFCA', name: '人文速记员', summary: '一个人高效收集城市与历史切片' },
  { code: 'JLNS', name: '山野生活家', summary: '有计划地慢慢住进风景里' },
  { code: 'JLNA', name: '静默观景者', summary: '喜欢独自停留，把山海看成自己的秘密基地' },
  { code: 'JLCS', name: '人文漫游家', summary: '和重要的人一起慢慢读懂一座城' },
  { code: 'JLCA', name: '城市考古人', summary: '独自钻进街巷、建筑和博物馆里' },
  { code: 'PFNS', name: '随缘追光者', summary: '朋友一句出发，就能奔向下一片山海' },
  { code: 'PFNA', name: '野路子探险家', summary: '不做太多计划，一个人也敢说走就走' },
  { code: 'PFCS', name: '热闹扫街王', summary: '跟着氛围走，哪里热闹去哪里' },
  { code: 'PFCA', name: '城市游荡者', summary: '一个人随意穿行，在城市里捕捉灵感' },
  { code: 'PLNS', name: '山海放空者', summary: '不赶路，只想在自然里慢慢恢复能量' },
  { code: 'PLNA', name: '独处疗愈者', summary: '一个人慢游，把旅行当作自我修复' },
  { code: 'PLCS', name: '松弛度假家', summary: '和喜欢的人一起慢慢吃、逛、晒太阳' },
  { code: 'PLCA', name: '慢热观察员', summary: '独自慢慢理解一座城市的气质' },
];

export function getPersonalityDefinition(code: string) {
  return PERSONALITY_CATALOG.find((item) => item.code === code);
}

export function getDimensionLabels(code: string) {
  return [...code].map((letter) => PERSONALITY_DIMENSIONS[letter as keyof typeof PERSONALITY_DIMENSIONS]);
}

export function buildPersonalityDescription(code: string) {
  const [decision, pace, interest, social] = code;
  const opening = decision === 'J'
    ? '你喜欢在出发前理清大致方向，让重要的体验都有被认真对待的时间。'
    : '你相信旅途中的临时起意，常常比写在计划里的安排更值得记住。';
  const rhythm = pace === 'L'
    ? '相比赶场，你更愿意在真正喜欢的地方多停一会儿。'
    : '有限的时间里，你享受不断抵达和完成探索清单的满足感。';
  const scene = interest === 'C'
    ? '街巷、建筑、博物馆与城市故事，总能让你产生新的好奇。'
    : '山川、湖海、森林与旷野，会让你重新找到呼吸的节奏。';
  const company = social === 'S'
    ? '你也珍惜同行者，因为分享会让一段风景拥有更长的余韵。'
    : '独自出发对你并不孤单，自主决定每一次停留本身就是旅行的快乐。';
  return `${opening}${rhythm}\n\n${scene}${company}`;
}

export function buildPersonalityTips(code: string) {
  const [decision, pace, interest, social] = code;
  return [
    decision === 'J' ? '提前选好核心目的地，同时给意外发现留一点空白' : '先定一个方向，让当天的天气和心情决定细节',
    pace === 'L' ? '一天安排 1-2 个重点，把停留也当成旅程' : '把想去的地点按区域串联，减少路上的折返',
    interest === 'C' ? '多留时间给街巷、博物馆、老城区和本地小店' : '关注日出、潮汐和季节，让自然呈现最好的一面',
    social === 'S' ? '和熟悉的人一起出发，把旅行变成共同记忆' : '保留独处弹性，也把行程分享给可信任的人',
  ];
}
