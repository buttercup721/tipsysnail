import type { CSSProperties } from 'react';
import type { OwnedSnail, SnailEgg } from '../types/game';

export type GrowthStage = 'newborn' | 'hatchling' | 'juvenile' | 'subadult' | 'adult';

export type GrowthProfile = {
  ageMs: number;
  growthPoints: number;
  stage: GrowthStage;
  label: string;
  description: string;
  sceneDescription: string;
  careTip: string;
  nextStageLabel: string | null;
  nextStageTargetPoints: number | null;
  pointsToNext: number;
  adultGoalPoints: number;
  adultRemainingPoints: number;
  stageProgress: number;
  lifetimeProgress: number;
  scale: number;
  antennaScale: number;
  shellGloss: number;
  shellSaturation: number;
  bodyOpacity: number;
  shellScale: number;
  bodyLength: number;
  bodyHeight: number;
  headScale: number;
  trailOpacity: number;
  shellHardness: number;
  muscleTone: number;
  sensoryReach: number;
  trailStrength: number;
  isMature: boolean;
};

type GrowthStageConfig = {
  stage: GrowthStage;
  minPoints: number;
  label: string;
  description: string;
  sceneDescription: string;
  careTip: string;
  scale: number;
  antennaScale: number;
  shellGloss: number;
  shellSaturation: number;
  bodyOpacity: number;
  shellScale: number;
  bodyLength: number;
  bodyHeight: number;
  headScale: number;
  trailOpacity: number;
  shellHardness: number;
  muscleTone: number;
  sensoryReach: number;
  trailStrength: number;
};

type EggLook = {
  patternTone: string;
  patternAngle: string;
  crackAngle: string;
  crackTone: string;
};

export const growthStageThresholds = {
  hatchling: 40,
  juvenile: 100,
  subadult: 190,
  adult: 300
} as const;

export const adultGrowthGoalPoints = growthStageThresholds.adult;

const growthTimeline: GrowthStageConfig[] = [
  {
    stage: 'newborn',
    minPoints: 0,
    label: '막 부화',
    description: '껍질이 아직 여리고 몸도 아주 작습니다.',
    sceneDescription: '방금 태어나 느리게 주변을 더듬는 상태',
    careTip: '먹이를 자주 챙겨 주면 가장 빠르게 성장합니다.',
    scale: 0.38,
    antennaScale: 0.5,
    shellGloss: 1.18,
    shellSaturation: 0.84,
    bodyOpacity: 0.84,
    shellScale: 0.76,
    bodyLength: 0.68,
    bodyHeight: 0.78,
    headScale: 0.76,
    trailOpacity: 0.18,
    shellHardness: 0.18,
    muscleTone: 0.22,
    sensoryReach: 0.28,
    trailStrength: 0.16
  },
  {
    stage: 'hatchling',
    minPoints: growthStageThresholds.hatchling,
    label: '유체',
    description: '껍질이 조금 단단해지고 먹이 반응이 빨라집니다.',
    sceneDescription: '먹이 냄새를 따라 천천히 움직이는 상태',
    careTip: '오이로 자주 먹이고 당근으로 성장 구간을 넘기면 좋습니다.',
    scale: 0.56,
    antennaScale: 0.66,
    shellGloss: 1.11,
    shellSaturation: 0.9,
    bodyOpacity: 0.89,
    shellScale: 0.84,
    bodyLength: 0.8,
    bodyHeight: 0.84,
    headScale: 0.84,
    trailOpacity: 0.3,
    shellHardness: 0.36,
    muscleTone: 0.38,
    sensoryReach: 0.44,
    trailStrength: 0.3
  },
  {
    stage: 'juvenile',
    minPoints: growthStageThresholds.juvenile,
    label: '어린 개체',
    description: '몸집이 확실히 커지고 껍데기 무늬가 또렷해집니다.',
    sceneDescription: '바닥을 넓게 훑으며 먹이를 찾는 상태',
    careTip: '성장 구간이 길어지는 시기라 당근 효율이 좋아집니다.',
    scale: 0.74,
    antennaScale: 0.81,
    shellGloss: 1.05,
    shellSaturation: 0.96,
    bodyOpacity: 0.95,
    shellScale: 0.92,
    bodyLength: 0.92,
    bodyHeight: 0.92,
    headScale: 0.92,
    trailOpacity: 0.44,
    shellHardness: 0.6,
    muscleTone: 0.62,
    sensoryReach: 0.66,
    trailStrength: 0.48
  },
  {
    stage: 'subadult',
    minPoints: growthStageThresholds.subadult,
    label: '준성체',
    description: '거의 다 자라서 판매 가치도 크게 올라갑니다.',
    sceneDescription: '바닥과 유리벽을 안정적으로 오가는 상태',
    careTip: '조금만 더 먹이면 성체가 됩니다.',
    scale: 0.88,
    antennaScale: 0.93,
    shellGloss: 1.01,
    shellSaturation: 1,
    bodyOpacity: 1,
    shellScale: 0.97,
    bodyLength: 0.98,
    bodyHeight: 0.98,
    headScale: 0.98,
    trailOpacity: 0.58,
    shellHardness: 0.82,
    muscleTone: 0.84,
    sensoryReach: 0.84,
    trailStrength: 0.68
  },
  {
    stage: 'adult',
    minPoints: growthStageThresholds.adult,
    label: '성체',
    description: '완전히 성장해 교배와 판매 가치가 최고치에 도달합니다.',
    sceneDescription: '무게감 있게 느리게 움직이는 완성 단계',
    careTip: '교배와 판매 타이밍을 고르기 좋은 상태입니다.',
    scale: 1,
    antennaScale: 1,
    shellGloss: 1,
    shellSaturation: 1.03,
    bodyOpacity: 1,
    shellScale: 1,
    bodyLength: 1,
    bodyHeight: 1,
    headScale: 1,
    trailOpacity: 0.72,
    shellHardness: 1,
    muscleTone: 1,
    sensoryReach: 1,
    trailStrength: 0.86
  }
];

const eggLooks: Record<string, EggLook> = {
  'garden-snail': {
    patternTone: 'rgba(123, 86, 49, 0.22)',
    patternAngle: '58deg',
    crackAngle: '-12deg',
    crackTone: 'rgba(113, 84, 58, 0.62)'
  },
  'amber-snail': {
    patternTone: 'rgba(168, 118, 44, 0.24)',
    patternAngle: '78deg',
    crackAngle: '10deg',
    crackTone: 'rgba(133, 99, 38, 0.6)'
  },
  'moss-snail': {
    patternTone: 'rgba(86, 120, 68, 0.22)',
    patternAngle: '26deg',
    crackAngle: '-18deg',
    crackTone: 'rgba(86, 118, 68, 0.64)'
  },
  'moon-snail': {
    patternTone: 'rgba(112, 129, 148, 0.18)',
    patternAngle: '92deg',
    crackAngle: '0deg',
    crackTone: 'rgba(106, 120, 138, 0.58)'
  },
  'strawberry-snail': {
    patternTone: 'rgba(172, 93, 115, 0.24)',
    patternAngle: '36deg',
    crackAngle: '14deg',
    crackTone: 'rgba(148, 79, 98, 0.6)'
  }
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function interpolateMetric(
  currentStage: GrowthStageConfig,
  nextStage: GrowthStageConfig,
  stageProgress: number,
  key: keyof Pick<
    GrowthStageConfig,
    | 'scale'
    | 'antennaScale'
    | 'shellGloss'
    | 'shellSaturation'
    | 'bodyOpacity'
    | 'shellScale'
    | 'bodyLength'
    | 'bodyHeight'
    | 'headScale'
    | 'trailOpacity'
    | 'shellHardness'
    | 'muscleTone'
    | 'sensoryReach'
    | 'trailStrength'
  >
): number {
  if (currentStage.stage === 'adult') {
    return currentStage[key];
  }

  return lerp(currentStage[key], nextStage[key], stageProgress);
}

export function getGrowthProfile(snail: OwnedSnail, now: number): GrowthProfile {
  const ageMs = Math.max(0, now - snail.bornAt);
  const growthPoints = Math.max(0, snail.growthPoints);
  const stageIndex = growthTimeline.findIndex((_, index) => {
    const nextStage = growthTimeline[index + 1];
    return !nextStage || growthPoints < nextStage.minPoints;
  });
  const currentStageIndex = stageIndex === -1 ? growthTimeline.length - 1 : stageIndex;
  const currentStage = growthTimeline[currentStageIndex]!;
  const nextStage = growthTimeline[Math.min(currentStageIndex + 1, growthTimeline.length - 1)]!;
  const nextStageTargetPoints = currentStage.stage === 'adult' ? null : nextStage.minPoints;
  const stageStart = currentStage.minPoints;
  const stageEnd = nextStageTargetPoints ?? adultGrowthGoalPoints;
  const stageSpan = Math.max(1, stageEnd - stageStart);
  const stageProgress = currentStage.stage === 'adult'
    ? 1
    : clamp((growthPoints - stageStart) / stageSpan, 0, 1);

  return {
    ageMs,
    growthPoints,
    stage: currentStage.stage,
    label: currentStage.label,
    description: currentStage.description,
    sceneDescription: currentStage.sceneDescription,
    careTip: currentStage.careTip,
    nextStageLabel: currentStage.stage === 'adult' ? null : nextStage.label,
    nextStageTargetPoints,
    pointsToNext: nextStageTargetPoints ? Math.max(0, nextStageTargetPoints - growthPoints) : 0,
    adultGoalPoints: adultGrowthGoalPoints,
    adultRemainingPoints: Math.max(0, adultGrowthGoalPoints - growthPoints),
    stageProgress,
    lifetimeProgress: clamp(growthPoints / adultGrowthGoalPoints, 0, 1),
    scale: interpolateMetric(currentStage, nextStage, stageProgress, 'scale'),
    antennaScale: interpolateMetric(currentStage, nextStage, stageProgress, 'antennaScale'),
    shellGloss: interpolateMetric(currentStage, nextStage, stageProgress, 'shellGloss'),
    shellSaturation: interpolateMetric(currentStage, nextStage, stageProgress, 'shellSaturation'),
    bodyOpacity: interpolateMetric(currentStage, nextStage, stageProgress, 'bodyOpacity'),
    shellScale: interpolateMetric(currentStage, nextStage, stageProgress, 'shellScale'),
    bodyLength: interpolateMetric(currentStage, nextStage, stageProgress, 'bodyLength'),
    bodyHeight: interpolateMetric(currentStage, nextStage, stageProgress, 'bodyHeight'),
    headScale: interpolateMetric(currentStage, nextStage, stageProgress, 'headScale'),
    trailOpacity: interpolateMetric(currentStage, nextStage, stageProgress, 'trailOpacity'),
    shellHardness: interpolateMetric(currentStage, nextStage, stageProgress, 'shellHardness'),
    muscleTone: interpolateMetric(currentStage, nextStage, stageProgress, 'muscleTone'),
    sensoryReach: interpolateMetric(currentStage, nextStage, stageProgress, 'sensoryReach'),
    trailStrength: interpolateMetric(currentStage, nextStage, stageProgress, 'trailStrength'),
    isMature: currentStage.stage === 'adult'
  };
}

export function getEggVisualStyle(egg: Pick<SnailEgg, 'speciesId' | 'accent' | 'shellSecondary' | 'auraTint'>): CSSProperties {
  const look = eggLooks[egg.speciesId] ?? eggLooks['garden-snail']!;
  return {
    ['--egg-accent' as string]: egg.accent,
    ['--egg-secondary' as string]: egg.shellSecondary,
    ['--egg-aura' as string]: egg.auraTint,
    ['--egg-pattern-tone' as string]: look.patternTone,
    ['--egg-pattern-angle' as string]: look.patternAngle,
    ['--egg-crack-angle' as string]: look.crackAngle,
    ['--egg-crack-tone' as string]: look.crackTone
  };
}
