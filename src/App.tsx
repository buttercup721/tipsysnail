import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent
} from 'react';
import { snailSpecies, starterTerrariums } from './data/gameContent';
import type {
  BreedingSelection,
  FoodInventory,
  FoodType,
  ManualSaveSlot,
  OwnedSnail,
  SnailEgg,
  SnailSpecies,
  StoredGameState
} from './types/game';
import {
  foodCatalog,
  foodShopBundles,
  formatCurrency,
  getSnailSaleValue,
  starterBalance,
  starterFoodInventory
} from './utils/gameEconomy';
import {
  getEggVisualStyle,
  getGrowthProfile,
  type GrowthProfile
} from './utils/snailGrowth';
import { snailSounds } from './utils/soundEffects';
import {
  createEggFromParents,
  createStarterSnailCollection,
  getBreedingPreview,
  getSpeciesRarityLabel,
  hatchEgg,
  refreshSnailIdentities
} from './utils/snailLifecycle';
import { loadManualSaveSlot, loadStoredGameState, saveManualSaveSlot, saveStoredGameState } from './utils/storage';
import { createSnailMorph, isMorphRarity, isShellFinish, isShellPattern } from './utils/snailMorphs';

type MotionReaction = 'idle' | 'seek' | 'touch' | 'eat' | 'breed';

type SnailMotion = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  heading: number;
  speed: number;
  pace: number;
  nextDecisionAt: number;
  reaction: MotionReaction;
  reactionUntil: number;
};

type FoodDrop = {
  id: string;
  type: FoodType;
  x: number;
  y: number;
  growthGain: number;
  placedAt: number;
};

type SaleQuote = {
  ids: string[];
  total: number;
};

type InteractionMode = 'observe' | 'breed' | 'sell';

type RescueGift = {
  title: string;
  message: string;
  balance: number;
  cucumber: number;
  carrot: number;
};

const CURRENT_SAVE_VERSION = 9;
const defaultStatusMessage = '달팽이를 눌러 살펴보거나, 먹이 점을 편하게 내려놓아 보세요.';
const fallbackTerrarium = starterTerrariums[0]!;
const motionTickMs = 120;
const clockTickMs = 1000;
const touchReactionMs = 1500;
const breedingReactionMs = 2600;
const eatingReactionMs = 1800;
const foodDropLifetimeMs = 30_000;
const maximumSelection = 2;
const eggClusterColumns = 4;
const bgmPreferenceKey = 'tipsysnail-bgm-enabled';
const rescueGiftCooldownMs = 120_000;
const rescueGiftBalanceThreshold = 22;
const rescueGiftFoodThreshold = 1;
const rescueGiftPool: RescueGift[] = [
  {
    title: '\uC774\uC2AC \uC120\uBB3C',
    message: '\uC720\uB9AC\uBCCD \uC704\uC5D0 \uC774\uC2AC\uC774 \uB9FA\uD600\uC11C \uC624\uC774 \uB450 \uAC1C\uC640 \uC791\uC740 \uD3EC\uC778\uD2B8 \uC120\uBB3C\uC744 \uB0A8\uAE30\uACE0 \uAC14\uC5B4\uC694.',
    balance: 18,
    cucumber: 2,
    carrot: 0
  },
  {
    title: '\uBE57\uBB3C \uBC30\uB2EC',
    message: '\uBE57\uBB3C \uBC30\uB2EC\uC774 \uB3C4\uCC29\uD574 \uB2F9\uADFC\uACFC \uD3EC\uC778\uD2B8\uB97C \uC870\uAE08 \uB193\uACE0 \uAC14\uC5B4\uC694.',
    balance: 24,
    cucumber: 0,
    carrot: 1
  },
  {
    title: '\uC774\uB07C \uBC14\uAD6C\uB2C8',
    message: '\uC774\uB07C \uBC14\uAD6C\uB2C8\uC5D0\uC11C \uBA39\uC774\uAC00 \uAD74\uB7EC\uB0B4\uB824\uC654\uC5B4\uC694. \uC7A0\uAE50 \uD55C\uC2DC\uB984\uC774 \uB420 \uAC70\uC608\uC694.',
    balance: 12,
    cucumber: 1,
    carrot: 1
  }
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function distance(leftX: number, leftY: number, rightX: number, rightY: number): number {
  return Math.hypot(rightX - leftX, rightY - leftY);
}

function hashString(value: string): number {
  return [...value].reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

function createEntityId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function cloneStoredState(state: StoredGameState): StoredGameState {
  return JSON.parse(JSON.stringify(state)) as StoredGameState;
}

function loadBgmPreference(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  const stored = window.localStorage.getItem(bgmPreferenceKey);
  return stored == null ? true : stored !== 'false';
}

function getRescueGift(index: number): RescueGift {
  return rescueGiftPool[index % rescueGiftPool.length] ?? rescueGiftPool[0]!;
}

function formatShortDuration(milliseconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  if (minutes === 0) {
    return `${seconds}초`;
  }

  return `${minutes}분 ${seconds.toString().padStart(2, '0')}초`;
}

function formatSavedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp);
}

function createMotionSeed(snailId: string, index: number): SnailMotion {
  const seed = hashString(snailId) + (index + 1) * 97;
  const orbit = ((index % 6) / 6) * Math.PI * 2 + (seed % 31) * 0.04;
  const radius = 22 + (seed % 18);
  const x = clamp(50 + Math.cos(orbit) * radius, 12, 88);
  const y = clamp(48 + Math.sin(orbit) * (radius * 0.72), 16, 84);
  const targetX = clamp(x + Math.cos(orbit + 0.9) * 12, 8, 92);
  const targetY = clamp(y + Math.sin(orbit + 0.7) * 10, 12, 88);
  const pace = 0.82 + (seed % 13) * 0.035;

  return {
    x,
    y,
    targetX,
    targetY,
    heading: seed % 360,
    speed: (0.07 + (seed % 8) * 0.0035) * pace,
    pace,
    nextDecisionAt: Date.now() + 1800 + (seed % 2800),
    reaction: 'idle',
    reactionUntil: 0
  };
}

function syncMotionMap(previous: Record<string, SnailMotion>, snails: OwnedSnail[]): Record<string, SnailMotion> {
  return Object.fromEntries(
    snails.map((snail, index) => {
      const seedMotion = createMotionSeed(snail.id, index);
      const existing = previous[snail.id];
      return [
        snail.id,
        existing
          ? { ...seedMotion, ...existing, pace: existing.pace ?? seedMotion.pace }
          : seedMotion
      ];
    })
  );
}

function pickWanderTarget(currentX: number, currentY: number): Pick<SnailMotion, 'targetX' | 'targetY' | 'nextDecisionAt'> {
  return {
    targetX: clamp(currentX + (Math.random() - 0.5) * 22, 8, 92),
    targetY: clamp(currentY + (Math.random() - 0.5) * 18, 12, 88),
    nextDecisionAt: Date.now() + 2600 + Math.round(Math.random() * 4800)
  };
}

function getMotionHeading(fromX: number, fromY: number, toX: number, toY: number): number {
  return Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI) + 90;
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function interpolateAngle(current: number, target: number, factor: number): number {
  const delta = ((target - current + 540) % 360) - 180;
  return normalizeAngle(current + delta * factor);
}

function sanitizeFoodInventory(candidate: unknown): FoodInventory {
  const inventory = candidate && typeof candidate === 'object'
    ? candidate as Partial<Record<FoodType, unknown>>
    : {};

  return {
    cucumber: typeof inventory.cucumber === 'number'
      ? Math.max(0, Math.floor(inventory.cucumber))
      : starterFoodInventory.cucumber,
    carrot: typeof inventory.carrot === 'number'
      ? Math.max(0, Math.floor(inventory.carrot))
      : starterFoodInventory.carrot
  };
}

function sanitizeOwnedSnail(
  candidate: unknown,
  fallbackId: string,
  speciesLookup: Record<string, SnailSpecies>,
  now: number
): OwnedSnail | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const maybeSnail = candidate as Partial<OwnedSnail> & Record<string, unknown>;
  const speciesId = typeof maybeSnail.speciesId === 'string' ? maybeSnail.speciesId : null;
  if (!speciesId || !speciesLookup[speciesId]) {
    return null;
  }

  const species = speciesLookup[speciesId]!;
  const accent = typeof maybeSnail.accent === 'string' && maybeSnail.accent ? maybeSnail.accent : species.accent;
  const fallbackName = typeof species.name === 'string' && species.name.trim() ? species.name.trim() : '\uB2EC\uD33D\uC774';
  const name = typeof maybeSnail.name === 'string' && maybeSnail.name.trim() ? maybeSnail.name.trim() : fallbackName;
  const generation = typeof maybeSnail.generation === 'number' && maybeSnail.generation > 0 ? Math.floor(maybeSnail.generation) : 1;
  const snailId = typeof maybeSnail.id === 'string' ? maybeSnail.id : fallbackId;
  const morphFallback = createSnailMorph({
    speciesId,
    accent,
    generation,
    seedText: snailId
  });
  const growthPoints = typeof maybeSnail.growthPoints === 'number' && Number.isFinite(maybeSnail.growthPoints)
    ? Math.max(0, Math.round(maybeSnail.growthPoints))
    : 0;

  return {
    id: snailId,
    name,
    baseName: typeof maybeSnail.baseName === 'string' && maybeSnail.baseName.trim() ? maybeSnail.baseName.trim() : name,
    rarePrefix: typeof maybeSnail.rarePrefix === 'string' && maybeSnail.rarePrefix.trim() ? maybeSnail.rarePrefix.trim() : null,
    morphRarity: isMorphRarity(maybeSnail.morphRarity) ? maybeSnail.morphRarity : morphFallback.morphRarity,
    shellPattern: isShellPattern(maybeSnail.shellPattern) ? maybeSnail.shellPattern : morphFallback.shellPattern,
    shellFinish: isShellFinish(maybeSnail.shellFinish) ? maybeSnail.shellFinish : morphFallback.shellFinish,
    shellSecondary: typeof maybeSnail.shellSecondary === 'string' && maybeSnail.shellSecondary ? maybeSnail.shellSecondary : morphFallback.shellSecondary,
    bodyTint: typeof maybeSnail.bodyTint === 'string' && maybeSnail.bodyTint ? maybeSnail.bodyTint : morphFallback.bodyTint,
    auraTint: typeof maybeSnail.auraTint === 'string' && maybeSnail.auraTint ? maybeSnail.auraTint : morphFallback.auraTint,
    speciesId,
    accent,
    patternLabel: typeof maybeSnail.patternLabel === 'string' && maybeSnail.patternLabel.trim() ? maybeSnail.patternLabel.trim() : '\uC790\uC5F0 \uBB34\uB2AC',
    generation,
    bornAt: typeof maybeSnail.bornAt === 'number' && Number.isFinite(maybeSnail.bornAt) ? maybeSnail.bornAt : now - 60_000,
    cooldownUntil: typeof maybeSnail.cooldownUntil === 'number' && Number.isFinite(maybeSnail.cooldownUntil) ? maybeSnail.cooldownUntil : 0,
    growthPoints,
    starter: Boolean(maybeSnail.starter)
  };
}

function sanitizeEgg(
  candidate: unknown,
  fallbackId: string,
  terrariumIds: Set<string>,
  speciesLookup: Record<string, SnailSpecies>,
  fallbackPosition: { left: number; top: number }
): SnailEgg | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const maybeEgg = candidate as Partial<SnailEgg> & Record<string, unknown>;
  const speciesId = typeof maybeEgg.speciesId === 'string' ? maybeEgg.speciesId : null;
  if (!speciesId || !speciesLookup[speciesId]) {
    return null;
  }

  const laidAt = typeof maybeEgg.laidAt === 'number' && Number.isFinite(maybeEgg.laidAt) ? maybeEgg.laidAt : Date.now();
  const hatchAt = typeof maybeEgg.hatchAt === 'number' && Number.isFinite(maybeEgg.hatchAt)
    ? Math.max(laidAt + 1_000, maybeEgg.hatchAt)
    : laidAt + 45_000;
  const accent = typeof maybeEgg.accent === 'string' && maybeEgg.accent ? maybeEgg.accent : speciesLookup[speciesId]!.accent;
  const generation = typeof maybeEgg.generation === 'number' && maybeEgg.generation > 0 ? Math.floor(maybeEgg.generation) : 1;
  const eggId = typeof maybeEgg.id === 'string' ? maybeEgg.id : fallbackId;
  const morphFallback = createSnailMorph({
    speciesId,
    accent,
    generation,
    seedText: eggId
  });

  return {
    id: eggId,
    terrariumId: typeof maybeEgg.terrariumId === 'string' && terrariumIds.has(maybeEgg.terrariumId)
      ? maybeEgg.terrariumId
      : fallbackTerrarium.id,
    parentAId: typeof maybeEgg.parentAId === 'string' ? maybeEgg.parentAId : 'unknown-parent-a',
    parentBId: typeof maybeEgg.parentBId === 'string' ? maybeEgg.parentBId : 'unknown-parent-b',
    speciesId,
    morphRarity: isMorphRarity(maybeEgg.morphRarity) ? maybeEgg.morphRarity : morphFallback.morphRarity,
    shellPattern: isShellPattern(maybeEgg.shellPattern) ? maybeEgg.shellPattern : morphFallback.shellPattern,
    shellFinish: isShellFinish(maybeEgg.shellFinish) ? maybeEgg.shellFinish : morphFallback.shellFinish,
    shellSecondary: typeof maybeEgg.shellSecondary === 'string' && maybeEgg.shellSecondary ? maybeEgg.shellSecondary : morphFallback.shellSecondary,
    bodyTint: typeof maybeEgg.bodyTint === 'string' && maybeEgg.bodyTint ? maybeEgg.bodyTint : morphFallback.bodyTint,
    auraTint: typeof maybeEgg.auraTint === 'string' && maybeEgg.auraTint ? maybeEgg.auraTint : morphFallback.auraTint,
    accent,
    patternLabel: typeof maybeEgg.patternLabel === 'string' && maybeEgg.patternLabel.trim() ? maybeEgg.patternLabel.trim() : '\uC790\uC5F0 \uBB34\uB2AC',
    generation,
    x: typeof maybeEgg.x === 'number' && Number.isFinite(maybeEgg.x) ? clamp(maybeEgg.x, 8, 92) : fallbackPosition.left,
    y: typeof maybeEgg.y === 'number' && Number.isFinite(maybeEgg.y) ? clamp(maybeEgg.y, 12, 88) : fallbackPosition.top,
    laidAt,
    hatchAt
  };
}

function normalizeBreedingSelection(storedSelection: unknown, snails: OwnedSnail[]): BreedingSelection {
  const snailIds = new Set(snails.map((snail) => snail.id));
  if (!storedSelection || typeof storedSelection !== 'object') {
    return {
      parentAId: null,
      parentBId: null
    };
  }

  const maybeSelection = storedSelection as Partial<BreedingSelection>;
  const parentAId = typeof maybeSelection.parentAId === 'string' && snailIds.has(maybeSelection.parentAId)
    ? maybeSelection.parentAId
    : null;
  const parentBId = typeof maybeSelection.parentBId === 'string' && snailIds.has(maybeSelection.parentBId) && maybeSelection.parentBId != parentAId
    ? maybeSelection.parentBId
    : null;

  return {
    parentAId,
    parentBId
  };
}

function createDefaultState(): StoredGameState {
  const starterSnails = createStarterSnailCollection();
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    selectedSnailId: starterSnails[0]?.id ?? '',
    selectedTerrariumId: fallbackTerrarium.id,
    statusMessage: defaultStatusMessage,
    balance: starterBalance,
    foodInventory: { ...starterFoodInventory },
    ownedSnails: starterSnails,
    eggs: [],
    breedingSelection: {
      parentAId: null,
      parentBId: null
    },
    rescueGiftCount: 0,
    rescueGiftCooldownUntil: 0
  };
}

function normalizeStoredState(stored: Partial<StoredGameState> | null): StoredGameState {
  const now = Date.now();
  const speciesLookup = Object.fromEntries(snailSpecies.map((species) => [species.id, species])) as Record<string, SnailSpecies>;
  const terrariumIds = new Set(starterTerrariums.map((terrarium) => terrarium.id));
  const defaultState = createDefaultState();

  if (!stored) {
    return defaultState;
  }

  let ownedSnails = Array.isArray(stored.ownedSnails)
    ? stored.ownedSnails
        .map((snail, index) => sanitizeOwnedSnail(snail, `restored-snail-${index}`, speciesLookup, now))
        .filter((snail): snail is OwnedSnail => snail !== null)
    : defaultState.ownedSnails;

  if (ownedSnails.length === 0 && (!Array.isArray(stored.eggs) || stored.eggs.length === 0)) {
    return defaultState;
  }

  const needsNameRefresh =
    new Set(ownedSnails.map((snail) => snail.name)).size !== ownedSnails.length ||
    ownedSnails.some((snail) => !snail.baseName);

  if (needsNameRefresh) {
    ownedSnails = refreshSnailIdentities(ownedSnails);
  }

  const eggs = Array.isArray(stored.eggs)
    ? stored.eggs
        .map((egg, index) => sanitizeEgg(egg, `restored-egg-${index}`, terrariumIds, speciesLookup, getEggPosition(index)))
        .filter((egg): egg is SnailEgg => egg !== null)
        .sort((left, right) => left.hatchAt - right.hatchAt)
    : [];

  const selectedSnailId = typeof stored.selectedSnailId === 'string' && ownedSnails.some((snail) => snail.id === stored.selectedSnailId)
    ? stored.selectedSnailId
    : ownedSnails[0]?.id ?? '';

  return {
    saveVersion: CURRENT_SAVE_VERSION,
    selectedSnailId,
    selectedTerrariumId: fallbackTerrarium.id,
    statusMessage:
      typeof stored.statusMessage === 'string' && stored.statusMessage.trim()
        ? stored.statusMessage.trim()
        : defaultStatusMessage,
    balance:
      typeof stored.balance === 'number' && Number.isFinite(stored.balance)
        ? Math.max(0, Math.round(stored.balance))
        : starterBalance,
    foodInventory: sanitizeFoodInventory(stored.foodInventory),
    ownedSnails,
    eggs,
    breedingSelection: normalizeBreedingSelection(stored.breedingSelection, ownedSnails),
    rescueGiftCount:
      typeof stored.rescueGiftCount === 'number' && Number.isFinite(stored.rescueGiftCount)
        ? Math.max(0, Math.floor(stored.rescueGiftCount))
        : 0,
    rescueGiftCooldownUntil:
      typeof stored.rescueGiftCooldownUntil === 'number' && Number.isFinite(stored.rescueGiftCooldownUntil)
        ? Math.max(0, stored.rescueGiftCooldownUntil)
        : 0
  };
}

function getEggPosition(index: number): { left: number; top: number } {
  const row = Math.floor(index / eggClusterColumns);
  const column = index % eggClusterColumns;
  return {
    left: 73 + column * 5.1 + row * 1.6,
    top: 13 + row * 7.4
  };
}

function getSelectionAfterToggle(previous: string[], snailId: string): string[] {
  if (previous.includes(snailId)) {
    return previous.filter((id) => id !== snailId);
  }

  if (previous.length < maximumSelection) {
    return [...previous, snailId];
  }

  return [previous[1]!, snailId];
}

function getBreedingRequirementText(selectedSnails: OwnedSnail[], growthLookup: Record<string, GrowthProfile>, now: number): string | null {
  if (selectedSnails.length !== 2) {
    return '두 마리를 골라 주세요.';
  }

  if (!selectedSnails.every((snail) => growthLookup[snail.id]?.isMature)) {
    return '성체 두 마리가 필요해요.';
  }

  const coolingSnail = selectedSnails.find((snail) => snail.cooldownUntil > now);
  if (coolingSnail) {
    return `${coolingSnail.name} 준비 중`;
  }

  return null;
}

type TerrariumSnailProps = {
  snail: OwnedSnail;
  species: SnailSpecies;
  growth: GrowthProfile;
  motion: SnailMotion;
  selected: boolean;
  focused: boolean;
  touched: boolean;
  eating: boolean;
  breeding: boolean;
  selectionOrder: number;
  clickDisabled: boolean;
  onSelect: (snailId: string) => void;
};

function TerrariumSnail({
  snail,
  species,
  growth,
  motion,
  selected,
  focused,
  touched,
  eating,
  breeding,
  selectionOrder,
  clickDisabled,
  onSelect
}: TerrariumSnailProps) {
  const rarity = getSpeciesRarityLabel(snail.speciesId);
  const scale = 0.58 + growth.scale * 0.52;
  const actorStyle = {
    left: `${motion.x}%`,
    top: `${motion.y}%`,
    zIndex: 20 + Math.round(motion.y),
    transform: `translate(-50%, -50%) rotate(${motion.heading}deg) scale(${scale})`,
    ['--shell-accent' as string]: snail.accent,
    ['--shell-secondary' as string]: snail.shellSecondary,
    ['--shell-gloss' as string]: String(growth.shellGloss),
    ['--trail-opacity' as string]: String(growth.trailOpacity),
    ['--body-opacity' as string]: String(growth.bodyOpacity),
    ['--shell-scale' as string]: String(growth.shellScale),
    ['--body-length' as string]: String(growth.bodyLength),
    ['--body-height' as string]: String(growth.bodyHeight),
    ['--antenna-scale' as string]: String(growth.antennaScale),
    ['--activity-speed' as string]: `${Math.max(4.1, 8.4 - motion.speed * 17)}s`,
    ['--glide-speed' as string]: `${Math.max(2.8, 5.4 - motion.speed * 12)}s`,
    ['--trail-length' as string]: String(0.9 + growth.trailOpacity * 0.9),
    ['--wet-gloss' as string]: String(0.22 + growth.shellGloss * 0.32),
    ['--body-stretch' as string]: String(1 + motion.speed * 1.5),
    ['--feelers-sway' as string]: `${Math.max(2.2, 4.8 - motion.speed * 9)}s`,
    ['--pattern-shift' as string]: `${(hashString(snail.id) % 11) * 3.5}deg`,
    ['--body-tint' as string]: snail.bodyTint,
    ['--aura-tint' as string]: snail.auraTint
  } satisfies CSSProperties;

  const actorClassName = [
    'snail-actor',
    `morph-${snail.morphRarity}`,
    `pattern-${snail.shellPattern}`,
    `finish-${snail.shellFinish}`
  ].join(' ');

  return (
    <div className={actorClassName} style={actorStyle}>
      <span className="snail-actor__shadow" />
      <span className="snail-actor__trail" />
      <button
        type="button"
        className={[
          'snail-hitbox',
          `snail-hitbox--${species.id}`,
          `rarity-${rarity}`,
          selected ? 'is-selected' : '',
          focused ? 'is-focused' : '',
          touched ? 'is-touched' : '',
          eating ? 'is-eating' : '',
          breeding ? 'is-breeding' : ''
        ].filter(Boolean).join(' ')}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(snail.id);
        }}
        disabled={clickDisabled}
        aria-label={`${snail.name} 선택`}
      >
        {selectionOrder > 0 ? <span className="snail-select-order">{selectionOrder}</span> : null}
        <span className="snail-shell">
          <span className="snail-shell__rim" />
          <span className="snail-shell__bands" />
          <span className="snail-shell__markings" />
          <span className="snail-shell__spiral" />
          <span className="snail-shell__core" />
          <span className="snail-shell__shine" />
          <span className="snail-shell__glow" />
        </span>
        <span className="snail-body">
          <span className="snail-body__tail" />
          <span className="snail-body__foot" />
          <span className="snail-body__torso" />
          <span className="snail-body__mantle" />
          <span className="snail-body__texture" />
          <span className="snail-body__head" />
          <span className="snail-body__mouth" />
          <span className="snail-body__feelers snail-body__feelers--left" />
          <span className="snail-body__feelers snail-body__feelers--right" />
          <span className="snail-body__eyes snail-body__eyes--left" />
          <span className="snail-body__eyes snail-body__eyes--right" />
        </span>
      </button>
    </div>
  );
}

function App() {
  const [gameState, setGameState] = useState<StoredGameState>(() => normalizeStoredState(loadStoredGameState()));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [motionMap, setMotionMap] = useState<Record<string, SnailMotion>>({});
  const [foodDrops, setFoodDrops] = useState<FoodDrop[]>([]);
  const [activeFoodType, setActiveFoodType] = useState<FoodType | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('observe');
  const [saleQuote, setSaleQuote] = useState<SaleQuote | null>(null);
  const [manualSaveInfo, setManualSaveInfo] = useState<ManualSaveSlot | null>(() => loadManualSaveSlot());
  const [breedingEffect, setBreedingEffect] = useState<{ ids: string[]; until: number } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [bgmEnabled, setBgmEnabled] = useState(() => loadBgmPreference());
  const [now, setNow] = useState(() => Date.now());

  const speciesLookup = useMemo(
    () => Object.fromEntries(snailSpecies.map((species) => [species.id, species])) as Record<string, SnailSpecies>,
    []
  );

  const ownedSnailLookup = useMemo(
    () => Object.fromEntries(gameState.ownedSnails.map((snail) => [snail.id, snail])) as Record<string, OwnedSnail>,
    [gameState.ownedSnails]
  );

  const growthLookup = useMemo(
    () => Object.fromEntries(gameState.ownedSnails.map((snail) => [snail.id, getGrowthProfile(snail, now)])) as Record<string, GrowthProfile>,
    [gameState.ownedSnails, now]
  );

  const selectedTerrarium = fallbackTerrarium;
  const selectedSnails = selectedIds.map((id) => ownedSnailLookup[id]).filter((snail): snail is OwnedSnail => Boolean(snail));
  const focusedSnail = ownedSnailLookup[gameState.selectedSnailId] ?? gameState.ownedSnails[0] ?? null;
  const focusedGrowth = focusedSnail ? growthLookup[focusedSnail.id] : null;
  const focusedSaleValue = focusedSnail && focusedGrowth ? getSnailSaleValue(focusedSnail, focusedGrowth) : null;
  const breedingRequirementText = getBreedingRequirementText(selectedSnails, growthLookup, now);
  const breedingPreview = selectedSnails.length === 2 && !breedingRequirementText
    ? getBreedingPreview(selectedSnails[0]!, selectedSnails[1]! )
    : null;
  const breedingIds = useMemo(
    () => new Set((breedingEffect && breedingEffect.until > now) ? breedingEffect.ids : []),
    [breedingEffect, now]
  );
  const modeLabel = activeFoodType
    ? `${foodCatalog[activeFoodType].label} 점 놓기`
    : interactionMode === 'breed'
      ? '교배할 두 마리 선택'
      : interactionMode === 'sell'
        ? '판매할 달팽이 선택'
        : gameState.statusMessage;

  useEffect(() => {
    setMotionMap((previous) => syncMotionMap(previous, gameState.ownedSnails));
  }, [gameState.ownedSnails]);

  useEffect(() => {
    const ownedIds = new Set(gameState.ownedSnails.map((snail) => snail.id));
    setSelectedIds((previous) => {
      const filtered = previous.filter((id) => ownedIds.has(id)).slice(0, maximumSelection);
      return arraysEqual(previous, filtered) ? previous : filtered;
    });

    if (!gameState.ownedSnails.some((snail) => snail.id === gameState.selectedSnailId)) {
      setGameState((previous) => ({
        ...previous,
        selectedSnailId: previous.ownedSnails[0]?.id ?? ''
      }));
    }
  }, [gameState.ownedSnails, gameState.selectedSnailId]);

  useEffect(() => {
    const parentAId = selectedIds[0] ?? null;
    const parentBId = selectedIds[1] ?? null;

    setGameState((previous) => {
      if (
        previous.breedingSelection.parentAId === parentAId &&
        previous.breedingSelection.parentBId === parentBId
      ) {
        return previous;
      }

      return {
        ...previous,
        breedingSelection: {
          parentAId,
          parentBId
        }
      };
    });
  }, [selectedIds]);

  useEffect(() => {
    saveStoredGameState({
      ...gameState,
      saveVersion: CURRENT_SAVE_VERSION,
      selectedTerrariumId: fallbackTerrarium.id
    });
  }, [gameState]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, clockTickMs);

    return () => window.clearInterval(timerId);
  }, []);


  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(bgmPreferenceKey, String(bgmEnabled));
  }, [bgmEnabled]);

  useEffect(() => {
    if (!bgmEnabled) {
      snailSounds.stopBgm();
      return;
    }

    const unlockAudio = (): void => {
      snailSounds.startBgm();
      snailSounds.prime();
    };

    unlockAudio();
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [bgmEnabled]);


  useEffect(() => {
    const totalFood = gameState.foodInventory.cucumber + gameState.foodInventory.carrot;
    const isLowOnResources = gameState.balance <= rescueGiftBalanceThreshold && totalFood <= rescueGiftFoodThreshold;

    if (!isLowOnResources || now < gameState.rescueGiftCooldownUntil) {
      return;
    }

    const gift = getRescueGift(gameState.rescueGiftCount);
    const nextCooldown = Date.now() + rescueGiftCooldownMs;

    snailSounds.playGiftEvent();
    setGameState((previous) => ({
      ...previous,
      balance: previous.balance + gift.balance,
      foodInventory: {
        cucumber: previous.foodInventory.cucumber + gift.cucumber,
        carrot: previous.foodInventory.carrot + gift.carrot
      },
      rescueGiftCount: previous.rescueGiftCount + 1,
      rescueGiftCooldownUntil: nextCooldown,
      statusMessage: `${gift.title} - ${gift.message}`
    }));
  }, [gameState.balance, gameState.foodInventory.carrot, gameState.foodInventory.cucumber, gameState.rescueGiftCooldownUntil, gameState.rescueGiftCount, now]);

  const hatchReadyEggs = useEffectEvent(() => {
    const currentTime = Date.now();
    const readyEggs = gameState.eggs.filter((egg) => egg.hatchAt <= currentTime);
    if (readyEggs.length === 0) {
      return;
    }

    const usedNames = new Set(gameState.ownedSnails.map((snail) => snail.name));
    const hatchlings = readyEggs.map((egg) => {
      const hatchling = hatchEgg(egg, usedNames);
      usedNames.add(hatchling.name);
      return hatchling;
    });

    snailSounds.playHatchingScene();

    startTransition(() => {
      setGameState((previous) => ({
        ...previous,
        eggs: previous.eggs.filter((egg) => egg.hatchAt > currentTime),
        ownedSnails: [...previous.ownedSnails, ...hatchlings],
        selectedSnailId: previous.selectedSnailId || hatchlings[0]?.id || '',
        statusMessage: hatchlings.length === 1
          ? `${hatchlings[0]!.name}이 깨어났어요.`
          : `${hatchlings.length}마리의 새끼 달팽이가 깨어났어요.`
      }));
    });
  });

  useEffect(() => {
    const timerId = window.setInterval(() => {
      hatchReadyEggs();
    }, clockTickMs);

    return () => window.clearInterval(timerId);
  }, [hatchReadyEggs]);

  const runMotionTick = useEffectEvent(() => {
    const currentTime = Date.now();
    const liveFoodDrops = foodDrops.filter((drop) => currentTime - drop.placedAt < foodDropLifetimeMs);
    const nextMotionMap = syncMotionMap(motionMap, gameState.ownedSnails);
    const consumedDrops = new Map<string, { snailId: string; type: FoodType; growthGain: number }>();

    for (const snail of gameState.ownedSnails) {
      const motion = nextMotionMap[snail.id]!;
      const growth = growthLookup[snail.id] ?? getGrowthProfile(snail, currentTime);
      const availableDrops = liveFoodDrops.filter((drop) => !consumedDrops.has(drop.id));
      const targetDrop = availableDrops.reduce<FoodDrop | null>((nearest, candidate) => {
        if (!nearest) {
          return candidate;
        }

        return distance(motion.x, motion.y, candidate.x, candidate.y) < distance(motion.x, motion.y, nearest.x, nearest.y)
          ? candidate
          : nearest;
      }, null);

      if (currentTime >= motion.reactionUntil && (motion.reaction === 'touch' || motion.reaction === 'eat' || motion.reaction === 'breed')) {
        motion.reaction = targetDrop ? 'seek' : 'idle';
        motion.reactionUntil = 0;
      }

      if (targetDrop) {
        motion.targetX = targetDrop.x;
        motion.targetY = targetDrop.y;
      } else if (distance(motion.x, motion.y, motion.targetX, motion.targetY) < 1.2 || currentTime >= motion.nextDecisionAt) {
        Object.assign(motion, pickWanderTarget(motion.x, motion.y));
      }

      const baseSpeed = growth.stage === 'adult'
        ? 0.07
        : growth.stage === 'subadult'
          ? 0.078
          : growth.stage === 'juvenile'
            ? 0.086
            : 0.094;

      let desiredSpeed = baseSpeed;
      if (targetDrop) {
        desiredSpeed += 0.055;
      }

      desiredSpeed *= motion.pace;

      if (motion.reaction === 'touch') {
        desiredSpeed *= 0.42;
      }

      if (motion.reaction === 'breed') {
        desiredSpeed *= 0.34;
      }

      motion.speed += (desiredSpeed - motion.speed) * (targetDrop ? 0.18 : 0.12);

      const gap = distance(motion.x, motion.y, motion.targetX, motion.targetY);
      if (gap > 0.08) {
        const step = Math.min(gap, motion.speed);
        const nextX = motion.x + ((motion.targetX - motion.x) / gap) * step;
        const nextY = motion.y + ((motion.targetY - motion.y) / gap) * step;
        const desiredHeading = getMotionHeading(motion.x, motion.y, motion.targetX, motion.targetY);
        motion.heading = interpolateAngle(motion.heading, desiredHeading, targetDrop ? 0.17 : 0.11);
        motion.x = nextX;
        motion.y = nextY;
      }

      if (targetDrop && !consumedDrops.has(targetDrop.id) && distance(motion.x, motion.y, targetDrop.x, targetDrop.y) < 2.2) {
        consumedDrops.set(targetDrop.id, {
          snailId: snail.id,
          type: targetDrop.type,
          growthGain: targetDrop.growthGain
        });
        motion.reaction = 'eat';
        motion.reactionUntil = currentTime + eatingReactionMs;
        motion.nextDecisionAt = currentTime + eatingReactionMs + 900;
      } else if (motion.reaction !== 'touch' && motion.reaction !== 'breed' && motion.reaction !== 'eat') {
        motion.reaction = targetDrop ? 'seek' : 'idle';
      }
    }

    const motionEntries = Object.entries(nextMotionMap);
    for (let leftIndex = 0; leftIndex < motionEntries.length; leftIndex += 1) {
      const [leftId, left] = motionEntries[leftIndex]!;
      for (let rightIndex = leftIndex + 1; rightIndex < motionEntries.length; rightIndex += 1) {
        const [rightId, right] = motionEntries[rightIndex]!;
        if (breedingIds.has(leftId) && breedingIds.has(rightId)) {
          continue;
        }

        const gap = distance(left.x, left.y, right.x, right.y);
        const minimumGap = 7.4;
        if (gap > 0.01 && gap < minimumGap) {
          const push = (minimumGap - gap) * 0.085;
          const pushX = ((left.x - right.x) / gap) * push;
          const pushY = ((left.y - right.y) / gap) * push;
          left.x = clamp(left.x + pushX, 8, 92);
          left.y = clamp(left.y + pushY, 12, 88);
          right.x = clamp(right.x - pushX, 8, 92);
          right.y = clamp(right.y - pushY, 12, 88);
        }
      }
    }

    const nextFoodDrops = consumedDrops.size > 0 || liveFoodDrops.length !== foodDrops.length
      ? liveFoodDrops.filter((drop) => !consumedDrops.has(drop.id))
      : foodDrops;

    startTransition(() => {
      setMotionMap(nextMotionMap);
      if (nextFoodDrops !== foodDrops) {
        setFoodDrops(nextFoodDrops);
      }
      if (consumedDrops.size > 0) {
        const gainsBySnail = new Map<string, { growth: number; type: FoodType }>();
        for (const consumedDrop of consumedDrops.values()) {
          const previous = gainsBySnail.get(consumedDrop.snailId);
          gainsBySnail.set(consumedDrop.snailId, {
            growth: (previous?.growth ?? 0) + consumedDrop.growthGain,
            type: consumedDrop.type
          });
        }

        const firstGain = [...gainsBySnail.entries()][0];
        const targetSnailName = firstGain ? ownedSnailLookup[firstGain[0]]?.name ?? null : null;
        const targetFoodType = firstGain ? firstGain[1].type : null;

        snailSounds.playFeedAction();
        setGameState((previous) => ({
          ...previous,
          ownedSnails: previous.ownedSnails.map((snail) => {
            const gain = gainsBySnail.get(snail.id);
            if (!gain) {
              return snail;
            }

            return {
              ...snail,
              growthPoints: Math.max(0, snail.growthPoints + gain.growth)
            };
          }),
          statusMessage: targetSnailName && targetFoodType
            ? `${targetSnailName}가 ${foodCatalog[targetFoodType].label} 점을 먹었어요.`
            : '달팽이가 먹이를 먹었어요.'
        }));
      }
    });
  });

  useEffect(() => {
    const timerId = window.setInterval(() => {
      runMotionTick();
    }, motionTickMs);

    return () => window.clearInterval(timerId);
  }, [runMotionTick]);

  useEffect(() => {
    if (breedingEffect && breedingEffect.until <= now) {
      setBreedingEffect(null);
    }
  }, [breedingEffect, now]);

  useEffect(() => {
    setSaleQuote(null);
  }, [selectedIds]);

  const setStatusMessage = (message: string): void => {
    setGameState((previous) => previous.statusMessage === message ? previous : { ...previous, statusMessage: message });
  };

  const triggerTouchReaction = (snailId: string): void => {
    snailSounds.playTouchAction();
    setMotionMap((previous) => {
      const next = syncMotionMap(previous, gameState.ownedSnails);
      const motion = next[snailId];
      if (motion) {
        motion.reaction = 'touch';
        motion.reactionUntil = Date.now() + touchReactionMs;
        const nextTarget = pickWanderTarget(motion.x, motion.y);
        motion.targetX = nextTarget.targetX;
        motion.targetY = nextTarget.targetY;
        motion.nextDecisionAt = nextTarget.nextDecisionAt;
      }
      return next;
    });
  };

  const resetModes = (nextStatus?: string): void => {
    setInteractionMode('observe');
    setActiveFoodType(null);
    setSelectedIds([]);
    if (nextStatus) {
      setStatusMessage(nextStatus);
    }
  };


  const handleToggleBgm = (): void => {
    snailSounds.playUiTap();
    setBgmEnabled((previous) => {
      const next = !previous;
      if (!next) {
        snailSounds.stopBgm();
      } else {
        snailSounds.startBgm();
        snailSounds.prime();
      }
      return next;
    });
  };


  const handleOpenGuide = (): void => {
    snailSounds.playUiTap();
    setGuideOpen(true);
  };

  const handleCloseGuide = (): void => {
    snailSounds.playUiTap();
    setGuideOpen(false);
  };

  const handleSnailSelect = (snailId: string): void => {
    const snail = ownedSnailLookup[snailId];
    if (!snail) {
      return;
    }

    setGameState((previous) => previous.selectedSnailId === snailId ? previous : { ...previous, selectedSnailId: snailId });

    if (interactionMode === 'sell') {
      const quote = getSnailSaleValue(snail, growthLookup[snailId]!);
      snailSounds.playSoftSelect();
      setSaleQuote({ ids: [snailId], total: quote });
      setStatusMessage(`${snail.name} 판매 가격 ${formatCurrency(quote)}`);
      return;
    }

    if (interactionMode === 'breed') {
      snailSounds.playSoftSelect();
      setSelectedIds((previous) => {
        const next = getSelectionAfterToggle(previous, snailId);
        if (next.length === 0) {
          setStatusMessage('교배할 첫 번째 달팽이를 골라 주세요.');
        } else if (next.length === 1) {
          setStatusMessage(`${snail.name}를 첫 부모로 골랐어요.`);
        } else {
          const leftId = next[0];
          const rightId = next[1];
          const leftName = leftId ? ownedSnailLookup[leftId]?.name ?? '첫 번째' : '첫 번째';
          const rightName = rightId ? ownedSnailLookup[rightId]?.name ?? '두 번째' : '두 번째';
          setStatusMessage(`${leftName}와 ${rightName}를 교배할 수 있어요.`);
        }
        return next;
      });
      return;
    }

    triggerTouchReaction(snailId);
    setStatusMessage(`${snail.name}가 더듬이를 움찔했어요.`);
  };

  const handleChooseFoodType = (foodType: FoodType): void => {
    if (activeFoodType === foodType) {
      setActiveFoodType(null);
      setStatusMessage('먹이 선택을 닫았어요.');
      return;
    }

    if (gameState.foodInventory[foodType] <= 0) {
      snailSounds.playBlocked();
      setStatusMessage(`${foodCatalog[foodType].label}이 부족해요. 아래 충전 버튼으로 채워 주세요.`);
      return;
    }

    snailSounds.playSoftSelect();
    setInteractionMode('observe');
    setSelectedIds([]);
    setActiveFoodType(foodType);
    setStatusMessage(`${foodCatalog[foodType].label} 점을 놓을 자리를 터치하세요.`);
  };

  const handleTerrariumClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (!activeFoodType) {
      return;
    }

    if (gameState.foodInventory[activeFoodType] <= 0) {
      snailSounds.playBlocked();
      setStatusMessage(`${foodCatalog[activeFoodType].label}이 부족해요.`);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 6, 94);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 10, 90);
    const option = foodCatalog[activeFoodType];
    const foodDrop: FoodDrop = {
      id: createEntityId('food'),
      type: activeFoodType,
      x,
      y,
      growthGain: option.growthGain,
      placedAt: Date.now()
    };

    snailSounds.playFeedAction();
    setFoodDrops((previous) => [...previous, foodDrop].slice(-10));
    setGameState((previous) => ({
      ...previous,
      foodInventory: {
        ...previous.foodInventory,
        [activeFoodType]: Math.max(0, previous.foodInventory[activeFoodType] - 1)
      },
      statusMessage: `${option.label} 점을 놓았어요.`
    }));
  };

  const handleBuyBundle = (foodType: FoodType): void => {
    const bundle = foodShopBundles[foodType];
    if (gameState.balance < bundle.cost) {
      snailSounds.playBlocked();
      setStatusMessage('포인트가 부족해요.');
      return;
    }

    snailSounds.playUiTap();
    setInteractionMode('observe');
    setActiveFoodType(foodType);
    setGameState((previous) => ({
      ...previous,
      balance: previous.balance - bundle.cost,
      foodInventory: {
        ...previous.foodInventory,
        [foodType]: previous.foodInventory[foodType] + bundle.quantity
      },
      statusMessage: `${bundle.label}을 채웠어요. 원하는 곳에 바로 놓아 보세요.`
    }));
  };

  const handleToggleBreedMode = (): void => {
    if (interactionMode === 'breed') {
      resetModes('교배 선택을 닫았어요.');
      return;
    }

    snailSounds.playUiTap();
    setInteractionMode('breed');
    setActiveFoodType(null);
    setSaleQuote(null);
    setSelectedIds([]);
    setStatusMessage('교배할 달팽이 두 마리를 차례로 눌러 주세요.');
  };

  const handleToggleSellMode = (): void => {
    if (interactionMode === 'sell') {
      resetModes('판매 선택을 닫았어요.');
      return;
    }

    snailSounds.playUiTap();
    setInteractionMode('sell');
    setActiveFoodType(null);
    setSelectedIds([]);
    setSaleQuote(null);
    setStatusMessage('판매할 달팽이를 눌러 가격을 확인하세요.');
  };

  const handleBreedSelected = (): void => {
    if (breedingRequirementText || selectedSnails.length !== 2) {
      snailSounds.playBlocked();
      setStatusMessage(breedingRequirementText ?? '두 마리를 골라 주세요.');
      return;
    }

    const [parentA, parentB] = selectedSnails;
    const currentTime = Date.now();
    const seededMotionMap = syncMotionMap(motionMap, gameState.ownedSnails);
    const leftMotion = seededMotionMap[parentA!.id];
    const rightMotion = seededMotionMap[parentB!.id];
    const eggPosition = leftMotion && rightMotion
      ? {
          x: (leftMotion.x + rightMotion.x) / 2,
          y: (leftMotion.y + rightMotion.y) / 2
        }
      : { x: 50, y: 48 };
    const breedingResult = createEggFromParents(parentA!, parentB!, fallbackTerrarium.id, eggPosition);

    snailSounds.playBreedingStart();
    snailSounds.playLayingScene();
    setBreedingEffect({
      ids: [parentA!.id, parentB!.id],
      until: currentTime + breedingReactionMs
    });
    setMotionMap(() => {
      const next = Object.fromEntries(
        Object.entries(seededMotionMap).map(([snailId, motion]) => [snailId, { ...motion }])
      ) as Record<string, SnailMotion>;
      const left = next[parentA!.id];
      const right = next[parentB!.id];
      if (left && right) {
        const midpointX = eggPosition.x;
        const midpointY = eggPosition.y;
        left.targetX = midpointX - 1.5;
        left.targetY = midpointY;
        left.reaction = 'breed';
        left.reactionUntil = currentTime + breedingReactionMs;
        right.targetX = midpointX + 1.5;
        right.targetY = midpointY;
        right.reaction = 'breed';
        right.reactionUntil = currentTime + breedingReactionMs;
      }
      return next;
    });
    setSelectedIds([]);
    setInteractionMode('observe');
    setGameState((previous) => ({
      ...previous,
      eggs: [...previous.eggs, breedingResult.egg].sort((left, right) => left.hatchAt - right.hatchAt),
      ownedSnails: previous.ownedSnails.map((snail) => (
        snail.id === parentA!.id || snail.id === parentB!.id
          ? { ...snail, cooldownUntil: currentTime + breedingResult.cooldownMs }
          : snail
      )),
      statusMessage: `${parentA!.name}와 ${parentB!.name} 사이에 알이 생겼어요.`
    }));
  };

  const handleConfirmSale = (): void => {
    if (!saleQuote) {
      return;
    }

    const saleTargets = saleQuote.ids.map((id) => ownedSnailLookup[id]).filter((snail): snail is OwnedSnail => Boolean(snail));
    if (saleTargets.length === 0) {
      setSaleQuote(null);
      return;
    }

    if (gameState.ownedSnails.length - saleTargets.length < 1 && gameState.eggs.length === 0) {
      snailSounds.playBlocked();
      setStatusMessage('마지막 달팽이는 남겨 둬야 해요.');
      return;
    }

    const soldNames = saleTargets.map((snail) => snail.name).join(', ');
    const soldIds = new Set(saleTargets.map((snail) => snail.id));
    const nextOwnedSnails = gameState.ownedSnails.filter((snail) => !soldIds.has(snail.id));
    const nextFocusId = nextOwnedSnails[0]?.id ?? '';

    snailSounds.playUiTap();
    setSaleQuote(null);
    setInteractionMode('observe');
    setFoodDrops([]);
    setSelectedIds([]);
    setGameState((previous) => ({
      ...previous,
      balance: previous.balance + saleQuote.total,
      ownedSnails: previous.ownedSnails.filter((snail) => !soldIds.has(snail.id)),
      selectedSnailId: nextFocusId,
      breedingSelection: {
        parentAId: null,
        parentBId: null
      },
      statusMessage: `${soldNames} 판매 완료 · ${formatCurrency(saleQuote.total)}`
    }));
  };

  const handleSaveGame = (): void => {
    const snapshot = cloneStoredState({
      ...gameState,
      saveVersion: CURRENT_SAVE_VERSION,
      selectedTerrariumId: fallbackTerrarium.id
    });
    const slot = {
      savedAt: Date.now(),
      state: snapshot
    } satisfies ManualSaveSlot;

    saveManualSaveSlot(slot);
    setManualSaveInfo(slot);
    snailSounds.playUiTap();
    setStatusMessage('현재 상태를 세이브했어요.');
  };

  const handleLoadGame = (): void => {
    const slot = loadManualSaveSlot();
    if (!slot) {
      snailSounds.playBlocked();
      setStatusMessage('불러올 세이브가 아직 없어요.');
      return;
    }

    const restored = normalizeStoredState(slot.state);
    setManualSaveInfo(slot);
    setSaleQuote(null);
    setInteractionMode('observe');
    setSelectedIds([]);
    setActiveFoodType(null);
    setFoodDrops([]);
    setMotionMap(syncMotionMap({}, restored.ownedSnails));
    setGameState({
      ...restored,
      selectedTerrariumId: fallbackTerrarium.id,
      statusMessage: `세이브를 불러왔어요 · ${formatSavedAt(slot.savedAt)}`
    });
    snailSounds.playUiTap();
  };

  return (
    <div className={`koi-shell koi-shell--${selectedTerrarium.id}`}>
      <main className={`terrarium-stage terrarium-stage--${selectedTerrarium.id} ${activeFoodType ? 'is-feed-mode' : ''}`} onClick={handleTerrariumClick}>
        <div className="terrarium-fog" />
        <div className="terrarium-caustics terrarium-caustics--one" />
        <div className="terrarium-caustics terrarium-caustics--two" />
        <div className="terrarium-glass-noise" />
        <div className="terrarium-vignette" />
        <div className="terrarium-shine" />
        <div className="terrarium-rim terrarium-rim--top" />
        <div className="terrarium-rim terrarium-rim--bottom" />
        <div className="terrain-patch terrain-patch--one" />
        <div className="terrain-patch terrain-patch--two" />
        <div className="terrain-patch terrain-patch--three" />
        <div className="terrain-stone terrain-stone--one" />
        <div className="terrain-stone terrain-stone--two" />
        <div className="terrain-stone terrain-stone--three" />
        <div className="terrain-leaf terrain-leaf--one" />
        <div className="terrain-leaf terrain-leaf--two" />
        <div className="terrain-leaf terrain-leaf--three" />
        <div className="brand-floating">
          <strong>달팽이 농장</strong>
          <span>tipsysnail garden</span>
        </div>
                <button
          type="button"
          className="guide-toggle"
          onClick={(event) => {
            event.stopPropagation();
            handleOpenGuide();
          }}
        >
          {'\uC774\uC6A9\uBC29\uBC95'}
        </button>
        <div className="balance-floating">{formatCurrency(gameState.balance)}</div>
        <button
          type="button"
          className={`bgm-toggle ${bgmEnabled ? 'is-on' : 'is-off'}`}
          aria-pressed={bgmEnabled}
          onClick={(event) => {
            event.stopPropagation();
            handleToggleBgm();
          }}
        >
          {bgmEnabled ? 'BGM ON' : 'BGM OFF'}
        </button>
        <div className="scene-caption">{modeLabel}</div>
        {activeFoodType ? <div className="feed-cursor-hint">{foodCatalog[activeFoodType].label}</div> : null}
        {interactionMode === 'sell' ? <div className="mode-pill mode-pill--sell">판매 모드</div> : null}
        {interactionMode === 'breed' ? <div className="mode-pill mode-pill--breed">교배 모드</div> : null}
        {breedingEffect && breedingEffect.until > now ? <div className="breeding-bloom" /> : null}

        <div className="egg-cluster" aria-label="달팽이 알">
          {gameState.eggs.map((egg) => {
            const eggProgress = clamp((now - egg.laidAt) / Math.max(1, egg.hatchAt - egg.laidAt), 0, 1);
            const eggStyle = {
              ...getEggVisualStyle(egg),
              left: `${egg.x}%`,
              top: `${egg.y}%`,
              ['--egg-progress' as string]: String(eggProgress),
              ['--egg-wobble-delay' as string]: `${((hashString(egg.id) % 7) * 0.11).toFixed(2)}s`
            } satisfies CSSProperties;

            const eggClassName = [
              'egg-orb',
              eggProgress >= 0.82 ? 'is-rattling' : eggProgress >= 0.56 ? 'is-stirring' : ''
            ].filter(Boolean).join(' ');

            return <span key={egg.id} className={eggClassName} style={eggStyle} />;
          })}
        </div>

        <div className="food-layer" aria-label="놓인 먹이 점">
          {foodDrops.map((drop) => {
            const dropStyle = {
              left: `${drop.x}%`,
              top: `${drop.y}%`
            } satisfies CSSProperties;

            return <span key={drop.id} className={`food-drop food-drop--${drop.type}`} style={dropStyle} />;
          })}
        </div>

        <div className="snail-layer">
          {gameState.ownedSnails.map((snail, index) => {
            const motion = motionMap[snail.id] ?? createMotionSeed(snail.id, index);
            const growth = growthLookup[snail.id] ?? getGrowthProfile(snail, now);
            const species = speciesLookup[snail.speciesId] ?? snailSpecies[0]!;
            const isFocused = focusedSnail?.id === snail.id;
            const selectionOrder = selectedIds.indexOf(snail.id) + 1;
            const isSelected = selectionOrder > 0;
            const isTouched = motion.reaction === 'touch' && motion.reactionUntil > now;
            const isEating = motion.reaction === 'eat' && motion.reactionUntil > now;
            const isBreeding = breedingIds.has(snail.id) || (motion.reaction === 'breed' && motion.reactionUntil > now);

            return (
              <TerrariumSnail
                key={snail.id}
                snail={snail}
                species={species}
                growth={growth}
                motion={motion}
                selected={isSelected}
                focused={isFocused}
                touched={isTouched}
                eating={isEating}
                breeding={isBreeding}
                selectionOrder={selectionOrder}
                clickDisabled={Boolean(activeFoodType)}
                onSelect={handleSnailSelect}
              />
            );
          })}
        </div>

        {focusedSnail && focusedGrowth && focusedSaleValue !== null ? (
          <section className="snail-info-card" aria-label={'선택한 달팽이 정보'}>
            <strong>{focusedSnail.name}</strong>
            <div className="snail-info-card__meta">
              <span className="snail-info-card__stage">{focusedGrowth.label}</span>
              <span className="snail-info-card__price">{'판매가'} {formatCurrency(focusedSaleValue)}</span>
            </div>
          </section>
        ) : null}

      </main>

      {interactionMode === 'breed' ? (
        <section className="breed-tray" onClick={(event) => event.stopPropagation()}>
          <div className="breed-tray__head">
            <strong>교배 조합</strong>
            <button type="button" className="breed-tray__close" onClick={() => resetModes('교배 선택을 취소했어요.')}>닫기</button>
          </div>
          <div className="breed-tray__names">
            <span>{selectedSnails[0]?.name ?? '첫 번째 달팽이'}</span>
            <span>{selectedSnails[1]?.name ?? '두 번째 달팽이'}</span>
          </div>
          <div className="breed-tray__hint">
            {breedingPreview
              ? `레어 ${Math.round(breedingPreview.rareChance * 100)}% · 부화 ${formatShortDuration(breedingPreview.hatchDurationMs)}`
              : breedingRequirementText ?? '두 마리를 고르면 바로 교배할 수 있어요.'}
          </div>
          <div className="breed-tray__actions">
            <button type="button" className="action-button action-button--ghost" onClick={() => resetModes('교배 선택을 취소했어요.')}>취소</button>
            <button type="button" className="action-button" onClick={handleBreedSelected} disabled={Boolean(breedingRequirementText)}>교배 시작</button>
          </div>
        </section>
      ) : null}

      <section className="control-ribbon">
        <div className="supply-rack">
          {(Object.keys(foodCatalog) as FoodType[]).map((foodType) => {
            const option = foodCatalog[foodType];
            const bundle = foodShopBundles[foodType];
            const selected = activeFoodType === foodType;

            return (
              <article key={foodType} className={`supply-card supply-card--${foodType} ${selected ? 'is-active' : ''}`}>
                <button type="button" className="supply-card__pick" onClick={() => handleChooseFoodType(foodType)}>
                  <span className={`supply-dot supply-dot--${foodType}`} />
                  <strong>{option.label}</strong>
                  <em>{gameState.foodInventory[foodType]}</em>
                </button>
                <button type="button" className="supply-card__buy" onClick={() => handleBuyBundle(foodType)}>
                  {bundle.quantity > 1 ? `+${bundle.quantity}` : '+1'} · {formatCurrency(bundle.cost)}
                </button>
              </article>
            );
          })}
        </div>

        <div className="control-groups">
          <article className={`mode-cluster mode-cluster--action ${interactionMode !== 'observe' ? 'is-highlighted' : ''}`}>
            <div className="mode-cluster__head">
              <strong>행동</strong>
              <span>
                {interactionMode === 'breed'
                  ? '두 마리 선택 중'
                  : interactionMode === 'sell'
                    ? '판매 대상 고르는 중'
                    : '교배와 판매'}
              </span>
            </div>
            <div className="mode-rack mode-rack--action">
              <button type="button" className={interactionMode === "breed" ? "is-active" : ""} onClick={handleToggleBreedMode}>교배</button>
              <button type="button" className={interactionMode === "sell" ? "is-active" : ""} onClick={handleToggleSellMode}>판매</button>
            </div>
          </article>

          <article className="mode-cluster mode-cluster--save">
            <div className="mode-cluster__head">
              <strong>보관</strong>
              <span>{manualSaveInfo ? `최근 ${formatSavedAt(manualSaveInfo.savedAt)}` : '원하는 시점 저장'}</span>
            </div>
            <div className="mode-rack mode-rack--save">
              <button type="button" onClick={handleSaveGame}>세이브</button>
              <button type="button" onClick={handleLoadGame}>불러오기</button>
            </div>
          </article>
        </div>
      </section>

      {guideOpen ? (
        <div className="overlay-backdrop" role="presentation" onClick={handleCloseGuide}>
          <section className="guide-modal" role="dialog" aria-modal="true" aria-label={'\uC774\uC6A9\uBC29\uBC95'} onClick={(event) => event.stopPropagation()}>
            <div className="guide-modal__head">
              <strong>{'\uC774\uC6A9\uBC29\uBC95'}</strong>
              <button type="button" className="guide-modal__close" onClick={handleCloseGuide}>{'\uB2EB\uAE30'}</button>
            </div>
            <div className="guide-modal__grid">
              <section>
                <strong>{'\uAE30\uBCF8 \uD750\uB984'}</strong>
                <ul>
                  <li>{'\uC624\uC774\uC640 \uB2F9\uADFC\uC744 \uC0AC\uC11C \uD14C\uB77C\uB9AC\uC6C0\uC5D0 \uB193\uC544 \uB2EC\uD33D\uC774\uB97C \uD0A4\uC6CC \uC8FC\uC138\uC694.'}</li>
                  <li>{'\uC131\uC7A5\uD55C \uB2EC\uD33D\uC774\uB294 \uAD50\uBC30\uD558\uAC70\uB098 \uD310\uB9E4\uD574 \uD3EC\uC778\uD2B8\uB97C \uC313\uC744 \uC218 \uC788\uC5B4\uC694.'}</li>
                  <li>{'\uC54C\uC740 \uC2DC\uAC04\uC774 \uC9C0\uB098\uBA74 \uC790\uB3D9\uC73C\uB85C \uBD80\uD654\uD569\uB2C8\uB2E4.'}</li>
                </ul>
              </section>
              <section>
                <strong>{'\uC870\uC791 \uBC29\uBC95'}</strong>
                <ul>
                  <li>{'\uBA39\uC774 \uCE74\uB4DC\uB97C \uB204\uB974\uACE0 \uD654\uBA74\uC744 \uD130\uCE58\uD558\uBA74 \uB2EC\uD33D\uC774\uAC00 \uADF8 \uACF3\uC73C\uB85C \uC774\uB3D9\uD574\uC694.'}</li>
                  <li>{'\uAD50\uBC30 \uBAA8\uB4DC\uC5D0\uC11C \uB2EC\uD33D\uC774 \uB450 \uB9C8\uB9AC\uB97C \uCC28\uB840\uB85C \uB20C\uB7EC \uC870\uD569\uD574 \uC8FC\uC138\uC694.'}</li>
                  <li>{'\uD310\uB9E4 \uBAA8\uB4DC\uC5D0\uC11C \uB2EC\uD33D\uC774\uB97C \uB20C\uB7EC \uAC00\uACA9\uC744 \uD655\uC778\uD558\uACE0 \uCC98\uBD84\uD560 \uC218 \uC788\uC5B4\uC694.'}</li>
                </ul>
              </section>
              <section>
                <strong>{'\uC124\uC815 \uAC00\uC774\uB4DC'}</strong>
                <ul>
                  <li>{'\uC624\uB978\uCABD \uC0C1\uB2E8 BGM \uBC84\uD2BC\uC73C\uB85C \uBC30\uACBD\uC74C\uC744 ON/OFF \uD560 \uC218 \uC788\uC5B4\uC694.'}</li>
                  <li>{'\uC138\uC774\uBE0C\uC640 \uBD88\uB7EC\uC624\uAE30\uB85C \uC6D0\uD558\uB294 \uC9C0\uC810\uC744 \uBCF4\uAD00\uD558\uC138\uC694.'}</li>
                  <li>{'\uB3C8\uACFC \uBA39\uC774\uAC00 \uBC14\uB2E5\uB098\uBA74 \uAC00\uB054 \uC791\uC740 \uC120\uBB3C \uC774\uBCA4\uD2B8\uAC00 \uB3C4\uC640\uC918 \uD50C\uB808\uC774\uAC00 \uB04A\uAE30\uC9C0 \uC54A\uAC8C \uD574\uC918\uC694.'}</li>
                </ul>
              </section>
            </div>
          </section>
        </div>
      ) : null}

      {saleQuote ? (
        <div className="overlay-backdrop" role="presentation" onClick={() => setSaleQuote(null)}>
          <section className="sale-modal" role="dialog" aria-modal="true" aria-label="달팽이 판매" onClick={(event) => event.stopPropagation()}>
            <strong>판매 확인</strong>
            <p>{formatCurrency(saleQuote.total)}를 받고 판매할까요?</p>
            <div className="sale-modal__names">
              {saleQuote.ids.map((id) => ownedSnailLookup[id]?.name).filter(Boolean).join(' · ')}
            </div>
            <div className="sale-modal__actions">
              <button type="button" className="action-button action-button--ghost" onClick={() => setSaleQuote(null)}>
                취소
              </button>
              <button type="button" className="action-button" onClick={handleConfirmSale}>
                판매
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default App;

