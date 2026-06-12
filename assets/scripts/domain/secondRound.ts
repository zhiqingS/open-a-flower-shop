import type { MaterialId } from "./bouquetRules";

export type FlowerId = MaterialId | "coral-rose";

export type SecondRoundPhase =
  | "reward"
  | "draw"
  | "discovery"
  | "planting"
  | "watering"
  | "caring"
  | "inspiration"
  | "growing"
  | "harvesting"
  | "crafting"
  | "delivery"
  | "upgrade"
  | "complete";

export type SecondRoundGrowth = "empty" | "planted" | "watered" | "mature" | "harvested";
export type SecondRoundBouquetId = "warm-wish" | "spring-letter";

export interface SecondRoundPlotDefinition {
  id: string;
  flowerId: FlowerId;
  harvestCount: number;
  hasPest?: boolean;
}

export interface SecondRoundPlot extends SecondRoundPlotDefinition {
  growth: SecondRoundGrowth;
  pestCleared: boolean;
}

export interface SecondRoundBouquet {
  id: SecondRoundBouquetId;
  name: string;
  description: string;
  rewardCoins: number;
  recipe: Partial<Record<FlowerId, number>>;
}

export interface SecondRoundState {
  phase: SecondRoundPhase;
  plots: SecondRoundPlot[];
  seeds: Record<FlowerId, number>;
  inventory: Record<FlowerId, number>;
  coins: number;
  storeLevel: number;
  unlockedPlotCount: number;
  rewardClaimed: boolean;
  freeDrawAvailable: boolean;
  coralRoseUnlocked: boolean;
  selectedBouquetId?: SecondRoundBouquetId;
  bouquetMade: boolean;
  orderDelivered: boolean;
  oneTapHarvestUnlocked: boolean;
}

export const SECOND_ROUND_FLOWERS: Record<
  FlowerId,
  { name: string; shortName: string }
> = {
  dahlia: { name: "粉色大丽花", shortName: "大丽花" },
  ranunculus: { name: "香槟色洋牡丹", shortName: "洋牡丹" },
  delphinium: { name: "蓝色飞燕草", shortName: "飞燕草" },
  daisy: { name: "白色小雏菊", shortName: "小雏菊" },
  "coral-rose": { name: "珊瑚玫瑰", shortName: "珊瑚玫瑰" },
};

export const SECOND_ROUND_BOUQUETS: readonly SecondRoundBouquet[] = [
  {
    id: "warm-wish",
    name: "暖阳心愿",
    description: "柔和、明亮，适合送给重要的人",
    rewardCoins: 160,
    recipe: {
      dahlia: 2,
      "coral-rose": 2,
      daisy: 2,
    },
  },
  {
    id: "spring-letter",
    name: "春日来信",
    description: "清新舒展，像刚拆开的春日信笺",
    rewardCoins: 190,
    recipe: {
      dahlia: 2,
      "coral-rose": 2,
      delphinium: 2,
    },
  },
] as const;

export const SECOND_ROUND_PLOTS: readonly SecondRoundPlotDefinition[] = [
  { id: "round-2-plot-1", flowerId: "dahlia", harvestCount: 2 },
  { id: "round-2-plot-2", flowerId: "dahlia", harvestCount: 2 },
  { id: "round-2-plot-3", flowerId: "coral-rose", harvestCount: 2, hasPest: true },
  { id: "round-2-plot-4", flowerId: "coral-rose", harvestCount: 2 },
  { id: "round-2-plot-5", flowerId: "delphinium", harvestCount: 2 },
  { id: "round-2-plot-6", flowerId: "daisy", harvestCount: 2 },
] as const;

export const SECOND_ROUND_REWARD_COINS = 60;

const createFlowerCounts = (): Record<FlowerId, number> => ({
  dahlia: 0,
  ranunculus: 0,
  delphinium: 0,
  daisy: 0,
  "coral-rose": 0,
});

const cloneState = (state: SecondRoundState): SecondRoundState => ({
  ...state,
  plots: state.plots.map((plot) => ({ ...plot })),
  seeds: { ...state.seeds },
  inventory: { ...state.inventory },
});

const requirePhase = (
  state: SecondRoundState,
  expected: SecondRoundPhase,
  action: string,
): void => {
  if (state.phase !== expected) {
    throw new Error(`${action} requires phase ${expected}, received ${state.phase}`);
  }
};

const getPlot = (state: SecondRoundState, plotId: string): SecondRoundPlot => {
  const plot = state.plots.find((candidate) => candidate.id === plotId);
  if (!plot) {
    throw new Error(`Unknown second-round plot: ${plotId}`);
  }
  return plot;
};

export const getSecondRoundBouquet = (
  bouquetId: SecondRoundBouquetId,
): SecondRoundBouquet => {
  const bouquet = SECOND_ROUND_BOUQUETS.find((candidate) => candidate.id === bouquetId);
  if (!bouquet) {
    throw new Error(`Unknown second-round bouquet: ${bouquetId}`);
  }
  return bouquet;
};

export const createSecondRoundState = (startingCoins: number): SecondRoundState => ({
  phase: "reward",
  plots: SECOND_ROUND_PLOTS.map((plot) => ({
    ...plot,
    growth: "empty",
    pestCleared: false,
  })),
  seeds: createFlowerCounts(),
  inventory: createFlowerCounts(),
  coins: startingCoins,
  storeLevel: 1,
  unlockedPlotCount: 6,
  rewardClaimed: false,
  freeDrawAvailable: false,
  coralRoseUnlocked: false,
  bouquetMade: false,
  orderDelivered: false,
  oneTapHarvestUnlocked: false,
});

export const claimSecondRoundReward = (state: SecondRoundState): SecondRoundState => {
  requirePhase(state, "reward", "claimSecondRoundReward");
  const next = cloneState(state);
  next.rewardClaimed = true;
  next.coins += SECOND_ROUND_REWARD_COINS;
  next.storeLevel = 2;
  next.freeDrawAvailable = true;
  next.phase = "draw";
  return next;
};

export const drawCoralRose = (state: SecondRoundState): SecondRoundState => {
  requirePhase(state, "draw", "drawCoralRose");
  if (!state.freeDrawAvailable || state.coralRoseUnlocked) {
    throw new Error("The guaranteed flower discovery is not available");
  }

  const next = cloneState(state);
  next.freeDrawAvailable = false;
  next.coralRoseUnlocked = true;
  SECOND_ROUND_PLOTS.forEach((plot) => {
    next.seeds[plot.flowerId] += 1;
  });
  next.phase = "discovery";
  return next;
};

export const acknowledgeFlowerDiscovery = (
  state: SecondRoundState,
): SecondRoundState => {
  requirePhase(state, "discovery", "acknowledgeFlowerDiscovery");
  const next = cloneState(state);
  next.phase = "planting";
  return next;
};

export const plantSecondRoundPlot = (
  state: SecondRoundState,
  plotId: string,
): SecondRoundState => {
  requirePhase(state, "planting", "plantSecondRoundPlot");
  const next = cloneState(state);
  const plot = getPlot(next, plotId);

  if (plot.growth !== "empty") {
    throw new Error(`Second-round plot ${plotId} is already planted`);
  }
  if (next.seeds[plot.flowerId] <= 0) {
    throw new Error(`No ${plot.flowerId} seeds available`);
  }

  next.seeds[plot.flowerId] -= 1;
  plot.growth = "planted";
  if (next.plots.every((candidate) => candidate.growth === "planted")) {
    next.phase = "watering";
  }
  return next;
};

export const waterSecondRoundPlots = (state: SecondRoundState): SecondRoundState => {
  requirePhase(state, "watering", "waterSecondRoundPlots");
  const next = cloneState(state);
  next.plots.forEach((plot) => {
    plot.growth = "watered";
  });
  next.phase = "caring";
  return next;
};

export const clearSecondRoundPest = (
  state: SecondRoundState,
  plotId: string,
): SecondRoundState => {
  requirePhase(state, "caring", "clearSecondRoundPest");
  const next = cloneState(state);
  const plot = getPlot(next, plotId);
  if (!plot.hasPest || plot.pestCleared) {
    throw new Error(`Second-round plot ${plotId} has no active pest`);
  }

  plot.pestCleared = true;
  next.phase = "inspiration";
  return next;
};

export const selectSecondRoundBouquet = (
  state: SecondRoundState,
  bouquetId: SecondRoundBouquetId,
): SecondRoundState => {
  requirePhase(state, "inspiration", "selectSecondRoundBouquet");
  getSecondRoundBouquet(bouquetId);
  const next = cloneState(state);
  next.selectedBouquetId = bouquetId;
  next.phase = "growing";
  return next;
};

export const finishSecondRoundGrowth = (state: SecondRoundState): SecondRoundState => {
  requirePhase(state, "growing", "finishSecondRoundGrowth");
  if (!state.selectedBouquetId) {
    throw new Error("A bouquet target must be selected before flowers mature");
  }

  const next = cloneState(state);
  next.plots.forEach((plot) => {
    plot.growth = "mature";
  });
  next.phase = "harvesting";
  return next;
};

export const harvestSecondRoundAll = (state: SecondRoundState): SecondRoundState => {
  requirePhase(state, "harvesting", "harvestSecondRoundAll");
  const next = cloneState(state);
  next.plots.forEach((plot) => {
    if (plot.growth !== "mature") {
      throw new Error(`Second-round plot ${plot.id} is not mature`);
    }
    plot.growth = "harvested";
    next.inventory[plot.flowerId] += plot.harvestCount;
  });
  next.oneTapHarvestUnlocked = true;
  next.phase = "crafting";
  return next;
};

export const canMakeSecondRoundBouquet = (
  state: SecondRoundState,
  bouquetId: SecondRoundBouquetId,
): boolean => {
  const bouquet = getSecondRoundBouquet(bouquetId);
  return Object.entries(bouquet.recipe).every(
    ([flowerId, required]) =>
      state.inventory[flowerId as FlowerId] >= (required ?? 0),
  );
};

export const makeSecondRoundBouquet = (state: SecondRoundState): SecondRoundState => {
  requirePhase(state, "crafting", "makeSecondRoundBouquet");
  if (!state.selectedBouquetId) {
    throw new Error("No second-round bouquet has been selected");
  }
  if (!canMakeSecondRoundBouquet(state, state.selectedBouquetId)) {
    throw new Error("Not enough flowers for the selected second-round bouquet");
  }

  const next = cloneState(state);
  const bouquet = getSecondRoundBouquet(next.selectedBouquetId!);
  Object.entries(bouquet.recipe).forEach(([flowerId, required]) => {
    next.inventory[flowerId as FlowerId] -= required ?? 0;
  });
  next.bouquetMade = true;
  next.phase = "delivery";
  return next;
};

export const deliverSecondRoundBouquet = (
  state: SecondRoundState,
): SecondRoundState => {
  requirePhase(state, "delivery", "deliverSecondRoundBouquet");
  if (!state.bouquetMade || state.orderDelivered || !state.selectedBouquetId) {
    throw new Error("Second-round bouquet is not ready for delivery");
  }

  const next = cloneState(state);
  next.orderDelivered = true;
  next.coins += getSecondRoundBouquet(next.selectedBouquetId!).rewardCoins;
  next.phase = "upgrade";
  return next;
};

export const claimSecondRoundUpgrade = (state: SecondRoundState): SecondRoundState => {
  requirePhase(state, "upgrade", "claimSecondRoundUpgrade");
  const next = cloneState(state);
  next.storeLevel = 3;
  next.unlockedPlotCount = 8;
  next.phase = "complete";
  return next;
};
