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

  // 7. optional treasure chest — on the floor cell FARTHEST from the up-ladder,
  // so the whole cavern must be crossed to reach it. Chosen by pure computation
  // (no RNG draws) and placed after the canvas bake, so adding it never
  // perturbs the generation stream: old saves regenerate identical floors.
  if (opts.treasure) {
    const upLadder = w.portals.find((pt) => pt.style === "ladderUp");
    const ux = upLadder ? upLadder.x : 0;
    const uy = upLadder ? upLadder.y : 0;
    let best: [number, number] | null = null;
    let bestD = -1;
    for (const [tx, ty] of region) {
      if (used.has(ty * W + tx)) continue;
      const d = dist(tx * TILE + TILE / 2, ty * TILE + TILE / 2, ux, uy);
      if (d > bestD) { bestD = d; best = [tx, ty]; }
    }
    if (best) {
      const [tx, ty] = best;
      w.structures.push({ key: "treasure", tx, ty, anim: 0 });
      solid[ty][tx] = true; // a chest is furniture, not floor
    }
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

  // paint the clearing onto the already-baked map canvas so it shows up
  const m = w.mapCanvas.getContext("2d")!;
  for (let oy = -R; oy <= R; oy++) {
    for (let ox = -R; ox <= R; ox++) {
      if (Math.hypot(ox, oy) > R + 0.3) continue;
      const tx = spot.tx + ox;
      const ty = spot.ty + oy;
      if (tx < 0 || ty < 0 || tx >= w.w || ty >= w.h || w.tile[ty][tx] === Tile.Water) continue;
      const px = tx * TILE;
      const py = ty * TILE;
      const j = ((tx * 7 + ty * 13) % 9) - 4;
      m.fillStyle = `rgb(${92 + j},${88 + j},${84 + j})`;
      m.fillRect(px, py, TILE, TILE);
      m.fillStyle = "rgba(58,54,50,.6)";
      m.fillRect(px + ((tx * 5) % 12), py + ((ty * 3) % 12), 2, 1);
    }
  }
  // dark descent hole + rocky rim under the ladder
  m.fillStyle = "#54504a";
  m.beginPath(); m.ellipse(cx, cy + 1, 12, 9, 0, 0, 6.2832); m.fill();
  m.fillStyle = "#26241f";
  m.beginPath(); m.ellipse(cx, cy + 2, 8, 6, 0, 0, 6.2832); m.fill();

  w.portals.push({ x: cx, y: cy, dest, label: "descend into the caverns", style: "caveMouth" });
}
