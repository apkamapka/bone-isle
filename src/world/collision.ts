/** Tile collision helpers operating on a World grid (pure per-tile rules). */
import { TILE } from "../config.ts";
import { wrndi } from "../util.ts";
import { walkable, tileCenter, toTile } from "./grid.ts";
import { Tile } from "./types.ts";
import type { World, Vec, Portal } from "./types.ts";

/** Anything with a mutable world position (may also carry a logical tile). */
export interface Movable {
  x: number;
  y: number;
  tx?: number;
  ty?: number;
}

/** True if the pixel (px,py) sits on a solid tile or off-map. */
export function blockedAt(w: World, px: number, py: number): boolean {
  return !walkable(w, Math.floor(px / TILE), Math.floor(py / TILE));
}

/** True if the pixel sits on a sight-blocking tile (Wall) or off-map. Trees,
 *  rocks and water don't block sight — only proper walls do, so cave chambers
 *  and ruins genuinely break line of sight the way the cave design intends. */
function sightBlockedAt(w: World, px: number, py: number): boolean {
  const x = Math.floor(px / TILE);
  const y = Math.floor(py / TILE);
  if (x < 0 || y < 0 || x >= w.w || y >= w.h) return true;
  return w.tile[y][x] === Tile.Wall;
}

/**
 * Straight-line visibility between two points, sampled every ~12px (half a
 * tile — was 6 when a tile was 16). Used to
 * gate monster aggro so creatures behind cave walls don't chase you through
 * solid rock — you fight the caverns room by room instead of pulling a floor.
 */
export function lineOfSight(w: World, x1: number, y1: number, x2: number, y2: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 12));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (sightBlockedAt(w, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
  }
  return true;
}

/** With grid movement a body occupies exactly its own tile: "feet blocked"
 *  simply means "standing on a solid tile". Kept under the old name so save
 *  migration and placement checks read the same as before. */
export function feetBlocked(w: World, px: number, py: number): boolean {
  return blockedAt(w, px, py);
}

/**
 * If an entity is sitting on a solid tile (e.g. a house was built on it),
 * teleport it to the nearest open tile centre (spiral search) and re-sync its
 * logical tile. Returns true if it had to move. Used to rescue a player boxed
 * in by a structure placed on their tile, and on load for old saves.
 */
export function unstick(w: World, e: Movable): boolean {
  if (!feetBlocked(w, e.x, e.y)) return false;
  const cx = toTile(e.x);
  const cy = toTile(e.y);
  for (let r = 1; r < 16; r++) {
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue; // ring only
        if (walkable(w, cx + ox, cy + oy)) {
          e.x = tileCenter(cx + ox);
          e.y = tileCenter(cy + oy);
          e.tx = cx + ox;
          e.ty = cy + oy;
          return true;
        }
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
      return { x: tileCenter(x), y: tileCenter(y) };
    }
  }
  return { x: (w.w / 2) * TILE, y: (w.h / 2) * TILE };
}

/** A guaranteed-walkable tile centre just beside a portal (ring search). */
export function portalSpawn(w: World, portal?: Portal): Vec {
  const pt = portal ?? w.portals[0];
  const ptx = toTile(pt.x);
  const pty = toTile(pt.y);
  // south first (classic "step off the stairs"), then the rest of ring 1, then ring 2
  const order: ReadonlyArray<readonly [number, number]> = [
    [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1],
    [0, 2], [2, 0], [-2, 0], [0, -2], [1, 2], [-1, 2], [2, 1], [-2, 1],
  ];
  for (const [ox, oy] of order) {
    if (walkable(w, ptx + ox, pty + oy)) {
      return { x: tileCenter(ptx + ox), y: tileCenter(pty + oy) };
    }
  }
  return randomWalkable(w);
}
