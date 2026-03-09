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

export type MainAction = {
  id: ActionId;
  label: string;
  description: string;
};

export type OwnedSnail = {
  id: string;
  name: string;
  speciesId: string;
  accent: string;
  patternLabel: string;
  generation: number;
  bornAt: number;
  cooldownUntil: number;
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
  plannedName: string;
  generation: number;
  laidAt: number;
  hatchAt: number;
};

export type BreedingSelection = {
  parentAId: string | null;
  parentBId: string | null;
};

export type StoredGameState = {
  selectedSnailId: string;
  selectedTerrariumId: string;
  statusMessage: string;
  ownedSnails: OwnedSnail[];
  eggs: SnailEgg[];
  breedingSelection: BreedingSelection;
};





