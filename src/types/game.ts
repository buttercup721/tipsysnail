export type SnailSpecies = {
  id: string;
  name: string;
  shellTone: string;
  accent: string;
  trait: string;
  description: string;
};

export type StarterTerrarium = {
  id: string;
  name: string;
  mood: string;
  description: string;
  highlights: string[];
};

export type ActionId = 'feed' | 'touch' | 'breed';
export type FoodType = 'cucumber' | 'carrot';
export type RarityLabel = 'common' | 'rare' | 'epic';
export type ShellPattern = 'banded' | 'speckled' | 'ripple' | 'split' | 'halo';
export type ShellFinish = 'matte' | 'dewy' | 'pearlescent' | 'aurora';

export type MainAction = {
  id: ActionId;
  label: string;
  description: string;
};

export type SnailIdentity = {
  name: string;
  baseName: string;
  rarePrefix: string | null;
};

export type SnailMorph = {
  morphRarity: RarityLabel;
  shellPattern: ShellPattern;
  shellFinish: ShellFinish;
  shellSecondary: string;
  bodyTint: string;
  auraTint: string;
};

export type OwnedSnail = SnailIdentity & SnailMorph & {
  id: string;
  speciesId: string;
  accent: string;
  patternLabel: string;
  generation: number;
  bornAt: number;
  cooldownUntil: number;
  growthPoints: number;
  starter: boolean;
};

export type SnailEgg = SnailMorph & {
  id: string;
  terrariumId: string;
  parentAId: string;
  parentBId: string;
  speciesId: string;
  accent: string;
  patternLabel: string;
  generation: number;
  x: number;
  y: number;
  laidAt: number;
  hatchAt: number;
};

export type BreedingSelection = {
  parentAId: string | null;
  parentBId: string | null;
};

export type FoodInventory = Record<FoodType, number>;

export type StoredGameState = {
  saveVersion: number;
  selectedSnailId: string;
  selectedTerrariumId: string;
  statusMessage: string;
  balance: number;
  foodInventory: FoodInventory;
  ownedSnails: OwnedSnail[];
  eggs: SnailEgg[];
  breedingSelection: BreedingSelection;
  rescueGiftCount: number;
  rescueGiftCooldownUntil: number;
};

export type ManualSaveSlot = {
  savedAt: number;
  state: StoredGameState;
};
