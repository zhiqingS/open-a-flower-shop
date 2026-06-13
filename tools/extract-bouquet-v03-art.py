#!/usr/bin/env python3
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "视觉验证/第三轮-首束花视觉垂直切片-v0.2/首束花资产板-v0.2.png"
OUTPUT_DIR = ROOT / "assets/resources/art/bouquet-v03"
CONTACT_SHEET = ROOT / "视觉验证/第三轮-首束花视觉垂直切片-v0.2/首束花透明资产-v0.2-contact.png"


@dataclass(frozen=True)
class CellSpec:
    name: str
    column: int
    row: int
    padding: int = 10
    threshold: int = 56
    opaque_threshold: int = 86


CELLS: tuple[CellSpec, ...] = (
    CellSpec("dahlia-a", 0, 0, 12, 58),
    CellSpec("dahlia-b", 1, 0, 12, 58),
    CellSpec("ranunculus-peach-a", 2, 0, 12, 58),
    CellSpec("ranunculus-yellow-b", 3, 0, 12, 58),
    CellSpec("delphinium-a", 0, 1, 12, 58),
    CellSpec("delphinium-b", 1, 1, 12, 58),
    CellSpec("daisy-a", 2, 1, 12, 58),
    CellSpec("daisy-b", 3, 1, 12, 58),
    CellSpec("leaf-round-a", 0, 2, 12, 58),
    CellSpec("leaf-slim-b", 1, 2, 12, 58),
    CellSpec("wrapper-back", 2, 2, 14, 60),
    CellSpec("wrapper-front", 3, 2, 14, 60),
    CellSpec("ribbon-pink", 0, 3, 14, 58),
    CellSpec("foliage-a", 1, 3, 12, 58),
    CellSpec("foliage-b", 2, 3, 12, 58),
)


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return sum((a[channel] - b[channel]) ** 2 for channel in range(3)) ** 0.5


def border_average(image: Image.Image) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    samples: list[tuple[int, int, int]] = []

    for x in range(width):
        samples.append(rgb.getpixel((x, 0)))
        samples.append(rgb.getpixel((x, height - 1)))
    for y in range(height):
        samples.append(rgb.getpixel((0, y)))
        samples.append(rgb.getpixel((width - 1, y)))

    return tuple(sum(pixel[channel] for pixel in samples) // len(samples) for channel in range(3))


def remove_border_background(image: Image.Image, threshold: int, opaque_threshold: int) -> Image.Image:
    rgba = image.convert("RGBA")
    rgb = rgba.convert("RGB")
    width, height = rgba.size
    bg = border_average(image)
    visited: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()
    pixels = rgba.load()
    rgb_pixels = rgb.load()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= width or y >= height or (x, y) in visited:
            continue

        visited.add((x, y))
        distance = color_distance(rgb_pixels[x, y], bg)
        if distance > opaque_threshold:
            continue

        red, green, blue, _ = pixels[x, y]
        if distance <= threshold:
            alpha = 0
        else:
            alpha = int(255 * (distance - threshold) / max(1, opaque_threshold - threshold))
        pixels[x, y] = (red, green, blue, alpha)

        queue.append((x + 1, y))
        queue.append((x - 1, y))
        queue.append((x, y + 1))
        queue.append((x, y - 1))

    return rgba


def despill_magenta(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()

    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                continue
            magenta_bias = max(0, min(red, blue) - green)
            if magenta_bias > 16:
                red = max(0, red - magenta_bias // 2)
                blue = max(0, blue - magenta_bias // 2)
                green = min(255, green + magenta_bias // 4)
                pixels[x, y] = (red, green, blue, alpha)

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


def normalize_canvas(image: Image.Image, target_size: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGBA", target_size, (0, 0, 0, 0))
    image.thumbnail((target_size[0] - 24, target_size[1] - 24), Image.Resampling.LANCZOS)
    x = (target_size[0] - image.width) // 2
    y = target_size[1] - image.height - 8
    canvas.alpha_composite(image, (x, y))
    return canvas


def make_contact_sheet(files: list[Path]) -> None:
    cell_width = 190
    cell_height = 220
    columns = 5
    rows = (len(files) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), (248, 244, 234))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for index, path in enumerate(files):
        image = Image.open(path).convert("RGBA")
        preview = image.copy()
        preview.thumbnail((145, 150), Image.Resampling.LANCZOS)
        column = index % columns
        row = index // columns
        checker = Image.new("RGB", (150, 155), (235, 231, 222))
        checker_draw = ImageDraw.Draw(checker)
        for cx in range(0, 150, 14):
            for cy in range(0, 155, 14):
                if (cx // 14 + cy // 14) % 2 == 0:
                    checker_draw.rectangle((cx, cy, cx + 13, cy + 13), fill=(255, 252, 244))
        sheet.paste(checker, (column * cell_width + 20, row * cell_height + 16))
        x = column * cell_width + 20 + (150 - preview.width) // 2
        y = row * cell_height + 16 + (155 - preview.height) // 2
        sheet.paste(preview, (x, y), preview)
        draw.text((column * cell_width + 16, row * cell_height + 184), path.stem, fill=(70, 72, 62), font=font)

    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET)


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing source board: {SOURCE}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")
    cell_width = source.width // 4
    cell_height = source.height // 4
    written: list[Path] = []

    for cell in CELLS:
        left = cell.column * cell_width
        top = cell.row * cell_height
        right = source.width if cell.column == 3 else (cell.column + 1) * cell_width
        bottom = source.height if cell.row == 3 else (cell.row + 1) * cell_height
        image = source.crop((left, top, right, bottom))
        image = remove_border_background(image, cell.threshold, cell.opaque_threshold)
        image = despill_magenta(image)
        image = trim_alpha(image, cell.padding)
        image = normalize_canvas(image, (512, 512))

        alpha = image.getchannel("A")
        visible_pixels = sum(1 for value in alpha.getdata() if value > 0)
        if visible_pixels < 2500:
            raise ValueError(f"Extracted asset looks empty: {cell.name}")

        output = OUTPUT_DIR / f"{cell.name}.png"
        image.save(output)
        written.append(output)

    make_contact_sheet(written)
    print(f"Generated {len(written)} v0.2 bouquet assets in {OUTPUT_DIR}")
    print(f"Contact sheet: {CONTACT_SHEET}")


if __name__ == "__main__":
    main()
