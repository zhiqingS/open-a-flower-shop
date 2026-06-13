export const BOUQUET_CUTOUT_V01_ROOT = "art/bouquet-cutout-v01";

export const BOUQUET_CUTOUT_V01_TEMPLATE = {
  artId: "template-base",
  sourceWidth: 1536,
  sourceHeight: 1768,
} as const;

export const BOUQUET_CUTOUT_V01_FLOWERS = [
  {
    id: "hero-left",
    label: "左主花",
    artId: "hero-left",
    slotArtId: "hero-left-skeleton",
    sourceX: 613.00,
    sourceY: 764.50,
    sourceWidth: 362,
    sourceHeight: 319,
    depth: 20,
  },
  {
    id: "pink-upper-right",
    label: "右上花",
    artId: "pink-upper-right",
    slotArtId: "pink-upper-right-skeleton",
    sourceX: 986.50,
    sourceY: 564.00,
    sourceWidth: 241,
    sourceHeight: 210,
    depth: 10,
  },
  {
    id: "pink-middle-right",
    label: "右中花",
    artId: "pink-middle-right",
    slotArtId: "pink-middle-right-skeleton",
    sourceX: 938.50,
    sourceY: 929.50,
    sourceWidth: 251,
    sourceHeight: 273,
    depth: 30,
  },
  {
    id: "peach-lower-left",
    label: "下方花",
    artId: "peach-lower-left",
    slotArtId: "peach-lower-left-skeleton",
    sourceX: 659.50,
    sourceY: 1106.50,
    sourceWidth: 289,
    sourceHeight: 263,
    depth: 40,
  },
] as const;

export type BouquetCutoutV01FlowerId = (typeof BOUQUET_CUTOUT_V01_FLOWERS)[number]["id"];

export const BOUQUET_CUTOUT_V01_ART_IDS = [
  BOUQUET_CUTOUT_V01_TEMPLATE.artId,
  ...BOUQUET_CUTOUT_V01_FLOWERS.map((flower) => flower.artId),
  ...BOUQUET_CUTOUT_V01_FLOWERS.map((flower) => flower.slotArtId),
] as const;

export type BouquetCutoutV01ArtId = (typeof BOUQUET_CUTOUT_V01_ART_IDS)[number];
