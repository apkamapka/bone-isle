/**
 * The Alchemy Tower: attunement, research, and the crystal shelves (Etap 3.1c
 * moved this here from main.ts).
 *
 * All of it is asked at the Tower, so all of it is refused to a player who is
 * not standing at one — the window closes behind anyone who walks off, and a
 * request is held to the same rule. Stones, materials and gold come out of
 * the backpack and every Storage Chest on Home Isle.
 */
import { homeChests, type Game } from "../game.ts";
import { ITEMS, addItem, removeItem, walletAcross, takeGoldAcross } from "../items.ts";
import { canAfford, payCost, bestTier } from "../systems/building.ts";
import {
  researchById, isResearched, markResearched, towerTierOk, towerTierFor, levelOk,
  ATTUNEMENT, isAttuned, markAttuned, attunementOk, offerById,
} from "../systems/tower.ts";
import { ELEMENT_LABEL, type Element } from "../systems/elements.ts";
import { canCarry } from "../entities/player.ts";
import { tone } from "../systems/fxEvents.ts";
import { tell, nearStructure } from "./actor.ts";

/** Best Alchemy Tower standing on Home Isle. */
export function towerTier(g: Game): number {
  return bestTier(g.worlds.home, "tower");
}

/**
 * Spend one attunement stone to open an element's lane.
 *
 * Deliberately separate from `research`: attunement is not a project, has no
 * tower-tier gate, and must stay reachable at every tier so a lane can never
 * strand itself off the bottom of the panel.
 */
export function attune(g: Game, el: Element): void {
  const P = g.player;
  if (!nearStructure(g, "tower")) { tell(g, "too far away", "#d96a5a"); return; }
  if (isAttuned(el)) return;
  const key = ATTUNEMENT[el];
  if (!canAfford(P.bag, { [key]: 1 }, homeChests(g))) {
    tell(g, `needs a ${ITEMS[key].name}`, "#d96a5a");
    return;
  }
  payCost(P.bag, { [key]: 1 }, homeChests(g));
  markAttuned(el);
  tell(g, `attuned to ${ELEMENT_LABEL[el]}`, "#c9a6ff");
  tone(600, 0.22, "square", 0.06, 140);
}

/**
 * Buy a batch off the elemental shelf. No research step: the stone opened the
 * element, the tower sets the price, and gold does the rest.
 */
export function buyOffer(g: Game, id: string): void {
  const P = g.player;
  if (!nearStructure(g, "tower")) { tell(g, "too far away", "#d96a5a"); return; }
  const o = offerById(id);
  if (!o || !isAttuned(o.element)) return;
  if (!canAfford(P.bag, o.cost, homeChests(g))) { tell(g, "need materials"); return; }
  if (walletAcross([P.bag, ...homeChests(g)]) < o.gold) { tell(g, "need gold", "#d96a5a"); return; }
  if (!canCarry(P, o.crystal, o.buyN)) { tell(g, "too heavy"); return; }
  const moved = o.buyN - addItem(P.bag, o.crystal, o.buyN);
  if (moved < o.buyN) { if (moved > 0) removeItem(P.bag, o.crystal, moved); tell(g, "bag full"); return; }
  payCost(P.bag, o.cost, homeChests(g));
  takeGoldAcross([P.bag, ...homeChests(g)], o.gold);
  tell(g, `+${o.buyN} ${ITEMS[o.crystal].name}`, "#b9e07f");
  tone(520, 0.18, "square", 0.05, 90);
}

/** Research a crystal line, which opens it on the shelf. */
export function research(g: Game, id: string): void {
  const P = g.player;
  if (!nearStructure(g, "tower")) { tell(g, "too far away", "#d96a5a"); return; }
  const r = researchById(id);
  if (!r || isResearched(r.id)) return;
  if (!towerTierOk(r, towerTier(g))) { tell(g, `needs an Alchemy Tower ${"I".repeat(towerTierFor(r))}`, "#d96a5a"); return; }
  if (!attunementOk(r)) { tell(g, "attune this element first", "#d96a5a"); return; }
  if (!canAfford(P.bag, r.researchCost, homeChests(g))) { tell(g, "need materials"); return; }
  if (walletAcross([P.bag, ...homeChests(g)]) < (r.researchGold ?? 0)) { tell(g, "need gold", "#d96a5a"); return; }
  payCost(P.bag, r.researchCost, homeChests(g));
  takeGoldAcross([P.bag, ...homeChests(g)], r.researchGold ?? 0);
  markResearched(r.id);
  tell(g, `researched ${r.name}`, "#c9a6ff");
  tone(520, 0.18, "square", 0.06, 120);
}

/** Buy a batch of a researched crystal. */
export function buyCrystal(g: Game, id: string): void {
  const P = g.player;
  if (!nearStructure(g, "tower")) { tell(g, "too far away", "#d96a5a"); return; }
  const r = researchById(id);
  if (!r || !isResearched(r.id)) return;
  // The level gate is checked here as well as drawn in the panel. The panel
  // already refuses to make the row clickable, but a hotbar or a future
  // shortcut could reach this function without going through it, and a gate
  // that only exists in the renderer is not a gate.
  if (!levelOk(r, P.level)) { tell(g, `needs level ${r.minLevel}`, "#c98a5a"); return; }
  if (!canAfford(P.bag, r.buyCost, homeChests(g))) { tell(g, "need materials"); return; }
  if (walletAcross([P.bag, ...homeChests(g)]) < (r.buyGold ?? 0)) { tell(g, "need gold", "#d96a5a"); return; }
  if (!canCarry(P, r.crystal, r.buyN)) { tell(g, "too heavy"); return; }
  const moved = r.buyN - addItem(P.bag, r.crystal, r.buyN);
  if (moved < r.buyN) { if (moved > 0) removeItem(P.bag, r.crystal, moved); tell(g, "bag full"); return; }
  payCost(P.bag, r.buyCost, homeChests(g));
  takeGoldAcross([P.bag, ...homeChests(g)], r.buyGold ?? 0);
  tell(g, `+${r.buyN} ${ITEMS[r.crystal].name}`, "#b9e07f");
  tone(440, 0.12, "sine", 0.05, 120);
}
