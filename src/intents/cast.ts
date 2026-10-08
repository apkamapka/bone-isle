/**
 * Casting a crystal, and the Recall Crystal's ride home (Etap 3.1c moved this
 * here from main.ts).
 *
 * The effects themselves are systems/crystals.ts. What is decided here is
 * whether this player may cast this crystal here and now: not out of a
 * protection zone if it hurts, and not above what their Alchemy Tower can
 * answer for. Arming a Burst — the cursor that waits for a click on the map —
 * is the client's; the click is this request with the spot it chose.
 */
import { travelTo, type Game } from "../game.ts";
import type { ItemKind } from "../items.ts";
import { bagCount, removeItem } from "../items.ts";
import { useCrystal, CRYSTAL_SPECS } from "../systems/crystals.ts";
import { flare } from "../systems/fxEvents.ts";
import { tell, refuseFromProtection } from "./actor.ts";
import { towerTier } from "./tower.ts";

/**
 * Cast `kind`: at the player's target, at the player, or — for a Burst — at
 * the spot `at` the player clicked.
 */
export function castCrystal(g: Game, kind: ItemKind, at?: { x: number; y: number }): void {
  const P = g.player;
  if (P.dead) return;
  if (kind === "recallCrystal") { recall(g); return; }
  /* Only what HURTS is refused in a protection zone: a refuge you cannot
   * bind your wounds in is not a refuge (see isOffensiveCrystal). Every Burst
   * hurts, so a Burst aimed from a safe tile is always refused here. */
  if (isOffensiveCrystal(kind) && refuseFromProtection(g)) return;
  if (refuseUntowered(g, kind)) return;
  useCrystal(g.current, P, kind, at);
}

/**
 * Does this crystal HIT something?
 *
 * Every entry in `CRYSTAL_SPECS` is a shard, burst, nova or wave, and all four
 * deal damage. Life is not in that table and neither is Recall, which is the
 * whole distinction: one heals the caster, one moves him, and neither reaches
 * across the boundary of a protected zone at anybody.
 *
 * THE BUG THIS ANSWERS. `useCrystalItem` asked `refuseFromProtection` about
 * EVERY crystal, so standing in Bonetown — a safe map, so every square of it —
 * refused the Life crystal too. Worse, it refused SILENTLY: the flash inside
 * that helper only fires when there is a target to drop, and a player pressing
 * heal in town has none. So the button did nothing and said nothing, which is
 * the least debuggable failure a button has.
 *
 * The protection rule is "you may not strike out of a refuge", not "no magic
 * indoors". A refuge you cannot bind your wounds in is not a refuge, and it is
 * exactly backwards for a town whose whole job is to be where you recover.
 */
export function isOffensiveCrystal(kind: ItemKind): boolean {
  return CRYSTAL_SPECS[kind] !== undefined;
}

/** Spend a Recall Crystal and go home to Home Isle. */
export function recall(g: Game): void {
  const P = g.player;
  if (P.dead) return;
  if (g.current === g.worlds.home) { tell(g, "already home", "#8ab6ff"); return; }
  if (bagCount(P.bag, "recallCrystal") <= 0) { tell(g, "no recall crystal", "#8ab6ff"); return; }
  removeItem(P.bag, "recallCrystal", 1);
  travelTo(g, "home");
  /* The flare goes off AFTER the travel, on Home Isle, and there is no
   * matching one at the departure end — `drawFlares` filters by world, so an
   * effect played on the island you are leaving is drawn into a world nobody
   * is looking at. An arrival is the half of a teleport anyone actually
   * sees. */
  flare(g.current, P.x, P.y - 24, "recall", 1.2);
  tell(g, "recalled home", "#c9a6ff");
}

/**
 * Refuse a crystal the player's tower cannot answer for.
 *
 * NOTHING USED TO CHECK THIS. The Alchemy Tower decided what the shelf SOLD
 * and stopped caring the moment a crystal was in a bag, so a level-one tower
 * plus one generous friend was the same as a level-three tower. Every gold
 * piece and every stone spent upgrading the building bought a shopping list,
 * not a capability — which is the whole of its power curve gone.
 *
 * Note what this deliberately does NOT check: the ELEMENT. A friend's Storm
 * Shard still works in the hands of a Flame mage, because gifts between
 * players are meant to work — that is what the role cooldown is for. Tier is
 * different: it is not a sideways choice, it is the ladder, and a ladder you
 * can be handed the top of is scenery.
 *
 * `offersFor` sells tier `towerTier - 1`, so that same subtraction is what
 * makes the shelf and the gate agree about what a tower is worth.
 */
export function refuseUntowered(g: Game, kind: ItemKind): boolean {
  const spec = CRYSTAL_SPECS[kind];
  if (!spec || spec.tier <= towerTier(g) - 1) return false;
  tell(g, `needs an Alchemy Tower ${"I".repeat(spec.tier + 1)}`, "#d96a5a");
  return true;
}
