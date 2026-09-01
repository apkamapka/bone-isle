/**
 * Elements — the third damage channel.
 *
 * Steel is bought with training, gear with gold, and crystals with materials
 * and tower research. What makes the third channel worth existing at all is
 * that it does something the other two cannot: elemental damage IGNORES a
 * creature's armor. That single rule is the whole argument for spending an
 * evening gathering herbs instead of swinging a sword — a heavily plated
 * creature is a wall to a blade and merely an obstacle to a flame.
 *
 * Resistance is what stops that from collapsing into "always bring fire". A
 * creature that shrugs off flame has to be met with something else, so the
 * choice of element is a real decision rather than a colour swap.
 */

export type Element = "fire" | "ice" | "earth" | "storm" | "shadow";

export const ELEMENTS: readonly Element[] = ["fire", "ice", "earth", "storm", "shadow"];

/**
 * What the player reads, everywhere: the Alchemy Tower's tabs, the float that
 * rises out of a circle, the "attuned to X" line.
 *
 * THREE OF THESE ARE NOT THEIR ID, and that is settled rather than sloppy.
 * `ice`, `storm` and `shadow` are the internal keys, frozen because they build
 * item ids, save keys and icon filenames — see TIER_CODE. The fiction calls
 * them Water, Lightning and Wind, and the sanctum floor under Calanais is
 * painted blue, yellow and pale to match. Renaming the keys would touch
 * seventy-five item keys, thirty PNGs and a save migration to change strings
 * nobody sees; renaming what the player reads is this table and nothing else.
 *
 * The one thing still out of step is the ICE tier words — Frost, Rime, Glacier
 * under a tab that now says WATER — and they are left alone on purpose: the
 * icons are frost-coloured, so "Tide Shard" over a snowflake would trade one
 * mismatch for a worse one. That is an art job, not a string job.
 */
export const ELEMENT_LABEL: Readonly<Record<Element, string>> = {
  fire: "Fire",
  ice: "Water",
  earth: "Earth",
  storm: "Lightning",
  shadow: "Wind",
};

/** Float-text and projectile colours, on the game's existing ramp. */
export const ELEMENT_COLOR: Readonly<Record<Element, string>> = {
  fire: "#ff8a3a",
  ice: "#7cd4ff",
  earth: "#8ab661",
  storm: "#ffce4a",
  shadow: "#b58aff",
};

/**
 * The tier words that BUILD ITEM IDS: `shadow` + `Gloom` + `Shard` is the key
 * `shadowGloomShard`, in save files, in every chest, on the ground, in action
 * slots and in the icon filename `item-shadow-gloom-shard.png`.
 *
 * Frozen. Editing a word here silently renames items out from under every
 * existing save and orphans fifteen PNGs. Rename what the PLAYER reads in
 * TIER_NAME and in the `name` fields of `ITEMS` — that is free.
 *
 * `ice`, `storm` and `shadow` are the elements the fiction calls Water,
 * Lightning and Wind. The ids kept their old
 * spelling on purpose: renaming it would touch seventy-five item keys, thirty
 * filenames and a save migration, to change a string nobody sees.
 */
export const TIER_CODE: Readonly<Record<Element, readonly [string, string, string]>> = {
  fire: ["Ember", "Flame", "Pyre"],
  ice: ["Frost", "Rime", "Glacier"],
  earth: ["Loam", "Stone", "Bedrock"],
  storm: ["Spark", "Bolt", "Tempest"],
  shadow: ["Gloom", "Umbra", "Eclipse"],
};

/**
 * What the player reads. Free to change; nothing is keyed off it.
 *
 * Wind runs Zephyr / Squall / Cyclone against art that goes violet, black,
 * white — the gentlest named wind, then the black line of a squall, then the
 * whole system turning. None of them collides with Storm's Spark/Bolt/Tempest,
 * which matters because the two elements sit next to each other on the shelf.
 */
export const TIER_NAME: Readonly<Record<Element, readonly [string, string, string]>> = {
  fire: ["Ember", "Flame", "Pyre"],
  ice: ["Frost", "Rime", "Glacier"],
  earth: ["Loam", "Stone", "Bedrock"],
  storm: ["Spark", "Bolt", "Tempest"],
  shadow: ["Zephyr", "Squall", "Cyclone"],
};

/** Tier of a crystal. Roman numerals in the fiction, 0..2 in the code. */
export type Tier = 0 | 1 | 2;
export const TIER_LABEL: readonly string[] = ["I", "II", "III"];

/**
 * Damage multiplier per tier. Each step slightly more than doubles, which is
 * what makes a tower upgrade feel like an upgrade rather than a percentage.
 */
export const TIER_MULT: readonly number[] = [1, 2.2, 4.8];

/**
 * Resistance, as a multiplier on incoming elemental damage.
 *   < 1  the creature shrugs it off
 *   = 1  ordinary flesh
 *   > 1  a weakness worth exploiting
 * Anything absent is 1 — resistances are the exception, not the rule, or the
 * player ends up carrying five pouches and consulting a table before a fight.
 */
export type Resistances = Partial<Record<Element, number>>;

export function resistanceOf(res: Resistances | undefined, el: Element): number {
  return res?.[el] ?? 1;
}

/**
 * One crystal's damage.
 *
 *   roll(base) · tierMult · (1 + level / LEVEL_SCALE) · resistance
 *
 * The level term is deliberately gentler than a weapon's: crystals are bought,
 * not trained, so if they scaled like a skill they would become the only thing
 * worth doing. They are meant to be the answer to a specific problem — armor,
 * or a creature you cannot safely stand next to — not a replacement for steel.
 */
export const CRYSTAL_LEVEL_SCALE = 50;

export function crystalDamage(
  base: readonly [number, number],
  tier: Tier,
  level: number,
  res: Resistances | undefined,
  el: Element,
): number {
  const roll = base[0] + Math.random() * (base[1] - base[0]);
  const dmg = roll * TIER_MULT[tier] * (1 + level / CRYSTAL_LEVEL_SCALE) * resistanceOf(res, el);
  return Math.max(1, Math.round(dmg));
}
