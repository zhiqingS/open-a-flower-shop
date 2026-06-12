import type { MaterialId } from "./bouquetRules";

export type OpeningOrderPhase =
  | "order"
  | "planting"
  | "watering"
  | "caring"
  | "accelerating"
  | "harvesting"
  | "arranging"
  | "delivery"
  | "rebuying"
  | "complete";

export type PlotGrowth = "empty" | "planted" | "watered" | "mature" | "harvested";
export type CareTask = "fertilize" | "clear-pest";

export interface TutorialPlotDefinition {
  id: string;
  materialId: MaterialId;
  harvestCount: number;
  careTask?: CareTask;
}

export interface TutorialPlot extends TutorialPlotDefinition {
  growth: PlotGrowth;
  careComplete: boolean;
}

export interface OpeningOrderState {
  phase: OpeningOrderPhase;
  plots: TutorialPlot[];
  seeds: Record<MaterialId, number>;
  inventory: Record<MaterialId, number>;
  coins: number;
  bouquetMade: boolean;
  orderDelivered: boolean;
  nextSeedPackOwned: boolean;
}

export const OPENING_ORDER = {
  id: "opening-order",
  title: "开业第一单",
  bouquetName: "清晨花束",
  rewardCoins: 120,
  nextSeedPackCost: 80,
  recipe: {
    dahlia: 2,
    ranunculus: 2,
    delphinium: 2,
    daisy: 2,
  } satisfies Record<MaterialId, number>,
} as const;

export const TUTORIAL_PLOTS: readonly TutorialPlotDefinition[] = [
  { id: "plot-1", materialId: "dahlia", harvestCount: 2, careTask: "fertilize" },
  { id: "plot-2", materialId: "ranunculus", harvestCount: 2 },
  { id: "plot-3", materialId: "ranunculus", harvestCount: 2 },
  { id: "plot-4", materialId: "delphinium", harvestCount: 2 },
  { id: "plot-5", materialId: "daisy", harvestCount: 2, careTask: "clear-pest" },
  { id: "plot-6", materialId: "daisy", harvestCount: 2 },
] as const;

const createMaterialCounts = (): Record<MaterialId, number> => ({
  dahlia: 0,
  ranunculus: 0,
  delphinium: 0,
  daisy: 0,
});

const cloneState = (state: OpeningOrderState): OpeningOrderState => ({
  ...state,
  plots: state.plots.map((plot) => ({ ...plot })),
  seeds: { ...state.seeds },
  inventory: { ...state.inventory },
});

const requirePhase = (
  state: OpeningOrderState,
  expected: OpeningOrderPhase,
  action: string,
): void => {
  if (state.phase !== expected) {
    throw new Error(`${action} requires phase ${expected}, received ${state.phase}`);
  }
};

const getPlot = (state: OpeningOrderState, plotId: string): TutorialPlot => {
  const plot = state.plots.find((candidate) => candidate.id === plotId);

  if (!plot) {
    throw new Error(`Unknown plot: ${plotId}`);
  }

  return plot;
};

const createGiftedSeeds = (): Record<MaterialId, number> => {
  const seeds = createMaterialCounts();
  TUTORIAL_PLOTS.forEach((plot) => {
    seeds[plot.materialId] += 1;
  });
  return seeds;
};

export const createOpeningOrderState = (): OpeningOrderState => ({
  phase: "order",
  plots: TUTORIAL_PLOTS.map((plot) => ({
    ...plot,
    growth: "empty",
    careComplete: false,
  })),
  seeds: createMaterialCounts(),
  inventory: createMaterialCounts(),
  coins: 0,
  bouquetMade: false,
  orderDelivered: false,
  nextSeedPackOwned: false,
});

export const acceptOpeningOrder = (state: OpeningOrderState): OpeningOrderState => {
  requirePhase(state, "order", "acceptOpeningOrder");
  const next = cloneState(state);
  next.seeds = createGiftedSeeds();
  next.phase = "planting";
  return next;
};

export const plantPlot = (state: OpeningOrderState, plotId: string): OpeningOrderState => {
  requirePhase(state, "planting", "plantPlot");
  const next = cloneState(state);
  const plot = getPlot(next, plotId);

  if (plot.growth !== "empty") {
    throw new Error(`Plot ${plotId} is already planted`);
  }
  if (next.seeds[plot.materialId] <= 0) {
    throw new Error(`No ${plot.materialId} seeds available`);
  }

  next.seeds[plot.materialId] -= 1;
  plot.growth = "planted";
  if (next.plots.every((candidate) => candidate.growth === "planted")) {
    next.phase = "watering";
  }
  return next;
};

export const waterAllPlots = (state: OpeningOrderState): OpeningOrderState => {
  requirePhase(state, "watering", "waterAllPlots");
  const next = cloneState(state);
  next.plots.forEach((plot) => {
    plot.growth = "watered";
  });
  next.phase = "caring";
  return next;
};

const completeCareTask = (
  state: OpeningOrderState,
  plotId: string,
  task: CareTask,
): OpeningOrderState => {
  requirePhase(state, "caring", task);
  const next = cloneState(state);
  const plot = getPlot(next, plotId);

  if (plot.careTask !== task) {
    throw new Error(`Plot ${plotId} does not require ${task}`);
  }
  if (plot.careComplete) {
    throw new Error(`Care for plot ${plotId} is already complete`);
  }

  plot.careComplete = true;
  if (
    next.plots
      .filter((candidate) => candidate.careTask !== undefined)
      .every((candidate) => candidate.careComplete)
  ) {
    next.phase = "accelerating";
  }
  return next;
};

export const fertilizePlot = (
  state: OpeningOrderState,
  plotId: string,
): OpeningOrderState => completeCareTask(state, plotId, "fertilize");

export const clearPlotPest = (
  state: OpeningOrderState,
  plotId: string,
): OpeningOrderState => completeCareTask(state, plotId, "clear-pest");

export const accelerateAllPlots = (state: OpeningOrderState): OpeningOrderState => {
  requirePhase(state, "accelerating", "accelerateAllPlots");
  const next = cloneState(state);
  next.plots.forEach((plot) => {
    plot.growth = "mature";
  });
  next.phase = "harvesting";
  return next;
};

export const harvestPlot = (state: OpeningOrderState, plotId: string): OpeningOrderState => {
  requirePhase(state, "harvesting", "harvestPlot");
  const next = cloneState(state);
  const plot = getPlot(next, plotId);

  if (plot.growth !== "mature") {
    throw new Error(`Plot ${plotId} is not ready to harvest`);
  }

  plot.growth = "harvested";
  next.inventory[plot.materialId] += plot.harvestCount;
  if (next.plots.every((candidate) => candidate.growth === "harvested")) {
    next.phase = "arranging";
  }
  return next;
};

export const makeOpeningBouquet = (state: OpeningOrderState): OpeningOrderState => {
  requirePhase(state, "arranging", "makeOpeningBouquet");
  const next = cloneState(state);

  (Object.keys(OPENING_ORDER.recipe) as MaterialId[]).forEach((materialId) => {
    const required = OPENING_ORDER.recipe[materialId];
    if (next.inventory[materialId] < required) {
      throw new Error(`Not enough ${materialId} to make the opening bouquet`);
    }
    next.inventory[materialId] -= required;
  });

  next.bouquetMade = true;
  next.phase = "delivery";
  return next;
};

export const deliverOpeningOrder = (state: OpeningOrderState): OpeningOrderState => {
  requirePhase(state, "delivery", "deliverOpeningOrder");
  if (!state.bouquetMade || state.orderDelivered) {
    throw new Error("Opening order is not ready for delivery");
  }

  const next = cloneState(state);
  next.orderDelivered = true;
  next.coins += OPENING_ORDER.rewardCoins;
  next.phase = "rebuying";
  return next;
};

export const buyNextSeedPack = (state: OpeningOrderState): OpeningOrderState => {
  requirePhase(state, "rebuying", "buyNextSeedPack");
  if (state.coins < OPENING_ORDER.nextSeedPackCost) {
    throw new Error("Not enough coins for the next seed pack");
  }

  const next = cloneState(state);
  next.coins -= OPENING_ORDER.nextSeedPackCost;
  next.seeds = createGiftedSeeds();
  next.nextSeedPackOwned = true;
  next.phase = "complete";
  return next;
};

export const getPlantedCount = (state: OpeningOrderState): number =>
  state.plots.filter((plot) => plot.growth !== "empty").length;

export const getHarvestedCount = (state: OpeningOrderState): number =>
  state.plots.filter((plot) => plot.growth === "harvested").length;
