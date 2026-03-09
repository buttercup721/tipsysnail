import type { FoodInventory, FoodType, OwnedSnail } from '../types/game';
import type { GrowthProfile, GrowthStage } from './snailGrowth';
import { getSpeciesTier } from './snailLifecycle';
import { getMorphValueBonus } from './snailMorphs';

export type FoodOption = {
  type: FoodType;
  label: string;
  cost: number;
  growthGain: number;
  description: string;
};

export type FoodBundle = {
  type: FoodType;
  label: string;
  quantity: number;
  cost: number;
  description: string;
};

export const starterBalance = 260;
export const starterFoodInventory: FoodInventory = {
  cucumber: 6,
  carrot: 1
};

export const foodCatalog: Record<FoodType, FoodOption> = {
  cucumber: {
    type: 'cucumber',
    label: '오이',
    cost: 0,
    growthGain: 10,
    description: '가볍게 자주 주기 좋은 기본 먹이'
  },
  carrot: {
    type: 'carrot',
    label: '당근',
    cost: 0,
    growthGain: 50,
    description: '성장 점수를 크게 올려 주는 프리미엄 먹이'
  }
};

export const foodShopBundles: Record<FoodType, FoodBundle> = {
  cucumber: {
    type: 'cucumber',
    label: '오이 묶음',
    quantity: 6,
    cost: 30,
    description: '오이 6개를 넉넉하게 채워 둡니다.'
  },
  carrot: {
    type: 'carrot',
    label: '당근 세트',
    quantity: 2,
    cost: 78,
    description: '당근 2개를 바로 쓸 수 있게 담아 둡니다.'
  }
};

const stageValueTable: Record<GrowthStage, number> = {
  newborn: 0,
  hatchling: 28,
  juvenile: 66,
  subadult: 118,
  adult: 176
};

const rarityBaseValueTable: Record<number, number> = {
  0: 52,
  1: 134,
  2: 224
};

export function getSnailSaleValue(snail: OwnedSnail, growthProfile: GrowthProfile): number {
  const rarityTier = Math.min(2, getSpeciesTier(snail.speciesId));
  const baseValue = rarityBaseValueTable[rarityTier] ?? rarityBaseValueTable[0] ?? 52;
  const generationBonus = Math.max(0, snail.generation - 1) * 10;
  const morphBonus = getMorphValueBonus(snail);
  return baseValue + stageValueTable[growthProfile.stage] + generationBonus + morphBonus;
}

export function formatCurrency(value: number): string {
  return `${value}P`;
}
