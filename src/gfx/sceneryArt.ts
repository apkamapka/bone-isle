/**
 * Standing scenery: objects taller than the tile they occupy.
 *
 * `w.decos` cannot carry these. Decorations are blitted into the map canvas
 * once when the world is built, so they sit UNDER everything forever — fine
 * for bones and mushrooms lying on the floor, wrong for anything the player
 * should be able to walk behind. A skull totem is a metre and a half of pole:
 * standing north of it, the player has to be hidden by it.
 *
 * So scenery works exactly like a tree instead. The object owns one tile, that
 * tile is solid, and the sprite is anchored bottom-centre from the depth-sorted
 * draw list — which means the part of it that overhangs the tile above is drawn
 * after (and therefore over) anything standing up there. No special case is
 * needed for the overhang; the y-sort already does it.
 *
 * Loading is asynchronous and failure is harmless: each kind names a baked
 * sprite to stand in for it, so a missing or slow PNG costs looks and nothing
 * else. Headless there is no `Image` and no `document`, the loader no-ops, and
 * the smoke tests run against the fallbacks.
 */
import { SPR, adoptSprite, type SpriteName } from "./sprites.ts";
import type { SceneryKind } from "../world/types.ts";

const SRC: Record<SceneryKind, string> = {
  skullPole: "./prop-skullpole.png",
  deadTree: "./prop-tree-dead.png",
  felledTree: "./prop-tree-felled.png",
};

/**
 * What to draw before the artwork lands. The totem has a real baked ancestor —
 * it IS the drawn version of `SPR.skullPole`, the pole the wilderness camps
 * already plant. The two trees have none, so they borrow the stump: wrong size,
 * right idea, and never seen unless a PNG goes missing.
 */
const FALLBACK: Record<SceneryKind, SpriteName> = {
  skullPole: "skullPole",
  deadTree: "stump",
  felledTree: "stump",
};

export const SCENERY_KINDS = Object.keys(SRC) as SceneryKind[];

const art: Partial<Record<SceneryKind, HTMLCanvasElement>> = {};

/** Start loading every scenery image. No-op headless, safe to repeat. */
export function loadSceneryArt(): void {
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  for (const kind of SCENERY_KINDS) {
    if (art[kind]) continue;
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      const x = cv.getContext("2d")!;
      x.imageSmoothingEnabled = false;
      x.drawImage(img, 0, 0);
      art[kind] = adoptSprite(cv);
    };
    img.onerror = () => {
      console.warn(`scenery '${kind}' failed to load, the baked stand-in stays`);
    };
    img.src = SRC[kind];
  }
}

/** True once this kind is showing its drawn artwork. */
export function hasSceneryArt(kind: SceneryKind): boolean {
  return art[kind] !== undefined;
}

/** The sprite to draw: loaded artwork if there is any, else the baked stand-in. */
export function scenerySprite(kind: SceneryKind): HTMLCanvasElement {
  return art[kind] ?? SPR[FALLBACK[kind]];
}
