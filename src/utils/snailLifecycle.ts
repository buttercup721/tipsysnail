import { snailSpecies } from '../data/gameContent';
import type { OwnedSnail, RarityLabel, SnailEgg, SnailIdentity, SnailSpecies } from '../types/game';

export type BreedingPreview = {
  rareChance: number;
  promotionChance: number;
  hatchDurationMs: number;
  cooldownMs: number;
  rareSpeciesIds: string[];
};

export type BreedingResult = BreedingPreview & {
  egg: SnailEgg;
};

type WeightedOutcome = {
  speciesId: string;
  weight: number;
};

const speciesLookup = Object.fromEntries(
  snailSpecies.map((species) => [species.id, species])
) as Record<string, SnailSpecies>;

const rarityTierLookup: Record<string, number> = {
  'garden-snail': 0,
  'amber-snail': 0,
  'moss-snail': 0,
  'moon-snail': 1,
  'strawberry-snail': 2
};

const baseNamePool = [
  '풀잎', '비누', '모래', '이슬', '보리', '버들', '구름', '연못', '도토리', '조약돌',
  '고사리', '햇살', '잔디', '솔잎', '다래', '방울', '달빛', '단비', '산들', '들꽃',
  '오솔', '노을', '초롱', '물결', '새벽', '소담', '나래', '하늘', '이끼', '해솔',
  '모닥', '누리', '꽃잎', '바람', '별빛', '연두', '호수', '버섯', '해무', '소금',
  '밀림', '잔물', '숲길', '들풀', '안개', '달무리', '실비', '보슬', '포슬', '무늬'
];

const compoundTailPool = ['잎', '빛', '결', '솔', '꽃', '샘', '돌', '비', '안개', '별'];

const rarePrefixPoolByTier: Record<number, string[]> = {
  1: [
    '수분촉촉',
    '이슬머금은',
    '물광피부',
    '초록윤기',
    '바람살랑',
    '유리결',
    '새벽반짝',
    '풀향가득',
    '촉촉물결',
    '젤리광택',
    '아침미광',
    '은은촉촉'
  ],
  2: [
    '무지개빛',
    '달빛젤리',
    '별가루반짝',
    '비단점액',
    '오로라결',
    '유성비빛',
    '심해광택',
    '물안개광채',
    '은하수광',
    '유리비늘'
  ]
};

const starterBlueprints = [
  { id: 'starter-garden-snail', speciesId: 'garden-snail', accent: '#c47a3b', patternLabel: '잔줄 무늬', growthPoints: 80 },
  { id: 'starter-amber-snail', speciesId: 'amber-snail', accent: '#e1a64b', patternLabel: '호박 결', growthPoints: 140 },
  { id: 'starter-moss-snail', speciesId: 'moss-snail', accent: '#71935a', patternLabel: '이끼 점무늬', growthPoints: 200 }
] as const;

const patternPrefixes = ['이슬', '모래', '숲', '달빛', '작은', '물결', '잔줄', '고운'];
const patternSuffixes = ['띠', '줄', '고리', '결', '반점', '소용돌이'];

function shuffleValues<T>(values: readonly T[]): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}

function createEntityId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampColorChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampMilliseconds(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function parseHexColor(hexColor: string): [number, number, number] {
  const normalizedHex = hexColor.replace('#', '');
  const safeHex = normalizedHex.length === 3
    ? normalizedHex
        .split('')
        .map((character) => `${character}${character}`)
        .join('')
    : normalizedHex;

  return [
    Number.parseInt(safeHex.slice(0, 2), 16),
    Number.parseInt(safeHex.slice(2, 4), 16),
    Number.parseInt(safeHex.slice(4, 6), 16)
  ];
}

function formatHexColor(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => clampColorChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function blendHexColors(...colors: string[]): string {
  const validColors = colors.filter((color) => color.startsWith('#'));
  if (validColors.length === 0) {
    return '#c47a3b';
  }

  const blended = validColors
    .map(parseHexColor)
    .reduce<[number, number, number]>(
      (accumulator, currentColor) => [
        accumulator[0] + currentColor[0],
        accumulator[1] + currentColor[1],
        accumulator[2] + currentColor[2]
      ],
      [0, 0, 0]
    );

  return formatHexColor(
    blended[0] / validColors.length,
    blended[1] / validColors.length,
    blended[2] / validColors.length
  );
}

function normalizeOutcomes(outcomes: WeightedOutcome[]): WeightedOutcome[] {
  const totalWeight = outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
  if (totalWeight <= 0) {
    return [{ speciesId: 'garden-snail', weight: 1 }];
  }

  return outcomes.map((outcome) => ({
    speciesId: outcome.speciesId,
    weight: outcome.weight / totalWeight
  }));
}

function chooseWeightedSpecies(outcomes: WeightedOutcome[]): string {
  const roll = Math.random();
  let cumulative = 0;

  for (const outcome of outcomes) {
    cumulative += outcome.weight;
    if (roll <= cumulative) {
      return outcome.speciesId;
    }
  }

  return outcomes[outcomes.length - 1]?.speciesId ?? 'garden-snail';
}

export function getSpeciesTier(speciesId: string): number {
  return rarityTierLookup[speciesId] ?? 0;
}

export function getSpeciesRarityLabel(speciesId: string): RarityLabel {
  const tier = getSpeciesTier(speciesId);
  if (tier >= 2) {
    return 'epic';
  }
  if (tier >= 1) {
    return 'rare';
  }
  return 'common';
}

export function isRareSpecies(speciesId: string): boolean {
  return getSpeciesTier(speciesId) >= 1;
}

function formatSnailName(baseName: string, rarePrefix: string | null): string {
  return rarePrefix ? `${rarePrefix} ${baseName}` : baseName;
}

function createUniqueBaseName(usedNames: Set<string>): string {
  for (const candidate of shuffleValues(baseNamePool)) {
    if (!usedNames.has(candidate)) {
      return candidate;
    }
  }

  for (let attempt = 0; attempt < 300; attempt += 1) {
    const left = baseNamePool[Math.floor(Math.random() * baseNamePool.length)]!;
    const right = compoundTailPool[Math.floor(Math.random() * compoundTailPool.length)]!;
    const candidate = `${left}${right}`;
    if (!usedNames.has(candidate)) {
      return candidate;
    }
  }

  return `달팽이${usedNames.size + 1}`;
}

function createRarePrefix(tier: number): string | null {
  if (tier <= 0) {
    return null;
  }

  const prefixPool = rarePrefixPoolByTier[Math.min(2, tier)] ?? rarePrefixPoolByTier[1]!;
  return prefixPool[Math.floor(Math.random() * prefixPool.length)] ?? null;
}

export function createUniqueSnailIdentity(existingNames: Iterable<string>, speciesId: string): SnailIdentity {
  const usedNames = new Set(existingNames);
  const tier = getSpeciesTier(speciesId);

  for (let attempt = 0; attempt < 320; attempt += 1) {
    const baseName = createUniqueBaseName(usedNames);
    const rarePrefix = createRarePrefix(tier);
    const fullName = formatSnailName(baseName, rarePrefix);

    if (!usedNames.has(fullName)) {
      return {
        name: fullName,
        baseName,
        rarePrefix
      };
    }
  }

  const fallbackBase = `달팽이${usedNames.size + 1}`;
  const fallbackPrefix = createRarePrefix(tier);
  return {
    name: formatSnailName(fallbackBase, fallbackPrefix),
    baseName: fallbackBase,
    rarePrefix: fallbackPrefix
  };
}

export function refreshSnailIdentities(snails: OwnedSnail[]): OwnedSnail[] {
  const usedNames = new Set<string>();
  return snails.map((snail) => {
    const identity = createUniqueSnailIdentity(usedNames, snail.speciesId);
    usedNames.add(identity.name);
    return {
      ...snail,
      ...identity
    };
  });
}

export function createStarterSnailCollection(): OwnedSnail[] {
  const usedNames = new Set<string>();
  return starterBlueprints.map((starterBlueprint, index) => {
    const identity = createUniqueSnailIdentity(usedNames, starterBlueprint.speciesId);
    usedNames.add(identity.name);
    return {
      id: starterBlueprint.id,
      ...identity,
      speciesId: starterBlueprint.speciesId,
      accent: starterBlueprint.accent,
      patternLabel: starterBlueprint.patternLabel,
      generation: 1,
      bornAt: Date.now() - (index + 1) * 90_000,
      cooldownUntil: 0,
      growthPoints: starterBlueprint.growthPoints,
      starter: true
    };
  });
}

function getOutcomeWeights(parentA: OwnedSnail, parentB: OwnedSnail): WeightedOutcome[] {
  const speciesPair = [parentA.speciesId, parentB.speciesId].sort().join('|');
  const parentATier = getSpeciesTier(parentA.speciesId);
  const parentBTier = getSpeciesTier(parentB.speciesId);

  if (parentA.speciesId === parentB.speciesId) {
    if (parentA.speciesId === 'moon-snail') {
      return normalizeOutcomes([
        { speciesId: 'moon-snail', weight: 0.82 },
        { speciesId: 'strawberry-snail', weight: 0.18 }
      ]);
    }

    if (parentA.speciesId === 'strawberry-snail') {
      return normalizeOutcomes([
        { speciesId: 'strawberry-snail', weight: 0.88 },
        { speciesId: 'moon-snail', weight: 0.12 }
      ]);
    }

    return [{ speciesId: parentA.speciesId, weight: 1 }];
  }

  if (speciesPair === 'amber-snail|moss-snail') {
    return normalizeOutcomes([
      { speciesId: 'amber-snail', weight: 0.42 },
      { speciesId: 'moss-snail', weight: 0.38 },
      { speciesId: 'moon-snail', weight: 0.2 }
    ]);
  }

  if (speciesPair === 'garden-snail|moon-snail') {
    return normalizeOutcomes([
      { speciesId: 'garden-snail', weight: 0.36 },
      { speciesId: 'moon-snail', weight: 0.56 },
      { speciesId: 'strawberry-snail', weight: 0.08 }
    ]);
  }

  if (speciesPair === 'amber-snail|moon-snail' || speciesPair === 'moon-snail|moss-snail') {
    const commonParentId = parentATier === 0 ? parentA.speciesId : parentB.speciesId;
    return normalizeOutcomes([
      { speciesId: 'moon-snail', weight: 0.58 },
      { speciesId: commonParentId, weight: 0.28 },
      { speciesId: 'strawberry-snail', weight: 0.14 }
    ]);
  }

  if (speciesPair === 'moon-snail|strawberry-snail') {
    return normalizeOutcomes([
      { speciesId: 'strawberry-snail', weight: 0.54 },
      { speciesId: 'moon-snail', weight: 0.46 }
    ]);
  }

  if (speciesPair.includes('strawberry-snail')) {
    const otherParentId = parentA.speciesId === 'strawberry-snail' ? parentB.speciesId : parentA.speciesId;
    const otherParentTier = getSpeciesTier(otherParentId);

    if (otherParentTier >= 1) {
      return normalizeOutcomes([
        { speciesId: 'strawberry-snail', weight: 0.64 },
        { speciesId: otherParentId, weight: 0.36 }
      ]);
    }

    return normalizeOutcomes([
      { speciesId: 'strawberry-snail', weight: 0.44 },
      { speciesId: otherParentId, weight: 0.38 },
      { speciesId: 'moon-snail', weight: 0.18 }
    ]);
  }

  if (parentATier === 0 && parentBTier === 0) {
    return normalizeOutcomes([
      { speciesId: parentA.speciesId, weight: 0.52 },
      { speciesId: parentB.speciesId, weight: 0.48 }
    ]);
  }

  const rareParentId = parentATier >= parentBTier ? parentA.speciesId : parentB.speciesId;
  const commonParentId = rareParentId === parentA.speciesId ? parentB.speciesId : parentA.speciesId;
  return normalizeOutcomes([
    { speciesId: rareParentId, weight: 0.68 },
    { speciesId: commonParentId, weight: 0.32 }
  ]);
}

function getRareChance(outcomes: WeightedOutcome[]): number {
  return outcomes.reduce(
    (sum, outcome) => sum + (getSpeciesTier(outcome.speciesId) >= 1 ? outcome.weight : 0),
    0
  );
}

function getPromotionChance(outcomes: WeightedOutcome[], parentA: OwnedSnail, parentB: OwnedSnail): number {
  const maxParentTier = Math.max(getSpeciesTier(parentA.speciesId), getSpeciesTier(parentB.speciesId));
  return outcomes.reduce(
    (sum, outcome) => sum + (getSpeciesTier(outcome.speciesId) > maxParentTier ? outcome.weight : 0),
    0
  );
}

function getCooldownMs(parentA: OwnedSnail, parentB: OwnedSnail, promotionChance: number): number {
  const raritySum = getSpeciesTier(parentA.speciesId) + getSpeciesTier(parentB.speciesId);
  let cooldownMs = 28_000 + raritySum * 11_000;

  if (parentA.speciesId === parentB.speciesId) {
    cooldownMs -= 3_000;
  }

  if (promotionChance > 0) {
    cooldownMs += 6_000;
  }

  return clampMilliseconds(cooldownMs, 24_000, 64_000);
}

function getHatchDurationMs(parentA: OwnedSnail, parentB: OwnedSnail, promotionChance: number): number {
  const raritySum = getSpeciesTier(parentA.speciesId) + getSpeciesTier(parentB.speciesId);
  const highestGeneration = Math.max(parentA.generation, parentB.generation);
  let hatchDurationMs = 44_000 + raritySum * 18_000 + Math.max(0, highestGeneration - 1) * 2_000;

  if (parentA.speciesId === parentB.speciesId) {
    hatchDurationMs -= 4_000;
  }

  if (promotionChance > 0) {
    hatchDurationMs += 10_000;
  }

  return clampMilliseconds(hatchDurationMs, 38_000, 106_000);
}

function createPatternLabel(generation: number): string {
  const prefix = patternPrefixes[generation % patternPrefixes.length]!;
  const suffix = patternSuffixes[(generation + 2) % patternSuffixes.length]!;
  return `${prefix} ${suffix}`;
}

export function getBreedingPreview(parentA: OwnedSnail, parentB: OwnedSnail): BreedingPreview {
  const outcomes = getOutcomeWeights(parentA, parentB);
  const promotionChance = getPromotionChance(outcomes, parentA, parentB);
  const rareChance = getRareChance(outcomes);
  const hatchDurationMs = getHatchDurationMs(parentA, parentB, promotionChance);
  const cooldownMs = getCooldownMs(parentA, parentB, promotionChance);
  const rareSpeciesIds = [...new Set(
    outcomes
      .filter((outcome) => getSpeciesTier(outcome.speciesId) >= 1)
      .map((outcome) => outcome.speciesId)
  )];

  return {
    rareChance,
    promotionChance,
    hatchDurationMs,
    cooldownMs,
    rareSpeciesIds
  };
}

export function createEggFromParents(parentA: OwnedSnail, parentB: OwnedSnail, terrariumId: string): BreedingResult {
  const preview = getBreedingPreview(parentA, parentB);
  const outcomes = getOutcomeWeights(parentA, parentB);
  const offspringSpeciesId = chooseWeightedSpecies(outcomes);
  const offspringSpecies = speciesLookup[offspringSpeciesId] ?? snailSpecies[0]!;
  const generation = Math.max(parentA.generation, parentB.generation) + 1;
  const accent = blendHexColors(parentA.accent, parentB.accent, offspringSpecies.accent);
  const laidAt = Date.now();

  return {
    ...preview,
    egg: {
      id: createEntityId('egg'),
      terrariumId,
      parentAId: parentA.id,
      parentBId: parentB.id,
      speciesId: offspringSpeciesId,
      accent,
      patternLabel: createPatternLabel(generation),
      generation,
      laidAt,
      hatchAt: laidAt + preview.hatchDurationMs
    }
  };
}

export function hatchEgg(egg: SnailEgg, existingNames: Iterable<string>): OwnedSnail {
  const identity = createUniqueSnailIdentity(existingNames, egg.speciesId);
  return {
    id: createEntityId('snail'),
    ...identity,
    speciesId: egg.speciesId,
    accent: egg.accent,
    patternLabel: egg.patternLabel,
    generation: egg.generation,
    bornAt: Date.now(),
    cooldownUntil: 0,
    growthPoints: 0,
    starter: false
  };
}

export function formatEggCountdown(millisecondsRemaining: number): string {
  const safeMilliseconds = Math.max(0, millisecondsRemaining);
  const totalSeconds = Math.ceil(safeMilliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}초`;
  }

  return `${minutes}분 ${seconds.toString().padStart(2, '0')}초`;
}