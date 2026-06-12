import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OPENING_ORDER,
  accelerateAllPlots,
  acceptOpeningOrder,
  buyNextSeedPack,
  clearPlotPest,
  createOpeningOrderState,
  deliverOpeningOrder,
  fertilizePlot,
  harvestPlot,
  makeOpeningBouquet,
  plantPlot,
  waterAllPlots,
  type OpeningOrderState,
} from "../../../assets/scripts/domain/openingOrder.ts";

const plantAll = (state: OpeningOrderState): OpeningOrderState =>
  state.plots.reduce(
    (current, plot) => plantPlot(current, plot.id),
    acceptOpeningOrder(state),
  );

const growAll = (state: OpeningOrderState): OpeningOrderState => {
  const watered = waterAllPlots(plantAll(state));
  const fertilized = fertilizePlot(watered, "plot-1");
  return accelerateAllPlots(clearPlotPest(fertilized, "plot-5"));
};

const harvestAll = (state: OpeningOrderState): OpeningOrderState =>
  state.plots.reduce(
    (current, plot) => harvestPlot(current, plot.id),
    growAll(state),
  );

describe("opening order", () => {
  it("completes the first order and buys the next seed pack", () => {
    const harvested = harvestAll(createOpeningOrderState());
    const made = makeOpeningBouquet(harvested);
    const delivered = deliverOpeningOrder(made);
    const complete = buyNextSeedPack(delivered);

    assert.equal(complete.phase, "complete");
    assert.equal(complete.orderDelivered, true);
    assert.equal(complete.nextSeedPackOwned, true);
    assert.equal(
      complete.coins,
      OPENING_ORDER.rewardCoins - OPENING_ORDER.nextSeedPackCost,
    );
  });

  it("does not allow harvesting before flowers mature", () => {
    const planted = plantAll(createOpeningOrderState());

    assert.throws(() => harvestPlot(planted, "plot-1"), /requires phase harvesting/);
  });

  it("consumes only the bouquet recipe and preserves extra materials", () => {
    const harvested = harvestAll(createOpeningOrderState());
    const made = makeOpeningBouquet(harvested);

    assert.deepEqual(made.inventory, {
      dahlia: 0,
      ranunculus: 2,
      delphinium: 0,
      daisy: 2,
    });
  });

  it("prevents duplicate delivery rewards", () => {
    const delivered = deliverOpeningOrder(
      makeOpeningBouquet(harvestAll(createOpeningOrderState())),
    );

    assert.throws(() => deliverOpeningOrder(delivered), /requires phase delivery/);
    assert.equal(delivered.coins, OPENING_ORDER.rewardCoins);
  });

  it("does not create negative inventory when materials are missing", () => {
    const arranging: OpeningOrderState = {
      ...createOpeningOrderState(),
      phase: "arranging",
    };

    assert.throws(() => makeOpeningBouquet(arranging), /Not enough dahlia/);
    assert.deepEqual(arranging.inventory, {
      dahlia: 0,
      ranunculus: 0,
      delphinium: 0,
      daisy: 0,
    });
  });
});
