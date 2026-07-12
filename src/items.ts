/**
 * Items: the full catalog, backpack stacking, equipment stats and
 * Forge crafting recipes. Pure data + logic — no world imports.
 */
import { BAG_SIZE, STASH_SIZE } from "./config.ts";

export type ItemKind =
  // resources
  | "wood" | "stone" | "bones" | "herb" | "silk"
  // consumables
  | "mushroom" | "meat" | "hpPotion"
  // crystals (charge-based spell replacements — one "use" per charge)
  | "healCrystal" | "fireCrystal" | "recallCrystal" | "spearCrystal"
  // rare research materials (gate the Alchemy Tower's tech tree)
  | "fireRuby"
  // ranged: bows (two-handed weapons) + arrows (consumable ammo)
  | "bow" | "longbow" | "arrow" | "boneArrow"
  // gear
  | "sword" | "ironSword" | "boneSword"
  | "helmet" | "armor" | "shieldItem" | "legs" | "boots" | "ring" | "amulet";

export type EqSlot = "head" | "body" | "legs" | "boots" | "weapon" | "shield" | "ring" | "amulet";

export interface GearStats {
  atk?: number;
  def?: number;
  speed?: number;
  maxhp?: number;
}

export interface ItemDef {
  name: string;
  /** Max stack in one bag slot. Gear never stacks. */
  stack: number;
  /** Base sale value at shops (buy price is ~2x). */
  value: number;
  /** Weight in oz — counts against the player's carry capacity. */
  weight: number;
  slot?: EqSlot;
  gear?: GearStats;
  /** Consumable effect: hp restored on use (potions, food). */
  heal?: number;
  /** True for charge-based crystals; each use consumes one from the stack. */
  crystal?: true;
  /** Bows: two-handed ranged weapon. `range` px reach, `power` adds to shot dmg. */
  bow?: { range: number; power: number };
  /** Arrows: consumable ammo. `dmg` adds to each shot's damage. */
  ammo?: { dmg: number };
}

export const ITEMS: Readonly<Record<ItemKind, ItemDef>> = {
  wood:      { name: "Wood",         stack: 9999, value: 1, weight: 10 },
  stone:     { name: "Stone",        stack: 9999, value: 1, weight: 14 },
  bones:     { name: "Bones",        stack: 9999, value: 2, weight: 8 },
  herb:      { name: "Herb",         stack: 9999, value: 3, weight: 3 },
  silk:      { name: "Spider Silk",  stack: 9999, value: 4, weight: 2 },
  mushroom:  { name: "Mushroom",     stack: 999, value: 2, weight: 4, heal: 10 },
  meat:      { name: "Raw Meat",     stack: 999, value: 3, weight: 8, heal: 6 },
  hpPotion:  { name: "Health Potion", stack: 999, value: 12, weight: 5, heal: 45 },
  healCrystal:   { name: "Life Crystal",   stack: 999, value: 8, weight: 2, crystal: true },
  fireCrystal:   { name: "Fire Crystal",   stack: 999, value: 8, weight: 2, crystal: true },
  recallCrystal: { name: "Recall Crystal", stack: 999, value: 6, weight: 2, crystal: true },
  spearCrystal:  { name: "Spear Crystal",  stack: 999, value: 14, weight: 2, crystal: true },
  fireRuby:      { name: "Fire Ruby",      stack: 999, value: 40, weight: 3 },
  bow:       { name: "Short Bow",    stack: 1, value: 35, weight: 30, slot: "weapon", gear: { atk: 1 }, bow: { range: 110, power: 4 } },
  longbow:   { name: "Hunter's Bow", stack: 1, value: 110, weight: 38, slot: "weapon", gear: { atk: 2 }, bow: { range: 150, power: 9 } },
  arrow:     { name: "Arrow",        stack: 999, value: 1, weight: 1, ammo: { dmg: 8 } },
  boneArrow: { name: "Bone Arrow",   stack: 999, value: 2, weight: 1, ammo: { dmg: 14 } },
  sword:     { name: "Short Sword",  stack: 1, value: 15, weight: 35, slot: "weapon", gear: { atk: 3 } },
  ironSword: { name: "Iron Sword",   stack: 1, value: 45, weight: 42, slot: "weapon", gear: { atk: 7 } },
  boneSword: { name: "Bone Sword",   stack: 1, value: 120, weight: 48, slot: "weapon", gear: { atk: 12 } },
  helmet:    { name: "Iron Helmet",  stack: 1, value: 30, weight: 55, slot: "head",   gear: { def: 2 } },
  armor:     { name: "Plate Armor",  stack: 1, value: 70, weight: 120, slot: "body",  gear: { def: 4 } },
  shieldItem:{ name: "Wooden Shield", stack: 1, value: 25, weight: 60, slot: "shield", gear: { def: 3 } },
  legs:      { name: "Iron Legs",    stack: 1, value: 40, weight: 90, slot: "legs",   gear: { def: 2 } },
  boots:     { name: "Swift Boots",  stack: 1, value: 30, weight: 24, slot: "boots",  gear: { def: 1, speed: 6 } },
  ring:      { name: "Power Ring",   stack: 1, value: 90, weight: 2, slot: "ring",    gear: { atk: 2 } },
  amulet:    { name: "Bone Amulet",  stack: 1, value: 160, weight: 5, slot: "amulet", gear: { maxhp: 35 } },
};

/** Weight of `n` of a given item kind, in oz. */
export function itemWeight(kind: ItemKind, n = 1): number {
  return ITEMS[kind].weight * n;
}

/** Total weight of everything in a bag, in oz. */
export function bagWeight(bag: Bag): number {
  let w = 0;
  for (const s of bag) if (s) w += ITEMS[s.kind].weight * s.n;
  return w;
}

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
export function emptyStash(): Bag {
  return new Array<ItemStack | null>(STASH_SIZE).fill(null);
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

/** Total count of `kind` across several bags (e.g. backpack + storage chest). */
export function countAcross(bags: readonly Bag[], kind: ItemKind): number {
  let n = 0;
  for (const b of bags) n += bagCount(b, kind);
  return n;
}

/**
 * Remove `n` of `kind` spread across several bags, in order (backpack first,
 * then stash). Returns true only if the combined total was enough.
 */
export function removeAcross(bags: readonly Bag[], kind: ItemKind, n: number): boolean {
  if (countAcross(bags, kind) < n) return false;
  let left = n;
  for (const b of bags) {
    if (left <= 0) break;
    const have = bagCount(b, kind);
    const take = Math.min(have, left);
    if (take > 0) { removeItem(b, kind, take); left -= take; }
  }
  return true;
}

/** The bow stats of the equipped weapon, or null if it isn't a bow. */
export function equippedBow(eq: Equipment): { range: number; power: number } | null {
  const w = eq.weapon;
  return w ? ITEMS[w].bow ?? null : null;
}

/**
 * Pick the best arrow kind present in the bag (Bone > plain), or null if none.
 * "Best" = highest ammo damage among kinds you actually carry.
 */
export function bestArrow(bag: Bag): ItemKind | null {
  let best: ItemKind | null = null;
  let bestDmg = -1;
  for (const kind of ["boneArrow", "arrow"] as const) {
    const def = ITEMS[kind].ammo;
    if (def && bagCount(bag, kind) > 0 && def.dmg > bestDmg) { best = kind; bestDmg = def.dmg; }
  }
  return best;
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
  /** How many of `out` a single craft yields (default 1). Crystals batch charges. */
  outN?: number;
  cost: Partial<Record<ItemKind, number>>;
}
export const RECIPES: readonly Recipe[] = [
  { out: "sword",      cost: { wood: 3, stone: 4 } },
  { out: "ironSword",  cost: { wood: 4, stone: 10 } },
  { out: "boneSword",  cost: { bones: 16, stone: 6 } },
  { out: "helmet",     cost: { stone: 8 } },
  { out: "armor",      cost: { stone: 14, wood: 4 } },
  { out: "shieldItem", cost: { wood: 8, stone: 3 } },
  { out: "legs",       cost: { stone: 9, wood: 2 } },
  { out: "boots",      cost: { wood: 6, silk: 4 } },
  { out: "ring",       cost: { stone: 6, bones: 8 } },
  { out: "amulet",     cost: { bones: 12, silk: 6 } },
  { out: "hpPotion",   cost: { herb: 3, mushroom: 2 } },
  // ranged: bows, then arrows in batches (the progression is in the ammo)
  { out: "bow",        cost: { wood: 6, silk: 2 } },
  { out: "longbow",    cost: { wood: 10, silk: 4, bones: 6 } },
  { out: "arrow",      outN: 10, cost: { wood: 2 } },
  { out: "boneArrow",  outN: 10, cost: { bones: 3, wood: 1 } },
];

export function canCraft(bag: Bag, r: Recipe): boolean {
  return (Object.entries(r.cost) as [ItemKind, number][]).every(([k, v]) => bagCount(bag, k) >= v);
}
export function craft(bag: Bag, r: Recipe): boolean {
  if (!canCraft(bag, r)) return false;
  if (addItem(bag, r.out, r.outN ?? 1) > 0) return false; // bag full — don't consume
  for (const [k, v] of Object.entries(r.cost) as [ItemKind, number][]) removeItem(bag, k, v);
  return true;
}

/** Can this recipe be paid for using several bags combined (backpack + chest)? */
export function canCraftAcross(bags: readonly Bag[], r: Recipe): boolean {
  return (Object.entries(r.cost) as [ItemKind, number][]).every(([k, v]) => countAcross(bags, k) >= v);
}
/**
 * Craft drawing materials from several bags (backpack first, then chest). The
 * output always lands in bags[0] (the backpack). Returns false without spending
 * anything if the materials are short or the backpack can't hold the result.
 */
export function craftAcross(bags: readonly Bag[], r: Recipe): boolean {
  if (!canCraftAcross(bags, r)) return false;
  if (addItem(bags[0], r.out, r.outN ?? 1) > 0) return false;
  for (const [k, v] of Object.entries(r.cost) as [ItemKind, number][]) removeAcross(bags, k, v);
  return true;
}

/**
 * Merge duplicate partial stacks of the same kind into as few slots as possible
 * (up to each item's stack limit), leaving freed slots null. Keeps the chest and
 * backpack tidy and repairs older saves that fragmented before stack limits grew.
 */
export function compactBag(bag: Bag): void {
  const total = new Map<ItemKind, number>();
  const order: ItemKind[] = [];
  for (const s of bag) {
    if (!s) continue;
    if (!total.has(s.kind)) order.push(s.kind);
    total.set(s.kind, (total.get(s.kind) ?? 0) + s.n);
  }
  bag.fill(null);
  for (const kind of order) addItem(bag, kind, total.get(kind) ?? 0);
}

/** Human-readable stat lines for the Look / inspect popup. */
export function itemInfoLines(kind: ItemKind): string[] {
  const d = ITEMS[kind];
  const lines: string[] = [];
  if (d.slot) lines.push(`Slot: ${d.slot}`);
  if (d.bow) lines.push(`Ranged weapon (two-handed)`, `Attack ${d.bow.power} · Range ${d.bow.range}`);
  if (d.ammo) lines.push(`Ammo · Attack ${d.ammo.dmg}`);
  if (d.gear?.atk) lines.push(`Attack +${d.gear.atk}`);
  if (d.gear?.def) lines.push(`Defense +${d.gear.def}`);
  if (d.gear?.speed) lines.push(`Speed +${d.gear.speed}`);
  if (d.gear?.maxhp) lines.push(`Max HP +${d.gear.maxhp}`);
  if (d.crystal) lines.push(`Charge item (1 use per unit)`);
  if (d.heal) lines.push(`Restores ${d.heal} HP`);
  lines.push(`Weight ${d.weight} oz · Value ${d.value} gp`);
  return lines;
}
export function recipeCostText(r: Recipe): string {
  const out = (Object.entries(r.cost) as [ItemKind, number][])
    .map(([k, v]) => `${v} ${ITEMS[k].name}`)
    .join(" + ");
  return (r.outN ?? 1) > 1 ? `${out}  →  x${r.outN}` : out;
}
