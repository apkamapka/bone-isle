/**
 * Items: the full catalog, backpack stacking, equipment stats and
 * Forge crafting recipes. Pure data + logic — no world imports.
 */
import { BAG_SIZE, STASH_SIZE, TILE } from "./config.ts";

export type ItemKind =
  // resources
  | "wood" | "stone" | "bones" | "herb" | "silk"
  // creature materials (Etap 8): loot-only, sold to shops / future research & tasks
  | "venomGland" | "shell" | "wolfFur" | "ghoulClaw" | "dragonScale"
  // consumables
  | "mushroom" | "meat" | "hpPotion" | "dragonHam"
  // crystals (charge-based spell replacements — one "use" per charge)
  | "healCrystal" | "fireCrystal" | "recallCrystal" | "spearCrystal"
  // rare research materials (gate the Alchemy Tower's tech tree)
  | "fireRuby"
  // ranged: bows (two-handed weapons) + arrows (consumable ammo)
  | "bow" | "longbow" | "arrow" | "boneArrow"
  // practice ammo: blunt shafts fired only at the Archery Range (Etap 10)
  | "trainingArrow"
  // gear
  | "sword" | "ironSword" | "boneSword" | "marrowBlade"
  | "battleAxe" | "fireSword"
  | "helmet" | "armor" | "shieldItem" | "legs" | "boots" | "ring" | "amulet"
  | "leatherArmor" | "chainArmor" | "dragonScaleArmor"
  | "steelShield" | "dragonShield"
  // the Marrow set (Etap 9c): five one-time chest prizes matching the Marrow
  // Blade — each piece hoarded on a different camp's deepest lair floor
  | "marrowShield" | "marrowArmor" | "marrowHelmet" | "marrowLegs" | "marrowBoots"
  // Amulet of Loss: protects your items on death (consumed), Tibia-style
  | "aolAmulet"
  // containers & test gear (Etap 11)
  | "backpack" | "booster";

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
  /** Food: eating banks this many seconds of HP regeneration (Tibia-style). */
  food?: number;
  /** Consumable effect: hp restored on use (potions). */
  heal?: number;
  /** True for charge-based crystals; each use consumes one from the stack. */
  crystal?: true;
  /** Bows: two-handed ranged weapon. `range` is WORLD px (doubled with TILE in
   *  Etap 17 — 220 px is the same 7 tiles it always was). `power` adds to dmg. */
  bow?: { range: number; power: number };
  /** Arrows: consumable ammo. `dmg` adds to each shot's damage. */
  ammo?: { dmg: number };
  /** Practice ammo: never picked for combat; fired only at the Archery
   *  Range's straw butt (the target that can actually catch a blunt shaft). */
  practice?: true;
  /** Amulet of Loss: worn in the amulet slot, consumed on death, protects
   *  your backpack + equipment from dropping (never exp or skills). */
  deathProtect?: true;
  /** Backpack: while carried, adds this many bag slots (see PACK_MAX). */
  pack?: { slots: number };
  /** TEST item: eating grants +5 levels and +20 to every skill. */
  boost?: true;
}

export const ITEMS: Readonly<Record<ItemKind, ItemDef>> = {
  wood:      { name: "Wood",         stack: 9999, value: 1, weight: 10 },
  stone:     { name: "Stone",        stack: 9999, value: 1, weight: 14 },
  bones:     { name: "Bones",        stack: 9999, value: 2, weight: 8 },
  herb:      { name: "Herb",         stack: 9999, value: 3, weight: 3 },
  silk:      { name: "Spider Silk",  stack: 9999, value: 4, weight: 2 },
  venomGland:{ name: "Venom Gland",  stack: 9999, value: 5, weight: 2 },
  shell:     { name: "Crab Shell",   stack: 9999, value: 3, weight: 6 },
  wolfFur:   { name: "Wolf Fur",     stack: 9999, value: 6, weight: 5 },
  ghoulClaw: { name: "Ghoul Claw",   stack: 9999, value: 8, weight: 3 },
  dragonScale:{ name: "Dragon Scale", stack: 999, value: 60, weight: 4 },
  mushroom:  { name: "Mushroom",     stack: 999, value: 2, weight: 4, food: 60 },
  meat:      { name: "Raw Meat",     stack: 999, value: 3, weight: 8, food: 180 },
  dragonHam: { name: "Dragon Ham",   stack: 999, value: 8, weight: 10, food: 360 },
  hpPotion:  { name: "Health Potion", stack: 999, value: 12, weight: 5, heal: 45 },
  healCrystal:   { name: "Life Crystal",   stack: 999, value: 8, weight: 2, crystal: true },
  fireCrystal:   { name: "Fire Crystal",   stack: 999, value: 8, weight: 2, crystal: true },
  recallCrystal: { name: "Recall Crystal", stack: 999, value: 6, weight: 2, crystal: true },
  spearCrystal:  { name: "Spear Crystal",  stack: 999, value: 14, weight: 2, crystal: true },
  fireRuby:      { name: "Fire Ruby",      stack: 999, value: 40, weight: 3 },
  bow:       { name: "Short Bow",    stack: 1, value: 35, weight: 30, slot: "weapon", gear: { atk: 1 }, bow: { range: 5 * TILE, power: 4 } },
  longbow:   { name: "Hunter's Bow", stack: 1, value: 110, weight: 38, slot: "weapon", gear: { atk: 2 }, bow: { range: 5 * TILE, power: 9 } },
  arrow:     { name: "Arrow",        stack: 999, value: 1, weight: 1, ammo: { dmg: 8 } },
  // Blunt practice shafts: dirt-cheap (1g at the smith, or bulk-crafted from
  // wood), zero attack — pure Distance training fodder for the Archery Range.
  trainingArrow: { name: "Training Arrow", stack: 9999, value: 0, weight: 1, ammo: { dmg: 0 }, practice: true },
  boneArrow: { name: "Bone Arrow",   stack: 999, value: 2, weight: 1, ammo: { dmg: 14 } },
  sword:     { name: "Short Sword",  stack: 1, value: 15, weight: 35, slot: "weapon", gear: { atk: 3 } },
  ironSword: { name: "Iron Sword",   stack: 1, value: 45, weight: 42, slot: "weapon", gear: { atk: 7 } },
  battleAxe: { name: "Battle Axe",   stack: 1, value: 80, weight: 45, slot: "weapon", gear: { atk: 9 } },
  boneSword: { name: "Bone Sword",   stack: 1, value: 120, weight: 48, slot: "weapon", gear: { atk: 12 } },
  // Fire Sword — the dragon's rare blade: below the Marrow Blade (20) but
  // obtainable without the cave-bottom chest run.
  fireSword: { name: "Fire Sword",   stack: 1, value: 350, weight: 46, slot: "weapon", gear: { atk: 16 } },
  // Unique treasure: found only in the chest at the bottom of the Bone
  // Caverns (-3). Deliberately absent from every shop and every loot table.
  marrowBlade: { name: "Marrow Blade", stack: 1, value: 480, weight: 52, slot: "weapon", gear: { atk: 20 } },
  helmet:    { name: "Iron Helmet",  stack: 1, value: 30, weight: 55, slot: "head",   gear: { def: 2 } },
  leatherArmor:{ name: "Leather Armor", stack: 1, value: 25, weight: 70, slot: "body", gear: { def: 2 } },
  chainArmor:{ name: "Chain Armor",  stack: 1, value: 45, weight: 95, slot: "body",  gear: { def: 3 } },
  armor:     { name: "Plate Armor",  stack: 1, value: 70, weight: 120, slot: "body",  gear: { def: 4 } },
  dragonScaleArmor:{ name: "Dragon Scale Armor", stack: 1, value: 400, weight: 100, slot: "body", gear: { def: 7 } },
  shieldItem:{ name: "Wooden Shield", stack: 1, value: 25, weight: 60, slot: "shield", gear: { def: 3 } },
  steelShield:{ name: "Steel Shield", stack: 1, value: 70, weight: 65, slot: "shield", gear: { def: 5 } },
  dragonShield:{ name: "Dragon Shield", stack: 1, value: 300, weight: 70, slot: "shield", gear: { def: 8 } },
  // ---- the Marrow set: pale bone plate with a silver sheen and gold trim,
  // ---- the armour counterpart of the Marrow Blade. One-time chest prizes.
  marrowShield:{ name: "Marrow Shield",  stack: 1, value: 520, weight: 68, slot: "shield", gear: { def: 10 } },
  marrowArmor: { name: "Marrow Plate",   stack: 1, value: 620, weight: 110, slot: "body",  gear: { def: 9 } },
  marrowHelmet:{ name: "Marrow Helm",    stack: 1, value: 420, weight: 52, slot: "head",   gear: { def: 5 } },
  marrowLegs:  { name: "Marrow Greaves", stack: 1, value: 460, weight: 84, slot: "legs",   gear: { def: 6 } },
  marrowBoots: { name: "Marrow Boots",   stack: 1, value: 380, weight: 26, slot: "boots",  gear: { def: 3, speed: 16 } },
  legs:      { name: "Iron Legs",    stack: 1, value: 40, weight: 90, slot: "legs",   gear: { def: 2 } },
  boots:     { name: "Swift Boots",  stack: 1, value: 30, weight: 24, slot: "boots",  gear: { def: 1, speed: 12 } },
  ring:      { name: "Power Ring",   stack: 1, value: 90, weight: 2, slot: "ring",    gear: { atk: 2 } },
  amulet:    { name: "Bone Amulet",  stack: 1, value: 160, weight: 5, slot: "amulet", gear: { maxhp: 35 } },
  aolAmulet: { name: "Amulet of Loss", stack: 1, value: 250, weight: 4, slot: "amulet", deathProtect: true },
  // Backpack: buy it at the smith, keep it IN your bag — each one carried adds
  // 8 slots (up to 2 packs). Gear never stacks, so two packs take two slots.
  backpack:  { name: "Backpack",     stack: 1, value: 20, weight: 18, pack: { slots: 8 } },
  // TEST ONLY (Radek): a 1-gold forge brew that force-feeds levels & skills so
  // late-game content can be reached instantly. Slated for removal.
  booster:   { name: "Dopalacz",     stack: 999, value: 0, weight: 1, boost: true },
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

/**
 * Whether the bag has room (slots + stacking) for `n` more of `kind`,
 * WITHOUT modifying anything. Used to pre-check quest/task item rewards so
 * they are never silently lost to a full backpack.
 */
export function bagRoomFor(bag: Bag, kind: ItemKind, n: number): boolean {
  const def = ITEMS[kind];
  let room = 0;
  for (const s of bag) {
    if (s === null) room += def.stack;
    else if (s.kind === kind && def.stack > 1) room += def.stack - s.n;
    if (room >= n) return true;
  }
  return room >= n;
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
 * Pick the best COMBAT arrow kind present in the bag (Bone > plain), or null
 * if none. "Best" = highest ammo damage among kinds you actually carry.
 * Practice arrows are deliberately excluded — they never fire at monsters.
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

/**
 * Arrow pick when shooting the Archery Range: training arrows first (that's
 * what they're for — save the real ammo), falling back to combat arrows so a
 * hunter without practice shafts can still use the butt.
 */
export function bestPracticeArrow(bag: Bag): ItemKind | null {
  if (bagCount(bag, "trainingArrow") > 0) return "trainingArrow";
  return bestArrow(bag);
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

/** Like gearStat, but summed over the given slots only. Lets combat split
 *  defense into its shield part (blockable) and its armor part (always on). */
export function gearStatOf(eq: Equipment, key: keyof GearStats, slots: readonly EqSlot[]): number {
  let v = 0;
  for (const slot of slots) {
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
  /** Optional gold cost on top of materials (checked/paid by the caller). */
  gold?: number;
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
  // Amulet of Loss — pure gold sink; protects items (not exp/skills) on death
  { out: "aolAmulet",  cost: {}, gold: 500 },
  // TEST ONLY: the Dopalacz — 1 gold, +5 levels, +20 every skill (see above)
  { out: "booster",    cost: {}, gold: 1 },
  { out: "hpPotion",   cost: { herb: 3, mushroom: 2 } },
  // ranged: bows, then arrows in batches (the progression is in the ammo)
  { out: "bow",        cost: { wood: 6, silk: 2 } },
  { out: "longbow",    cost: { wood: 10, silk: 4, bones: 6 } },
  { out: "arrow",      outN: 10, cost: { wood: 2 } },
  // practice ammo is deliberately dirt cheap: one log → a whole quiver
  { out: "trainingArrow", outN: 25, cost: { wood: 1 } },
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
  if (d.ammo && d.practice) lines.push(`Practice ammo — Archery Range only`);
  else if (d.ammo) lines.push(`Ammo · Attack ${d.ammo.dmg}`);
  if (d.food) lines.push(`Feeds you for ${d.food}s`);
  if (d.gear?.atk) lines.push(`Attack +${d.gear.atk}`);
  if (d.gear?.def) lines.push(`Defense +${d.gear.def}`);
  if (d.gear?.speed) lines.push(`Speed +${d.gear.speed}`);
  if (d.gear?.maxhp) lines.push(`Max HP +${d.gear.maxhp}`);
  if (d.crystal) lines.push(`Charge item (1 use per unit)`);
  if (d.deathProtect) lines.push(`Protects your items on death`, `(one use — the amulet shatters)`);
  if (d.pack) lines.push(`Carried in the bag: +${d.pack.slots} bag slots`, `(up to 2 backpacks count)`);
  if (d.boost) lines.push(`TEST: +5 levels, +20 every skill`);
  if (d.heal) lines.push(`Restores ${d.heal} HP`);
  lines.push(`Weight ${d.weight} oz · Value ${d.value} gp`);
  return lines;
}
export function recipeCostText(r: Recipe): string {
  const parts = (Object.entries(r.cost) as [ItemKind, number][])
    .map(([k, v]) => `${v} ${ITEMS[k].name}`);
  if (r.gold) parts.push(`${r.gold} gold`);
  const out = parts.join(" + ");
  return (r.outN ?? 1) > 1 ? `${out}  →  x${r.outN}` : out;
}
