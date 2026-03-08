import { snailSpecies } from '../data/gameContent';
import type { OwnedSnail, SnailEgg, SnailSpecies } from '../types/game';

type WeightedOutcome = {
  speciesId: string;
  weight: number;
};

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

const starterSnails: OwnedSnail[] = [
  {
    id: 'starter-garden-snail',
    name: '이슬',
    speciesId: 'garden-snail',
    accent: '#c47a3b',
    patternLabel: '정원 소용돌이',
    generation: 1,
    bornAt: 1730764800000,
    cooldownUntil: 0,
    starter: true
  },
  {
    id: 'starter-amber-snail',
    name: '꿀단지',
    speciesId: 'amber-snail',
    accent: '#e1a64b',
    patternLabel: '호박 물결',
    generation: 1,
    bornAt: 1730851200000,
    cooldownUntil: 0,
    starter: true
  },
  {
    id: 'starter-moss-snail',
    name: '모스',
    speciesId: 'moss-snail',
    accent: '#71935a',
    patternLabel: '이끼 줄무늬',
    generation: 1,
    bornAt: 1730937600000,
    cooldownUntil: 0,
    starter: true
  }
];

const nameSeeds = ['별', '도토리', '이슬', '모래', '비누', '풀잎', '유리', '달빛', '콩알', '방울'];
const patternPrefixes = ['이슬', '정원', '비창', '은빛', '클로버', '노을', '별빛', '유리'];
const patternSuffixes = ['소용돌이', '줄무늬', '점무늬', '물결', '반짝', '고리'];

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
    .reduce(
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

function getSpeciesTier(speciesId: string): number {
  return rarityTierLookup[speciesId] ?? 0;
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

function getOutcomeWeights(parentA: OwnedSnail, parentB: OwnedSnail): WeightedOutcome[] {
  const speciesPair = [parentA.speciesId, parentB.speciesId].sort().join('|');
  const parentATier = getSpeciesTier(parentA.speciesId);
  const parentBTier = getSpeciesTier(parentB.speciesId);

  if (parentA.speciesId === parentB.speciesId) {
    if (parentA.speciesId === 'moon-snail') {
      return normalizeOutcomes([
        { speciesId: 'moon-snail', weight: 0.84 },
        { speciesId: 'strawberry-snail', weight: 0.16 }
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
      { speciesId: 'amber-snail', weight: 0.43 },
      { speciesId: 'moss-snail', weight: 0.39 },
      { speciesId: 'moon-snail', weight: 0.18 }
    ]);
  }

  if (speciesPair === 'garden-snail|moon-snail') {
    return normalizeOutcomes([
      { speciesId: 'garden-snail', weight: 0.34 },
      { speciesId: 'moon-snail', weight: 0.58 },
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
      { speciesId: 'strawberry-snail', weight: 0.52 },
      { speciesId: 'moon-snail', weight: 0.48 }
    ]);
  }

  if (speciesPair.includes('strawberry-snail')) {
    const otherParentId = parentA.speciesId === 'strawberry-snail' ? parentB.speciesId : parentA.speciesId;
    const otherParentTier = getSpeciesTier(otherParentId);

    if (otherParentTier >= 1) {
      return normalizeOutcomes([
        { speciesId: 'strawberry-snail', weight: 0.62 },
        { speciesId: otherParentId, weight: 0.38 }
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
  let cooldownMs = 28000 + raritySum * 12000;

  if (parentA.speciesId === parentB.speciesId) {
    cooldownMs -= 3000;
  }

  if (promotionChance > 0) {
    cooldownMs += 6000;
  }

  return clampMilliseconds(cooldownMs, 24000, 62000);
}

function getHatchDurationMs(parentA: OwnedSnail, parentB: OwnedSnail, promotionChance: number): number {
  const raritySum = getSpeciesTier(parentA.speciesId) + getSpeciesTier(parentB.speciesId);
  const highestGeneration = Math.max(parentA.generation, parentB.generation);
  let hatchDurationMs = 48000 + raritySum * 17000 + Math.max(0, highestGeneration - 1) * 1500;

  if (parentA.speciesId === parentB.speciesId) {
    hatchDurationMs -= 4000;
  }

  if (promotionChance > 0) {
    hatchDurationMs += 10000;
  }

  return clampMilliseconds(hatchDurationMs, 42000, 98000);
}

function createPatternLabel(generation: number): string {
  const prefix = patternPrefixes[generation % patternPrefixes.length]!;
  const suffix = patternSuffixes[(generation + 2) % patternSuffixes.length]!;
  return `${prefix} ${suffix}`;
}

function createSnailName(speciesName: string, collectionSize: number): string {
  const seed = nameSeeds[collectionSize % nameSeeds.length]!;
  const shortSpeciesName = speciesName.replace(' Snail', '').replace('Snail', '').trim();
  return `${seed}${collectionSize + 1} ${shortSpeciesName}`.trim();
}

export function createStarterSnailCollection(): OwnedSnail[] {
  return starterSnails.map((snail) => ({ ...snail }));
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

export function createEggFromParents(
  parentA: OwnedSnail,
  parentB: OwnedSnail,
  terrariumId: string,
  existingSnailCount: number
): BreedingResult {
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
      plannedName: createSnailName(offspringSpecies.name, existingSnailCount),
      generation,
      laidAt,
      hatchAt: laidAt + preview.hatchDurationMs
    }
  };
}

export function hatchEgg(egg: SnailEgg): OwnedSnail {
  return {
    id: createEntityId('snail'),
    name: egg.plannedName,
    speciesId: egg.speciesId,
    accent: egg.accent,
    patternLabel: egg.patternLabel,
    generation: egg.generation,
    bornAt: Date.now(),
    cooldownUntil: 0,
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
