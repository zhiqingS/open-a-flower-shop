import type { FlowerId } from "../domain/secondRound";

export const BOUQUET_ART_ROOT = "art/bouquet-v03";

export const BOUQUET_ART_IDS = [
  "dahlia-a",
  "dahlia-b",
  "ranunculus-peach-a",
  "ranunculus-yellow-b",
  "delphinium-a",
  "delphinium-b",
  "daisy-a",
  "daisy-b",
  "leaf-round-a",
  "leaf-slim-b",
  "foliage-a",
  "foliage-b",
  "wrapper-back",
  "wrapper-front",
  "ribbon-pink",
] as const;

export type BouquetArtId = (typeof BOUQUET_ART_IDS)[number];

export interface FlowerArtSpec {
  ids: readonly BouquetArtId[];
  width: number;
  height: number;
  yOffset?: number;
}

export interface BouquetArtLayer {
  kind: "art";
  artId: BouquetArtId;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
}

export interface BouquetFlowerLayer {
  kind: "flower";
  flowerId: FlowerId;
  x: number;
  y: number;
  scale: number;
  angle?: number;
}

export type BouquetVisualLayer = BouquetArtLayer | BouquetFlowerLayer;

export const FLOWER_ART: Record<FlowerId, FlowerArtSpec> = {
  dahlia: { ids: ["dahlia-a", "dahlia-b"], width: 88, height: 112 },
  ranunculus: { ids: ["ranunculus-peach-a", "ranunculus-yellow-b"], width: 82, height: 108 },
  delphinium: { ids: ["delphinium-a", "delphinium-b"], width: 68, height: 130, yOffset: 2 },
  daisy: { ids: ["daisy-a", "daisy-b"], width: 70, height: 118 },
  "coral-rose": { ids: ["ranunculus-yellow-b"], width: 78, height: 104 },
};

export const WORKSHOP_BACK_LAYERS: readonly BouquetArtLayer[] = [
  { kind: "art", artId: "wrapper-back", x: 0, y: -8, width: 202, height: 198 },
  { kind: "art", artId: "leaf-slim-b", x: -44, y: 24, width: 80, height: 106, angle: -12 },
  { kind: "art", artId: "leaf-round-a", x: 44, y: 18, width: 86, height: 106, angle: 13 },
  { kind: "art", artId: "foliage-a", x: -16, y: 34, width: 52, height: 90, angle: -7 },
  { kind: "art", artId: "foliage-b", x: 24, y: 30, width: 56, height: 94, angle: 7 },
];

export const WORKSHOP_FRONT_LAYERS: readonly BouquetArtLayer[] = [
  { kind: "art", artId: "wrapper-front", x: 0, y: -62, width: 184, height: 154 },
  { kind: "art", artId: "ribbon-pink", x: 0, y: -120, width: 92, height: 104 },
];

export const OPENING_BOUQUET_PREVIEW_LAYERS: readonly BouquetVisualLayer[] = [
  { kind: "art", artId: "wrapper-back", x: 0, y: -42, width: 150, height: 146 },
  { kind: "art", artId: "leaf-slim-b", x: -34, y: 18, width: 54, height: 76, angle: -12 },
  { kind: "art", artId: "leaf-round-a", x: 36, y: 12, width: 58, height: 74, angle: 12 },
  { kind: "art", artId: "foliage-a", x: -11, y: 22, width: 34, height: 62, angle: -6 },
  { kind: "art", artId: "foliage-b", x: 20, y: 22, width: 36, height: 66, angle: 7 },
  { kind: "flower", flowerId: "delphinium", x: -38, y: 55, scale: 0.72, angle: -8 },
  { kind: "flower", flowerId: "delphinium", x: 39, y: 53, scale: 0.68, angle: 8 },
  { kind: "flower", flowerId: "ranunculus", x: -35, y: 7, scale: 0.72, angle: -5 },
  { kind: "flower", flowerId: "ranunculus", x: 36, y: 7, scale: 0.66, angle: 5 },
  { kind: "flower", flowerId: "dahlia", x: -13, y: 29, scale: 0.82, angle: -3 },
  { kind: "flower", flowerId: "dahlia", x: 22, y: 27, scale: 0.78, angle: 4 },
  { kind: "flower", flowerId: "daisy", x: -22, y: -2, scale: 0.58, angle: -5 },
  { kind: "flower", flowerId: "daisy", x: 24, y: -3, scale: 0.54, angle: 5 },
  { kind: "art", artId: "wrapper-front", x: 0, y: -66, width: 140, height: 118 },
  { kind: "art", artId: "ribbon-pink", x: 0, y: -104, width: 74, height: 84 },
];
