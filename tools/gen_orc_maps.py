#!/usr/bin/env python3
"""Trace the Orc Isle and Gorak's hall out of their Tiled exports and write
`src/world/orcIsleSpec.ts` and `src/world/gorakSpec.ts` whole.

    python3 tools/gen_orc_maps.py [source-dir]

The same shape as `gen_minotaur_maps.py`, and the same house rules:

  * COLLISION BY EXCLUSION. On the island the `wyspa` layer says where land is
    and nothing else seals anything, because the export has no rock layers at
    all — it is a bare coastline. In the hall it is the other way round: the
    `podloga` layer is the floor and all three rock layers seal.
  * PROP CLEARANCE IS MEASURED AGAINST THE TERRAIN PNG, not the glyph grid.
    The painted coastline runs a tile or more past where the tile layer says
    land ends, so a tree placed on the last "land" square hangs its crown out
    over open water. `wet_paint` reads the picture and `dry` demands both.
  * NOTHING WITHIN EIGHT TILES OF A DOOR and nine between any two posts, so
    every pull is a single one and you land and leave clear.
  * EVERY OPEN SQUARE STAYS REACHABLE. `relieve_pockets` lifts props off the
    rim of anything the scatter walls off, and `verify` asserts it afterwards
    rather than trusting it.

WHAT IS NEW HERE IS THE DIRECTION THE DRESSING RUNS. On Crete the camp at the
mouth of the labyrinth is a breather — somewhere to sit down before you go in.
That is exactly wrong for this island, because the hole in the ground is the
enemy's own heart and the walk toward it is supposed to get worse. So the two
are swapped: the breather is at the ARRIVAL pad, where you land, and the orc
camps — tents, fires, totems, bone — thicken toward the descent along with the
ranks. By the time the ground under you is nothing but campfire and skull pole
you are being told the same thing Chronos says out loud: this is no longer a
camp, it is an army.
"""
import math
import random
import sys
import xml.etree.ElementTree as ET
from collections import deque

SRC = sys.argv[1] if len(sys.argv) > 1 else "/mnt/user-data/uploads"
TILE = 32
RNG = random.Random(20250907)

# ------------------------------------------------------------------ input


def load_layers(path):
    m = ET.parse(path).getroot()
    W, H = int(m.get("width")), int(m.get("height"))
    out = []
    for l in m.findall("layer"):
        txt = l.find("data").text.replace("\n", "").replace("\r", "").strip().rstrip(",")
        out.append((l.get("name"), [int(v) for v in txt.split(",")]))
    return W, H, out


def collision(path, floor_layers, open_layers):
    """Land/solid grids. `floor_layers` name the layers that MAKE ground and
    `open_layers` the ones that are decoration over it; everything else seals.

    Two maps, two conventions, one function. The island's ground is `wyspa`
    with `woda` painted under it; the hall's is `podloga` with three rock
    layers over it, and one of those rock layers is spelled with a Polish ł
    and one without. Naming the floor and the see-through layers explicitly is
    what stops a re-export renaming a rock layer into walkable ground.
    """
    W, H, layers = load_layers(path)
    land = [[False] * W for _ in range(H)]
    solid = [[False] * W for _ in range(H)]
    seen = {n for n, _ in layers}
    for n in floor_layers + open_layers:
        assert n in seen, f"{path}: expected a layer named {n!r}, found {sorted(seen)}"
    for y in range(H):
        for x in range(W):
            i = y * W + x
            for n, v in layers:
                if not v[i]:
                    continue
                if n in floor_layers:
                    land[y][x] = True
                elif n in open_layers:
                    pass
                else:
                    solid[y][x] = True
    return W, H, land, solid


def wet_paint(png_path, W, H):
    """Per tile: is the terrain EXPORT majority water there?

    The sea in this export is the same dark desaturated blue as Crete's and
    the land is olive, so "blue channel wins" survives the water's tile
    variants and the shore's dither without pinning an exact colour.
    """
    from PIL import Image
    px = Image.open(png_path).convert("RGB").load()
    out = [[False] * W for _ in range(H)]
    for ty in range(H):
        for tx in range(W):
            wet = 0
            for dy in range(0, TILE, 4):
                for dx in range(0, TILE, 4):
                    r, g, b = px[tx * TILE + dx, ty * TILE + dy]
                    if b > g and b > r:
                        wet += 1
            out[ty][tx] = wet > 32     # of 64 samples
    return out


def bfs(W, H, blocked, starts):
    d = [[-1] * W for _ in range(H)]
    q = deque()
    for sx, sy in starts:
        d[sy][sx] = 0
        q.append((sx, sy))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and d[ny][nx] < 0 and not blocked[ny][nx]:
                d[ny][nx] = d[y][x] + 1
                q.append((nx, ny))
    return d


# --------------------------------------------------------------- geometry
# Mirrors gfx/sceneryArt.ts. Kept here rather than imported because this is a
# build script and that is the runtime; the smoke suite holds the two equal.
FOOT = {"deadTree": (1, 1), "felledTree": (1, 1), "skullPole": (1, 1),
        "boulderA": (2, 1), "boulderB": (2, 1), "tent": (2, 2), "well": (2, 2)}
SPILL = {"deadTree": (2, 1), "felledTree": (1, 1), "skullPole": (1, 0),
         "boulderA": (1, 0), "boulderB": (1, 0), "tent": (0, 0), "well": (0, 0)}
SPILL_TREE = (1, 0)


def painted(kind, tx, ty):
    fw, fh = FOOT[kind]
    up, side = SPILL[kind]
    return [(x, y) for y in range(ty - up, ty + fh)
            for x in range(tx - side, tx + fw + side)]


def sealed(kind, tx, ty):
    fw, fh = FOOT[kind]
    return [(x, ty + fh - 1) for x in range(tx, tx + fw)]


# ----------------------------------------------------------------- output

def emit(rows, indent="    "):
    return "\n".join(f'{indent}"{r}",' for r in rows)


# Glyphs `handmade.ts` handles in its OWN switch, before a spec's `monsters`,
# `scenery` or `portals` maps are consulted. Naming one of these in a spec map
# does not raise — the parser simply does something else with it and the thing
# you meant is silently absent. `B` cost this file a whole rank of berserkers
# on both maps with every test still green, which is exactly the failure a
# build script should refuse to ship.
RESERVED = set("#$,=BFHMRTo~.")


def check_glyphs(rows, mapped, name):
    used = {c for r in rows for c in r}
    clash = sorted(mapped & RESERVED & used)
    assert not clash, f"{name}: {clash} are parser glyphs, not spec glyphs"
    missing = sorted(mapped - used)
    assert not missing, f"{name}: {missing} declared but never placed"


# `W` is deliberately NOT here. It is the pad home, and a pad is somewhere you
# stand — listing it as a prop would make `verify` flood around it and report
# the one square of the map the mission most depends on as unreachable.
PROP_GLYPHS = set("TRQqVvYN$x#~")


def relieve_pockets(grid, W, H, start, seal=None):
    """Take props back out until every open square is reachable again."""
    seal = {} if seal is None else seal
    removed = 0
    for _ in range(400):
        blk = [[grid[y][x] in PROP_GLYPHS or (x, y) in seal for x in range(W)]
               for y in range(H)]
        d = bfs(W, H, blk, [start])
        pocket = [(x, y) for y in range(H) for x in range(W)
                  if not blk[y][x] and d[y][x] < 0]
        if not pocket:
            return removed
        rim = []
        for x, y in pocket:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < W and 0 <= ny < H):
                    continue
                if (nx, ny) in seal:
                    gx, gy = seal[(nx, ny)]
                    rim.append((gy, gx))
                elif grid[ny][nx] in "TRVv":
                    rim.append((ny, nx))
        if not rim:
            return removed          # sealed by terrain, not by us
        ry, rx = sorted(rim)[0]
        grid[ry][rx] = "."
        for cell, owner in [(c, o) for c, o in seal.items() if o == (rx, ry)]:
            del seal[cell]
        removed += 1
    return removed


def verify(rows, W, H, doors, name, seal=()):
    blk = [[rows[y][x] in PROP_GLYPHS or (x, y) in seal for x in range(W)]
           for y in range(H)]
    total = sum(1 for y in range(H) for x in range(W) if not blk[y][x])
    d = bfs(W, H, blk, [doors[0][1]])
    reach = sum(1 for y in range(H) for x in range(W) if d[y][x] >= 0)
    assert all(len(r) == W for r in rows), f"{name}: ragged rows"
    assert reach == total, f"{name}: {total - reach} squares walled off"
    print(f"  {name}: {total} open squares, all reachable")
    for label, (dx, dy) in doors[1:]:
        # A chest is a structure and stands on a sealed square, so measuring TO
        # it reports -1 and says nothing. Fall back to the nearest square you
        # could stand on to open it, which is the number anybody actually wants.
        best = d[dy][dx]
        if best < 0:
            near = [d[dy + oy][dx + ox] for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                    if 0 <= dx + ox < W and 0 <= dy + oy < H and d[dy + oy][dx + ox] >= 0]
            best = min(near) if near else -1
        assert best >= 0, f"{name}: {label} cannot be reached from {doors[0][0]}"
        print(f"      {label}: {best} tiles of walking from {doors[0][0]}")
    return total


def hex_scatter(cands, n, gap, anchor, jitter=3):
    """Post placement: a hexagonal lattice at `gap` spacing, each slot nudged
    onto the nearest legal square within `jitter`.

    NOT MAXIMIN, WHICH IS WHAT EVERY GROUND BEFORE THIS ONE USED, and the
    reason is arithmetic rather than taste. Farthest-point sampling places each
    new post as far as it can from everything already down, which pushes the
    early ones into the corners and leaves the middle carved into pockets too
    small to hold another. On this island it ran out at FIFTY-NINE posts and
    could not be persuaded to seat a sixtieth without dropping the nine-tile
    rule — on six and a half thousand legal squares, where hexagonal packing at
    nine has room for ninety. A hex lattice with a small jitter seats seventy
    with the rule intact, and seventy is the number the island was designed to
    carry.

    IT IS STILL A SCATTER AND NOT A GRID, on screen. Nine tiles is 288 pixels,
    so two posts are rarely both on the same screen; the jitter breaks the rows
    for the case where they are; and the wood, stone and camps that go down
    afterwards are placed by RNG and are what the eye actually reads.

    Deterministic: the lattice is walked in reading order and ties inside the
    jitter window are broken by distance and then by coordinate, so there is no
    RNG in here at all.
    """
    cs = set(cands)
    xs = [c[0] for c in cands]
    ys = [c[1] for c in cands]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    # The anchor goes down first and outranks the lattice, so the heaviest end
    # of the ladder is nailed to the door the gradient is measured from.
    picked = [anchor]
    row_h = gap * math.sqrt(3) / 2
    slots = []
    row, y = 0, float(y0)
    while y <= y1:
        x = x0 + (gap / 2 if row % 2 else 0)
        while x <= x1:
            slots.append((int(round(x)), int(round(y))))
            x += gap
        y += row_h
        row += 1
    for sx, sy in slots:
        if len(picked) >= n:
            break
        best, bestd = None, None
        for dy in range(-jitter, jitter + 1):
            for dx in range(-jitter, jitter + 1):
                c = (sx + dx, sy + dy)
                if c not in cs or c in picked:
                    continue
                if any((c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 < gap * gap for p in picked):
                    continue
                d = dx * dx + dy * dy
                if bestd is None or d < bestd or (d == bestd and c < best):
                    best, bestd = c, d
        if best:
            picked.append(best)
    return picked


# ======================================================================= #
#  THE ORC ISLE — the hunting ground                                      #
# ======================================================================= #
#
# The export has NO object layer, so unlike every mission ground before it the
# two doors are chosen here rather than read off the picture. Both are picked
# to the same rule the traced ones happened to satisfy: four clear squares of
# land in every direction, and as far apart as the island allows.
#
#   the pad back to the cellar   (22,11)  north-west shoulder, 2x2
#   the descent to Gorak         (86,84)  south-east, the far corner
#
# A hundred and thirty-seven tiles of walking between them — longer than
# Crete's hundred and fourteen, which is right: this island is seven and a
# half thousand squares against Crete's five, and it is the ground behind the
# chain's highest door so far.
#
# WHO LIVES HERE. Five ranks, all of them orcs, because this island is the
# errand's whole argument: they are gathering, and a sellsword or a horn on it
# would say they are not.
#
#   r orc          tier 25, exp 215 — the shallow end, and the bulk
#   c orcArcher    tier 25, exp 280 — the only ranged rank
#   e orcWarrior   tier 28, exp 295 — thickens toward the descent
#   S orcShaman    tier 27, exp 440 — exactly ONE
#   k orcBerserker tier 36, exp 460 — exactly ONE, nearest the hole
#
# THE BERSERKER IS `k`, NOT `B`, and that is not a style choice. `B` is a
# BUILD SPOT in `handmade.ts` — it is handled by the parser's own switch
# before a spec's `monsters` map is ever consulted, so a `B` in these rows
# does not fail loudly, it silently places a plot of empty ground where a
# creature should stand. The first cut of this file used `B` and both maps
# came out one rank short with every test still green.
#
# ONE BERSERKER AND ONE SHAMAN IS RADEK'S CAP AND IT IS ALSO THE FICTION. The
# whole point of the errand is that the ranks have not been gathered yet: what
# is on the island is the tribes still walking in. The heavy things are down
# the hole with the man who called them.
DOOR_PAD = (22, 11)
DOOR_HOLE = (86, 84)
N_POSTS = 70
POST_GAP = 9             # nothing pulls two at once
DOOR_CLEAR = 8           # aggro range plus two
# The breather, and it is at the PAD rather than at the hole — Crete's camp
# inverted, for the reason in the module header. It is a clearance point as
# well as scenery: nothing hostile may stand inside aggro of the fire either.
CAMP_FIRE = (26, 14)


def build_orc_isle():
    W, H, land, solid = collision(f"{SRC}/orkipowieschnia.tmx",
                                  floor_layers=["wyspa"], open_layers=["woda"])
    wet = wet_paint("public/orcisle-terrain.png", W, H)
    walk = lambda x, y: 0 <= x < W and 0 <= y < H and land[y][x] and not solid[y][x]

    def dry(x, y):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < W and 0 <= ny < H):
                    return False
                if not land[ny][nx] or wet[ny][nx]:
                    return False
        return True

    grid = [["~" if not land[y][x] else ("x" if solid[y][x] else ".") for x in range(W)]
            for y in range(H)]

    blk = [[not walk(x, y) for x in range(W)] for y in range(H)]
    fromHole = bfs(W, H, blk, [DOOR_HOLE])

    def far_from_doors(x, y):
        return ((x - DOOR_PAD[0]) ** 2 + (y - DOOR_PAD[1]) ** 2 >= DOOR_CLEAR ** 2
                and (x - DOOR_PAD[0] - 1) ** 2 + (y - DOOR_PAD[1] - 1) ** 2 >= DOOR_CLEAR ** 2
                and (x - DOOR_HOLE[0]) ** 2 + (y - DOOR_HOLE[1]) ** 2 >= DOOR_CLEAR ** 2
                and (x - CAMP_FIRE[0]) ** 2 + (y - CAMP_FIRE[1]) ** 2 >= DOOR_CLEAR ** 2)

    # --- creature posts ----------------------------------------------------
    # THE GRADIENT RUNS BY WALKING DISTANCE FROM THE DESCENT, not in a straight
    # line and not from the pad. Radek's ask was "the closer to the descent the
    # stronger"; this is that ask expressed the way every other mission ground
    # expresses difficulty, and a straight-line ranking would pass a weaker
    # test than the one in the suite.
    cands = [(x, y) for y in range(H) for x in range(W)
             if walk(x, y) and dry(x, y) and far_from_doors(x, y) and fromHole[y][x] >= 0]
    anchor = min(cands, key=lambda c: (fromHole[c[1]][c[0]], c))
    posts = hex_scatter(cands, N_POSTS, POST_GAP, anchor, jitter=2)
    assert len(posts) == N_POSTS, f"only seated {len(posts)} of {N_POSTS} posts"
    posts.sort(key=lambda p: (fromHole[p[1]][p[0]], p))
    ranks = (["k"] * 1 + ["S"] * 1 + ["e"] * 20 + ["c"] * 20
             + ["r"] * (N_POSTS - 42))
    assert len(ranks) == N_POSTS
    post_at = {}
    for p, r in zip(posts, ranks):
        grid[p[1]][p[0]] = r
        post_at[p] = r

    # --- props -------------------------------------------------------------
    taken = set()          # every square any prop PAINTS
    seal = {}              # square a prop SEALS -> the square its glyph is on
    for p in posts:
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                taken.add((p[0] + dx, p[1] + dy))
    for dx in range(-4, 6):
        for dy in range(-4, 6):
            taken.add((DOOR_PAD[0] + dx, DOOR_PAD[1] + dy))
            taken.add((DOOR_HOLE[0] + dx, DOOR_HOLE[1] + dy))

    def place(kind, glyph, tx, ty):
        """Stand one object on (tx,ty), or refuse and change nothing.

        THE GLYPH IS WRITTEN ONCE, at the object's top-left square, because
        that is what `handmade.ts` reads: a 2x1 boulder is ONE glyph and the
        parser seals the rest of its block itself."""
        cells = painted(kind, tx, ty) if kind in FOOT else [(tx, ty), (tx, ty - 1)]
        blocks = sealed(kind, tx, ty) if kind in FOOT else [(tx, ty)]
        for cx, cy in cells:
            if not (0 <= cx < W and 0 <= cy < H) or (cx, cy) in taken:
                return False
            if solid[cy][cx] or not dry(cx, cy):
                return False
        for cx, cy in blocks:
            if grid[cy][cx] != "." or (cx, cy) in seal:
                return False
        for cx, cy in cells:
            taken.add((cx, cy))
        for cx, cy in blocks:
            seal[(cx, cy)] = (tx, ty)
        grid[ty][tx] = glyph
        return True

    # --- the breather at the pad -------------------------------------------
    # Two tents and a fire a few squares off where you land, with nothing
    # hostile inside its aggro. Somewhere to sit, eat, and then start walking.
    for glyph, tx, ty in (("N", 24, 14), ("F", CAMP_FIRE[0], CAMP_FIRE[1]),
                          ("N", 28, 14), ("o", 24, 17)):
        if glyph == "N":
            place("tent", glyph, tx, ty)
        else:
            grid[ty][tx] = glyph
            taken.add((tx, ty))   # a fire and a bone pile seal nothing

    # THE CAMPS GO DOWN BEFORE THE WOOD, and that ordering is load-bearing.
    # They used to run last, after four hundred dead trees had each painted a
    # 3x3 of clearance across the island, and the result was THREE tents on a
    # map that is supposed to be an army gathering — a 2x2 footprint simply
    # could not find open ground any more. It is also the truer order: the
    # camps are the REASON the wood is dead, so they choose their ground first
    # and the trees fill in around them.
    # THE CAMPS THICKEN TOWARD THE DESCENT — totems, fires and tents, weighted
    # by walking distance from the hole rather than scattered flat. This is the
    # island saying what Chronos says: near the shore it is a few war-bands,
    # and by the time you can see the descent it is one host.
    # SQUARED FALLOFF, not linear. The island is a hundred and thirty-seven
    # tiles across and there is far more of it far from the hole than near it,
    # so a linear weight still puts most of the camp out on the shore where it
    # says nothing — the first cut came out at a mean of 63 tiles against the
    # island's own average of 66, which is not a gradient, it is a rounding
    # error. Squaring it makes the near half actually crowded.
    def near(x, y, reach):
        d = fromHole[y][x]
        if d < 0:
            return False
        w = max(0.0, 1.0 - d / reach)
        return RNG.random() < max(0.02, w * w)
    camps = 0
    for kind, glyph, want, reach in (("skullPole", "Y", 26, 110),
                                     ("tent", "N", 14, 90)):
        got = 0
        for _ in range(30000):
            if got >= want:
                break
            x, y = RNG.randrange(W), RNG.randrange(H)
            if grid[y][x] != "." or not near(x, y, reach):
                continue
            if place(kind, glyph, x, y):
                got += 1
        camps += got
    fires = 0
    for _ in range(40000):
        if fires >= 34:
            break
        x, y = RNG.randrange(W), RNG.randrange(H)
        if grid[y][x] != "." or (x, y) in taken or not near(x, y, 100):
            continue
        grid[y][x] = "F"
        taken.add((x, y))
        fires += 1

    # Bone thickens the same way, and for the same reason it does on Crete —
    # somebody has been feeding this gathering. Decor only: bones seal nothing.
    bones = 0
    for _ in range(30000):
        if bones >= 80:
            break
        x, y = RNG.randrange(W), RNG.randrange(H)
        if grid[y][x] != "." or (x, y) in taken or not near(x, y, 130):
            continue
        grid[y][x] = "o"
        taken.add((x, y))
        bones += 1


    # THE WOOD ON THIS ISLAND IS MOSTLY DEAD, and that is the note Radek came
    # back with after walking it: too much green for orc country. It is the
    # right note. The five ranks below have been felling, burning and camping
    # across this ground long enough to have used it up, and a full leafy
    # canopy says nobody has been here — which is the exact opposite of what
    # the errand is about.
    #
    # So the proportion is INVERTED against Crete's. Bare trunks are the
    # default cover, green stands are the exception, and the felled stumps
    # scattered between them are the reason for both.
    #
    # STILL IN STANDS, NOT WALLPAPER. Dry woodland grows in stands exactly as
    # live woodland does, and an even sprinkle over seven thousand squares
    # reads as texture rather than as country — the note Calanais got in Etap
    # 51 and Crete got again in Etap 53.

    def stands(n, spacing):
        """Deterministic clump centres, no two closer than `spacing`."""
        out = []
        for _ in range(9000):
            if len(out) >= n:
                break
            x, y = RNG.randrange(W), RNG.randrange(H)
            if not (walk(x, y) and dry(x, y)):
                continue
            if any((x - c[0]) ** 2 + (y - c[1]) ** 2 < spacing * spacing for c in out):
                continue
            out.append((x, y))
        return out

    # Dead wood first, and it gets the pick of the ground. A dead tree paints a
    # 3x3 of clearance where a live one paints two squares — the trunk is 46x72
    # and spills forty pixels above its own tile — so if the green went down
    # first there would be nowhere left to stand the bare ones.
    dead = 0
    for cx, cy in stands(38, 12):
        for _ in range(60):
            x, y = cx + RNG.randint(-4, 4), cy + RNG.randint(-4, 4)
            if not (0 <= x < W and 0 <= y < H) or grid[y][x] != ".":
                continue
            if RNG.random() < 0.55 and place("deadTree", "V", x, y):
                dead += 1
    for _ in range(40000):
        if dead >= 430:
            break
        x, y = RNG.randrange(W), RNG.randrange(H)
        if grid[y][x] == "." and place("deadTree", "V", x, y):
            dead += 1

    # …and the green that is left, in a handful of hollows. Few enough that
    # coming over a rise into one of them is worth something.
    trees = 0
    for cx, cy in stands(7, 22):
        for _ in range(70):
            x, y = cx + RNG.randint(-3, 3), cy + RNG.randint(-3, 3)
            if not (0 <= x < W and 0 <= y < H) or grid[y][x] != ".":
                continue
            if RNG.random() < 0.6 and place("tree", "T", x, y):
                trees += 1
    for _ in range(9000):
        if trees >= 95:
            break
        x, y = RNG.randrange(W), RNG.randrange(H)
        if grid[y][x] == "." and place("tree", "T", x, y):
            trees += 1

    # The stumps that explain both. They go down HERE rather than with the
    # boulders below, because by the time the scenery pass runs the ground is
    # already spoken for and the felled wood was coming out at a third of what
    # it asked for — which left the island covered in dead trees with nothing
    # saying why they are dead.
    felled = 0
    for _ in range(20000):
        if felled >= 70:
            break
        x, y = RNG.randrange(W), RNG.randrange(H)
        if grid[y][x] == "." and place("felledTree", "v", x, y):
            felled += 1

    # STONE, over the whole of it. The orcish line is iron and this is where it
    # comes out of, so an island worth walking repeatedly has to be worth more
    # than experience.
    rocks = 0
    for _ in range(14000):
        if rocks >= 130:
            break
        x, y = RNG.randrange(W), RNG.randrange(H)
        if grid[y][x] == "." and place("rock", "R", x, y):
            rocks += 1

    scen = 0
    for kind, glyph, want in (("boulderA", "Q", 22), ("boulderB", "q", 18)):
        got = 0
        for _ in range(14000):
            if got >= want:
                break
            x, y = RNG.randrange(W), RNG.randrange(H)
            if grid[y][x] == "." and place(kind, glyph, x, y):
                got += 1
        scen += got

    freed = relieve_pockets(grid, W, H, DOOR_HOLE, seal)

    # the doors last, so nothing can have been painted over one
    grid[DOOR_PAD[1]][DOOR_PAD[0]] = "P"
    grid[DOOR_HOLE[1]][DOOR_HOLE[0]] = "D"

    rows = ["".join(r) for r in grid]
    check_glyphs(rows, set("rceSkQqVvNYPD"), "the Orc Isle")
    verify(rows, W, H, [("the pad", DOOR_PAD), ("the descent", DOOR_HOLE)],
           "the Orc Isle", seal)
    print(f"      {dead} dead + {trees} green + {felled} felled wood,"
          f" {rocks} stone, {scen} standing props, {camps} camp props,"
          f" {fires} fires, {bones} bone piles, {len(posts)} posts;"
          f" {freed} props lifted to drain pockets")
    return rows, posts, post_at, dead, trees, rocks, scen


# ======================================================================= #
#  GORAK'S HALL — the echo                                                #
# ======================================================================= #
#
# THE EXPORT IS ONE ROOM, and a very particular one: twenty-four squares wide
# and eighty-three long, walled in rock on all four sides, with nothing in it.
# Not a maze, not a chamber — a hall you walk the length of. Radek's note says
# "Gorak at the very end of the corridor and orc warriors and berserkers on
# the way", and that is exactly what the shape is for.
#
# SO THIS ECHO IS THE OPPOSITE OF THE LABYRINTH'S, on purpose. Down there the
# walk IS the encounter and nothing else is alive; here the walk is a straight
# line you can see the whole of, and what makes it long is that his army is
# standing in it. You cannot get lost. You can only get tired.
#
# NINE TILES BETWEEN POSTS STILL HOLDS, which matters more in an open hall
# than it does anywhere else in the game: there is no corridor wall to break
# line of sight, so spacing is the only thing that keeps a pull to one
# creature. Gorak carries a wider clearance than the ranks do, so the last
# berserker cannot be fought inside his aggro.
HALL_UP = (19, 10)       # back up to the isle
HALL_BOSS = (19, 85)
HALL_CHEST = (14, 85)
HALL_HOME = (14, 87)     # the relic road, dark until he falls
N_HALL_POSTS = 22
BOSS_CLEAR = 11


def build_gorak_hall():
    W, H, land, solid = collision(
        f"{SRC}/orkiboss-1.tmx", floor_layers=["podloga"], open_layers=[])
    grid = [["#" if not land[y][x] else ("x" if solid[y][x] else "=") for x in range(W)]
            for y in range(H)]
    walk = lambda x, y: 0 <= x < W and 0 <= y < H and land[y][x] and not solid[y][x]
    blk = [[not walk(x, y) for x in range(W)] for y in range(H)]
    fromBoss = bfs(W, H, blk, [HALL_BOSS])
    fromUp = bfs(W, H, blk, [HALL_UP])

    def clear_of_doors(x, y):
        return ((x - HALL_UP[0]) ** 2 + (y - HALL_UP[1]) ** 2 >= DOOR_CLEAR ** 2
                and (x - HALL_BOSS[0]) ** 2 + (y - HALL_BOSS[1]) ** 2 >= BOSS_CLEAR ** 2
                and (x - HALL_CHEST[0]) ** 2 + (y - HALL_CHEST[1]) ** 2 >= DOOR_CLEAR ** 2
                and (x - HALL_HOME[0]) ** 2 + (y - HALL_HOME[1]) ** 2 >= DOOR_CLEAR ** 2)

    cands = [(x, y) for y in range(H) for x in range(W)
             if walk(x, y) and clear_of_doors(x, y) and fromBoss[y][x] >= 0]
    anchor = min(cands, key=lambda c: (fromBoss[c[1]][c[0]], c))
    posts = hex_scatter(cands, N_HALL_POSTS, POST_GAP, anchor, jitter=3)
    assert len(posts) == N_HALL_POSTS, f"only seated {len(posts)} of {N_HALL_POSTS} posts"
    posts.sort(key=lambda p: (fromBoss[p[1]][p[0]], p))
    # BERSERKERS HOLD THE FAR THIRD. The ranks are sorted by walking distance
    # from Gorak and the nearest third are the heavy ones, so the hall gets
    # harder in exactly the direction you are walking. Above ground he was
    # allowed one berserker; down here they are what he has been collecting.
    n_bers = 8
    ranks = ["k"] * n_bers + ["e"] * (N_HALL_POSTS - n_bers)
    post_at = {}
    for p, r in zip(posts, ranks):
        grid[p[1]][p[0]] = r
        post_at[p] = r

    taken = set()
    seal = {}
    for p in posts:
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                taken.add((p[0] + dx, p[1] + dy))
    for pt in (HALL_UP, HALL_BOSS, HALL_CHEST, HALL_HOME):
        for dx in range(-4, 5):
            for dy in range(-4, 5):
                taken.add((pt[0] + dx, pt[1] + dy))

    def place(kind, glyph, tx, ty):
        cells = painted(kind, tx, ty) if kind in FOOT else [(tx, ty), (tx, ty - 1)]
        blocks = sealed(kind, tx, ty) if kind in FOOT else [(tx, ty)]
        for cx, cy in cells:
            if not (0 <= cx < W and 0 <= cy < H) or (cx, cy) in taken:
                return False
            if not walk(cx, cy):
                return False
        for cx, cy in blocks:
            if grid[cy][cx] != "=" or (cx, cy) in seal:
                return False
        for cx, cy in cells:
            taken.add((cx, cy))
        for cx, cy in blocks:
            seal[(cx, cy)] = (tx, ty)
        grid[ty][tx] = glyph
        return True

    # NO TREES DOWN HERE — Radek's rule, and the obvious one: nothing grows in
    # a hall cut out of rock. Stone does both jobs instead, because he asked
    # for both: `R` nodes you can actually work, and boulders that are only
    # ever scenery. The first echo in the game to carry mineable stone, and it
    # earns it — this is one long walk with no way to restock on it.
    rocks = 0
    for _ in range(20000):
        if rocks >= 34:
            break
        x, y = RNG.randrange(W), RNG.randrange(H)
        if grid[y][x] == "=" and place("rock", "R", x, y):
            rocks += 1
    scen = 0
    for kind, glyph, want in (("boulderA", "Q", 16), ("boulderB", "q", 14)):
        got = 0
        for _ in range(20000):
            if got >= want:
                break
            x, y = RNG.randrange(W), RNG.randrange(H)
            if grid[y][x] == "=" and place(kind, glyph, x, y):
                got += 1
        scen += got

    # HIS OWN CAMP, at the far end. Totems and fires close in around the last
    # thirty tiles: the hall stops being a tunnel and starts being a hall
    # somebody lives at the end of.
    camps = 0
    for kind, glyph, want in (("skullPole", "Y", 18), ("tent", "N", 8)):
        got = 0
        for _ in range(20000):
            if got >= want:
                break
            x, y = RNG.randrange(W), RNG.randrange(H)
            if grid[y][x] != "=" or fromBoss[y][x] < 0:
                continue
            if RNG.random() > max(0.02, 1.0 - fromBoss[y][x] / 46):
                continue
            if place(kind, glyph, x, y):
                got += 1
        camps += got
    # FIRE IS WHAT THIS ROOM IS LIT BY, and there is a lot more of it than
    # there was — Radek's note, and especially down here. Eight of them lit
    # Gorak's own end and left seventy tiles of the approach in the dark,
    # which read as an empty corridor rather than as somewhere an army is
    # camped. Twenty-eight, and the floor is 0.12 rather than 0.02: they still
    # crowd his end, but the whole length of the walk has something burning on
    # it now. A hall you can see the far end of should look occupied all the
    # way down it.
    fires = 0
    for _ in range(40000):
        if fires >= 28:
            break
        x, y = RNG.randrange(W), RNG.randrange(H)
        if grid[y][x] != "=" or (x, y) in taken or fromBoss[y][x] < 0:
            continue
        if RNG.random() > max(0.12, 1.0 - fromBoss[y][x] / 46):
            continue
        grid[y][x] = "F"
        taken.add((x, y))
        fires += 1

    # Bone the other way about: thickest at the ENTRANCE, thinning as you go.
    # What is at this end of the hall is what his army has already been fed;
    # the far end is where it is still being brought.
    bones = 0
    for _ in range(30000):
        if bones >= 44:
            break
        x, y = RNG.randrange(W), RNG.randrange(H)
        if grid[y][x] != "=" or (x, y) in taken or fromUp[y][x] < 0:
            continue
        if RNG.random() > max(0.05, 1.0 - fromUp[y][x] / 70):
            continue
        grid[y][x] = "o"
        taken.add((x, y))
        bones += 1

    freed = relieve_pockets(grid, W, H, HALL_UP, seal)

    grid[HALL_BOSS[1]][HALL_BOSS[0]] = "X"
    grid[HALL_CHEST[1]][HALL_CHEST[0]] = "$"
    grid[HALL_HOME[1]][HALL_HOME[0]] = "W"
    grid[HALL_UP[1]][HALL_UP[0]] = "U"

    rows = ["".join(r) for r in grid]
    check_glyphs(rows, set("ekXQqNYUW"), "Gorak's hall")
    verify(rows, W, H, [("the way up", HALL_UP), ("Gorak", HALL_BOSS),
                        ("the hoard", HALL_CHEST), ("the pad home", HALL_HOME)],
           "Gorak's hall")
    print(f"      {rocks} stone, {scen} boulders, {camps} camp props, {fires} fires,"
          f" {bones} bone piles, {len(posts)} posts ({n_bers} berserkers);"
          f" {freed} props lifted to drain pockets")
    return rows, posts, post_at, rocks, scen


# ======================================================================= #
#  WRITING THE TWO SPECS                                                  #
# ======================================================================= #
# The prose headers live here rather than in the generated files, because a
# generated file is overwritten and a comment inside one would be lost the
# first time anybody re-ran this.

ISLE_HEAD = '''/**
 * The Orc Isle — the Time Sage's SIXTH mission ground, and the island Gorak's
 * hall is cut into.
 *
 * Traced from `orkipowieschnia.tmx` (110x110) and drawn from
 * `public/orcisle-terrain.png`, the same file's image export at native tile
 * size. Collision by exclusion, the house rule: the `wyspa` layer says where
 * land is and nothing else seals anything — this export has no rock layers at
 * all, only a coastline.
 *
 * GENERATED. Do not hand-edit this file — `tools/gen_orc_maps.py` writes it
 * whole from the export and the picture, and it will do so again.
 *
 * THE TWO ENDS ARE CHOSEN HERE, which is a first. Every mission ground before
 * this one carried an object layer with its doors painted into it; this export
 * has none, so the pad and the descent are picked by the generator to the same
 * rule the traced ones happened to meet — four clear squares of land in every
 * direction, and as far apart as the island allows. The pad back to the cellar
 * sits on the north-west shoulder at (22,11) and the descent in the south-east
 * corner at (86,84). That is a hundred and thirty-seven tiles of WALKING
 * between them, over Crete's hundred and fourteen, which is the right way
 * round: this island is seven and a half thousand squares against Crete's five
 * and it is behind the highest door the chain has opened.
 *
 * WHO LIVES HERE, and why all five ranks are orcs. The errand's whole argument
 * is that they are GATHERING. A sellsword or a minotaur on this island would
 * say that it is somewhere orcs happen to be, and it is not — it is where they
 * are all walking to.
 *
 *   r orc          tier 25, 215 exp — the shallow end, and the bulk of it
 *   c orcArcher    tier 25, 280 exp — the only RANGED rank here
 *   e orcWarrior   tier 28, 295 exp — thickening toward the descent
 *   S orcShaman    tier 27, 440 exp — exactly ONE
 *   k orcBerserker tier 36, 460 exp — exactly ONE, and nearest the hole
 *
 * THE BERSERKER IS `k` AND NOT `B`, which is not a style choice. `handmade.ts`
 * handles `B` in its own switch as a BUILD SPOT, before a spec's `monsters`
 * map is ever consulted, so a berserker written as `B` does not fail — it
 * silently becomes a plot of empty ground. The first cut of this map shipped
 * a rank short that way with every test green.
 *
 * ONE BERSERKER AND ONE SHAMAN. That is Radek's cap and it is also the story:
 * what is on the island is the tribes still arriving, and the heavy things are
 * already down the hole with the man who called them. An island fielding a
 * dozen berserkers would have answered the question the errand is asking.
 *
 * THE GRADIENT RUNS BY WALKING DISTANCE FROM THE DESCENT, not from the pad and
 * not in a straight line. Seventy posts on a hexagonal lattice with a small
 * jitter — maximin, which every ground before this one used, ran out at
 * fifty-nine on six and a half thousand legal squares — sorted by BFS distance from the hole and cut into bands: the
 * berserker is the nearest post to it, the shaman behind him, then twenty
 * warriors, twenty archers, and twenty-eight plain orcs holding the far half
 * of the island. Nothing stands within nine tiles of another post, comfortably
 * over the eight the aggro range asks for, and nothing stands within eight of
 * either door.
 *
 * THE BREATHER IS AT THE PAD, WHICH INVERTS CRETE. There the camp sits at the
 * mouth of the labyrinth, somewhere to sit down before you go in. That is
 * exactly wrong here, because the hole in the ground is the enemy's own heart
 * and the walk toward it is meant to get worse — so the tents and the fire you
 * can rest at are where you LAND, and the orc camps run the other way.
 *
 * THE CAMPS THICKEN TOWARD THE DESCENT. Totems, fires, tents and bone, all
 * weighted by walking distance from the hole rather than scattered flat, and
 * on a SQUARED falloff — there is far more island far from the hole than near
 * it, so a linear weight put most of the camp out on the shore where it said
 * nothing. Near the coast it reads as a few war-bands; by the time the descent
 * is in sight it reads as one host. The island says what Chronos says out loud.
 *
 * AND THE WOOD IS MOSTLY DEAD, which is the note Radek came back with after
 * walking it: too much green for orc country. Three hundred bare trunks
 * against ninety-five leafy ones and seventy stumps — dry woodland is the
 * default cover here and the green stands are the exception, because five
 * ranks have been felling, burning and camping across this ground long enough
 * to use it up. A full canopy would say nobody has been here, which is the
 * opposite of the errand.
 *
 * THE CAMPS ARE PLACED BEFORE THE WOOD, and that ordering is load-bearing. Run
 * the other way round, four hundred dead trees paint a 3x3 of clearance apiece
 * and a tent's 2x2 footprint can no longer find open ground: the island came
 * out with THREE tents on it. It is also the truer order — the camps are the
 * reason the wood is dead, so they choose their ground first.
 *
 * THE DESCENT IS A MISSION DOOR. It ships dormant and `applyMissionPads` puts
 * it to sleep whenever the echo behind it is not enterable — dark before
 * Chronos speaks and dark again once the tusk is on his table.
 *
 *   P pad back to the cellar (2x2)   D down into Gorak's hall
 *   V dead tree (the default cover)   T green wood   v stump
 *   R stone   Q q boulder
 *   N tent   F campfire   Y totem   o bones   x crag (impassable, drawn)
 *   creatures: r orc   c archer   e warrior   S shaman   k berserker
 */
import type { HandmadeSpec } from "./handmade.ts";
import { Tile } from "./types.ts";

export const ORCISLE_SPEC: HandmadeSpec = {
  key: "orcIsle",
  name: "The Orc Isle",
  safe: false,
  portals: {
    P: { dest: "cellar", label: "back to the Time Sage's cellar", span: 2, floor: Tile.Dirt },
    D: {
      dest: "gorak", label: "down into Gorak's hall",
      style: "caveMouth", floor: Tile.Dirt, inactive: true,
    },
  },
  // Nothing in this export seals a square, so the glyph is here only because
  // the parser wants a `solids` string and a later re-export may well add one.
  solids: "x",
  scenery: { V: "deadTree", v: "felledTree", N: "tent", Y: "skullPole", Q: "boulderA", q: "boulderB" },
  monsters: {
    r: "orc",
    c: "orcArcher",
    e: "orcWarrior",
    S: "orcShaman",
    k: "orcBerserker",
  },
  rows: [
'''

ISLE_TAIL = '''  ],
};
'''

HALL_HEAD = '''/**
 * Gorak's Hall — the cut under the Orc Isle, and the end of the Time Sage's
 * sixth mission.
 *
 * Traced from `orkiboss-1.tmx` (40x100) and drawn from
 * `public/gorak-terrain.png`, the same file's image export. Collision by
 * exclusion, the usual rule: `podloga` is the floor and all three rock layers
 * seal their squares — including the one whose name is spelled with a Polish
 * ł and the one that is not, which is why `collision` is told the floor's name
 * rather than the walls'.
 *
 * GENERATED. Do not hand-edit this file — `tools/gen_orc_maps.py` writes it
 * whole from the export, and it will do so again.
 *
 * IT IS ONE ROOM, AND THAT IS THE POINT. Twenty-four squares wide and
 * eighty-three long, walled in rock on all four sides, with nothing in it but
 * what is put there. Seventy-five tiles from the ladder to the man at the far
 * end.
 *
 * SO IT IS THE LABYRINTH'S OPPOSITE, deliberately. Down there the walk is the
 * encounter and nothing else is alive in four hundred tiles; here you can see
 * the whole length of the room from the ladder, and what makes it long is that
 * his army is standing in it. You cannot get lost. You can only get tired.
 *
 * WHAT IS IN THE WAY. Twenty-two posts, sorted by walking distance from Gorak
 * and banded so the eight berserkers hold the far third and fourteen warriors
 * the near two — the hall gets harder in exactly the direction you are
 * walking. Above ground the errand allows ONE berserker, because the tribes
 * are still arriving; down here they are what he has already collected, and
 * that contrast is the whole errand in two maps.
 *
 * NINE TILES BETWEEN POSTS MATTERS MORE HERE than anywhere else in the game.
 * Every other floor has corridor walls to break line of sight; this one has
 * none, so spacing is the only thing keeping a pull to one creature. Gorak
 * carries a wider clearance than his ranks do, so the last berserker cannot be
 * fought inside his aggro.
 *
 * NO TREES, which is Radek's rule and the obvious one — nothing grows in a
 * hall cut out of rock. Stone does both jobs instead, because he asked for
 * both: `R` nodes that can actually be worked and boulders that are only ever
 * scenery. It is the first echo in the game to carry mineable stone, and it
 * earns it, being one long walk with nowhere on it to restock.
 *
 * AND IT IS LIT ALONG ITS WHOLE LENGTH. Eight fires lit Gorak's own end and
 * left seventy tiles of the approach dark, which read as an empty corridor
 * rather than as somewhere an army is camped; there are twenty-eight now, on a
 * floor high enough that the walk has something burning on it the whole way
 * down. A room you can see the far end of should look occupied all the way to
 * it.
 *
 * THE BONE RUNS BACKWARDS FROM THE CAMPS. Totems and fires thicken toward
 * Gorak, because that is where somebody lives; the bone piles thicken toward
 * the LADDER, because that is what the army has already been fed. The two
 * gradients crossing is what makes the room read as occupied rather than
 * decorated.
 *
 * THE HOARD IS A CHEST, NOT A POCKET, exactly as in the howe, the bower and
 * the labyrinth: he respawns and a chest does not, so routing the payday
 * through his loot table would turn a boss into a press. It sits in open floor
 * with walkable ground on all four sides.
 *
 * THE WAY HOME is dark until he is down, then lit where he fell, so the tusk
 * goes straight to Chronos' table without walking the hall a second time
 * through everything that has respawned in it. `applyMissionPads` owns it: a
 * pad out of an echo to the cellar is the relic road, and it opens on
 * `complete` and on nothing else.
 *
 *   U ladder back up to the isle   W the way home, with the tusk
 *   X Gorak   $ his hoard   R stone   Q q boulder   Y totem   N tent
 *   F campfire   o bones   # rock wall   = hall floor
 *   creatures: e orcWarrior   k orcBerserker
 */
import type { HandmadeSpec } from "./handmade.ts";

export const GORAK_SPEC: HandmadeSpec = {
  key: "gorak",
  name: "Gorak's Hall",
  safe: false,
  portals: {
    U: { dest: "orcIsle", label: "back up to the Orc Isle", style: "ladderUp" },
    W: {
      dest: "cellar", label: "back to Chronos, with the tusk",
      inactive: true,
    },
  },
  solids: "x",
  scenery: { N: "tent", Y: "skullPole", Q: "boulderA", q: "boulderB" },
  monsters: {
    e: "orcWarrior",
    k: "orcBerserker",
    X: "gorak",
  },
  rows: [
'''

HALL_TAIL = '''  ],
};
'''


def main():
    print("tracing the two exports…")
    isle_rows, posts, post_at, dead, trees, rocks, scen = build_orc_isle()
    hall_rows, hposts, hpost_at, hrocks, hscen = build_gorak_hall()

    with open("src/world/orcIsleSpec.ts", "w") as f:
        f.write(ISLE_HEAD + emit(isle_rows) + "\n" + ISLE_TAIL)
    with open("src/world/gorakSpec.ts", "w") as f:
        f.write(HALL_HEAD + emit(hall_rows) + "\n" + HALL_TAIL)
    print("wrote src/world/orcIsleSpec.ts and src/world/gorakSpec.ts")


if __name__ == "__main__":
    main()
