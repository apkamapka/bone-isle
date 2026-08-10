/**
 * Smelting — turning looted gear back into building material.
 *
 * The forge stopped making weapons; it now unmakes them. Three rules carry
 * the whole system:
 *
 *   1. HOW MUCH a piece yields is fixed by its tier and slot. A Plate Armor
 *      is three units of metal no matter what furnace it goes into.
 *   2. WHAT those units are is decided by the forge. A tier-I furnace can
 *      only pull iron; a tier-II furnace pulls steel out of the same piece.
 *      This is the entire argument for upgrading: the better forge does not
 *      get more out of a breastplate, it gets BETTER metal out of it.
 *   3. Organic gear does not go in the fire. Leather, snakeskin, bone
 *      (marrow) and dragon scale are not metal and never smelt.
 *
 * The economy this is balanced against: the feedstock is DUPLICATES, not the
 * gear on your back. A chieftain drops a piece of the Steel set on one kill
 * in four; you wear five pieces and every one after that is scrap. That is
 * why nothing here has to make melting your own armour attractive — you are
 * never asked to.
 */
import { countAcross, removeAcross, ITEMS } from "../items.ts";
import type { ItemKind, Bag } from "../items.ts";

/** Which line a piece comes from. The human line is the metal line: its gear
 *  is forged, so it gives up steel readily. Beast gear is crude work and
 *  yields mostly iron even in a good furnace. */
export type SmeltLine = "human" | "beast";

/** Forge tier. 1 = iron only, 2 = iron + steel, 3 = also makes gems. */
export type ForgeTier = 1 | 2 | 3;

export interface SmeltYield {
  iron: number;
  steel: number;
}

/**
 * Gear tier (1..6) and line, for everything that smelts.
 *
 * Armour pieces carry a `set` tag in ITEMS and could be read from there, but
 * shields and weapons deliberately do not (a player picks a guard on its own
 * merits, not to complete a set). Rather than special-case half the catalog,
 * every smeltable item is listed here explicitly — one table, one place to
 * look when a number is wrong.
 */
export const SMELT_TIER: Readonly<Partial<Record<ItemKind, readonly [number, SmeltLine]>>> = {
  // ---- armour, tier 2..6. Tier 1 (leather / snakeskin) is hide, not metal.
  studdedHelm: [2, "human"], studdedBody: [2, "human"], studdedLegs: [2, "human"], studdedBoots: [2, "human"], studdedShield: [2, "human"],
  goblinHelm: [2, "beast"], goblinBody: [2, "beast"], goblinLegs: [2, "beast"], goblinBoots: [2, "beast"], goblinShield: [2, "beast"],
  chainHelm: [3, "human"], chainBody: [3, "human"], chainLegs: [3, "human"], chainBoots: [3, "human"], chainShield: [3, "human"],
  orcishHelm: [3, "beast"], orcishBody: [3, "beast"], orcishLegs: [3, "beast"], orcishBoots: [3, "beast"], orcishShield: [3, "beast"],
  plateHelm: [4, "human"], plateBody: [4, "human"], plateLegs: [4, "human"], plateBoots: [4, "human"], plateShield: [4, "human"],
  minotaurHelm: [4, "beast"], minotaurBody: [4, "beast"], minotaurLegs: [4, "beast"], minotaurBoots: [4, "beast"], minotaurShield: [4, "beast"],
  steelHelm: [5, "human"], steelBody: [5, "human"], steelLegs: [5, "human"], steelBoots: [5, "human"], steelShield: [5, "human"],
  knightHelm: [6, "human"], knightBody: [6, "human"], knightLegs: [6, "human"], knightBoots: [6, "human"], knightShield: [6, "human"],
  // Marrow (bone) and Dragon (scale) are the beast tier-5/6 sets and are
  // organic on purpose — the best beast gear is simply not smeltable.

  // ---- weapons. Bone and wood are absent for the same reason.
  shortSword: [2, "human"], ironSword: [2, "human"], fangDagger: [2, "beast"],
  mercBlade: [3, "human"], warHammer: [3, "human"], goblinHatchet: [3, "beast"], orcishAxe: [3, "beast"],
  gladius: [4, "human"], minotaurAxe: [4, "beast"],
  warlordBlade: [5, "human"], steelMaul: [5, "human"], demonCleaver: [5, "beast"],
  knightSword: [6, "human"], fireSword: [6, "human"],
};

/** Units of metal a tier yields on a body piece, shield or weapon. */
const TIER_UNITS: readonly number[] = [0, 0, 1, 2, 3, 3, 3];

/** Slots that give less than the full tier value. A helmet is not a
 *  breastplate and boots are barely a handful of rivets. */
function slotUnits(tierUnits: number, slot: string | undefined): number {
  if (slot === "boots") return 1;
  if (slot === "head" || slot === "legs") return Math.max(1, tierUnits - 1);
  return tierUnits;
}

/** How much steel of the total comes out, at forge tier 2+. */
function steelShare(tier: number, line: SmeltLine, units: number): number {
  if (line === "human") {
    if (tier <= 2) return 0;
    if (tier === 3) return Math.ceil(units / 2);
    if (tier === 4) return Math.ceil((units * 2) / 3);
    return units;
  }
  if (tier <= 3) return 0;
  if (tier === 4) return Math.floor(units / 3);
  return Math.floor(units / 2);
}

/** Coal burned per item put in the furnace, whatever comes out of it. */
export const COAL_PER_SMELT = 1;

/**
 * What one `kind` yields in a forge of `forgeTier`. Returns zeroes for
 * anything that does not smelt, which is also how callers should test
 * smeltability — see `canSmelt`.
 *
 * `slot` comes from ITEMS and is passed in rather than imported to keep this
 * module free of the item catalog (items.ts already imports plenty).
 */
export function smeltYield(kind: ItemKind, forgeTier: ForgeTier, slot?: string): SmeltYield {
  const entry = SMELT_TIER[kind];
  if (!entry) return { iron: 0, steel: 0 };
  const [tier, line] = entry;
  const units = slotUnits(TIER_UNITS[tier], slot);
  if (units <= 0) return { iron: 0, steel: 0 };
  // A tier-I furnace cannot separate steel at all: everything comes out iron.
  if (forgeTier < 2) return { iron: units, steel: 0 };
  const steel = steelShare(tier, line, units);
  return { iron: units - steel, steel };
}

export function canSmelt(kind: ItemKind): boolean {
  return SMELT_TIER[kind] !== undefined;
}

/* ------------------------------------------------------------------ *
 *  Essential Gems                                                     *
 * ------------------------------------------------------------------ */

/**
 * Creature trophies. Every one of these is a piece of something that could
 * only have come off a monster — a horn, a fang, a gland. Humans are
 * deliberately absent: they drop coal, because people carry firewood and
 * monsters do not.
 */
export const GEM_TROPHIES: readonly ItemKind[] = [
  "minotaurHorn", "orcEar", "goblinFang", "cursedRib",
  "venomGland", "ghoulClaw", "dragonScale",
];

export function isGemTrophy(kind: ItemKind): boolean {
  return GEM_TROPHIES.includes(kind);
}

/** Distinct trophy KINDS needed for one gem, and the coal to fire it. */
export const GEM_TROPHY_KINDS = 3;
export const GEM_COAL = 3;

/**
 * Which trophies can be spent on a gem, given what is on hand.
 *
 * The recipe takes three trophies of three DIFFERENT kinds, and that
 * restriction is the whole point: one trophy type at a time would mean
 * finding the single richest spawn and never leaving it. Three different
 * kinds means the hundred gems the Alchemy Tower wants are a tour of the
 * island, not a chair in front of one camp.
 */
export function gemReady(counts: ReadonlyMap<ItemKind, number>, coal: number): boolean {
  if (coal < GEM_COAL) return false;
  let kinds = 0;
  for (const t of GEM_TROPHIES) if ((counts.get(t) ?? 0) > 0) kinds++;
  return kinds >= GEM_TROPHY_KINDS;
}

/* ------------------------------------------------------------------ *
 *  Transactions                                                       *
 * ------------------------------------------------------------------ */

/**
 * Why these live here and not in main.ts: the first version of the smelt
 * action was written inline next to the click handler, where nothing could
 * reach it, and it shipped with a bug that no test could have caught — it
 * read gear out of the storage chests to build the list and then refused to
 * spend from them. Anything that can silently refuse belongs behind a
 * function a test can call.
 */

/** Why a smelt cannot happen, or null when it can. */
export function smeltBlocker(
  bags: readonly Bag[], kind: ItemKind, forgeTier: ForgeTier,
): "not-smeltable" | "none-held" | "no-coal" | null {
  if (!canSmelt(kind)) return "not-smeltable";
  if (countAcross(bags, kind) < 1) return "none-held";
  if (countAcross(bags, "coal") < COAL_PER_SMELT) return "no-coal";
  const y = smeltYield(kind, forgeTier, ITEMS[kind].slot);
  return y.iron + y.steel > 0 ? null : "not-smeltable";
}

/**
 * Spend one piece and the coal, and report what came out. Consumes across
 * every bag given — backpack and chests alike — and leaves the caller to put
 * the metal somewhere.
 */
export function applySmelt(
  bags: readonly Bag[], kind: ItemKind, forgeTier: ForgeTier,
): SmeltYield | null {
  if (smeltBlocker(bags, kind, forgeTier) !== null) return null;
  const y = smeltYield(kind, forgeTier, ITEMS[kind].slot);
  removeAcross(bags, kind, 1);
  removeAcross(bags, "coal", COAL_PER_SMELT);
  return y;
}

/** Trophy kinds that would be spent on the next gem, or null if none can be. */
export function gemPick(bags: readonly Bag[]): ItemKind[] | null {
  if (countAcross(bags, "coal") < GEM_COAL) return null;
  const held = GEM_TROPHIES
    .map((t) => ({ t, n: countAcross(bags, t) }))
    .filter((h) => h.n > 0)
    .sort((a, b) => b.n - a.n);
  if (held.length < GEM_TROPHY_KINDS) return null;
  return held.slice(0, GEM_TROPHY_KINDS).map((h) => h.t);
}

/** Spend the trophies and coal for one gem. Returns what was consumed. */
export function applyGem(bags: readonly Bag[]): ItemKind[] | null {
  const picked = gemPick(bags);
  if (!picked) return null;
  for (const t of picked) removeAcross(bags, t, 1);
  removeAcross(bags, "coal", GEM_COAL);
  return picked;
}
