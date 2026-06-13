#!/usr/bin/env python3
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "视觉验证/GPT-第一轮/风格素材/开个花店素材/Gemini_Generated_Image_9481bn9481bn9481.png"
ANNOTATED = Path("/Users/bytedance/Desktop/Snipaste_2026-06-13_15-21-44.png")
OUTPUT_DIR = ROOT / "assets/resources/art/bouquet-cutout-v01"
VERIFY_DIR = ROOT / "视觉验证/第七轮-原图抠花验证"


@dataclass(frozen=True)
class MarkedFlower:
    id: str
    label: str
    # Coordinates in the user's annotated screenshot, excluding the black border.
    screenshot_rect: tuple[int, int, int, int]
    kind: str
    depth: int


FLOWERS = (
    MarkedFlower("hero-left", "左主花", (261, 355, 480, 558), "pink", 20),
    MarkedFlower("pink-upper-right", "右上花", (523, 265, 688, 404), "pink", 10),
    MarkedFlower("pink-middle-right", "右中花", (491, 479, 656, 644), "pink", 30),
    MarkedFlower("peach-lower-left", "下方花", (311, 589, 486, 748), "peach", 40),
)


def load_images() -> tuple[Image.Image, Image.Image]:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing source image: {SOURCE}")
    if not ANNOTATED.exists():
        raise FileNotFoundError(f"Missing annotated screenshot: {ANNOTATED}")
    return Image.open(SOURCE).convert("RGBA"), Image.open(ANNOTATED).convert("RGB")


def find_vertical_offset(source: Image.Image, annotated: Image.Image) -> tuple[float, int]:
    scale = annotated.width / source.width
    scaled_height = round(source.height * scale)
    scaled = source.convert("RGB").resize((annotated.width, scaled_height), Image.Resampling.BICUBIC)
    target = np.asarray(annotated).astype(np.int16)
    # Ignore the pure black annotation strokes while matching.
    mask = ~((target[:, :, 0] < 20) & (target[:, :, 1] < 20) & (target[:, :, 2] < 20))

    best_score = float("inf")
    best_offset = 0
    for y_offset in range(0, scaled_height - annotated.height + 1):
        crop = np.asarray(scaled.crop((0, y_offset, annotated.width, y_offset + annotated.height))).astype(np.int16)
        diff = np.abs(crop - target).sum(axis=2)
        score = float(diff[mask].mean())
        if score < best_score:
            best_score = score
            best_offset = y_offset
    return scale, best_offset


def screenshot_rect_to_source_crop(
    rect: tuple[int, int, int, int],
    scale: float,
    scaled_y_offset: int,
) -> tuple[int, int, int, int]:
    left, top, right, bottom = rect
    inv = 1 / scale
    crop_y = scaled_y_offset * inv
    return (
        round(left * inv),
        round(top * inv),
        round(right * inv),
        round(bottom * inv),
    ), round(crop_y)


def make_color_seed(crop: Image.Image, kind: str) -> Image.Image:
    rgb = np.asarray(crop.convert("RGB"))
    red = rgb[:, :, 0]
    green = rgb[:, :, 1]
    blue = rgb[:, :, 2]

    if kind == "pink":
        petal = (
            (red > 145)
            & (blue > 110)
            & (green < 215)
            & (red > green + 8)
            & (blue > green - 32)
        )
        ink = (
            (red > 90)
            & (red < 190)
            & (green < 115)
            & (blue > 65)
            & (red > green + 18)
        )
    else:
        petal = (
            (red > 155)
            & (green > 75)
            & (blue < 190)
            & (red > blue + 26)
            & (red > green + 2)
        )
        ink = (
            (red > 95)
            & (red < 185)
            & (green > 35)
            & (green < 120)
            & (blue < 110)
            & (red > green + 12)
        )

    seed = (petal | ink).astype(np.uint8) * 255
    return Image.fromarray(seed, "L")


def keep_largest_component(mask: Image.Image) -> Image.Image:
    alpha = np.asarray(mask)
    height, width = alpha.shape
    visited = np.zeros((height, width), dtype=bool)
    components: list[list[tuple[int, int]]] = []

    for y in range(height):
        for x in range(width):
            if visited[y, x] or alpha[y, x] < 64:
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
                    if visited[ny, nx] or alpha[ny, nx] < 64:
                        continue
                    visited[ny, nx] = True
                    queue.append((nx, ny))
            components.append(points)

    if not components:
        return mask

    kept = max(components, key=len)
    output = Image.new("L", (width, height), 0)
    pixels = output.load()
    for x, y in kept:
        pixels[x, y] = 255
    return output


def build_flower_mask(crop: Image.Image, kind: str) -> Image.Image:
    seed = make_color_seed(crop, kind)
    expanded = seed.filter(ImageFilter.MaxFilter(9))
    rgb = np.asarray(crop.convert("RGB"))
    dark_lines = (
        (rgb[:, :, 0] < 155)
        & (rgb[:, :, 1] < 130)
        & (rgb[:, :, 2] < 135)
        & (np.asarray(expanded) > 0)
    )
    combined = Image.fromarray(np.maximum(np.asarray(seed), dark_lines.astype(np.uint8) * 255), "L")
    combined = combined.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(3))
    combined = keep_largest_component(combined)
    return combined.filter(ImageFilter.GaussianBlur(0.8))


def apply_mask_to_crop(crop: Image.Image, mask: Image.Image) -> Image.Image:
    rgba = crop.convert("RGBA")
    rgba.putalpha(mask)
    return rgba


def erase_from_template(template: Image.Image, flower: Image.Image, rect: tuple[int, int, int, int]) -> None:
    left, top, right, bottom = rect
    alpha = np.asarray(flower.getchannel("A"))
    template_pixels = template.load()
    for y in range(bottom - top):
        for x in range(right - left):
            if alpha[y, x] > 10:
                red, green, blue, _ = template_pixels[left + x, top + y]
                template_pixels[left + x, top + y] = (red, green, blue, 0)


def make_contact_sheet(paths: list[Path]) -> None:
    cell_w = 220
    cell_h = 190
    sheet = Image.new("RGB", (cell_w * len(paths), cell_h), (248, 244, 234))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, path in enumerate(paths):
        image = Image.open(path).convert("RGBA")
        preview = image.copy()
        preview.thumbnail((180, 135), Image.Resampling.LANCZOS)
        x = index * cell_w
        checker = Image.new("RGB", (190, 145), (232, 228, 218))
        checker_draw = ImageDraw.Draw(checker)
        for cx in range(0, 190, 14):
            for cy in range(0, 145, 14):
                if (cx // 14 + cy // 14) % 2 == 0:
                    checker_draw.rectangle((cx, cy, cx + 13, cy + 13), fill=(255, 252, 244))
        sheet.paste(checker, (x + 15, 12))
        sheet.paste(preview, (x + 15 + (190 - preview.width) // 2, 12 + (145 - preview.height) // 2), preview)
        draw.text((x + 14, 162), path.stem[:28], fill=(70, 72, 62), font=font)
    sheet.save(VERIFY_DIR / "花头透明资产-contact.png")


def main() -> None:
    source, annotated = load_images()
    scale, scaled_y_offset = find_vertical_offset(source, annotated)
    inv = 1 / scale
    crop_top = round(scaled_y_offset * inv)
    crop_height = round(annotated.height * inv)
    source_crop = source.crop((0, crop_top, source.width, crop_top + crop_height))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    VERIFY_DIR.mkdir(parents=True, exist_ok=True)
    for path in OUTPUT_DIR.glob("*.png"):
        path.unlink()

    template = source_crop.copy()
    metadata_lines = [
        "export const BOUQUET_CUTOUT_V01_ROOT = \"art/bouquet-cutout-v01\";",
        "",
        "export const BOUQUET_CUTOUT_V01_TEMPLATE = {",
        f"  artId: \"template-base\",",
        f"  sourceWidth: {source_crop.width},",
        f"  sourceHeight: {source_crop.height},",
        "} as const;",
        "",
        "export const BOUQUET_CUTOUT_V01_FLOWERS = [",
    ]

    flower_paths: list[Path] = []
    restore = template.copy()

    for marked in FLOWERS:
        (left, top, right, bottom), _ = screenshot_rect_to_source_crop(
            marked.screenshot_rect,
            scale,
            scaled_y_offset,
        )
        rect = (left, top, right, bottom)
        crop = source_crop.crop(rect)
        mask = build_flower_mask(crop, marked.kind)
        flower = apply_mask_to_crop(crop, mask)
        erase_from_template(template, flower, rect)

        output = OUTPUT_DIR / f"{marked.id}.png"
        flower.save(output)
        flower_paths.append(output)

        # Reconstruct from the generated layers for visual QA.
        restore.alpha_composite(flower, (left, top))

        center_x = (left + right) / 2
        center_y = (top + bottom) / 2
        metadata_lines.extend(
            [
                "  {",
                f"    id: \"{marked.id}\",",
                f"    label: \"{marked.label}\",",
                f"    artId: \"{marked.id}\",",
                f"    sourceX: {center_x:.2f},",
                f"    sourceY: {center_y:.2f},",
                f"    sourceWidth: {right - left},",
                f"    sourceHeight: {bottom - top},",
                f"    depth: {marked.depth},",
                "  },",
            ],
        )

    metadata_lines.extend(
        [
            "] as const;",
            "",
            "export type BouquetCutoutV01FlowerId = (typeof BOUQUET_CUTOUT_V01_FLOWERS)[number][\"id\"];",
            "",
            "export const BOUQUET_CUTOUT_V01_ART_IDS = [",
            "  BOUQUET_CUTOUT_V01_TEMPLATE.artId,",
            "  ...BOUQUET_CUTOUT_V01_FLOWERS.map((flower) => flower.artId),",
            "] as const;",
            "",
            "export type BouquetCutoutV01ArtId = (typeof BOUQUET_CUTOUT_V01_ART_IDS)[number];",
            "",
        ],
    )

    template.save(OUTPUT_DIR / "template-base.png")
    source_crop.save(VERIFY_DIR / "原图裁切目标.png")
    template.save(VERIFY_DIR / "扣除4朵花后的模板.png")
    restore.save(VERIFY_DIR / "模板加4朵花还原预览.png")
    make_contact_sheet(flower_paths)
    (ROOT / "assets/scripts/prototype/bouquetCutoutV01Config.ts").write_text(
        "\n".join(metadata_lines),
        encoding="utf-8",
    )

    print(f"source={SOURCE}")
    print(f"annotated={ANNOTATED}")
    print(f"scale={scale:.8f}")
    print(f"scaled_y_offset={scaled_y_offset}")
    print(f"source_crop=(0,{crop_top},{source.width},{crop_top + crop_height})")
    print(f"output={OUTPUT_DIR}")
    print(f"verify={VERIFY_DIR}")


if __name__ == "__main__":
    main()
