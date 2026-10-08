/**
 * The picture a creature is drawn with when it has no walk-sheet frame to show
 * (Etap 3.1b moved this here from entities/monsters.ts).
 *
 * A creature's definition names its baked stand-in (`MonsterDef.art`); this is
 * where the name becomes a canvas. Drawn artwork loaded from a PNG takes over
 * from the bake for its kind the moment it lands. Nothing is copied onto the
 * creatures any more, so nothing has to be swept when a picture arrives: the
 * next frame simply asks again.
 */
import { SPR } from "./sprites.ts";
import { MONSTER_DEFS } from "../entities/monsters.ts";
import type { MonsterKind } from "../world/types.ts";

/** Creature artwork loaded from PNGs, keyed by kind. */
const mobArt: Partial<Record<MonsterKind, HTMLCanvasElement>> = {};

/** Install artwork for a creature; pass null to fall back to the baked sprite. */
export function setMobArt(k: MonsterKind, c: HTMLCanvasElement | null): void {
  if (c) mobArt[k] = c;
  else delete mobArt[k];
}

/** The sprite a creature of this kind should draw with. */
export function mobSprite(k: MonsterKind): HTMLCanvasElement {
  return mobArt[k] ?? SPR[MONSTER_DEFS[k].art];
}
