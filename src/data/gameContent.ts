import type { MainAction, SnailSpecies, StarterTerrarium } from '../types/game';

export const snailSpecies: SnailSpecies[] = [
  {
    id: 'garden-snail',
    name: 'Garden Snail',
    shellTone: '갈색 소용돌이',
    accent: '#c47a3b',
    trait: '안정적이고 천천히 주변을 살핀다',
    description: '처음 만나는 기본 달팽이. 어느 테라리움에서도 무난하게 잘 어울린다.'
  },
  {
    id: 'amber-snail',
    name: 'Amber Snail',
    shellTone: '꿀빛 호박색',
    accent: '#e1a64b',
    trait: '먹이 냄새를 빨리 맡는다',
    description: '따뜻한 색감이 돋보이는 종. 먹이 상호작용에서 활발한 인상을 준다.'
  },
  {
    id: 'moss-snail',
    name: 'Moss Snail',
    shellTone: '이끼빛 초록 패턴',
    accent: '#71935a',
    trait: '이끼와 잎 소품 근처를 선호한다',
    description: '초록 장식과 함께 두면 가장 달팽이 정원다운 분위기를 만든다.'
  },
  {
    id: 'moon-snail',
    name: 'Moon Snail',
    shellTone: '은회색 반사광',
    accent: '#aab6cb',
    trait: '차분하고 몽환적인 무드를 만든다',
    description: '비 오는 창가, 밤 배경과 잘 맞는 서정적인 포지션의 달팽이.'
  },
  {
    id: 'strawberry-snail',
    name: 'Strawberry Snail',
    shellTone: '분홍빛 희귀 무늬',
    accent: '#d87386',
    trait: '희귀 조합 수집의 목표가 된다',
    description: '교배 시스템의 수집 욕구를 만들어주는 하이라이트 종.'
  }
];

export const starterTerrariums: StarterTerrarium[] = [
  {
    id: 'moss-jar',
    name: 'Moss Jar',
    mood: '포근한 이끼 유리병',
    description: '둥근 실루엣과 따뜻한 녹색이 중심인 초보자용 스타터 테라리움.',
    highlights: ['작은 곡선형 유리병', '이끼 카펫', '버섯 장식과 잘 어울림']
  },
  {
    id: 'rain-window-tank',
    name: 'Rain Window Tank',
    mood: '비 내리는 창가 수조',
    description: '넓은 직사각 유리벽이 강조되어 벽 타기와 점액 자국 표현에 좋은 테라리움.',
    highlights: ['넓은 파노라마 뷰', '유리벽 연출 강조', '차분한 회녹색 무드']
  }
];

export const mainActions: MainAction[] = [
  {
    id: 'feed',
    label: '먹이',
    description: '오이와 상추 조각을 떨어뜨려 주변 달팽이를 유도합니다.'
  },
  {
    id: 'touch',
    label: '터치',
    description: '눈과 더듬이가 반응하는 부드러운 교감 액션입니다.'
  },
  {
    id: 'breed',
    label: '교배',
    description: '성체 두 마리를 선택해 알과 희귀 패턴을 노립니다.'
  }
];

