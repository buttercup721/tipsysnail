import type { OwnedSnail, RarityLabel, ShellFinish, ShellPattern, SnailMorph } from '../types/game';

type MorphParent = Pick<
  OwnedSnail,
  | 'speciesId'
  | 'accent'
  | 'generation'
  | 'morphRarity'
  | 'shellPattern'
  | 'shellFinish'
  | 'shellSecondary'
  | 'bodyTint'
  | 'auraTint'
>;

type InheritedPalette = {
  accent: string;
  shellSecondary: string;
  bodyTint: string;
  auraTint: string;
};

type MorphSeedInput = {
  speciesId: string;
  accent: string;
  generation: number;
  seedText: string;
  parents?: MorphParent[];
  inheritedPalette?: Partial<Pick<SnailMorph, 'shellSecondary' | 'bodyTint' | 'auraTint'>>;
};

type WeightedEntry<T extends string> = {
  value: T;
  weight: number;
};

const speciesTierLookup: Record<string, number> = {
  'garden-snail': 0,
  'amber-snail': 0,
  'moss-snail': 0,
  'moon-snail': 1,
  'strawberry-snail': 2
};

const rarityRank: Record<RarityLabel, number> = {
  common: 0,
  rare: 1,
  epic: 2
};

const rarityWeightByTier: Record<number, Record<RarityLabel, number>> = {
  0: { common: 0.84, rare: 0.14, epic: 0.02 },
  1: { common: 0.68, rare: 0.25, epic: 0.07 },
  2: { common: 0.46, rare: 0.36, epic: 0.18 }
};

export const shellPatternValues: readonly ShellPattern[] = ['banded', 'speckled', 'ripple', 'split', 'halo'];
export const shellFinishValues: readonly ShellFinish[] = ['matte', 'dewy', 'pearlescent', 'aurora'];
export const morphRarityValues: readonly RarityLabel[] = ['common', 'rare', 'epic'];

export function isShellPattern(value: unknown): value is ShellPattern {
  return typeof value === 'string' && shellPatternValues.includes(value as ShellPattern);
}

export function isShellFinish(value: unknown): value is ShellFinish {
  return typeof value === 'string' && shellFinishValues.includes(value as ShellFinish);
}

export function isMorphRarity(value: unknown): value is RarityLabel {
  return typeof value === 'string' && morphRarityValues.includes(value as RarityLabel);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seedText: string): () => number {
  let seed = hashString(seedText) || 1;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHex(hexColor: string): string {
  if (!hexColor.startsWith('#')) {
    return '#8f7a5e';
  }

  const raw = hexColor.slice(1);
  if (raw.length === 3) {
    return `#${raw.split('').map((channel) => `${channel}${channel}`).join('')}`;
  }

  return raw.length === 6 ? `#${raw}` : '#8f7a5e';
}

function parseHex(hexColor: string): [number, number, number] {
  const safeHex = normalizeHex(hexColor).slice(1);
  return [
    Number.parseInt(safeHex.slice(0, 2), 16),
    Number.parseInt(safeHex.slice(2, 4), 16),
    Number.parseInt(safeHex.slice(4, 6), 16)
  ];
}

function formatHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function blendHexColors(...colors: string[]): string {
  const validColors = colors.map(normalizeHex);
  const [red, green, blue] = validColors
    .map(parseHex)
    .reduce<[number, number, number]>(
      (accumulator, color) => [
        accumulator[0] + color[0],
        accumulator[1] + color[1],
        accumulator[2] + color[2]
      ],
      [0, 0, 0]
    );

  return formatHex(
    red / validColors.length,
    green / validColors.length,
    blue / validColors.length
  );
}

function mixHexColors(left: string, right: string, ratio: number): string {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const [leftRed, leftGreen, leftBlue] = parseHex(left);
  const [rightRed, rightGreen, rightBlue] = parseHex(right);
  return formatHex(
    leftRed + (rightRed - leftRed) * clampedRatio,
    leftGreen + (rightGreen - leftGreen) * clampedRatio,
    leftBlue + (rightBlue - leftBlue) * clampedRatio
  );
}

function shiftHexColor(hexColor: string, amount: number): string {
  const target = amount >= 0 ? '#ffffff' : '#1f1c1a';
  return mixHexColors(hexColor, target, Math.abs(amount));
}

function chooseDominantParent(parentA: MorphParent, parentB: MorphParent, random: () => number): MorphParent {
  const rarityDelta = rarityRank[parentA.morphRarity] - rarityRank[parentB.morphRarity];
  if (rarityDelta !== 0 && random() < 0.72) {
    return rarityDelta > 0 ? parentA : parentB;
  }

  const generationDelta = parentA.generation - parentB.generation;
  if (generationDelta !== 0 && random() < 0.58) {
    return generationDelta > 0 ? parentA : parentB;
  }

  return random() < 0.5 ? parentA : parentB;
}

export function createInheritedEggPalette(
  parentA: MorphParent,
  parentB: MorphParent,
  speciesAccent: string,
  seedText: string
): InheritedPalette {
  const random = createSeededRandom(`${seedText}|palette`);
  const dominantParent = chooseDominantParent(parentA, parentB, random);
  const recessiveParent = dominantParent === parentA ? parentB : parentA;

  let accent = mixHexColors(dominantParent.accent, recessiveParent.accent, 0.24 + random() * 0.18);
  accent = mixHexColors(accent, speciesAccent, 0.14 + random() * 0.08);
  accent = mixHexColors(accent, dominantParent.shellSecondary, 0.08 + random() * 0.08);

  let shellSecondary = mixHexColors(dominantParent.shellSecondary, recessiveParent.shellSecondary, 0.32 + random() * 0.2);
  shellSecondary = mixHexColors(shellSecondary, accent, 0.18 + random() * 0.08);

  let bodyTint = mixHexColors(blendHexColors(dominantParent.bodyTint, recessiveParent.bodyTint), accent, 0.16 + random() * 0.12);
  let auraTint = mixHexColors(blendHexColors(dominantParent.auraTint, recessiveParent.auraTint), accent, 0.24 + random() * 0.18);
  auraTint = mixHexColors(auraTint, speciesAccent, 0.08 + random() * 0.06);

  if (parentA.morphRarity === parentB.morphRarity) {
    const sharedLift = parentA.morphRarity === 'epic' ? 0.07 : parentA.morphRarity === 'rare' ? 0.04 : 0.02;
    accent = shiftHexColor(accent, sharedLift);
    shellSecondary = shiftHexColor(shellSecondary, sharedLift * 0.7);
    bodyTint = shiftHexColor(bodyTint, sharedLift * 0.35);
    auraTint = shiftHexColor(auraTint, sharedLift);
  }

  return {
    accent,
    shellSecondary,
    bodyTint,
    auraTint
  };
}

function weightedPick<T extends string>(entries: WeightedEntry<T>[], random: () => number): T {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) {
    return entries[0]!.value;
  }

  const roll = random() * total;
  let cursor = 0;
  for (const entry of entries) {
    cursor += Math.max(0, entry.weight);
    if (roll <= cursor) {
      return entry.value;
    }
  }

  return entries[entries.length - 1]!.value;
}

function getRarityWeights(speciesId: string, parents: MorphParent[]): WeightedEntry<RarityLabel>[] {
  const speciesTier = speciesTierLookup[speciesId] ?? 0;
  const sourceWeights = rarityWeightByTier[speciesTier] ?? rarityWeightByTier[0]!;
  const baseWeights: Record<RarityLabel, number> = {
    common: sourceWeights.common,
    rare: sourceWeights.rare,
    epic: sourceWeights.epic
  };

  for (const parent of parents) {
    if (parent.morphRarity === 'rare') {
      baseWeights.common -= 0.08;
      baseWeights.rare += 0.06;
      baseWeights.epic += 0.02;
    }

    if (parent.morphRarity === 'epic') {
      baseWeights.common -= 0.13;
      baseWeights.rare += 0.04;
      baseWeights.epic += 0.09;
    }
  }

  if (parents.length === 2 && parents[0]!.morphRarity === parents[1]!.morphRarity) {
    const sharedRarity = parents[0]!.morphRarity;
    baseWeights[sharedRarity] += sharedRarity === 'common' ? 0.03 : 0.08;
  }

  return morphRarityValues.map((value) => ({
    value,
    weight: Math.max(0.01, baseWeights[value])
  }));
}

function getPatternWeights(rarity: RarityLabel, parents: MorphParent[]): WeightedEntry<ShellPattern>[] {
  const baseWeights: Record<RarityLabel, Record<ShellPattern, number>> = {
    common: { banded: 0.42, speckled: 0.24, ripple: 0.2, split: 0.1, halo: 0.04 },
    rare: { banded: 0.18, speckled: 0.2, ripple: 0.24, split: 0.22, halo: 0.16 },
    epic: { banded: 0.08, speckled: 0.12, ripple: 0.2, split: 0.22, halo: 0.38 }
  };

  const adjusted: Record<ShellPattern, number> = { ...baseWeights[rarity] };
  for (const parent of parents) {
    adjusted[parent.shellPattern] += 0.1 + rarityRank[parent.morphRarity] * 0.03;
  }

  if (parents.length === 2 && parents[0]!.shellPattern === parents[1]!.shellPattern) {
    adjusted[parents[0]!.shellPattern] += 0.18;
  }

  return shellPatternValues.map((value) => ({
    value,
    weight: adjusted[value]
  }));
}

function getFinishWeights(rarity: RarityLabel, parents: MorphParent[]): WeightedEntry<ShellFinish>[] {
  const baseWeights: Record<RarityLabel, Record<ShellFinish, number>> = {
    common: { matte: 0.48, dewy: 0.38, pearlescent: 0.11, aurora: 0.03 },
    rare: { matte: 0.18, dewy: 0.34, pearlescent: 0.34, aurora: 0.14 },
    epic: { matte: 0.06, dewy: 0.22, pearlescent: 0.32, aurora: 0.4 }
  };

  const adjusted: Record<ShellFinish, number> = { ...baseWeights[rarity] };
  for (const parent of parents) {
    adjusted[parent.shellFinish] += 0.14 + rarityRank[parent.morphRarity] * 0.04;
  }

  if (parents.length === 2 && parents[0]!.shellFinish === parents[1]!.shellFinish) {
    adjusted[parents[0]!.shellFinish] += 0.22;
  }

  return shellFinishValues.map((value) => ({
    value,
    weight: adjusted[value]
  }));
}

function getPatternColor(baseColor: string, pattern: ShellPattern): string {
  switch (pattern) {
    case 'banded':
      return shiftHexColor(baseColor, -0.18);
    case 'speckled':
      return mixHexColors(baseColor, '#6a4e37', 0.3);
    case 'ripple':
      return mixHexColors(baseColor, '#d9e2d4', 0.18);
    case 'split':
      return mixHexColors(baseColor, '#f3dfbc', 0.34);
    case 'halo':
      return mixHexColors(baseColor, '#eef7d7', 0.46);
    default:
      return baseColor;
  }
}

function getFinishColor(baseColor: string, finish: ShellFinish): string {
  switch (finish) {
    case 'matte':
      return shiftHexColor(baseColor, -0.05);
    case 'dewy':
      return mixHexColors(baseColor, '#dff1e3', 0.16);
    case 'pearlescent':
      return mixHexColors(baseColor, '#e8def6', 0.24);
    case 'aurora':
      return mixHexColors(baseColor, '#bcffe6', 0.28);
    default:
      return baseColor;
  }
}

function getBodyTint(accent: string, finish: ShellFinish, rarity: RarityLabel, parents: MorphParent[]): string {
  const parentBase = parents.length > 0
    ? blendHexColors(...parents.map((parent) => parent.bodyTint), '#97a28a')
    : '#97a28a';
  let bodyTint = blendHexColors(accent, parentBase, '#a5b39a');

  if (finish === 'dewy') {
    bodyTint = mixHexColors(bodyTint, '#d0ddc3', 0.22);
  } else if (finish === 'pearlescent') {
    bodyTint = mixHexColors(bodyTint, '#d9e5ea', 0.2);
  } else if (finish === 'aurora') {
    bodyTint = mixHexColors(bodyTint, '#c5e9d7', 0.24);
  } else {
    bodyTint = shiftHexColor(bodyTint, -0.06);
  }

  return rarity === 'epic' ? shiftHexColor(bodyTint, 0.04) : bodyTint;
}

function getAuraTint(accent: string, finish: ShellFinish, rarity: RarityLabel, parents: MorphParent[]): string {
  const parentAura = parents.length > 0
    ? blendHexColors(...parents.map((parent) => parent.auraTint), accent)
    : accent;

  const finishAura = finish === 'aurora'
    ? '#abffe0'
    : finish === 'pearlescent'
      ? '#e8d7ff'
      : finish === 'dewy'
        ? '#dff8eb'
        : '#ebeadf';

  const rarityBoost = rarity === 'epic'
    ? 0.46
    : rarity === 'rare'
      ? 0.34
      : 0.18;

  return mixHexColors(parentAura, finishAura, rarityBoost);
}

export function createSnailMorph({
  speciesId,
  accent,
  generation,
  seedText,
  parents = [],
  inheritedPalette = {}
}: MorphSeedInput): SnailMorph {
  const random = createSeededRandom(`${speciesId}|${accent}|${generation}|${seedText}`);
  const morphRarity = weightedPick(getRarityWeights(speciesId, parents), random);
  const shellPattern = weightedPick(getPatternWeights(morphRarity, parents), random);
  const shellFinish = weightedPick(getFinishWeights(morphRarity, parents), random);

  const secondaryAnchor = parents.length > 0
    ? blendHexColors(...parents.map((parent) => parent.shellSecondary), accent)
    : accent;
  const baseShellSecondary = getFinishColor(getPatternColor(secondaryAnchor, shellPattern), shellFinish);
  const baseBodyTint = getBodyTint(accent, shellFinish, morphRarity, parents);
  const baseAuraTint = getAuraTint(accent, shellFinish, morphRarity, parents);

  return {
    morphRarity,
    shellPattern,
    shellFinish,
    shellSecondary: inheritedPalette.shellSecondary
      ? mixHexColors(baseShellSecondary, inheritedPalette.shellSecondary, 0.56)
      : baseShellSecondary,
    bodyTint: inheritedPalette.bodyTint
      ? mixHexColors(baseBodyTint, inheritedPalette.bodyTint, 0.5)
      : baseBodyTint,
    auraTint: inheritedPalette.auraTint
      ? mixHexColors(baseAuraTint, inheritedPalette.auraTint, 0.58)
      : baseAuraTint
  };
}

export function getMorphValueBonus(
  snail: Pick<OwnedSnail, 'morphRarity' | 'shellPattern' | 'shellFinish'>
): number {
  const rarityBonus: Record<RarityLabel, number> = {
    common: 0,
    rare: 48,
    epic: 132
  };

  const patternBonus: Record<ShellPattern, number> = {
    banded: 0,
    speckled: 10,
    ripple: 14,
    split: 22,
    halo: 30
  };

  const finishBonus: Record<ShellFinish, number> = {
    matte: 0,
    dewy: 12,
    pearlescent: 28,
    aurora: 54
  };

  return rarityBonus[snail.morphRarity] + patternBonus[snail.shellPattern] + finishBonus[snail.shellFinish];
}
