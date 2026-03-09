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
  adultGrowthGoalPoints,
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

type MotionReaction = 'idle' | 'seek' | 'touch' | 'eat' | 'breed';

type SnailMotion = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  heading: number;
  speed: number;
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
  clickDisabled: boolean;
  onSelect: (snailId: string) => void;
};

const CURRENT_SAVE_VERSION = 8;
const defaultStatusMessage = '달팽이를 눌러 고르거나, 먹이를 골라 테라리움에 떨어뜨려 주세요.';
const fallbackTerrarium = starterTerrariums[0]!;
const motionTickMs = 120;
const clockTickMs = 1000;
const touchReactionMs = 1500;
const breedingReactionMs = 2600;
const eatingReactionMs = 1800;
const foodDropLifetimeMs = 30_000;
const maximumSelection = 2;
const eggClusterColumns = 4;

const rarityToneLabel = {
  common: '기본',
  rare: '레어',
  epic: '에픽'
} as const;

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
  const x = 12 + (seed * 37) % 76;
  const y = 16 + (seed * 53) % 66;
  const targetX = clamp(x + ((seed % 19) - 9), 8, 92);
  const targetY = clamp(y + (((seed * 3) % 17) - 8), 12, 88);

  return {
    x,
    y,
    targetX,
    targetY,
    heading: seed % 360,
    speed: 0.18,
    nextDecisionAt: Date.now() + 1500 + (seed % 2200),
    reaction: 'idle',
    reactionUntil: 0
  };
}

function syncMotionMap(previous: Record<string, SnailMotion>, snails: OwnedSnail[]): Record<string, SnailMotion> {
  return Object.fromEntries(
    snails.map((snail, index) => [snail.id, previous[snail.id] ?? createMotionSeed(snail.id, index)])
  );
}

function pickWanderTarget(currentX: number, currentY: number): Pick<SnailMotion, 'targetX' | 'targetY' | 'nextDecisionAt'> {
  return {
    targetX: clamp(currentX + (Math.random() - 0.5) * 26, 8, 92),
    targetY: clamp(currentY + (Math.random() - 0.5) * 22, 12, 88),
    nextDecisionAt: Date.now() + 2200 + Math.round(Math.random() * 4200)
  };
}

function getMotionHeading(fromX: number, fromY: number, toX: number, toY: number): number {
  return Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI) + 90;
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
  const fallbackName = typeof species.name === 'string' && species.name.trim() ? species.name.trim() : '달팽이';
  const name = typeof maybeSnail.name === 'string' && maybeSnail.name.trim() ? maybeSnail.name.trim() : fallbackName;
  const growthPoints = typeof maybeSnail.growthPoints === 'number' && Number.isFinite(maybeSnail.growthPoints)
    ? Math.max(0, Math.round(maybeSnail.growthPoints))
    : 0;

  return {
    id: typeof maybeSnail.id === 'string' ? maybeSnail.id : fallbackId,
    name,
    baseName: typeof maybeSnail.baseName === 'string' && maybeSnail.baseName.trim() ? maybeSnail.baseName.trim() : name,
    rarePrefix: typeof maybeSnail.rarePrefix === 'string' && maybeSnail.rarePrefix.trim() ? maybeSnail.rarePrefix.trim() : null,
    speciesId,
    accent: typeof maybeSnail.accent === 'string' && maybeSnail.accent ? maybeSnail.accent : species.accent,
    patternLabel: typeof maybeSnail.patternLabel === 'string' && maybeSnail.patternLabel.trim() ? maybeSnail.patternLabel.trim() : '자연 무늬',
    generation: typeof maybeSnail.generation === 'number' && maybeSnail.generation > 0 ? Math.floor(maybeSnail.generation) : 1,
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
  speciesLookup: Record<string, SnailSpecies>
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

  return {
    id: typeof maybeEgg.id === 'string' ? maybeEgg.id : fallbackId,
    terrariumId: typeof maybeEgg.terrariumId === 'string' && terrariumIds.has(maybeEgg.terrariumId)
      ? maybeEgg.terrariumId
      : fallbackTerrarium.id,
    parentAId: typeof maybeEgg.parentAId === 'string' ? maybeEgg.parentAId : 'unknown-parent-a',
    parentBId: typeof maybeEgg.parentBId === 'string' ? maybeEgg.parentBId : 'unknown-parent-b',
    speciesId,
    accent: typeof maybeEgg.accent === 'string' && maybeEgg.accent ? maybeEgg.accent : speciesLookup[speciesId]!.accent,
    patternLabel: typeof maybeEgg.patternLabel === 'string' && maybeEgg.patternLabel.trim() ? maybeEgg.patternLabel.trim() : '자연 무늬',
    generation: typeof maybeEgg.generation === 'number' && maybeEgg.generation > 0 ? Math.floor(maybeEgg.generation) : 1,
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
  const parentBId = typeof maybeSelection.parentBId === 'string' && snailIds.has(maybeSelection.parentBId) && maybeSelection.parentBId !== parentAId
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
    }
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
        .map((egg, index) => sanitizeEgg(egg, `restored-egg-${index}`, terrariumIds, speciesLookup))
        .filter((egg): egg is SnailEgg => egg !== null)
        .sort((left, right) => left.hatchAt - right.hatchAt)
    : [];

  const selectedSnailId = typeof stored.selectedSnailId === 'string' && ownedSnails.some((snail) => snail.id === stored.selectedSnailId)
    ? stored.selectedSnailId
    : ownedSnails[0]?.id ?? '';

  return {
    saveVersion: CURRENT_SAVE_VERSION,
    selectedSnailId,
    selectedTerrariumId:
      typeof stored.selectedTerrariumId === 'string' && terrariumIds.has(stored.selectedTerrariumId)
        ? stored.selectedTerrariumId
        : fallbackTerrarium.id,
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
    breedingSelection: normalizeBreedingSelection(stored.breedingSelection, ownedSnails)
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
  clickDisabled,
  onSelect
}: TerrariumSnailProps) {
  const rarity = getSpeciesRarityLabel(snail.speciesId);
  const scale = 0.64 + growth.scale * 0.56;
  const actorStyle = {
    left: `${motion.x}%`,
    top: `${motion.y}%`,
    zIndex: 20 + Math.round(motion.y),
    transform: `translate(-50%, -50%) rotate(${motion.heading}deg) scale(${scale})`,
    ['--shell-accent' as string]: snail.accent,
    ['--shell-gloss' as string]: String(growth.shellGloss),
    ['--trail-opacity' as string]: String(growth.trailOpacity),
    ['--body-opacity' as string]: String(growth.bodyOpacity),
    ['--shell-scale' as string]: String(growth.shellScale),
    ['--body-length' as string]: String(growth.bodyLength),
    ['--body-height' as string]: String(growth.bodyHeight),
    ['--antenna-scale' as string]: String(growth.antennaScale),
    ['--activity-speed' as string]: `${Math.max(3.4, 7 - motion.speed * 10)}s`
  } satisfies CSSProperties;

  return (
    <div className="snail-actor" style={actorStyle}>
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
        <span className="snail-shell">
          <span className="snail-shell__rim" />
          <span className="snail-shell__spiral" />
          <span className="snail-shell__shine" />
        </span>
        <span className="snail-body">
          <span className="snail-body__tail" />
          <span className="snail-body__torso" />
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
  const [shopOpen, setShopOpen] = useState(false);
  const [feedMenuOpen, setFeedMenuOpen] = useState(false);
  const [activeFoodType, setActiveFoodType] = useState<FoodType | null>(null);
  const [saleQuote, setSaleQuote] = useState<SaleQuote | null>(null);
  const [manualSaveInfo, setManualSaveInfo] = useState<ManualSaveSlot | null>(() => loadManualSaveSlot());
  const [breedingEffect, setBreedingEffect] = useState<{ ids: string[]; until: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const speciesLookup = useMemo(
    () => Object.fromEntries(snailSpecies.map((species) => [species.id, species])) as Record<string, SnailSpecies>,
    []
  );

  const terrariumLookup = useMemo(
    () => Object.fromEntries(starterTerrariums.map((terrarium) => [terrarium.id, terrarium])),
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

  const selectedTerrarium = terrariumLookup[gameState.selectedTerrariumId] ?? fallbackTerrarium;
  const selectedSnails = selectedIds.map((id) => ownedSnailLookup[id]).filter((snail): snail is OwnedSnail => Boolean(snail));
  const focusedSnail = ownedSnailLookup[selectedIds[selectedIds.length - 1] ?? gameState.selectedSnailId] ?? gameState.ownedSnails[0] ?? null;
  const focusedGrowth = focusedSnail ? growthLookup[focusedSnail.id] : null;
  const soonestEgg = gameState.eggs[0] ?? null;
  const breedingRequirementText = getBreedingRequirementText(selectedSnails, growthLookup, now);
  const breedingPreview = selectedSnails.length === 2 && !breedingRequirementText
    ? getBreedingPreview(selectedSnails[0]!, selectedSnails[1]! )
    : null;
  const salePreviewTotal = selectedSnails.reduce((sum, snail) => sum + getSnailSaleValue(snail, growthLookup[snail.id]!), 0);
  const breedingIds = useMemo(
    () => new Set((breedingEffect && breedingEffect.until > now) ? breedingEffect.ids : []),
    [breedingEffect, now]
  );

  useEffect(() => {
    setMotionMap((previous) => syncMotionMap(previous, gameState.ownedSnails));
  }, [gameState.ownedSnails]);

  useEffect(() => {
    const ownedIds = new Set(gameState.ownedSnails.map((snail) => snail.id));
    setSelectedIds((previous) => {
      const filtered = previous.filter((id) => ownedIds.has(id)).slice(0, maximumSelection);
      if (filtered.length > 0) {
        return arraysEqual(filtered, previous) ? previous : filtered;
      }

      const fallback = gameState.selectedSnailId && ownedIds.has(gameState.selectedSnailId)
        ? [gameState.selectedSnailId]
        : gameState.ownedSnails[0]
          ? [gameState.ownedSnails[0].id]
          : [];

      return arraysEqual(previous, fallback) ? previous : fallback;
    });
  }, [gameState.ownedSnails, gameState.selectedSnailId]);

  useEffect(() => {
    const parentAId = selectedIds[0] ?? null;
    const parentBId = selectedIds[1] ?? null;
    const focusId = selectedIds[selectedIds.length - 1] ?? gameState.selectedSnailId;

    setGameState((previous) => {
      const nextFocusId = focusId && previous.ownedSnails.some((snail) => snail.id === focusId)
        ? focusId
        : previous.ownedSnails[0]?.id ?? '';

      if (
        previous.selectedSnailId === nextFocusId &&
        previous.breedingSelection.parentAId === parentAId &&
        previous.breedingSelection.parentBId === parentBId
      ) {
        return previous;
      }

      return {
        ...previous,
        selectedSnailId: nextFocusId,
        breedingSelection: {
          parentAId,
          parentBId
        }
      };
    });
  }, [selectedIds, gameState.selectedSnailId]);

  useEffect(() => {
    saveStoredGameState({
      ...gameState,
      saveVersion: CURRENT_SAVE_VERSION
    });
  }, [gameState]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, clockTickMs);

    return () => window.clearInterval(timerId);
  }, []);

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
        statusMessage: hatchlings.length === 1
          ? `${hatchlings[0]!.name}이 깨어났어요.`
          : `${hatchlings.length}마리의 새끼 달팽이가 깨어났어요.`
      }));

      setSelectedIds((previous) => previous.length > 0 ? previous : [hatchlings[hatchlings.length - 1]!.id]);
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

      let speed = growth.stage === 'adult'
        ? 0.14
        : growth.stage === 'subadult'
          ? 0.16
          : growth.stage === 'juvenile'
            ? 0.18
            : 0.2;

      if (targetDrop) {
        speed += 0.12;
      }

      if (motion.reaction === 'touch' || motion.reaction === 'breed') {
        speed *= 0.45;
      }

      const gap = distance(motion.x, motion.y, motion.targetX, motion.targetY);
      if (gap > 0.08) {
        const step = Math.min(gap, speed);
        motion.x += ((motion.targetX - motion.x) / gap) * step;
        motion.y += ((motion.targetY - motion.y) / gap) * step;
        motion.heading = getMotionHeading(motion.x, motion.y, motion.targetX, motion.targetY);
      }

      motion.speed = speed;

      if (targetDrop && !consumedDrops.has(targetDrop.id) && distance(motion.x, motion.y, targetDrop.x, targetDrop.y) < 2.3) {
        consumedDrops.set(targetDrop.id, {
          snailId: snail.id,
          type: targetDrop.type,
          growthGain: targetDrop.growthGain
        });
        motion.reaction = 'eat';
        motion.reactionUntil = currentTime + eatingReactionMs;
        motion.nextDecisionAt = currentTime + eatingReactionMs;
      } else if (motion.reaction !== 'touch' && motion.reaction !== 'breed' && motion.reaction !== 'eat') {
        motion.reaction = targetDrop ? 'seek' : 'idle';
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
            ? `${targetSnailName}가 ${foodCatalog[targetFoodType].label}을 먹었어요.`
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

  const handleSnailSelect = (snailId: string): void => {
    snailSounds.playSoftSelect();
    setSaleQuote(null);
    setSelectedIds((previous) => getSelectionAfterToggle(previous, snailId));
    const snail = ownedSnailLookup[snailId];
    if (snail) {
      const profile = growthLookup[snailId];
      setStatusMessage(profile ? `${snail.name} · ${profile.label}` : `${snail.name}을 골랐어요.`);
    }
  };

  const clearSelection = (): void => {
    snailSounds.playUiTap();
    setSelectedIds([]);
    setSaleQuote(null);
    setStatusMessage('선택을 비웠어요.');
  };

  const handleTouchSelected = (): void => {
    const targetId = selectedIds[selectedIds.length - 1] ?? focusedSnail?.id ?? null;
    if (!targetId) {
      snailSounds.playBlocked();
      setStatusMessage('먼저 달팽이를 골라 주세요.');
      return;
    }

    const target = ownedSnailLookup[targetId];
    if (!target) {
      return;
    }

    snailSounds.playTouchAction();
    setMotionMap((previous) => {
      const next = syncMotionMap(previous, gameState.ownedSnails);
      const motion = next[targetId];
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
    setStatusMessage(`${target.name}가 더듬이를 움찔했어요.`);
  };

  const handleToggleShop = (): void => {
    snailSounds.playUiTap();
    setFeedMenuOpen(false);
    setActiveFoodType(null);
    setShopOpen((previous) => !previous);
  };

  const handleToggleFeed = (): void => {
    snailSounds.playUiTap();
    setShopOpen(false);
    setFeedMenuOpen((previous) => {
      const next = !previous;
      if (!next) {
        setActiveFoodType(null);
        setStatusMessage('먹이 모드를 닫았어요.');
      } else {
        setStatusMessage('먹이를 고른 뒤 테라리움을 눌러 주세요.');
      }
      return next;
    });
  };

  const handleChooseFoodType = (foodType: FoodType): void => {
    if (gameState.foodInventory[foodType] <= 0) {
      snailSounds.playBlocked();
      setStatusMessage(`${foodCatalog[foodType].label}이 부족해요.`);
      return;
    }

    snailSounds.playSoftSelect();
    setActiveFoodType(foodType);
    setStatusMessage(`${foodCatalog[foodType].label}을 놓을 자리를 눌러 주세요.`);
  };

  const handleTerrariumClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (!activeFoodType) {
      setSelectedIds([]);
      setSaleQuote(null);
      return;
    }

    if (gameState.foodInventory[activeFoodType] <= 0) {
      snailSounds.playBlocked();
      setStatusMessage(`${foodCatalog[activeFoodType].label}이 없어서 놓을 수 없어요.`);
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
      statusMessage: `${option.label}을 내려놓았어요.`
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
    setGameState((previous) => ({
      ...previous,
      balance: previous.balance - bundle.cost,
      foodInventory: {
        ...previous.foodInventory,
        [foodType]: previous.foodInventory[foodType] + bundle.quantity
      },
      statusMessage: `${bundle.label}을 샀어요.`
    }));
  };

  const handleChangeTerrarium = (terrariumId: string): void => {
    if (terrariumId === gameState.selectedTerrariumId) {
      return;
    }

    snailSounds.playSoftSelect();
    setGameState((previous) => ({
      ...previous,
      selectedTerrariumId: terrariumId,
      statusMessage: `${terrariumLookup[terrariumId]?.name ?? '테라리움'}으로 옮겨 봤어요.`
    }));
  };
  const handleBreedSelected = (): void => {
    if (breedingRequirementText || selectedSnails.length !== 2) {
      snailSounds.playBlocked();
      setStatusMessage(breedingRequirementText ?? '두 마리를 골라 주세요.');
      return;
    }

    const [parentA, parentB] = selectedSnails;
    const breedingResult = createEggFromParents(parentA!, parentB!, gameState.selectedTerrariumId);
    const currentTime = Date.now();

    snailSounds.playBreedingStart();
    snailSounds.playLayingScene();
    setBreedingEffect({
      ids: [parentA!.id, parentB!.id],
      until: currentTime + breedingReactionMs
    });
    setMotionMap((previous) => {
      const next = syncMotionMap(previous, gameState.ownedSnails);
      const left = next[parentA!.id];
      const right = next[parentB!.id];
      if (left && right) {
        const midpointX = (left.x + right.x) / 2;
        const midpointY = (left.y + right.y) / 2;
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

  const handleOpenSaleQuote = (): void => {
    if (selectedSnails.length === 0) {
      snailSounds.playBlocked();
      setStatusMessage('판매할 달팽이를 먼저 골라 주세요.');
      return;
    }

    setSaleQuote({
      ids: selectedSnails.map((snail) => snail.id),
      total: salePreviewTotal
    });
    snailSounds.playUiTap();
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
    setFoodDrops([]);
    setSelectedIds(nextFocusId ? [nextFocusId] : []);
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
      saveVersion: CURRENT_SAVE_VERSION
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
    setShopOpen(false);
    setFeedMenuOpen(false);
    setActiveFoodType(null);
    setFoodDrops([]);
    setMotionMap(syncMotionMap({}, restored.ownedSnails));
    setGameState({
      ...restored,
      statusMessage: `세이브를 불러왔어요 · ${formatSavedAt(slot.savedAt)}`
    });
    setSelectedIds(restored.selectedSnailId ? [restored.selectedSnailId] : []);
    snailSounds.playUiTap();
  };

  return (
    <div className={`koi-shell koi-shell--${selectedTerrarium.id}`}>
      <header className="hud-row">
        <div className="resource-strip">
          <div className="hud-chip">
            <span>머니</span>
            <strong>{formatCurrency(gameState.balance)}</strong>
          </div>
          <div className="hud-chip">
            <span>오이</span>
            <strong>{gameState.foodInventory.cucumber}</strong>
          </div>
          <div className="hud-chip">
            <span>당근</span>
            <strong>{gameState.foodInventory.carrot}</strong>
          </div>
          <div className="hud-chip">
            <span>알</span>
            <strong>{gameState.eggs.length}</strong>
            {soonestEgg ? <em>{formatShortDuration(soonestEgg.hatchAt - now)}</em> : null}
          </div>
        </div>

        <div className="hud-tools">
          <div className="theme-switcher" role="tablist" aria-label="테라리움 배경 선택">
            {starterTerrariums.map((terrarium) => (
              <button
                key={terrarium.id}
                type="button"
                className={terrarium.id === selectedTerrarium.id ? 'is-active' : ''}
                onClick={() => handleChangeTerrarium(terrarium.id)}
              >
                {terrarium.name}
              </button>
            ))}
          </div>

          <button type="button" className="tool-pill" onClick={handleSaveGame}>
            세이브
          </button>
          <button type="button" className="tool-pill" onClick={handleLoadGame}>
            불러오기
          </button>
        </div>
      </header>

      <main className={`terrarium-stage terrarium-stage--${selectedTerrarium.id} ${activeFoodType ? 'is-feed-mode' : ''}`} onClick={handleTerrariumClick}>
        <div className="terrarium-fog" />
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
        <div className="scene-caption">{gameState.statusMessage}</div>
        <div className="scene-mood">{selectedTerrarium.mood}</div>
        {activeFoodType ? (
          <div className="feed-cursor-hint">
            {foodCatalog[activeFoodType].label} 놓기
          </div>
        ) : null}
        {breedingEffect && breedingEffect.until > now ? <div className="breeding-bloom" /> : null}

        <div className="egg-cluster" aria-label="달팽이 알">
          {gameState.eggs.map((egg, index) => {
            const eggStyle = {
              ...getEggVisualStyle(egg),
              left: `${getEggPosition(index).left}%`,
              top: `${getEggPosition(index).top}%`,
              ['--egg-progress' as string]: String(clamp((now - egg.laidAt) / Math.max(1, egg.hatchAt - egg.laidAt), 0, 1))
            } satisfies CSSProperties;

            return <span key={egg.id} className="egg-orb" style={eggStyle} />;
          })}
        </div>

        <div className="food-layer" aria-label="놓인 먹이">
          {foodDrops.map((drop) => {
            const dropStyle = {
              left: `${drop.x}%`,
              top: `${drop.y}%`
            } satisfies CSSProperties;

            return (
              <span key={drop.id} className={`food-drop food-drop--${drop.type}`} style={dropStyle}>
                <span className="food-drop__piece" />
                <span className="food-drop__leaf" />
              </span>
            );
          })}
        </div>

        <div className="snail-layer">
          {gameState.ownedSnails.map((snail, index) => {
            const motion = motionMap[snail.id] ?? createMotionSeed(snail.id, index);
            const growth = growthLookup[snail.id] ?? getGrowthProfile(snail, now);
            const species = speciesLookup[snail.speciesId] ?? snailSpecies[0]!;
            const isFocused = focusedSnail?.id === snail.id;
            const isSelected = selectedIds.includes(snail.id);
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
                clickDisabled={Boolean(activeFoodType)}
                onSelect={handleSnailSelect}
              />
            );
          })}
        </div>
      </main>

      {feedMenuOpen ? (
        <section className="feed-palette" aria-label="먹이 선택">
          {(Object.keys(foodCatalog) as FoodType[]).map((foodType) => {
            const option = foodCatalog[foodType];
            const remaining = gameState.foodInventory[foodType];
            const selected = activeFoodType === foodType;

            return (
              <button
                key={foodType}
                type="button"
                className={selected ? 'is-active' : ''}
                onClick={() => handleChooseFoodType(foodType)}
              >
                <span>{option.label}</span>
                <strong>{remaining}</strong>
                <small>+{option.growthGain}</small>
              </button>
            );
          })}
        </section>
      ) : null}

      <section className={`selection-tray ${selectedSnails.length > 0 ? 'has-selection' : ''}`}>
        <div className="selection-cards">
          {selectedSnails.length > 0 ? selectedSnails.map((snail) => {
            const growth = growthLookup[snail.id]!;
            const rarity = getSpeciesRarityLabel(snail.speciesId);
            const cooldownMs = Math.max(0, snail.cooldownUntil - now);
            const progressPercent = (growth.growthPoints / adultGrowthGoalPoints) * 100;

            return (
              <article key={snail.id} className={`selection-card rarity-${rarity}`}>
                <div className="selection-card__topline">
                  <span className="selection-dot" style={{ background: snail.accent }} />
                  <strong>{snail.name}</strong>
                  <em>{rarityToneLabel[rarity]}</em>
                </div>
                <div className="selection-card__meta">
                  <span>{growth.label}</span>
                  <span>{formatCurrency(getSnailSaleValue(snail, growth))}</span>
                </div>
                <div className="selection-card__progress">
                  <span style={{ width: `${Math.min(100, progressPercent)}%` }} />
                </div>
                {cooldownMs > 0 ? <small>교배 대기 {formatShortDuration(cooldownMs)}</small> : null}
              </article>
            );
          }) : (
            <div className="selection-empty">
              <strong>선택 없음</strong>
              <span>달팽이를 눌러 고르면 교배와 판매가 열려요.</span>
            </div>
          )}
        </div>

        <div className="selection-actions">
          <button type="button" className="action-button action-button--ghost" onClick={handleOpenSaleQuote} disabled={selectedSnails.length === 0}>
            판매 {selectedSnails.length > 0 ? formatCurrency(salePreviewTotal) : ''}
          </button>
          <button type="button" className="action-button" onClick={handleBreedSelected} disabled={Boolean(breedingRequirementText)}>
            교배
          </button>
          <div className="selection-hint">
            {breedingPreview ? (
              <span>
                레어 {Math.round(breedingPreview.rareChance * 100)}% · 부화 {formatShortDuration(breedingPreview.hatchDurationMs)}
              </span>
            ) : (
              <span>{breedingRequirementText ?? '두 마리를 고르면 레어 확률을 볼 수 있어요.'}</span>
            )}
          </div>
        </div>
      </section>

      <nav className="bottom-dock" aria-label="메인 액션">
        <button type="button" className={shopOpen ? 'is-active' : ''} onClick={handleToggleShop}>
          상점
        </button>
        <button type="button" className={feedMenuOpen ? 'is-active' : ''} onClick={handleToggleFeed}>
          먹이
        </button>
        <button type="button" onClick={handleTouchSelected} disabled={!focusedSnail}>
          터치
        </button>
        <button type="button" onClick={clearSelection}>
          해제
        </button>
      </nav>

      {shopOpen ? (
        <div className="overlay-backdrop" role="presentation" onClick={() => setShopOpen(false)}>
          <section className="shop-modal" role="dialog" aria-modal="true" aria-label="먹이 상점" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <strong>먹이 상점</strong>
              <button type="button" onClick={() => setShopOpen(false)}>
                닫기
              </button>
            </div>
            <div className="shop-grid">
              {(Object.keys(foodShopBundles) as FoodType[]).map((foodType) => {
                const bundle = foodShopBundles[foodType];
                const option = foodCatalog[foodType];
                const affordable = gameState.balance >= bundle.cost;

                return (
                  <article key={foodType} className={`shop-card shop-card--${foodType}`}>
                    <div>
                      <strong>{bundle.label}</strong>
                      <p>{bundle.description}</p>
                    </div>
                    <div className="shop-card__stats">
                      <span>+{bundle.quantity}개</span>
                      <span>성장 {option.growthGain}</span>
                    </div>
                    <button type="button" onClick={() => handleBuyBundle(foodType)} disabled={!affordable}>
                      {formatCurrency(bundle.cost)}
                    </button>
                  </article>
                );
              })}
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

      <footer className="footer-strip">
        <div>
          {focusedSnail && focusedGrowth ? (
            <>
              <strong>{focusedSnail.name}</strong>
              <span>
                {focusedGrowth.label} · 성장 {focusedGrowth.growthPoints}/{adultGrowthGoalPoints}
              </span>
            </>
          ) : (
            <>
              <strong>{selectedTerrarium.name}</strong>
              <span>{selectedTerrarium.description}</span>
            </>
          )}
        </div>
        <div>
          {manualSaveInfo ? `최근 세이브 ${formatSavedAt(manualSaveInfo.savedAt)}` : '세이브 없음'}
        </div>
      </footer>
    </div>
  );
}

export default App;
