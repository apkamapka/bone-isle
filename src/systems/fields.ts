/**
 * Burning ground: tiles a creature's spell has set alight (Etap 3.1a).
 *
 * This used to live in gfx/spellFx.ts beside the blasts and bolts, and it was
 * the odd one out there. A blast is a picture — it plays and it is gone. A
 * field outlives its animation and HURTS whoever stands on it: monsterSpells
 * reads `burningTiles` to decide who burns. That makes it world state, and
 * world state has to exist where there is no screen, so it moved here. The
 * client draws it from this list (`allFields`), exactly as it did before.
 *
 * Re-lighting a tile that is already burning REFRESHES it rather than
 * stacking a second flame on the same square: two fields on one tile draw at
 * double brightness and read as a bug, and the damage tick would charge twice
 * for standing still once.
 */
import { TILE } from "../config.ts";
import type { Element, Tier } from "./elements.ts";
import type { World } from "../world/types.ts";

/**
 * One burning tile. `life` is the WHOLE burn, not the animation's length: the
 * sheet loops underneath for as long as the field lasts.
 */
export interface Field {
  world: World;
  /** Tile indices, so the damage tick can compare them without arithmetic. */
  tx: number;
  ty: number;
  /** Tile CENTRE in world px. */
  x: number;
  y: number;
  el: Element;
  tier: Tier;
  /** Seconds it has burned. */
  t: number;
  life: number;
}

const fields: Field[] = [];

/** Set a tile alight for `life` seconds. */
export function addField(
  world: World, tx: number, ty: number, el: Element, tier: Tier, life: number,
): void {
  const live = fields.find((f) => f.world === world && f.tx === tx && f.ty === ty);
  if (live) {
    live.el = el;
    live.tier = tier;
    live.t = 0;
    live.life = Math.max(live.life, life);
    return;
  }
  fields.push({
    world, tx, ty,
    x: tx * TILE + TILE / 2,
    y: ty * TILE + TILE / 2,
    el, tier, t: 0, life,
  });
}

/**
 * The tiles burning in `world` right now, for whoever has to decide that
 * standing there hurts. Returned as a fresh array: the caller must not be able
 * to reach in and edit the list it is iterating.
 */
export function burningTiles(world: World): { tx: number; ty: number; el: Element }[] {
  return fields
    .filter((f) => f.world === world)
    .map((f) => ({ tx: f.tx, ty: f.ty, el: f.el }));
}

/** Let every fire burn `dt` seconds; the ones that are spent go out. */
export function tickFields(dt: number): void {
  for (let i = fields.length - 1; i >= 0; i--) {
    const f = fields[i];
    f.t += dt;
    if (f.t >= f.life) fields.splice(i, 1);
  }
}

/** Every burning tile on every map, for the client to draw. Read-only. */
export function allFields(): readonly Field[] {
  return fields;
}

export function fieldCount(): number {
  return fields.length;
}

/** Put every fire out — the tests, and nothing else so far. */
export function clearFields(): void {
  fields.length = 0;
}
