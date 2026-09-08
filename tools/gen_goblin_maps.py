#!/usr/bin/env python3
"""Turn the two minotaur floors end for end and write the goblin branch whole:
`src/world/goblinDeepSpec.ts`, `src/world/goblinDeep2Spec.ts`, and the two
terrain exports that go with them.

    python3 tools/gen_goblin_maps.py            # run from the repo root

WHY THERE IS NO TMX HERE. `gen_minotaur_maps.py` and `gen_orc_maps.py` both
trace a Tiled export; this one does not, because there is nothing new to trace.
The goblin branch is the SAME two mazes a third time, and the minotaur specs in
`src/world/` are that trace — they are the authoritative copy of it, checked in
and pinned by the smoke suite. Reading the rock out of them is therefore exact
by construction and cannot drift out of step with a re-export nobody has.

WHICH WAY IT TURNS, AND WHY IT HAD TO BE THIS ONE. Minotaur Deep -1 is the maze
as drawn. Orc Deep -1 is that maze a quarter turn CLOCKWISE. Turn the orc floor
anticlockwise and you get the minotaur floor back, square for square — so the
only rotation left that gives a third distinct walk is another quarter turn the
same way, which is the minotaur floor UPSIDE DOWN. Both goblin floors take that
same half turn, `(x,y) -> (79-x, 79-y)`, and the terrain PNGs are turned by the
same rule so the pictures still line up 1:1 with the grids.

WHAT DOES NOT COME ACROSS. Only the rock. The furniture and the garrison are
scattered here from scratch, because that is what the orc branch did and it is
the whole reason a rotation is worth doing: 0 of the orc floor's 129 props and
1 of its 85 posts sit where the minotaur floor's do. A shared maze with shared
dressing would be the same floor with different monsters in it.

THE HOUSE RULES THE SCATTER OBEYS, all of them checked rather than assumed:

  * NOTHING SEALS A POCKET. Every solid prop — rock, totem, well, boulder — is
    placed provisionally and taken back if the flood fill from the ladder stops
    reaching any open square. Corridors here are one tile wide in places and a
    boulder in the wrong one cuts the floor in half.
  * FOOTPRINTS, NOT GLYPHS. A well claims 2x2 and a boulder 2x1, and the smoke
    suite claims the same squares when it checks that nothing is stacked. The
    packer reserves the footprint and refuses any that overhangs rock.
  * EIGHT STEPS AROUND THE LADDER stay empty of creatures, measured as WALK
    distance and not as the crow flies, so you land and draw on every floor.
  * RANKS ARE GRADED, NOT BANDED. On -1 the legionaries lean toward the hole
    down without the far half becoming a wall — some stand near the ladder and
    some plain goblins stand deep, and it is the MEANS that separate.

WHO LIVES DOWN THERE, and the one place this branch refuses to copy the other
two. Minotaur -2 fields mages and orc -2 fields shamans; the goblins field
neither, because there is no goblin caster in the bestiary and inventing one to
fill a slot would be the tail wagging the dog. So -2 is the legionary and
nothing else, and that is the goblin branch's character rather than a gap in
it: the one descent in the game with no magic anywhere on it, where the floor
gets harder by putting the same soldier in front of you again.
"""
import os
import random
import re
import sys
from collections import deque

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
N = 80
RNG = random.Random(20260907)

# ------------------------------------------------------------------ input


def read_grids(path):
    """`rows` and `floor` out of a checked-in HandmadeSpec, as lists of str."""
    src = open(os.path.join(ROOT, path), encoding="utf8").read()
    out = {}
    for key in ("rows", "floor"):
        m = re.search(key + r":\s*\[(.*?)\n  \],?", src, re.S)
        assert m, f"{path}: no {key} grid"
        g = re.findall(r'"([^"]*)"', m.group(1))
        assert len(g) == N and all(len(r) == N for r in g), f"{path}: {key} is not {N}x{N}"
        out[key] = g
    return out


def find(grid, ch):
    for y in range(N):
        for x in range(N):
            if grid[y][x] == ch:
                return (x, y)
    raise AssertionError(f"glyph {ch!r} not on the grid")


def half_turn(x, y):
    return (N - 1 - x, N - 1 - y)


# ------------------------------------------------------------------ geometry


def reachable(rock, solid, start):
    """Squares the flood fill from `start` touches, over rock AND furniture."""
    seen = [[False] * N for _ in range(N)]
    sx, sy = start
    seen[sy][sx] = True
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            i, j = x + dx, y + dy
            if 0 <= i < N and 0 <= j < N and not seen[j][i] and not rock[j][i] and not solid[j][i]:
                seen[j][i] = True
                q.append((i, j))
    return seen


def walk_dist(rock, solid, start):
    """Steps from `start` to every square, -1 where it cannot be walked to."""
    d = [[-1] * N for _ in range(N)]
    sx, sy = start
    d[sy][sx] = 0
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            i, j = x + dx, y + dy
            if 0 <= i < N and 0 <= j < N and d[j][i] < 0 and not rock[j][i] and not solid[j][i]:
                d[j][i] = d[y][x] + 1
                q.append((i, j))
    return d


def open_count(rock):
    return sum(1 for y in range(N) for x in range(N) if not rock[y][x])


# ------------------------------------------------------------------ the floor


class Floor:
    """One rotated maze, dressed and garrisoned.

    `rock` is the collision the rotation handed over and never changes after
    that. `claim` is every square something already owns — furniture footprint,
    creature, marker — and is what keeps two objects off one tile. `solid` is
    the subset of that which BLOCKS, and is what the reachability check reads.
    """

    def __init__(self, src_floor, markers):
        self.rock = [[False] * N for _ in range(N)]
        for y in range(N):
            for x in range(N):
                i, j = half_turn(x, y)
                self.rock[j][i] = src_floor[y][x] == "#"
        self.claim = {}                                   # (x,y) -> what
        self.solid = [[False] * N for _ in range(N)]
        self.glyph = {}                                   # (x,y) -> character
        self.markers = markers                            # name -> (x,y)
        for name, (x, y) in markers.items():
            assert not self.rock[y][x], f"{name} landed in the rock at {x},{y}"
            self.claim[(x, y)] = name
        self.ladder = markers["U"]

    # -- placement -------------------------------------------------------

    def free(self, x, y, w=1, h=1):
        """Is the whole w*h footprint open floor and unclaimed?"""
        for j in range(y, y + h):
            for i in range(x, x + w):
                if not (0 <= i < N and 0 <= j < N):
                    return False
                if self.rock[j][i] or (i, j) in self.claim:
                    return False
        return True

    def crowded(self, x, y, w, h, gap):
        """Any claimed square within `gap` of the footprint?"""
        for j in range(y - gap, y + h + gap):
            for i in range(x - gap, x + w + gap):
                if (i, j) in self.claim:
                    return True
        return False

    def put(self, x, y, ch, what, fp=(1, 1), block=None):
        """Reserve a footprint, seal its block row, refuse anything that walls
        a square off from the ladder. Returns True when it stuck."""
        w, h = fp
        if not self.free(x, y, w, h):
            return False
        sealed = []
        if block:
            bw, bh = block
            y0 = y + h - bh
            for j in range(y0, y0 + bh):
                for i in range(x, x + bw):
                    if not self.solid[j][i]:
                        self.solid[j][i] = True
                        sealed.append((i, j))
            if sealed and not self._still_whole():
                for i, j in sealed:
                    self.solid[j][i] = False
                return False
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.claim[(i, j)] = what
        self.glyph[(x, y)] = ch
        return True

    def _still_whole(self):
        seen = reachable(self.rock, self.solid, self.ladder)
        for y in range(N):
            for x in range(N):
                if not self.rock[y][x] and not self.solid[y][x] and not seen[y][x]:
                    return False
        return True

    # -- the two scatters -------------------------------------------------

    def dress(self, counts, ladder_clear=4):
        """Furniture, heaviest first: the things that seal go down while there
        is still room to refuse them, the decor fills in afterwards."""
        # glyph -> (label, footprint, blocking rows or None, spacing)
        KINDS = {
            "W": ("well", (2, 2), (2, 1), 3),
            "Q": ("boulderA", (2, 1), (2, 1), 3),
            "q": ("boulderB", (2, 1), (2, 1), 3),
            "Y": ("skullPole", (1, 1), (1, 1), 3),
            "R": ("rock", (1, 1), (1, 1), 2),
            "F": ("fire", (1, 1), None, 2),
            "o": ("bones", (1, 1), None, 1),
            "H": ("mushroom", (1, 1), None, 1),
        }
        spots = [(x, y) for y in range(N) for x in range(N) if not self.rock[y][x]]
        for ch in "WQqYRFoH":
            label, fp, block, gap = KINDS[ch]
            want = counts[ch]
            got = 0
            pool = spots[:]
            RNG.shuffle(pool)
            for relax in (gap, gap - 1, 1):
                for (x, y) in pool:
                    if got >= want:
                        break
                    if self._near(x, y, self.ladder, ladder_clear):
                        continue
                    if any(self._near(x, y, m, 2) for m in self.markers.values()):
                        continue
                    if self.crowded(x, y, fp[0], fp[1], relax):
                        continue
                    if self.put(x, y, ch, label, fp, block):
                        got += 1
                if got >= want:
                    break
            assert got == want, f"only {got} of {want} {label}s would fit"

    @staticmethod
    def _near(x, y, p, r):
        return abs(x - p[0]) <= r and abs(y - p[1]) <= r

    def garrison(self, total, gap, ladder_steps=8, clear=(), seeds=(), seed_cap=0):
        """Creature posts: unclaimed floor, `gap` tiles between kin, and
        `ladder_steps` of WALKING clear around the way out.

        `clear` is a list of (point, radius) that nothing may be posted inside,
        measured straight-line. It exists for the HOLE DOWN, which the walking
        clearance around the ladder says nothing about and which is just as
        much a place you arrive: come up from -2 and you land on it. Both older
        -1 floors keep a creature three or four tiles off theirs; without this
        the packer put a legionary orthogonally adjacent to the goblins', which
        is a fight that starts before the screen finishes redrawing.

        `seeds` are squares the caller wants held whatever the packer would
        have chosen — the hoard chamber on -2 — and they are laid first so the
        spacing rule bends around them rather than over them.
        """
        d = walk_dist(self.rock, self.solid, self.ladder)
        posts = []

        def take(x, y, g):
            if (x, y) in self.claim or self.rock[y][x] or self.solid[y][x]:
                return False
            if d[y][x] < ladder_steps:
                return False
            if any((x - px) ** 2 + (y - py) ** 2 < r * r for (px, py), r in clear):
                return False
            if any((px - x) ** 2 + (py - y) ** 2 < g * g for px, py in posts):
                return False
            posts.append((x, y))
            self.claim[(x, y)] = "creature"
            return True

        seeded = 0
        for (x, y) in seeds:
            if seeded >= seed_cap:
                break
            # Two tiles between the guard rather than the floor's five: this is
            # a knot around one chest, and a knot is what it is meant to be.
            if take(x, y, 2):
                seeded += 1
        assert seeded == seed_cap, f"only {seeded} of {seed_cap} could hold the chamber"
        pool = [(x, y) for y in range(N) for x in range(N)
                if not self.rock[y][x] and not self.solid[y][x] and (x, y) not in self.claim]
        RNG.shuffle(pool)
        for g in (gap, gap - 1, gap - 2, 3):
            for (x, y) in pool:
                if len(posts) >= total:
                    break
                take(x, y, g)
            if len(posts) >= total:
                break
        assert len(posts) == total, f"only packed {len(posts)} of {total} posts"
        return posts, d

    # -- output -----------------------------------------------------------

    def rows(self):
        out = []
        for y in range(N):
            line = []
            for x in range(N):
                if (x, y) in self.glyph:
                    line.append(self.glyph[(x, y)])
                elif self.rock[y][x]:
                    line.append("#")
                else:
                    line.append("=")
            out.append("".join(line))
        return out

    def floor_rows(self):
        return ["".join("#" if self.rock[y][x] else "=" for x in range(N)) for y in range(N)]


# ------------------------------------------------------------------ writing


def ts_grid(name, rows, indent="  "):
    body = ",\n".join(f'{indent}  "{r}"' for r in rows)
    return f"{indent}{name}: [\n{body},\n{indent}],"


def write_spec(path, header, decl, floor, marker_glyphs, rows, floor_rows):
    body = "\n".join([
        header,
        'import type { HandmadeSpec } from "./handmade.ts";',
        "",
        decl,
        ts_grid("rows", rows),
        ts_grid("floor", floor_rows),
        "};",
        "",
    ])
    with open(os.path.join(ROOT, path), "w", encoding="utf8") as f:
        f.write(body)
    print(f"  wrote {path}")


def turn_png(src, dst):
    from PIL import Image
    im = Image.open(os.path.join(ROOT, src))
    im.rotate(180, expand=True).save(os.path.join(ROOT, dst))
    print(f"  wrote {dst}  ({im.size[0]}x{im.size[1]}, half turn)")


# ------------------------------------------------------------------ -1


def build_minus_one():
    src = read_grids("src/world/minoDeepSpec.ts")
    up = half_turn(*find(src["rows"], "U"))       # (24,9)
    down = half_turn(*find(src["rows"], "D"))     # (63,69)
    f = Floor(src["floor"], {"U": up, "D": down})
    f.glyph[up] = "U"
    f.glyph[down] = "D"
    f.dress({"F": 34, "o": 30, "H": 16, "R": 14, "Q": 11, "q": 11, "Y": 9, "W": 4})
    posts, d = f.garrison(85, gap=6, clear=((down, 3.5),))

    # Graded, not banded, and the difference between those two words is the
    # whole point of this block. A straight cut at the 23 deepest posts gives a
    # floor whose front half is provably safe from the heavier rank, which is a
    # promise about where you are standing rather than a gradient. So depth
    # only WEIGHTS the roll: each post scores `0.5 * depth + random`, and the
    # top 23 of that take the iron. The 0.5 is tuned rather than guessed — it
    # puts the shallowest legionary about thirty steps in, near enough to the
    # ladder that meeting one early is ordinary, while the two ranks still
    # separate by twenty-odd steps on the mean.
    deep = max(d[y][x] for x, y in posts)
    scored = sorted(posts, key=lambda p: 0.5 * d[p[1]][p[0]] / deep + RNG.random())
    heavy = set(scored[-23:])
    for (x, y) in posts:
        f.glyph[(x, y)] = "L" if (x, y) in heavy else "G"

    mg = min(d[y][x] for x, y in posts)
    mean = lambda s: sum(d[y][x] for x, y in s) / len(s)
    print(f"  -1: {open_count(f.rock)} open, {len(posts)} posts, "
          f"{len(heavy)} legionaries, landing clear {mg} steps, "
          f"mean depth G {mean([p for p in posts if p not in heavy]):.0f} / "
          f"L {mean(list(heavy)):.0f}")
    return f, up, down


# ------------------------------------------------------------------ -2


def build_minus_two():
    src = read_grids("src/world/minoDeep2Spec.ts")
    up = half_turn(*find(src["rows"], "U"))       # (63,69)
    hoard = half_turn(*find(src["rows"], "$"))    # (6,66)
    f = Floor(src["floor"], {"U": up, "$": hoard})
    f.glyph[up] = "U"
    f.glyph[hoard] = "$"
    f.solid[hoard[1]][hoard[0]] = True            # the chest is furniture
    f.dress({"F": 32, "o": 28, "H": 15, "R": 13, "Q": 10, "q": 10, "Y": 10, "W": 3})

    # The hoard is HELD. Three of them stand on the chamber it sits in, laid
    # before the spacing rule so it cannot scatter them off it, and the one
    # square you open the chest from is deliberately left bare.
    hx, hy = hoard
    approach = [(hx + dx, hy + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                if not f.rock[hy + dy][hx + dx] and not f.solid[hy + dy][hx + dx]]
    assert approach, "the hoard is walled in"
    # Every open square beside the chest is reserved, not merely the one the
    # ring below happens to skip. You fight for the chamber and then you open
    # the lid; you do not open it with something standing on the only tile you
    # can reach it from.
    for (ax, ay) in approach:
        f.claim[(ax, ay)] = "hoard approach"
    dh = walk_dist(f.rock, f.solid, approach[0])
    ring = sorted(((x, y) for y in range(N) for x in range(N)
                   if 2 <= dh[y][x] <= 8 and (x, y) not in f.claim and not f.solid[y][x]),
                  key=lambda p: dh[p[1]][p[0]])
    posts, d = f.garrison(77, gap=5, seeds=ring, seed_cap=3)
    for (x, y) in posts:
        f.glyph[(x, y)] = "L"

    print(f"  -2: {open_count(f.rock)} open, {len(posts)} legionaries, "
          f"landing clear {min(d[y][x] for x, y in posts)} steps, "
          f"{sum(1 for p in posts if dh[p[1]][p[0]] <= 8)} of them on the hoard")
    return f, up, hoard


# ------------------------------------------------------------------ main


HEAD1 = '''/**
 * Goblin Deep -1 — the warren under the Bone Reach's eastern descent.
 *
 * THE SAME MAZE AS MINOTAUR DEEP -1, TURNED END FOR END. Every square is
 * mapped (x,y) -> (79-x,79-y): the minotaur floor upside down, which is the
 * ORC floor a second quarter turn the same way. That is not a free choice —
 * the orc floor is already the minotaur floor turned clockwise, so turning it
 * back anticlockwise would have handed the goblins the minotaurs' labyrinth
 * square for square. A half turn is the only rotation left that is a third
 * maze to walk, and the terrain export is turned by the same rule so the
 * picture still lines up 1:1 with the grid.
 *
 * You land at (24,9) coming down from the Reach; the hole at (63,69) drops to
 * -2, diagonally the whole floor away from the ladder.
 *
 * WHO LIVES HERE. Two ranks, 62 goblins and 23 legionaries, 85 posts over
 * 3758 squares — the same garrison size the other two -1 floors carry, and
 * the lightest of the three by a mile. Graded by walk-distance from the
 * ladder rather than banded: the iron leans toward the hole down without the
 * far half becoming a wall, and you meet a legionary near the ladder often
 * enough that the armour is never a promise about where you are standing.
 *
 * NOTHING IS BURIED HERE, which is the rule both older branches keep: one
 * hoard to a branch and it sits at the bottom of its -2.
 *
 * The furniture is NOT the minotaur floor's turned round — it is scattered
 * again from nothing, exactly as the orcs' was. Same counts, different
 * squares. A shared maze wearing shared dressing would be one floor with a
 * different roster, and the rotation would have bought nothing.
 *
 *   U ladder back up to the Bone Reach   D descent to -2
 *   # rock wall   = cave floor
 *   R rock   F campfire   Y skull totem   W well   Q q black boulder
 *   o bones   H cave mushroom
 *   creatures: G goblin  L goblinLegionary
 *
 * Written by `tools/gen_goblin_maps.py`. Edit the glyphs by hand if you like —
 * the file is the truth, not the script — but the script will overwrite it.
 */'''

DECL1 = '''export const GOBLINDEEP_SPEC: HandmadeSpec = {
  key: "goblindeep1",
  name: "Goblin Deep -1",
  safe: false,
  portals: {
    U: { dest: "reach", label: "back up to the Bone Reach", style: "ladderUp" },
    D: { dest: "goblindeep2", label: "down into the warren", style: "caveMouth" },
  },
  scenery: { Y: "skullPole", W: "well", Q: "boulderA", q: "boulderB" },
  monsters: {
    G: "goblin",
    L: "goblinLegionary",
  },'''

HEAD2 = '''/**
 * Goblin Deep -2 — the bottom of the warren, under the floor the goblins hold.
 *
 * Minotaur Deep -2 turned end for end, (x,y) -> (79-x,79-y), by the same rule
 * and for the same reason as the floor above it. 3854 squares. You come up at
 * (63,69), on the tile the hole on -1 was cut, and that ladder is the only way
 * out.
 *
 * WHO LIVES HERE, AND THE ONE PLACE THIS BRANCH REFUSES TO COPY THE OTHER TWO.
 * 77 legionaries. Nothing else — no caster anywhere on the floor.
 *
 * Minotaur -2 fields six mages and orc -2 ten shamans, and both floors are
 * shaped around them: you cannot simply run through either. There is no goblin
 * caster in the bestiary, and inventing one to fill the slot would be a
 * creature that exists because a floor plan wanted a shape rather than because
 * the world wanted the creature. So the slot stays empty, and that is what
 * this branch IS: the one descent in the game with no magic on it at any
 * depth. It gets harder by putting the same soldier in front of you again,
 * which is also why it is the shallowest of the three in level — a floor with
 * no answer to a shield is a floor you can out-armour, and a level-22 rank is
 * as far as that can be pushed before it stops being a fight.
 *
 * THE HOARD sits at (6,66) in the western chamber, and holds the goblin shield
 * and ten platinum — one branch, one hoard, the third time. Three legionaries
 * hold the chamber it stands in. It is furniture: you open it from the tile
 * beside it, and that square is left bare so the fight is over before the lid
 * is.
 *
 * No level gate on the way down. The floor gates itself, as both others do.
 *
 *   U ladder back up to Goblin Deep -1   $ the hoard
 *   # rock wall   = cave floor
 *   R rock   F campfire   Y skull totem   W well   Q q black boulder
 *   o bones   H cave mushroom
 *   creatures: L goblinLegionary
 *
 * Written by `tools/gen_goblin_maps.py`.
 */'''

DECL2 = '''export const GOBLINDEEP2_SPEC: HandmadeSpec = {
  key: "goblindeep2",
  name: "Goblin Deep -2",
  safe: false,
  portals: {
    U: { dest: "goblindeep1", label: "back up to the warren", style: "ladderUp" },
  },
  scenery: { Y: "skullPole", W: "well", Q: "boulderA", q: "boulderB" },
  monsters: {
    L: "goblinLegionary",
  },'''


def main():
    print("Goblin branch — the minotaur floors, half a turn round:")
    f1, up1, down1 = build_minus_one()
    f2, up2, hoard = build_minus_two()
    assert down1 == up2, f"the hole on -1 {down1} and the ladder on -2 {up2} are not one tile"

    write_spec("src/world/goblinDeepSpec.ts", HEAD1, DECL1, f1, ("U", "D"),
               f1.rows(), f1.floor_rows())
    write_spec("src/world/goblinDeep2Spec.ts", HEAD2, DECL2, f2, ("U", "$"),
               f2.rows(), f2.floor_rows())
    turn_png("public/minodeep-terrain.png", "public/goblindeep-terrain.png")
    turn_png("public/minodeep2-terrain.png", "public/goblindeep2-terrain.png")


if __name__ == "__main__":
    sys.exit(main())
