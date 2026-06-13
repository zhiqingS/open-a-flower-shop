#!/usr/bin/env python3
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "视觉验证/第八轮-AI资产板/ai-asset-sheet-v02-magenta.png"
VERIFY_DIR = ROOT / "视觉验证/第八轮-AI资产板"
VERIFY_CUTOUT_DIR = VERIFY_DIR / "cutouts-v02"
RESOURCE_DIR = ROOT / "assets/resources/art/bouquet-ai-v01"

ASSET_NAMES = [
    "pink-focal-peony-front",
    "pink-focal-peony-left",
    "pink-round-flower",
    "peach-ranunculus",
    "peach-rose-open",
    "peach-rose-bud",
    "blue-delphinium-vertical",
    "blue-delphinium-curved",
    "cream-sweetpea-single-with-bud",
    "cream-sweetpea-sprig",
    "white-daisy-cluster",
    "white-filler-blossom",
    "eucalyptus-leaves",
    "fern-leaves",
    "green-filler-leaves",
    "small-mixed-greenery",
]

# The ninth generated cell contains two separate stems, so pure connected-
# component splitting sees 17 components. Merge the extra stem back into cell 9.
MERGE_GROUPS = [
    [0],
    [1],
    [2],
    [3],
    [4],
    [5],
    [6],
    [7],
    [8, 11],
    [9],
    [10],
    [12],
    [13],
    [14],
    [15],
    [16],
]


def remove_magenta_key(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA")).copy()
    red = rgba[..., 0].astype(np.int16)
    green = rgba[..., 1].astype(np.int16)
    blue = rgba[..., 2].astype(np.int16)
    key = (red > 185) & (blue > 185) & (green < 90) & (np.abs(red - blue) < 95)
    rgba[..., 3] = np.where(key, 0, 255).astype(np.uint8)
    rgba[rgba[..., 3] == 0, :3] = 0
    return Image.fromarray(rgba)


def find_components(image: Image.Image) -> list[tuple[int, int, int, int, int]]:
    alpha = np.asarray(image.getchannel("A"))
    mask = alpha > 0
    height, width = mask.shape
    visited = np.zeros((height, width), dtype=bool)
    components: list[tuple[int, int, int, int, int]] = []

    for y in range(height):
        for x in range(width):
            if visited[y, x] or not mask[y, x]:
                continue
            queue: deque[tuple[int, int]] = deque([(x, y)])
            visited[y, x] = True
            xs: list[int] = []
            ys: list[int] = []
            while queue:
                px, py = queue.popleft()
                xs.append(px)
                ys.append(py)
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
                    if visited[ny, nx] or not mask[ny, nx]:
                        continue
                    visited[ny, nx] = True
                    queue.append((nx, ny))
            area = len(xs)
            if area >= 300:
                components.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1, area))

    return sorted(components, key=lambda box: (box[1] // 260, box[0]))


def crop_group(image: Image.Image, boxes: list[tuple[int, int, int, int, int]], padding: int = 10) -> Image.Image:
    width, height = image.size
    left = max(0, min(box[0] for box in boxes) - padding)
    top = max(0, min(box[1] for box in boxes) - padding)
    right = min(width, max(box[2] for box in boxes) + padding)
    bottom = min(height, max(box[3] for box in boxes) + padding)
    crop = image.crop((left, top, right, bottom))
    bbox = crop.getchannel("A").getbbox()
    if bbox:
        crop = crop.crop(bbox)
    rgba = np.asarray(crop).copy()
    rgba[rgba[..., 3] == 0, :3] = 0
    return Image.fromarray(rgba)


def make_contact_sheet(paths: list[Path]) -> None:
    cell_w = 220
    cell_h = 220
    sheet = Image.new("RGBA", (cell_w * 4, cell_h * 4), (255, 255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    for y in range(0, cell_h * 4, 16):
        for x in range(0, cell_w * 4, 16):
            fill = (235, 231, 222, 255) if ((x // 16 + y // 16) % 2) == 0 else (255, 252, 244, 255)
            draw.rectangle((x, y, x + 15, y + 15), fill=fill)
    font = ImageFont.load_default()
    for index, path in enumerate(paths):
        image = Image.open(path).convert("RGBA")
        image.thumbnail((170, 150), Image.Resampling.LANCZOS)
        col = index % 4
        row = index // 4
        x = col * cell_w
        y = row * cell_h
        sheet.alpha_composite(image, (x + (cell_w - image.width) // 2, y + 18 + (150 - image.height) // 2))
        draw.text((x + 8, y + 180), path.stem[:28], fill=(50, 50, 45, 255), font=font)
    sheet.save(VERIFY_DIR / "ai-asset-sheet-v02-cutouts-contact.png")


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing source asset sheet: {SOURCE}")
    VERIFY_CUTOUT_DIR.mkdir(parents=True, exist_ok=True)
    RESOURCE_DIR.mkdir(parents=True, exist_ok=True)
    for folder in (VERIFY_CUTOUT_DIR, RESOURCE_DIR):
        for old in folder.glob("*.png"):
            old.unlink()

    transparent = remove_magenta_key(Image.open(SOURCE))
    transparent.save(VERIFY_DIR / "ai-asset-sheet-v02-transparent.png")
    components = find_components(transparent)
    if len(components) < 17:
        raise RuntimeError(f"Expected at least 17 raw components before merge, got {len(components)}")

    output_paths: list[Path] = []
    for index, group in enumerate(MERGE_GROUPS):
        crop = crop_group(transparent, [components[item] for item in group])
        filename = f"{index + 1:02d}-{ASSET_NAMES[index]}.png"
        verify_path = VERIFY_CUTOUT_DIR / filename
        resource_path = RESOURCE_DIR / filename
        crop.save(verify_path)
        crop.save(resource_path)
        output_paths.append(verify_path)

    make_contact_sheet(output_paths)
    print(f"source={SOURCE}")
    print(f"transparent={VERIFY_DIR / 'ai-asset-sheet-v02-transparent.png'}")
    print(f"assets={len(output_paths)}")
    print(f"verify_cutouts={VERIFY_CUTOUT_DIR}")
    print(f"resources={RESOURCE_DIR}")


if __name__ == "__main__":
    main()
