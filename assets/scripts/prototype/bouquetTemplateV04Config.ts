import type { MaterialId, Placement } from "../domain/bouquetRules";
import type { FlowerId } from "../domain/secondRound";

export const BOUQUET_TEMPLATE_V04_ROOT = "art/bouquet-template-v04";

export const BOUQUET_TEMPLATE_V04_ART_IDS = [
  "filler-daisy-center",
  "filler-daisy-left",
  "filler-daisy-right",
  "filler-spray-center",
  "filler-spray-left",
  "filler-spray-right",
  "filler-spray-tall-right",
  "focal-center",
  "focal-left",
  "focal-side-right",
  "focal-small",
  "focal-tilt-left",
  "leaf-fern-left",
  "leaf-large-right",
  "leaf-round-center",
  "leaf-round-left",
  "leaf-slim-center",
  "leaf-slim-right",
  "leaf-wide-left",
  "line-blue-center",
  "line-blue-left-mid",
  "line-blue-left-tall",
  "line-blue-right-mid",
  "line-blue-short-right",
  "ribbon-blue-stripe",
  "ribbon-pink",
  "secondary-bud-right",
  "secondary-bud-tall",
  "secondary-center",
  "secondary-cluster-right",
  "secondary-left",
  "secondary-tilt-left",
  "tag-kraft",
  "wrapper-front-fan",
  "wrapper-neck",
  "wrapper-paper-back",
  "wrapper-paper-left",
  "wrapper-paper-right",
  "wrapper-translucent-left",
  "wrapper-translucent-right",
] as const;

export type BouquetTemplateV04ArtId = (typeof BOUQUET_TEMPLATE_V04_ART_IDS)[number];

export interface BouquetTemplateV04Layer {
  artId: BouquetTemplateV04ArtId;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  flipX?: boolean;
  depth: number;
}

export interface BouquetTemplateV04SlotGroup {
  slotId: Placement["slotId"];
  materialId: MaterialId;
  layers: readonly BouquetTemplateV04Layer[];
}

export interface BouquetTemplateV04PreviewSpec {
  artId: BouquetTemplateV04ArtId;
  width: number;
  height: number;
  angle: number;
  yOffset?: number;
  flipX?: boolean;
}

export const BOUQUET_TEMPLATE_V04_PREVIEWS: Record<FlowerId, BouquetTemplateV04PreviewSpec> = {
  dahlia: { artId: "focal-center", width: 66, height: 92, angle: 0 },
  ranunculus: { artId: "secondary-center", width: 64, height: 88, angle: 0 },
  delphinium: { artId: "line-blue-center", width: 54, height: 110, angle: 0, yOffset: 6 },
  daisy: { artId: "filler-daisy-center", width: 58, height: 92, angle: 0 },
  "coral-rose": { artId: "secondary-cluster-right", width: 66, height: 88, angle: 0 },
};

export const BOUQUET_TEMPLATE_V04_BASE_LAYERS: readonly BouquetTemplateV04Layer[] = [
  { artId: "wrapper-paper-left", x: -78, y: -82, width: 112, height: 154, angle: -10, depth: 0 },
  { artId: "wrapper-paper-back", x: 0, y: -78, width: 176, height: 132, angle: 0, depth: 1 },
  { artId: "wrapper-paper-right", x: 78, y: -82, width: 112, height: 154, angle: 10, depth: 2 },
  { artId: "wrapper-translucent-left", x: -58, y: -90, width: 112, height: 158, angle: -8, depth: 3 },
  { artId: "wrapper-translucent-right", x: 58, y: -90, width: 112, height: 158, angle: 8, depth: 4 },
  { artId: "leaf-round-left", x: -98, y: -24, width: 48, height: 98, angle: -30, depth: 8 },
  { artId: "leaf-large-right", x: 98, y: -28, width: 72, height: 94, angle: 29, depth: 9 },
];

export const BOUQUET_TEMPLATE_V04_FRONT_LAYERS: readonly BouquetTemplateV04Layer[] = [
  { artId: "wrapper-front-fan", x: 0, y: -122, width: 178, height: 135, angle: 0, depth: 80 },
  { artId: "wrapper-neck", x: 0, y: -153, width: 92, height: 92, angle: 0, depth: 81 },
  { artId: "ribbon-blue-stripe", x: 0, y: -167, width: 86, height: 60, angle: 0, depth: 90 },
  { artId: "tag-kraft", x: 72, y: -161, width: 28, height: 48, angle: -8, depth: 91 },
];

export const BOUQUET_TEMPLATE_V04_SLOT_GROUPS: readonly BouquetTemplateV04SlotGroup[] = [
  {
    slotId: "line-left",
    materialId: "delphinium",
    layers: [
      { artId: "leaf-slim-center", x: -74, y: -42, width: 42, height: 114, angle: -20, depth: 14 },
      { artId: "line-blue-left-tall", x: -90, y: 40, width: 70, height: 188, angle: -13, depth: 22 },
      { artId: "line-blue-left-mid", x: -45, y: 34, width: 58, height: 166, angle: -5, depth: 24 },
    ],
  },
  {
    slotId: "line-right",
    materialId: "delphinium",
    layers: [
      { artId: "leaf-slim-right", x: 72, y: -42, width: 42, height: 116, angle: 21, depth: 15 },
      { artId: "line-blue-right-mid", x: 82, y: 38, width: 66, height: 174, angle: 14, depth: 23 },
      { artId: "line-blue-short-right", x: 112, y: 16, width: 48, height: 118, angle: 21, depth: 25 },
    ],
  },
  {
    slotId: "secondary-left",
    materialId: "ranunculus",
    layers: [
      { artId: "leaf-wide-left", x: -86, y: -52, width: 58, height: 92, angle: -30, depth: 29 },
      { artId: "secondary-tilt-left", x: -66, y: 5, width: 74, height: 106, angle: -12, depth: 32 },
      { artId: "secondary-bud-tall", x: -18, y: 26, width: 50, height: 108, angle: 5, depth: 33 },
    ],
  },
  {
    slotId: "secondary-right",
    materialId: "ranunculus",
    layers: [
      { artId: "leaf-round-center", x: 80, y: -50, width: 48, height: 86, angle: 25, depth: 30 },
      { artId: "secondary-left", x: 62, y: 4, width: 72, height: 106, angle: 12, flipX: true, depth: 34 },
      { artId: "secondary-cluster-right", x: 104, y: -6, width: 66, height: 98, angle: 21, depth: 35 },
    ],
  },
  {
    slotId: "focal-left",
    materialId: "dahlia",
    layers: [
      { artId: "leaf-fern-left", x: -45, y: -46, width: 56, height: 88, angle: -16, depth: 38 },
      { artId: "focal-tilt-left", x: -38, y: 46, width: 92, height: 122, angle: -8, depth: 43 },
      { artId: "focal-small", x: -92, y: 7, width: 58, height: 90, angle: -20, depth: 44 },
    ],
  },
  {
    slotId: "focal-right",
    materialId: "dahlia",
    layers: [
      { artId: "leaf-slim-right", x: 34, y: -52, width: 42, height: 96, angle: 10, depth: 39 },
      { artId: "focal-center", x: 34, y: 46, width: 92, height: 125, angle: 7, depth: 45 },
      { artId: "focal-side-right", x: 90, y: 18, width: 62, height: 94, angle: 22, depth: 46 },
    ],
  },
  {
    slotId: "filler-left",
    materialId: "daisy",
    layers: [
      { artId: "filler-spray-left", x: -46, y: -18, width: 50, height: 96, angle: -8, depth: 52 },
      { artId: "filler-daisy-left", x: -74, y: -36, width: 58, height: 84, angle: -18, depth: 54 },
      { artId: "filler-spray-center", x: -7, y: -30, width: 46, height: 92, angle: 2, depth: 56 },
    ],
  },
  {
    slotId: "filler-right",
    materialId: "daisy",
    layers: [
      { artId: "filler-spray-right", x: 34, y: -18, width: 47, height: 92, angle: 8, depth: 53 },
      { artId: "filler-daisy-right", x: 72, y: -36, width: 58, height: 84, angle: 18, depth: 55 },
      { artId: "filler-spray-tall-right", x: 8, y: -38, width: 43, height: 92, angle: -2, depth: 57 },
    ],
  },
];

export const BOUQUET_TEMPLATE_V04_REQUIRED_ART_IDS = Array.from(
  new Set(
    [
      ...BOUQUET_TEMPLATE_V04_BASE_LAYERS,
      ...BOUQUET_TEMPLATE_V04_SLOT_GROUPS.flatMap((group) => group.layers),
      ...BOUQUET_TEMPLATE_V04_FRONT_LAYERS,
      ...Object.values(BOUQUET_TEMPLATE_V04_PREVIEWS).map((preview) => ({
        artId: preview.artId,
      })),
    ].map((layer) => layer.artId),
  ),
);
