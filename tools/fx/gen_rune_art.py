"""
Knell artwork for Bone Isle: the 32x32 impact strips and the fifteen stones.

Run from the repo root:  python tools/fx/gen_rune_art.py

Two families come out of this, both derived from the frames in `tools/fx/src/`
rather than drawn here:

    public/fx-<element>-<tier>-rune.png    288 x 32, nine frames, one strip
    public/item-<element>-<code>-rune.png  32 x 32, the stone in the bag
    public/item-<name>-rune.png            32 x 32, the five utility runes

WHY DERIVE AND NOT DRAW.  The other two generators in this folder draw their
effects from scratch because there was nothing to start from.  Here there is:
one skull animation and one stone, and the job is to say the same thing fifteen
times in fifteen colours.  Fifteen hand-recolours would drift apart at the
third one, and the drift would be invisible until two of them ended up side by
side on a hotbar.

THE PALETTES ARE NOT INVENTED HERE EITHER.  They are read off the crystal icons
already in `public/` — `item-fire-ember-shard.png` and its siblings — so a
Knell is the same colour as the Shard it doubles.  Each element's three tiers
are three different hues rather than three brightnesses of one, which is the
convention the shelf already runs on and the reason a bag of thirty crystals is
readable at all.

Two of those sampled ramps are nudged: Ember is pushed redder and Spark
yellower.  Straight off the icons they came out the same orange, and at 32 px
in the middle of a fight "which element just went off" has to be answerable in
one frame.
"""

import glob
import math
import os

import numpy as np
from PIL import Image, ImageDraw

# The nine source frames (`knell-1.png` .. `knell-9.png`, 128 x 128) and the
# stone (`rune-stone.png`, 32 x 32).  NOT IN THE REPOSITORY and gitignored:
# they are licensed art of the same family as the other `fx-*` sheets, whose
# licence forbids redistributing originals another end user could pick up and
# use.  The DERIVED sheets in `public/` ship; these do not.  Drop them in this
# folder to re-run.
SRC = "tools/fx/src"
OUT = "public"

# The three bodies the utility runes are cut from, beside the Knells' stone.
UTILITY_BODY = {
    "nugget": "rune-nugget.png",
    "gem": "rune-gem.png",
    "tablet": "rune-tablet.png",
}

# GREY, AND THE REASON IT IS GREY.  Fifteen elemental ramps between them have
# taken red, blue, pale blue, amber, violet, magenta, navy, silver and dark
# brown; what is left over is grey, green and teal.  So the utility runes are
# grey rock with a coloured mark, which is exactly what Life and Recall already
# are — the family reads as the older, plainer shelf it belongs to, and the
# mark carries the meaning.  Greens and teals for the four that help you,
# acid yellow-green for the one that does not.
UTILITY_STONE = ["#101010", "#2e2e2c", "#55574f", "#7d8375", "#c2c7b8"]

#            body      groove     mark       core
UTILITY = {
    "heal":  ("nugget", "#1f6b3a", "#3ee07a", "#b6ffcf"),
    "haste": ("gem",    "#0f5c48", "#2fd8a0", "#a8ffdc"),
    "mire":  ("gem",    "#0d4450", "#1f96ae", "#8fe0e8"),
    "aegis": ("nugget", "#3a3f48", "#c6ccd8", "#ffffff"),
    "fury":  ("tablet", "#4a5a08", "#b8e01e", "#f0ff8a"),
}

ELEMENTS = ["fire", "ice", "earth", "storm", "shadow"]

# The id words, NOT the display words.  `TIER_CODE` in src/systems/elements.ts
# is frozen: it builds item keys and it builds these filenames, and shadow's
# ids (Gloom/Umbra/Eclipse) deliberately differ from what the player reads
# (Zephyr/Squall/Cyclone).  The file is named after the id.
TIER_CODE = {
    "fire": ["ember", "flame", "pyre"],
    "ice": ["frost", "rime", "glacier"],
    "earth": ["loam", "stone", "bedrock"],
    "storm": ["spark", "bolt", "tempest"],
    "shadow": ["gloom", "umbra", "eclipse"],
}


def _h(s):
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))


# darkest -> brightest, five stops per element per tier
RAMP = {
    ("fire", 0): ["#1a0000", "#7a0800", "#e50d00", "#ff6a00", "#ffd070"],
    ("fire", 1): ["#030a18", "#0b2c58", "#11488c", "#328ee2", "#cfe9ff"],
    ("fire", 2): ["#070505", "#1a1211", "#2d1c1a", "#72402b", "#e8a24a"],
    ("ice", 0): ["#101a28", "#2f4f6e", "#6c93b6", "#b9e3fa", "#ffffff"],
    ("ice", 1): ["#00000b", "#093da3", "#116eba", "#37c1ff", "#d8f4ff"],
    ("ice", 2): ["#050a10", "#0f2133", "#2b6999", "#5fa3cf", "#dff0ff"],
    ("earth", 0): ["#0d0000", "#3a0810", "#7f1125", "#b04a3a", "#e8b070"],
    ("earth", 1): ["#111110", "#2e2e2b", "#65645f", "#8c8a83", "#e8e4d8"],
    ("earth", 2): ["#0a0806", "#201a1a", "#372e36", "#6b5f68", "#c8bfc6"],
    ("storm", 0): ["#2a1c00", "#7a4a00", "#e79b00", "#ffcc10", "#ffff8a"],
    ("storm", 1): ["#200c38", "#36145d", "#8236d2", "#a04afa", "#e6c7ff"],
    ("storm", 2): ["#0e0b15", "#14101f", "#292547", "#3a3666", "#c3cdf9"],
    ("shadow", 0): ["#150123", "#40025e", "#8f04b3", "#e788e5", "#ffffff"],
    ("shadow", 1): ["#181123", "#2f183b", "#613473", "#824a94", "#ce9cd6"],
    ("shadow", 2): ["#3b3350", "#565070", "#978fb7", "#c9c3e3", "#ffffff"],
}
RAMP = {k: [_h(c) for c in v] for k, v in RAMP.items()}


def lum(rgb):
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def gradient_map(rgb, ramp, lo=0.0, hi=1.0):
    """Luminance in, ramp colour out, sampled linearly between the stops.

    Mapping brightness rather than swapping named colours is what keeps the
    source's shading: the skull's lit brow and its eye sockets survive into
    every one of the fifteen tints instead of flattening into two tones.
    """
    t = np.clip((lum(rgb.astype(np.float32)) / 255.0 - lo) / max(1e-6, hi - lo), 0, 1)
    stops = np.array(ramp, np.float32)
    pos = t * (len(stops) - 1)
    i = np.clip(np.floor(pos).astype(int), 0, len(stops) - 2)
    f = (pos - i)[..., None]
    return stops[i] * (1 - f) + stops[i + 1] * f


# --------------------------------------------------------------------------
#  the impact: 128 -> 32, recoloured
# --------------------------------------------------------------------------

def down32(path, thr=0.35):
    """One 128 px frame to one 32 px frame.

    Alpha-weighted, so a pixel's colour is the average of the pixels that
    actually had ink in them rather than an average against transparent black,
    which fringes every edge dark.  Alpha comes back out HARD: the source has
    no partial alpha anywhere and neither should the result, or the spikes turn
    into a grey fog at the one size the player ever sees them.
    """
    a = np.array(Image.open(path).convert("RGBA")).astype(np.float32)
    al = a[..., 3] / 255.0
    prem = a[..., :3] * al[..., None]
    b = prem.reshape(32, 4, 32, 4, 3).mean((1, 3))
    w = al.reshape(32, 4, 32, 4).mean((1, 3))
    rgb = np.zeros((32, 32, 3), np.float32)
    m = w > thr
    rgb[m] = np.clip(b[m] / w[m][:, None], 0, 255)
    return rgb, m


def despeckle(mask):
    """Drop pixels with no orthogonal neighbour.

    The halo of spikes is the part that does not survive a 4x reduction: each
    spike lands on one or two pixels and what reads as a crown at 128 reads as
    dirt at 32.  Killing the strays keeps the ones that still form a shape.
    """
    p = np.pad(mask, 1)
    n = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
    return mask & (n > 0)


def frames():
    fs = sorted(glob.glob(f"{SRC}/knell-*.png"),
                key=lambda p: int(os.path.basename(p).split("-")[1].split(".")[0]))
    if len(fs) != 9:
        raise SystemExit(f"expected nine source frames in {SRC}, found {len(fs)}")
    return [down32(f) for f in fs]


def fx_strip(el, tier, cache):
    ramp = RAMP[(el, tier)]
    out = Image.new("RGBA", (32 * len(cache), 32), (0, 0, 0, 0))
    for i, (rgb, m) in enumerate(cache):
        mm = despeckle(m)
        px = np.zeros((32, 32, 4), np.uint8)
        px[..., :3] = gradient_map(rgb, ramp).astype(np.uint8)
        px[..., 3] = np.where(mm, 255, 0)
        out.alpha_composite(Image.fromarray(px), (i * 32, 0))
    return out


# --------------------------------------------------------------------------
#  the five marks cut into the stone
# --------------------------------------------------------------------------

G = 15          # glyph box, in final pixels
SS = 8


def _canvas():
    im = Image.new("L", (G * SS, G * SS), 0)
    return im, ImageDraw.Draw(im)


def _px(v):
    return v * SS


def _arm(d, cx, cy, ang, r0, r1, w):
    d.line([_px(cx + r0 * math.cos(ang)), _px(cy + r0 * math.sin(ang)),
            _px(cx + r1 * math.cos(ang)), _px(cy + r1 * math.sin(ang))],
           fill=255, width=int(_px(w)))


def _fire():
    im, d = _canvas()
    c = G / 2
    d.polygon([(_px(x), _px(y)) for x, y in
               [(c, 0.8), (c + 0.9, 3.6), (c + 2.4, 5.8), (c + 3.6, 8.4),
                (c + 3.2, 11.0), (c + 1.6, 12.6), (c, 13.0), (c - 1.6, 12.6),
                (c - 3.2, 11.0), (c - 3.6, 8.4), (c - 2.4, 5.8), (c - 0.9, 3.6)]], fill=255)
    return im


def _fire_core():
    im, d = _canvas()
    c = G / 2
    d.polygon([(_px(x), _px(y)) for x, y in
               [(c, 6.4), (c + 1.7, 9.0), (c + 1.4, 11.0), (c, 11.8),
                (c - 1.4, 11.0), (c - 1.7, 9.0)]], fill=255)
    return im


def _ice():
    im, d = _canvas()
    c = G / 2
    for k in range(6):
        a = math.pi / 2 + k * math.pi / 3
        _arm(d, c, c, a, 0, 6.6, 0.85)
        for s in (-1, 1):
            _arm(d, c + 4.0 * math.cos(a), c + 4.0 * math.sin(a), a + s * 1.0, 0, 1.9, 0.85)
    return im


def _ice_core():
    im, d = _canvas()
    c = G / 2
    d.ellipse([_px(c - 1.15), _px(c - 1.15), _px(c + 1.15), _px(c + 1.15)], fill=255)
    return im


def _earth():
    im, d = _canvas()
    d.polygon([(_px(7.5), _px(2.0)), (_px(13.4), _px(11.0)), (_px(1.6), _px(11.0))], fill=255)
    d.rectangle([_px(1.0), _px(12.2), _px(14.0), _px(13.4)], fill=255)
    return im


def _earth_core():
    im, d = _canvas()
    d.polygon([(_px(7.5), _px(5.2)), (_px(11.0), _px(10.6)), (_px(4.0), _px(10.6))], fill=255)
    return im


def _storm():
    im, d = _canvas()
    d.polygon([(_px(11.4), _px(0.8)), (_px(3.8), _px(8.2)), (_px(7.4), _px(8.2)),
               (_px(3.4), _px(14.2)), (_px(11.4), _px(6.4)), (_px(7.6), _px(6.4)),
               (_px(13.2), _px(0.8))], fill=255)
    return im


def _storm_core():
    im, d = _canvas()
    d.polygon([(_px(10.4), _px(2.6)), (_px(5.6), _px(7.2)), (_px(8.0), _px(7.2)),
               (_px(5.2), _px(12.4)), (_px(9.8), _px(7.4)), (_px(7.4), _px(7.4)),
               (_px(11.2), _px(2.6))], fill=255)
    return im


def _wind():
    """A cyclone, not the three hooked streaks of the weather glyph.

    The streaks fall apart below about twenty pixels — each hook either merges
    with its own line or runs off the box — and a spiral survives the threshold
    because every part of it is the same stroke.  It is the better picture
    anyway: this element's tiers are Zephyr, Squall, Cyclone.
    """
    im, d = _canvas()
    c = G / 2
    turns, steps = 2.25, 220
    pts = []
    for i in range(steps + 1):
        th = turns * 2 * math.pi * i / steps
        r = 0.7 + 6.0 * (th / (turns * 2 * math.pi))
        pts.append((_px(c + r * math.cos(th - math.pi / 2)),
                    _px(c + r * math.sin(th - math.pi / 2))))
    d.line(pts, fill=255, width=int(_px(1.0)), joint="curve")
    return im


def _wind_core():
    im, d = _canvas()
    c = G / 2
    d.ellipse([_px(c - 0.9), _px(c - 0.9), _px(c + 0.9), _px(c + 0.9)], fill=255)
    return im


def _u_heal():
    im, d = _canvas()
    d.rectangle([_px(6.2), _px(1.8), _px(8.8), _px(13.2)], fill=255)
    d.rectangle([_px(1.8), _px(6.2), _px(13.2), _px(8.8)], fill=255)
    return im


def _u_heal_core():
    im, d = _canvas()
    d.rectangle([_px(7.0), _px(3.0), _px(8.0), _px(12.0)], fill=255)
    d.rectangle([_px(3.0), _px(7.0), _px(12.0), _px(8.0)], fill=255)
    return im


def _chevron(d, cx, w, t):
    d.line([_px(cx - w), _px(3.0), _px(cx + w), _px(7.5), _px(cx - w), _px(12.0)],
           fill=255, width=int(_px(t)), joint="curve")


def _u_haste():
    im, d = _canvas()
    _chevron(d, 4.6, 2.4, 1.2)
    _chevron(d, 9.4, 2.4, 1.2)
    return im


def _u_haste_core():
    im, d = _canvas()
    _chevron(d, 9.4, 2.4, 0.6)
    return im


def _u_mire():
    """An hourglass. Everything else legible at fifteen pixels that means
    "slow" is an arrow, and arrows are already the Novas and the Waves."""
    im, d = _canvas()
    d.polygon([(_px(2.6), _px(2.0)), (_px(12.4), _px(2.0)), (_px(7.5), _px(7.5))], fill=255)
    d.polygon([(_px(2.6), _px(13.0)), (_px(12.4), _px(13.0)), (_px(7.5), _px(7.5))], fill=255)
    return im


def _u_mire_core():
    im, d = _canvas()
    d.polygon([(_px(4.6), _px(3.6)), (_px(10.4), _px(3.6)), (_px(7.5), _px(6.6))], fill=255)
    return im


def _u_aegis():
    """Outlined, not filled. A solid shield at this size is a blob with a
    groove round it and reads as a gemstone."""
    im, d = _canvas()
    d.line([(_px(7.5), _px(1.8)), (_px(12.4), _px(4.0)), (_px(12.4), _px(8.0)),
            (_px(7.5), _px(13.2)), (_px(2.6), _px(8.0)), (_px(2.6), _px(4.0)),
            (_px(7.5), _px(1.8))], fill=255, width=int(_px(1.15)), joint="curve")
    return im


def _u_fury():
    im, d = _canvas()
    for x0, bow in ((3.2, 0.9), (7.5, 1.3), (11.8, 0.9)):
        d.line([(_px(x0 + 1.8), _px(1.6)), (_px(x0 + bow - 0.4), _px(7.4)),
                (_px(x0 - 1.4), _px(13.4))], fill=255, width=int(_px(1.15)), joint="curve")
    return im


def _u_fury_core():
    im, d = _canvas()
    d.line([_px(8.6), _px(2.6), _px(6.2), _px(12.4)], fill=255, width=int(_px(0.7)))
    return im


def _blank():
    return _canvas()[0]


UTILITY_GLYPH = {
    "heal": (_u_heal, _u_heal_core),
    "haste": (_u_haste, _u_haste_core),
    "mire": (_u_mire, _u_mire_core),
    "aegis": (_u_aegis, _blank),
    "fury": (_u_fury, _u_fury_core),
}


BUILD = {
    "fire": (_fire, _fire_core),
    "ice": (_ice, _ice_core),
    "earth": (_earth, _earth_core),
    "storm": (_storm, _storm_core),
    "shadow": (_wind, _wind_core),
}


def glyph(el, table=None):
    body_f, core_f = (table or BUILD)[el]

    def shrink(im):
        return np.asarray(im.resize((G, G), Image.BOX), dtype=np.float32) / 255.0 > 0.34

    body = shrink(body_f())
    core = shrink(core_f())
    return body, core & body


# --------------------------------------------------------------------------
#  the stone
# --------------------------------------------------------------------------

def _outline(mask):
    p = np.pad(mask, 1)
    grown = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:] |
             p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:])
    return grown & ~mask


def utility_icon(name):
    """One utility rune: grey body, groove, mark, lit core.

    Same construction as `rune_icon` below and deliberately so — these have to
    look like the Knells' cousins, not like a second art style that happens to
    share a shelf. The only differences are that the body ramp is fixed grey
    instead of per-element, and the mark is a symbol rather than an element.
    """
    body_key, groove_c, mark_c, core_c = UTILITY[name]
    raw = np.array(Image.open(f"{SRC}/{UTILITY_BODY[body_key]}").convert("RGBA"))
    rgb = raw[..., :3].astype(np.float32)
    a = raw[..., 3] > 128
    rim = a & (lum(rgb) < 40)

    px = np.zeros((32, 32, 4), np.uint8)
    px[..., :3] = np.clip(gradient_map(rgb, [_h(c) for c in UTILITY_STONE], 0.06, 0.70),
                          0, 255).astype(np.uint8)
    px[..., 3] = np.where(a, 255, 0)
    px[..., :3][rim] = (12, 12, 12)

    gb, gc = glyph(name, UTILITY_GLYPH)
    o = (32 - G) // 2
    body = np.zeros((32, 32), bool)
    core = np.zeros((32, 32), bool)
    body[o:o + G, o:o + G] = gb
    core[o:o + G, o:o + G] = gc
    body &= a
    core &= a

    groove = _outline(body) & a & ~rim
    px[..., :3][groove] = _h(groove_c)
    px[..., :3][body] = _h(mark_c)
    px[..., :3][core] = _h(core_c)
    return Image.fromarray(px)


def rune_icon(el, tier, stone):
    s_rgb, s_a, s_rim = stone
    ramp = RAMP[(el, tier)]
    # The body reads mid-to-light and never reaches the ramp's two darkest
    # stops.  A Knell has to look like carved stone in the bag, not like the
    # thing it throws — the strip is where the element gets to be lurid.
    px = np.zeros((32, 32, 4), np.uint8)
    px[..., :3] = np.clip(gradient_map(s_rgb, ramp, lo=0.10, hi=0.62), 0, 255).astype(np.uint8)
    px[..., 3] = np.where(s_a, 255, 0)
    px[..., :3][s_rim] = (np.array(ramp[0], np.float32) * 0.55).astype(np.uint8)

    gb, gc = glyph(el)
    o = (32 - G) // 2
    body = np.zeros((32, 32), bool)
    core = np.zeros((32, 32), bool)
    body[o:o + G, o:o + G] = gb
    core[o:o + G, o:o + G] = gc
    body &= s_a
    core &= s_a

    # A groove around the mark, then the mark lit inside it.  The groove is
    # the whole reason one glyph works on all fifteen stones: a bright mark
    # alone vanishes on a pale Frost and a dark one vanishes on a near-black
    # Pyre, and a mark with a shadow under it survives both.
    groove = _outline(body) & s_a & ~s_rim
    px[..., :3][groove] = (np.array(ramp[0], np.float32) * 0.7).astype(np.uint8)
    px[..., :3][body] = np.array(ramp[4], np.uint8)
    px[..., :3][core] = np.array(ramp[3], np.uint8)
    return Image.fromarray(px)


# ---------------------------------------------------------------------------
#  The auras: what a crystal looks like once it is ON you
# ---------------------------------------------------------------------------
#
# Eight frames of orbiting motes, from a sixteen-frame source whose second half
# is a duplicate of its first — the loop is eight long, so shipping sixteen
# would have doubled the file to say the same thing twice.
#
# ONE ANIMATION, FIVE COLOURWAYS, TWO PLAYBACK MODES. Protective and Fury LOOP
# for as long as the effect runs; the other three play ONCE at the moment of
# casting. That split is the whole reason the same motes can serve all five
# without any of them reading as a copy of another: a thing that keeps circling
# you is a state, a thing that flares and goes is an event, and the eye sorts
# those two apart before it has looked at the colour.
#
# Unlike everything else in this file the alpha is kept SOFT here. The Knell is
# hard-edged pixel art and had to stay that way; an aura is light around a
# character, and light with a one-bit edge reads as a sticker.

AURA_FRAMES = 8
AURA = {
    # green, because they are leaves and it is a shield of them
    "guard": ["#0d3a1e", "#1f6b3a", "#3ee07a", "#b6ffcf", "#ffffff"],
    # reds into violet. Fury is the only crystal that hurts you, and it is the
    # only aura that does not have a green or a blue anywhere in it.
    "fury":  ["#1a0008", "#8f0030", "#e01e5a", "#b83ee0", "#ffd0f0"],
    # pale gold rather than another green: Mending and Protective would
    # otherwise be two green flickers around the same character.
    "mend":  ["#2a2410", "#8a6a1e", "#ffd070", "#fff6d0", "#ffffff"],
    "speed": ["#0a3d30", "#0f5c48", "#2fd8a0", "#a8ffdc", "#ffffff"],
    "slow":  ["#08303a", "#0d4450", "#1f96ae", "#8fe0e8", "#dffbff"],
}


def ramp_at(t, ramp):
    """Sample a ramp at t in [0, 1]. Same interpolation as `gradient_map`, but
    driven by a number you already have instead of by a pixel's brightness."""
    stops = np.array(ramp, np.float32)
    pos = np.clip(t, 0, 1) * (len(stops) - 1)
    i = np.clip(np.floor(pos).astype(int), 0, len(stops) - 2)
    f = (pos - i)[..., None]
    return stops[i] * (1 - f) + stops[i + 1] * f


def aura_strip(name):
    """One 256 x 32 loop.

    COLOURED BY ALPHA, NOT BY THE SOURCE'S OWN COLOUR, which is the opposite of
    everything else in this file and is right here for one reason: the source's
    motion trails are drawn as near-WHITE at low opacity, so mapping luminance
    the usual way sent every trail to the top of the ramp and every palette
    came out with the same grey smear through it. Alpha already says exactly
    what the ramp wants to know — faint edge or solid core — so it drives the
    colour directly and Fury comes out with no grey in it at all.
    """
    ramp = [_h(c) for c in AURA[name]]
    out = Image.new("RGBA", (32 * AURA_FRAMES, 32), (0, 0, 0, 0))
    for i in range(AURA_FRAMES):
        src = Image.open(f"{SRC}/aura-{i + 1}.png").convert("RGBA")
        # A centred square crop before the reduction. The source frames are
        # 720x720 with the motes ranging over roughly the middle 560, so
        # reducing the raw frame would have spent a quarter of every 32-px
        # tile on empty margin.
        m = (720 - 560) // 2
        cell = src.crop((m, m, 720 - m, 720 - m)).resize((32, 32), Image.LANCZOS)
        al = np.array(cell).astype(np.float32)[..., 3] / 255.0
        # Below 8% is dust the reduction invented; keeping it turns a ring of
        # motes into a smudge the width of the frame.
        al = np.where(al < 0.08, 0.0, al)
        px = np.zeros((32, 32, 4), np.uint8)
        px[..., :3] = np.clip(ramp_at(al ** 0.65, ramp), 0, 255).astype(np.uint8)
        # Lifted, because the motes lose most of their opacity to a 22x
        # reduction and an aura you cannot see through a torso is not an aura.
        px[..., 3] = np.clip(al ** 0.75 * 300, 0, 255).astype(np.uint8)
        out.alpha_composite(Image.fromarray(px), (i * 32, 0))
    return out


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    cache = frames()
    raw = np.array(Image.open(f"{SRC}/rune-stone.png").convert("RGBA"))
    s_rgb = raw[..., :3].astype(np.float32)
    s_a = raw[..., 3] > 128
    stone = (s_rgb, s_a, s_a & (lum(s_rgb) < 40))

    for el in ELEMENTS:
        for t in range(3):
            fx_strip(el, t, cache).save(f"{OUT}/fx-{el}-{t + 1}-rune.png")
            rune_icon(el, t, stone).save(f"{OUT}/item-{el}-{TIER_CODE[el][t]}-rune.png")
        print("done", el)

    for name in UTILITY:
        utility_icon(name).save(f"{OUT}/item-{name}-rune.png")
    print("done utility runes")

    for name in AURA:
        aura_strip(name).save(f"{OUT}/fx-aura-{name}.png")
    print("done auras")
