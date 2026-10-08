/**
 * Buying and selling over the townsfolk's counters, and the TEST shop (Etap
 * 3.1c moved this here from main.ts).
 *
 * A counter serves whoever stands at it: the shop window closes when the
 * player walks off, and a request is held to the same reach, because a
 * request is no proof of where its player stands.
 */
import type { Game } from "../game.ts";
import type { ItemKind } from "../items.ts";
import { ITEMS, addItem, giveGold, takeGold, walletRoomFor, removeItemUnpacked, isContainer } from "../items.ts";
import type { Npc } from "../world/types.ts";
import { SHOPS } from "../entities/npcs.ts";
import { canCarry } from "../entities/player.ts";
import { sound } from "../systems/fxEvents.ts";
import { tell, nearNpc } from "./actor.ts";

/** Buy one `kind` from `npc`'s shelf. */
export function buy(g: Game, npc: Npc, kind: ItemKind): void {
  const P = g.player;
  const shop = SHOPS[npc.key];
  if (!shop) return;
  if (!nearNpc(g, (n) => n === npc)) { tell(g, "too far away", "#d96a5a"); return; }
  const entry = shop.entries.find((e) => e.kind === kind);
  if (!entry || entry.buy <= 0 || P.gold < entry.buy) return;
  if (!canCarry(P, kind)) { tell(g, "too heavy"); return; }
  // pay FIRST: coins leaving the bag can be the very slot the goods need,
  // and a purse of loose change is exactly when that happens
  if (!takeGold(P.bag, entry.buy)) { tell(g, "not enough gold", "#d96a5a"); return; }
  if (addItem(P.bag, kind, 1) > 0) { giveGold(P.bag, entry.buy); tell(g, "bag full"); return; }
  sound("coins");
}

/** Sell one `kind` to `npc`. */
export function sell(g: Game, npc: Npc, kind: ItemKind): void {
  const P = g.player;
  const shop = SHOPS[npc.key];
  if (!shop) return;
  if (!nearNpc(g, (n) => n === npc)) { tell(g, "too far away", "#d96a5a"); return; }
  const entry = shop.entries.find((e) => e.kind === kind);
  if (!entry || entry.sell <= 0) return;
  // coins are goods too, and selling them to buy them back would be a bug
  if (ITEMS[kind].coin) return;
  // check the change will fit BEFORE handing the goods over, or a full bag
  // turns a sale into a donation
  if (!walletRoomFor(P.bag, entry.sell)) { tell(g, "no room for the coins", "#e0a06a"); return; }
  // a pack with things in it is not merchandise — see removeItemUnpacked
  if (!removeItemUnpacked(P.bag, kind, 1)) {
    tell(g, isContainer(kind) ? "empty it first" : "you have none", "#e0a06a");
    return;
  }
  giveGold(P.bag, entry.sell);
  sound("coins");
}

/**
 * TEST ONLY — 100 of anything for one gold.
 *
 * Weight is deliberately not checked: the point is to put a feature in front
 * of the developer immediately, and refusing on encumbrance would defeat that.
 * Bag SLOTS still apply, because a full backpack has nowhere to put them and
 * silently eating the gold would be worse than saying so.
 */
/**
 * TEST ONLY — a gold buys one slot's worth of anything.
 *
 * "One slot's worth" rather than a flat 100, because the two halves of the
 * catalog want different numbers. Wood, arrows and coal are things you hold a
 * hundred of, and handing over one is useless for testing. A sword is a thing
 * you hold ONE of: a hundred of them buries the backpack, the chest and the
 * carry limit under a single click, which is exactly what happened before
 * this read the stack size.
 */
export function testGrant(g: Game, kind: ItemKind): void {
  const P = g.player;
  if (P.gold < 1) { tell(g, "no gold", "#d96a5a"); return; }
  const want = Math.min(100, ITEMS[kind].stack);
  const left = addItem(P.bag, kind, want);
  if (left === want) { tell(g, "bag full", "#d96a5a"); return; }
  takeGold(P.bag, 1);
  tell(g, `TEST +${want - left} ${ITEMS[kind].name}`, "#e08a7a");
}
