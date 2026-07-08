/** Town NPCs: their shop stock (sell list) and what they buy from you. */
import { ITEMS } from "../items.ts";
import type { ItemKind } from "../items.ts";
import type { NpcKey } from "../world/types.ts";

/** A row in an NPC's shop. */
export interface ShopEntry {
  kind: ItemKind;
  /** Gold the player pays to buy one. */
  buy: number;
  /** Gold the player receives to sell one (0 = NPC won't buy it). */
  sell: number;
}

const buyPrice = (k: ItemKind): number => Math.max(1, Math.round(ITEMS[k].value * 2));
const sellPrice = (k: ItemKind): number => Math.max(1, Math.round(ITEMS[k].value * 0.5));

function shop(sells: ItemKind[], buys: ItemKind[]): ShopEntry[] {
  const rows: ShopEntry[] = [];
  const seen = new Set<ItemKind>();
  for (const k of sells) {
    rows.push({ kind: k, buy: buyPrice(k), sell: buys.includes(k) ? sellPrice(k) : 0 });
    seen.add(k);
  }
  for (const k of buys) {
    if (!seen.has(k)) rows.push({ kind: k, buy: 0, sell: sellPrice(k) });
  }
  return rows;
}

export interface NpcShop {
  greeting: string;
  entries: ShopEntry[];
}

export const SHOPS: Readonly<Record<NpcKey, NpcShop>> = {
  smith: {
    greeting: "Fresh steel and a fair price. What'll it be?",
    entries: shop(
      ["sword", "ironSword", "helmet", "armor", "shieldItem", "legs"],
      ["wood", "stone", "bones", "ironSword", "boneSword", "sword"],
    ),
  },
  herbalist: {
    greeting: "Potions, herbs, remedies — all freshly picked.",
    entries: shop(
      ["hpPotion", "mpPotion", "boots"],
      ["herb", "mushroom", "silk", "meat"],
    ),
  },
  elder: {
    greeting: "Adventurer. There is work to be done. See your quest log.",
    entries: shop(
      ["amulet", "ring"],
      ["amulet", "ring", "boneSword"],
    ),
  },
};
