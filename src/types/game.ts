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

export type ActionId = 'feed' | 'touch' | 'breed' | 'edit';

export type MainAction = {
  id: ActionId;
  label: string;
  description: string;
};

export type PropVariant =
  | 'moss'
  | 'fern'
  | 'mushroom-small'
  | 'mushroom-tall'
  | 'stone-flat'
  | 'stone-pile'
  | 'tunnel'
  | 'log'
  | 'leaf-arch'
  | 'bowl'
  | 'dish'
  | 'sign'
  | 'pot'
  | 'waterfall'
  | 'vine'
  | 'sprout'
  | 'lamp'
  | 'clover';

export type PropPlacementMode = 'floor' | 'free' | 'ceiling';

export type TerrariumPropDefinition = {
  id: string;
  name: string;
  description: string;
  accent: string;
  secondaryAccent: string;
  variant: PropVariant;
  placementMode: PropPlacementMode;
  width: number;
  height: number;
};

export type PlacedTerrariumProp = {
  id: string;
  propId: string;
  x: number;
  y: number;
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
  isEditMode: boolean;
  statusMessage: string;
  selectedPalettePropId: string | null;
  placedPropsByTerrarium: Record<string, PlacedTerrariumProp[]>;
  ownedSnails: OwnedSnail[];
  eggs: SnailEgg[];
  breedingSelection: BreedingSelection;
};

