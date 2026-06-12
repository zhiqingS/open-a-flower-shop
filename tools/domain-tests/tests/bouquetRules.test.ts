import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BOUQUET_SLOTS,
  findBestSlot,
  getProgress,
  isBouquetComplete,
  type Placement,
} from "../../../assets/scripts/domain/bouquetRules.ts";

describe("bouquet rules", () => {
  it("only assigns a compatible open slot", () => {
    const slot = findBestSlot("dahlia", { x: 190, y: 315 }, []);

    assert.equal(slot?.role, "focal");
  });

  it("does not reuse an occupied slot", () => {
    const occupiedSlot = BOUQUET_SLOTS.find((slot) => slot.role === "focal");
    assert.ok(occupiedSlot);

    const placements: Placement[] = [
      { materialId: "dahlia", slotId: occupiedSlot!.id },
    ];
    const slot = findBestSlot("dahlia", { x: occupiedSlot!.x, y: occupiedSlot!.y }, placements);

    assert.notEqual(slot?.id, occupiedSlot.id);
  });

  it("does not snap a flower dropped far away from the bouquet", () => {
    const slot = findBestSlot("dahlia", { x: 20, y: 700 }, []);

    assert.equal(slot, undefined);
  });

  it("recognizes a complete bouquet", () => {
    const placements: Placement[] = BOUQUET_SLOTS.map((slot) => ({
      materialId:
        slot.role === "focal"
          ? "dahlia"
          : slot.role === "secondary"
            ? "ranunculus"
            : slot.role === "line"
              ? "delphinium"
              : "daisy",
      slotId: slot.id,
    }));

    assert.equal(isBouquetComplete(placements), true);
    assert.equal(getProgress(placements), 1);
  });
});
