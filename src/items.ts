/**
 * Items: the full catalog, backpack stacking, equipment stats and
 * Forge crafting recipes. Pure data + logic — no world imports.
 */
import { BAG_SIZE } from "./config.ts";

export type ItemKind =
  // resources
  | "wood" | "stone" | "bones" | "herb" | "silk"
  // consumables
  | "mushroom" | "meat" | "hpPotion" | "mpPotion"
  // gear
  | "sword" | "ironSword" | "boneSword"
  | "helmet" | "armor" | "shieldItem" | "legs" | "boots" | "ring" | "amulet";

export type EqSlot = "head" | "body" | "legs" | "boots" | "weapon" | "shield" | "ring" | "amulet";

export interface GearStats {
  atk?: number;
  def?: number;
  speed?: number;
  maxhp?: number;
  maxmana?: number;
}

export interface ItemDef {
  name: string;
  /** Max stack in one bag slot. Gear never stacks. */
  stack: number;
  /** Base sale value at shops (buy price is ~2x). */
  value: number;
  slot?: EqSlot;
  gear?: GearStats;
  /** Consumable effect: hp/mana restored on use. */
  heal?: number;
  mana?: number;
}

export const ITEMS: Readonly<Record<ItemKind, ItemDef>> = {
  wood:      { name: "Wood",         stack: 50, value: 1 },
  stone:     { name: "Stone",        stack: 50, value: 1 },
  bones:     { name: "Bones",        stack: 50, value: 2 },
  herb:      { name: "Herb",         stack: 50, value: 3 },
  silk:      { name: "Spider Silk",  stack: 50, value: 4 },
  mushroom:  { name: "Mushroom",     stack: 20, value: 2, heal: 10 },
  meat:      { name: "Raw Meat",     stack: 20, value: 3, heal: 6 },
  hpPotion:  { name: "Health Potion", stack: 10, value: 12, heal: 45 },
  mpPotion:  { name: "Mana Potion",   stack: 10, value: 12, mana: 35 },
  sword:     { name: "Short Sword",  stack: 1, value: 15, slot: "weapon", gear: { atk: 3 } },
  ironSword: { name: "Iron Sword",   stack: 1, value: 45, slot: "weapon", gear: { atk: 7 } },
  boneSword: { name: "Bone Sword",   stack: 1, value: 120, slot: "weapon", gear: { atk: 12 } },
  helmet:    { name: "Iron Helmet",  stack: 1, value: 30, slot: "head",   gear: { def: 2 } },
  armor:     { name: "Plate Armor",  stack: 1, value: 70, slot: "body",   gear: { def: 4 } },
  shieldItem:{ name: "Wooden Shield", stack: 1, value: 25, slot: "shield", gear: { def: 3 } },
  legs:      { name: "Iron Legs",    stack: 1, value: 40, slot: "legs",   gear: { def: 2 } },
  boots:     { name: "Swift Boots",  stack: 1, value: 30, slot: "boots",  gear: { def: 1, speed: 6 } },
  ring:      { name: "Power Ring",   stack: 1, value: 90, slot: "ring",   gear: { atk: 2 } },
  amulet:    { name: "Bone Amulet",  stack: 1, value: 160, slot: "amulet", gear: { maxhp: 25, maxmana: 15 } },
};

/** One bag slot: an item kind and how many are stacked there. */
export interface ItemStack {
  kind: ItemKind;
  n: number;
}

export type Bag = (ItemStack | null)[];
export type Equipment = Record<EqSlot, ItemKind | null>;

export const EQ_SLOT_KEYS: readonly EqSlot[] = [
  "amulet", "head", "ring", "weapon", "body", "shield", "legs", "boots",
];

export function emptyBag(): Bag {
  return new Array<ItemStack | null>(BAG_SIZE).fill(null);
}
export function emptyEquipment(): Equipment {
  return { head: null, body: null, legs: null, boots: null, weapon: null, shield: null, ring: null, amulet: null };
}

/** Total count of `kind` across the bag. */
export function bagCount(bag: Bag, kind: ItemKind): number {
  let n = 0;
  for (const s of bag) if (s && s.kind === kind) n += s.n;
  return n;
}

/**
 * Add `n` of `kind` to the bag (fills stacks first, then empty slots).
 * Returns how many did NOT fit (0 = full success).
 */
export function addItem(bag: Bag, kind: ItemKind, n: number): number {
  const def = ITEMS[kind];
  let left = n;
  if (def.stack > 1) {
    for (const s of bag) {
      if (left <= 0) break;
      if (s && s.kind === kind && s.n < def.stack) {
        const take = Math.min(def.stack - s.n, left);
        s.n += take;
        left -= take;
      }
    }
  }
  for (let i = 0; i < bag.length && left > 0; i++) {
    if (bag[i] === null) {
      const take = Math.min(def.stack, left);
      bag[i] = { kind, n: take };
      left -= take;
    }
  }
  return left;
}

/** Remove `n` of `kind` from the bag. Returns true if it had enough. */
export function removeItem(bag: Bag, kind: ItemKind, n: number): boolean {
  if (bagCount(bag, kind) < n) return false;
  let left = n;
  for (let i = 0; i < bag.length && left > 0; i++) {
    const s = bag[i];
    if (s && s.kind === kind) {
      const take = Math.min(s.n, left);
      s.n -= take;
      left -= take;
      if (s.n <= 0) bag[i] = null;
    }
  }
  return true;
}

/** Sum a gear stat across all equipped items. */
export function gearStat(eq: Equipment, key: keyof GearStats): number {
  let v = 0;
  for (const slot of Object.keys(eq) as EqSlot[]) {
    const k = eq[slot];
    if (k) v += ITEMS[k].gear?.[key] ?? 0;
  }
  return v;
}

/** Forge crafting recipes. */
export interface Recipe {
  out: ItemKind;
  cost: Partial<Record<ItemKind, number>>;
}
export const RECIPES: readonly Recipe[] = [
  { out: "ironSword",  cost: { wood: 4, stone: 10 } },
  { out: "boneSword",  cost: { bones: 16, stone: 6 } },
  { out: "helmet",     cost: { stone: 8 } },
  { out: "armor",      cost: { stone: 14, wood: 4 } },
  { out: "shieldItem", cost: { wood: 8, stone: 3 } },
  { out: "legs",       cost: { stone: 9, wood: 2 } },
  { out: "boots",      cost: { wood: 6, silk: 4 } },
];

export function canCraft(bag: Bag, r: Recipe): boolean {
  return (Object.entries(r.cost) as [ItemKind, number][]).every(([k, v]) => bagCount(bag, k) >= v);
}
export function craft(bag: Bag, r: Recipe): boolean {
  if (!canCraft(bag, r)) return false;
  if (addItem(bag, r.out, 1) > 0) return false; // bag full — don't consume
  for (const [k, v] of Object.entries(r.cost) as [ItemKind, number][]) removeItem(bag, k, v);
  return true;
}
export function recipeCostText(r: Recipe): string {
  return (Object.entries(r.cost) as [ItemKind, number][])
    .map(([k, v]) => `${v} ${ITEMS[k].name}`)
    .join(" + ");
}
