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

export type OwnedSnail = SnailIdentity & {
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

export type SnailEgg = {
  id: string;
  terrariumId: string;
  parentAId: string;
  parentBId: string;
  speciesId: string;
  accent: string;
  patternLabel: string;
  generation: number;
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
};

export type ManualSaveSlot = {
  savedAt: number;
  state: StoredGameState;
};
