#!/usr/bin/env python3
"""
NearShop Icon Generator
=======================
Generates all app icon sizes for mobile (Expo/Android) and web.

Design: Bold white map-pin on an indigo → violet gradient.
        "Near" = location pin  |  "Shop" = commerce

Run from repo root:
    python brand/generate_icons.py
"""

import math
import os
from PIL import Image, ImageDraw

# ── Palette ────────────────────────────────────────────────────────────────────
INDIGO  = (67,  56,  202, 255)   # #4338CA  — top of gradient
VIOLET  = (124, 58,  237, 255)   # #7C3AED  — bottom of gradient
WHITE   = (255, 255, 255, 255)
BLACK   = (0,   0,   0,   255)
TRANSP  = (0,   0,   0,   0)


# ── Helpers ────────────────────────────────────────────────────────────────────

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4))


def gradient_bg(size):
    """Top-to-bottom INDIGO → VIOLET gradient, RGBA."""
    img = Image.new('RGBA', (size, size), TRANSP)
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(size - 1, 1)
        draw.line([(0, y), (size - 1, y)], fill=lerp_color(INDIGO, VIOLET, t))
    return img


def rounded_mask(size, radius):
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [(0, 0), (size - 1, size - 1)], radius=radius, fill=255
    )
    return mask


def draw_pin(draw, size, pin_color=WHITE):
    """
    Draw a map-pin (teardrop) shape.
    Tail polygon is drawn first, head circle drawn last — this ensures
    the circle edge is always smooth with no visible joints.
    """
    S   = size / 1024.0
    cx  = 512 * S          # horizontal centre
    cy  = 385 * S          # head circle centre y
    R   = 200 * S          # head radius
    tip = 790 * S          # tail tip y

    # Tail: wide triangle whose top overlaps well inside the circle
    # Start points are inside the circle so the circle covers the join cleanly
    tw = R * 0.75
    ty = cy + R * 0.55     # tail start y (inside circle bottom area)

    draw.polygon([(cx - tw, ty), (cx, tip), (cx + tw, ty)], fill=pin_color)  # tail first
    draw.ellipse([(cx - R, cy - R), (cx + R, cy + R)], fill=pin_color)        # head on top


def inner_dot_color(size):
    """Gradient colour sampled at the pin-head centre (for the hollow dot)."""
    cy = 385 * size / 1024.0
    t  = cy / max(size - 1, 1)
    return lerp_color(INDIGO, VIOLET, t)


def draw_inner_dot(draw, size, fill):
    S  = size / 1024.0
    cx = int(512 * S)
    cy = int(385 * S)
    ir = int(92  * S)
    draw.ellipse([(cx - ir, cy - ir), (cx + ir, cy + ir)], fill=fill)


# ── Icon generators ────────────────────────────────────────────────────────────

def create_icon(size=1024, rounded=True):
    """Full-colour icon, optionally with rounded-square corners."""
    WORK = size * 2                       # render at 2× then downscale
    bg   = gradient_bg(WORK)
    draw = ImageDraw.Draw(bg)

    draw_pin(draw, WORK)
    draw_inner_dot(draw, WORK, inner_dot_color(WORK))

    if rounded:
        bg.putalpha(rounded_mask(WORK, int(WORK * 0.22)))

    return bg.resize((size, size), Image.LANCZOS)


def create_mono(size=1024):
    """White pin on transparent — Android monochrome adaptive icon."""
    img  = Image.new('RGBA', (size, size), TRANSP)
    draw = ImageDraw.Draw(img)
    draw_pin(draw, size, pin_color=WHITE)
    draw_inner_dot(draw, size, BLACK)
    return img


def create_splash(canvas=1024, icon_size=360):
    """Centred icon on white canvas for Expo splash screen."""
    out    = Image.new('RGBA', (canvas, canvas), (255, 255, 255, 255))
    badge  = create_icon(icon_size, rounded=True)
    offset = (canvas - icon_size) // 2
    out.paste(badge, (offset, offset), badge)
    return out


# ── Main ───────────────────────────────────────────────────────────────────────

def save(img, path, label):
    img.save(path)
    size = os.path.getsize(path)
    print(f"  OK  {label:<55} {size // 1024:>4} KB")


def main():
    here       = os.path.dirname(os.path.abspath(__file__))
    root       = os.path.abspath(os.path.join(here, '..'))
    mobile_dir = os.path.join(root, 'nearshop-mobile', 'assets')
    web_dir    = os.path.join(root, 'nearshop-web',   'public')

    print()
    print("NearShop Icon Generator")
    print("-" * 70)
    print(f"  Brand folder : {here}")
    print(f"  Mobile assets: {mobile_dir}")
    print(f"  Web public   : {web_dir}")
    print()

    icon_1024 = create_icon(1024)

    # ── Brand folder (master copies) ──────────────────────────────────────────
    save(icon_1024,            os.path.join(here, 'nearshop-icon-1024.png'),  'brand/nearshop-icon-1024.png')
    save(create_icon(512),     os.path.join(here, 'nearshop-icon-512.png'),   'brand/nearshop-icon-512.png')

    # ── Mobile: Expo / React Native ───────────────────────────────────────────
    save(icon_1024,            os.path.join(mobile_dir, 'icon.png'),                          'nearshop-mobile/assets/icon.png')
    save(create_splash(),      os.path.join(mobile_dir, 'splash-icon.png'),                   'nearshop-mobile/assets/splash-icon.png')
    save(create_icon(1024, rounded=False),
                               os.path.join(mobile_dir, 'android-icon-foreground.png'),       'nearshop-mobile/assets/android-icon-foreground.png')
    save(Image.new('RGBA', (1024, 1024), VIOLET),
                               os.path.join(mobile_dir, 'android-icon-background.png'),       'nearshop-mobile/assets/android-icon-background.png')
    save(create_mono(1024),    os.path.join(mobile_dir, 'android-icon-monochrome.png'),       'nearshop-mobile/assets/android-icon-monochrome.png')
    save(create_icon(48),      os.path.join(mobile_dir, 'favicon.png'),                       'nearshop-mobile/assets/favicon.png')

    # ── Web ───────────────────────────────────────────────────────────────────
    save(create_icon(192),     os.path.join(web_dir, 'icon-192.png'),   'nearshop-web/public/icon-192.png')
    save(create_icon(512),     os.path.join(web_dir, 'icon-512.png'),   'nearshop-web/public/icon-512.png')

    print()
    print("  All icons generated successfully!")
    print()


if __name__ == '__main__':
    main()
