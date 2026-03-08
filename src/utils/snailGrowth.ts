import type { CSSProperties } from 'react';
import type { OwnedSnail, SnailEgg } from '../types/game';

export type GrowthStage = 'newborn' | 'hatchling' | 'juvenile' | 'subadult' | 'adult';

export type GrowthProfile = {
  ageMs: number;
  stage: GrowthStage;
  label: string;
  description: string;
  sceneDescription: string;
  careTip: string;
  nextStageLabel: string | null;
  nextStageAt: number | null;
  nextStageRemainingMs: number;
  adultRemainingMs: number;
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
  untilMs: number | null;
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

const growthTimeline: GrowthStageConfig[] = [
  {
    stage: 'newborn',
    untilMs: 45_000,
    label: '막 부화한 새끼',
    description:
      '젖은 막이 아직 마르지 않아 몸을 낮게 끌고 다니고, 껍질 가장자리가 아주 말랑한 단계예요.',
    sceneDescription: '첫 점액막이 마르는 중 · 짧고 낮은 움직임',
    careTip: '먹이보다 은신처 가까운 촉촉한 바닥에서 짧게 쉬게 두면 안정돼요.',
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
    untilMs: 150_000,
    label: '초기 유체',
    description:
      '껍질 첫 고리가 자리 잡는 시기라 자주 멈춰 서고, 작은 더듬이로 가까운 영역만 조심스럽게 살펴봐요.',
    sceneDescription: '껍질 첫 고리 성장 중 · 조심스럽게 먹이를 탐색',
    careTip: '짧은 간격으로 먹이 반응을 보며 몸을 너무 오래 벽 쪽으로 보내지 않는 편이 좋아요.',
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
    untilMs: 330_000,
    label: '어린 개체',
    description:
      '몸통이 길어지고 껍질 색이 또렷해지며, 점액 자국도 이전보다 선명하게 남기기 시작하는 성장기예요.',
    sceneDescription: '체색 선명해지는 중 · 이동 동선이 길어짐',
    careTip: '먹이 반응이 가장 또렷해지는 구간이라 자주 관찰할수록 성장 차이가 잘 보여요.',
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
    untilMs: 540_000,
    label: '준성체',
    description:
      '성체 무늬가 거의 완성되고 벽 타기와 방향 전환이 안정되며, 체형도 성체에 가깝게 정리되는 단계예요.',
    sceneDescription: '성체 무늬 자리잡는 중 · 벽 타기와 균형이 안정됨',
    careTip: '이때부터 교배 직전 컨디션을 보는 느낌으로 관찰하면 성체 전환이 더 또렷해요.',
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
    untilMs: null,
    label: '성체',
    description:
      '껍질 무늬와 체형이 완전히 자리 잡은 안정 단계예요. 교배와 희귀 조합 루프에 참여할 수 있어요.',
    sceneDescription: '완전한 체형 · 교배 가능한 안정 단계',
    careTip: '성장 완료 상태라 희귀 조합, 쿨다운 관리, 컬렉션 확장 루프의 중심이 돼요.',
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

const adultGrowthWindowMs = growthTimeline[growthTimeline.length - 2]?.untilMs ?? 540_000;

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
  const stageIndex = growthTimeline.findIndex((stage) => stage.untilMs === null || ageMs < stage.untilMs);
  const currentStageIndex = stageIndex === -1 ? growthTimeline.length - 1 : stageIndex;
  const currentStage = growthTimeline[currentStageIndex]!;
  const nextStage = growthTimeline[Math.min(currentStageIndex + 1, growthTimeline.length - 1)]!;
  const previousUntilMs = currentStageIndex === 0 ? 0 : growthTimeline[currentStageIndex - 1]?.untilMs ?? 0;
  const currentUntilMs = currentStage.untilMs ?? adultGrowthWindowMs;
  const stageSpan = Math.max(1, currentUntilMs - previousUntilMs);
  const stageProgress = currentStage.stage === 'adult'
    ? 1
    : clamp((ageMs - previousUntilMs) / stageSpan, 0, 1);
  const nextStageAt = currentStage.untilMs === null ? null : snail.bornAt + currentStage.untilMs;
  const nextStageRemainingMs = nextStageAt ? Math.max(0, nextStageAt - now) : 0;

  return {
    ageMs,
    stage: currentStage.stage,
    label: currentStage.label,
    description: currentStage.description,
    sceneDescription: currentStage.sceneDescription,
    careTip: currentStage.careTip,
    nextStageLabel: currentStage.stage === 'adult' ? null : nextStage.label,
    nextStageAt,
    nextStageRemainingMs,
    adultRemainingMs: Math.max(0, snail.bornAt + adultGrowthWindowMs - now),
    stageProgress,
    lifetimeProgress: clamp(ageMs / adultGrowthWindowMs, 0, 1),
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

export function getEggVisualStyle(egg: Pick<SnailEgg, 'speciesId' | 'accent'>): CSSProperties {
  const look = eggLooks[egg.speciesId] ?? eggLooks['garden-snail']!;
  return {
    ['--egg-accent' as string]: egg.accent,
    ['--egg-pattern-tone' as string]: look.patternTone,
    ['--egg-pattern-angle' as string]: look.patternAngle,
    ['--egg-crack-angle' as string]: look.crackAngle,
    ['--egg-crack-tone' as string]: look.crackTone
  };
}

