export interface PersonalityAnswer { questionId: string; value: string }

export interface PersonalityResult {
  hasResult: true;
  typeCode: string;
  typeName: string;
  summary: string;
  dimensions: { decision: string; pace: string; interest: string; social: string };
  dimensionLabels: string[];
  description: string;
  travelTips: string[];
  createdAt: string;
  updatedAt: string;
  retestCount: number;
  shareCount: number;
}

export interface PersonalityQuestion {
  id: string;
  prompt: string;
  options: Array<{ value: string; label: string }>;
}

export const PERSONALITY_QUESTIONS: PersonalityQuestion[] = [
  { id: 'q1', prompt: '出发前一晚，你通常在做什么？', options: [
    { value: 'J', label: '再确认一遍路线、门票、交通和时间安排' },
    { value: 'P', label: '看看天气和心情，其他的到了再说' },
  ] },
  { id: 'q2', prompt: '旅行途中突然发现一个没在计划里的地方，你会？', options: [
    { value: 'J', label: '先看会不会影响后面的行程，再决定要不要去' },
    { value: 'P', label: '这不就是旅行的惊喜吗？先去看看' },
  ] },
  { id: 'q3', prompt: '你更喜欢哪种旅行结束感？', options: [
    { value: 'J', label: '想去的地方基本都去了，行程完成度很高' },
    { value: 'P', label: '虽然没按计划走，但遇到了很多意外惊喜' },
  ] },
  { id: 'q4', prompt: '如果只有一天时间玩一座城市，你会？', options: [
    { value: 'F', label: '把几个经典地标都安排上，不想错过' },
    { value: 'L', label: '选一两个地方慢慢待，不想赶场' },
  ] },
  { id: 'q5', prompt: '看到“附近还有一个很有名的景点”，你更可能？', options: [
    { value: 'F', label: '来都来了，顺路打卡一下' },
    { value: 'L', label: '今天已经很舒服了，不想为了打卡破坏节奏' },
  ] },
  { id: 'q6', prompt: '你更喜欢哪种旅行照片？', options: [
    { value: 'F', label: '各个地方都留下了“我来过”的证据' },
    { value: 'L', label: '某个地方拍了很多张，因为真的很喜欢那里' },
  ] },
  { id: 'q7', prompt: '下面两种目的地，你更容易心动的是？', options: [
    { value: 'N', label: '雪山、草原、湖泊、森林、海岛' },
    { value: 'C', label: '老城、街巷、博物馆、古建、城市地标' },
  ] },
  { id: 'q8', prompt: '旅行中最让你放松的瞬间是？', options: [
    { value: 'N', label: '站在山海之间，感觉整个人被自然接住' },
    { value: 'C', label: '走进一座城市的街巷，慢慢理解它的故事' },
  ] },
  { id: 'q9', prompt: '你更愿意为哪件事专门安排一次旅行？', options: [
    { value: 'N', label: '看一场日出、雪山、海岛、森林或草原' },
    { value: 'C', label: '看一座博物馆、一片老街区或一组历史建筑' },
  ] },
  { id: 'q10', prompt: '旅行时遇到好吃好玩的地方，你第一反应是？', options: [
    { value: 'S', label: '想拉朋友一起来，下次一起体验' },
    { value: 'A', label: '一个人享受也很好，不用等别人' },
  ] },
  { id: 'q11', prompt: '你更喜欢哪种旅行状态？', options: [
    { value: 'S', label: '有人一起聊天、拍照、分享感受' },
    { value: 'A', label: '自己决定停多久、去哪儿、什么时候走' },
  ] },
  { id: 'q12', prompt: '如果临时有一个周末可以出发，你会？', options: [
    { value: 'S', label: '约上熟悉的人，一起找个地方玩' },
    { value: 'A', label: '自己也可以直接出门，反而更自由' },
  ] },
];
