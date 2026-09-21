"""Knock solid canvas out of Transio light/dark lockups → transparent PNGs."""
from __future__ import annotations

import os
from collections import deque

from PIL import Image

BASE = os.path.join(os.path.dirname(__file__), "..", "assets", "images")


def knock(src: str, dst: str, *, protect_light: bool) -> None:
    im = Image.open(src).convert("RGBA")
    px = im.load()
    assert px is not None
    w, h = im.size
    samples = [
        px[2, 2][:3],
        px[w - 3, 2][:3],
        px[2, h - 3][:3],
        px[w - 3, h - 3][:3],
        px[w // 2, 2][:3],
        px[2, h // 2][:3],
        px[w - 3, h // 2][:3],
        px[w // 2, h - 3][:3],
    ]
    br = sum(s[0] for s in samples) / len(samples)
    bgc = sum(s[1] for s in samples) / len(samples)
    bb = sum(s[2] for s in samples) / len(samples)
    print(os.path.basename(src), "bg~", round(br), round(bgc), round(bb))

    def is_bg(r: int, g: int, b: int) -> bool:
        dist = ((r - br) ** 2 + (g - bgc) ** 2 + (b - bb) ** 2) ** 0.5
        lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        # Tiny red artifact near the mark
        if r > 180 and g < 80 and b < 80 and dist < 140:
            return True
        if protect_light:
            if dist < 42:
                return True
            if lum > 200 and dist < 70:
                return True
            return False
        if dist < 48:
            return True
        if lum < 70 and dist < 80:
            return True
        return False

    mask = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        r, g, b, _a = px[x, y]
        if is_bg(r, g, b) and not mask[y][x]:
            mask[y][x] = True
            q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not mask[ny][nx]:
                r, g, b, _a = px[nx, ny]
                if is_bg(r, g, b):
                    mask[ny][nx] = True
                    q.append((nx, ny))

    out = Image.new("RGBA", (w, h))
    op = out.load()
    assert op is not None
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if mask[y][x]:
                op[x, y] = (r, g, b, 0)
                continue
            near = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h and mask[ny][nx]:
                    near = True
                    break
            if near:
                op[x, y] = (r, g, b, max(0, min(255, int(a * 0.85))))
            else:
                op[x, y] = (r, g, b, a)

    bbox = out.getbbox()
    if bbox:
        pad = 10
        out = out.crop(
            (
                max(0, bbox[0] - pad),
                max(0, bbox[1] - pad),
                min(w, bbox[2] + pad),
                min(h, bbox[3] + pad),
            )
        )
    out.save(dst, "PNG")
    print("wrote", dst, out.size)


def main() -> None:
    dark = os.path.join(BASE, "transio_logo_dark.png")
    light = os.path.join(BASE, "transio_logo_light.png")
    knock(dark, dark, protect_light=False)
    knock(light, light, protect_light=True)


if __name__ == "__main__":
    main()
