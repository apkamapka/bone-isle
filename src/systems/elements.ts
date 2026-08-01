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

export const ELEMENT_LABEL: Readonly<Record<Element, string>> = {
  fire: "Fire",
  ice: "Ice",
  earth: "Earth",
  storm: "Storm",
  shadow: "Shadow",
};

/** Float-text and projectile colours, on the game's existing ramp. */
export const ELEMENT_COLOR: Readonly<Record<Element, string>> = {
  fire: "#ff8a3a",
  ice: "#7cd4ff",
  earth: "#8ab661",
  storm: "#ffce4a",
  shadow: "#b58aff",
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
