"""Turn raw phone screenshots into Google Play phone screenshots.

Play wants 16:9 or 9:16 images, and modern phones take taller ones (about 9:20), which Play
rejects. This puts each raw screenshot on a 1080 x 1920 canvas with a headline, so every image
is 9:16 and at least 1080 px on both sides, which also meets the promotion guideline.

Usage (from the repo root):
    python store-assets/make_screenshots.py [raw_folder] [output_folder]

Defaults: store-assets/screenshots-raw  ->  store-assets/screenshots
Name the raw files so they sort in the order you want, for example 01-home.png. A headline is
taken from HEADLINES by file name without its number, or made from the file name.
"""

import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONT = os.path.join(
    ROOT, "node_modules", "@expo-google-fonts", "plus-jakarta-sans", "700Bold", "PlusJakartaSans_700Bold.ttf"
)

# Keep these true to the app. Key is the file name without the leading number and extension.
HEADLINES = {
    "home": "Capture every conversation",
    "record": "Record or import audio",
    "live-notes": "Live Note Taker",
    "transcript": "Searchable transcripts",
    "summary": "AI Summary on demand",
    "voice-translate": "Voice translate",
    "library": "Keep it organized",
    "onboarding-record": "Record every conversation",
    "onboarding-notes": "Summaries and replay",
    "onboarding-voice-translate": "Speak and hear the translation",
    "home-recent": "Your recordings, organized",
    "capture-menu": "Choose how to capture speech",
    "paywall": "Simple Pro plans",
}

W, H = 1080, 1920
TOP, BOTTOM_MARGIN, SIDE = 300, 70, 110
TOP_COLOR, BOTTOM_COLOR = (10, 17, 26), (24, 32, 62)
ACCENT = (91, 108, 255)


def headline_for(filename: str) -> str:
    stem = os.path.splitext(filename)[0]
    key = re.sub(r"^\d+[-_ ]*", "", stem).lower()
    return HEADLINES.get(key, key.replace("-", " ").replace("_", " ").strip().capitalize())


def gradient() -> Image.Image:
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        row = tuple(int(TOP_COLOR[i] + (BOTTOM_COLOR[i] - TOP_COLOR[i]) * t) for i in range(3))
        for x in range(W):
            px[x, y] = row
    return img


def wrap(text: str, font: ImageFont.FreeTypeFont, max_w: int) -> list:
    lines, current = [], ""
    for word in text.split():
        trial = f"{current} {word}".strip()
        if font.getlength(trial) <= max_w or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.width, img.height], radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def compose(raw_path: str, out_path: str) -> None:
    shot = Image.open(raw_path).convert("RGB")
    canvas = gradient()
    draw = ImageDraw.Draw(canvas)

    title_font = ImageFont.truetype(FONT, 76)
    lines = wrap(headline_for(os.path.basename(raw_path)), title_font, W - 2 * 90)
    line_h = int(title_font.size * 1.15)
    y = (TOP - 30 - line_h * len(lines)) // 2 + 10
    for line in lines:
        draw.text(((W - title_font.getlength(line)) / 2, y), line, font=title_font, fill=(255, 255, 255))
        y += line_h

    max_w, max_h = W - 2 * SIDE, H - TOP - BOTTOM_MARGIN
    scale = min(max_w / shot.width, max_h / shot.height)
    size = (int(shot.width * scale), int(shot.height * scale))
    shot = rounded(shot.resize(size, Image.LANCZOS), 44)

    x, top = (W - size[0]) // 2, TOP
    frame = Image.new("RGBA", (size[0] + 12, size[1] + 12), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle(
        [0, 0, frame.width - 1, frame.height - 1], radius=50, outline=ACCENT + (255,), width=4
    )
    canvas.paste(frame, (x - 6, top - 6), frame)
    canvas.paste(shot, (x, top), shot)
    canvas.save(out_path, optimize=True)


def main() -> None:
    raw = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "screenshots-raw")
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "screenshots")
    if not os.path.isdir(raw):
        os.makedirs(raw, exist_ok=True)
        print(f"Created the folder {raw}")
        print("Copy your phone screenshots into it, then run this script again.")
        return
    os.makedirs(out, exist_ok=True)
    files = sorted(f for f in os.listdir(raw) if f.lower().endswith((".png", ".jpg", ".jpeg")))
    if not files:
        print(f"No .png or .jpg screenshots found in {raw}. Copy them there and run again.")
        return
    for name in files:
        target = os.path.join(out, os.path.splitext(name)[0] + ".png")
        compose(os.path.join(raw, name), target)
        print("made", os.path.basename(target), f"({os.path.getsize(target) // 1024} KB)")


if __name__ == "__main__":
    main()
