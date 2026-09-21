"""Knock slate background out of Transio JPG logos → transparent PNGs.

Uses edge flood-fill so brushed/textured slate is removed while mint clay stays.
"""
from __future__ import annotations

import os
from collections import deque
from PIL import Image

BASE = os.path.join(
    os.path.dirname(__file__),
    "..",
    "assets",
    "images",
)


def is_bg(r: int, g: int, b: int, br: float, bg: float, bb: float) -> bool:
    """True if pixel matches deep slate canvas (not mint clay)."""
    dist = ((r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2) ** 0.5
    # Mint is bright + green-dominant; slate is dark and cooler.
    luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    green_lead = g - max(r, b)
    if luminance > 110 and green_lead > 18:
        return False
    if dist < 55:
        return True
    if luminance < 95 and green_lead < 25:
        return True
    return False


def knock_out(src_path: str, dst_path: str) -> None:
    im = Image.open(src_path).convert("RGBA")
    pixels = im.load()
    assert pixels is not None
    w, h = im.size

    samples = [
        pixels[2, 2][:3],
        pixels[w - 3, 2][:3],
        pixels[2, h - 3][:3],
        pixels[w - 3, h - 3][:3],
        pixels[w // 2, 2][:3],
        pixels[2, h // 2][:3],
        pixels[w - 3, h // 2][:3],
        pixels[w // 2, h - 3][:3],
    ]
    br = sum(s[0] for s in samples) / len(samples)
    bgc = sum(s[1] for s in samples) / len(samples)
    bb = sum(s[2] for s in samples) / len(samples)
    print(os.path.basename(src_path), "bg~", round(br), round(bgc), round(bb), w, h)

    bg_mask = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        r, g, b, _a = pixels[x, y]
        if is_bg(r, g, b, br, bgc, bb) and not bg_mask[y][x]:
            bg_mask[y][x] = True
            q.append((x, y))

    for x in range(w):
        try_seed(x, 0)
        try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y)
        try_seed(w - 1, y)

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg_mask[ny][nx]:
                r, g, b, _a = pixels[nx, ny]
                if is_bg(r, g, b, br, bgc, bb):
                    bg_mask[ny][nx] = True
                    q.append((nx, ny))

    out = Image.new("RGBA", (w, h))
    opx = out.load()
    assert opx is not None

    # Soften mask edges: any bg-adjacent foreground gets partial alpha.
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if bg_mask[y][x]:
                opx[x, y] = (r, g, b, 0)
                continue
            # Feather pixels next to knocked-out bg.
            near_bg = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h and bg_mask[ny][nx]:
                    near_bg = True
                    break
            if near_bg and is_bg(r, g, b, br, bgc, bb) is False:
                # Keep mint; only soften very dark edge crumbs.
                lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
                if lum < 120:
                    opx[x, y] = (r, g, b, int(a * 0.45))
                else:
                    opx[x, y] = (r, g, b, a)
            else:
                opx[x, y] = (r, g, b, a)

    bbox = out.getbbox()
    if bbox:
        pad = max(8, min(w, h) // 40)
        left = max(0, bbox[0] - pad)
        top = max(0, bbox[1] - pad)
        right = min(w, bbox[2] + pad)
        bottom = min(h, bbox[3] + pad)
        out = out.crop((left, top, right, bottom))

    out.save(dst_path, "PNG")
    print("wrote", dst_path, out.size)


def main() -> None:
    for name in ("transio_logo", "transio_logo_app"):
        knock_out(
            os.path.join(BASE, f"{name}.jpg"),
            os.path.join(BASE, f"{name}.png"),
        )


if __name__ == "__main__":
    main()
