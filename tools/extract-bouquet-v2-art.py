#!/usr/bin/env python3
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "视觉验证/第二轮-首束花资产验证/首束花资产板-v2-斑斓花朵.png"
OUTPUT_DIR = ROOT / "assets/resources/art/bouquet-v2"
CONTACT_SHEET = ROOT / "视觉验证/第二轮-首束花资产验证/首束花透明资产-v2-contact.png"


@dataclass(frozen=True)
class CropSpec:
    name: str
    box: tuple[int, int, int, int]
    threshold: int = 34
    padding: int = 8


CROPS: tuple[CropSpec, ...] = (
    CropSpec("dahlia-1", (22, 32, 266, 318), 38),
    CropSpec("dahlia-2", (292, 32, 542, 330), 38),
    CropSpec("ranunculus-peach-1", (562, 38, 790, 332), 34),
    CropSpec("ranunculus-peach-2", (805, 46, 970, 332), 34),
    CropSpec("ranunculus-yellow-1", (1014, 42, 1168, 335), 30),
    CropSpec("delphinium-1", (25, 335, 188, 660), 36),
    CropSpec("delphinium-2", (218, 330, 328, 660), 36),
    CropSpec("daisy-1", (625, 345, 822, 655), 24),
    CropSpec("daisy-2", (850, 345, 1032, 648), 24),
    CropSpec("leaf-round", (1050, 355, 1192, 625), 34),
    CropSpec("leaf-slim", (1200, 356, 1325, 620), 34),
    CropSpec("leaf-large", (1338, 356, 1524, 626), 34),
    CropSpec("wrapper-back", (30, 675, 370, 1014), 18, 12),
    CropSpec("wrapper-front", (430, 675, 765, 1000), 18, 12),
    CropSpec("ribbon-pink", (1232, 668, 1518, 1008), 24, 12),
)


def corner_average(image: Image.Image) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    samples = []
    for x, y in (
        (0, 0),
        (width - 1, 0),
        (0, height - 1),
        (width - 1, height - 1),
    ):
        samples.append(rgb.getpixel((x, y)))
    return tuple(sum(pixel[channel] for pixel in samples) // len(samples) for channel in range(3))


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return sum((a[channel] - b[channel]) ** 2 for channel in range(3)) ** 0.5


def remove_border_background(image: Image.Image, threshold: int) -> Image.Image:
    rgba = image.convert("RGBA")
    rgb = rgba.convert("RGB")
    width, height = rgba.size
    bg = corner_average(image)
    visited = set()
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    pixels = rgba.load()
    rgb_pixels = rgb.load()

    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= width or y >= height or (x, y) in visited:
            continue
        visited.add((x, y))
        if color_distance(rgb_pixels[x, y], bg) > threshold:
            continue

        red, green, blue, _ = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        queue.append((x + 1, y))
        queue.append((x - 1, y))
        queue.append((x, y + 1))
        queue.append((x, y - 1))

    return rgba


def trim_alpha(image: Image.Image, padding: int) -> Image.Image:
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        return image

    left, top, right, bottom = bounds
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def make_contact_sheet(files: list[Path]) -> None:
    cell_width = 220
    cell_height = 250
    columns = 5
    rows = (len(files) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), (248, 244, 234))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for index, path in enumerate(files):
        image = Image.open(path).convert("RGBA")
        image.thumbnail((170, 185), Image.Resampling.LANCZOS)
        column = index % columns
        row = index // columns
        x = column * cell_width + (cell_width - image.width) // 2
        y = row * cell_height + 20
        checker = Image.new("RGB", (170, 185), (236, 232, 222))
        checker_draw = ImageDraw.Draw(checker)
        for cx in range(0, 170, 16):
            for cy in range(0, 185, 16):
                if (cx // 16 + cy // 16) % 2 == 0:
                    checker_draw.rectangle((cx, cy, cx + 15, cy + 15), fill=(255, 252, 244))
        sheet.paste(checker, (column * cell_width + 25, row * cell_height + 15))
        sheet.paste(image, (x, y), image)
        draw.text((column * cell_width + 18, row * cell_height + 215), path.stem, fill=(70, 72, 62), font=font)

    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET)


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing source board: {SOURCE}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE)
    written: list[Path] = []

    for crop in CROPS:
        image = source.crop(crop.box)
        image = remove_border_background(image, crop.threshold)
        image = trim_alpha(image, crop.padding)
        output = OUTPUT_DIR / f"{crop.name}.png"
        image.save(output)
        written.append(output)

    make_contact_sheet(written)
    print(f"Generated {len(written)} prototype art assets in {OUTPUT_DIR}")
    print(f"Contact sheet: {CONTACT_SHEET}")


if __name__ == "__main__":
    main()
