#!/usr/bin/env python3
"""Repaint two bought ring icons for Grizelda's shelf (Etap 92), and write
`public/item-stalker-ring.png` and `public/item-huntress-signet.png`.

    python3 tools/recolor_shelf_rings.py <icons_8_10.png> <icons_8_17.png>

BOTH SOURCE PATHS ARE REQUIRED, for the reason `recolor_gorak_tusk.py` gives:
this writes over icons derived from bought artwork, and with no source there is
nothing to repaint, so it refuses rather than baking a stand-in over the real
thing. It cannot invent pixels; it only remaps the ones it is given.

WHY THESE TWO ARE REPAINTED.
- icons_8_10 is the very picture the Health Ring already wears. The Stalker's
  Ring keeps every pixel of it and moves to green, so the two rings can be told
  apart in a bag at twelve screen pixels.
- icons_8_17 is a red band set with a green stone. Only the band moves, to
  gold: red put it a glance away from the same Health Ring, and gold is what a
  signet is. The stone, the outline and the dark pixels keep their colour.

HOW. The tusk's method: measure each chosen pixel's luminance, normalise it
across the chosen pixels' own range, and look the result up in a ramp. Shading,
edges, dither and alpha come through untouched; only the hue moves.
"""
import colorsys
import os
import sys

from PIL import Image

if len(sys.argv) < 3:
    sys.exit("usage: recolor_shelf_rings.py <icons_8_10.png> <icons_8_17.png>  (both are required)")

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")

# Dark root to lit edge, five stops each, as the tusk's bone ramp.
GREEN = [(0.00, (16, 30, 18)), (0.30, (38, 92, 44)), (0.60, (72, 150, 70)),
         (0.85, (140, 206, 112)), (1.00, (214, 240, 176))]
GOLD = [(0.00, (58, 36, 10)), (0.30, (132, 86, 22)), (0.60, (200, 146, 40)),
        (0.85, (238, 196, 82)), (1.00, (255, 236, 160))]


def lum(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


def lookup(ramp, t):
    for i in range(len(ramp) - 1):
        a, ca = ramp[i]
        b, cb = ramp[i + 1]
        if t <= b:
            k = 0.0 if b == a else (t - a) / (b - a)
            return tuple(round(ca[j] + (cb[j] - ca[j]) * k) for j in range(3))
    return ramp[-1][1]


def every(r, g, b):
    return True


def reddish(r, g, b):
    """The band: saturated, not dark, and red to orange. The green stone, the
    outline and the near-black pixels all fail one of the three."""
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return s > 0.35 and v > 0.25 and (h * 360 <= 48 or h * 360 >= 330)


def repaint(src, ramp, pick, dst):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    pts = [(x, y) for y in range(im.height) for x in range(im.width)
           if px[x, y][3] > 0 and pick(*px[x, y][:3])]
    if not pts:
        sys.exit(f"{src}: nothing to repaint - is this the right file?")
    vals = [lum(*px[x, y][:3]) for x, y in pts]
    lo, hi = min(vals), max(vals)
    for x, y in pts:
        r, g, b, a = px[x, y]
        t = (lum(r, g, b) - lo) / (hi - lo) if hi > lo else 0.5
        px[x, y] = lookup(ramp, t) + (a,)
    im.save(os.path.join(OUT, dst))
    print(f"{dst}: {len(pts)} pixels repainted")


repaint(sys.argv[1], GREEN, every, "item-stalker-ring.png")
repaint(sys.argv[2], GOLD, reddish, "item-huntress-signet.png")
