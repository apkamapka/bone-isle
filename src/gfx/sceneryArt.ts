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
};

/**
 * How many tiles each kind stands on, growing right and down from the tile it
 * names. A totem is a pole and owns its single square; a well is four squares
 * of stonework and has to seal all four, or the player walks into the middle
 * of it. The sprite is centred over the block, not over the corner tile.
 */
/**
 * What each of these is CALLED, for the look.
 *
 * Kept here beside the footprint rather than in the look code: the two facts
 * about a piece of scenery that anything outside this file ever needs are how
 * big it is and what to call it, and splitting them across two modules is how
 * a new kind arrives with a size and no name.
 */
export const SCENERY_NAME: Record<SceneryKind, string> = {
  skullPole: "a skull totem",
  deadTree: "a dead tree",
  felledTree: "a felled tree",
  well: "a well",
  tent: "a tent",
  boulderA: "a boulder",
  boulderB: "a boulder",
  barn: "a barn",
  houseA: "a house",
  houseB: "a house",
  smithy: "a smithy",
  windmill: "a windmill",
};

export const FOOTPRINT: Record<SceneryKind, { w: number; h: number }> = {
  skullPole: { w: 1, h: 1 },
  deadTree: { w: 1, h: 1 },
  felledTree: { w: 1, h: 1 },
  well: { w: 2, h: 2 },
  tent: { w: 2, h: 2 },
  boulderA: { w: 2, h: 1 },
  boulderB: { w: 2, h: 1 },
  // The buildings. Four tiles across is the width the artwork was cut to, and
  // the height is whatever the roof needed: a barn and a house are five deep,
  // the smithy four, the windmill five square because its sails are wider than
  // the mill under them and cropping them to four made it a shed with sticks.
  barn: { w: 4, h: 5 },
  houseA: { w: 4, h: 5 },
  houseB: { w: 4, h: 5 },
  smithy: { w: 4, h: 4 },
  windmill: { w: 5, h: 5 },
};

/**
 * How much of that footprint actually stops a walker, measured in rows counted
 * UP from the bottom of the block. The rest is overhang: drawn, never solid.
 *
 * A tree taught the rule. Its trunk owns one square, the crown leans a tile and
 * a bit further north, and the player may stand under that crown — the y-sort
 * puts the tree on top of him and he is half hidden by it. That reads as depth.
 *
 * A well and a tent are two squares deep, and sealing both of them threw the
 * rule away: the far row is the BACK of the object, the side you should be able
 * to stand behind, and a wall there stops you a full tile short of the thing you
 * are walking behind. So only the near row blocks. Walk down past a tent and you
 * slip in behind the canvas with your head over the ridge; the fabric takes your
 * legs. The bottom row is still stone and still refuses.
 *
 * Anything one row deep has nothing to give back, and lists its own row here.
 */
export const BLOCK: Record<SceneryKind, { w: number; h: number }> = {
  skullPole: { w: 1, h: 1 },
  deadTree: { w: 1, h: 1 },
  felledTree: { w: 1, h: 1 },
  well: { w: 2, h: 1 },
  tent: { w: 2, h: 1 },
  boulderA: { w: 2, h: 1 },
  boulderB: { w: 2, h: 1 },
  // Two rows of wall, and everything above it is roof the player walks behind.
  // That is the tent's rule scaled up: walk down past a house and you pass
  // behind the gable with your head over the ridge, and the wall takes your
  // legs. The width always matches the footprint — a narrower block would hug
  // the LEFT edge of the sprite instead of centring under it, which is why the
  // windmill seals its full five and you cannot duck beneath its sails.
  barn: { w: 4, h: 2 },
  houseA: { w: 4, h: 2 },
  houseB: { w: 4, h: 2 },
  smithy: { w: 4, h: 2 },
  windmill: { w: 5, h: 2 },
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
