#!/usr/bin/env python3
"""Trace `src/world/creteSpec.ts` and `src/world/labyrinthSpec.ts` out of the
two Tiled files, and dress both maps.

    python3 tools/gen_minotaur_maps.py [dir-with-tmx-and-png]

WHY A SCRIPT AND NOT TWO HAND-TYPED GRIDS. A 100x100 map is ten thousand
glyphs; Crete carries four hundred-odd props and forty-eight creature posts on
top of that. Nobody types that, and nobody re-types it when Radek re-exports.
Edit THIS file and re-run it; do not edit the generated `.ts` by hand.

THE HOUSE RULES IT ENFORCES, every one of them paid for once already:

  * COLLISION BY EXCLUSION. `wyspa` says where land is; every tile layer
    except `woda` and anything beginning `cienie` seals its square.
  * THE COASTLINE IS THE PAINTED ONE. Clearance is measured against the
    terrain PNG's own water pixels, not against the glyph grid — the two
    disagree by about a tile along a hand-drawn shore, which is how Calanais
    ended up with boulders on open sea through two passes that reported clean.
  * A PROP PAINTS MORE THAN IT CLAIMS. Clearance is checked over the
    footprint PLUS the artwork's spill, so a boulder (2x1 filed, 60x44 drawn)
    needs the row above it dry as well.
  * NOTHING WITHIN EIGHT TILES OF A DOOR. Eight is the aggro range plus two:
    you land clear and you leave clear.
  * NINE TILES BETWEEN CREATURE POSTS, so every pull is a single one.
  * THE GRADIENT RUNS BY WALKING toward the descent, never in a straight line.
  * EVERY OPEN SQUARE STAYS REACHABLE. Asserted, not hoped for.

Deterministic: one fixed seed, no clock, no set iteration order. Re-running it
on the same exports reproduces both files byte for byte.
"""
import random
import sys
import xml.etree.ElementTree as ET
from collections import deque

SRC = sys.argv[1] if len(sys.argv) > 1 else "/mnt/user-data/uploads"
TILE = 32
RNG = random.Random(20250905)

# ------------------------------------------------------------------ input

def load_layers(path):
    m = ET.parse(path).getroot()
    W, H = int(m.get("width")), int(m.get("height"))
    out = []
    for l in m.findall("layer"):
        txt = l.find("data").text.replace("\n", "").replace("\r", "").strip().rstrip(",")
        out.append((l.get("name"), [int(v) for v in txt.split(",")]))
    return W, H, out


def collision(path):
    W, H, layers = load_layers(path)
    land = [[False] * W for _ in range(H)]
    solid = [[False] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            i = y * W + x
            for n, v in layers:
                if not v[i]:
                    continue
                if n == "wyspa":
                    land[y][x] = True
                elif n == "woda" or n.startswith("cienie"):
                    pass
                else:
                    solid[y][x] = True
    return W, H, land, solid


def wet_paint(png_path, W, H):
    """Per tile: is the terrain EXPORT majority water there?

    Sea in both exports is a dark desaturated blue and land is green, so
    "blue channel wins" survives the water's tile variants and the shore's
    dither without pinning an exact colour."""
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
        "boulderA": (2, 1), "boulderB": (2, 1), "tent": (2, 2)}
SPILL = {"deadTree": (2, 1), "felledTree": (1, 1), "skullPole": (1, 0),
         "boulderA": (1, 0), "boulderB": (1, 0), "tent": (0, 0)}
# A tree is 32x56 anchored on the bottom of its square: one tile wide, the
# crown reaching into the square north of it. A rock is 20x12 drawn centred
# and cannot leave its own cell at all.
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


PROP_GLYPHS = set("TRQqVvYN$x#~")


def relieve_pockets(grid, W, H, start, seal=None):
    """Take props back out until every open square is reachable again.

    A scatter of four hundred objects WILL wall something off eventually — two
    boulders across the neck of a bay, a grove closing a gap. Counting the
    props cannot see it, so the fix is the same shape as the test that would
    catch it: flood from the door, and where a pocket is found, delete the
    props on its rim until it drains. Deterministic, because the rim is
    visited in reading order.
    """
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
                # A square may be sealed by a glyph that is not on it — the
                # far half of a boulder, the far half of a tent — so the owner
                # map is what says which glyph to lift.
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
        print(f"      {label}: {d[dy][dx]} tiles of walking from {doors[0][0]}")
    return total


# ======================================================================= #
#  CRETE — the hunting ground                                             #
# ======================================================================= #
#
# Two doors, both out of the export's own object layer: the pad back to the
# cellar on the north shore at (50,14), and the mouth of the labyrinth on the
# south-west at (15,78). A hundred and fourteen tiles of walking between them,
# which is Haramsey's crossing and Dane Hills' to within a tile.
#
# WHO LIVES HERE. Four ranks, all of them horns, because the island IS the
# minotaur's country and mixing sellswords into it would say otherwise:
#
#   m minotaur        tier 29, exp 310 — the shallow end, and the bulk
#   a minotaurArcher  tier 27, exp 385 — the only ranged rank
#   g minotaurGuard   tier 40, exp 480 — the heaviest thing walking
#   G minotaurMage    tier 32, exp 605 — ONE, and he stands nearest the mouth
#
# THE GRADIENT RUNS BY WALKING DISTANCE FROM THE LABYRINTH, sorted with BFS
# and cut into bands: the mage is the closest post to the descent, the seven
# guards next, then the archers, and the plain horns hold the far half of the
# island. That is Radek's ask — "near the tp, guards and one mage" — expressed
# the way every other mission ground in the game expresses difficulty.
DOOR_PAD = (50, 14)      # 2x2 pad back to the Time Sage's cellar
DOOR_HOLE = (15, 78)     # the way into the labyrinth
N_POSTS = 48
POST_GAP = 9             # nothing pulls two at once
DOOR_CLEAR = 8           # aggro range plus two
# The camp at the mouth, and it is a CLEARANCE POINT as well as scenery: the
# Dane Hills' rule is that the breather is a breather, so nothing hostile may
# stand inside aggro of the fire either. Eight tiles from the door is not
# automatically eight from a fire three squares along from it.
CAMP_FIRE = (20, 76)


def farthest_point(cands, n, gap, seed_pt):
    """Maximin sampling: each new post is the candidate farthest from every
    post already placed. Spreads instead of clumping, and is deterministic."""
    picked = [seed_pt]
    pool = [c for c in cands if (c[0] - seed_pt[0]) ** 2 + (c[1] - seed_pt[1]) ** 2 >= gap * gap]
    while len(picked) < n and pool:
        best, bestd = None, -1
        for c in pool:
            d = min((c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 for p in picked)
            if d > bestd or (d == bestd and best is not None and c < best):
                best, bestd = c, d
        picked.append(best)
        pool = [c for c in pool
                if min((c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 for p in picked) >= gap * gap]
    return picked


def build_crete():
    W, H, land, solid = collision(f"{SRC}/minoqxp.tmx")
    wet = wet_paint(f"{SRC}/minoqxp.png", W, H)
    walk = lambda x, y: 0 <= x < W and 0 <= y < H and land[y][x] and not solid[y][x]

    # Dry means dry in BOTH pictures, and one clear square off either shore.
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
    fromPad = bfs(W, H, blk, [DOOR_PAD])

    def far_from_doors(x, y):
        return ((x - DOOR_PAD[0]) ** 2 + (y - DOOR_PAD[1]) ** 2 >= DOOR_CLEAR ** 2
                and (x - DOOR_PAD[0] - 1) ** 2 + (y - DOOR_PAD[1] - 1) ** 2 >= DOOR_CLEAR ** 2
                and (x - DOOR_HOLE[0]) ** 2 + (y - DOOR_HOLE[1]) ** 2 >= DOOR_CLEAR ** 2
                and (x - CAMP_FIRE[0]) ** 2 + (y - CAMP_FIRE[1]) ** 2 >= DOOR_CLEAR ** 2)

    # --- creature posts ----------------------------------------------------
    cands = [(x, y) for y in range(H) for x in range(W)
             if walk(x, y) and dry(x, y) and far_from_doors(x, y) and fromHole[y][x] >= 0]
    # Seed on the post nearest the descent that is still outside the door's
    # clearance, so the heavy end of the ladder is anchored where it belongs.
    seed = min(cands, key=lambda c: (fromHole[c[1]][c[0]], c))
    posts = farthest_point(cands, N_POSTS, POST_GAP, seed)
    posts.sort(key=lambda p: (fromHole[p[1]][p[0]], p))
    ranks = ["G"] * 1 + ["g"] * 7 + ["a"] * 14 + ["m"] * (N_POSTS - 22)
    post_at = {}
    for p, r in zip(posts, ranks):
        grid[p[1]][p[0]] = r
        post_at[p] = r

    # --- the camp at the mouth --------------------------------------------
    # Dane Hills' rule: a breather, not a trap. Two squares off the descent,
    # with nothing hostile inside its aggro.
    camp = [("N", 17, 76), ("F", CAMP_FIRE[0], CAMP_FIRE[1]), ("N", 21, 76),
            ("o", 17, 79), ("o", 22, 78)]

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
        parser seals the rest of its block itself. Writing it on both squares
        of the block — which the first cut of this did — puts two boulders in
        the same place and reads on screen as one boulder with a seam.

        Everything the object PAINTS has to be dry in both pictures and one
        clear square off either shore, which is what `dry` asks. Everything it
        SEALS is recorded in `seal` so that reachability can see it without
        the glyph grid having to."""
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

    for glyph, tx, ty in camp:
        kind = {"N": "tent"}.get(glyph)
        if kind:
            place(kind, glyph, tx, ty)
        else:
            grid[ty][tx] = glyph
            taken.add((tx, ty))   # a fire and a bone pile seal nothing

    # OLIVE GROVES, NOT WALLPAPER. Trees go down in loose clumps with lanes
    # between them; an even sprinkle over five thousand squares reads as
    # texture rather than as a wood, which is the note Calanais got in Etap 51.
    #
    # THE NUMBERS MATTER MORE THAN THE COUNT. The first cut spread the same
    # four hundred trees over thirteen-tile clumps and the island came out
    # looking evenly sprinkled — texture, not woodland. Tightened to seven
    # tiles across at about two squares in five, which is a stand of olive you
    # walk INTO and out the other side of, with open ground between stands.
    grove_centres = []
    for _ in range(4000):
        if len(grove_centres) >= 22:
            break
        x, y = RNG.randrange(W), RNG.randrange(H)
        if not (walk(x, y) and dry(x, y)):
            continue
        if any((x - c[0]) ** 2 + (y - c[1]) ** 2 < 196 for c in grove_centres):
            continue
        grove_centres.append((x, y))
    trees = 0
    for cx, cy in grove_centres:
        for _ in range(48):
            x = cx + RNG.randint(-3, 3)
            y = cy + RNG.randint(-3, 3)
            if not (0 <= x < W and 0 <= y < H) or grid[y][x] != ".":
                continue
            if RNG.random() < 0.46 and place("tree", "T", x, y):
                trees += 1
    # …and a thin scatter of solitary olive between the stands, so the open
    # ground reads as open rather than as mown.
    for _ in range(6000):
        if trees >= 430:
            break
        x, y = RNG.randrange(W), RNG.randrange(H)
        if grid[y][x] == "." and place("tree", "T", x, y):
            trees += 1

    # STONE. Crete is limestone and the island is meant to be worth walking
    # for more than experience, so the nodes are spread over the whole of it
    # rather than clumped with the wood.
    rocks = 0
    for _ in range(9000):
        if rocks >= 96:
            break
        x, y = RNG.randrange(W), RNG.randrange(H)
        if grid[y][x] == "." and place("rock", "R", x, y):
            rocks += 1

    scen = 0
    for kind, glyph, want in (("boulderA", "Q", 16), ("boulderB", "q", 14),
                              ("deadTree", "V", 18), ("felledTree", "v", 12),
                              ("skullPole", "Y", 9)):
        got = 0
        for _ in range(9000):
            if got >= want:
                break
            x, y = RNG.randrange(W), RNG.randrange(H)
            if grid[y][x] == "." and place(kind, glyph, x, y):
                got += 1
        scen += got

    # BONES THICKEN TOWARD THE DESCENT. Athens sent youths here every few
    # years and none of them came back out; the island should say so before
    # Chronos does. Decor only — bones seal nothing.
    bones = 0
    for _ in range(20000):
        if bones >= 60:
            break
        x, y = RNG.randrange(W), RNG.randrange(H)
        if grid[y][x] != "." or (x, y) in taken:
            continue
        d = fromHole[y][x]
        if d < 0:
            continue
        if RNG.random() > max(0.04, 1.0 - d / 110):
            continue
        grid[y][x] = "o"
        taken.add((x, y))
        bones += 1

    freed = relieve_pockets(grid, W, H, DOOR_HOLE, seal)

    # the doors last, so nothing can have been painted over one
    grid[DOOR_PAD[1]][DOOR_PAD[0]] = "P"
    grid[DOOR_HOLE[1]][DOOR_HOLE[0]] = "D"

    rows = ["".join(r) for r in grid]
    verify(rows, W, H, [("the pad", DOOR_PAD), ("the labyrinth", DOOR_HOLE)], "Crete", seal)
    print(f"      {trees} olive, {rocks} stone, {scen} standing props, {bones} bone piles,"
          f" {len(posts)} posts; {freed} props lifted to drain pockets")
    return rows, posts, post_at, trees, rocks, scen


# ======================================================================= #
#  THE LABYRINTH — the echo                                               #
# ======================================================================= #
#
# Four points off the export's object layer: the way back up to Crete on the
# south apron, the Minotaur in the middle, his hoard beside him, and the pad
# home to Chronos. The walk between the first and the second is the mission.
#
# NOTHING ELSE LIVES DOWN HERE, and that is the design rather than a shortcut
# — the same call Annis' Bower made and for a better reason. Radek's own note
# for this errand says the labyrinth IS part of the opponent: you beat the
# space before you fight the thing in it. Filling the corridors with horns
# would turn four hundred tiles of navigation into four hundred tiles of the
# hunting ground you just walked, and the one idea the mission has would go
# with it.
#
# WHAT IS DOWN HERE INSTEAD IS BONES. Every few years Athens sent fourteen
# young people in and none walked out, and the dead ends are where they
# stopped. They are decor: they seal nothing and they cost nothing, and they
# are the only thing that makes a wrong turn feel like it was somebody else's
# wrong turn first.
LAB_UP = (50, 87)        # back up to Crete
LAB_BOSS = (51, 50)
LAB_CHEST = (42, 50)
LAB_HOME = (42, 52)      # the relic road, dark until he falls
# The hedge itself, inclusive. Outside it is the grass apron the maze stands
# in; nothing is dressed out there, because nothing happens out there.
MAZE_BOX = (15, 15, 84, 84)


def build_labyrinth():
    W, H, land, solid = collision(f"{SRC}/labiryntmino.tmx")
    grid = [["~" if not land[y][x] else ("x" if solid[y][x] else ".") for x in range(W)]
            for y in range(H)]
    walk = lambda x, y: 0 <= x < W and 0 <= y < H and land[y][x] and not solid[y][x]
    blk = [[not walk(x, y) for x in range(W)] for y in range(H)]

    # THE SEALED RING. The trace leaves a corridor along the north and west
    # of the outer ring that is walled at both ends — 158 squares you can see
    # and can never stand in. Reported to Radek; until the export says
    # otherwise it is painted OUT of the collision grid, because a pocket the
    # player cannot reach is a pocket the smoke suite has to be told to ignore
    # forever, and a wall is honest about it.
    reach = bfs(W, H, blk, [LAB_UP])
    orphans = [(x, y) for y in range(H) for x in range(W)
               if walk(x, y) and reach[y][x] < 0]
    for x, y in orphans:
        grid[y][x] = "x"

    # BONES IN THE DEAD ENDS. The corridors here are two tiles wide, so a
    # blind alley never ends in a square with one neighbour — counting
    # neighbours finds nothing at all. The tips are LOCAL MAXIMA of the walk
    # from the entrance instead: a square no open neighbour is further out
    # than is the end of a branch, whatever its width.
    #
    # INSIDE THE HEDGE ONLY. The map is a maze standing in a grass apron, and
    # the apron's own corners are local maxima too — the first pass put two
    # thirds of the bones out on the lawn, where they say nothing at all. What
    # the piles are for is that a wrong turn should feel like somebody else's
    # wrong turn first, and there are no wrong turns outside the hedge.
    inside = lambda x, y: MAZE_BOX[0] <= x <= MAZE_BOX[2] and MAZE_BOX[1] <= y <= MAZE_BOX[3]
    ends = []
    for y in range(H):
        for x in range(W):
            if grid[y][x] != "." or reach[y][x] < 0 or not inside(x, y):
                continue
            here = reach[y][x]
            if all(not walk(x + dx, y + dy) or reach[y + dy][x + dx] <= here
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                ends.append((x, y))
    for x, y in ends:
        grid[y][x] = "o"

    # a few more along the long corridors, thinning outward from the middle
    extra = 0
    for _ in range(30000):
        if extra >= 46:
            break
        x, y = RNG.randrange(W), RNG.randrange(H)
        if grid[y][x] != "." or reach[y][x] < 0 or not inside(x, y):
            continue
        if abs(x - LAB_BOSS[0]) < 12 and abs(y - LAB_BOSS[1]) < 12:
            continue
        if RNG.random() > 0.3:
            continue
        grid[y][x] = "o"
        extra += 1

    # THE CHAMBER. Six poles down the long sides, well off the walls — the
    # same correction the bower's got, because a prop hard against rock reads
    # as part of the rock. They stand in for what Knossos actually left:
    # horns of consecration, in stone, on every wall of the place.
    for x, y in ((45, 44), (55, 44), (45, 55), (55, 55), (50, 43), (50, 56)):
        if grid[y][x] == ".":
            grid[y][x] = "Y"
    for x, y in ((47, 47), (54, 53), (47, 53), (54, 47)):
        if grid[y][x] == ".":
            grid[y][x] = "o"

    grid[LAB_BOSS[1]][LAB_BOSS[0]] = "X"
    grid[LAB_CHEST[1]][LAB_CHEST[0]] = "$"
    grid[LAB_HOME[1]][LAB_HOME[0]] = "W"
    grid[LAB_UP[1]][LAB_UP[0]] = "U"

    rows = ["".join(r) for r in grid]
    verify(rows, W, H, [("the way up", LAB_UP), ("the Minotaur", LAB_BOSS),
                        ("the hoard", LAB_CHEST), ("the pad home", LAB_HOME)],
           "the labyrinth")
    print(f"      {len(orphans)} unreachable squares sealed, "
          f"{len(ends) + extra} bone piles")
    return rows, len(orphans), len(ends) + extra


# ======================================================================= #
#  WRITING THE TWO SPECS                                                  #
# ======================================================================= #
# The prose headers live here rather than in the generated files, because a
# generated file is overwritten and a comment inside one would be lost the
# first time anybody re-ran this.

CRETE_HEAD = '''/**
 * Crete — the Time Sage's FIFTH mission ground, and the island the labyrinth
 * is cut into.
 *
 * Traced from `minoqxp.tmx` (100x100) and drawn from `public/crete-terrain.png`,
 * the same file's image export at native tile size. Collision by exclusion,
 * the house rule: the `wyspa` layer says where land is and the rock layer
 * seals every square it covers.
 *
 * GENERATED. Do not hand-edit this file — `tools/gen_minotaur_maps.py` writes
 * it whole from the two Tiled exports, and it will do so again.
 *
 * THE TWO ENDS came out of the export's own object layer, not from a choice
 * made here. The pad back to the cellar is `tp z i do piwnicy medrca czasu`
 * on the north shore; the mouth of the labyrinth is `tp do labiryntu` on the
 * south-west. That is a hundred and fourteen tiles of WALKING between them —
 * Haramsey's crossing and the Dane Hills' to within a tile, which is the
 * length a mission ground has been at every rung of this chain.
 *
 * WHO LIVES HERE, and why all four ranks are horns. This island is the
 * minotaur's country: mixing sellswords or vikings into it would say that it
 * is somewhere the minotaurs happen to be, and it is not. Four ranks, all of
 * them already in the bestiary from the Bone Reach's western descent:
 *
 *   m minotaur        tier 29, 310 exp — the bulk of the island
 *   a minotaurArcher  tier 27, 385 exp — the only RANGED rank here
 *   g minotaurGuard   tier 40, 480 exp — the heaviest thing walking
 *   G minotaurMage    tier 32, 605 exp — exactly ONE, and he stands nearest
 *                                        the descent
 *
 * THE GRADIENT RUNS BY WALKING DISTANCE FROM THE LABYRINTH, not from the pad
 * and not in a straight line. Forty-eight posts, maximin-sampled so they
 * spread instead of clumping, sorted by BFS distance from the mouth and cut
 * into bands: the mage is the nearest post to the descent, the seven guards
 * are behind him, then fourteen archers, and twenty-six plain horns hold the
 * far half of the island. Nothing stands within nine tiles of another post,
 * comfortably over the eight the aggro range asks for, so every pull is a
 * single one — and nothing stands within eight of either door, so you land
 * clear and you leave clear.
 *
 * THE ISLAND IS DRESSED because the export is bare grass and a hunting ground
 * you are meant to walk repeatedly cannot be a lawn. Olive in loose groves
 * with lanes between them rather than an even sprinkle — the note Calanais
 * got in Etap 51, applied first time here. Limestone nodes over the whole of
 * it, so the walk is worth something besides experience. Boulders, dead and
 * felled wood, and standing poles thinning as you go north.
 *
 * BONES THICKEN TOWARD THE DESCENT. Athens sent fourteen young people here
 * every few years and none of them walked out again; the island should say so
 * before Chronos does. Decor only — bones seal nothing.
 *
 * THE CAMP AT THE MOUTH is the Dane Hills' rule kept: two tents and a fire a
 * couple of squares off the descent, with nothing hostile inside its aggro.
 * A breather, not a trap — you can sit down, eat, and then go in.
 *
 * THE DESCENT IS A MISSION DOOR. It ships dormant and `applyMissionPads` puts
 * it to sleep whenever the echo behind it is not enterable — dark before
 * Chronos speaks and dark again once the earring is on his table.
 *
 *   P pad back to the cellar (2x2)   D into the labyrinth
 *   T olive   R limestone   V dead tree   v felled wood   Q q boulder
 *   N tent   F campfire   Y pole   o bones   x crag (impassable, drawn)
 *   creatures: m minotaur   a archer   g guard   G mage
 */
import type { HandmadeSpec } from "./handmade.ts";
import { Tile } from "./types.ts";

export const CRETE_SPEC: HandmadeSpec = {
  key: "crete",
  name: "Crete",
  safe: false,
  portals: {
    P: { dest: "cellar", label: "back to the Time Sage's cellar", span: 2, floor: Tile.Dirt },
    D: {
      dest: "labyrinth", label: "into the labyrinth",
      style: "caveMouth", floor: Tile.Dirt, inactive: true,
    },
  },
  // The crags the export draws. Collision only: no wall, no ruin, no minimap
  // masonry — just a square you cannot cross.
  solids: "x",
  scenery: { V: "deadTree", v: "felledTree", N: "tent", Y: "skullPole", Q: "boulderA", q: "boulderB" },
  monsters: {
    m: "minotaur",
    a: "minotaurArcher",
    g: "minotaurGuard",
    G: "minotaurMage",
  },
  rows: [
'''

CRETE_TAIL = '''  ],
};
'''

LAB_HEAD = '''/**
 * The Labyrinth — the maze under Knossos, and the end of the Time Sage's
 * fifth mission.
 *
 * Traced from `labiryntmino.tmx` (100x100) and drawn from
 * `public/labyrinth-terrain.png`, the same file's image export. Collision by
 * exclusion, the usual rule: every rock layer seals its squares.
 *
 * GENERATED. Do not hand-edit this file — `tools/gen_minotaur_maps.py` writes
 * it whole from the two Tiled exports, and it will do so again.
 *
 * IT IS NOT A ROOM, WHICH IS THE WHOLE POINT. Every echo before this one is a
 * chamber with a boss standing in it: the redcap's bog is 30x30, Kárr's howe
 * 19x31, Annis' bower fourteen wide and sixteen deep. This is four hundred
 * and thirty-odd tiles of WALKING from the way in to the thing at the middle,
 * through a spiral that doubles back on itself six times. Radek's design note
 * for the errand puts it exactly right: the labyrinth is part of the
 * opponent, and you beat the space before you fight what is in it.
 *
 * SO NOTHING ELSE LIVES DOWN HERE. That is the bower's call made again and
 * for a better reason: filling these corridors with horns would turn the
 * navigation into four hundred tiles of the hunting ground upstairs, and the
 * one idea the mission owns would go with it. The maze is the encounter.
 *
 * WHAT IS DOWN HERE INSTEAD IS BONES, and they are placed rather than
 * scattered: every dead end in the maze carries a pile, because a dead end is
 * where somebody stopped. Athens sent fourteen young people in every few
 * years and the sources are unanimous that none came out. A wrong turn should
 * feel like somebody else's wrong turn first.
 *
 * THE SEALED RING. The trace leaves a corridor running the north and west of
 * the outer ring walled at BOTH ends — a hundred and fifty-eight squares you
 * can see across the wall and can never stand in. It is reported; until the
 * export changes it is painted out of the collision grid as crag, because a
 * permanent unreachable pocket is something every reachability test in the
 * suite would have to be told to forgive forever, and a wall is honest.
 *
 * THE CHAMBER AT THE CENTRE is nineteen by eighteen, the largest single room
 * in the game, and it is dressed with six poles standing well clear of the
 * walls — the correction the bower's boulders got, for the same reason: a
 * prop hard against rock reads as part of the rock. They stand in for what
 * Knossos actually left behind, which is horns of consecration in stone on
 * every wall of the place.
 *
 * THE HOARD IS A CHEST, NOT A POCKET, exactly as in the howe and the bower:
 * he respawns and a chest does not, so routing the payday through his loot
 * table would turn a boss into a press. It sits in open floor with walkable
 * ground on all four sides.
 *
 * THE WAY HOME is dark until he is down, then lit where he fell, so the
 * earring goes straight to Chronos' table without the walk back out through
 * the maze — which, at four hundred tiles, is the difference between a
 * memorable errand and a chore. `applyMissionPads` owns it: a pad out of an
 * echo to the cellar is the relic road, and it opens on `complete` and on
 * nothing else.
 *
 *   U back up to Crete   W the way home, with the earring
 *   X the Minotaur   $ his hoard   Y pole   o bones
 *   x hedge and rock (impassable, drawn by the export)
 */
import type { HandmadeSpec } from "./handmade.ts";

export const LABYRINTH_SPEC: HandmadeSpec = {
  key: "labyrinth",
  name: "The Labyrinth",
  safe: false,
  portals: {
    U: { dest: "crete", label: "back out to Crete" },
    W: {
      dest: "cellar", label: "back to Chronos, with the earring",
      inactive: true,
    },
  },
  solids: "x",
  scenery: { Y: "skullPole" },
  monsters: {
    X: "asterion",
  },
  rows: [
'''

LAB_TAIL = '''  ],
};
'''


def main():
    print("tracing the two exports…")
    crete_rows, posts, post_at, trees, rocks, scen = build_crete()
    lab_rows, orphans, bones = build_labyrinth()

    with open("src/world/creteSpec.ts", "w") as f:
        f.write(CRETE_HEAD + emit(crete_rows) + "\n" + CRETE_TAIL)
    with open("src/world/labyrinthSpec.ts", "w") as f:
        f.write(LAB_HEAD + emit(lab_rows) + "\n" + LAB_TAIL)
    print("wrote src/world/creteSpec.ts and src/world/labyrinthSpec.ts")


if __name__ == "__main__":
    main()
