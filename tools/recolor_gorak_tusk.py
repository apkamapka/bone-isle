#!/usr/bin/env python3
"""Recolour Gorak's tusk from the CraftPix source to bone, and write
`public/item-gorak-tusk.png`.

    python3 tools/recolor_gorak_tusk.py <source-32x32.png>

THE SOURCE PATH IS REQUIRED, deliberately. Every other script in this folder
either takes an argument or writes a file nothing hand-drawn lives at; this one
writes over an icon derived from bought artwork, and the smoke suite's rule
since Etap 53 is that no generator may quietly destroy such a file the first
time somebody runs the directory. Making the argument mandatory is what keeps
that true: with no source there is nothing to recolour and the script refuses
rather than baking a stand-in over the real thing. It cannot invent pixels —
it only remaps the ones it is given.

WHAT IT DOES. The purchased icon is a warm brown horn: every opaque pixel sits
on one hue and the drawing is carried entirely by its luminance ramp, from
near-black in the root's shadow to a light rust on the lit edge. So the
recolour is a ramp swap and nothing else — measure each pixel's luminance,
normalise it across the icon's own range, and look the result up in a bone
ramp. Shading, edges, dither and alpha come through untouched; only the hue
moves. Repainting it by hand would have been a different drawing.

WHY BONE AND NOT WHITE. A pure white tusk at 12 screen pixels reads as a
highlight rather than as an object, and it would sit in the bag next to the
Howe-Helm and the effigy looking like a hole in the icon row. The ramp lands
on warm ivory: bright enough that Chronos' \"bring me a piece of him\" is
legible in the bag, dark enough at the root to keep the curve readable.
"""
import sys
from PIL import Image

if len(sys.argv) < 2:
    sys.exit("usage: recolor_gorak_tusk.py <source-32x32.png>  (source is required)")

# Bone, dark root to lit edge. Five stops is enough for a 32x32 with this
# little tonal range in it; more would quantise into bands the source has no
# detail to fill.
RAMP = [(0.00, (54, 48, 40)),
        (0.28, (112, 102, 86)),
        (0.55, (170, 159, 135)),
        (0.80, (216, 207, 186)),
        (1.00, (246, 242, 229))]


def lookup(t):
    for i in range(len(RAMP) - 1):
        a, ca = RAMP[i]
        b, cb = RAMP[i + 1]
        if t <= b:
            k = 0.0 if b == a else (t - a) / (b - a)
            return tuple(round(ca[j] + (cb[j] - ca[j]) * k) for j in range(3))
    return RAMP[-1][1]


im = Image.open(sys.argv[1]).convert("RGBA")
px = im.load()
lum = lambda r, g, b: 0.299 * r + 0.587 * g + 0.114 * b

vals = [lum(*px[x, y][:3]) for y in range(im.height) for x in range(im.width)
        if px[x, y][3] > 0]
if not vals:
    sys.exit("source is fully transparent")
lo, hi = min(vals), max(vals)
span = (hi - lo) or 1.0

for y in range(im.height):
    for x in range(im.width):
        r, g, b, a = px[x, y]
        if a == 0:
            px[x, y] = (0, 0, 0, 0)
            continue
        px[x, y] = lookup((lum(r, g, b) - lo) / span) + (a,)

im.save("public/item-gorak-tusk.png")
print(f"{im.width}x{im.height}, {len(vals)} opaque px, luminance {lo:.0f}..{hi:.0f} -> bone")
