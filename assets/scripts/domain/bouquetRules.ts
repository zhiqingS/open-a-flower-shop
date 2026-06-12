export type FlowerRole = "focal" | "secondary" | "line" | "filler";

export type MaterialId = "dahlia" | "ranunculus" | "delphinium" | "daisy";

export interface MaterialDefinition {
  id: MaterialId;
  name: string;
  shortName: string;
  role: FlowerRole;
  targetCount: number;
}

export interface BouquetSlot {
  id: string;
  role: FlowerRole;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  depth: number;
}

export interface Placement {
  materialId: MaterialId;
  slotId: string;
}

export const MATERIALS: readonly MaterialDefinition[] = [
  {
    id: "dahlia",
    name: "粉色大丽花",
    shortName: "主花",
    role: "focal",
    targetCount: 2,
  },
  {
    id: "ranunculus",
    name: "香槟色洋牡丹",
    shortName: "配花",
    role: "secondary",
    targetCount: 2,
  },
  {
    id: "delphinium",
    name: "蓝色飞燕草",
    shortName: "线条花",
    role: "line",
    targetCount: 2,
  },
  {
    id: "daisy",
    name: "白色小雏菊",
    shortName: "填充花",
    role: "filler",
    targetCount: 2,
  },
] as const;

// Slot coordinates use a 430 x 760 top-left origin so rules remain renderer-agnostic.
export const BOUQUET_SLOTS: readonly BouquetSlot[] = [
  { id: "line-left", role: "line", x: 178, y: 280, scale: 0.72, rotation: -0.12, depth: 12 },
  { id: "line-right", role: "line", x: 252, y: 280, scale: 0.68, rotation: 0.12, depth: 13 },
  { id: "secondary-left", role: "secondary", x: 181, y: 336, scale: 0.72, rotation: -0.08, depth: 25 },
  { id: "secondary-right", role: "secondary", x: 250, y: 337, scale: 0.69, rotation: 0.08, depth: 26 },
  { id: "focal-left", role: "focal", x: 199, y: 312, scale: 0.84, rotation: -0.04, depth: 35 },
  { id: "focal-right", role: "focal", x: 233, y: 318, scale: 0.8, rotation: 0.04, depth: 36 },
  { id: "filler-left", role: "filler", x: 198, y: 368, scale: 0.62, rotation: -0.04, depth: 45 },
  { id: "filler-right", role: "filler", x: 235, y: 370, scale: 0.58, rotation: 0.04, depth: 46 },
] as const;

export const getMaterial = (materialId: MaterialId): MaterialDefinition => {
  const material = MATERIALS.find((candidate) => candidate.id === materialId);

  if (!material) {
    throw new Error(`Unknown material: ${materialId}`);
  }

  return material;
};

export const getPlacementCount = (
  materialId: MaterialId,
  placements: readonly Placement[],
): number => placements.filter((placement) => placement.materialId === materialId).length;

export const canPlaceMore = (
  materialId: MaterialId,
  placements: readonly Placement[],
): boolean => {
  const material = getMaterial(materialId);
  return getPlacementCount(materialId, placements) < material.targetCount;
};

export const isBouquetComplete = (placements: readonly Placement[]): boolean =>
  MATERIALS.every(
    (material) => getPlacementCount(material.id, placements) >= material.targetCount,
  );

export const getProgress = (placements: readonly Placement[]): number => {
  const target = MATERIALS.reduce((sum, material) => sum + material.targetCount, 0);
  return Math.min(1, placements.length / target);
};

export const findBestSlot = (
  materialId: MaterialId,
  pointer: { x: number; y: number },
  placements: readonly Placement[],
  maxDistance = 175,
): BouquetSlot | undefined => {
  const role = getMaterial(materialId).role;
  const occupiedSlots = new Set(placements.map((placement) => placement.slotId));

  return BOUQUET_SLOTS.filter(
    (slot) => slot.role === role && !occupiedSlots.has(slot.id),
  )
    .map((slot) => ({
      slot,
      distance: Math.hypot(pointer.x - slot.x, pointer.y - slot.y),
    }))
    .filter(({ distance }) => distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)[0]?.slot;
};
