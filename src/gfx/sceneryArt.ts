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
  chapel: "a chapel", shrine: "a roadside shrine", shop: "a shop",
  townhouse: "a townhouse", watchtower: "a watchtower", shophouse: "a shop",
  cottage: "a cottage", bank: "the counting house",
  observatory: "an observatory", storefront: "a shopfront",
  shoprow: "a row of shops", keep: "the keep", workshop: "a workshop",
  warehouse: "a warehouse", temple: "a temple", apothecary: "an apothecary",
  inn: "an inn", manor: "a manor house", towerhouse: "a tower house",
  market: "the market hall", tavern: "a tavern",
  tradehouse: "the trade house", stonehouse: "a stone house",
  greatTemple: "the great temple", guildhall: "the guildhall",
  stallRed: "a market stall", stallGrey: "a market stall",
  stallOpen: "a market stall", windmillCloth: "a windmill",
  windmillLattice: "a windmill",
};

/** Tile side in pixels. Local, so this module stays free of config imports. */
const TILE_PX = 32;

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
  // Read straight off the artwork: every town PNG is exactly its footprint
  // times 32 pixels, so these numbers cannot drift out of step with the file.
  chapel: { w: 4, h: 6 }, shrine: { w: 4, h: 4 }, shop: { w: 4, h: 6 },
  townhouse: { w: 4, h: 8 }, watchtower: { w: 4, h: 8 },
  shophouse: { w: 6, h: 4 }, cottage: { w: 6, h: 6 }, bank: { w: 6, h: 6 },
  observatory: { w: 6, h: 10 }, storefront: { w: 8, h: 4 },
  shoprow: { w: 8, h: 4 }, keep: { w: 8, h: 6 }, workshop: { w: 8, h: 6 },
  warehouse: { w: 8, h: 6 }, temple: { w: 8, h: 6 },
  apothecary: { w: 8, h: 6 }, inn: { w: 8, h: 6 }, manor: { w: 8, h: 6 },
  towerhouse: { w: 8, h: 8 }, market: { w: 10, h: 4 }, tavern: { w: 10, h: 6 },
  tradehouse: { w: 10, h: 6 }, stonehouse: { w: 10, h: 6 },
  greatTemple: { w: 10, h: 10 }, guildhall: { w: 12, h: 4 },
  stallRed: { w: 3, h: 2 }, stallGrey: { w: 3, h: 2 },
  stallOpen: { w: 3, h: 2 }, windmillCloth: { w: 12, h: 12 },
  windmillLattice: { w: 12, h: 12 },
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
/**
 * How far each PNG spills OUTSIDE the footprint it is filed under, in pixels.
 *
 * `FOOTPRINT` says which tiles an object claims; it does not say which tiles
 * its artwork paints on, and for five of these they are not the same thing. A
 * boulder is filed as 2x1 — 64x32 px — and its PNG is 60x44, so twelve pixels
 * of stone are painted in the row ABOVE the block. Standing one square in from
 * a shoreline, that is twelve pixels of rock lying on the sea, which is the
 * artefact Radek photographed on Calanais.
 *
 * `up` is what the art adds above the block's top edge; `side` is what it adds
 * beyond each vertical edge (negative means the art is narrower than its
 * footprint and needs no room). Anything absent fits inside its footprint and
 * is zero.
 *
 * These are read off the files, and the smoke suite re-reads the PNG headers
 * and fails if any entry stops matching — the same guarantee the comment above
 * `chapel` makes for the town set, made checkable.
 */
export const ART_SPILL: Partial<Record<SceneryKind, { up: number; side: number }>> = {
  boulderA: { up: 12, side: 0 },
  boulderB: { up: 12, side: 0 },
  deadTree: { up: 40, side: 7 },
  felledTree: { up: 6, side: 1 },
  skullPole: { up: 17, side: 0 },
};

/**
 * The tiles a piece of scenery actually PAINTS on: its footprint plus whatever
 * its artwork spills above and beside it. This is the rectangle that has to sit
 * on dry land — sealing is a different question and `BLOCK` answers that one.
 */
export function paintedTiles(kind: SceneryKind, tx: number, ty: number): { tx: number; ty: number }[] {
  const fp = FOOTPRINT[kind];
  const sp = ART_SPILL[kind] ?? { up: 0, side: 0 };
  const x0 = tx - Math.max(0, Math.ceil(sp.side / TILE_PX));
  const x1 = tx + fp.w - 1 + Math.max(0, Math.ceil(sp.side / TILE_PX));
  const y0 = ty - Math.max(0, Math.ceil(sp.up / TILE_PX));
  const y1 = ty + fp.h - 1;
  const out: { tx: number; ty: number }[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ tx: x, ty: y });
  return out;
}

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
  // Two rows of wall for a building, three for a tower, and ONE for a market
  // stall — the row behind its counter has to stay walkable or the trader
  // cannot stand in his own stall.
  chapel: { w: 4, h: 4 }, shrine: { w: 4, h: 2 }, shop: { w: 4, h: 4 },
  townhouse: { w: 4, h: 4 }, watchtower: { w: 4, h: 4 },
  shophouse: { w: 6, h: 2 }, cottage: { w: 6, h: 4 }, bank: { w: 6, h: 4 },
  observatory: { w: 6, h: 4 }, storefront: { w: 8, h: 2 },
  shoprow: { w: 8, h: 2 }, keep: { w: 8, h: 4 }, workshop: { w: 8, h: 4 },
  warehouse: { w: 8, h: 4 }, temple: { w: 8, h: 4 },
  apothecary: { w: 8, h: 4 }, inn: { w: 8, h: 4 }, manor: { w: 8, h: 4 },
  towerhouse: { w: 8, h: 4 }, market: { w: 10, h: 2 }, tavern: { w: 10, h: 4 },
  tradehouse: { w: 10, h: 4 }, stonehouse: { w: 10, h: 4 },
  greatTemple: { w: 10, h: 4 }, guildhall: { w: 12, h: 2 },
  stallRed: { w: 3, h: 1 }, stallGrey: { w: 3, h: 1 },
  stallOpen: { w: 3, h: 1 }, windmillCloth: { w: 12, h: 4 },
  windmillLattice: { w: 12, h: 4 },
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
