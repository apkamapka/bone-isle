/**
 * Items: the full catalog, backpack stacking, equipment stats and
 * Forge crafting recipes. Pure data + logic — no world imports.
 */
import { BAG_SIZE, STASH_SIZE, TILE } from "./config.ts";
import type { Element } from "./systems/elements.ts";

export type ItemKind =
  // resources
  | "wood" | "stone" | "bones" | "herb" | "silk"
  // creature materials (Etap 8): loot-only, sold to shops / future research & tasks
  | "venomGland" | "shell" | "wolfFur" | "ghoulClaw" | "dragonScale"
  // consumables
  | "mushroom" | "meat" | "hpPotion" | "dragonHam"
  // crystals (charge-based spell replacements — one "use" per charge)
  | "healCrystal" | "fireCrystal" | "recallCrystal" | "spearCrystal"
  // elemental crystals: 5 elements x 3 tiers x 2 roles, plus tier-I arrows
  | "fireEmberShard" | "fireEmberBurst" | "fireFlameShard" | "fireFlameBurst" | "firePyreShard" | "firePyreBurst" | "iceFrostShard" | "iceFrostBurst" | "iceRimeShard" | "iceRimeBurst" | "iceGlacierShard" | "iceGlacierBurst" | "earthLoamShard" | "earthLoamBurst" | "earthStoneShard" | "earthStoneBurst" | "earthBedrockShard" | "earthBedrockBurst" | "stormSparkShard" | "stormSparkBurst" | "stormBoltShard" | "stormBoltBurst" | "stormTempestShard" | "stormTempestBurst" | "shadowGloomShard" | "shadowGloomBurst" | "shadowUmbraShard" | "shadowUmbraBurst" | "shadowEclipseShard" | "shadowEclipseBurst" | "fireArrow" | "iceArrow" | "earthArrow" | "stormArrow" | "shadowArrow"
  // rare research materials (gate the Alchemy Tower's tech tree)
  | "fireRuby"
  // ranged: bows (two-handed weapons) + arrows (consumable ammo)
  | "bow" | "longbow" | "arrow" | "boneArrow"
  // practice ammo: blunt shafts fired only at the Archery Range (Etap 10)
  | "trainingArrow"
  /* ---- GEAR (Etap 22) --------------------------------------------------
   * Six tiers, two parallel lines with the SAME silhouette of stats: the
   * beast line carries one more point of armor on its body piece, the human
   * line is roughly 15% lighter and faster on the boots. Wearing all four
   * worn pieces of one set pays a bonus on top, which is what stops the
   * obvious exploit of pairing the heavier beast plate with the quicker
   * human boots — mixing costs more armor than the mismatch ever gains.
   * -------------------------------------------------------------------- */
  // tier 1 — Leather (human line) / Snakeskin (beast line)
  | "leatherHelm" | "leatherBody" | "leatherLegs" | "leatherBoots" | "leatherShield"
  | "snakeskinHelm" | "snakeskinBody" | "snakeskinLegs" | "snakeskinBoots" | "snakeskinShield"
  // tier 2 — Studded (human line) / Goblin (beast line)
  | "studdedHelm" | "studdedBody" | "studdedLegs" | "studdedBoots" | "studdedShield"
  | "goblinHelm" | "goblinBody" | "goblinLegs" | "goblinBoots" | "goblinShield"
  // tier 3 — Chain (human line) / Orcish (beast line)
  | "chainHelm" | "chainBody" | "chainLegs" | "chainBoots" | "chainShield"
  | "orcishHelm" | "orcishBody" | "orcishLegs" | "orcishBoots" | "orcishShield"
  // tier 4 — Plate (human line) / Minotaur (beast line)
  | "plateHelm" | "plateBody" | "plateLegs" | "plateBoots" | "plateShield"
  | "minotaurHelm" | "minotaurBody" | "minotaurLegs" | "minotaurBoots" | "minotaurShield"
  // tier 5 — Steel (human line) / Marrow (beast line)
  | "steelHelm" | "steelBody" | "steelLegs" | "steelBoots" | "steelShield"
  | "marrowHelm" | "marrowBody" | "marrowLegs" | "marrowBoots" | "marrowShield"
  // tier 6 — Knight (human line) / Dragon (beast line)
  | "knightHelm" | "knightBody" | "knightLegs" | "knightBoots" | "knightShield"
  | "dragonHelm" | "dragonBody" | "dragonLegs" | "dragonBoots" | "dragonShield"
  // weapons: the two lines diverge here rather than mirroring each other —
  // human smiths make swords and hammers that guard as well as they cut,
  // beasts carry axes and fangs that hit harder and defend far worse
  | "shortSword" | "fangDagger" | "ironSword" | "goblinHatchet" | "mercBlade" | "warHammer" | "orcishAxe" | "gladius" | "boneSword" | "minotaurAxe" | "warlordBlade" | "steelMaul" | "demonCleaver" | "knightSword" | "fireSword" | "marrowBlade"
  | "ring" | "amulet"
  // Amulet of Loss: protects your items on death (consumed), Tibia-style
  | "aolAmulet"
  // containers & test gear (Etap 11)
  | "backpack" | "booster";

export type EqSlot = "head" | "body" | "legs" | "boots" | "weapon" | "shield" | "ring" | "amulet";

/** The twelve matched sets: six tiers, a human and a beast line at each. */
export type SetKey = "leather" | "studded" | "chain" | "plate" | "steel" | "knight" | "snakeskin" | "goblin" | "orcish" | "minotaur" | "marrow" | "dragon";

/**
 * Armor paid for wearing head + body + legs + boots all from one set.
 *
 * This exists to kill one specific exploit. The beast line carries a point
 * more armor on its body piece and the human line is lighter with faster
 * boots, so without a bonus the optimal outfit is always beast plate over
 * human boots — the two lines stop being a choice and become a shopping
 * list. The bonus is set above the one-point gap on purpose: breaking the
 * set to cherry-pick costs strictly more than the mismatch is worth.
 */
export const SET_BONUS: Readonly<Record<SetKey, number>> = {
  leather: 2, snakeskin: 2,
  studded: 2, goblin: 2,
  chain: 2, orcish: 2,
  plate: 2, minotaur: 2,
  steel: 3, marrow: 3,
  knight: 3, dragon: 3,
};

/** The four worn slots a set is counted across. Shields and weapons are out. */
export const SET_SLOTS = ["head", "body", "legs", "boots"] as const;

export interface GearStats {
  atk?: number;
  /** Guard rating. On worn pieces it is armor; on a shield or a weapon it is
   *  the defense pool — and those two do NOT stack, the larger one wins.
   *  See defenseShield() for why, and for what defBonus does differently. */
  def?: number;
  /** A weapon's always-on guard, added on top of whichever pool won. Small by
   *  design: it is the reason a sword still defends better than a maul when
   *  both are held behind the same shield. */
  defBonus?: number;
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
  /** Which matched set this piece belongs to, if any. Wearing head + body +
   *  legs + boots all tagged the same pays SET_BONUS on top of their armor.
   *  Shields and weapons deliberately carry no tag: a player should be free
   *  to pick the guard in their hands on its own merits. */
  set?: SetKey;
  /** Food: eating banks this many seconds of HP regeneration (Tibia-style). */
  food?: number;
  /** Consumable effect: hp restored on use (potions). */
  heal?: number;
  /** True for charge-based crystals; each use consumes one from the stack. */
  crystal?: true;
  /** Element carried by an elemental crystal or arrow. Absent = physical, and
   *  physical damage is the kind that armor gets to stop. */
  element?: Element;
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
  // ---- the elemental line. Naming runs Ember/Flame/Pyre by tier, and
  // ---- Shard/Burst by role: a Shard flies at one target, a Burst goes off
  // ---- where it lands. Tier is legible from the name alone, which matters
  // ---- when thirty of them share a backpack.
fireEmberShard: { name: "Ember Shard", stack: 999, value: 9, weight: 2, crystal: true },
  fireEmberBurst: { name: "Ember Burst", stack: 999, value: 14, weight: 2, crystal: true },
  fireFlameShard: { name: "Flame Shard", stack: 999, value: 23, weight: 2, crystal: true },
  fireFlameBurst: { name: "Flame Burst", stack: 999, value: 36, weight: 2, crystal: true },
  firePyreShard: { name: "Pyre Shard", stack: 999, value: 58, weight: 2, crystal: true },
  firePyreBurst: { name: "Pyre Burst", stack: 999, value: 90, weight: 2, crystal: true },
  iceFrostShard: { name: "Frost Shard", stack: 999, value: 9, weight: 2, crystal: true },
  iceFrostBurst: { name: "Frost Burst", stack: 999, value: 14, weight: 2, crystal: true },
  iceRimeShard: { name: "Rime Shard", stack: 999, value: 23, weight: 2, crystal: true },
  iceRimeBurst: { name: "Rime Burst", stack: 999, value: 36, weight: 2, crystal: true },
  iceGlacierShard: { name: "Glacier Shard", stack: 999, value: 58, weight: 2, crystal: true },
  iceGlacierBurst: { name: "Glacier Burst", stack: 999, value: 90, weight: 2, crystal: true },
  earthLoamShard: { name: "Loam Shard", stack: 999, value: 9, weight: 2, crystal: true },
  earthLoamBurst: { name: "Loam Burst", stack: 999, value: 14, weight: 2, crystal: true },
  earthStoneShard: { name: "Stone Shard", stack: 999, value: 23, weight: 2, crystal: true },
  earthStoneBurst: { name: "Stone Burst", stack: 999, value: 36, weight: 2, crystal: true },
  earthBedrockShard: { name: "Bedrock Shard", stack: 999, value: 58, weight: 2, crystal: true },
  earthBedrockBurst: { name: "Bedrock Burst", stack: 999, value: 90, weight: 2, crystal: true },
  stormSparkShard: { name: "Spark Shard", stack: 999, value: 9, weight: 2, crystal: true },
  stormSparkBurst: { name: "Spark Burst", stack: 999, value: 14, weight: 2, crystal: true },
  stormBoltShard: { name: "Bolt Shard", stack: 999, value: 23, weight: 2, crystal: true },
  stormBoltBurst: { name: "Bolt Burst", stack: 999, value: 36, weight: 2, crystal: true },
  stormTempestShard: { name: "Tempest Shard", stack: 999, value: 58, weight: 2, crystal: true },
  stormTempestBurst: { name: "Tempest Burst", stack: 999, value: 90, weight: 2, crystal: true },
  shadowGloomShard: { name: "Gloom Shard", stack: 999, value: 9, weight: 2, crystal: true },
  shadowGloomBurst: { name: "Gloom Burst", stack: 999, value: 14, weight: 2, crystal: true },
  shadowUmbraShard: { name: "Umbra Shard", stack: 999, value: 23, weight: 2, crystal: true },
  shadowUmbraBurst: { name: "Umbra Burst", stack: 999, value: 36, weight: 2, crystal: true },
  shadowEclipseShard: { name: "Eclipse Shard", stack: 999, value: 58, weight: 2, crystal: true },
  shadowEclipseBurst: { name: "Eclipse Burst", stack: 999, value: 90, weight: 2, crystal: true },
  fireArrow: { name: "Ember Arrow", stack: 999, value: 4, weight: 1, ammo: { dmg: 10 }, element: "fire" },
  iceArrow: { name: "Frost Arrow", stack: 999, value: 4, weight: 1, ammo: { dmg: 10 }, element: "ice" },
  earthArrow: { name: "Loam Arrow", stack: 999, value: 4, weight: 1, ammo: { dmg: 10 }, element: "earth" },
  stormArrow: { name: "Spark Arrow", stack: 999, value: 4, weight: 1, ammo: { dmg: 10 }, element: "storm" },
  shadowArrow: { name: "Gloom Arrow", stack: 999, value: 4, weight: 1, ammo: { dmg: 10 }, element: "shadow" },
  fireRuby:      { name: "Fire Ruby",      stack: 999, value: 40, weight: 3 },
  bow:       { name: "Short Bow",    stack: 1, value: 35, weight: 30, slot: "weapon", gear: { atk: 1 }, bow: { range: 5 * TILE, power: 4 } },
  longbow:   { name: "Hunter's Bow", stack: 1, value: 110, weight: 38, slot: "weapon", gear: { atk: 2 }, bow: { range: 5 * TILE, power: 9 } },
  arrow:     { name: "Arrow",        stack: 999, value: 1, weight: 1, ammo: { dmg: 8 } },
  // Blunt practice shafts: dirt-cheap (1g at the smith, or bulk-crafted from
  // wood), zero attack — pure Distance training fodder for the Archery Range.
  trainingArrow: { name: "Training Arrow", stack: 9999, value: 0, weight: 1, ammo: { dmg: 0 }, practice: true },
  boneArrow: { name: "Bone Arrow",   stack: 999, value: 2, weight: 1, ammo: { dmg: 14 } },
  /* ---- weapons ---- */
  shortSword: { name: "Short Sword", stack: 1, value: 15, weight: 35, slot: "weapon", gear: { atk: 6, def: 6, defBonus: 1 } },
  fangDagger: { name: "Fang Dagger", stack: 1, value: 20, weight: 28, slot: "weapon", gear: { atk: 8, def: 2 } },
  ironSword: { name: "Iron Sword", stack: 1, value: 45, weight: 42, slot: "weapon", gear: { atk: 10, def: 10, defBonus: 2 } },
  goblinHatchet: { name: "Goblin Hatchet", stack: 1, value: 60, weight: 48, slot: "weapon", gear: { atk: 13, def: 5 } },
  mercBlade: { name: "Mercenary Blade", stack: 1, value: 90, weight: 46, slot: "weapon", gear: { atk: 13, def: 13, defBonus: 2 } },
  warHammer: { name: "War Hammer", stack: 1, value: 85, weight: 70, slot: "weapon", gear: { atk: 15, def: 6 } },
  orcishAxe: { name: "Orcish Axe", stack: 1, value: 110, weight: 55, slot: "weapon", gear: { atk: 17, def: 7 } },
  gladius: { name: "Gladius", stack: 1, value: 150, weight: 44, slot: "weapon", gear: { atk: 16, def: 16, defBonus: 3 } },
  boneSword: { name: "Bone Sword", stack: 1, value: 170, weight: 48, slot: "weapon", gear: { atk: 18, def: 14, defBonus: 2 } },
  minotaurAxe: { name: "Minotaur Axe", stack: 1, value: 200, weight: 62, slot: "weapon", gear: { atk: 21, def: 9, defBonus: 1 } },
  warlordBlade: { name: "Warlord's Blade", stack: 1, value: 260, weight: 46, slot: "weapon", gear: { atk: 20, def: 20, defBonus: 3 } },
  steelMaul: { name: "Steel Maul", stack: 1, value: 250, weight: 86, slot: "weapon", gear: { atk: 24, def: 9 } },
  demonCleaver: { name: "Demon Cleaver", stack: 1, value: 300, weight: 68, slot: "weapon", gear: { atk: 25, def: 11, defBonus: 1 } },
  knightSword: { name: "Knight's Longsword", stack: 1, value: 420, weight: 52, slot: "weapon", gear: { atk: 24, def: 22, defBonus: 3 } },
  fireSword: { name: "Fire Sword", stack: 1, value: 460, weight: 46, slot: "weapon", gear: { atk: 26, def: 16, defBonus: 2 } },
  marrowBlade: { name: "Marrow Blade", stack: 1, value: 480, weight: 52, slot: "weapon", gear: { atk: 24, def: 24, defBonus: 4 } },
  /* ---- tier 1: Leather / Snakeskin (set bonus +1 worn complete) ---- */
  leatherHelm: { name: "Leather Helmet", stack: 1, value: 6, weight: 17, slot: "head", gear: { def: 1 }, set: "leather" },
  snakeskinHelm: { name: "Snakeskin Hood", stack: 1, value: 7, weight: 20, slot: "head", gear: { def: 1 }, set: "snakeskin" },
  leatherBody: { name: "Leather Armor", stack: 1, value: 12, weight: 60, slot: "body", gear: { def: 1 }, set: "leather" },
  snakeskinBody: { name: "Snakeskin Mail", stack: 1, value: 14, weight: 70, slot: "body", gear: { def: 2 }, set: "snakeskin" },
  leatherLegs: { name: "Leather Legs", stack: 1, value: 8, weight: 34, slot: "legs", gear: { def: 1 }, set: "leather" },
  snakeskinLegs: { name: "Snakeskin Legs", stack: 1, value: 9, weight: 40, slot: "legs", gear: { def: 1 }, set: "snakeskin" },
  leatherBoots: { name: "Leather Boots", stack: 1, value: 5, weight: 15, slot: "boots", gear: { def: 0, speed: 2 }, set: "leather" },
  snakeskinBoots: { name: "Snakeskin Boots", stack: 1, value: 6, weight: 18, slot: "boots", gear: { def: 0 }, set: "snakeskin" },
  leatherShield: { name: "Leather Shield", stack: 1, value: 10, weight: 51, slot: "shield", gear: { def: 4 } },
  snakeskinShield: { name: "Snakeskin Buckler", stack: 1, value: 12, weight: 60, slot: "shield", gear: { def: 4 } },
  /* ---- tier 2: Studded / Goblin (set bonus +1 worn complete) ---- */
  studdedHelm: { name: "Studded Helmet", stack: 1, value: 15, weight: 26, slot: "head", gear: { def: 1 }, set: "studded" },
  goblinHelm: { name: "Goblin Skull", stack: 1, value: 17, weight: 30, slot: "head", gear: { def: 1 }, set: "goblin" },
  studdedBody: { name: "Studded Armor", stack: 1, value: 30, weight: 72, slot: "body", gear: { def: 3 }, set: "studded" },
  goblinBody: { name: "Goblin Mail", stack: 1, value: 34, weight: 85, slot: "body", gear: { def: 4 }, set: "goblin" },
  studdedLegs: { name: "Studded Legs", stack: 1, value: 21, weight: 51, slot: "legs", gear: { def: 2 }, set: "studded" },
  goblinLegs: { name: "Goblin Legs", stack: 1, value: 24, weight: 60, slot: "legs", gear: { def: 2 }, set: "goblin" },
  studdedBoots: { name: "Studded Boots", stack: 1, value: 12, weight: 17, slot: "boots", gear: { def: 1, speed: 4 }, set: "studded" },
  goblinBoots: { name: "Goblin Boots", stack: 1, value: 14, weight: 20, slot: "boots", gear: { def: 1 }, set: "goblin" },
  studdedShield: { name: "Studded Shield", stack: 1, value: 24, weight: 53, slot: "shield", gear: { def: 6 } },
  goblinShield: { name: "Goblin Shield", stack: 1, value: 28, weight: 62, slot: "shield", gear: { def: 6 } },
  /* ---- tier 3: Chain / Orcish (set bonus +2 worn complete) ---- */
  chainHelm: { name: "Chain Helmet", stack: 1, value: 30, weight: 38, slot: "head", gear: { def: 2 }, set: "chain" },
  orcishHelm: { name: "Orcish Helm", stack: 1, value: 34, weight: 45, slot: "head", gear: { def: 2 }, set: "orcish" },
  chainBody: { name: "Chain Armor", stack: 1, value: 60, weight: 81, slot: "body", gear: { def: 4 }, set: "chain" },
  orcishBody: { name: "Orcish Mail", stack: 1, value: 69, weight: 95, slot: "body", gear: { def: 5 }, set: "orcish" },
  chainLegs: { name: "Chain Legs", stack: 1, value: 42, weight: 64, slot: "legs", gear: { def: 2 }, set: "chain" },
  orcishLegs: { name: "Orcish Legs", stack: 1, value: 48, weight: 75, slot: "legs", gear: { def: 2 }, set: "orcish" },
  chainBoots: { name: "Chain Boots", stack: 1, value: 24, weight: 20, slot: "boots", gear: { def: 1, speed: 6 }, set: "chain" },
  orcishBoots: { name: "Orcish Boots", stack: 1, value: 28, weight: 24, slot: "boots", gear: { def: 1, speed: 2 }, set: "orcish" },
  chainShield: { name: "Chain Shield", stack: 1, value: 48, weight: 55, slot: "shield", gear: { def: 8 } },
  orcishShield: { name: "Orcish Shield", stack: 1, value: 55, weight: 65, slot: "shield", gear: { def: 8 } },
  /* ---- tier 4: Plate / Minotaur (set bonus +2 worn complete) ---- */
  plateHelm: { name: "Plate Helmet", stack: 1, value: 55, weight: 42, slot: "head", gear: { def: 3 }, set: "plate" },
  minotaurHelm: { name: "Minotaur Helm", stack: 1, value: 63, weight: 50, slot: "head", gear: { def: 3 }, set: "minotaur" },
  plateBody: { name: "Plate Armor", stack: 1, value: 110, weight: 102, slot: "body", gear: { def: 6 }, set: "plate" },
  minotaurBody: { name: "Minotaur Mail", stack: 1, value: 126, weight: 120, slot: "body", gear: { def: 7 }, set: "minotaur" },
  plateLegs: { name: "Plate Legs", stack: 1, value: 77, weight: 76, slot: "legs", gear: { def: 3 }, set: "plate" },
  minotaurLegs: { name: "Minotaur Legs", stack: 1, value: 89, weight: 90, slot: "legs", gear: { def: 3 }, set: "minotaur" },
  plateBoots: { name: "Plate Boots", stack: 1, value: 44, weight: 22, slot: "boots", gear: { def: 1, speed: 8 }, set: "plate" },
  minotaurBoots: { name: "Minotaur Hooves", stack: 1, value: 51, weight: 26, slot: "boots", gear: { def: 1, speed: 4 }, set: "minotaur" },
  plateShield: { name: "Plate Shield", stack: 1, value: 88, weight: 58, slot: "shield", gear: { def: 11 } },
  minotaurShield: { name: "Minotaur Shield", stack: 1, value: 101, weight: 68, slot: "shield", gear: { def: 11 } },
  /* ---- tier 5: Steel / Marrow (set bonus +3 worn complete) ---- */
  steelHelm: { name: "Steel Helmet", stack: 1, value: 100, weight: 44, slot: "head", gear: { def: 3 }, set: "steel" },
  marrowHelm: { name: "Marrow Helm", stack: 1, value: 115, weight: 52, slot: "head", gear: { def: 3 }, set: "marrow" },
  steelBody: { name: "Steel Armor", stack: 1, value: 200, weight: 94, slot: "body", gear: { def: 8 }, set: "steel" },
  marrowBody: { name: "Marrow Plate", stack: 1, value: 230, weight: 110, slot: "body", gear: { def: 9 }, set: "marrow" },
  steelLegs: { name: "Steel Legs", stack: 1, value: 140, weight: 70, slot: "legs", gear: { def: 4 }, set: "steel" },
  marrowLegs: { name: "Marrow Greaves", stack: 1, value: 161, weight: 82, slot: "legs", gear: { def: 4 }, set: "marrow" },
  steelBoots: { name: "Steel Boots", stack: 1, value: 80, weight: 21, slot: "boots", gear: { def: 2, speed: 10 }, set: "steel" },
  marrowBoots: { name: "Marrow Treads", stack: 1, value: 92, weight: 25, slot: "boots", gear: { def: 2, speed: 6 }, set: "marrow" },
  steelShield: { name: "Steel Shield", stack: 1, value: 160, weight: 56, slot: "shield", gear: { def: 14 } },
  marrowShield: { name: "Marrow Shield", stack: 1, value: 184, weight: 66, slot: "shield", gear: { def: 14 } },
  /* ---- tier 6: Knight / Dragon (set bonus +3 worn complete) ---- */
  knightHelm: { name: "Knight Helmet", stack: 1, value: 170, weight: 44, slot: "head", gear: { def: 5 }, set: "knight" },
  dragonHelm: { name: "Dragon Helm", stack: 1, value: 195, weight: 52, slot: "head", gear: { def: 5 }, set: "dragon" },
  knightBody: { name: "Knight Armor", stack: 1, value: 340, weight: 94, slot: "body", gear: { def: 9 }, set: "knight" },
  dragonBody: { name: "Dragon Scale Mail", stack: 1, value: 391, weight: 110, slot: "body", gear: { def: 10 }, set: "dragon" },
  knightLegs: { name: "Knight Legs", stack: 1, value: 238, weight: 71, slot: "legs", gear: { def: 5 }, set: "knight" },
  dragonLegs: { name: "Dragon Scale Legs", stack: 1, value: 274, weight: 84, slot: "legs", gear: { def: 5 }, set: "dragon" },
  knightBoots: { name: "Knight Boots", stack: 1, value: 136, weight: 22, slot: "boots", gear: { def: 2, speed: 12 }, set: "knight" },
  dragonBoots: { name: "Dragon Scale Boots", stack: 1, value: 156, weight: 26, slot: "boots", gear: { def: 2, speed: 8 }, set: "dragon" },
  knightShield: { name: "Knight Shield", stack: 1, value: 272, weight: 60, slot: "shield", gear: { def: 17 } },
  dragonShield: { name: "Dragon Shield", stack: 1, value: 313, weight: 70, slot: "shield", gear: { def: 17 } },
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
  /* ---- weapons a smith can actually make: the human line, plus the two
   * bone pieces that Bonetown's undead pay for. Everything beast-made is
   * loot only — nobody in town knows how to forge an orcish axe. ---- */
  { out: "shortSword", cost: { wood: 3, stone: 4 } },
  { out: "ironSword",  cost: { wood: 4, stone: 10 } },
  { out: "mercBlade",  cost: { wood: 5, stone: 16, silk: 4 } },
  { out: "warHammer",  cost: { wood: 6, stone: 22 } },
  { out: "boneSword",  cost: { bones: 16, stone: 6 } },
  /* ---- the Leather set: the first matched outfit, cheap on purpose ---- */
  { out: "leatherHelm",   cost: { silk: 4, wood: 2 } },
  { out: "leatherBody",   cost: { silk: 8, wood: 3 } },
  { out: "leatherLegs",   cost: { silk: 6, wood: 2 } },
  { out: "leatherBoots",  cost: { silk: 5, wood: 2 } },
  { out: "leatherShield", cost: { wood: 8, stone: 3 } },
  /* ---- the Chain set: the level 20-30 goal you work towards rather than
   * one you have to be lucky enough to loot ---- */
  { out: "chainHelm",   cost: { stone: 10, bones: 4 } },
  { out: "chainBody",   cost: { stone: 20, silk: 6 } },
  { out: "chainLegs",   cost: { stone: 14, silk: 4 } },
  { out: "chainBoots",  cost: { stone: 8, silk: 6 } },
  { out: "chainShield", cost: { stone: 12, wood: 8 } },
  { out: "ring",       cost: { stone: 6, bones: 8 } },
  { out: "amulet",     cost: { bones: 12, silk: 6 } },
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
  if (d.gear?.def) {
    // The same number means two different things depending on where it sits,
    // and hiding that would make gear choices unreadable: worn pieces stack
    // into armor, while a shield and a weapon compete for one guard pool and
    // only the larger of the two is ever consulted.
    const handHeld = d.slot === "shield" || d.slot === "weapon";
    lines.push(handHeld ? `Defense ${d.gear.def} (higher of shield/weapon counts)` : `Armor +${d.gear.def}`);
  }
  if (d.gear?.defBonus) lines.push(`Defense +${d.gear.defBonus} even behind a shield`);
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
