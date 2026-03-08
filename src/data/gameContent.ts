import type {
  MainAction,
  PlacedTerrariumProp,
  SnailSpecies,
  StarterTerrarium,
  TerrariumPropDefinition
} from '../types/game';

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

export const terrariumProps: TerrariumPropDefinition[] = [
  {
    id: 'moss-carpet',
    name: '이끼 카펫',
    description: '바닥을 부드럽게 덮는 촉촉한 초록 레이어',
    accent: '#7ca164',
    secondaryAccent: '#486341',
    variant: 'moss',
    placementMode: 'floor',
    width: 88,
    height: 34
  },
  {
    id: 'fern-pot',
    name: '고사리 화분',
    description: '높이가 생기는 초록 포인트 장식',
    accent: '#5c8b57',
    secondaryAccent: '#8c5d3b',
    variant: 'fern',
    placementMode: 'floor',
    width: 52,
    height: 68
  },
  {
    id: 'small-mushroom-cluster',
    name: '작은 버섯 무리',
    description: '귀여운 붉은 버섯이 모인 장식',
    accent: '#d76a56',
    secondaryAccent: '#f4e7c6',
    variant: 'mushroom-small',
    placementMode: 'floor',
    width: 54,
    height: 46
  },
  {
    id: 'tall-mushroom-cluster',
    name: '큰 버섯 무리',
    description: '시선을 끄는 키 큰 버섯 장식',
    accent: '#c55647',
    secondaryAccent: '#f0dec2',
    variant: 'mushroom-tall',
    placementMode: 'floor',
    width: 58,
    height: 72
  },
  {
    id: 'flat-river-stone',
    name: '납작한 강돌',
    description: '바닥 레이아웃을 안정적으로 잡는 돌',
    accent: '#8d948d',
    secondaryAccent: '#bac1ba',
    variant: 'stone-flat',
    placementMode: 'floor',
    width: 68,
    height: 30
  },
  {
    id: 'pebble-pile',
    name: '조약돌 더미',
    description: '여러 개의 작은 돌이 모인 포인트',
    accent: '#748073',
    secondaryAccent: '#c7cdc6',
    variant: 'stone-pile',
    placementMode: 'floor',
    width: 66,
    height: 36
  },
  {
    id: 'bark-tunnel',
    name: '나무껍질 터널',
    description: '달팽이가 지나갈 수 있는 낮은 은신처',
    accent: '#6d4b36',
    secondaryAccent: '#8d674d',
    variant: 'tunnel',
    placementMode: 'floor',
    width: 82,
    height: 44
  },
  {
    id: 'hollow-log',
    name: '속 빈 통나무',
    description: '큰 원목 느낌의 메인 장식',
    accent: '#734d34',
    secondaryAccent: '#9a704f',
    variant: 'log',
    placementMode: 'floor',
    width: 92,
    height: 52
  },
  {
    id: 'leaf-arch',
    name: '잎 아치',
    description: '배경에 높이를 주는 곡선형 잎사귀',
    accent: '#6c9f58',
    secondaryAccent: '#b6df90',
    variant: 'leaf-arch',
    placementMode: 'free',
    width: 80,
    height: 62
  },
  {
    id: 'lotus-bowl',
    name: '연잎 그릇',
    description: '낮고 넓은 수분 장식',
    accent: '#709d7a',
    secondaryAccent: '#d3f0d8',
    variant: 'bowl',
    placementMode: 'floor',
    width: 64,
    height: 28
  },
  {
    id: 'dew-dish',
    name: '이슬 접시',
    description: '작은 물방울이 고이는 얕은 접시',
    accent: '#97c1cf',
    secondaryAccent: '#dff4fc',
    variant: 'dish',
    placementMode: 'floor',
    width: 50,
    height: 26
  },
  {
    id: 'tiny-signpost',
    name: '미니 팻말',
    description: '정원 느낌을 더해주는 작은 표지판',
    accent: '#8e6945',
    secondaryAccent: '#f0d9b2',
    variant: 'sign',
    placementMode: 'floor',
    width: 40,
    height: 54
  },
  {
    id: 'clay-pot-hideout',
    name: '토분 은신처',
    description: '화분 모양의 아늑한 쉼터',
    accent: '#bd7450',
    secondaryAccent: '#eec5a9',
    variant: 'pot',
    placementMode: 'floor',
    width: 54,
    height: 52
  },
  {
    id: 'mini-waterfall-rock',
    name: '미니 폭포 바위',
    description: '물줄기가 흐르는 것처럼 보이는 장식 바위',
    accent: '#7f8b84',
    secondaryAccent: '#8bd0dc',
    variant: 'waterfall',
    placementMode: 'free',
    width: 64,
    height: 68
  },
  {
    id: 'hanging-vine',
    name: '매달린 덩굴',
    description: '천장이나 유리벽과 어울리는 세로형 장식',
    accent: '#639051',
    secondaryAccent: '#b8de8a',
    variant: 'vine',
    placementMode: 'ceiling',
    width: 44,
    height: 92
  },
  {
    id: 'sprout-patch',
    name: '새싹 군락',
    description: '작은 생장 포인트를 만드는 장식',
    accent: '#7caf63',
    secondaryAccent: '#d8f0b4',
    variant: 'sprout',
    placementMode: 'floor',
    width: 50,
    height: 38
  },
  {
    id: 'acorn-lamp',
    name: '도토리 램프',
    description: '동화 같은 분위기를 더하는 포인트 조명',
    accent: '#a06b3d',
    secondaryAccent: '#ffde8a',
    variant: 'lamp',
    placementMode: 'free',
    width: 42,
    height: 58
  },
  {
    id: 'clover-patch',
    name: '클로버 패치',
    description: '낮고 풍성한 풀 장식',
    accent: '#5f944c',
    secondaryAccent: '#cceeb2',
    variant: 'clover',
    placementMode: 'floor',
    width: 64,
    height: 34
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
  },
  {
    id: 'edit',
    label: '편집',
    description: '소품 선택, 배치, 드래그 이동, 삭제를 담당합니다.'
  }
];

export function createStarterPlacedPropsByTerrarium(): Record<string, PlacedTerrariumProp[]> {
  return {
    'moss-jar': [
      { id: 'moss-jar-starter-1', propId: 'moss-carpet', x: 30, y: 78 },
      { id: 'moss-jar-starter-2', propId: 'fern-pot', x: 17, y: 66 },
      { id: 'moss-jar-starter-3', propId: 'small-mushroom-cluster', x: 71, y: 69 },
      { id: 'moss-jar-starter-4', propId: 'flat-river-stone', x: 57, y: 79 }
    ],
    'rain-window-tank': [
      { id: 'rain-window-starter-1', propId: 'mini-waterfall-rock', x: 16, y: 68 },
      { id: 'rain-window-starter-2', propId: 'hanging-vine', x: 82, y: 20 },
      { id: 'rain-window-starter-3', propId: 'bark-tunnel', x: 44, y: 79 },
      { id: 'rain-window-starter-4', propId: 'dew-dish', x: 67, y: 78 }
    ]
  };
}
