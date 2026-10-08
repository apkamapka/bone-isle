/**
 * What the character's outfit looks like (Etap 3.1b moved this here from
 * systems/outfit.ts, which now only says what is worn).
 *
 * Two pictures follow the Wardrobe. The LPC hero (gfx/heroSheet.ts) is the one
 * on screen: it is told which clothes and which four dyes, and rebuilds itself
 * when either changes. The baked Adventurer — three small pixel maps, dyed at
 * bake time — is the fallback for when the hero's sheets are not loaded, and
 * the Wardrobe's preview in that case.
 *
 * Nothing on the character holds either picture any more. `syncOutfitArt()`
 * runs every frame and passes the look and the dyes on only when they differ
 * from what the hero already wears, and `outfitSprites()` re-bakes only when
 * the outfit or a dye has changed.
 */
import { PLAYER_MAP, bake } from "./sprites.ts";
import { ADV_DOWN, ADV_SIDE, ADV_UP } from "./adventurer.ts";
import { setHeroDyes, setHeroLook, type HeroZone } from "./heroSheet.ts";
import {
  OUTFITS, OUTFIT_COLORS, DEFAULT_OUTFIT, outfitState, heroLookOf,
  type Facing, type OutfitFrames,
} from "../systems/outfit.ts";

/** The baked outfit in all three facings. `left` is `side` mirrored. */
export type DirSprites = Readonly<Record<Facing, HTMLCanvasElement>>;

function oneView(map: readonly string[]): Readonly<Record<Facing, readonly string[]>> {
  return { down: map, side: map, up: map };
}

/** The pixel maps each named frame set stands for. Single-view sets (the
 *  original Classic map) repeat one map, so every outfit bakes the same way. */
const FRAME_MAPS: Readonly<Record<OutfitFrames, Readonly<Record<Facing, readonly string[]>>>> = {
  adventurer: { down: ADV_DOWN, side: ADV_SIDE, up: ADV_UP },
  classic: oneView(PLAYER_MAP),
};

/** Darken a #rrggbb color — the shade glyphs (H, R, P) derive from the base
 *  dye so every color choice keeps the sprite's original shading. */
function darken(hex: string, f = 0.68): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Bake the current outfit + dyes into a fresh set of directional sprites. */
export function bakeOutfitSprites(): DirSprites {
  const state = outfitState();
  const o = OUTFITS[state.current] ?? OUTFITS[DEFAULT_OUTFIT];
  const maps = FRAME_MAPS[o.frames];
  const hair = OUTFIT_COLORS[state.hair] ?? OUTFIT_COLORS[0];
  const prim = OUTFIT_COLORS[state.primary] ?? OUTFIT_COLORS[1];
  const sec = OUTFIT_COLORS[state.secondary] ?? OUTFIT_COLORS[2];
  const over = {
    h: hair, H: darken(hair),
    r: prim, R: darken(prim),
    p: sec, P: darken(sec),
  };
  return {
    down: bake(maps.down, over),
    side: bake(maps.side, over),
    up: bake(maps.up, over),
  };
}

let cached: DirSprites | null = null;
let cachedFor = "";

/** The baked outfit as it is worn right now — re-baked only after a change. */
export function outfitSprites(): DirSprites {
  const s = outfitState();
  const key = `${s.current}|${s.hair}|${s.primary}|${s.secondary}`;
  if (!cached || key !== cachedFor) {
    cached = bakeOutfitSprites();
    cachedFor = key;
  }
  return cached;
}

/** The four Wardrobe dyes as hex, mapped to the LPC hero's layer zones. */
export function heroDyeColors(): Record<HeroZone, string> {
  const s = outfitState();
  const at = (i: number, fb: string) => OUTFIT_COLORS[i] ?? fb;
  return {
    hair: at(s.hair, "#929292"),
    shirt: at(s.primary, "#494949"),
    pants: at(s.secondary, "#494949"),
    shoes: at(s.shoes, "#242424"),
  };
}

/**
 * Dress the LPC hero in what the character wears now. Cheap to call every
 * frame: the hero acts only on a look or a dye it is not already wearing.
 */
export function syncOutfitArt(): void {
  setHeroLook(heroLookOf(outfitState().current));
  setHeroDyes(heroDyeColors());
}
