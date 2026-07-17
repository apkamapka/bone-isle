/**
 * Tile-grid movement core (Tibia-style). Every creature logically stands on
 * exactly ONE tile (tx,ty) and its render position (x,y) glides smoothly
 * toward that tile's centre. A step claims the destination tile immediately,
 * so no two creatures can ever share a square — a free tile is always a real
 * escape route, and a small rock blocks exactly its own tile, nothing more.
 */
import { TILE } from "../config.ts";
import type { World } from "./types.ts";

/** Anything that walks the grid: logical tile + gliding render position. */
export interface GridWalker {
  x: number;
  y: number;
  tx: number;
  ty: number;
}

/** Pixel coordinate → tile index. */
export function toTile(p: number): number {
  return Math.floor(p / TILE);
}

/** Tile index → pixel centre of that tile. */
export function tileCenter(t: number): number {
  return t * TILE + TILE / 2;
}

/** Set both the logical tile AND the render position from a pixel point. */
export function placeWalker(e: GridWalker, px: number, py: number): void {
  e.tx = toTile(px);
  e.ty = toTile(py);
  e.x = tileCenter(e.tx);
  e.y = tileCenter(e.ty);
}

/** Re-derive the logical tile from the current render position and snap. */
export function snapWalker(e: GridWalker): void {
  placeWalker(e, e.x, e.y);
}

/** True when the render position sits exactly on the logical tile centre. */
export function atCenter(e: GridWalker): boolean {
  return e.x === tileCenter(e.tx) && e.y === tileCenter(e.ty);
}

/** In-bounds and not solid. The single terrain test for grid movement. */
export function walkable(w: World, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= w.w || ty >= w.h) return false;
  return !w.solid[ty][tx];
}

/** Occupancy probe: is the tile claimed by some OTHER body? */
export type Occupied = (tx: number, ty: number) => boolean;

/**
 * Glide the render position toward the logical tile centre, spending up to
 * `budget` pixels. Returns the UNSPENT budget — 0 while still travelling,
 * positive once the centre is reached (snap included), so callers can chain
 * `glide → step → glide` inside one frame and keep long strides seamless.
 */
export function glideWalker(e: GridWalker, budget: number): number {
  const cx = tileCenter(e.tx);
  const cy = tileCenter(e.ty);
  const dx = cx - e.x;
  const dy = cy - e.y;
  const d = Math.hypot(dx, dy);
  if (d <= budget) {
    e.x = cx;
    e.y = cy;
    return budget - d;
  }
  if (d > 0) {
    e.x += (dx / d) * budget;
    e.y += (dy / d) * budget;
  }
  return 0;
}

/**
 * Claim a step onto the neighbouring tile (sx,sy ∈ {-1,0,1}). Succeeds only
 * from the tile centre, onto walkable, unoccupied ground. Diagonals need just
 * the destination free (Tibia rule) — you CAN slip diagonally between two
 * orthogonally-adjacent monsters, which is exactly the escape the ring leaves.
 */
export function tryStep(w: World, e: GridWalker, sx: number, sy: number, occ?: Occupied): boolean {
  if (!sx && !sy) return false;
  const nx = e.tx + sx;
  const ny = e.ty + sy;
  if (!walkable(w, nx, ny)) return false;
  if (occ && occ(nx, ny)) return false;
  e.tx = nx;
  e.ty = ny;
  return true;
}

/** Chebyshev distance in tiles — 1 means "adjacent, diagonals included". */
export function chebTiles(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Quantise an analog direction (joystick / WASD sum) to one of 8 steps. */
export function stepDir(dx: number, dy: number): { sx: number; sy: number } {
  if (!dx && !dy) return { sx: 0, sy: 0 };
  const a = Math.atan2(dy, dx);
  const oct = Math.round(a / (Math.PI / 4));
  const DIRS: ReadonlyArray<readonly [number, number]> = [
    [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
  ];
  const [sx, sy] = DIRS[((oct % 8) + 8) % 8];
  return { sx, sy };
}

/** All 8 neighbour steps, orthogonals first. */
export const STEPS8: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** Octile distance ×10 (diag=14) — the walking-time metric for 8-dir grids. */
export function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return 10 * Math.max(dx, dy) + 4 * Math.min(dx, dy);
}

/* ---------------- A* pathfinding ---------------- */

interface PathOpts {
  /** Route THROUGH occupied tiles is refused, but the goal itself may be a
   *  creature's tile (walking up to a monster / NPC). Default true. */
  goalMayBeOccupied?: boolean;
  /** Node-expansion cap; past it the best-effort partial path is returned. */
  maxNodes?: number;
}

/**
 * 8-directional A* over walkable+unoccupied tiles (octile heuristic, straight
 * 10 / diagonal 14, so routes minimise walking TIME). Returns the tile list
 * from the first step (start excluded) to the goal. If the goal is solid,
 * occupied or unreachable, returns the best-effort path to the reachable tile
 * closest to it — Tibia's map-click behaviour: walk as near as you can get.
 */
export function findPath(
  w: World,
  sx: number,
  sy: number,
  gx: number,
  gy: number,
  occ?: Occupied,
  opts?: PathOpts,
): { x: number; y: number }[] {
  const maxNodes = opts?.maxNodes ?? 6000;
  const goalOcc = opts?.goalMayBeOccupied ?? true;
  if (sx === gx && sy === gy) return [];

  const W = w.w;
  const idx = (x: number, y: number): number => y * W + x;
  const gCost = new Map<number, number>();
  const parent = new Map<number, number>();
  // binary min-heap of [f, g, x, y]
  const heap: [number, number, number, number][] = [];
  const push = (f: number, g: number, x: number, y: number): void => {
    heap.push([f, g, x, y]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = (): [number, number, number, number] | undefined => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length && last) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let s = i;
        if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
        if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
        if (s === i) break;
        [heap[s], heap[i]] = [heap[i], heap[s]];
        i = s;
      }
    }
    return top;
  };

  const passable = (x: number, y: number): boolean => {
    if (!walkable(w, x, y)) return false;
    if (x === gx && y === gy) return goalOcc || !occ || !occ(x, y);
    return !occ || !occ(x, y);
  };

  gCost.set(idx(sx, sy), 0);
  push(octile(sx, sy, gx, gy), 0, sx, sy);
  let bestKey = idx(sx, sy);
  let bestH = octile(sx, sy, gx, gy);
  let expanded = 0;

  while (heap.length && expanded < maxNodes) {
    const node = pop();
    if (!node) break;
    const [, g, x, y] = node;
    const key = idx(x, y);
    if (g > (gCost.get(key) ?? Infinity)) continue; // stale heap entry
    expanded++;
    if (x === gx && y === gy) { bestKey = key; break; }
    const h = octile(x, y, gx, gy);
    if (h < bestH) { bestH = h; bestKey = key; }
    for (const [ox, oy] of STEPS8) {
      const nx = x + ox;
      const ny = y + oy;
      if (!passable(nx, ny)) continue;
      const nk = idx(nx, ny);
      const ng = g + (ox && oy ? 14 : 10);
      if (ng >= (gCost.get(nk) ?? Infinity)) continue;
      gCost.set(nk, ng);
      parent.set(nk, key);
      push(ng + octile(nx, ny, gx, gy), ng, nx, ny);
    }
  }

  // walk parents back from the goal (or the closest reached tile)
  const out: { x: number; y: number }[] = [];
  let cur = bestKey;
  const startKey = idx(sx, sy);
  while (cur !== startKey) {
    out.push({ x: cur % W, y: Math.floor(cur / W) });
    const p = parent.get(cur);
    if (p === undefined) return [];
    cur = p;
  }
  out.reverse();
  return out;
}
