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

/**
 * The haven band inside an otherwise hostile map: rows 0..safeMaxY.
 *
 * Creatures consult THIS — not `isSafeTile` — before spawning and before every
 * step, and the distinction matters. A wholly safe world already keeps its
 * monsters out by never running their update at all; folding that case in here
 * as well would also forbid deliberately placing creatures on a safe map,
 * which the test arenas rely on. So this answers false when there is no band.
 */
export function inHavenBand(w: World, ty: number): boolean {
  return w.safeMaxY !== undefined && ty <= w.safeMaxY;
}

/** Is the player standing somewhere nothing can reach them? Used for the
 *  zone label, where a wholly safe map counts as safe everywhere. */
export function isSafeTile(w: World, _tx: number, ty: number): boolean {
  return w.safe || inHavenBand(w, ty);
}

/** Where an arriving player lands: the map's authored spawn tile when it has
 *  one, otherwise the classic "step off the portal" ring search. */
export function worldSpawn(w: World): Vec {
  return w.spawn ?? portalSpawn(w);
}

/**
 * Does the world point (px,py) stand on `pt`?
 *
 * A plain pad is one tile and keeps the classic radius test — you have to be
 * on the swirl, not merely in the same square. A pad with a `span` covers a
 * whole block of tiles and is tested as a rectangle instead, so every square
 * of a 2x2 pad carries you rather than just the one the glyph was authored on.
 *
 * `reach` widens the single-tile radius; it is ignored for spanned pads, whose
 * footprint is already exactly the painted block.
 */
export function portalCovers(pt: Portal, px: number, py: number, reach = 22): boolean {
  const span = pt.span ?? 1;
  if (span <= 1) return Math.hypot(px - pt.x, py - pt.y) < reach;
  const half = (span * TILE) / 2;
  return Math.abs(px - pt.x) <= half && Math.abs(py - pt.y) <= half;
}

/** Every tile a portal sits on — one square, or the whole spanned block. */
export function portalTiles(pt: Portal): Array<{ tx: number; ty: number }> {
  const span = pt.span ?? 1;
  const x0 = toTile(pt.x - (span * TILE) / 2 + TILE / 2);
  const y0 = toTile(pt.y - (span * TILE) / 2 + TILE / 2);
  const out: Array<{ tx: number; ty: number }> = [];
  for (let dy = 0; dy < span; dy++) {
    for (let dx = 0; dx < span; dx++) out.push({ tx: x0 + dx, ty: y0 + dy });
  }
  return out;
}

/** A guaranteed-walkable tile centre just beside a portal (ring search). */
export function portalSpawn(w: World, portal?: Portal): Vec {
  const pt = portal ?? w.portals[0];
  const ptx = toTile(pt.x);
  const pty = toTile(pt.y);
  // Never land ON the pad you arrived by: with a spanned pad the tile beside
  // its centre can still be part of the block, and standing on it would fire
  // the portal again and bounce you straight back where you came from.
  const own = new Set(portalTiles(pt).map((t) => `${t.tx},${t.ty}`));
  // south first (classic "step off the stairs"), then the rest of ring 1, then ring 2
  const order: ReadonlyArray<readonly [number, number]> = [
    [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1],
    [0, 2], [2, 0], [-2, 0], [0, -2], [1, 2], [-1, 2], [2, 1], [-2, 1],
  ];
  for (const [ox, oy] of order) {
    if (own.has(`${ptx + ox},${pty + oy}`)) continue;
    if (walkable(w, ptx + ox, pty + oy)) {
      return { x: tileCenter(ptx + ox), y: tileCenter(pty + oy) };
    }
  }
  return randomWalkable(w);
}
