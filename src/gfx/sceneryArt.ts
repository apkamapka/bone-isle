/**
 * Standing scenery: objects taller than the tile they occupy.
 *
 * `w.decos` cannot carry these. Decorations are blitted into the map canvas
 * once when the world is built, so they sit UNDER everything forever — fine
 * for bones and mushrooms lying on the floor, wrong for anything the player
 * should be able to walk behind. A skull totem is a metre and a half of pole:
 * standing north of it, the player has to be hidden by it.
 *
 * So scenery works exactly like a tree instead. The object claims a block of
 * tiles, only the bottom row of that block is solid, and the sprite is anchored
 * bottom-centre from the depth-sorted draw list — which means the part of it
 * that overhangs the rows above is drawn after (and therefore over) anything
 * standing up there. No special case is needed for the overhang; the y-sort
 * already does it. See `FOOTPRINT` for what an object claims and `BLOCK` for
 * what it refuses.
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
  well: "./prop-well.png",
  tent: "./prop-tent.png",
  boulderA: "./prop-boulder-a.png",
  boulderB: "./prop-boulder-b.png",
  barn: "./prop-barn.png",
  houseA: "./prop-house-a.png",
  houseB: "./prop-house-b.png",
  smithy: "./prop-smithy.png",
  windmill: "./prop-windmill.png",
  // The town set — thirty files, one kind each, all `prop-town-*`.
  chapel: "./prop-town-chapel.png", shrine: "./prop-town-shrine.png",
  shop: "./prop-town-shop.png", townhouse: "./prop-town-townhouse.png",
  watchtower: "./prop-town-watchtower.png",
  shophouse: "./prop-town-shophouse.png", cottage: "./prop-town-cottage.png",
  bank: "./prop-town-bank.png", observatory: "./prop-town-observatory.png",
  storefront: "./prop-town-storefront.png",
  shoprow: "./prop-town-shoprow.png", keep: "./prop-town-keep.png",
  workshop: "./prop-town-workshop.png",
  warehouse: "./prop-town-warehouse.png", temple: "./prop-town-temple.png",
  apothecary: "./prop-town-apothecary.png", inn: "./prop-town-inn.png",
  manor: "./prop-town-manor.png", towerhouse: "./prop-town-towerhouse.png",
  market: "./prop-town-market.png", tavern: "./prop-town-tavern.png",
  tradehouse: "./prop-town-tradehouse.png",
  stonehouse: "./prop-town-stonehouse.png",
  greatTemple: "./prop-town-greattemple.png",
  guildhall: "./prop-town-guildhall.png",
  stallRed: "./prop-town-stall-red.png",
  stallGrey: "./prop-town-stall-grey.png",
  stallOpen: "./prop-town-stall-open.png",
  windmillCloth: "./prop-town-windmill-cloth.png",
  windmillLattice: "./prop-town-windmill-lattice.png",
};

/* What each kind is CALLED, the tiles it stands on, what its picture paints
 * and what it refuses are facts about the object, not about its artwork: the
 * map parser needs them, and so will a server with no screen. They live in
 * world/scenery.ts since Etap 3.1b and are re-exported here for old paths. */
export { SCENERY_NAME, FOOTPRINT, ART_SPILL, paintedTiles, BLOCK } from "../world/scenery.ts";

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
  well: "rock",
  tent: "tent",
  boulderA: "rock",
  boulderB: "rock",
  // Wrong size by a mile, right idea, and never seen unless a PNG goes missing.
  barn: "hut",
  houseA: "hut",
  houseB: "hut",
  smithy: "hut",
  windmill: "hut",
  chapel: "hut", shrine: "hut", shop: "hut", townhouse: "hut",
  watchtower: "hut", shophouse: "hut", cottage: "hut", bank: "hut",
  observatory: "hut", storefront: "hut", shoprow: "hut", keep: "hut",
  workshop: "hut", warehouse: "hut", temple: "hut", apothecary: "hut",
  inn: "hut", manor: "hut", towerhouse: "hut", market: "hut", tavern: "hut",
  tradehouse: "hut", stonehouse: "hut", greatTemple: "hut", guildhall: "hut",
  stallRed: "hut", stallGrey: "hut", stallOpen: "hut", windmillCloth: "hut",
  windmillLattice: "hut",
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
