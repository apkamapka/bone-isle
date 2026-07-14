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
import { TILE } from "../config.ts";
import { SPR } from "../gfx/sprites.ts";
import { seedWorldRng, wrand, wrndi, dist } from "../util.ts";
import { bakeWorldCanvas } from "./generate.ts";
import { Tile } from "./types.ts";
import type { World, WorldKey, Portal } from "./types.ts";

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
}

/** Count wall cells within Chebyshev radius `r`, out-of-bounds counts as wall. */
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
  // fill everything that isn't the winning region
  const keep = new Set(best.map(([x, y]) => y * W + x));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!wall[y][x] && !keep.has(y * W + x)) wall[y][x] = true;
    }
  }
  return best;
}

export function makeCaveWorld(opts: CaveOpts): World {
  const W = opts.w;
  const H = opts.h;
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
    coastWater: [],
    landR: () => Math.max(W, H),
    mapCanvas: document.createElement("canvas"),
  };

  // 5. ladders on opposite ends of the cavern (so the floor must be crossed)
  const used = new Set<number>();
  const byCorner = (sign: number) =>
    region.reduce((best, c) => (sign * (c[0] + c[1]) > sign * (best[0] + best[1]) ? c : best), region[0]);
  const pushLadder = (cell: [number, number], dest: WorldKey, style: Portal["style"], label: string) => {
    const [tx, ty] = cell;
    used.add(ty * W + tx);
    w.portals.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, dest, label, style });
  };
  if (opts.up) pushLadder(byCorner(-1), opts.up, "ladderUp", "climb up");   // top-left extreme
  if (opts.down) pushLadder(byCorner(1), opts.down, "ladderDown", "descend"); // bottom-right extreme

  // 6. ore veins + bones, scattered on floor tiles away from the ladders
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
  return w;
}

/**
 * Add a downward ladder to an already-built surface world, placed on a walkable
 * tile far from its existing entrance so the cave mouth sits out in the wilds.
 */
export function addCaveEntrance(w: World, dest: WorldKey, seed: number): void {
  seedWorldRng(seed);
  const entrance = w.portals[0];
  const ex = entrance ? entrance.x : (w.w / 2) * TILE;
  const ey = entrance ? entrance.y : (w.h / 2) * TILE;
  let best: { x: number; y: number } | null = null;
  let bestD = -1;
  for (let i = 0; i < 600; i++) {
    const tx = wrndi(2, w.w - 3);
    const ty = wrndi(2, w.h - 3);
    if (w.solid[ty][tx] || w.tile[ty][tx] <= 0) continue;
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    const d = dist(cx, cy, ex, ey);
    if (d > bestD) { bestD = d; best = { x: cx, y: cy }; }
  }
  const spot = best ?? { x: (w.w / 2) * TILE, y: (w.h / 2) * TILE };
  w.portals.push({ x: spot.x, y: spot.y, dest, label: "descend into the caverns", style: "ladderDown" });
}
