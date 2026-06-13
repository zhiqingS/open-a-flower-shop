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
            (red > 165)
            & (blue > 122)
            & (green < 210)
            & (red > green + 16)
            & (blue > green - 18)
        )
        ink = (
            (red > 105)
            & (red < 220)
            & (green < 155)
            & (blue > 92)
            & (red > green + 18)
            & (blue > green - 10)
        )
    else:
        petal = (
            (red > 165)
            & (green > 82)
            & (blue < 168)
            & (red > blue + 34)
            & (red > green + 6)
        )
        ink = (
            (red > 105)
            & (red < 205)
            & (green > 42)
            & (green < 145)
            & (blue < 122)
            & (red > green + 10)
            & (red > blue + 24)
        )

    seed = (petal | ink).astype(np.uint8) * 255
    return Image.fromarray(seed)


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
    # Keep the mask driven by petal color and petal ink only. Broad dark-line
    # capture pulls in nearby stems/leaves and makes the slot skeleton dirty.
    combined = seed.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(3))
    combined = keep_largest_component(combined)
    return combined.filter(ImageFilter.GaussianBlur(0.8))


def expand_box(box: tuple[int, int, int, int], size: tuple[int, int], padding: int) -> tuple[int, int, int, int]:
    left, top, right, bottom = box
    width, height = size
    return (
        max(0, left - padding),
        max(0, top - padding),
        min(width, right + padding),
        min(height, bottom + padding),
    )


def alpha_bbox(mask: Image.Image, padding: int = 3) -> tuple[int, int, int, int]:
    bbox = mask.point(lambda value: 255 if value > 16 else 0).getbbox()
    if bbox is None:
        return (0, 0, mask.width, mask.height)
    return expand_box(bbox, mask.size, padding)


def apply_mask_to_crop(crop: Image.Image, mask: Image.Image) -> Image.Image:
    rgba = crop.convert("RGBA")
    rgba.putalpha(mask)
    return rgba


def make_line_seed(crop: Image.Image, mask: Image.Image, kind: str) -> Image.Image:
    rgb = np.asarray(crop.convert("RGB"))
    red = rgb[:, :, 0].astype(np.int16)
    green = rgb[:, :, 1].astype(np.int16)
    blue = rgb[:, :, 2].astype(np.int16)
    inside = np.asarray(mask) > 20

    if kind == "pink":
        petal_lines = (
            (red > 105)
            & (red < 215)
            & (green < 160)
            & (blue < 190)
            & (red > green + 12)
            & (blue > green - 14)
        )
    else:
        petal_lines = (
            (red > 105)
            & (red < 210)
            & (green > 35)
            & (green < 150)
            & (blue < 135)
            & (red > green + 8)
            & (red > blue + 18)
        )

    line_seed = (inside & petal_lines).astype(np.uint8) * 255
    return Image.fromarray(line_seed)


def make_slot_skeleton(crop: Image.Image, mask: Image.Image, kind: str) -> Image.Image:
    alpha = np.asarray(mask).astype(np.uint8)
    output = np.zeros((mask.height, mask.width, 4), dtype=np.uint8)

    # Slot art should read as a light flower-shaped guide, not as a pasted
    # white block. Keep the fill subtle and let the outline carry recognition.
    fill_alpha = np.where(
        alpha > 8,
        np.clip((alpha.astype(np.float32) * 0.08).astype(np.uint8), 8, 24),
        0,
    )
    output[:, :, 0] = 255
    output[:, :, 1] = 255
    output[:, :, 2] = 255
    output[:, :, 3] = fill_alpha

    dilated = np.asarray(mask.filter(ImageFilter.MaxFilter(3))).astype(np.int16)
    eroded = np.asarray(mask.filter(ImageFilter.MinFilter(3))).astype(np.int16)
    outer_line = (dilated - eroded) > 18

    inner_line = np.asarray(make_line_seed(crop, mask, kind)) > 0
    inner_line &= alpha > 18

    line_color = np.array([34, 31, 28, 150], dtype=np.uint8)
    inner_color = np.array([56, 45, 40, 84], dtype=np.uint8)
    output[inner_line] = inner_color
    output[outer_line] = line_color
    return Image.fromarray(output).filter(ImageFilter.GaussianBlur(0.2))


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


def make_skeleton_contact_sheet(paths: list[Path]) -> None:
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
        backdrop = Image.new("RGB", (190, 145), (236, 225, 208))
        sheet.paste(backdrop, (x + 15, 12))
        sheet.paste(preview, (x + 15 + (190 - preview.width) // 2, 12 + (145 - preview.height) // 2), preview)
        draw.text((x + 14, 162), path.stem[:28], fill=(70, 72, 62), font=font)
    sheet.save(VERIFY_DIR / "花头骨架资产-contact.png")


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
    skeleton_paths: list[Path] = []
    skeleton_layers: list[tuple[Image.Image, tuple[int, int]]] = []
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
        flower_full = apply_mask_to_crop(crop, mask)
        erase_from_template(template, flower_full, rect)

        bbox = alpha_bbox(mask)
        bbox_left, bbox_top, bbox_right, bbox_bottom = bbox
        source_rect = (
            left + bbox_left,
            top + bbox_top,
            left + bbox_right,
            top + bbox_bottom,
        )
        flower = flower_full.crop(bbox)
        skeleton = make_slot_skeleton(crop, mask, marked.kind).crop(bbox)

        output = OUTPUT_DIR / f"{marked.id}.png"
        flower.save(output)
        flower_paths.append(output)

        skeleton_output = OUTPUT_DIR / f"{marked.id}-skeleton.png"
        skeleton.save(skeleton_output)
        skeleton_paths.append(skeleton_output)

        # Reconstruct from the generated layers for visual QA.
        restore.alpha_composite(flower, (source_rect[0], source_rect[1]))
        skeleton_layers.append((skeleton, (source_rect[0], source_rect[1])))

        center_x = (source_rect[0] + source_rect[2]) / 2
        center_y = (source_rect[1] + source_rect[3]) / 2
        metadata_lines.extend(
            [
                "  {",
                f"    id: \"{marked.id}\",",
                f"    label: \"{marked.label}\",",
                f"    artId: \"{marked.id}\",",
                f"    slotArtId: \"{marked.id}-skeleton\",",
                f"    sourceX: {center_x:.2f},",
                f"    sourceY: {center_y:.2f},",
                f"    sourceWidth: {source_rect[2] - source_rect[0]},",
                f"    sourceHeight: {source_rect[3] - source_rect[1]},",
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
            "  ...BOUQUET_CUTOUT_V01_FLOWERS.map((flower) => flower.slotArtId),",
            "] as const;",
            "",
            "export type BouquetCutoutV01ArtId = (typeof BOUQUET_CUTOUT_V01_ART_IDS)[number];",
            "",
        ],
    )

    template.save(OUTPUT_DIR / "template-base.png")
    skeleton_preview = template.copy()
    for skeleton, position in skeleton_layers:
        skeleton_preview.alpha_composite(skeleton, position)
    source_crop.save(VERIFY_DIR / "原图裁切目标.png")
    template.save(VERIFY_DIR / "扣除4朵花后的模板.png")
    restore.save(VERIFY_DIR / "模板加4朵花还原预览.png")
    skeleton_preview.save(VERIFY_DIR / "骨架占位预览.png")
    make_contact_sheet(flower_paths)
    make_skeleton_contact_sheet(skeleton_paths)
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
