"""
One-tile `field` effects for Bone Isle — earth and ice.

The `field` slot is the only one that loops: the tile keeps hurting after the
cast, so the artwork has to run forever without a seam.  Twelve frames, same as
the fire field already in `public/`.

Drawn at 32 x 32 with hard pixels and no anti-aliasing, on the palettes already
sampled out of the existing sheets, so these sit in the same family as the
CraftPix art rather than beside it:

    earth   #170c04  #3a2311  #5c3c20  #8a6037  #bd8d55   (+ a warm ember)
    ice     #4d7593  #8fb4cf  #b5d5e8  #ddeef9  #ffffff

Nothing is filled edge to edge.  A field is drawn OVER the terrain, so the
ground has to keep showing through — the earth crack is a fissure with lit
lips, not a slab, and the puddle is a dithered wash inside a broken rim.
"""

import math
import os

from PIL import Image, ImageDraw

W = H = 32
FRAMES = 12

EARTH = {
    "void": (23, 12, 4, 255),
    "dark": (58, 35, 17, 255),
    "mid": (92, 60, 32, 255),
    "lit": (138, 96, 55, 255),
    "pale": (189, 141, 85, 255),
    "ember": (232, 176, 86, 255),
    "hot": (249, 226, 160, 255),
}

ICE = {
    "deep": (77, 117, 147, 255),
    "mid": (143, 180, 207, 255),
    "pale": (181, 213, 232, 255),
    "wash": (221, 238, 249, 255),
    "white": (255, 255, 255, 255),
    # the body of the slick. Transparent on purpose: the terrain under a puddle
    # has to show through it, and at 32 px alpha does that far better than a
    # dither, which reads as a mesh.
    "body": (181, 213, 232, 168),
    "body_deep": (143, 180, 207, 186),
}


def frame():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def put(d, x, y, c):
    if 0 <= x < W and 0 <= y < H:
        d.point((int(x), int(y)), fill=c)


def vrun(d, x, y, h, c):
    """Vertical run of pixels, centred on y — the fissure's thickness."""
    for k in range(h):
        put(d, x, y - (h - 1) // 2 + k, c)


def sheet(frames):
    im = Image.new("RGBA", (W * len(frames), H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        im.paste(f, (i * W, 0), f)
    return im


# ---------------------------------------------------------------------------
# earth — a fissure that keeps breathing
# ---------------------------------------------------------------------------

def crack_path(pts, wmax):
    """Sample a polyline into (x, y, width) columns, thick in the middle."""
    out = []
    total = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
    walked = 0.0
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        seg = max(1e-6, math.dist((x0, y0), (x1, y1)))
        steps = max(1, int(seg * 2))
        for s in range(steps + 1):
            u = s / steps
            t = (walked + seg * u) / total
            # widest at the middle of the run, one pixel at both tips
            w = 1 + round((wmax - 1) * math.sin(math.pi * min(1.0, t * 1.15)) ** 0.7)
            out.append((x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, int(w)))
        walked += seg
    return out


EARTH_CRACKS = [
    # one long split with two branches, not a starfish: the fissure has to read
    # as a line in the ground at 32 px, and every extra arm eats the ground it
    # is supposed to be splitting
    ([(4, 26), (11, 25), (17, 27), (23, 24), (28, 25)], 3),
    ([(17, 27), (16, 23), (14, 19)], 2),
    ([(23, 24), (25, 27), (26, 30)], 2),
]


def build_earth(i):
    t = i / FRAMES
    im, d = frame()

    cols = [(c, crack_path(p, w)) for c, (p, w) in enumerate(EARTH_CRACKS)]

    # the lit lip above the void and the shadow under it. Only one pixel each,
    # or the crack doubles in thickness and stops being a crack.
    for _, path in cols:
        for (x, y, w) in path:
            top = y - (w - 1) // 2
            if (int(x) * 5 + int(y) * 3) % 4 < 2:
                put(d, x, top - 1, EARTH["lit"] if (int(x) + int(y)) % 4 == 0 else EARTH["mid"])
            if w >= 2:
                put(d, x, top + w, EARTH["dark"])

    for _, path in cols:
        for (x, y, w) in path:
            vrun(d, x, y, w, EARTH["void"])

    # the breath. Two slow pulses per loop, and never fully out: a field that
    # goes dark for four frames reads as finished rather than as burning.
    glow = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(2 * math.pi * t * 2))
    for ci, path in cols:
        for (x, y, w) in path:
            if w < 2:
                continue
            phase = (math.sin(x * 0.8 + ci * 2.1) + 1) / 2
            lit = glow * (0.5 + 0.5 * phase)
            if lit > 0.45 and (int(x) * 7 + ci) % 3 == 0:
                put(d, x, y, EARTH["hot"] if lit > 0.8 else EARTH["ember"])

    # rubble thrown up along the rim, hopping on a six-frame cycle
    for k, (rx, ry, ph) in enumerate([(7, 29, 0), (26, 21, 2), (12, 17, 4)]):
        hop = [0, -1, -1, 0, 0, 0][(i + ph) % 6]
        put(d, rx, ry + hop, EARTH["mid"])
        put(d, rx + 1, ry + hop, EARTH["lit"])
        put(d, rx, ry + hop + 1, EARTH["dark"])

    # dust drifting off the split, one whole rise per loop
    for k, (dx, y0) in enumerate([(9, 24), (18, 21), (24, 23)]):
        y = 13 + ((y0 - 13) - 11 * t) % 11
        if (i + k) % 4 == 3:
            continue
        put(d, dx + (1 if math.sin(y + k) > 0 else 0), y, EARTH["mid"] if k % 2 else EARTH["lit"])
    return im


# ---------------------------------------------------------------------------
# ice — a slick that keeps breaking
# ---------------------------------------------------------------------------

PUDDLE_RX, PUDDLE_RY, PUDDLE_CY = 12.0, 4.6, 26.0


def in_puddle(x, y, k=1.0):
    dx = (x - 16) / PUDDLE_RX
    dy = (y - PUDDLE_CY) / PUDDLE_RY
    return dx * dx + dy * dy < k


def build_ice(i):
    im, d = frame()

    # rim: mostly continuous, broken here and there so it does not read as a
    # drawn oval sitting on the grass
    for a in range(0, 360, 5):
        r = math.radians(a)
        x = 16 + math.cos(r) * PUDDLE_RX
        y = PUDDLE_CY + math.sin(r) * PUDDLE_RY
        put(d, x, y, ICE["deep"] if math.sin(r) > -0.2 else ICE["mid"])

    for y in range(20, 32):
        for x in range(3, 30):
            if in_puddle(x, y, 0.97):
                put(d, x, y, ICE["body_deep"] if y > PUDDLE_CY + 1 else ICE["body"])

    # ripples rather than a dither fill: four short horizontal dashes drifting
    # sideways. A checkerboard wash reads as a mesh at this size; dashes read
    # as water.
    for k, (ry, w, sp) in enumerate([(24, 6, 1), (28, 5, -1)]):
        cx = 16 + sp * (abs(((i + k * 4) % 12) - 6) - 3)
        for x in range(int(cx - w / 2), int(cx + w / 2)):
            if in_puddle(x, ry, 0.86):
                put(d, x, ry, ICE["white"])

    # two crowns, half a loop apart, so the surface is always breaking
    for cx, cy, start in ((12, 25, 0), (21, 27, 6)):
        age = (i - start) % FRAMES
        if age > 5:
            continue
        h = [2, 5, 8, 6, 3, 0][age]
        for k in range(h):
            y = cy - k
            put(d, cx, y, ICE["white"])
            if k <= h - 3:
                put(d, cx - 1, y, ICE["wash"])
                put(d, cx + 1, y, ICE["pale"] if k else ICE["wash"])
        # the wings the reference throws out to either side
        if 1 <= age <= 3:
            for s in (-1, 1):
                for j, (ox, oy) in enumerate([(2, -1), (3, -3), (4, -4), (5, -3)]):
                    if j > age:
                        continue
                    put(d, cx + s * ox, cy + oy, ICE["pale"] if j % 2 else ICE["white"])
        # droplets falling back, and the ring left behind
        if age >= 3:
            for s in (-1, 1):
                put(d, cx + s * (4 + age), cy - 4 + age, ICE["mid"])
        if age >= 4:
            rr = 3 + (age - 4) * 3
            for a in range(0, 360, 30):
                r = math.radians(a)
                put(d, cx + math.cos(r) * rr, cy + math.sin(r) * rr * 0.42, ICE["mid"])

    # spray lifting off the slick
    for k, (fx, ph) in enumerate([(8, 0), (25, 5)]):
        age = (i + ph) % FRAMES
        if age > 5:
            continue
        put(d, fx + (age // 3), 24 - age // 2, ICE["wash"] if age % 2 else ICE["white"])
    return im


BUILDERS = {"earth": build_earth, "ice": build_ice}

if __name__ == "__main__":
    root = "public"
    os.makedirs(root, exist_ok=True)
    for name, fn in BUILDERS.items():
        sheet([fn(i) for i in range(FRAMES)]).save(f"{root}/fx-{name}-1-field.png")
        print("done", name)
