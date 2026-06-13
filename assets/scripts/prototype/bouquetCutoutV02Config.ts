export const BOUQUET_CUTOUT_V02_ROOT = "art/bouquet-cutout-v02";

export const BOUQUET_CUTOUT_V02_TEMPLATE = {
  artId: "template-base",
  sourceWidth: 1536,
  sourceHeight: 2044,
} as const;

export const BOUQUET_CUTOUT_V02_FLOWERS = [
  {
    id: "peach-rosette-front",
    label: "桃橙玫瑰",
    artId: "peach-rosette-front",
    sourceWidth: 224,
    sourceHeight: 270,
    placements: [
      {
        x: 604.00,
        y: 1090.00,
        width: 304,
        height: 274,
        depth: 42,
      },
    ],
  },
  {
    id: "pink-peony-left",
    label: "粉色主花",
    artId: "pink-peony-left",
    sourceWidth: 261,
    sourceHeight: 265,
    placements: [
      {
        x: 536.00,
        y: 808.00,
        width: 362,
        height: 282,
        depth: 24,
      },
    ],
  },
  {
    id: "pink-peony-upper-right",
    label: "粉色上花",
    artId: "pink-peony-upper-right",
    sourceWidth: 286,
    sourceHeight: 269,
    placements: [
      {
        x: 872.00,
        y: 628.00,
        width: 300,
        height: 278,
        depth: 18,
      },
    ],
  },
  {
    id: "pink-peony-middle-right",
    label: "粉色圆花",
    artId: "pink-peony-middle-right",
    sourceWidth: 286,
    sourceHeight: 269,
    placements: [
      {
        x: 806.00,
        y: 984.00,
        width: 326,
        height: 302,
        depth: 36,
      },
    ],
  },
] as const;

export type BouquetCutoutV02FlowerId = (typeof BOUQUET_CUTOUT_V02_FLOWERS)[number]["id"];

export const BOUQUET_CUTOUT_V02_ART_IDS = [
  BOUQUET_CUTOUT_V02_TEMPLATE.artId,
  ...BOUQUET_CUTOUT_V02_FLOWERS.map((flower) => flower.artId),
] as const;

export type BouquetCutoutV02ArtId = (typeof BOUQUET_CUTOUT_V02_ART_IDS)[number];
