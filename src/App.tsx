import { useEffect, useMemo, useRef, useState } from 'react';
import PropVisual from './components/PropVisual';
import {
  createStarterPlacedPropsByTerrarium,
  mainActions,
  snailSpecies,
  starterTerrariums,
  terrariumProps
} from './data/gameContent';
import type {
  ActionId,
  BreedingSelection,
  OwnedSnail,
  PlacedTerrariumProp,
  PropPlacementMode,
  SnailEgg,
  SnailSpecies,
  StoredGameState,
  TerrariumPropDefinition
} from './types/game';
import {
  createEggFromParents,
  createStarterSnailCollection,
  formatEggCountdown,
  getBreedingPreview,
  hatchEgg
} from './utils/snailLifecycle';
import { getEggVisualStyle, getGrowthProfile, type GrowthProfile } from './utils/snailGrowth';
import { snailSounds } from './utils/soundEffects';
import { loadStoredGameState, saveStoredGameState } from './utils/storage';

const fallbackSpecies = snailSpecies[0]!;
const fallbackTerrarium = starterTerrariums[0]!;
const motionPhases = ['forage', 'glide', 'glassy-climb', 'window-perch'] as const;
const rainStreakIds = [1, 2, 3, 4, 5, 6] as const;
const starterPlacedProps = createStarterPlacedPropsByTerrarium();
const starterSnails = createStarterSnailCollection();
const defaultPalettePropId = terrariumProps[0]?.id ?? null;
const fallbackOwnedSnail = starterSnails[0]!;
const defaultBreedingSelection: BreedingSelection = {
  parentAId: starterSnails[0]?.id ?? null,
  parentBId: starterSnails[1]?.id ?? null
};

type MotionPhase = (typeof motionPhases)[number];

type PlacementPoint = {
  x: number;
  y: number;
};

type SceneEffect =
  | {
      kind: 'laying' | 'hatching';
      terrariumId: string;
      accent: string;
      label: string;
    }
  | null;

const motionPhaseLabels: Record<MotionPhase, string> = {
  forage: '이끼 바닥을 느리게 지나가는 중',
  glide: '먹이 냄새를 따라 이동하는 중',
  'glassy-climb': '유리벽을 타고 올라가는 중',
  'window-perch': '벽면에 붙어 잠시 쉬는 중'
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clonePlacedPropsMap(
  source: Record<string, PlacedTerrariumProp[]>
): Record<string, PlacedTerrariumProp[]> {
  return Object.fromEntries(
    Object.entries(source).map(([terrariumId, placements]) => [
      terrariumId,
      placements.map((placement) => ({ ...placement }))
    ])
  );
}

function cloneSnails(snails: OwnedSnail[]): OwnedSnail[] {
  return snails.map((snail) => ({ ...snail }));
}

function sanitizePlacement(candidate: unknown, fallbackId: string): PlacedTerrariumProp | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const maybePlacement = candidate as Partial<PlacedTerrariumProp>;
  if (
    typeof maybePlacement.propId !== 'string' ||
    typeof maybePlacement.x !== 'number' ||
    typeof maybePlacement.y !== 'number'
  ) {
    return null;
  }

  return {
    id: typeof maybePlacement.id === 'string' ? maybePlacement.id : fallbackId,
    propId: maybePlacement.propId,
    x: clamp(maybePlacement.x, 6, 94),
    y: clamp(maybePlacement.y, 8, 90)
  };
}

function sanitizeOwnedSnail(
  candidate: unknown,
  fallbackId: string,
  speciesLookup: Record<string, SnailSpecies>
): OwnedSnail | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const maybeSnail = candidate as Partial<OwnedSnail>;
  if (typeof maybeSnail.speciesId !== 'string') {
    return null;
  }

  const matchedSpecies = speciesLookup[maybeSnail.speciesId];
  if (!matchedSpecies) {
    return null;
  }

  return {
    id: typeof maybeSnail.id === 'string' ? maybeSnail.id : fallbackId,
    name: typeof maybeSnail.name === 'string' ? maybeSnail.name : '새 달팽이',
    speciesId: maybeSnail.speciesId,
    accent: typeof maybeSnail.accent === 'string' ? maybeSnail.accent : matchedSpecies.accent,
    patternLabel: typeof maybeSnail.patternLabel === 'string' ? maybeSnail.patternLabel : '기본 패턴',
    generation: typeof maybeSnail.generation === 'number' ? maybeSnail.generation : 1,
    bornAt: typeof maybeSnail.bornAt === 'number' ? maybeSnail.bornAt : Date.now(),
    cooldownUntil: typeof maybeSnail.cooldownUntil === 'number' ? maybeSnail.cooldownUntil : 0,
    starter: Boolean(maybeSnail.starter)
  };
}

function sanitizeEgg(
  candidate: unknown,
  fallbackId: string,
  terrariumIds: Set<string>,
  ownedSnailIds: Set<string>,
  speciesLookup: Record<string, SnailSpecies>
): SnailEgg | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const maybeEgg = candidate as Partial<SnailEgg>;
  if (
    typeof maybeEgg.terrariumId !== 'string' ||
    !terrariumIds.has(maybeEgg.terrariumId) ||
    typeof maybeEgg.parentAId !== 'string' ||
    !ownedSnailIds.has(maybeEgg.parentAId) ||
    typeof maybeEgg.parentBId !== 'string' ||
    !ownedSnailIds.has(maybeEgg.parentBId) ||
    typeof maybeEgg.speciesId !== 'string' ||
    !speciesLookup[maybeEgg.speciesId] ||
    typeof maybeEgg.accent !== 'string' ||
    typeof maybeEgg.patternLabel !== 'string' ||
    typeof maybeEgg.plannedName !== 'string' ||
    typeof maybeEgg.generation !== 'number' ||
    typeof maybeEgg.laidAt !== 'number' ||
    typeof maybeEgg.hatchAt !== 'number'
  ) {
    return null;
  }

  return {
    id: typeof maybeEgg.id === 'string' ? maybeEgg.id : fallbackId,
    terrariumId: maybeEgg.terrariumId,
    parentAId: maybeEgg.parentAId,
    parentBId: maybeEgg.parentBId,
    speciesId: maybeEgg.speciesId,
    accent: maybeEgg.accent,
    patternLabel: maybeEgg.patternLabel,
    plannedName: maybeEgg.plannedName,
    generation: maybeEgg.generation,
    laidAt: maybeEgg.laidAt,
    hatchAt: maybeEgg.hatchAt
  };
}

function normalizePlacedPropsByTerrarium(storedPlacements: unknown): Record<string, PlacedTerrariumProp[]> {
  const normalizedPlacements = clonePlacedPropsMap(starterPlacedProps);

  if (!storedPlacements || typeof storedPlacements !== 'object') {
    return normalizedPlacements;
  }

  const storedRecord = storedPlacements as Record<string, unknown>;
  for (const terrarium of starterTerrariums) {
    if (!Object.prototype.hasOwnProperty.call(storedRecord, terrarium.id)) {
      continue;
    }

    const terrariumPlacements = storedRecord[terrarium.id];
    if (!Array.isArray(terrariumPlacements)) {
      continue;
    }

    normalizedPlacements[terrarium.id] = terrariumPlacements
      .map((placement, index) => sanitizePlacement(placement, `${terrarium.id}-restored-${index}`))
      .filter((placement): placement is PlacedTerrariumProp => placement !== null);
  }

  return normalizedPlacements;
}

function normalizeOwnedSnails(
  storedSnails: unknown,
  speciesLookup: Record<string, SnailSpecies>
): OwnedSnail[] {
  if (!Array.isArray(storedSnails)) {
    return cloneSnails(starterSnails);
  }

  const normalizedSnails = storedSnails
    .map((snail, index) => sanitizeOwnedSnail(snail, `restored-snail-${index}`, speciesLookup))
    .filter((snail): snail is OwnedSnail => snail !== null);

  return normalizedSnails.length > 0 ? normalizedSnails : cloneSnails(starterSnails);
}

function normalizeEggs(
  storedEggs: unknown,
  terrariumIds: Set<string>,
  ownedSnailIds: Set<string>,
  speciesLookup: Record<string, SnailSpecies>
): SnailEgg[] {
  if (!Array.isArray(storedEggs)) {
    return [];
  }

  return storedEggs
    .map((egg, index) => sanitizeEgg(egg, `restored-egg-${index}`, terrariumIds, ownedSnailIds, speciesLookup))
    .filter((egg): egg is SnailEgg => egg !== null)
    .sort((left, right) => left.hatchAt - right.hatchAt);
}

function normalizeBreedingSelection(
  storedSelection: unknown,
  snails: OwnedSnail[]
): BreedingSelection {
  const defaultSelection = {
    parentAId: snails[0]?.id ?? null,
    parentBId: snails[1]?.id ?? null
  };

  if (!storedSelection || typeof storedSelection !== 'object') {
    return defaultSelection;
  }

  const maybeSelection = storedSelection as Partial<BreedingSelection>;
  const availableSnailIds = new Set(snails.map((snail) => snail.id));

  return {
    parentAId:
      typeof maybeSelection.parentAId === 'string' && availableSnailIds.has(maybeSelection.parentAId)
        ? maybeSelection.parentAId
        : defaultSelection.parentAId,
    parentBId:
      typeof maybeSelection.parentBId === 'string' && availableSnailIds.has(maybeSelection.parentBId)
        ? maybeSelection.parentBId
        : defaultSelection.parentBId
  };
}

function clampPlacementPoint(point: PlacementPoint, placementMode: PropPlacementMode): PlacementPoint {
  const x = clamp(point.x, 8, 92);

  if (placementMode === 'ceiling') {
    return { x, y: clamp(point.y, 12, 42) };
  }

  if (placementMode === 'free') {
    return { x, y: clamp(point.y, 18, 80) };
  }

  return { x, y: clamp(point.y, 56, 86) };
}

function createPlacementId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `prop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCooldownRemaining(snail: OwnedSnail | null, now: number): number {
  return snail ? Math.max(0, snail.cooldownUntil - now) : 0;
}

type EggStage = 'fresh' | 'resting' | 'stirring' | 'cracking' | 'ready';

const eggStageLabels: Record<EggStage, string> = {
  fresh: '산란 직후',
  resting: '안정기',
  stirring: '미세 움직임',
  cracking: '균열 직전',
  ready: '부화 가능'
};

const eggStageDescriptions: Record<EggStage, string> = {
  fresh: '표면 점액막이 아직 번들거리고 내부가 차분히 굳는 단계예요.',
  resting: '겉은 고요하지만 내부 성장 루프가 안정적으로 이어지고 있어요.',
  stirring: '안쪽에서 아주 미세한 뒤척임이 전해지기 시작했어요.',
  cracking: '껍질이 팽팽해지며 미세 균열과 흔들림이 자주 보이는 구간이에요.',
  ready: '지금 바로 부화시킬 수 있을 만큼 움직임과 압력이 충분히 찼어요.'
};

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function getEggProgress(egg: SnailEgg, now: number): number {
  const hatchSpan = Math.max(1, egg.hatchAt - egg.laidAt);
  return clamp((now - egg.laidAt) / hatchSpan, 0, 1);
}

function getEggStage(egg: SnailEgg, now: number): EggStage {
  if (now >= egg.hatchAt) {
    return 'ready';
  }

  const progress = getEggProgress(egg, now);
  if (progress < 0.18) {
    return 'fresh';
  }

  if (progress < 0.56) {
    return 'resting';
  }

  if (progress < 0.84) {
    return 'stirring';
  }

  return 'cracking';
}

function App() {
  const speciesLookup = useMemo(
    () => Object.fromEntries(snailSpecies.map((species) => [species.id, species])) as Record<string, SnailSpecies>,
    []
  );
  const propLookup = useMemo(
    () => Object.fromEntries(terrariumProps.map((prop) => [prop.id, prop])) as Record<string, TerrariumPropDefinition>,
    []
  );

  const [selectedSnailId, setSelectedSnailId] = useState(fallbackOwnedSnail.id);
  const [selectedTerrariumId, setSelectedTerrariumId] = useState(fallbackTerrarium.id);
  const [isEditMode, setIsEditMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    '달팽이가 이끼 위를 천천히 지나가며 반짝이는 점액 자국을 남기고 있어요.'
  );
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const [motionPhaseIndex, setMotionPhaseIndex] = useState(0);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [selectedPalettePropId, setSelectedPalettePropId] = useState<string | null>(defaultPalettePropId);
  const [placedPropsByTerrarium, setPlacedPropsByTerrarium] = useState<Record<string, PlacedTerrariumProp[]>>(
    () => clonePlacedPropsMap(starterPlacedProps)
  );
  const [selectedPlacedPropId, setSelectedPlacedPropId] = useState<string | null>(null);
  const [draggedPropId, setDraggedPropId] = useState<string | null>(null);
  const [ownedSnails, setOwnedSnails] = useState<OwnedSnail[]>(() => cloneSnails(starterSnails));
  const [eggs, setEggs] = useState<SnailEgg[]>([]);
  const [breedingSelection, setBreedingSelection] = useState<BreedingSelection>(defaultBreedingSelection);
  const [sceneEffect, setSceneEffect] = useState<SceneEffect>(null);

  const sceneRef = useRef<HTMLDivElement | null>(null);
  const lastSceneSoundKeyRef = useRef('');

  useEffect(() => {
    const storedState = loadStoredGameState();
    const normalizedSnails = normalizeOwnedSnails(storedState?.ownedSnails, speciesLookup);
    const ownedSnailIds = new Set(normalizedSnails.map((snail) => snail.id));
    const terrariumIds = new Set(starterTerrariums.map((terrarium) => terrarium.id));

    setOwnedSnails(normalizedSnails);
    setEggs(normalizeEggs(storedState?.eggs, terrariumIds, ownedSnailIds, speciesLookup));
    setBreedingSelection(normalizeBreedingSelection(storedState?.breedingSelection, normalizedSnails));
    setPlacedPropsByTerrarium(normalizePlacedPropsByTerrarium(storedState?.placedPropsByTerrarium));

    if (
      typeof storedState?.selectedSnailId === 'string' &&
      normalizedSnails.some((snail) => snail.id === storedState.selectedSnailId)
    ) {
      setSelectedSnailId(storedState.selectedSnailId);
    } else {
      setSelectedSnailId(normalizedSnails[0]?.id ?? fallbackOwnedSnail.id);
    }

    if (typeof storedState?.selectedTerrariumId === 'string') {
      setSelectedTerrariumId(storedState.selectedTerrariumId);
    }

    if (typeof storedState?.isEditMode === 'boolean') {
      setIsEditMode(storedState.isEditMode);
    }

    if (typeof storedState?.statusMessage === 'string') {
      setStatusMessage(storedState.statusMessage);
    }

    if (storedState?.selectedPalettePropId === null || typeof storedState?.selectedPalettePropId === 'string') {
      setSelectedPalettePropId(storedState.selectedPalettePropId ?? defaultPalettePropId);
    }

    setHasHydrated(true);
  }, [speciesLookup]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const nextState: StoredGameState = {
      selectedSnailId,
      selectedTerrariumId,
      isEditMode,
      statusMessage,
      selectedPalettePropId,
      placedPropsByTerrarium,
      ownedSnails,
      eggs,
      breedingSelection
    };

    saveStoredGameState(nextState);
  }, [
    breedingSelection,
    eggs,
    hasHydrated,
    isEditMode,
    ownedSnails,
    placedPropsByTerrarium,
    selectedPalettePropId,
    selectedSnailId,
    selectedTerrariumId,
    statusMessage
  ]);

  useEffect(() => {
    const motionIntervalId = window.setInterval(() => {
      setMotionPhaseIndex((currentPhaseIndex) => (currentPhaseIndex + 1) % motionPhases.length);
    }, 4400);

    const clockIntervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(motionIntervalId);
      window.clearInterval(clockIntervalId);
    };
  }, []);

  useEffect(() => {
    if (!activeAction) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveAction(null);
    }, activeAction === 'breed' ? 3600 : 2200);

    return () => window.clearTimeout(timeoutId);
  }, [activeAction]);

  useEffect(() => {
    if (!sceneEffect) {
      lastSceneSoundKeyRef.current = '';
      return;
    }

    const sceneSoundKey = `${sceneEffect.kind}:${sceneEffect.terrariumId}:${sceneEffect.label}`;
    if (lastSceneSoundKeyRef.current !== sceneSoundKey) {
      lastSceneSoundKeyRef.current = sceneSoundKey;
      if (sceneEffect.kind === 'laying') {
        snailSounds.playLayingScene();
      } else {
        snailSounds.playHatchingScene();
      }
    }

    const timeoutId = window.setTimeout(() => {
      setSceneEffect(null);
    }, sceneEffect.kind === 'hatching' ? 3200 : 2800);

    return () => window.clearTimeout(timeoutId);
  }, [sceneEffect]);

  useEffect(() => {
    if (!ownedSnails.some((snail) => snail.id === selectedSnailId)) {
      setSelectedSnailId(ownedSnails[0]?.id ?? fallbackOwnedSnail.id);
    }
  }, [ownedSnails, selectedSnailId]);

  useEffect(() => {
    const availableSnailIds = new Set(ownedSnails.map((snail) => snail.id));
    setBreedingSelection((currentSelection) => ({
      parentAId:
        currentSelection.parentAId && availableSnailIds.has(currentSelection.parentAId)
          ? currentSelection.parentAId
          : ownedSnails[0]?.id ?? null,
      parentBId:
        currentSelection.parentBId && availableSnailIds.has(currentSelection.parentBId)
          ? currentSelection.parentBId
          : ownedSnails[1]?.id ?? null
    }));
  }, [ownedSnails]);

  useEffect(() => {
    setSelectedPlacedPropId(null);
    setDraggedPropId(null);
  }, [selectedTerrariumId]);

  useEffect(() => {
    if (!isEditMode) {
      setSelectedPlacedPropId(null);
      setDraggedPropId(null);
    }
  }, [isEditMode]);

  const motionPhase = motionPhases[motionPhaseIndex]!;
  const selectedSnail = ownedSnails.find((snail) => snail.id === selectedSnailId) ?? fallbackOwnedSnail;
  const selectedSnailSpecies = speciesLookup[selectedSnail.speciesId] ?? fallbackSpecies;
  const selectedSnailGrowth = getGrowthProfile(selectedSnail, clockNow);
  const selectedTerrarium =
    starterTerrariums.find((terrarium) => terrarium.id === selectedTerrariumId) ?? fallbackTerrarium;
  const selectedTerrariumPlacements = placedPropsByTerrarium[selectedTerrarium.id] ?? [];
  const sortedTerrariumPlacements = [...selectedTerrariumPlacements].sort((left, right) => left.y - right.y);
  const selectedPaletteProp = selectedPalettePropId ? propLookup[selectedPalettePropId] ?? null : null;
  const selectedPlacedProp =
    selectedPlacedPropId !== null
      ? selectedTerrariumPlacements.find((placement) => placement.id === selectedPlacedPropId) ?? null
      : null;
  const selectedPlacedPropDefinition = selectedPlacedProp ? propLookup[selectedPlacedProp.propId] ?? null : null;
  const selectedTerrariumEggs = eggs.filter((egg) => egg.terrariumId === selectedTerrarium.id);
  const previewTerrariumEggs = selectedTerrariumEggs.slice(0, 4);
  const featuredTerrariumEgg = previewTerrariumEggs[0] ?? null;
  const featuredTerrariumEggStage = featuredTerrariumEgg ? getEggStage(featuredTerrariumEgg, clockNow) : null;
  const featuredTerrariumEggStageLabel = featuredTerrariumEggStage ? eggStageLabels[featuredTerrariumEggStage] : null;
  const readyEggCount = eggs.filter((egg) => egg.hatchAt <= clockNow).length;
  const collectedSpeciesCount = new Set(ownedSnails.map((snail) => snail.speciesId)).size;
  const coolingSnailCount = ownedSnails.filter((snail) => snail.cooldownUntil > clockNow).length;
  const adultSnailCount = ownedSnails.filter((snail) => getGrowthProfile(snail, clockNow).isMature).length;
  const isRainWindowTank = selectedTerrarium.id === 'rain-window-tank';
  const breedingParentA = ownedSnails.find((snail) => snail.id === breedingSelection.parentAId) ?? null;
  const breedingParentB = ownedSnails.find((snail) => snail.id === breedingSelection.parentBId) ?? null;
  const breedingParentAGrowth = breedingParentA ? getGrowthProfile(breedingParentA, clockNow) : null;
  const breedingParentBGrowth = breedingParentB ? getGrowthProfile(breedingParentB, clockNow) : null;
  const breedingParentACooldown = getCooldownRemaining(breedingParentA, clockNow);
  const breedingParentBCooldown = getCooldownRemaining(breedingParentB, clockNow);
  const breedingCooldownRemaining = Math.max(breedingParentACooldown, breedingParentBCooldown);
  const breedingMaturityBlocked =
    (breedingParentAGrowth !== null && !breedingParentAGrowth.isMature) ||
    (breedingParentBGrowth !== null && !breedingParentBGrowth.isMature);
  const breedingPreview =
    breedingParentA && breedingParentB && breedingParentA.id !== breedingParentB.id
      ? getBreedingPreview(breedingParentA, breedingParentB)
      : null;
  const breedingRareSpeciesNames = breedingPreview
    ? breedingPreview.rareSpeciesIds.map((speciesId) => speciesLookup[speciesId]?.name ?? fallbackSpecies.name)
    : [];
  const isBreedingSceneActive = activeAction === 'breed' && breedingParentA !== null && breedingParentB !== null;
  const breedingButtonDisabled =
    !breedingParentA ||
    !breedingParentB ||
    breedingParentA.id === breedingParentB.id ||
    breedingCooldownRemaining > 0 ||
    breedingMaturityBlocked;
  const breedingButtonLabel =
    !breedingParentA || !breedingParentB
      ? '부모 선택 필요'
      : breedingParentA.id === breedingParentB.id
        ? '다른 짝 선택'
        : breedingMaturityBlocked
          ? '성장 대기 중'
          : breedingCooldownRemaining > 0
            ? `재교배 ${formatEggCountdown(breedingCooldownRemaining)}`
            : '교배 시작';
  const selectedGrowthNextText = selectedSnailGrowth.nextStageLabel
    ? `${selectedSnailGrowth.nextStageLabel}까지 ${formatEggCountdown(selectedSnailGrowth.nextStageRemainingMs)}`
    : '성장 완료 · 교배 가능';
  const selectedGrowthStagePercent = Math.round(selectedSnailGrowth.stageProgress * 100);
  const selectedGrowthLifetimePercent = Math.round(selectedSnailGrowth.lifetimeProgress * 100);
  const selectedGrowthAdultText = selectedSnailGrowth.isMature
    ? '성장 완료 · 교배 가능'
    : `성체까지 ${formatEggCountdown(selectedSnailGrowth.adultRemainingMs)}`;
  const selectedGrowthMetrics = [
    {
      label: '껍질 경화',
      value: selectedSnailGrowth.shellHardness,
      hint: '무른 가장자리가 단단한 껍질 고리로 자리잡는 정도'
    },
    {
      label: '몸통 성장',
      value: selectedSnailGrowth.muscleTone,
      hint: '몸 길이와 벽 타기 안정감이 자라나는 정도'
    },
    {
      label: '더듬이 감각',
      value: selectedSnailGrowth.sensoryReach,
      hint: '먹이와 환경 반응을 읽는 촉감 범위'
    },
    {
      label: '점액 흔적',
      value: selectedSnailGrowth.trailStrength,
      hint: '이동 후 남는 점액 자국의 선명도'
    }
  ];
  const isLayingSceneActive = sceneEffect?.kind === 'laying' && sceneEffect.terrariumId === selectedTerrarium.id;
  const isHatchingSceneActive = sceneEffect?.kind === 'hatching' && sceneEffect.terrariumId === selectedTerrarium.id;
  const visibleSceneEffectAccent =
    sceneEffect && sceneEffect.terrariumId === selectedTerrarium.id ? sceneEffect.accent : '#eef6e9';
  const visibleSceneEffectLabel =
    sceneEffect && sceneEffect.terrariumId === selectedTerrarium.id ? sceneEffect.label : '';
  const primarySceneMetric = isHatchingSceneActive
    ? '부화 연출 활성'
    : isLayingSceneActive
      ? '산란 연출 활성'
      : isBreedingSceneActive
        ? '교배 연출 활성'
        : selectedTerrariumEggs.length > 0 && featuredTerrariumEggStageLabel
          ? `알 상태 · ${featuredTerrariumEggStageLabel}`
          : motionPhaseLabels[motionPhase];

  function getPointerPosition(
    clientX: number,
    clientY: number,
    placementMode: PropPlacementMode
  ): PlacementPoint | null {
    if (!sceneRef.current) {
      return null;
    }

    const sceneBounds = sceneRef.current.getBoundingClientRect();
    const rawPoint = {
      x: ((clientX - sceneBounds.left) / sceneBounds.width) * 100,
      y: ((clientY - sceneBounds.top) / sceneBounds.height) * 100
    };

    return clampPlacementPoint(rawPoint, placementMode);
  }

  function updatePlacementPosition(
    placementId: string,
    propId: string,
    clientX: number,
    clientY: number
  ) {
    const definition = propLookup[propId];
    if (!definition) {
      return;
    }

    const nextPosition = getPointerPosition(clientX, clientY, definition.placementMode);
    if (!nextPosition) {
      return;
    }

    setPlacedPropsByTerrarium((currentPlacements) => ({
      ...currentPlacements,
      [selectedTerrarium.id]: (currentPlacements[selectedTerrarium.id] ?? []).map((placement) =>
        placement.id === placementId ? { ...placement, ...nextPosition } : placement
      )
    }));
  }

  function handlePalettePropClick(propId: string) {
    const definition = propLookup[propId];
    if (!definition) {
      return;
    }

    snailSounds.playSoftSelect();

    if (!isEditMode) {
      setStatusMessage('소품 배치는 편집 모드에서 진행돼요. 아래 편집 버튼을 눌러서 이어서 배치해보세요.');
      return;
    }

    if (selectedPalettePropId === propId) {
      setSelectedPalettePropId(null);
      setStatusMessage('소품 선택을 해제했어요. 다른 소품을 고르거나 이미 놓은 소품을 움직일 수 있어요.');
      return;
    }

    setSelectedPalettePropId(propId);
    setSelectedPlacedPropId(null);
    setStatusMessage(`${definition.name}을 선택했어요. 테라리움 빈 공간을 탭하면 바로 배치됩니다.`);
  }

  function handleInterfacePointerDownCapture() {
    snailSounds.prime();
  }

  function handleScenePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!isEditMode) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('[data-placed-prop="true"]')) {
      return;
    }

    if (!selectedPaletteProp) {
      snailSounds.playBlocked();
      setSelectedPlacedPropId(null);
      setStatusMessage('먼저 아래 소품 라이브러리에서 배치할 소품을 골라주세요.');
      return;
    }

    const nextPosition = getPointerPosition(
      event.clientX,
      event.clientY,
      selectedPaletteProp.placementMode
    );
    if (!nextPosition) {
      return;
    }

    const nextPlacement: PlacedTerrariumProp = {
      id: createPlacementId(),
      propId: selectedPaletteProp.id,
      ...nextPosition
    };

    setPlacedPropsByTerrarium((currentPlacements) => ({
      ...currentPlacements,
      [selectedTerrarium.id]: [...(currentPlacements[selectedTerrarium.id] ?? []), nextPlacement]
    }));
    snailSounds.playPropSettle();
    setSelectedPlacedPropId(nextPlacement.id);
    setStatusMessage(`${selectedPaletteProp.name}을 ${selectedTerrarium.name}에 배치했어요. 드래그해서 위치를 다듬어보세요.`);
  }

  function handlePlacedPropPointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
    placement: PlacedTerrariumProp
  ) {
    if (!isEditMode) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    snailSounds.playPropGrab();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedPlacedPropId(placement.id);
    setDraggedPropId(placement.id);
    updatePlacementPosition(placement.id, placement.propId, event.clientX, event.clientY);

    const definition = propLookup[placement.propId];
    if (definition) {
      setStatusMessage(`${definition.name} 위치를 조정하는 중이에요.`);
    }
  }

  function handlePlacedPropPointerMove(
    event: React.PointerEvent<HTMLButtonElement>,
    placement: PlacedTerrariumProp
  ) {
    if (!isEditMode || draggedPropId !== placement.id) {
      return;
    }

    event.preventDefault();
    updatePlacementPosition(placement.id, placement.propId, event.clientX, event.clientY);
  }

  function handlePlacedPropPointerUp(
    event: React.PointerEvent<HTMLButtonElement>,
    placement: PlacedTerrariumProp
  ) {
    if (draggedPropId !== placement.id) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDraggedPropId(null);
    snailSounds.playPropSettle();
    const definition = propLookup[placement.propId];
    if (definition) {
      setStatusMessage(`${definition.name} 위치를 저장했어요.`);
    }
  }

  function handleDeleteSelectedProp() {
    if (!selectedPlacedPropId) {
      snailSounds.playBlocked();
      setStatusMessage('삭제할 소품이 아직 선택되지 않았어요. 편집 모드에서 소품을 한 번 눌러주세요.');
      return;
    }

    snailSounds.playPropRemove();
    const deletedDefinition = selectedPlacedPropDefinition;
    setPlacedPropsByTerrarium((currentPlacements) => ({
      ...currentPlacements,
      [selectedTerrarium.id]: (currentPlacements[selectedTerrarium.id] ?? []).filter(
        (placement) => placement.id !== selectedPlacedPropId
      )
    }));
    setSelectedPlacedPropId(null);
    setDraggedPropId(null);
    setStatusMessage(
      deletedDefinition
        ? `${deletedDefinition.name}을 ${selectedTerrarium.name}에서 정리했어요.`
        : '선택한 소품을 정리했어요.'
    );
  }

  function handleBreedingSelectionChange(slot: 'parentAId' | 'parentBId', value: string) {
    snailSounds.playSoftSelect();
    setBreedingSelection((currentSelection) => ({
      ...currentSelection,
      [slot]: value || null
    }));
  }

  function handleBreedRequest() {
    if (!breedingParentA || !breedingParentB) {
      snailSounds.playBlocked();
      setStatusMessage('브리딩 랩에서 부모 A와 부모 B를 먼저 선택해주세요.');
      return;
    }

    if (breedingParentA.id === breedingParentB.id) {
      snailSounds.playBlocked();
      setStatusMessage('같은 달팽이를 부모 A와 B에 동시에 넣을 수는 없어요. 다른 짝을 골라주세요.');
      return;
    }

    if (breedingMaturityBlocked) {
      const growthNotes = [
        breedingParentAGrowth && !breedingParentAGrowth.isMature
          ? `${breedingParentA.name} ${breedingParentAGrowth.label} · ${breedingParentAGrowth.nextStageLabel ?? '성체'}까지 ${formatEggCountdown(breedingParentAGrowth.nextStageRemainingMs)}`
          : null,
        breedingParentBGrowth && !breedingParentBGrowth.isMature
          ? `${breedingParentB.name} ${breedingParentBGrowth.label} · ${breedingParentBGrowth.nextStageLabel ?? '성체'}까지 ${formatEggCountdown(breedingParentBGrowth.nextStageRemainingMs)}`
          : null
      ].filter((note): note is string => note !== null);

      snailSounds.playBlocked();
      setStatusMessage(`아직 성장 중이라 교배할 수 없어요. ${growthNotes.join(' · ')} 후에 다시 시도해주세요.`);
      return;
    }

    if (breedingParentACooldown > 0 || breedingParentBCooldown > 0) {
      const cooldownNotes = [
        breedingParentACooldown > 0 ? `${breedingParentA.name} ${formatEggCountdown(breedingParentACooldown)}` : null,
        breedingParentBCooldown > 0 ? `${breedingParentB.name} ${formatEggCountdown(breedingParentBCooldown)}` : null
      ].filter((note): note is string => note !== null);

      snailSounds.playBlocked();
      setStatusMessage(`아직 재교배 대기 중이에요. ${cooldownNotes.join(' · ')} 뒤에 다시 시도해주세요.`);
      return;
    }

    const breedingResult = createEggFromParents(
      breedingParentA,
      breedingParentB,
      selectedTerrarium.id,
      ownedSnails.length + eggs.length
    );
    const cooldownUntil = breedingResult.egg.laidAt + breedingResult.cooldownMs;

    snailSounds.playBreedingStart();
    setActiveAction('breed');
    setSceneEffect({
      kind: 'laying',
      terrariumId: selectedTerrarium.id,
      accent: breedingResult.egg.accent,
      label: breedingResult.egg.plannedName
    });
    setOwnedSnails((currentSnails) =>
      currentSnails.map((snail) =>
        snail.id === breedingParentA.id || snail.id === breedingParentB.id
          ? { ...snail, cooldownUntil }
          : snail
      )
    );
    setEggs((currentEggs) => [breedingResult.egg, ...currentEggs].sort((left, right) => left.hatchAt - right.hatchAt));
    setStatusMessage(
      `${breedingParentA.name}와 ${breedingParentB.name}가 더 강하게 밀착하며 점액 광택이 번지는 뒤편에서, 축축한 바닥에 새 알이 눌리듯 놓였어요. ` +
        `${formatEggCountdown(breedingResult.hatchDurationMs)} 뒤에 부화하고, 재교배까지 ${formatEggCountdown(
          breedingResult.cooldownMs
        )} 쉬어갑니다.`
    );
  }

  function handleHatchEgg(eggId: string) {
    const targetEgg = eggs.find((egg) => egg.id === eggId);
    if (!targetEgg) {
      return;
    }

    if (targetEgg.hatchAt > clockNow) {
      snailSounds.playBlocked();
      setStatusMessage(`아직 부화 전이에요. ${formatEggCountdown(targetEgg.hatchAt - clockNow)}만 더 기다려주세요.`);
      return;
    }

    const newbornSnail = hatchEgg(targetEgg);
    setSceneEffect({
      kind: 'hatching',
      terrariumId: targetEgg.terrariumId,
      accent: targetEgg.accent,
      label: newbornSnail.name
    });
    setOwnedSnails((currentSnails) => [newbornSnail, ...currentSnails]);
    setEggs((currentEggs) => currentEggs.filter((egg) => egg.id !== eggId));
    setSelectedSnailId(newbornSnail.id);
    const newbornGrowth = getGrowthProfile(newbornSnail, Date.now());
    setStatusMessage(
      `${newbornSnail.name}이(가) 껍질을 밀어 깨고 젖은 막을 헤치며 나왔어요. 지금은 ${newbornGrowth.label} 단계이고, 성체까지 ${formatEggCountdown(newbornGrowth.adultRemainingMs)} 동안 껍질과 몸이 천천히 자리잡습니다.`
    );
  }

  function handleAction(actionId: ActionId) {
    if (actionId === 'breed') {
      handleBreedRequest();
      return;
    }

    if (actionId === 'feed') {
      snailSounds.playFeedAction();
      setActiveAction(actionId);
      setMotionPhaseIndex(1);
      setStatusMessage(
        selectedSnailGrowth.stage === 'newborn'
          ? `${selectedSnail.name}가 아직 젖은 몸을 낮게 끌며 먹이 가장자리를 아주 조금씩 핥아요.`
          : selectedSnailGrowth.stage === 'hatchling'
            ? `${selectedSnail.name}가 작은 턱으로 오이 표면을 조심스럽게 갉으며 첫 성장 에너지를 모아요.`
            : selectedSnailGrowth.stage === 'juvenile'
              ? `${selectedSnail.name}가 길어진 몸을 뻗어 먹이 쪽으로 다가가고, 껍질 무늬도 조금 더 또렷해 보여요.`
              : `${selectedSnail.name}가 오이와 상추 조각 냄새를 맡고 ${selectedTerrarium.name} 바닥 쪽으로 천천히 방향을 틀어요.`
      );
      return;
    }

    if (actionId === 'touch') {
      snailSounds.playTouchAction();
      setActiveAction(actionId);
      setStatusMessage(
        selectedSnailGrowth.stage === 'newborn'
          ? `${selectedSnail.name}가 아주 짧은 더듬이를 움찔 세우고 젖은 몸을 더 둥글게 말아 보호 자세를 취했어요.`
          : selectedSnailGrowth.stage === 'hatchling'
            ? `${selectedSnail.name}가 얇은 껍질을 감싸듯 몸을 낮췄다가, 곧 다시 조심스럽게 더듬이를 내밀어요.`
            : selectedSnailGrowth.stage === 'juvenile'
              ? `${selectedSnail.name}가 길어진 더듬이를 한번 크게 흔들고, 작은 몸 전체를 탄력 있게 움찔했어요.`
              : `${selectedSnail.name}가 더듬이를 한 번 세우고 몸을 움찔한 뒤 다시 천천히 고개를 내밀었어요.`
      );
      return;
    }

    const nextEditMode = !isEditMode;
    snailSounds.playEditToggle(nextEditMode);
    setActiveAction(actionId);

    if (nextEditMode && selectedPalettePropId === null) {
      setSelectedPalettePropId(defaultPalettePropId);
    }

    setIsEditMode(nextEditMode);
    setStatusMessage(
      nextEditMode
        ? '편집 모드가 열렸어요. 아래 소품을 고른 뒤 테라리움 안을 탭하면 배치되고, 놓은 소품은 드래그로 움직일 수 있어요.'
        : '편집 모드를 닫고 다시 관찰 화면으로 돌아왔어요.'
    );
  }

  function renderSnailFigure(
    snail: OwnedSnail,
    growthProfile: GrowthProfile,
    extraClasses: string[],
    style?: React.CSSProperties
  ) {
    return (
      <div
        className={[
          'snail-figure',
          `snail-figure--${snail.speciesId}`,
          `snail-figure--growth-${growthProfile.stage}`,
          ...extraClasses
        ].filter(Boolean).join(' ')}
        style={{
          ...style,
          ['--snail-growth-scale' as string]: String(growthProfile.scale),
          ['--snail-antenna-scale' as string]: String(growthProfile.antennaScale),
          ['--snail-shell-gloss' as string]: String(growthProfile.shellGloss),
          ['--snail-shell-saturation' as string]: String(growthProfile.shellSaturation),
          ['--snail-body-opacity' as string]: String(growthProfile.bodyOpacity),
          ['--snail-shell-scale' as string]: String(growthProfile.shellScale),
          ['--snail-body-length' as string]: String(growthProfile.bodyLength),
          ['--snail-body-height' as string]: String(growthProfile.bodyHeight),
          ['--snail-head-scale' as string]: String(growthProfile.headScale),
          ['--snail-trail-opacity' as string]: String(growthProfile.trailOpacity)
        }}
      >
        <div className="snail-figure__inner">
          <div className="snail-shadow" />
          <div className="snail-shell" style={{ ['--shell-accent' as string]: snail.accent }} />
          <div className="snail-body" />
          <div className="snail-head" />
          <span className="snail-eye snail-eye--left" />
          <span className="snail-eye snail-eye--right" />
        </div>
      </div>
    );
  }

  const sceneHint = isHatchingSceneActive
    ? `${visibleSceneEffectLabel}가 껍질을 밀어 깨며 첫 점액막을 두르고 나오는 중`
    : isLayingSceneActive
      ? '젖은 바닥에 알을 눌러 묻고 표면 점액막이 번들거리는 중'
      : isBreedingSceneActive
        ? breedingPreview
          ? `점액 교환 연출 · 희귀형 ${formatPercent(breedingPreview.rareChance)} · 예상 부화 ${formatEggCountdown(breedingPreview.hatchDurationMs)}`
          : '두 마리가 가까이 붙어 점액을 교환하는 중'
        : isEditMode
          ? selectedPaletteProp
            ? `${selectedPaletteProp.name} 선택됨 · 빈 공간을 탭해 배치`
            : '선택된 소품 없음 · 이미 놓은 소품은 드래그로 조정'
          : readyEggCount > 0
            ? `부화 가능한 알 ${readyEggCount}개`
            : `${selectedSnailGrowth.label} · ${selectedGrowthNextText}`;
  const sceneCaptionTitle = isHatchingSceneActive
    ? `${visibleSceneEffectLabel} 부화`
    : isLayingSceneActive && breedingParentA && breedingParentB
      ? `${breedingParentA.name} x ${breedingParentB.name}`
      : isBreedingSceneActive && breedingParentA && breedingParentB
        ? `${breedingParentA.name} x ${breedingParentB.name}`
        : selectedSnail.name;
  const sceneCaptionSubtitle = isHatchingSceneActive
    ? '껍질 파열 · 젖은 첫 이동'
    : isLayingSceneActive
      ? '산란 직후 점액막 · 촉촉한 바닥'
      : isBreedingSceneActive && breedingParentA && breedingParentB
        ? `${speciesLookup[breedingParentA.speciesId]?.name ?? fallbackSpecies.name} · ${speciesLookup[breedingParentB.speciesId]?.name ?? fallbackSpecies.name}`
        : `${selectedSnailSpecies.name} · ${selectedSnailGrowth.label}`;
  const sceneCaptionMeta = isHatchingSceneActive || isLayingSceneActive || isBreedingSceneActive
    ? sceneHint
    : `세대 ${selectedSnail.generation} · ${motionPhaseLabels[motionPhase]} · ${selectedSnailGrowth.sceneDescription} · ${sceneHint}`;

  return (
    <div className="app-shell" onPointerDownCapture={handleInterfacePointerDownCapture}>
      <header className="hero-panel glass-card">
        <div>
          <p className="eyebrow">Snail Terrarium / Web-First MVP</p>
          <h1>GitHub에 올리면 바로 열리는 달팽이 테라리움</h1>
          <p className="hero-copy">
            `Hammy Home`의 관찰형 재미를 달팽이 테마로 재해석한 초기 웹 빌드입니다. PC와 모바일
            브라우저에서 바로 실행되도록, 무거운 런타임 없이 CSS와 React 중심으로 애니메이션, 편집,
            교배, 부화 루프를 설계했습니다.
          </p>
        </div>

        <div className="hero-stats" aria-label="MVP overview">
          <article>
            <strong>{ownedSnails.length}마리</strong>
            <span>보유 달팽이</span>
          </article>
          <article>
            <strong>{collectedSpeciesCount}/5종</strong>
            <span>수집 종 수</span>
          </article>
          <article>
            <strong>{eggs.length}개</strong>
            <span>대기 중인 알</span>
          </article>
          <article>
            <strong>Web First</strong>
            <span>GitHub 배포</span>
          </article>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="glass-card terrarium-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Main Terrarium</p>
              <h2>{selectedTerrarium.name}</h2>
            </div>
            <span className="mode-chip">{isEditMode ? '편집 모드' : '관찰 모드'}</span>
          </div>

          <div
            ref={sceneRef}
            className={[
              'terrarium-scene',
              `terrarium-scene--${selectedTerrarium.id}`,
              `terrarium-scene--phase-${motionPhase}`,
              isEditMode ? 'terrarium-scene--edit' : '',
              activeAction ? `terrarium-scene--action-${activeAction}` : '',
              isLayingSceneActive ? 'terrarium-scene--event-laying' : '',
              isHatchingSceneActive ? 'terrarium-scene--event-hatching' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            onPointerDown={handleScenePointerDown}
          >
            {isRainWindowTank ? (
              <div className="rain-curtain" aria-hidden="true">
                {rainStreakIds.map((rainStreakId) => (
                  <span key={rainStreakId} className={`rain-streak rain-streak--${rainStreakId}`} />
                ))}
              </div>
            ) : (
              <div className="mist-band" aria-hidden="true" />
            )}

            <div className="scene-glow scene-glow--a" />
            <div className="scene-glow scene-glow--b" />
            <div className="dew dew--1" />
            <div className="dew dew--2" />
            <div className="dew dew--3" />
            <div className="slime-path slime-path--1" />
            <div className="slime-path slime-path--2" />
            <div className="grass-tuft grass-tuft--1" />
            <div className="grass-tuft grass-tuft--2" />
            <div className="grass-tuft grass-tuft--3" />
            <div className="mushroom mushroom--left" />
            <div className="mushroom mushroom--right" />

            {sortedTerrariumPlacements.map((placement) => {
              const definition = propLookup[placement.propId];
              if (!definition) {
                return null;
              }

              const isSelected = selectedPlacedPropId === placement.id;
              return (
                <button
                  key={placement.id}
                  className={[
                    'placed-prop',
                    isSelected ? 'placed-prop--selected' : '',
                    draggedPropId === placement.id ? 'placed-prop--dragging' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  data-placed-prop="true"
                  onPointerDown={(event) => handlePlacedPropPointerDown(event, placement)}
                  onPointerMove={(event) => handlePlacedPropPointerMove(event, placement)}
                  onPointerUp={(event) => handlePlacedPropPointerUp(event, placement)}
                  onPointerCancel={(event) => handlePlacedPropPointerUp(event, placement)}
                  style={{
                    left: `${placement.x}%`,
                    top: `${placement.y}%`,
                    zIndex: isSelected ? 13 : definition.placementMode === 'ceiling' ? 5 : 8
                  }}
                  type="button"
                >
                  <PropVisual definition={definition} />
                  <span className="placed-prop__name">{definition.name}</span>
                </button>
              );
            })}

            <div className={`food-offering ${activeAction === 'feed' ? 'food-offering--visible' : ''}`}>
              <span className="food-slice food-slice--cucumber" />
              <span className="food-slice food-slice--leaf" />
            </div>

            <div className={`touch-ripple ${activeAction === 'touch' ? 'touch-ripple--visible' : ''}`} />

            <div
              className={[
                'egg-clutch',
                selectedTerrariumEggs.length > 0 ? 'egg-clutch--visible' : '',
                activeAction === 'breed' ? 'egg-clutch--pulse' : '',
                isLayingSceneActive ? 'egg-clutch--laying' : '',
                isHatchingSceneActive ? 'egg-clutch--hatching' : '',
                featuredTerrariumEggStage ? `egg-clutch--stage-${featuredTerrariumEggStage}` : ''
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {previewTerrariumEggs.map((egg, index) => {
                const eggStage = getEggStage(egg, clockNow);
                return (
                  <span
                    key={egg.id}
                    className={`egg egg--${index + 1} egg--stage-${eggStage}`}
                    style={getEggVisualStyle(egg)}
                  />
                );
              })}
              <span className="egg-badge">
                {selectedTerrariumEggs.length > 0 && featuredTerrariumEggStageLabel
                  ? `알 ${selectedTerrariumEggs.length} · ${featuredTerrariumEggStageLabel}`
                  : `알 ${selectedTerrariumEggs.length}`}
              </span>
            </div>

            {isEditMode ? <div className="edit-grid" aria-hidden="true" /> : null}

            {isLayingSceneActive ? (
              <div className="laying-sequence" aria-hidden="true" style={{ ['--effect-accent' as string]: visibleSceneEffectAccent }}>
                <span className="laying-ring laying-ring--1" />
                <span className="laying-ring laying-ring--2" />
                <span className="laying-ring laying-ring--3" />
                <span className="laying-sheen" />
                <span className="laying-egg" />
                <span className="laying-deposit" />
              </div>
            ) : null}

            {isHatchingSceneActive ? (
              <div className="hatching-burst" aria-hidden="true" style={{ ['--effect-accent' as string]: visibleSceneEffectAccent }}>
                <span className="hatching-halo" />
                <span className="crack-line crack-line--1" />
                <span className="crack-line crack-line--2" />
                <span className="crack-line crack-line--3" />
                <span className="shell-shard shell-shard--1" />
                <span className="shell-shard shell-shard--2" />
                <span className="shell-shard shell-shard--3" />
                <span className="shell-shard shell-shard--4" />
                <span className="hatchling-mini">
                  <span className="hatchling-mini__shell" />
                  <span className="hatchling-mini__body" />
                </span>
              </div>
            ) : null}

            {isBreedingSceneActive && breedingParentA && breedingParentB ? (
              <div className="breeding-stage" aria-hidden="true">
                <div className="mucus-aura" />
                <div className="mucus-bridge">
                  <span className="mucus-thread mucus-thread--primary" />
                  <span className="mucus-thread mucus-thread--secondary" />
                  <span className="mucus-drop mucus-drop--1" />
                  <span className="mucus-drop mucus-drop--2" />
                  <span className="mucus-drop mucus-drop--3" />
                  <span className="mucus-knot" />
                  <span className="contact-ripple contact-ripple--1" />
                  <span className="contact-ripple contact-ripple--2" />
                </div>
                {breedingParentAGrowth ? renderSnailFigure(breedingParentA, breedingParentAGrowth, ['snail-figure--breeding', 'snail-figure--breeding-a']) : null}
                {breedingParentBGrowth ? renderSnailFigure(breedingParentB, breedingParentBGrowth, ['snail-figure--breeding', 'snail-figure--breeding-b']) : null}
              </div>
            ) : (
              renderSnailFigure(selectedSnail, selectedSnailGrowth, [
                `snail-figure--phase-${motionPhase}`,
                activeAction ? `snail-figure--action-${activeAction}` : ''
              ])
            )}

            <div className="scene-caption">
              <strong>{sceneCaptionTitle}</strong>
              <span>{sceneCaptionSubtitle}</span>
              <small>{sceneCaptionMeta}</small>
            </div>
          </div>

          <div className="action-dock" role="group" aria-label="Main actions">
            {mainActions.map((action) => (
              <button
                key={action.id}
                className={`action-button ${action.id === 'edit' && isEditMode ? 'action-button--active' : ''}`}
                onClick={() => handleAction(action.id)}
                type="button"
              >
                <strong>{action.label}</strong>
                <span>{action.description}</span>
              </button>
            ))}
          </div>

          <div className="status-panel" aria-live="polite">
            <div>
              <p className="panel-kicker">Live note</p>
              <p className="status-copy">{statusMessage}</p>
            </div>
            <div className="status-metrics">
              <span>{primarySceneMetric}</span>
              <span>소품 {selectedTerrariumPlacements.length}개</span>
              <span>알 {selectedTerrariumEggs.length}개</span>
              <span>성장 {selectedSnailGrowth.label}</span>
              <span>성체 {adultSnailCount}마리</span>
              <span>쿨다운 {coolingSnailCount}마리</span>
              <span>부화 가능 {readyEggCount}개</span>
            </div>
          </div>

          <section className="growth-panel" aria-label={`${selectedSnail.name} 성장 기록`}>
            <div className="growth-panel__header">
              <div>
                <p className="panel-kicker">Growth Journal</p>
                <h3>{`${selectedSnail.name} 성장 기록`}</h3>
              </div>
              <span className={`mini-pill mini-pill--growth mini-pill--growth-${selectedSnailGrowth.stage}`}>
                {selectedSnailGrowth.label}
              </span>
            </div>

            <div className="growth-panel__grid">
              <article className={`growth-highlight growth-highlight--${selectedSnailGrowth.stage}`}>
                <span className="growth-highlight__eyebrow">
                  {selectedSnailGrowth.isMature ? '성장 완료' : `현재 단계 ${selectedGrowthStagePercent}%`}
                </span>
                <strong>{selectedGrowthAdultText}</strong>
                <p>{selectedSnailGrowth.description}</p>
                <small>{selectedSnailGrowth.careTip}</small>

                <div className="growth-progress" aria-hidden="true">
                  <span className="growth-progress__track">
                    <span
                      className="growth-progress__fill"
                      style={{ width: `${Math.max(10, selectedGrowthLifetimePercent)}%` }}
                    />
                  </span>
                  <span className="growth-progress__copy">
                    <span>{selectedSnailGrowth.isMature ? '성체 체형과 무늬 고정 완료' : selectedGrowthNextText}</span>
                    <strong>{`${selectedGrowthLifetimePercent}% 성장`}</strong>
                  </span>
                </div>
              </article>

              <div className="growth-metrics">
                {selectedGrowthMetrics.map((metric) => (
                  <article className="growth-metric" key={metric.label}>
                    <div className="growth-metric__copy">
                      <strong>{metric.label}</strong>
                      <span>{metric.hint}</span>
                    </div>
                    <div className="growth-metric__value">
                      <span className="growth-metric__track" aria-hidden="true">
                        <span
                          className="growth-metric__fill"
                          style={{ width: `${Math.max(8, Math.round(metric.value * 100))}%` }}
                        />
                      </span>
                      <strong>{`${Math.round(metric.value * 100)}%`}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </section>

        <aside className="sidebar-stack">
          <section className="glass-card selector-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Snail Collection</p>
                <h2>{`컬렉션 ${ownedSnails.length}마리`}</h2>
              </div>
              <span className="mini-pill">{`${collectedSpeciesCount}/5종 수집`}</span>
            </div>

            <div className="selector-list selector-list--collection">
              {ownedSnails.map((snail) => {
                const species = speciesLookup[snail.speciesId] ?? fallbackSpecies;
                const snailGrowth = getGrowthProfile(snail, clockNow);
                return (
                  <button
                    key={snail.id}
                    className={`selector-item ${snail.id === selectedSnail.id ? 'selector-item--selected' : ''}`}
                    onClick={() => { snailSounds.playSoftSelect(); setSelectedSnailId(snail.id); }}
                    type="button"
                  >
                    <span className="selector-swatch" style={{ backgroundColor: snail.accent }} />
                    <span className="selector-copy">
                      <strong>{snail.name}</strong>
                      <span>{`${species.name} · ${snail.patternLabel}`}</span>
                      <small>
                        {snailGrowth.isMature
                          ? `${snailGrowth.label} · 성체 체형 완성`
                          : `${snailGrowth.label} · ${snailGrowth.nextStageLabel ?? '성체'}까지 ${formatEggCountdown(snailGrowth.nextStageRemainingMs)}`}
                      </small>
                      <small>
                        {`세대 ${snail.generation}${snail.starter ? ' · 스타터' : ''}${
                          snailGrowth.isMature
                            ? snail.cooldownUntil > clockNow
                              ? ` · 재교배 ${formatEggCountdown(snail.cooldownUntil - clockNow)}`
                              : ' · 교배 가능'
                            : ` · 성체까지 ${formatEggCountdown(snailGrowth.adultRemainingMs)}`
                        }`}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="glass-card selector-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Starter Terrariums</p>
                <h2>시작 테마 2종</h2>
              </div>
              <span className="mini-pill">테라리움 전환</span>
            </div>

            <div className="selector-list">
              {starterTerrariums.map((terrarium) => (
                <button
                  key={terrarium.id}
                  className={`selector-item ${terrarium.id === selectedTerrarium.id ? 'selector-item--selected' : ''}`}
                  onClick={() => { snailSounds.playSoftSelect(); setSelectedTerrariumId(terrarium.id); }}
                  type="button"
                >
                  <span className="selector-copy">
                    <strong>{terrarium.name}</strong>
                    <span>{terrarium.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="glass-card support-panel support-panel--library">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Prop Library</p>
              <h2>소품 배치 편집</h2>
            </div>
            <span className="mini-pill">{selectedTerrariumPlacements.length}개 배치됨</span>
          </div>

          <div className="edit-note">
            {isEditMode
              ? '소품을 고른 뒤 테라리움 안을 탭해 배치하세요. 배치된 소품은 드래그로 이동할 수 있어요.'
              : '편집 모드가 열리면 이 라이브러리에서 바로 소품을 선택하고 배치할 수 있어요.'}
          </div>

          <div className="edit-toolbar">
            <button
              className="toolbar-button"
              disabled={!isEditMode || !selectedPlacedPropId}
              onClick={handleDeleteSelectedProp}
              type="button"
            >
              선택 소품 삭제
            </button>
            <div className="toolbar-copy">
              <strong>
                {selectedPlacedPropDefinition
                  ? `${selectedPlacedPropDefinition.name} 선택됨`
                  : selectedPaletteProp
                    ? `${selectedPaletteProp.name} 배치 준비됨`
                    : '편집 대기 중'}
              </strong>
              <span>
                {selectedPlacedPropDefinition
                  ? '현재 선택된 소품을 바로 정리할 수 있어요.'
                  : isEditMode
                    ? '소품을 선택해 배치하거나, 이미 놓은 소품을 눌러 삭제할 수 있어요.'
                    : '편집 모드를 켜면 배치와 삭제가 활성화됩니다.'}
              </span>
            </div>
          </div>

          <div className="prop-library">
            {terrariumProps.map((prop) => {
              const propCount = selectedTerrariumPlacements.filter((placement) => placement.propId === prop.id).length;
              const isSelected = selectedPalettePropId === prop.id;

              return (
                <button
                  key={prop.id}
                  className={`prop-card ${isSelected ? 'prop-card--selected' : ''}`}
                  onClick={() => handlePalettePropClick(prop.id)}
                  type="button"
                >
                  <PropVisual definition={prop} size="preview" className="prop-card__visual" />
                  <span className="prop-card__copy">
                    <strong>{prop.name}</strong>
                    <span>{prop.description}</span>
                  </span>
                  <span className="prop-card__count">{propCount}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="glass-card support-panel breeding-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Breeding Lab</p>
              <h2>{"교배 -> 알 -> 부화 -> 컬렉션"}</h2>
            </div>
            <span className="mini-pill">{readyEggCount}개 부화 가능</span>
          </div>

          <div className="collection-stats">
            <article>
              <strong>{ownedSnails.length}</strong>
              <span>보유 달팽이</span>
            </article>
            <article>
              <strong>{collectedSpeciesCount}</strong>
              <span>수집 종 수</span>
            </article>
            <article>
              <strong>{eggs.length}</strong>
              <span>대기 중인 알</span>
            </article>
            <article>
              <strong>{adultSnailCount}</strong>
              <span>성체 달팽이</span>
            </article>
          </div>

          <div className="breeding-grid">
            <label className="breeding-field">
              <span>부모 A</span>
              <select
                className="breeding-select"
                onChange={(event) => handleBreedingSelectionChange('parentAId', event.target.value)}
                value={breedingSelection.parentAId ?? ''}
              >
                <option value="">달팽이 선택</option>
                {ownedSnails.map((snail) => {
                  const species = speciesLookup[snail.speciesId] ?? fallbackSpecies;
                  const growth = getGrowthProfile(snail, clockNow);
                  return (
                    <option key={snail.id} value={snail.id}>{`${snail.name} · ${species.name} · ${growth.label}`}</option>
                  );
                })}
              </select>
            </label>

            <label className="breeding-field">
              <span>부모 B</span>
              <select
                className="breeding-select"
                onChange={(event) => handleBreedingSelectionChange('parentBId', event.target.value)}
                value={breedingSelection.parentBId ?? ''}
              >
                <option value="">달팽이 선택</option>
                {ownedSnails.map((snail) => {
                  const species = speciesLookup[snail.speciesId] ?? fallbackSpecies;
                  const growth = getGrowthProfile(snail, clockNow);
                  return (
                    <option key={snail.id} value={snail.id}>{`${snail.name} · ${species.name} · ${growth.label}`}</option>
                  );
                })}
              </select>
            </label>

            <button
              className="breeding-button"
              disabled={breedingButtonDisabled}
              onClick={handleBreedRequest}
              type="button"
            >
              {breedingButtonLabel}
            </button>
          </div>

          <div className="breeding-pair-summary">
            <span>
              {breedingParentA
                ? `${breedingParentA.name} · ${breedingParentAGrowth?.label ?? ''} · ${
                    breedingParentAGrowth && !breedingParentAGrowth.isMature
                      ? `${breedingParentAGrowth.nextStageLabel ?? '성체'}까지 ${formatEggCountdown(breedingParentAGrowth.nextStageRemainingMs)}`
                      : breedingParentACooldown > 0
                        ? `재교배 ${formatEggCountdown(breedingParentACooldown)}`
                        : '교배 가능'
                  }`
                : '부모 A 비어 있음'}
            </span>
            <span>
              {breedingParentB
                ? `${breedingParentB.name} · ${breedingParentBGrowth?.label ?? ''} · ${
                    breedingParentBGrowth && !breedingParentBGrowth.isMature
                      ? `${breedingParentBGrowth.nextStageLabel ?? '성체'}까지 ${formatEggCountdown(breedingParentBGrowth.nextStageRemainingMs)}`
                      : breedingParentBCooldown > 0
                        ? `재교배 ${formatEggCountdown(breedingParentBCooldown)}`
                        : '교배 가능'
                  }`
                : '부모 B 비어 있음'}
            </span>
            <span>{`${selectedTerrarium.name}에 알이 놓이고, 부화 후 새끼는 별도 성장 단계를 거칩니다.`}</span>
          </div>

          <div className="breeding-balance-grid">
            <article className="breeding-balance-card">
              <strong>{breedingPreview ? formatPercent(breedingPreview.rareChance) : '-'}</strong>
              <span>희귀형 결과 확률</span>
              <small>{breedingRareSpeciesNames.length > 0 ? breedingRareSpeciesNames.join(' / ') : '일반형 중심 조합'}</small>
            </article>
            <article className="breeding-balance-card">
              <strong>{breedingPreview ? formatPercent(breedingPreview.promotionChance) : '-'}</strong>
              <span>상위 승급 확률</span>
              <small>{breedingPreview && breedingPreview.promotionChance > 0 ? '희귀 단계가 한 단계 올라갈 수 있어요.' : '현재 조합은 안정형 번식 루트예요.'}</small>
            </article>
            <article className="breeding-balance-card">
              <strong>{breedingPreview ? formatEggCountdown(breedingPreview.hatchDurationMs) : '-'}</strong>
              <span>예상 부화 시간</span>
              <small>{breedingPreview ? `재교배 쿨다운 ${formatEggCountdown(breedingPreview.cooldownMs)}` : '부모 두 마리를 고르면 자동 계산됩니다.'}</small>
            </article>
          </div>

          <div className="egg-list">
            {eggs.length === 0 ? (
              <div className="egg-empty">아직 알이 없어요. 부모 두 마리를 고르고 교배를 시작해보세요.</div>
            ) : (
              eggs.map((egg) => {
                const eggSpecies = speciesLookup[egg.speciesId] ?? fallbackSpecies;
                const eggStage = getEggStage(egg, clockNow);
                const eggProgress = getEggProgress(egg, clockNow);
                const isReady = eggStage === 'ready';
                const stageLabel = eggStageLabels[eggStage];
                const stageDescription = eggStageDescriptions[eggStage];
                return (
                  <article className={`egg-card egg-card--${eggStage}`} key={egg.id}>
                    <div className="egg-card__header">
                      <span
                        className={`egg-card__swatch egg-card__swatch--${eggStage}`}
                        style={getEggVisualStyle(egg)}
                      />
                      <div className="egg-card__title">
                        <strong>{egg.plannedName}</strong>
                        <span>{`${eggSpecies.name} · ${egg.patternLabel}`}</span>
                      </div>
                      <span className={`egg-card__stage egg-card__stage--${eggStage}`}>{stageLabel}</span>
                    </div>
                    <div className="egg-card__meta">
                      <span>{`세대 ${egg.generation}`}</span>
                      <span>{starterTerrariums.find((terrarium) => terrarium.id === egg.terrariumId)?.name ?? selectedTerrarium.name}</span>
                    </div>
                    <div className="egg-card__progress" aria-hidden="true">
                      <span className={`egg-card__progress-fill egg-card__progress-fill--${eggStage}`} style={{ width: `${Math.max(8, eggProgress * 100)}%` }} />
                    </div>
                    <div className="egg-card__progress-copy">
                      <span>{stageDescription}</span>
                      <strong>{isReady ? '100% 진행 · 즉시 부화 가능' : `${Math.round(eggProgress * 100)}% 진행`}</strong>
                    </div>
                    <button className="egg-card__button" onClick={() => handleHatchEgg(egg.id)} type="button">
                      {isReady ? '부화시키기' : formatEggCountdown(egg.hatchAt - clockNow)}
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;






















