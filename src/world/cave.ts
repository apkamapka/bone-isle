/**
 * Procedural cave floors — the descending Bone Caverns beneath the Wildlands.
 *
 * Unlike the round surface islands, these are rectangular cellular-automata
 * caverns: mostly rock, with carved chambers and winding corridors. The walls
 * are the point — they break line of sight and pathing, so you fight room by
 * room instead of kiting the whole floor into one blob. Ladders (portals with a
 * `style`) link each floor to the one above and below; difficulty is the
 * descent, so deeper floors carry the heavier monster tiers (see game.ts).
 *
 * Each floor is generated from its own seed, so it is fully deterministic and
 * independent of the surface RNG and of the other floors.
 */
import { TILE, MAP_TILE } from "../config.ts";
import { SPR } from "../gfx/sprites.ts";
import { seedWorldRng, wrand, wrndi, dist } from "../util.ts";
import { bakeWorldCanvas, toMapPx } from "./generate.ts";
import { Tile } from "./types.ts";
import type { World, WorldKey } from "./types.ts";

export interface CaveOpts {
  key: WorldKey;
  name: string;
  w: number;
  h: number;
  seed: number;
  /** Ladder-up destination (the floor above). */
  up?: WorldKey;
  /** Ladder-down destination (the floor below); omit on the bottom floor. */
  down?: WorldKey;
  rocks?: number;
  bones?: number;
  /** Place a one-time treasure chest on this floor (the bottom of the caverns). */
  treasure?: boolean;
}

/** Count wall cells within Chebyshev radius `r`; out-of-bounds counts as wall. */
function wallsWithin(wall: boolean[][], x: number, y: number, W: number, H: number, r: number): number {
  let n = 0;
  for (let oy = -r; oy <= r; oy++) {
    for (let ox = -r; ox <= r; ox++) {
      if (ox === 0 && oy === 0) continue;
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || wall[ny][nx]) n++;
    }
  }
  return n;
}

/** Largest 4-connected floor region; every other floor cell is filled to wall. */
function keepLargestRegion(wall: boolean[][], W: number, H: number): [number, number][] {
  const seen: boolean[][] = Array.from({ length: H }, () => new Array<boolean>(W).fill(false));
  let best: [number, number][] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (wall[y][x] || seen[y][x]) continue;
      const region: [number, number][] = [];
      const stack: [number, number][] = [[x, y]];
      seen[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        region.push([cx, cy]);
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (wall[ny][nx] || seen[ny][nx]) continue;
          seen[ny][nx] = true;
          stack.push([nx, ny]);
        }
      }
      if (region.length > best.length) best = region;
    }
  }
  const keep = new Set(best.map(([x, y]) => y * W + x));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!wall[y][x] && !keep.has(y * W + x)) wall[y][x] = true;
    }
  }
  return best;
}

/**
 * Thickness of the solid stone frame (Tile.Wall) sealed around every
 * underground floor. It is added OUTSIDE the authored dimensions — the map
 * grows by 2x this per axis — so the playable cavern keeps its full authored
 * w x h instead of being squeezed inward. The thick margin keeps ladders well
 * away from the screen edge / HUD and makes the cavern read as centred.
 */
const CAVE_BORDER = 8;

export function makeCaveWorld(opts: CaveOpts): World {
  // Expand OUTWARD: the authored opts.w/h stay the interior (carvable) size.
  const W = opts.w + CAVE_BORDER * 2;
  const H = opts.h + CAVE_BORDER * 2;
  seedWorldRng(opts.seed);

  // 1. random fill (border always wall)
  let wall: boolean[][] = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) =>
      x === 0 || y === 0 || x === W - 1 || y === H - 1 ? true : wrand() < 0.52,
    ),
  );
  // 2. smooth into caverns. The first passes also use a radius-2 rule that
  //    seeds pillars into wide-open voids, so we get chambers and corridors
  //    rather than one big erosion-hollowed hall; later passes just smooth.
  for (let pass = 0; pass < 4; pass++) {
    const seedPillars = pass < 4;
    const next: boolean[][] = wall.map((r) => r.slice());
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const n1 = wallsWithin(wall, x, y, W, H, 1);
        const open = seedPillars && wallsWithin(wall, x, y, W, H, 2) <= 3;
        next[y][x] = n1 >= 5 || open;
      }
    }
    wall = next;
  }
  // 2b. seal the CAVE_BORDER-thick stone frame. This overwrites already-drawn
  //     cells, so it consumes no extra RNG — the generation stream (and thus
  //     save determinism) is unchanged by the frame itself.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x < CAVE_BORDER || y < CAVE_BORDER || x >= W - CAVE_BORDER || y >= H - CAVE_BORDER) wall[y][x] = true;
    }
  }
  // 3. guarantee one connected cavern
  const region = keepLargestRegion(wall, W, H);

  // 4. tiles + solidity
  const tile: Tile[][] = [];
  const solid: boolean[][] = [];
  for (let y = 0; y < H; y++) {
    tile[y] = [];
    solid[y] = [];
    for (let x = 0; x < W; x++) {
      const isWall = wall[y][x];
      tile[y][x] = isWall ? Tile.Wall : Tile.Cave;
      solid[y][x] = isWall;
    }
  }

  const w: World = {
    key: opts.key,
    name: opts.name,
    safe: false,
    w: W,
    h: H,
    tile,
    solid,
    reserved: [],
    trees: [],
    rocks: [],
    herbs: [],
    decos: [],
    monsters: [],
    corpses: [],
    ground: [],
    npcs: [],
    respawns: [],
    shots: [],
    structures: [],
    buildSpots: [],
    portals: [],
    gates: [],
    camps: [],
    coastWater: [],
    // Authored/procedural caves have no radial silhouette; the baker computes
    // water depth from tile distance, so this is only a harmless stub.
    landR: () => Math.max(W, H),
    mapCanvas: document.createElement("canvas"),
  };

  // 5. ladders on opposite ends of the cavern (so the floor must be crossed)
  const used = new Set<number>();
  const byCorner = (sign: number) =>
    region.reduce((best, c) => (sign * (c[0] + c[1]) > sign * (best[0] + best[1]) ? c : best), region[0]);
  const pushLadder = (cell: [number, number], dest: WorldKey, style: "ladderUp" | "ladderDown", label: string) => {
    const [tx, ty] = cell;
    used.add(ty * W + tx);
    w.portals.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, dest, label, style });
  };
  if (opts.up) pushLadder(byCorner(-1), opts.up, "ladderUp", "climb up");   // top-left extreme
  if (opts.down) pushLadder(byCorner(1), opts.down, "ladderDown", "descend"); // bottom-right extreme

  // 5b. treasure chest CELL — chosen now, BEFORE the rocks, so its approach can
  // be reserved. The old code picked the cell last: the farthest floor cell was
  // often a one-tile dead-end nook, and a rock could then seal its only
  // corridor — the chest ended up visually "in the wall" and unreachable.
  // Now: farthest-from-the-up-ladder region cell that has at least 3 of its 4
  // orthogonal neighbours on open floor (an open pocket, walkable from several
  // sides); the cell AND its neighbours go into `used`, so no rock or bone
  // pile can ever block the approach. Pure computation, no RNG draws — the
  // generation stream is unperturbed. Falls back to the old farthest-any rule
  // if no cell qualifies (practically impossible on these caverns).
  let treasureCell: [number, number] | null = null;
  if (opts.treasure) {
    const upLadder = w.portals.find((pt) => pt.style === "ladderUp");
    const ux = upLadder ? upLadder.x : 0;
    const uy = upLadder ? upLadder.y : 0;
    const inRegion = new Set(region.map(([x, y]) => y * W + x));
    const openNeighbors = (tx: number, ty: number): number =>
      [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ox, oy]) =>
        inRegion.has((ty + oy) * W + (tx + ox)) && !used.has((ty + oy) * W + (tx + ox))).length;
    // the whole 3x3 alcove must be carvable interior (not touching the sealed
    // stone frame), otherwise the border leaves the chest visually walled-in
    const interiorAlcove = (tx: number, ty: number): boolean =>
      tx - 1 >= CAVE_BORDER && ty - 1 >= CAVE_BORDER && tx + 1 < W - CAVE_BORDER && ty + 1 < H - CAVE_BORDER;
    let bestD = -1;
    let fallback: [number, number] | null = null;
    let fbD = -1;
    for (const [tx, ty] of region) {
      if (used.has(ty * W + tx)) continue;
      if (!interiorAlcove(tx, ty)) continue;
      const d = dist(tx * TILE + TILE / 2, ty * TILE + TILE / 2, ux, uy);
      if (d > fbD) { fbD = d; fallback = [tx, ty]; }
      if (openNeighbors(tx, ty) < 3) continue;
      if (d > bestD) { bestD = d; treasureCell = [tx, ty]; }
    }
    treasureCell ??= fallback;
    if (treasureCell) {
      const [tx, ty] = treasureCell;
      used.add(ty * W + tx);
      // Carve a small open alcove around the chest (the whole 3x3) to FLOOR
      // BEFORE the bake, and reserve every one of those cells so no rock/bone
      // can seal them. This guarantees the chest sits in clearly-open ground
      // with a walkable approach from several sides — it can never read as
      // "embedded in the wall", even in the fallback dead-end case. Pure
      // computation (no RNG draws), so world determinism is untouched.
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = tx + ox;
          const ny = ty + oy;
          // never breach the sealed stone frame around the floor
          if (nx < CAVE_BORDER || ny < CAVE_BORDER || nx >= W - CAVE_BORDER || ny >= H - CAVE_BORDER) continue;
          wall[ny][nx] = false;
          tile[ny][nx] = Tile.Cave;
          solid[ny][nx] = false;
          used.add(ny * W + nx);
        }
      }
    }
  }

  // 6. ore veins + bones, scattered on floor tiles away from the ladders
  // (and away from the treasure chest's reserved approach)
  const floor = region.filter(([x, y]) => !used.has(y * W + x));
  const pick = (): [number, number] | null =>
    floor.length ? floor[wrndi(0, floor.length - 1)] : null;
  for (let i = 0; i < (opts.rocks ?? 14); i++) {
    const c = pick();
    if (!c) break;
    const [tx, ty] = c;
    if (used.has(ty * W + tx)) continue;
    used.add(ty * W + tx);
    w.rocks.push({ tx, ty, hp: 4, maxhp: 4, depleted: false, respawnT: 0, hurtT: 0 });
    solid[ty][tx] = true;
  }
  for (let i = 0; i < (opts.bones ?? 10); i++) {
    const c = pick();
    if (!c) break;
    const [tx, ty] = c;
    if (used.has(ty * W + tx)) continue;
    used.add(ty * W + tx);
    w.decos.push({ spr: SPR.bones, tx, ty });
  }

  bakeWorldCanvas(w, 0);

  // 7. place the treasure chest on its pre-reserved open-pocket cell (chosen in
  // step 5b), after the canvas bake so the sprite draws as a structure.
  if (treasureCell) {
    const [tx, ty] = treasureCell;
    w.structures.push({ key: "treasure", tx, ty, anim: 0 });
    solid[ty][tx] = true; // a chest is furniture, not floor
  }
  return w;
}

/**
 * Add a downward cave entrance to an already-built surface world, placed on a
 * walkable tile far from its existing entrance so the cave mouth sits out in
 * the wilds. Carves a round stone clearing and paints it onto the map canvas so
 * the entrance reads as an obvious dark "cave mouth" from a distance.
 */
export function addCaveEntrance(w: World, dest: WorldKey, seed: number): void {
  seedWorldRng(seed);
  const entrance = w.portals[0];
  const ex = entrance ? entrance.x : (w.w / 2) * TILE;
  const ey = entrance ? entrance.y : (w.h / 2) * TILE;
  const R = 3;
  // require the whole clearing to sit on land, so the cave mouth isn't jammed
  // against the coast; among those spots pick the one farthest into the wilds.
  const landAround = (tx: number, ty: number): boolean => {
    for (let oy = -R; oy <= R; oy++) {
      for (let ox = -R; ox <= R; ox++) {
        if (Math.hypot(ox, oy) > R + 0.3) continue;
        const nx = tx + ox;
        const ny = ty + oy;
        if (nx < 0 || ny < 0 || nx >= w.w || ny >= w.h || w.tile[ny][nx] === Tile.Water) return false;
      }
    }
    return true;
  };
  let best: { tx: number; ty: number } | null = null;
  let bestD = -1;
  let anyWalkable: { tx: number; ty: number } | null = null;
  for (let i = 0; i < 1200; i++) {
    const tx = wrndi(R + 2, w.w - R - 3);
    const ty = wrndi(R + 2, w.h - R - 3);
    if (w.solid[ty][tx] || w.tile[ty][tx] <= 0) continue;
    anyWalkable = { tx, ty };
    if (!landAround(tx, ty)) continue;
    const d = dist(tx * TILE, ty * TILE, ex, ey);
    if (d > bestD) { bestD = d; best = { tx, ty }; }
  }
  const spot = best ?? anyWalkable ?? { tx: (w.w / 2) | 0, ty: (w.h / 2) | 0 };
  const cx = spot.tx * TILE + TILE / 2;
  const cy = spot.ty * TILE + TILE / 2;

  // carve a round stone clearing: walkable Cave tiles, cleared of nodes/decos
  for (let oy = -R; oy <= R; oy++) {
    for (let ox = -R; ox <= R; ox++) {
      const tx = spot.tx + ox;
      const ty = spot.ty + oy;
      if (tx < 0 || ty < 0 || tx >= w.w || ty >= w.h) continue;
      if (Math.hypot(ox, oy) > R + 0.3) continue;
      if (w.tile[ty][tx] === Tile.Water) continue;
      w.tile[ty][tx] = Tile.Cave;
      w.solid[ty][tx] = false;
    }
  }
  const inClearing = (tx: number, ty: number) => Math.hypot(tx - spot.tx, ty - spot.ty) <= R + 0.3;
  w.trees = w.trees.filter((t) => !inClearing(t.tx, t.ty));
  w.rocks = w.rocks.filter((r) => !inClearing(r.tx, r.ty));
  w.herbs = w.herbs.filter((h) => !inClearing(h.tx, h.ty));
  w.decos = w.decos.filter((d) => !inClearing(d.tx, d.ty));

  // paint the clearing onto the already-baked map canvas so it shows up. That
  // canvas lives at MAP_TILE (legacy) resolution — see bakeWorldCanvas — so
  // every coordinate here is a map pixel, not a world one.
  const m = w.mapCanvas.getContext("2d")!;
  const mx = toMapPx(cx);
  const my = toMapPx(cy);
  for (let oy = -R; oy <= R; oy++) {
    for (let ox = -R; ox <= R; ox++) {
      if (Math.hypot(ox, oy) > R + 0.3) continue;
      const tx = spot.tx + ox;
      const ty = spot.ty + oy;
      if (tx < 0 || ty < 0 || tx >= w.w || ty >= w.h || w.tile[ty][tx] === Tile.Water) continue;
      const px = tx * MAP_TILE;
      const py = ty * MAP_TILE;
      const j = ((tx * 7 + ty * 13) % 9) - 4;
      m.fillStyle = `rgb(${92 + j},${88 + j},${84 + j})`;
      m.fillRect(px, py, MAP_TILE, MAP_TILE);
      m.fillStyle = "rgba(58,54,50,.6)";
      m.fillRect(px + ((tx * 5) % 12), py + ((ty * 3) % 12), 2, 1);
    }
  }
  // dark descent hole + rocky rim under the ladder
  m.fillStyle = "#54504a";
  m.beginPath(); m.ellipse(mx, my + 1, 12, 9, 0, 0, 6.2832); m.fill();
  m.fillStyle = "#26241f";
  m.beginPath(); m.ellipse(mx, my + 2, 8, 6, 0, 0, 6.2832); m.fill();

  w.portals.push({ x: cx, y: cy, dest, label: "descend into the caverns", style: "caveMouth" });
}
