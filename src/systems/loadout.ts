/**
 * What the quick weapon swap should do — decided without touching anything.
 *
 * The swap itself lives in `main.ts`, where the equip path and the flash
 * messages are. The DECISION does not need any of that, and pulling it out is
 * what makes it testable: the two bugs below were both invisible to the smoke
 * suite because the only copy of this logic sat inside a function that needs a
 * canvas to import.
 *
 * THE TWO BUGS, because they are the reason this file exists:
 *
 *   1. The search was `for (const s of P.bag)` — the TOP LEVEL only. Every
 *      other lookup in the game walks the container tree (`bagCount` recurses,
 *      `removeItem` recurses), so a shield in the spare pack inside the pack
 *      was spendable, sellable and countable, and invisible to exactly one
 *      caller. The swap answered "no melee weapon in bag" while holding one.
 *
 *   2. Going to a bow displaces the shield into the bag, and if the bag was
 *      full the old code put it on the FLOOR. Swap back and there is no shield
 *      to find, because it is four rooms away where you last pressed the
 *      button. Gear does not fall out of a character on a keypress; the swap
 *      is refused instead, and says why.
 */
import { ITEMS } from "../items.ts";
import type { Bag, ItemKind } from "../items.ts";

/**
 * The best item in the tree matching `want`, by value.
 *
 * Depth-first over nested packs, because a container is a place items live and
 * not a place they hide. Value is the tiebreak for the same reason it is
 * everywhere else: it is the game's own ordering of "better".
 */
export function bestInTree(bag: Bag, want: (k: ItemKind) => boolean): ItemKind | null {
  let best: ItemKind | null = null;
  const walk = (b: Bag): void => {
    for (const s of b) {
      if (!s) continue;
      if (want(s.kind) && (!best || ITEMS[s.kind].value > ITEMS[best].value)) best = s.kind;
      if (s.items) walk(s.items);
    }
  };
  walk(bag);
  return best;
}

/** How many free slots the tree has, counting inside every pack. */
export function freeSlots(bag: Bag): number {
  let n = 0;
  const walk = (b: Bag): void => {
    for (const s of b) {
      if (!s) { n++; continue; }
      if (s.items) walk(s.items);
    }
  };
  walk(bag);
  return n;
}

export interface SwapPlan {
  /** The weapon to put on. */
  weapon: ItemKind;
  /** A shield to restore alongside it, when swapping back to melee. */
  shield: ItemKind | null;
  /** True when the new weapon is a bow, i.e. both hands are about to be used. */
  toBow: boolean;
}

export type SwapRefusal =
  /** Nothing of the wanted sort anywhere in the tree. */
  | { no: "weapon"; toBow: boolean }
  /** A bow needs both hands and the shield it displaces has nowhere to go. */
  | { no: "room" };

/**
 * Decide the swap for a player holding `worn` and carrying `bag`.
 *
 * `wornShield` matters only on the way TO a bow, where it is what has to be
 * stowed; on the way back it is expected to be null, which is precisely why
 * there is a shield to look for.
 */
export function planSwap(
  bag: Bag, worn: ItemKind | null, wornShield: ItemKind | null,
): SwapPlan | SwapRefusal {
  const toBow = !(worn ? !!ITEMS[worn].bow : false);
  const weapon = bestInTree(bag, (k) => ITEMS[k].slot === "weapon" && !!ITEMS[k].bow === toBow);
  if (!weapon) return { no: "weapon", toBow };

  /* Going to a bow: the shield comes off and must land in the bag. The weapon
   * being swapped in vacates a slot on its way out, so the budget is one more
   * than the tree reports — and the weapon coming OFF needs a slot of its own,
   * which is the slot the incoming one just left. Net: the shield is the only
   * new tenant, so one free slot is the whole requirement. */
  if (toBow && wornShield && freeSlots(bag) < 1) return { no: "room" };

  const shield = toBow || wornShield
    ? null
    : bestInTree(bag, (k) => ITEMS[k].slot === "shield");
  return { weapon, shield, toBow };
}

/** True when the plan is a refusal rather than a swap. */
export function refused(p: SwapPlan | SwapRefusal): p is SwapRefusal {
  return "no" in p;
}
