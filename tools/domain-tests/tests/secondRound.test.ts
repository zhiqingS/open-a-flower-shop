import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SECOND_ROUND_BOUQUETS,
  SECOND_ROUND_REWARD_COINS,
  acknowledgeFlowerDiscovery,
  canMakeSecondRoundBouquet,
  claimSecondRoundReward,
  claimSecondRoundUpgrade,
  clearSecondRoundPest,
  createSecondRoundState,
  deliverSecondRoundBouquet,
  drawCoralRose,
  finishSecondRoundGrowth,
  harvestSecondRoundAll,
  makeSecondRoundBouquet,
  plantSecondRoundPlot,
  selectSecondRoundBouquet,
  waterSecondRoundPlots,
  type SecondRoundBouquetId,
  type SecondRoundState,
} from "../../../assets/scripts/domain/secondRound.ts";

const reachInspiration = (startingCoins = 120): SecondRoundState => {
  const discovered = acknowledgeFlowerDiscovery(
    drawCoralRose(claimSecondRoundReward(createSecondRoundState(startingCoins))),
  );
  const planted = discovered.plots.reduce(
    (current, plot) => plantSecondRoundPlot(current, plot.id),
    discovered,
  );
  const watered = waterSecondRoundPlots(planted);
  return clearSecondRoundPest(watered, "round-2-plot-3");
};

const reachCrafting = (
  bouquetId: SecondRoundBouquetId = "spring-letter",
): SecondRoundState =>
  harvestSecondRoundAll(
    finishSecondRoundGrowth(selectSecondRoundBouquet(reachInspiration(), bouquetId)),
  );

describe("second round", () => {
  it("chains reward, guaranteed discovery, planting and inspiration", () => {
    const inspiration = reachInspiration();

    assert.equal(inspiration.phase, "inspiration");
    assert.equal(inspiration.storeLevel, 2);
    assert.equal(inspiration.coralRoseUnlocked, true);
    assert.equal(inspiration.freeDrawAvailable, false);
    assert.equal(inspiration.coins, 120 + SECOND_ROUND_REWARD_COINS);
  });

  it("one-tap harvest creates inventory for either recommended bouquet", () => {
    const crafting = reachCrafting();

    assert.equal(crafting.oneTapHarvestUnlocked, true);
    SECOND_ROUND_BOUQUETS.forEach((bouquet) => {
      assert.equal(canMakeSecondRoundBouquet(crafting, bouquet.id), true);
    });
  });

  it("delivers the chosen bouquet and unlocks two plots", () => {
    const crafting = reachCrafting("spring-letter");
    const made = makeSecondRoundBouquet(crafting);
    const delivered = deliverSecondRoundBouquet(made);
    const complete = claimSecondRoundUpgrade(delivered);

    assert.equal(complete.phase, "complete");
    assert.equal(complete.storeLevel, 3);
    assert.equal(complete.unlockedPlotCount, 8);
    assert.equal(
      complete.coins,
      120 + SECOND_ROUND_REWARD_COINS + SECOND_ROUND_BOUQUETS[1]!.rewardCoins,
    );
  });

  it("prevents duplicate reward and delivery claims", () => {
    const rewarded = claimSecondRoundReward(createSecondRoundState(120));
    assert.throws(() => claimSecondRoundReward(rewarded), /requires phase reward/);

    const delivered = deliverSecondRoundBouquet(makeSecondRoundBouquet(reachCrafting()));
    assert.throws(
      () => deliverSecondRoundBouquet(delivered),
      /requires phase delivery/,
    );
  });
});
