/**
 * The Forge and the building plots (Etap 3.1c moved this here from main.ts).
 *
 * Crafting, smelting and cutting gems happen at a Forge, so they are asked
 * only of a player standing at one — the forge window closes behind anyone
 * who walks off, and a request is held to the same rule. Materials and fees
 * come out of the backpack and every Storage Chest on Home Isle, as they
 * always have. Placing a building and raising its tier are Home Isle's.
 */
import { homeChests, type Game } from "../game.ts";
import type { ItemKind, Recipe } from "../items.ts";
import { ITEMS, addItem, craftAcross, walletAcross, takeGoldAcross } from "../items.ts";
import type { Structure } from "../world/types.ts";
import { placeOnGround } from "../world/ground.ts";
import { applySmelt, smeltBlocker, applyGem, GEM_TROPHY_KINDS, type ForgeTier } from "../systems/smelt.ts";
import {
  tryPlace, tryUpgrade, canAfford, buildCost, upgradeCost, tierOf, bestTier, countOwned,
  type StructKey,
} from "../systems/building.ts";
import { setActiveBonus } from "../systems/derived.ts";
import { refreshDerived } from "../entities/player.ts";
import { sound, tone } from "../systems/fxEvents.ts";
import { tell, nearStructure } from "./actor.ts";

/** Make one `r` at the Forge. */
export function craft(g: Game, r: Recipe): boolean {
  const P = g.player;
  if (!nearStructure(g, "forge")) { tell(g, "too far away", "#d96a5a"); return false; }
  const goldCost = r.gold ?? 0;
  // the Forge already spends materials out of your chests; its fee follows the
  // same purse, or you would be told you cannot afford what is ten feet away
  const purse = [P.bag, ...homeChests(g)];
  if (walletAcross(purse) < goldCost) { tell(g, "not enough gold", "#d96a5a"); return false; }
  if (craftAcross([P.bag, ...homeChests(g)], r)) {
    takeGoldAcross(purse, goldCost);
    tell(g, `crafted ${ITEMS[r.out].name}`, "#b9e07f");
    tone(360, 0.14, "square", 0.05);
    return true;
  }
  return false;
}

/** Best Forge standing on Home Isle: 0 none, 1..3 otherwise. */
export function forgeTier(g: Game): ForgeTier {
  return Math.max(1, bestTier(g.worlds.home, "forge")) as ForgeTier;
}

/**
 * Put one piece of gear in the furnace.
 *
 * Only ever consumes from the BACKPACK, never from a chest: melting is
 * destructive and irreversible, and reaching into storage to destroy
 * something the player did not have in hand is exactly the kind of help
 * nobody wants. Coal, being a bulk material like any other, may come from
 * the chest.
 */
export function smelt(g: Game, kind: ItemKind): void {
  const P = g.player;
  if (!nearStructure(g, "forge")) { tell(g, "too far away", "#d96a5a"); return; }
  const bags = [P.bag, ...homeChests(g)];
  const why = smeltBlocker(bags, kind, forgeTier(g));
  if (why === "no-coal") { tell(g, "no coal for the furnace", "#d96a5a"); return; }
  if (why !== null) return;
  const y = applySmelt(bags, kind, forgeTier(g))!;
  giveMaterial(g, "iron", y.iron);
  giveMaterial(g, "steel", y.steel);
  const parts = [y.iron > 0 ? `${y.iron} iron` : "", y.steel > 0 ? `${y.steel} steel` : ""].filter(Boolean);
  tell(g, `smelted → ${parts.join(" + ")}`, "#b9e07f");
  sound("forge");
}

/** Backpack first, then the chests, then the floor — never nowhere. */
export function giveMaterial(g: Game, kind: ItemKind, n: number): void {
  const P = g.player;
  if (n <= 0) return;
  let left = addItem(P.bag, kind, n);
  for (const ch of homeChests(g)) { if (left <= 0) break; left = addItem(ch, kind, left); }
  if (left <= 0) return;
  placeOnGround(g.current, kind, left, P.x, P.y);
  tell(g, `${left} ${ITEMS[kind].name} dropped at your feet`, "#e0a06a");
}

/** Cut one Essential Gem from three DIFFERENT trophies plus coal. */
export function makeGem(g: Game): void {
  const P = g.player;
  if (!nearStructure(g, "forge")) { tell(g, "too far away", "#d96a5a"); return; }
  if (forgeTier(g) < 3) { tell(g, "needs a Forge III", "#d96a5a"); return; }
  const bags = [P.bag, ...homeChests(g)];
  const spent = applyGem(bags);
  if (!spent) { tell(g, `needs ${GEM_TROPHY_KINDS} different trophies + coal`, "#d96a5a"); return; }
  giveMaterial(g, "essentialGem", 1);
  tell(g, "cut an Essential Gem", "#c9a6ff");
  tone(660, 0.2, "sine", 0.06, 140);
}

/** Raise the structure the player is standing at by one tier. */
export function upgrade(g: Game, s: Structure): void {
  const P = g.player;
  // only what stands on Home Isle — a request names it, it does not bring it
  if (!g.worlds.home.structures.includes(s)) return;
  const cost = upgradeCost(s.key, tierOf(s));
  if (!cost) { tell(g, "already at the top tier", "#e0a06a"); return; }
  if (!canAfford(P.bag, cost, homeChests(g))) { tell(g, "not enough materials", "#d96a5a"); return; }
  tryUpgrade(g.worlds.home, P, s, homeChests(g));
}

/**
 * What became of a request to build.
 *
 *   - `built`: it stands, and the client leaves build mode.
 *   - `away`: not on Home Isle — nothing is built anywhere else.
 *   - `poor`: the backpack and the chests do not hold the cost.
 *   - `blocked`: not on that square; the client stays in build mode so the
 *     player can try another.
 */
export type BuildOutcome = "built" | "away" | "poor" | "blocked";

/**
 * Build `key` on the square under world point (x, y). The touch ghost — park
 * it with one tap, build with the second — is the client's; this is the
 * second tap.
 */
export function build(g: Game, key: StructKey, x: number, y: number): BuildOutcome {
  const P = g.player;
  const home = g.worlds.home;
  if (g.current !== home) { tell(g, "you can only build on Home Isle", "#e0a06a"); return "away"; }
  if (tryPlace(home, P, key, x, y, homeChests(g))) {
    // keep the max HP in step with what is owned (it was `recomputeBonuses`)
    setActiveBonus({ maxhp: 0 });
    refreshDerived(P);
    return "built";
  }
  if (!canAfford(P.bag, buildCost(key, countOwned(home, key)), homeChests(g))) {
    tell(g, "not enough materials", "#d96a5a");
    return "poor";
  }
  tell(g, "can't build here", "#e0a06a");
  return "blocked";
}
