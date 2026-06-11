export type FlowerRole = "focal" | "secondary" | "line" | "filler";

export type MaterialId = "dahlia" | "ranunculus" | "delphinium" | "daisy";

export interface MaterialDefinition {
  id: MaterialId;
  name: string;
  role: FlowerRole;
  targetCount: number;
  color: number;
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
    role: "focal",
    targetCount: 2,
    color: 0xf2a7b8,
  },
  {
    id: "ranunculus",
    name: "香槟洋牡丹",
    role: "secondary",
    targetCount: 2,
    color: 0xf5c98d,
  },
  {
    id: "delphinium",
    name: "蓝色飞燕草",
    role: "line",
    targetCount: 2,
    color: 0x9abce3,
  },
  {
    id: "daisy",
    name: "白色小雏菊",
    role: "filler",
    targetCount: 2,
    color: 0xf7f2df,
  },
] as const;

export const BOUQUET_SLOTS: readonly BouquetSlot[] = [
  { id: "line-left", role: "line", x: 147, y: 248, scale: 0.93, rotation: -0.17, depth: 12 },
  { id: "line-right", role: "line", x: 286, y: 244, scale: 0.9, rotation: 0.18, depth: 13 },
  { id: "secondary-left", role: "secondary", x: 153, y: 342, scale: 0.88, rotation: -0.12, depth: 25 },
  { id: "secondary-right", role: "secondary", x: 282, y: 347, scale: 0.86, rotation: 0.14, depth: 26 },
  { id: "focal-left", role: "focal", x: 192, y: 313, scale: 1, rotation: -0.05, depth: 35 },
  { id: "focal-right", role: "focal", x: 246, y: 329, scale: 0.96, rotation: 0.08, depth: 36 },
  { id: "filler-left", role: "filler", x: 180, y: 381, scale: 0.8, rotation: -0.08, depth: 45 },
  { id: "filler-right", role: "filler", x: 258, y: 387, scale: 0.78, rotation: 0.1, depth: 46 },
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

export const isBouquetComplete = (placements: readonly Placement[]): boolean =>
  MATERIALS.every(
    (material) => getPlacementCount(material.id, placements) >= material.targetCount,
  );

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

export const canPlaceMore = (
  materialId: MaterialId,
  placements: readonly Placement[],
): boolean => {
  const material = getMaterial(materialId);
  return getPlacementCount(materialId, placements) < material.targetCount;
};

export const getProgress = (placements: readonly Placement[]): number => {
  const target = MATERIALS.reduce((sum, material) => sum + material.targetCount, 0);
  return Math.min(1, placements.length / target);
};
