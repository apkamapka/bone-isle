/** Tile collision and movement helpers operating on a World grid. */
import { TILE } from "../config.ts";
import { wrndi } from "../util.ts";
import type { World, Vec, Portal } from "./types.ts";

/** Anything with a mutable world position. */
export interface Movable {
  x: number;
  y: number;
}

/** True if the pixel (px,py) sits on a solid tile or off-map. */
export function blockedAt(w: World, px: number, py: number): boolean {
  const x = Math.floor(px / TILE);
  const y = Math.floor(py / TILE);
  if (x < 0 || y < 0 || x >= w.w || y >= w.h) return true;
  return w.solid[y][x];
}

/**
 * Move an entity by (dx,dy), resolving each axis separately so it slides
 * along walls instead of sticking. Uses a small feet-box for collision.
 */
export function moveEntity(w: World, e: Movable, dx: number, dy: number): void {
  const hw = 4;
  const hh = 2;
  if (dx !== 0) {
    const nx = e.x + dx;
    if (
      !blockedAt(w, nx - hw, e.y - hh) && !blockedAt(w, nx + hw, e.y - hh) &&
      !blockedAt(w, nx - hw, e.y + hh) && !blockedAt(w, nx + hw, e.y + hh)
    ) e.x = nx;
  }
  if (dy !== 0) {
    const ny = e.y + dy;
    if (
      !blockedAt(w, e.x - hw, ny - hh) && !blockedAt(w, e.x + hw, ny - hh) &&
      !blockedAt(w, e.x - hw, ny + hh) && !blockedAt(w, e.x + hw, ny + hh)
    ) e.y = ny;
  }
}

/** A random walkable tile center (for spawns). Deterministic (world RNG). */
export function randomWalkable(w: World): Vec {
  for (let i = 0; i < 800; i++) {
    const x = wrndi(2, w.w - 3);
    const y = wrndi(2, w.h - 3);
    if (!w.solid[y][x] && w.tile[y][x] > 0) {
      return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
    }
  }
  return { x: (w.w / 2) * TILE, y: (w.h / 2) * TILE };
}

/** A guaranteed-walkable spot just beside a portal. */
export function portalSpawn(w: World, portal?: Portal): Vec {
  const pt = portal ?? w.portals[0];
  const cand: ReadonlyArray<readonly [number, number]> = [
    [0, 14], [0, -14], [14, 0], [-14, 0], [10, 12], [-10, 12], [0, 22],
  ];
  for (const [ox, oy] of cand) {
    const x = pt.x + ox;
    const y = pt.y + oy;
    if (
      !blockedAt(w, x - 4, y - 2) && !blockedAt(w, x + 4, y - 2) &&
      !blockedAt(w, x - 4, y + 2) && !blockedAt(w, x + 4, y + 2)
    ) return { x, y };
  }
  return randomWalkable(w);
}
