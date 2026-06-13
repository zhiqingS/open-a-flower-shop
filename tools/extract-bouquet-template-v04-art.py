#!/usr/bin/env python3
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "视觉验证/第六轮-模板式插花v04/首束花资产板-v0.4.png"
OUTPUT_DIR = ROOT / "assets/resources/art/bouquet-template-v04"
CONTACT_SHEET = ROOT / "视觉验证/第六轮-模板式插花v04/首束花透明资产-v0.4-contact.png"

EXPECTED_NAMES = (
    "focal-left",
    "focal-tilt-left",
    "focal-center",
    "focal-small",
    "focal-side-right",
    "secondary-left",
    "secondary-tilt-left",
    "secondary-center",
    "secondary-bud-tall",
    "secondary-bud-right",
    "secondary-cluster-right",
    "line-blue-left-tall",
    "line-blue-left-mid",
    "line-blue-center",
    "line-blue-right-mid",
    "line-blue-short-right",
    "filler-daisy-left",
    "filler-spray-left",
    "filler-daisy-center",
    "filler-spray-center",
    "filler-spray-right",
    "filler-spray-tall-right",
    "filler-daisy-right",
    "leaf-round-left",
    "leaf-fern-left",
    "leaf-wide-left",
    "leaf-slim-center",
    "leaf-round-center",
    "leaf-large-right",
    "leaf-slim-right",
    "wrapper-paper-left",
    "wrapper-paper-back",
    "wrapper-paper-right",
    "wrapper-translucent-left",
    "wrapper-translucent-right",
    "wrapper-front-fan",
    "wrapper-neck",
    "ribbon-pink",
    "ribbon-blue-stripe",
    "tag-kraft",
)


@dataclass(frozen=True)
class Component:
    bounds: tuple[int, int, int, int]
    area: int

    @property
    def center(self) -> tuple[float, float]:
        left, top, right, bottom = self.bounds
        return ((left + right) / 2, (top + bottom) / 2)


def is_background(red: int, green: int, blue: int) -> bool:
    # The v0.4 board uses a flat magenta key. Keep pink petals/ribbons intact by
    # requiring very low green and high red/blue instead of removing all pinks.
    return red > 190 and blue > 165 and green < 72 and abs(red - blue) < 100


def remove_chroma_magenta(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()

    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = pixels[x, y]
            if not is_background(red, green, blue):
                continue
            magenta_strength = min(red, blue) - green
            if magenta_strength >= 180:
                next_alpha = 0
            else:
                next_alpha = max(0, min(255, int(255 * (180 - magenta_strength) / 70)))
            pixels[x, y] = (red, green, blue, min(alpha, next_alpha))

    return rgba


def find_components(image: Image.Image) -> list[Component]:
    alpha = image.getchannel("A")
    width, height = image.size
    visited = bytearray(width * height)
    components: list[Component] = []

    def alpha_at(px: int, py: int) -> int:
        return alpha.getpixel((px, py))

    for start_y in range(height):
        for start_x in range(width):
            index = start_y * width + start_x
            if visited[index] or alpha_at(start_x, start_y) < 32:
                continue

            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            visited[index] = 1
            left = right = start_x
            top = bottom = start_y
            area = 0

            while queue:
                x, y = queue.popleft()
                area += 1
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)

                for nx, ny in (
                    (x + 1, y),
                    (x - 1, y),
                    (x, y + 1),
                    (x, y - 1),
                    (x + 1, y + 1),
                    (x - 1, y - 1),
                    (x + 1, y - 1),
                    (x - 1, y + 1),
                ):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    nindex = ny * width + nx
                    if visited[nindex] or alpha_at(nx, ny) < 32:
                        continue
                    visited[nindex] = 1
                    queue.append((nx, ny))

            if area >= 1000:
                components.append(Component((left, top, right + 1, bottom + 1), area))

    return components


def sorted_components(components: list[Component]) -> list[Component]:
    rows: list[list[Component]] = []
    for component in sorted(components, key=lambda item: item.center[1]):
        center_y = component.center[1]
        for row in rows:
            row_center = sum(item.center[1] for item in row) / len(row)
            if abs(center_y - row_center) < 86:
                row.append(component)
                break
        else:
            rows.append([component])

    ordered: list[Component] = []
    for row in rows:
        ordered.extend(sorted(row, key=lambda item: item.center[0]))
    return ordered


def crop_component(image: Image.Image, component: Component, padding: int) -> Image.Image:
    left, top, right, bottom = component.bounds
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def trim_alpha(image: Image.Image) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        return image
    return image.crop(bbox)


def make_contact_sheet(files: list[Path]) -> None:
    columns = 6
    cell_width = 190
    cell_height = 218
    rows = (len(files) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), (248, 244, 234))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for index, path in enumerate(files):
        image = Image.open(path).convert("RGBA")
        preview = image.copy()
        preview.thumbnail((150, 150), Image.Resampling.LANCZOS)
        column = index % columns
        row = index // columns
        origin_x = column * cell_width
        origin_y = row * cell_height
        checker = Image.new("RGB", (154, 154), (232, 228, 218))
        checker_draw = ImageDraw.Draw(checker)
        for cx in range(0, 154, 14):
            for cy in range(0, 154, 14):
                if (cx // 14 + cy // 14) % 2 == 0:
                    checker_draw.rectangle((cx, cy, cx + 13, cy + 13), fill=(255, 252, 244))
        sheet.paste(checker, (origin_x + 18, origin_y + 14))
        sheet.paste(
            preview,
            (origin_x + 18 + (154 - preview.width) // 2, origin_y + 14 + (154 - preview.height) // 2),
            preview,
        )
        draw.text((origin_x + 12, origin_y + 176), path.stem[:28], fill=(70, 72, 62), font=font)

    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET)


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing source board: {SOURCE}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for old_file in OUTPUT_DIR.glob("*.png"):
        old_file.unlink()

    source = Image.open(SOURCE).convert("RGB")
    transparent = remove_chroma_magenta(source)
    components = sorted_components(find_components(transparent))

    if len(components) != len(EXPECTED_NAMES):
        details = "\n".join(
            f"{index:02d}: bounds={component.bounds} center={component.center} area={component.area}"
            for index, component in enumerate(components)
        )
        raise ValueError(
            f"Expected {len(EXPECTED_NAMES)} components, found {len(components)}.\n{details}"
        )

    written: list[Path] = []
    for name, component in zip(EXPECTED_NAMES, components):
        cropped = crop_component(transparent, component, padding=8)
        cropped = trim_alpha(cropped)
        output = OUTPUT_DIR / f"{name}.png"
        cropped.save(output)
        written.append(output)

    make_contact_sheet(written)
    print(f"Source: {SOURCE}")
    print(f"Detected components: {len(components)}")
    print(f"Generated assets: {len(written)} in {OUTPUT_DIR}")
    print(f"Contact sheet: {CONTACT_SHEET}")


if __name__ == "__main__":
    main()
