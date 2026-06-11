import { describe, expect, it } from "vitest";

import {
  BOUQUET_SLOTS,
  findBestSlot,
  getProgress,
  isBouquetComplete,
  type Placement,
} from "./bouquetRules";

describe("bouquet rules", () => {
  it("only assigns a compatible open slot", () => {
    const slot = findBestSlot("dahlia", { x: 190, y: 315 }, []);

    expect(slot?.role).toBe("focal");
  });

  it("does not reuse an occupied slot", () => {
    const occupiedSlot = BOUQUET_SLOTS.find((slot) => slot.role === "focal");
    expect(occupiedSlot).toBeDefined();

    const placements: Placement[] = [
      { materialId: "dahlia", slotId: occupiedSlot!.id },
    ];
    const slot = findBestSlot("dahlia", { x: occupiedSlot!.x, y: occupiedSlot!.y }, placements);

    expect(slot?.id).not.toBe(occupiedSlot!.id);
  });

  it("does not snap a flower dropped far away from the bouquet", () => {
    const slot = findBestSlot("dahlia", { x: 20, y: 700 }, []);

    expect(slot).toBeUndefined();
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

    expect(isBouquetComplete(placements)).toBe(true);
    expect(getProgress(placements)).toBe(1);
  });
});
