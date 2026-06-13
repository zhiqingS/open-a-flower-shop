#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets/resources/art/bouquet-v03"
OUTPUT = ROOT / "视觉验证/第三轮-首束花视觉垂直切片-v0.2/首束花拼装预览-v0.2.png"


LAYERS: tuple[dict[str, object], ...] = (
    {"asset": "wrapper-back", "x": 0, "y": -42, "width": 150, "height": 146},
    {"asset": "leaf-slim-b", "x": -34, "y": 18, "width": 54, "height": 76, "angle": -12},
    {"asset": "leaf-round-a", "x": 36, "y": 12, "width": 58, "height": 74, "angle": 12},
    {"asset": "foliage-a", "x": -11, "y": 22, "width": 34, "height": 62, "angle": -6},
    {"asset": "foliage-b", "x": 20, "y": 22, "width": 36, "height": 66, "angle": 7},
    {"asset": "delphinium-a", "x": -38, "y": 55, "width": 49, "height": 94, "angle": -8},
    {"asset": "delphinium-b", "x": 39, "y": 53, "width": 46, "height": 88, "angle": 8},
    {"asset": "ranunculus-peach-a", "x": -35, "y": 7, "width": 59, "height": 78, "angle": -5},
    {"asset": "ranunculus-yellow-b", "x": 36, "y": 7, "width": 54, "height": 71, "angle": 5},
    {"asset": "dahlia-a", "x": -13, "y": 29, "width": 72, "height": 92, "angle": -3},
    {"asset": "dahlia-b", "x": 22, "y": 27, "width": 69, "height": 87, "angle": 4},
    {"asset": "daisy-a", "x": -22, "y": -2, "width": 41, "height": 68, "angle": -5},
    {"asset": "daisy-b", "x": 24, "y": -3, "width": 38, "height": 64, "angle": 5},
    {"asset": "wrapper-front", "x": 0, "y": -66, "width": 140, "height": 118},
    {"asset": "ribbon-pink", "x": 0, "y": -104, "width": 74, "height": 84},
)


def trim_alpha(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        return image
    return image.crop(bounds)


def fit_asset(path: Path, width: int, height: int, angle: float = 0) -> Image.Image:
    image = trim_alpha(Image.open(path).convert("RGBA"))
    image.thumbnail((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((width - image.width) // 2, height - image.height))
    if angle:
        canvas = canvas.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    return canvas


def paste_center(base: Image.Image, image: Image.Image, x: int, y: int) -> None:
    base.alpha_composite(image, (x - image.width // 2, y - image.height // 2))


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas = Image.new("RGBA", (430, 760), (246, 242, 232, 255))
    draw = ImageDraw.Draw(canvas)
    card = (45, 145, 385, 550)
    draw.rounded_rectangle(card, radius=18, fill=(255, 253, 247, 255), outline=(231, 219, 201, 255), width=2)

    center_x = 215
    center_y = 300
    scale = 1.4
    for layer in LAYERS:
        asset = str(layer["asset"])
        path = ASSET_DIR / f"{asset}.png"
        width = int(float(layer["width"]) * scale)
        height = int(float(layer["height"]) * scale)
        image = fit_asset(path, width, height, float(layer.get("angle", 0)))
        x = center_x + int(float(layer["x"]) * scale)
        y = center_y - int(float(layer["y"]) * scale)
        paste_center(canvas, image, x, y)

    canvas.convert("RGB").save(OUTPUT)
    print(f"Rendered preview: {OUTPUT}")


if __name__ == "__main__":
    main()
