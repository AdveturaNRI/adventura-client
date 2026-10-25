#!/usr/bin/env python3
"""Срезает зелёную рамку с портретов рас Laaru (top/left/right)."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def is_green(r: int, g: int, b: int) -> bool:
    return g > 120 and g > r + 25 and g > b + 15 and (r + g + b) < 420


def side_widths(im: Image.Image) -> tuple[int, int, int, int]:
    """top, right, bottom, left — сколько пикселей рамки."""
    rgb = im.convert("RGB")
    w, h = rgb.size

    def row_ratio(y: int) -> float:
        pix = [rgb.getpixel((x, y)) for x in range(0, w, 2)]
        return sum(1 for p in pix if is_green(*p)) / len(pix)

    def col_ratio(x: int) -> float:
        pix = [rgb.getpixel((x, y)) for y in range(0, h, 2)]
        return sum(1 for p in pix if is_green(*p)) / len(pix)

    top = 0
    while top < 24 and row_ratio(top) > 0.45:
        top += 1
    bot = 0
    while bot < 24 and row_ratio(h - 1 - bot) > 0.45:
        bot += 1
    left = 0
    while left < 24 and col_ratio(left) > 0.45:
        left += 1
    right = 0
    while right < 24 and col_ratio(w - 1 - right) > 0.45:
        right += 1
    return top, right, bot, left


def crop_file(path: Path) -> bool:
    im = Image.open(path)
    top, right, bot, left = side_widths(im)
    if top + right + bot + left == 0:
        return False
    # +1 px запаса — antialias у рамки
    top = min(top + 1, 24)
    left = min(left + 1, 24)
    right = min(right + 1, 24)
    bot = min(bot + 1, 24)
    w, h = im.size
    box = (left, top, w - right, h - bot)
    if box[2] - box[0] < 64 or box[3] - box[1] < 64:
        return False
    cropped = im.crop(box)
    ext = path.suffix.lower()
    if ext == ".webp":
        cropped.save(path, "WEBP", quality=90, method=4)
    elif ext == ".png":
        cropped.save(path, "PNG", optimize=True)
    else:
        cropped.save(path)
    return True


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: crop-laaru-race-frames.py <dir>", file=sys.stderr)
        return 2
    root = Path(sys.argv[1])
    cropped = 0
    skipped = 0
    for path in sorted(root.iterdir()):
        if path.suffix.lower() not in {".webp", ".png", ".jpg", ".jpeg"}:
            continue
        if crop_file(path):
            cropped += 1
        else:
            skipped += 1
    print(f"cropped {cropped}, untouched {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
