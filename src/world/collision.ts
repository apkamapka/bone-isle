/** Tile collision and movement helpers operating on a World grid. */
import { TILE, MAP_W, MAP_H, CENTER_X, CENTER_Y } from "../config.ts";
import { rndi } from "../util.ts";
import type { World, Vec } from "./types.ts";

/** Anything with a mutable world position. */
export interface Movable {
  x: number;
  y: number;
}

/** True if the pixel (px,py) sits on a solid tile or off-map. */
export function blockedAt(w: World, px: number, py: number): boolean {
  const x = Math.floor(px / TILE);
  const y = Math.floor(py / TILE);
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return true;
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

/** A random walkable tile center (for spawns). */
export function randomWalkable(w: World): Vec {
  for (let i = 0; i < 500; i++) {
    const x = rndi(2, MAP_W - 3);
    const y = rndi(2, MAP_H - 3);
    if (!w.solid[y][x] && w.tile[y][x] > 0) {
      return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
    }
  }
  return { x: CENTER_X * TILE, y: CENTER_Y * TILE };
}

/** A guaranteed-walkable spot just beside a world's portal. */
export function portalSpawn(w: World): Vec {
  const cand: ReadonlyArray<readonly [number, number]> = [
    [0, 14], [0, -14], [14, 0], [-14, 0], [10, 12], [-10, 12], [0, 22],
  ];
  for (const [ox, oy] of cand) {
    const x = w.portal.x + ox;
    const y = w.portal.y + oy;
    if (
      !blockedAt(w, x - 4, y - 2) && !blockedAt(w, x + 4, y - 2) &&
      !blockedAt(w, x - 4, y + 2) && !blockedAt(w, x + 4, y + 2)
    ) return { x, y };
  }
  return randomWalkable(w);
}
