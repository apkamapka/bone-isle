"""
Element-choice circle effects for Bone Isle.

Draws a rotating rune ring on the ground plus a rising particle column, in the
same visual language as the supplied Mana_Recovery reference frames (soft
additive glow, saturated rim, near-white core).  One 12-frame loop per element.

Everything is drawn into a single grayscale "energy" field at 4x supersample,
downsampled, and then run through a per-element colour ramp.  Colourising after
the downsample keeps the edges clean and avoids alpha fringing.

Loop is seamless: every animated quantity advances by a whole period across the
12 frames (star rotation = one symmetry step, particle rise = a whole number of
column heights, twinkle = whole cycles).
"""

import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

FRAMES = 12
OUT = 128          # authored frame size, 2x2 tiles of 64
SS = 4             # supersample
S = OUT * SS

# --- ring geometry, in OUT pixels -------------------------------------------
CX, CY = 64.0, 92.0
RX, RY = 54.0, 25.0          # outer edge of the band
IRX, IRY = 41.0, 19.0        # inner edge of the band
SRX, SRY = 37.0, 17.0        # star polygon radius
COL_TOP = 3.0                # particles rise to here


def px(v):
    return v * SS


class Field:
    """Grayscale energy accumulator with max-compositing."""

    def __init__(self):
        self.img = Image.new("F", (S, S), 0.0)
        self.d = None

    def layer(self):
        im = Image.new("L", (S, S), 0)
        return im, ImageDraw.Draw(im)

    def add(self, im, weight=1.0, blur=0.0, soft=1.0):
        """Composite a shape layer as artwork + three widening haloes."""
        base = im.filter(ImageFilter.GaussianBlur(blur * SS)) if blur else im
        a = np.asarray(base, dtype=np.float32) / 255.0
        g1 = np.asarray(base.filter(ImageFilter.GaussianBlur(1.1 * soft * SS)), dtype=np.float32) / 255.0
        g2 = np.asarray(base.filter(ImageFilter.GaussianBlur(3.2 * soft * SS)), dtype=np.float32) / 255.0
        g3 = np.asarray(base.filter(ImageFilter.GaussianBlur(8.0 * soft * SS)), dtype=np.float32) / 255.0
        cur = np.asarray(self.img, dtype=np.float32)
        self.img = Image.fromarray(cur + weight * (a * 0.80 + g1 * 0.50 + g2 * 0.30 + g3 * 0.20), mode="F")

    def add_flat(self, im, weight=1.0, blur=0.0):
        """Composite without haloes - for the soft interior wash."""
        base = im.filter(ImageFilter.GaussianBlur(blur * SS)) if blur else im
        a = np.asarray(base, dtype=np.float32) / 255.0
        cur = np.asarray(self.img, dtype=np.float32)
        self.img = Image.fromarray(cur + a * weight, mode="F")

    def data(self):
        return np.asarray(self.img, dtype=np.float32)


def ellipse_pt(cx, cy, rx, ry, ang):
    return (cx + rx * math.cos(ang), cy + ry * math.sin(ang))


def draw_ring(d, cx, cy, rx, ry, irx, iry, level=255):
    """Filled elliptical band."""
    d.ellipse([px(cx - rx), px(cy - ry), px(cx + rx), px(cy + ry)], fill=level)
    d.ellipse([px(cx - irx), px(cy - iry), px(cx + irx), px(cy + iry)], fill=0)


def draw_ellipse_outline(d, cx, cy, rx, ry, w=1.4, level=255):
    d.ellipse([px(cx - rx), px(cy - ry), px(cx + rx), px(cy + ry)], outline=level, width=max(1, int(px(w))))


def draw_star(d, cx, cy, rx, ry, n, step, phase, w=1.2, level=255):
    pts = [ellipse_pt(cx, cy, rx, ry, phase + 2 * math.pi * i / n) for i in range(n)]
    for i in range(n):
        a = pts[i]
        b = pts[(i * 1 + step) % n] if False else pts[(i + step) % n]
        d.line([px(a[0]), px(a[1]), px(b[0]), px(b[1])], fill=level, width=max(1, int(px(w))))


def draw_dashes(d, cx, cy, rx, ry, irx, iry, count, phase, gap=0.45, level=255):
    """Ring broken into segments (stone slabs / wind arcs)."""
    step = 2 * math.pi / count
    for i in range(count):
        a0 = phase + i * step
        a1 = a0 + step * (1.0 - gap)
        pts = []
        k = 8
        for j in range(k + 1):
            pts.append(ellipse_pt(cx, cy, rx, ry, a0 + (a1 - a0) * j / k))
        for j in range(k, -1, -1):
            pts.append(ellipse_pt(cx, cy, irx, iry, a0 + (a1 - a0) * j / k))
        d.polygon([(px(x), px(y)) for x, y in pts], fill=level)


def draw_sparkle(d, x, y, r, level):
    """Four-point twinkle, as in the reference."""
    pts = [(x, y - r), (x + r * 0.28, y - r * 0.28), (x + r, y),
           (x + r * 0.28, y + r * 0.28), (x, y + r), (x - r * 0.28, y + r * 0.28),
           (x - r, y), (x - r * 0.28, y - r * 0.28)]
    d.polygon([(px(a), px(b)) for a, b in pts], fill=level)


def draw_streak(d, x, y, h, w, level):
    d.ellipse([px(x - w), px(y - h), px(x + w), px(y + h)], fill=level)


def draw_flame(d, x, y, h, w, lean, level):
    """Teardrop tongue pointing up."""
    pts = [(x + lean, y - h), (x + w, y - h * 0.25), (x + w * 0.55, y + h * 0.35),
           (x, y + h * 0.5), (x - w * 0.55, y + h * 0.35), (x - w, y - h * 0.25)]
    d.polygon([(px(a), px(b)) for a, b in pts], fill=level)


def draw_drop(d, x, y, h, w, level):
    """Water droplet: round belly, pointed top."""
    d.ellipse([px(x - w), px(y - h * 0.15), px(x + w), px(y + h * 0.75)], fill=level)
    d.polygon([(px(x), px(y - h)), (px(x + w * 0.9), px(y + h * 0.2)),
               (px(x - w * 0.9), px(y + h * 0.2))], fill=level)


def draw_mote(d, x, y, r, rot, level):
    """Irregular dust chip."""
    pts = []
    for i in range(5):
        a = rot + 2 * math.pi * i / 5
        rr = r * (0.6 + 0.4 * ((i * 7) % 5) / 4.0)
        pts.append((x + rr * math.cos(a), y + rr * math.sin(a) * 0.85))
    d.polygon([(px(a), px(b)) for a, b in pts], fill=level)


def draw_bolt(d, x0, y0, x1, y1, seed, w, level, segs=6):
    rnd = random.Random(seed)
    pts = [(x0, y0)]
    for i in range(1, segs):
        t = i / segs
        jitter = (rnd.random() - 0.5) * 14 * math.sin(math.pi * t)
        pts.append((x0 + (x1 - x0) * t + jitter, y0 + (y1 - y0) * t))
    pts.append((x1, y1))
    for i in range(len(pts) - 1):
        d.line([px(pts[i][0]), px(pts[i][1]), px(pts[i + 1][0]), px(pts[i + 1][1])],
               fill=level, width=max(1, int(px(w))))


def draw_arc(d, cx, cy, rx, ry, a0, a1, w, level):
    box = [px(cx - rx), px(cy - ry), px(cx + rx), px(cy + ry)]
    d.arc(box, math.degrees(a0), math.degrees(a1), fill=level, width=max(1, int(px(w))))


# ---------------------------------------------------------------------------
# particle column
# ---------------------------------------------------------------------------

def column_particles(seed, count):
    """Rising motes.  `laps` is a whole number so the loop closes cleanly."""
    rnd = random.Random(seed)
    out = []
    for i in range(count):
        roll = rnd.random()
        kind = "streak" if roll < 0.16 else ("big" if roll < 0.44 else "spark")
        out.append(dict(
            x=rnd.uniform(10, 118),
            y0=rnd.uniform(COL_TOP, CY + 8),
            r=rnd.uniform(1.9, 3.6),
            kind=kind,
            laps=rnd.choice([1, 1, 2]),
            tw=rnd.choice([1, 2, 2, 3]),
            ph=rnd.uniform(0, 2 * math.pi),
            drift=rnd.uniform(-4, 4),
        ))
    return out


SPAN = CY + 8 - COL_TOP


def particle_pos(p, t):
    y = COL_TOP + ((p["y0"] - COL_TOP) - SPAN * p["laps"] * t) % SPAN
    return y, (y - COL_TOP) / SPAN


def twinkle(p, t, floor=0.55):
    return floor + (1.0 - floor) * (0.5 + 0.5 * math.sin(p["ph"] + 2 * math.pi * p["tw"] * t))


def inner_wash(field, level=0.30):
    im, d = field.layer()
    d.ellipse([px(CX - IRX + 1), px(CY - IRY + 1), px(CX + IRX - 1), px(CY + IRY - 1)], fill=200)
    field.add_flat(im, level, blur=3.5)


def haze(field, top, strength):
    """Soft column of light standing on the ring, thinning upward."""
    im, d = field.layer()
    for i in range(56):
        u = i / 55.0
        y = CY + 6 - (CY + 6 - top) * u
        a = int(255 * (1.0 - u) ** 1.5)
        half = 46 - 10 * u
        d.rectangle([px(CX - half), px(y - 2), px(CX + half), px(y + 2)], fill=a)
    field.add_flat(im, strength, blur=7)


# ---------------------------------------------------------------------------
# element definitions
# ---------------------------------------------------------------------------

ELEMENTS = {}


def build_fire(f, t):
    ph = 2 * math.pi * t
    inner_wash(f, 0.34)
    im, d = f.layer()
    draw_ring(d, CX, CY, RX, RY, IRX, IRY, 178)
    for i in range(18):
        a = 2 * math.pi * i / 18 + ph / 3
        x, y = ellipse_pt(CX, CY, RX - 1.5, RY - 0.8, a)
        h = 4.0 + 2.4 * math.sin(ph * 2 + i * 1.7)
        draw_flame(d, x, y - h * 0.4, h, 2.4, 0, 245)
    draw_star(d, CX, CY, SRX, SRY, 9, 4, ph / 9, 1.2, 205)
    draw_ellipse_outline(d, CX, CY, IRX - 1.6, IRY - 1.0, 0.9, 190)
    f.add(im, 0.95, blur=0.35)

    im, d = f.layer()
    for p in column_particles(11, 46):
        y, k = particle_pos(p, t)
        lvl = int(255 * twinkle(p, t))
        x = p["x"] + p["drift"] * (1 - k)
        if p["kind"] == "big":
            draw_flame(d, x, y, p["r"] * 2.2, p["r"] * 0.8, p["drift"] * 0.3, lvl)
        elif p["kind"] == "streak":
            draw_streak(d, x, y, p["r"] * 2.4, 0.45, lvl)
        else:
            draw_sparkle(d, x, y, p["r"] * 0.95, lvl)
    f.add(im, 0.85, blur=0.4, soft=0.75)
    haze(f, 18, 0.72)


def build_ice(f, t):
    ph = 2 * math.pi * t
    inner_wash(f, 0.36)
    im, d = f.layer()
    draw_ring(d, CX, CY, RX, RY, IRX, IRY, 172)
    draw_ellipse_outline(d, CX, CY, RX - 6.5, RY - 3.0, 0.9, 170)
    draw_star(d, CX, CY, SRX, SRY, 6, 2, ph / 6, 1.3, 210)
    draw_star(d, CX, CY, SRX * 0.60, SRY * 0.60, 6, 3, -ph / 6, 1.0, 205)
    g = t % 1.0
    draw_ellipse_outline(d, CX, CY, IRX * (0.25 + 0.72 * g), IRY * (0.25 + 0.72 * g), 1.0,
                         int(200 * (1 - g)))
    f.add(im, 0.95, blur=0.35)

    im, d = f.layer()
    for p in column_particles(22, 44):
        y, k = particle_pos(p, t)
        lvl = int(255 * twinkle(p, t))
        x = p["x"] + p["drift"] * 0.6 * math.sin(p["ph"] + ph)
        if p["kind"] == "big":
            draw_drop(d, x, y, p["r"] * 1.8, p["r"] * 0.72, lvl)
        elif p["kind"] == "streak":
            draw_streak(d, x, y, p["r"] * 2.2, 0.45, lvl)
        else:
            draw_sparkle(d, x, y, p["r"], lvl)
    f.add(im, 0.85, blur=0.4, soft=0.75)
    haze(f, 16, 0.76)


def build_earth(f, t):
    ph = 2 * math.pi * t
    inner_wash(f, 0.32)
    im, d = f.layer()
    draw_dashes(d, CX, CY, RX, RY, IRX, IRY, 10, ph / 10, gap=0.36, level=185)
    draw_ellipse_outline(d, CX, CY, IRX - 1.8, IRY - 1.1, 1.0, 200)
    draw_star(d, CX, CY, SRX, SRY, 8, 3, -ph / 8, 1.2, 205)
    f.add(im, 0.95, blur=0.35)

    im, d = f.layer()
    for p in column_particles(33, 50):
        y, k = particle_pos(p, t)
        lvl = int(255 * twinkle(p, t, 0.38))
        x = p["x"] + p["drift"] * 0.9 * math.sin(p["ph"] + ph * 0.5)
        if p["kind"] == "streak":
            draw_mote(d, x, y, p["r"] * 0.65, p["ph"] + ph, lvl)
        else:
            draw_mote(d, x, y, p["r"] * (1.25 if p["kind"] == "big" else 0.9), p["ph"] + ph, lvl)
    f.add(im, 0.9, blur=0.5, soft=0.8)
    haze(f, 26, 0.78)


def build_storm(f, t):
    ph = 2 * math.pi * t
    inner_wash(f, 0.34)
    im, d = f.layer()
    draw_ring(d, CX, CY, RX, RY, IRX, IRY, 178)
    draw_star(d, CX, CY, SRX, SRY, 7, 3, ph / 7, 1.3, 205)
    draw_ellipse_outline(d, CX, CY, IRX - 2, IRY - 1.2, 0.9, 185)
    f.add(im, 0.95, blur=0.3)

    # three bolts, each alight for three frames of the twelve
    im, d = f.layer()
    frame = int(round(t * FRAMES)) % FRAMES
    for i, start in enumerate((0, 4, 8)):
        age = (frame - start) % FRAMES
        if age > 2:
            continue
        lvl = (255, 185, 105)[age]
        a = 2 * math.pi * i / 3 + 0.6
        x0, y0 = ellipse_pt(CX, CY, IRX * 0.8, IRY * 0.8, a)
        x1 = CX + (x0 - CX) * 0.35
        y1 = 46 + i * 8
        draw_bolt(d, x0, y0, x1, y1, seed=start * 7 + i, w=2.4 - 0.6 * age, level=lvl, segs=4)
        draw_sparkle(d, x0, y0, 6.0 - 1.6 * age, lvl)
    f.add(im, 1.05, blur=0.3, soft=0.85)

    im, d = f.layer()
    for p in column_particles(44, 44):
        y, k = particle_pos(p, t)
        lvl = int(255 * twinkle(p, t, 0.30))
        x = p["x"] + p["drift"] * (1 - k) * 0.5
        if p["kind"] == "streak":
            draw_streak(d, x, y, p["r"] * 2.6, 0.5, lvl)
        elif p["kind"] == "big":
            draw_bolt(d, x, y + p["r"] * 1.6, x + p["drift"] * 0.4, y - p["r"] * 1.6,
                      seed=int(p["ph"] * 100), w=0.7, level=lvl, segs=3)
        else:
            draw_sparkle(d, x, y, p["r"] * 0.95, lvl)
    f.add(im, 0.85, blur=0.4, soft=0.75)
    haze(f, 14, 0.68)


def build_wind(f, t):
    ph = 2 * math.pi * t
    inner_wash(f, 0.32)
    im, d = f.layer()
    draw_dashes(d, CX, CY, RX, RY, IRX, IRY, 5, ph / 5, gap=0.40, level=186)
    draw_ellipse_outline(d, CX, CY, IRX - 1.5, IRY - 1.0, 1.0, 195)
    draw_star(d, CX, CY, SRX, SRY, 10, 3, ph / 10, 1.05, 200)
    # swooshes climbing the column, one orbit each per loop
    for i in range(3):
        a0 = ph + 2 * math.pi * i / 3
        r = 26 - i * 6
        draw_arc(d, CX, CY - 16 - i * 13, r, r * 0.46, a0, a0 + 2.5, 1.2, 225)
    f.add(im, 0.95, blur=0.35)

    im, d = f.layer()
    for p in column_particles(55, 46):
        y, k = particle_pos(p, t)
        lvl = int(255 * twinkle(p, t))
        x = p["x"] + 7 * math.sin(p["ph"] + ph + k * 3)
        if p["kind"] == "big":
            a0 = p["ph"] + ph * 2
            draw_arc(d, x, y, p["r"] * 2.4, p["r"] * 1.0, a0, a0 + 2.6, 0.9, lvl)
        elif p["kind"] == "streak":
            draw_streak(d, x, y, p["r"] * 2.0, 0.45, lvl)
        else:
            draw_sparkle(d, x, y, p["r"] * 0.85, lvl)
    f.add(im, 0.85, blur=0.45, soft=0.8)
    haze(f, 12, 0.66)


# Hue stays saturated at low energy and whitens at the core - the reference
# carries intensity in the alpha, not in a dark-to-light ramp.
ELEMENTS["fire"] = (build_fire, [(0.00, (226, 58, 10)), (0.35, (255, 118, 24)),
                                 (0.70, (255, 189, 78)), (1.00, (255, 246, 218))])
ELEMENTS["ice"] = (build_ice, [(0.00, (46, 140, 236)), (0.35, (94, 198, 255)),
                               (0.70, (168, 232, 255)), (1.00, (248, 253, 255))])
ELEMENTS["earth"] = (build_earth, [(0.00, (92, 52, 22)), (0.35, (134, 84, 36)),
                                   (0.70, (178, 126, 62)), (1.00, (238, 206, 152))])
ELEMENTS["storm"] = (build_storm, [(0.00, (240, 176, 24)), (0.35, (255, 214, 58)),
                                   (0.70, (255, 240, 140)), (1.00, (255, 254, 232))])
ELEMENTS["shadow"] = (build_wind, [(0.00, (168, 150, 236)), (0.35, (214, 210, 248)),
                                 (0.70, (240, 242, 253)), (1.00, (255, 255, 255))])


def ramp(E, stops, size):
    t = np.clip(E / 1.75, 0.0, 1.0)
    ts = np.array([s[0] for s in stops], dtype=np.float32)
    cols = np.array([s[1] for s in stops], dtype=np.float32)
    rgb = np.zeros(t.shape + (3,), dtype=np.float32)
    for c in range(3):
        rgb[..., c] = np.interp(t, ts, cols[:, c])
    alpha = np.clip(E * 0.95, 0.0, 1.0) ** 0.95
    out = np.zeros(t.shape + (4,), dtype=np.uint8)
    out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def render(name, size=OUT):
    build, stops = ELEMENTS[name]
    frames = []
    for i in range(FRAMES):
        t = i / FRAMES
        f = Field()
        build(f, t)
        e = Image.fromarray(f.data(), mode="F").resize((size, size), Image.BOX)
        frames.append(ramp(np.asarray(e, dtype=np.float32), stops, size))
    return frames


def sheet(frames):
    w, h = frames[0].size
    im = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        im.paste(fr, (i * w, 0), fr)
    return im


if __name__ == "__main__":
    root = "public"
    # Authored at 128 and halved: TILE is 32, so a 2x2-tile effect is a 64-px
    # frame, and drawing it down from 128 keeps the glow smooth at the zooms the
    # camera actually uses (f = 2 .. 3.2).
    os.makedirs(root, exist_ok=True)
    for name in ELEMENTS:
        big = render(name, 128)
        small = [fr.resize((64, 64), Image.LANCZOS) for fr in big]
        sheet(small).save(f"{root}/fx-attune-{name}.png")
        print("done", name)
