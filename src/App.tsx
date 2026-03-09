import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { mainActions, snailSpecies, starterTerrariums } from './data/gameContent';
import type { ActionId, BreedingSelection, OwnedSnail, SnailEgg, SnailSpecies, StoredGameState } from './types/game';
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
const starterSnails = createStarterSnailCollection();
const fallbackOwnedSnail = starterSnails[0]!;
const defaultBreedingSelection: BreedingSelection = {
  parentAId: starterSnails[0]?.id ?? null,
  parentBId: starterSnails[1]?.id ?? null
};

type MotionPhase = (typeof motionPhases)[number];

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

type SnailSceneAnchor = {
  left: number;
  bottom: number;
  rotation: number;
  flip: boolean;
  driftX: number;
  driftY: number;
  phaseOffset: number;
};

type SnailSceneSlot = {
  left: number;
  bottom: number;
  rotation: number;
  flip: boolean;
  driftX: number;
  driftY: number;
  phase: MotionPhase;
  duration: number;
  delay: number;
  zIndex: number;
};

const mossTerrariumAnchors: SnailSceneAnchor[] = [
  { left: 14, bottom: 98, rotation: -5, flip: false, driftX: 10, driftY: 1, phaseOffset: 0 },
  { left: 29, bottom: 106, rotation: 0, flip: false, driftX: 12, driftY: 2, phaseOffset: 1 },
  { left: 46, bottom: 92, rotation: -3, flip: false, driftX: 8, driftY: 1, phaseOffset: 2 },
  { left: 63, bottom: 108, rotation: 3, flip: true, driftX: -10, driftY: 2, phaseOffset: 0 },
  { left: 80, bottom: 94, rotation: 1, flip: true, driftX: -8, driftY: 1, phaseOffset: 1 },
  { left: 34, bottom: 208, rotation: -58, flip: false, driftX: -3, driftY: 14, phaseOffset: 2 },
  { left: 55, bottom: 244, rotation: -18, flip: false, driftX: 4, driftY: 7, phaseOffset: 3 },
  { left: 76, bottom: 218, rotation: -64, flip: false, driftX: 3, driftY: 16, phaseOffset: 1 }
];

const rainTerrariumAnchors: SnailSceneAnchor[] = [
  { left: 16, bottom: 100, rotation: -3, flip: false, driftX: 9, driftY: 1, phaseOffset: 0 },
  { left: 32, bottom: 108, rotation: 1, flip: false, driftX: 12, driftY: 2, phaseOffset: 1 },
  { left: 50, bottom: 94, rotation: -4, flip: false, driftX: 8, driftY: 1, phaseOffset: 2 },
  { left: 67, bottom: 110, rotation: 2, flip: true, driftX: -10, driftY: 2, phaseOffset: 0 },
  { left: 83, bottom: 96, rotation: 0, flip: true, driftX: -8, driftY: 1, phaseOffset: 1 },
  { left: 40, bottom: 206, rotation: -61, flip: false, driftX: -3, driftY: 16, phaseOffset: 2 },
  { left: 61, bottom: 240, rotation: -14, flip: false, driftX: 4, driftY: 7, phaseOffset: 3 },
  { left: 78, bottom: 216, rotation: -66, flip: false, driftX: 3, driftY: 18, phaseOffset: 1 }
];

function getSnailSceneSlot(terrariumId: string, snailIndex: number, motionSeed: number): SnailSceneSlot {
  const anchors = terrariumId === 'rain-window-tank' ? rainTerrariumAnchors : mossTerrariumAnchors;
  const anchor = anchors[snailIndex % anchors.length] ?? anchors[0]!;
  const cycle = Math.floor(snailIndex / anchors.length);
  const spreadOffset = cycle === 0 ? 0 : (cycle % 2 === 0 ? 1 : -1) * (4 + cycle * 1.5);
  const phase = motionPhases[(anchor.phaseOffset + motionSeed) % motionPhases.length]!;

  return {
    left: clamp(anchor.left + spreadOffset, 10, 90),
    bottom: anchor.bottom + cycle * 10,
    rotation: anchor.rotation + cycle,
    flip: anchor.flip,
    driftX: anchor.driftX,
    driftY: anchor.driftY + cycle * 2,
    phase,
    duration: 26 + (snailIndex % 4) * 3.2,
    delay: -snailIndex * 2.4,
    zIndex: 6 + cycle + Math.round(anchor.bottom / 32)
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function cloneSnails(snails: OwnedSnail[]): OwnedSnail[] {
  return snails.map((snail) => ({ ...snail }));
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

  const [selectedSnailId, setSelectedSnailId] = useState(fallbackOwnedSnail.id);
  const [selectedTerrariumId, setSelectedTerrariumId] = useState(fallbackTerrarium.id);
  const [statusMessage, setStatusMessage] = useState(
    '먹이, 터치, 교배만 남기고 화면을 단순화했어요. 먼저 달팽이 한 마리를 골라 천천히 관찰해보세요.'
  );
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const [motionPhaseIndex, setMotionPhaseIndex] = useState(0);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [ownedSnails, setOwnedSnails] = useState<OwnedSnail[]>(() => cloneSnails(starterSnails));
  const [eggs, setEggs] = useState<SnailEgg[]>([]);
  const [breedingSelection, setBreedingSelection] = useState<BreedingSelection>(defaultBreedingSelection);
  const [sceneEffect, setSceneEffect] = useState<SceneEffect>(null);

  const lastSceneSoundKeyRef = useRef('');

  useEffect(() => {
    const storedState = loadStoredGameState();
    const normalizedSnails = normalizeOwnedSnails(storedState?.ownedSnails, speciesLookup);
    const ownedSnailIds = new Set(normalizedSnails.map((snail) => snail.id));
    const terrariumIds = new Set(starterTerrariums.map((terrarium) => terrarium.id));

    setOwnedSnails(normalizedSnails);
    setEggs(normalizeEggs(storedState?.eggs, terrariumIds, ownedSnailIds, speciesLookup));
    setBreedingSelection(normalizeBreedingSelection(storedState?.breedingSelection, normalizedSnails));

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

    if (typeof storedState?.statusMessage === 'string') {
      setStatusMessage(storedState.statusMessage);
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
      statusMessage,
      ownedSnails,
      eggs,
      breedingSelection
    };

    saveStoredGameState(nextState);
  }, [breedingSelection, eggs, hasHydrated, ownedSnails, selectedSnailId, selectedTerrariumId, statusMessage]);

  useEffect(() => {
    const motionIntervalId = window.setInterval(() => {
      setMotionPhaseIndex((currentPhaseIndex) => (currentPhaseIndex + 1) % motionPhases.length);
    }, 13800);

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

  const selectedSnail = ownedSnails.find((snail) => snail.id === selectedSnailId) ?? fallbackOwnedSnail;
  const selectedSnailIndex = Math.max(0, ownedSnails.findIndex((snail) => snail.id === selectedSnail.id));
  const selectedSnailSceneSlot = getSnailSceneSlot(selectedTerrariumId, selectedSnailIndex, motionPhaseIndex);
  const motionPhase = selectedSnailSceneSlot.phase;
  const selectedSnailGrowth = getGrowthProfile(selectedSnail, clockNow);
  const selectedTerrarium =
    starterTerrariums.find((terrarium) => terrarium.id === selectedTerrariumId) ?? fallbackTerrarium;
  const selectedTerrariumEggs = eggs.filter((egg) => egg.terrariumId === selectedTerrarium.id);
  const previewTerrariumEggs = selectedTerrariumEggs.slice(0, 4);
  const featuredTerrariumEgg = previewTerrariumEggs[0] ?? null;
  const featuredTerrariumEggStage = featuredTerrariumEgg ? getEggStage(featuredTerrariumEgg, clockNow) : null;
  const featuredTerrariumEggStageLabel = featuredTerrariumEggStage ? eggStageLabels[featuredTerrariumEggStage] : null;
  const compactEggs = selectedTerrariumEggs.slice(0, 3);
  const hiddenEggCount = Math.max(0, selectedTerrariumEggs.length - compactEggs.length);
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
  const isLayingSceneActive = sceneEffect?.kind === 'laying' && sceneEffect.terrariumId === selectedTerrarium.id;
  const isHatchingSceneActive = sceneEffect?.kind === 'hatching' && sceneEffect.terrariumId === selectedTerrarium.id;
  const visibleSceneEffectAccent =
    sceneEffect && sceneEffect.terrariumId === selectedTerrarium.id ? sceneEffect.accent : '#eef6e9';
  const visibleSceneEffectLabel =
    sceneEffect && sceneEffect.terrariumId === selectedTerrarium.id ? sceneEffect.label : '';
  const activeActionLabel = activeAction
    ? mainActions.find((action) => action.id === activeAction)?.label ?? '반응'
    : '관찰';

  function handleInterfacePointerDownCapture() {
    snailSounds.prime();
  }

  function handleBreedingSelectionChange(slot: 'parentAId' | 'parentBId', value: string) {
    snailSounds.playSoftSelect();
    setBreedingSelection((currentSelection) => ({
      ...currentSelection,
      [slot]: value || null
    }));
  }

  function handleSnailSelect(snail: OwnedSnail) {
    snailSounds.playSoftSelect();
    const species = speciesLookup[snail.speciesId] ?? fallbackSpecies;
    const growth = getGrowthProfile(snail, clockNow);
    setSelectedSnailId(snail.id);
    setStatusMessage(`${snail.name}를 관찰 중이에요. ${species.name} · ${growth.label} · ${growth.sceneDescription}`);
  }

  function handleTerrariumSelect(terrariumId: string) {
    const terrarium = starterTerrariums.find((candidate) => candidate.id === terrariumId) ?? fallbackTerrarium;
    snailSounds.playSoftSelect();
    setSelectedTerrariumId(terrariumId);
    setStatusMessage(`${terrarium.name}로 시점을 옮겼어요. 먹이, 터치, 교배 반응이 이 공간 기준으로 이어집니다.`);
  }

  function handleBreedRequest() {
    if (!breedingParentA || !breedingParentB) {
      snailSounds.playBlocked();
      setStatusMessage('교배 카드에서 부모 A와 부모 B를 먼저 선택해주세요.');
      return;
    }

    if (breedingParentA.id === breedingParentB.id) {
      snailSounds.playBlocked();
      setStatusMessage('같은 달팽이를 두 부모로 동시에 넣을 수는 없어요. 다른 짝을 골라주세요.');
      return;
    }

    if (breedingMaturityBlocked) {
      const growthNotes = [
        breedingParentAGrowth && !breedingParentAGrowth.isMature
          ? `${breedingParentA.name} ${breedingParentAGrowth.nextStageLabel ?? '성체'}까지 ${formatEggCountdown(breedingParentAGrowth.nextStageRemainingMs)}`
          : null,
        breedingParentBGrowth && !breedingParentBGrowth.isMature
          ? `${breedingParentB.name} ${breedingParentBGrowth.nextStageLabel ?? '성체'}까지 ${formatEggCountdown(breedingParentBGrowth.nextStageRemainingMs)}`
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
      `${breedingParentA.name}와 ${breedingParentB.name}가 가까이 밀착한 뒤 촉촉한 바닥에 새 알이 놓였어요. ` +
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
      `${newbornSnail.name}이(가) 껍질을 밀어 깨고 나왔어요. 지금은 ${newbornGrowth.label} 단계이고, 성체까지 ${formatEggCountdown(newbornGrowth.adultRemainingMs)} 동안 천천히 자랍니다.`
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
  }

  function renderSnailFigure(
    snail: OwnedSnail,
    growthProfile: GrowthProfile,
    extraClasses: string[],
    options?: {
      style?: CSSProperties;
      onClick?: () => void;
      badge?: string | null;
      ariaLabel?: string;
    }
  ) {
    const isInteractive = typeof options?.onClick === 'function';

    return (
      <div
        className={[
          'snail-figure',
          `snail-figure--${snail.speciesId}`,
          `snail-figure--growth-${growthProfile.stage}`,
          isInteractive ? 'snail-figure--interactive' : '',
          ...extraClasses
        ].filter(Boolean).join(' ')}
        style={{
          ...options?.style,
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
        {options?.badge ? <span className="snail-figure__badge">{options.badge}</span> : null}
        {isInteractive ? (
          <button
            className="snail-hitbox"
            type="button"
            aria-label={options?.ariaLabel}
            onClick={options?.onClick}
          />
        ) : null}
        <div className="snail-figure__inner" aria-hidden={isInteractive ? true : undefined}>
          <div className="snail-shadow" />
          <div className="snail-trail-sheen" />
          <div className="snail-shell" style={{ ['--shell-accent' as string]: snail.accent }}>
            <span className="snail-shell__glaze" />
            <span className="snail-shell__growth-ring" />
            <span className="snail-shell__ridge snail-shell__ridge--outer" />
            <span className="snail-shell__ridge snail-shell__ridge--mid" />
            <span className="snail-shell__ridge snail-shell__ridge--core" />
          </div>
          <div className="snail-body">
            <span className="snail-body__mottle snail-body__mottle--a" />
            <span className="snail-body__mottle snail-body__mottle--b" />
            <span className="snail-body__mottle snail-body__mottle--c" />
            <span className="snail-mantle" />
            <span className="snail-foot" />
            <span className="snail-foot__ripple snail-foot__ripple--a" />
            <span className="snail-foot__ripple snail-foot__ripple--b" />
          </div>
          <div className="snail-head">
            <span className="snail-lip" />
            <span className="snail-mouth" />
          </div>
          <span className="snail-breathing-pore" />
          <span className="snail-tentacle snail-tentacle--low-left" />
          <span className="snail-tentacle snail-tentacle--low-right" />
          <span className="snail-eye snail-eye--left" />
          <span className="snail-eye snail-eye--right" />
        </div>
      </div>
    );
  }

  const sceneCaptionTitle = isHatchingSceneActive
    ? `${visibleSceneEffectLabel} 부화`
    : isLayingSceneActive && breedingParentA && breedingParentB
      ? `${breedingParentA.name} x ${breedingParentB.name}`
      : isBreedingSceneActive && breedingParentA && breedingParentB
        ? `${breedingParentA.name} x ${breedingParentB.name}`
        : selectedSnail.name;
  const sceneCaptionTag = isHatchingSceneActive
    ? '부화'
    : isLayingSceneActive
      ? '산란'
      : isBreedingSceneActive
        ? breedingPreview
          ? `희귀 ${formatPercent(breedingPreview.rareChance)}`
          : '교배'
        : selectedTerrariumEggs.length > 0 && featuredTerrariumEggStageLabel
          ? featuredTerrariumEggStageLabel
          : `${selectedSnailGrowth.label} / ${motionPhaseLabels[motionPhase]}`;
  const breedingPreviewChips = breedingPreview
    ? [
        `희귀 ${formatPercent(breedingPreview.rareChance)}`,
        `부화 ${formatEggCountdown(breedingPreview.hatchDurationMs)}`,
        `쿨다운 ${formatEggCountdown(breedingPreview.cooldownMs)}`
      ]
    : [];

  return (
    <div className="app-shell app-shell--quiet" onPointerDownCapture={handleInterfacePointerDownCapture}>
      <main className="terrarium-focus-layout">
        <section className="glass-card terrarium-panel terrarium-panel--simple terrarium-panel--focused">
          <div className="terrarium-topbar">
            <div className="terrarium-switcher terrarium-switcher--compact" role="group" aria-label="Terrarium switcher">
              {starterTerrariums.map((terrarium) => (
                <button
                  key={terrarium.id}
                  className={`terrarium-tab terrarium-tab--compact ${terrarium.id === selectedTerrarium.id ? 'terrarium-tab--selected' : ''}`}
                  onClick={() => handleTerrariumSelect(terrarium.id)}
                  type="button"
                >
                  <strong>{terrarium.name}</strong>
                </button>
              ))}
            </div>

            <div className="terrarium-chipbar" aria-label="Terrarium summary">
              <span className="mini-pill">{`${ownedSnails.length}마리`}</span>
              {selectedTerrariumEggs.length > 0 ? <span className="mini-pill">{`알 ${selectedTerrariumEggs.length}`}</span> : null}
              <span className="mini-pill">{`${selectedSnail.name} / ${activeActionLabel}`}</span>
            </div>
          </div>

          <div
            className={[
              'terrarium-scene',
              `terrarium-scene--${selectedTerrarium.id}`,
              activeAction ? `terrarium-scene--action-${activeAction}` : '',
              isLayingSceneActive ? 'terrarium-scene--event-laying' : '',
              isHatchingSceneActive ? 'terrarium-scene--event-hatching' : '',
              'terrarium-scene--shared'
            ]
              .filter(Boolean)
              .join(' ')}
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
                  ? `알 ${selectedTerrariumEggs.length} / ${featuredTerrariumEggStageLabel}`
                  : `알 ${selectedTerrariumEggs.length}`}
              </span>
            </div>

            {ownedSnails.map((snail, index) => {
              const isBreedingParent = breedingParentA?.id === snail.id || breedingParentB?.id === snail.id;
              if (isBreedingSceneActive && isBreedingParent) {
                return null;
              }

              const sceneSlot = getSnailSceneSlot(selectedTerrarium.id, index, motionPhaseIndex);
              const growth = getGrowthProfile(snail, clockNow);
              const species = speciesLookup[snail.speciesId] ?? fallbackSpecies;
              const isSelected = snail.id === selectedSnail.id;

              return renderSnailFigure(
                snail,
                growth,
                [
                  'snail-figure--scene',
                  `snail-figure--pose-${sceneSlot.phase}`,
                  isSelected ? 'snail-figure--selected' : '',
                  isBreedingSceneActive ? 'snail-figure--scene-muted' : '',
                  activeAction && isSelected ? `snail-figure--action-${activeAction}` : ''
                ],
                {
                  onClick: () => handleSnailSelect(snail),
                  badge: isSelected ? '관찰 중' : null,
                  ariaLabel: `${snail.name}, ${species.name}, ${growth.label}`,
                  style: {
                    left: `${sceneSlot.left}%`,
                    bottom: `${sceneSlot.bottom}px`,
                    zIndex: isSelected ? sceneSlot.zIndex + 3 : sceneSlot.zIndex,
                    ['--snail-scene-rotation' as string]: `${sceneSlot.rotation}deg`,
                    ['--snail-flip' as string]: sceneSlot.flip ? '-1' : '1',
                    ['--snail-drift-x' as string]: `${sceneSlot.driftX}px`,
                    ['--snail-drift-y' as string]: `${sceneSlot.driftY}px`,
                    ['--snail-drift-duration' as string]: `${sceneSlot.duration}s`,
                    ['--snail-drift-delay' as string]: `${sceneSlot.delay}s`
                  }
                }
              );
            })}

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
                {breedingParentAGrowth
                  ? renderSnailFigure(breedingParentA, breedingParentAGrowth, ['snail-figure--breeding', 'snail-figure--breeding-a'])
                  : null}
                {breedingParentBGrowth
                  ? renderSnailFigure(breedingParentB, breedingParentBGrowth, ['snail-figure--breeding', 'snail-figure--breeding-b'])
                  : null}
              </div>
            ) : null}

            <div className="scene-caption scene-caption--minimal">
              <strong>{sceneCaptionTitle}</strong>
              <span>{sceneCaptionTag}</span>
            </div>
          </div>

          <div className="action-dock action-dock--simple action-dock--minimal" role="group" aria-label="Main actions">
            {mainActions.map((action) => (
              <button
                key={action.id}
                className={`action-button ${action.id === activeAction ? 'action-button--active' : ''}`}
                onClick={() => handleAction(action.id)}
                type="button"
                aria-label={`${action.label} / ${action.description}`}
              >
                <strong>{action.label}</strong>
              </button>
            ))}
          </div>

          <div className="selection-stack">
            <div className="snail-strip snail-strip--minimal" aria-label="Snail selection strip">
              {ownedSnails.map((snail) => {
                const species = speciesLookup[snail.speciesId] ?? fallbackSpecies;
                const snailGrowth = getGrowthProfile(snail, clockNow);
                const isSelected = snail.id === selectedSnail.id;

                return (
                  <button
                    key={snail.id}
                    className={`snail-pill snail-pill--minimal ${isSelected ? 'snail-pill--selected' : ''}`}
                    onClick={() => handleSnailSelect(snail)}
                    type="button"
                    aria-label={`${snail.name} / ${species.name} / ${snailGrowth.label}`}
                  >
                    <span className="snail-pill__accent" style={{ backgroundColor: snail.accent }} />
                    <span className="snail-pill__name">{snail.name}</span>
                  </button>
                );
              })}
            </div>

            {activeAction === 'breed' ? (
              <div className="breed-tray">
                <div className="breed-selects">
                  <select
                    aria-label="부모 A"
                    className="breeding-select"
                    onChange={(event) => handleBreedingSelectionChange('parentAId', event.target.value)}
                    value={breedingSelection.parentAId ?? ''}
                  >
                    <option value="">부모 A</option>
                    {ownedSnails.map((snail) => {
                      const species = speciesLookup[snail.speciesId] ?? fallbackSpecies;
                      const growth = getGrowthProfile(snail, clockNow);
                      return (
                        <option key={snail.id} value={snail.id}>{`${snail.name} / ${species.name} / ${growth.label}`}</option>
                      );
                    })}
                  </select>

                  <select
                    aria-label="부모 B"
                    className="breeding-select"
                    onChange={(event) => handleBreedingSelectionChange('parentBId', event.target.value)}
                    value={breedingSelection.parentBId ?? ''}
                  >
                    <option value="">부모 B</option>
                    {ownedSnails.map((snail) => {
                      const species = speciesLookup[snail.speciesId] ?? fallbackSpecies;
                      const growth = getGrowthProfile(snail, clockNow);
                      return (
                        <option key={snail.id} value={snail.id}>{`${snail.name} / ${species.name} / ${growth.label}`}</option>
                      );
                    })}
                  </select>

                  <button
                    className="breeding-button breeding-button--compact"
                    disabled={breedingButtonDisabled}
                    onClick={handleBreedRequest}
                    type="button"
                  >
                    {breedingButtonLabel}
                  </button>
                </div>

                {breedingPreviewChips.length > 0 ? (
                  <div className="breed-preview-row">
                    {breedingPreviewChips.map((chip) => (
                      <span className="mini-pill mini-pill--soft" key={chip}>{chip}</span>
                    ))}
                  </div>
                ) : null}

                {selectedTerrariumEggs.length > 0 ? (
                  <div className="egg-strip egg-strip--minimal">
                    {compactEggs.map((egg) => {
                      const eggStage = getEggStage(egg, clockNow);
                      const isReady = eggStage === 'ready';

                      return (
                        <article className={`egg-chip egg-chip--${eggStage}`} key={egg.id}>
                          <span
                            className={`egg-card__swatch egg-card__swatch--${eggStage}`}
                            style={getEggVisualStyle(egg)}
                          />
                          <div className="egg-chip__copy" title={eggStageDescriptions[eggStage]}>
                            <strong>{egg.plannedName}</strong>
                            <span>{isReady ? '부화 가능' : eggStageLabels[eggStage]}</span>
                          </div>
                          <button className="egg-card__button egg-card__button--compact" onClick={() => handleHatchEgg(egg.id)} type="button">
                            {isReady ? '부화' : formatEggCountdown(egg.hatchAt - clockNow)}
                          </button>
                        </article>
                      );
                    })}
                    {hiddenEggCount > 0 ? <span className="mini-pill mini-pill--soft">{`+${hiddenEggCount}`}</span> : null}
                  </div>
                ) : null}
              </div>
            ) : selectedTerrariumEggs.length > 0 ? (
              <div className="egg-strip egg-strip--minimal">
                {compactEggs.map((egg) => {
                  const eggStage = getEggStage(egg, clockNow);
                  const isReady = eggStage === 'ready';

                  return (
                    <article className={`egg-chip egg-chip--${eggStage}`} key={egg.id}>
                      <span
                        className={`egg-card__swatch egg-card__swatch--${eggStage}`}
                        style={getEggVisualStyle(egg)}
                      />
                      <div className="egg-chip__copy" title={eggStageDescriptions[eggStage]}>
                        <strong>{egg.plannedName}</strong>
                        <span>{isReady ? '부화 가능' : eggStageLabels[eggStage]}</span>
                      </div>
                      <button className="egg-card__button egg-card__button--compact" onClick={() => handleHatchEgg(egg.id)} type="button">
                        {isReady ? '부화' : formatEggCountdown(egg.hatchAt - clockNow)}
                      </button>
                    </article>
                  );
                })}
                {hiddenEggCount > 0 ? <span className="mini-pill mini-pill--soft">{`+${hiddenEggCount}`}</span> : null}
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
