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

/** Feet-box half extents used for entity collision. */
const HW = 4;
const HH = 2;

/** How many of the feet-box corners at (px,py) sit on solid tiles (0–4). */
function feetCorners(w: World, px: number, py: number): number {
  let n = 0;
  if (blockedAt(w, px - HW, py - HH)) n++;
  if (blockedAt(w, px + HW, py - HH)) n++;
  if (blockedAt(w, px - HW, py + HH)) n++;
  if (blockedAt(w, px + HW, py + HH)) n++;
  return n;
}

/** True if the entity's feet-box at (px,py) overlaps any solid tile. */
export function feetBlocked(w: World, px: number, py: number): boolean {
  return feetCorners(w, px, py) > 0;
}

/**
 * Move an entity by (dx,dy), resolving each axis separately so it slides along
 * walls instead of sticking. A move is allowed when the destination is fully
 * clear, OR when it reduces how much the feet overlap solid tiles — so an entity
 * that ended up inside a wall (e.g. a house built on its tile) can always walk
 * back out, but can't walk deeper into one.
 */
export function moveEntity(w: World, e: Movable, dx: number, dy: number): void {
  if (dx !== 0) {
    const cur = feetCorners(w, e.x, e.y);
    const nb = feetCorners(w, e.x + dx, e.y);
    // when clear (cur=0) this requires nb=0 as before; when embedded it just
    // forbids going *deeper*, so a trapped entity can always escape any direction
    if (nb <= cur) e.x += dx;
  }
  if (dy !== 0) {
    const cur = feetCorners(w, e.x, e.y);
    const nb = feetCorners(w, e.x, e.y + dy);
    if (nb <= cur) e.y += dy;
  }
}

/**
 * If an entity is sitting inside a solid tile, teleport it to the nearest open
 * tile centre (spiral search). Returns true if it had to move. Used to rescue
 * a player boxed in by a structure placed on their tile, and on load for old
 * saves that were left stuck.
 */
export function unstick(w: World, e: Movable): boolean {
  if (!feetBlocked(w, e.x, e.y)) return false;
  const cx = Math.floor(e.x / TILE);
  const cy = Math.floor(e.y / TILE);
  for (let r = 1; r < 16; r++) {
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue; // ring only
        const px = (cx + ox) * TILE + TILE / 2;
        const py = (cy + oy) * TILE + TILE / 2;
        if (!feetBlocked(w, px, py)) { e.x = px; e.y = py; return true; }
      }
    }
  }
  return false;
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
