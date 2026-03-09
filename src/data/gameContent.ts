import type { MainAction, SnailSpecies, StarterTerrarium } from '../types/game';

export const snailSpecies: SnailSpecies[] = [
  {
    id: 'garden-snail',
    name: '정원 달팽이',
    shellTone: '호박 갈색',
    accent: '#c47a3b',
    trait: '안정적으로 자라는 기본종',
    description: '가장 친숙한 종입니다. 성장과 판매 흐름을 익히기 좋습니다.'
  },
  {
    id: 'amber-snail',
    name: '호박 달팽이',
    shellTone: '꿀빛 호박색',
    accent: '#e1a64b',
    trait: '먹이를 먹을 때 윤기가 두드러짐',
    description: '따뜻한 호박빛 껍데기가 특징인 종입니다.'
  },
  {
    id: 'moss-snail',
    name: '이끼 달팽이',
    shellTone: '이끼 녹색',
    accent: '#71935a',
    trait: '차분한 녹색 계열의 자연종',
    description: '습한 테라리움과 잘 어울리는 잔잔한 종입니다.'
  },
  {
    id: 'moon-snail',
    name: '달빛 달팽이',
    shellTone: '은회색 달빛',
    accent: '#aab6cb',
    trait: '희귀하게 태어나는 레어 종',
    description: '희귀도가 올라가며 판매가도 크게 뛰는 종입니다.'
  },
  {
    id: 'strawberry-snail',
    name: '딸기 달팽이',
    shellTone: '딸기 장밋빛',
    accent: '#d87386',
    trait: '가장 화려한 에픽 종',
    description: '희귀 접두사와 함께 높은 가치로 거래되는 상위 종입니다.'
  }
];

export const starterTerrariums: StarterTerrarium[] = [
  {
    id: 'moss-jar',
    name: '이끼 병',
    mood: '포근한 숲 바닥',
    description: '초록 이끼와 흙층이 차분하게 깔린 기본 테라리움입니다.',
    highlights: ['부드러운 이끼', '짙은 흙층', '따뜻한 유리광']
  },
  {
    id: 'rain-window-tank',
    name: '비 창가',
    mood: '촉촉한 유리벽',
    description: '비가 맺힌 창가 분위기로 달팽이 움직임이 더 선명하게 보입니다.',
    highlights: ['빗물 자국', '차가운 유리빛', '젖은 바닥 질감']
  }
];

export const mainActions: MainAction[] = [
  {
    id: 'feed',
    label: '먹이',
    description: '먹이를 사서 원하는 자리에 놓습니다.'
  },
  {
    id: 'touch',
    label: '터치',
    description: '달팽이를 눌러 반응을 봅니다.'
  },
  {
    id: 'breed',
    label: '교배',
    description: '부모 두 마리를 지정해 알을 받습니다.'
  }
];
