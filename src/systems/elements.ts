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
/**
 * Standing in an element field burns you, exactly as standing in a camp fire
 * does.
 *
 * SAME NUMBERS AS THE CAMPFIRE, on purpose. Radek's report was "ogień bierze
 * ok 8-11 DMG jak się stanie ale inne żywioły nie" — the complaint is not that
 * the fields are too gentle, it is that the ground lies: sixteen glowing
 * squares that look exactly as dangerous as the fire beside them and cost
 * nothing to walk through. Giving them their own softer number would have
 * fixed the lie by half.
 *
 * ELEMENTAL, so it goes past shield and armour, again like the fire. You
 * cannot raise a buckler against the floor. And no floating label: the glow
 * under your feet is the label.
 *
 * The clock is per TILE, so crossing four squares of lightning costs four
 * bites and standing on one costs one.
 */
export const FIELD_BURN_TICK_S = 1.0;
export const FIELD_BURN_DMG: readonly [number, number] = [6, 12];

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
 *
 * Base values (1, 2.2, 4.8) scaled by 1.15 across the board: Radek reported
 * exping felt too slow at the old numbers. Scaling the whole array by one
 * constant raises every tier's output ~15% while leaving the tier-to-tier
 * ratio exactly as it was (III is still 4.8x I) — a tower upgrade should keep
 * reading as the same kind of jump it always did.
 */
export const TIER_MULT: readonly number[] = [1.15, 2.53, 5.52];

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

/**
 * The world rule: one rock-paper-scissors ring across all five elements,
 * read everywhere a hit that already carries an element meets something
 * with an elemental identity — a player's crystal or elemental arrow
 * against another player or against a monster, a monster's own elemental
 * spell against a player, an ambient fire field under a player's feet. A
 * sword swing carries no element at all and never reaches this table — this
 * file only decides the SIZE of the effect once something elemental lands,
 * never whether a hit counts as elemental in the first place.
 *
 * ELEMENT_RING is the one place the wheel is spelled out: each element
 * beats the next one round and loses to the previous one, and the two
 * elements that are neither neighbour are a neutral matchup. A mirror match
 * (fire vs fire) resists too, by the same edge. ELEMENT_EDGE is BUILT from
 * the ring rather than typed out five times by hand — one direction written
 * backwards in a hand-typed table is a bug nothing else would catch;
 * derived from one ring, it cannot happen.
 */
export const ELEMENT_RING: readonly Element[] = ["fire", "shadow", "storm", "earth", "ice"];

const ELEMENT_EDGE_PCT = 0.1;

function buildElementEdge(ring: readonly Element[]): Readonly<Record<Element, Resistances>> {
  const table = {} as Record<Element, Resistances>;
  ring.forEach((el, i) => {
    const beats = ring[(i + 1) % ring.length];
    const losesTo = ring[(i - 1 + ring.length) % ring.length];
    const row: Resistances = {};
    row[beats] = 1 + ELEMENT_EDGE_PCT;
    row[losesTo] = 1 - ELEMENT_EDGE_PCT;
    row[el] = 1 - ELEMENT_EDGE_PCT; // mirror match: same element resists itself too
    table[el] = row;
  });
  return table;
}

/** el → its one +10% matchup, its one -10% matchup, and -10% against itself
 *  (a mirror match). The other two elements are absent from the row, which
 *  `resistanceOf` reads as 1 — neutral. Attacker-indexed: ELEMENT_EDGE[X] is
 *  what X does when X attacks, not what X suffers when attacked — see
 *  `elementDefenseProfile` below for that direction. */
export const ELEMENT_EDGE: Readonly<Record<Element, Resistances>> = buildElementEdge(ELEMENT_RING);

/**
 * Outgoing damage multiplier for one hit of element `attacker` landing on
 * something whose own element is `defender` — a player's crystal on another
 * player, a monster's spell on a player, a field under a player's feet.
 * Either side without an element yet (a player who has never attuned, or a
 * hit with no element at all) is ordinary, unmodified damage: there is
 * nothing yet to be strong or weak against.
 *
 * Single-sided by design: only the attacking element's edge over the
 * defending one is read here. The reverse fact — what the defender's OWN
 * element would do if IT were attacking — belongs to a different blow, not
 * a second multiplier stacked on this one.
 */
export function elementEdgeMultiplier(
  attacker: Element | undefined, defender: Element | undefined,
): number {
  if (!attacker || !defender) return 1;
  return resistanceOf(ELEMENT_EDGE[attacker], defender);
}

/**
 * The flip side of ELEMENT_EDGE: not "what does X do when attacking" but
 * "what does X suffer, across every possible incoming element" — the shape
 * `MonsterDef.resist` already expects. Built by calling
 * `elementEdgeMultiplier` once per incoming element rather than re-derived
 * by hand, so it can never disagree with the ring above by a transposition
 * mistake.
 *
 * This is why a storm-identified creature comes out RESISTANT to earth
 * rather than weak to it: storm beats earth on the ring, and beating
 * something means shrugging off its attacks, the same direction every other
 * pair on the ring already runs.
 */
export function elementDefenseProfile(identity: Element): Resistances {
  const profile: Resistances = {};
  for (const el of ELEMENTS) {
    const m = elementEdgeMultiplier(el, identity);
    if (m !== 1) profile[el] = m;
  }
  return profile;
}
