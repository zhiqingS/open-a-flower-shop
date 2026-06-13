#!/usr/bin/env python3
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid5, NAMESPACE_URL

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import json


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "视觉验证/GPT-第一轮/风格素材/开个花店素材/Gemini_Generated_Image_3lqi8w3lqi8w3lqi.png"
OUTPUT_DIR = ROOT / "assets/resources/art/bouquet-cutout-v02"
VERIFY_DIR = ROOT / "视觉验证/第十轮-花束制作v02"
CONFIG_PATH = ROOT / "assets/scripts/prototype/bouquetCutoutV02Config.ts"

# Keep the bouquet and bow, but remove Gemini's mock operation bar.
TEMPLATE_CROP = (0, 380, 1536, 2424)


@dataclass(frozen=True)
class Placement:
    x: float
    y: float
    width: int
    height: int
    depth: int


@dataclass(frozen=True)
class Flower:
    id: str
    label: str
    crop: tuple[int, int, int, int]
    placements: tuple[Placement, ...]


FLOWERS = (
    Flower(
        "peach-rosette-front",
        "桃橙玫瑰",
        (46, 2468, 336, 2738),
        (
            Placement(604, 1470, 304, 274, 42),
        ),
    ),
    Flower(
        "pink-peony-left",
        "粉色主花",
        (344, 2466, 704, 2738),
        (
            Placement(536, 1188, 362, 282, 24),
        ),
    ),
    Flower(
        "pink-peony-upper-right",
        "粉色上花",
        (760, 2462, 1090, 2738),
        (
            Placement(872, 1008, 300, 278, 18),
        ),
    ),
    Flower(
        "pink-peony-middle-right",
        "粉色圆花",
        (760, 2462, 1090, 2738),
        (
            Placement(806, 1364, 326, 302, 36),
        ),
    ),
)


def load_source() -> Image.Image:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing Gemini source image: {SOURCE}")
    return Image.open(SOURCE).convert("RGBA")


def is_background_like(rgb: np.ndarray) -> np.ndarray:
    red = rgb[:, :, 0].astype(np.int16)
    green = rgb[:, :, 1].astype(np.int16)
    blue = rgb[:, :, 2].astype(np.int16)
    max_channel = np.maximum.reduce([red, green, blue])
    min_channel = np.minimum.reduce([red, green, blue])
    return (
        (red > 198)
        & (green > 178)
        & (blue > 150)
        & ((max_channel - min_channel) < 88)
    )


def flood_connected_background(bg_like: np.ndarray) -> np.ndarray:
    height, width = bg_like.shape
    visited = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        for y in (0, height - 1):
            if bg_like[y, x] and not visited[y, x]:
                visited[y, x] = True
                queue.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if bg_like[y, x] and not visited[y, x]:
                visited[y, x] = True
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if nx < 0 or ny < 0 or nx >= width or ny >= height:
                continue
            if visited[ny, nx] or not bg_like[ny, nx]:
                continue
            visited[ny, nx] = True
            queue.append((nx, ny))
    return visited


def keep_large_components(mask: Image.Image, min_area: int = 240) -> Image.Image:
    alpha = np.asarray(mask)
    height, width = alpha.shape
    visited = np.zeros((height, width), dtype=bool)
    output = Image.new("L", (width, height), 0)
    pixels = output.load()

    for y in range(height):
        for x in range(width):
            if visited[y, x] or alpha[y, x] < 32:
                continue
            points: list[tuple[int, int]] = []
            queue: deque[tuple[int, int]] = deque([(x, y)])
            visited[y, x] = True
            while queue:
                px, py = queue.popleft()
                points.append((px, py))
                for nx, ny in (
                    (px + 1, py),
                    (px - 1, py),
                    (px, py + 1),
                    (px, py - 1),
                    (px + 1, py + 1),
                    (px - 1, py - 1),
                    (px + 1, py - 1),
                    (px - 1, py + 1),
                ):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    if visited[ny, nx] or alpha[ny, nx] < 32:
                        continue
                    visited[ny, nx] = True
                    queue.append((nx, ny))

            if len(points) >= min_area:
                for px, py in points:
                    pixels[px, py] = 255
    return output


def keep_largest_component(mask: Image.Image) -> Image.Image:
    alpha = np.asarray(mask)
    height, width = alpha.shape
    visited = np.zeros((height, width), dtype=bool)
    best: list[tuple[int, int]] = []

    for y in range(height):
        for x in range(width):
            if visited[y, x] or alpha[y, x] < 32:
                continue
            points: list[tuple[int, int]] = []
            queue: deque[tuple[int, int]] = deque([(x, y)])
            visited[y, x] = True
            while queue:
                px, py = queue.popleft()
                points.append((px, py))
                for nx, ny in (
                    (px + 1, py),
                    (px - 1, py),
                    (px, py + 1),
                    (px, py - 1),
                    (px + 1, py + 1),
                    (px - 1, py - 1),
                    (px + 1, py - 1),
                    (px - 1, py + 1),
                ):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    if visited[ny, nx] or alpha[ny, nx] < 32:
                        continue
                    visited[ny, nx] = True
                    queue.append((nx, ny))
            if len(points) > len(best):
                best = points

    output = Image.new("L", (width, height), 0)
    pixels = output.load()
    for px, py in best:
        pixels[px, py] = 255
    return output


def trim_transparent(image: Image.Image, padding: int = 3) -> Image.Image:
    alpha = image.getchannel("A").point(lambda value: 255 if value > 10 else 0)
    bbox = alpha.getbbox()
    if bbox is None:
        return image
    left, top, right, bottom = bbox
    return image.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(image.width, right + padding),
            min(image.height, bottom + padding),
        ),
    )


def make_cutout(crop: Image.Image) -> Image.Image:
    rgb = np.asarray(crop.convert("RGB"))
    bg_like = is_background_like(rgb)
    connected_bg = flood_connected_background(bg_like)
    mask = Image.fromarray((~connected_bg).astype(np.uint8) * 255)
    mask = keep_largest_component(mask)
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    output = crop.convert("RGBA")
    output.putalpha(mask)
    return trim_transparent(output)


def write_image_meta(path: Path, width: int, height: int) -> None:
    name = path.stem
    uuid = str(uuid5(NAMESPACE_URL, f"first-mini-game/bouquet-cutout-v02/{name}"))
    meta = {
        "ver": "1.0.27",
        "importer": "image",
        "imported": True,
        "uuid": uuid,
        "files": [".json", ".png"],
        "subMetas": {
            "6c48a": {
                "importer": "texture",
                "uuid": f"{uuid}@6c48a",
                "displayName": name,
                "id": "6c48a",
                "name": "texture",
                "userData": {
                    "wrapModeS": "clamp-to-edge",
                    "wrapModeT": "clamp-to-edge",
                    "imageUuidOrDatabaseUri": uuid,
                    "isUuid": True,
                    "visible": False,
                    "minfilter": "linear",
                    "magfilter": "linear",
                    "mipfilter": "none",
                    "anisotropy": 0,
                },
                "ver": "1.0.22",
                "imported": True,
                "files": [".json"],
                "subMetas": {},
            },
            "f9941": {
                "importer": "sprite-frame",
                "uuid": f"{uuid}@f9941",
                "displayName": name,
                "id": "f9941",
                "name": "spriteFrame",
                "userData": {
                    "trimThreshold": 1,
                    "rotated": False,
                    "offsetX": 0,
                    "offsetY": 0,
                    "trimX": 0,
                    "trimY": 0,
                    "width": width,
                    "height": height,
                    "rawWidth": width,
                    "rawHeight": height,
                    "borderTop": 0,
                    "borderBottom": 0,
                    "borderLeft": 0,
                    "borderRight": 0,
                    "packable": True,
                    "pixelsToUnit": 100,
                    "pivotX": 0.5,
                    "pivotY": 0.5,
                    "meshType": 0,
                    "vertices": {
                        "rawPosition": [
                            -width / 2,
                            -height / 2,
                            0,
                            width / 2,
                            -height / 2,
                            0,
                            -width / 2,
                            height / 2,
                            0,
                            width / 2,
                            height / 2,
                            0,
                        ],
                        "indexes": [0, 1, 2, 2, 1, 3],
                        "uv": [0, height, width, height, 0, 0, width, 0],
                        "nuv": [0, 0, 1, 0, 0, 1, 1, 1],
                        "minPos": [-width / 2, -height / 2, 0],
                        "maxPos": [width / 2, height / 2, 0],
                    },
                    "isUuid": True,
                    "imageUuidOrDatabaseUri": f"{uuid}@6c48a",
                    "atlasUuid": "",
                    "trimType": "auto",
                },
                "ver": "1.0.12",
                "imported": True,
                "files": [".json"],
                "subMetas": {},
            },
        },
        "userData": {
            "type": "sprite-frame",
            "hasAlpha": True,
            "redirect": "f9941",
        },
    }
    path.with_suffix(path.suffix + ".meta").write_text(json.dumps(meta, indent=2), encoding="utf-8")


def write_directory_meta(path: Path) -> None:
    uuid = str(uuid5(NAMESPACE_URL, "first-mini-game/bouquet-cutout-v02-directory"))
    meta = {
        "ver": "1.2.0",
        "importer": "directory",
        "imported": True,
        "uuid": uuid,
        "files": [],
        "subMetas": {},
        "userData": {},
    }
    path.with_suffix(path.suffix + ".meta").write_text(json.dumps(meta, indent=2), encoding="utf-8")


def make_contact_sheet(paths: list[Path], output: Path) -> None:
    cell_w = 220
    cell_h = 188
    sheet = Image.new("RGB", (cell_w * len(paths), cell_h), (246, 242, 232))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, path in enumerate(paths):
        image = Image.open(path).convert("RGBA")
        preview = image.copy()
        preview.thumbnail((180, 132), Image.Resampling.LANCZOS)
        x = index * cell_w
        checker = Image.new("RGB", (190, 142), (229, 224, 214))
        checker_draw = ImageDraw.Draw(checker)
        for cx in range(0, 190, 14):
            for cy in range(0, 142, 14):
                if (cx // 14 + cy // 14) % 2 == 0:
                    checker_draw.rectangle((cx, cy, cx + 13, cy + 13), fill=(255, 252, 244))
        sheet.paste(checker, (x + 15, 12))
        sheet.paste(preview, (x + 15 + (190 - preview.width) // 2, 12 + (132 - preview.height) // 2), preview)
        draw.text((x + 14, 158), path.stem[:28], fill=(70, 72, 62), font=font)
    sheet.save(output)


def overlay_scaled(base: Image.Image, layer: Image.Image, placement: Placement) -> None:
    scaled = layer.resize((placement.width, placement.height), Image.Resampling.LANCZOS)
    x = round(placement.x - placement.width / 2)
    y = round(placement.y - placement.height / 2 - TEMPLATE_CROP[1])
    base.alpha_composite(scaled, (x, y))


def write_config(template: Image.Image, cutouts: dict[str, Image.Image]) -> None:
    lines = [
        'export const BOUQUET_CUTOUT_V02_ROOT = "art/bouquet-cutout-v02";',
        "",
        "export const BOUQUET_CUTOUT_V02_TEMPLATE = {",
        '  artId: "template-base",',
        f"  sourceWidth: {template.width},",
        f"  sourceHeight: {template.height},",
        "} as const;",
        "",
        "export const BOUQUET_CUTOUT_V02_FLOWERS = [",
    ]
    for flower in FLOWERS:
        cutout = cutouts[flower.id]
        lines.extend(
            [
                "  {",
                f'    id: "{flower.id}",',
                f'    label: "{flower.label}",',
                f'    artId: "{flower.id}",',
                f"    sourceWidth: {cutout.width},",
                f"    sourceHeight: {cutout.height},",
                "    placements: [",
            ],
        )
        for placement in flower.placements:
            lines.extend(
                [
                    "      {",
                    f"        x: {placement.x:.2f},",
                    f"        y: {placement.y - TEMPLATE_CROP[1]:.2f},",
                    f"        width: {placement.width},",
                    f"        height: {placement.height},",
                    f"        depth: {placement.depth},",
                    "      },",
                ],
            )
        lines.extend(["    ],", "  },"])
    lines.extend(
        [
            "] as const;",
            "",
            "export type BouquetCutoutV02FlowerId = (typeof BOUQUET_CUTOUT_V02_FLOWERS)[number][\"id\"];",
            "",
            "export const BOUQUET_CUTOUT_V02_ART_IDS = [",
            "  BOUQUET_CUTOUT_V02_TEMPLATE.artId,",
            "  ...BOUQUET_CUTOUT_V02_FLOWERS.map((flower) => flower.artId),",
            "] as const;",
            "",
            "export type BouquetCutoutV02ArtId = (typeof BOUQUET_CUTOUT_V02_ART_IDS)[number];",
            "",
        ],
    )
    CONFIG_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    source = load_source()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    VERIFY_DIR.mkdir(parents=True, exist_ok=True)
    write_directory_meta(OUTPUT_DIR)

    for path in OUTPUT_DIR.glob("*.png"):
        path.unlink()
    for path in OUTPUT_DIR.glob("*.png.meta"):
        path.unlink()

    template = source.crop(TEMPLATE_CROP)
    template_path = OUTPUT_DIR / "template-base.png"
    template.save(template_path)
    write_image_meta(template_path, template.width, template.height)

    cutout_paths: list[Path] = []
    cutouts: dict[str, Image.Image] = {}
    for flower in FLOWERS:
        cutout = make_cutout(source.crop(flower.crop))
        path = OUTPUT_DIR / f"{flower.id}.png"
        cutout.save(path)
        write_image_meta(path, cutout.width, cutout.height)
        cutout_paths.append(path)
        cutouts[flower.id] = cutout

    preview = template.copy()
    for flower in FLOWERS:
        for placement in flower.placements:
            overlay_scaled(preview, cutouts[flower.id], placement)

    template.save(VERIFY_DIR / "template-base-v02.png")
    preview.save(VERIFY_DIR / "template-complete-preview-v02.png")
    make_contact_sheet(cutout_paths, VERIFY_DIR / "flower-cutouts-contact-v02.png")
    write_config(template, cutouts)

    print(f"source={SOURCE}")
    print(f"output={OUTPUT_DIR}")
    print(f"verify={VERIFY_DIR}")
    print(f"config={CONFIG_PATH}")
    print(f"template={template.size}")
    for flower in FLOWERS:
        cutout = cutouts[flower.id]
        print(f"{flower.id}: cutout={cutout.size} placements={len(flower.placements)}")


if __name__ == "__main__":
    main()
