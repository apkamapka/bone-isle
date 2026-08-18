/**
 * Items: the full catalog, backpack stacking, equipment stats and
 * Forge crafting recipes. Pure data + logic — no world imports.
 */
import { BAG_SIZE, CORPSE_SLOTS, STASH_SIZE, TILE } from "./config.ts";
import type { Element } from "./systems/elements.ts";

export type ItemKind =
  // resources
  | "wood" | "stone" | "bones"
  // creature materials (Etap 8): loot-only, sold to shops / future research & tasks
  | "venomGland" | "ghoulClaw" | "dragonScale"
  // creature trophies (Etap 24): 15% from their family, the feedstock of Essential Gems
  | "minotaurHorn" | "orcEar" | "goblinFang" | "cursedRib"
  // forge materials (Etap 24): smelted from looted gear, never bought
  | "iron" | "steel" | "essentialGem"
  // furnace fuel: dropped by anything that makes camp — people, orcs,
  // goblins, minotaurs. Not by beasts, and not by the undead.
  | "coal"
  // consumables
  | "mushroom" | "meat" | "hpPotion" | "dragonHam"
  // crystals (charge-based spell replacements — one "use" per charge)
  //
  // Only the two UTILITY crystals survive. Flare and Spear — the originals'
  // offensive pair — were retired in Etap 26: the elemental line does that
  // job now, and keeping a free, unattuned fire crystal in the starting bag
  // undercut the whole point of attunement. Offence is something you unlock.
  | "healCrystal" | "recallCrystal"
  // elemental crystals: 5 elements x 3 tiers x 2 roles, plus tier-I arrows
  | "fireEmberShard" | "fireEmberBurst" | "fireEmberNova" | "fireEmberWave" | "fireEmberArrow"
  | "fireFlameShard" | "fireFlameBurst" | "fireFlameNova" | "fireFlameWave" | "fireFlameArrow"
  | "firePyreShard" | "firePyreBurst" | "firePyreNova" | "firePyreWave" | "firePyreArrow"
  | "iceFrostShard" | "iceFrostBurst" | "iceFrostNova" | "iceFrostWave" | "iceFrostArrow"
  | "iceRimeShard" | "iceRimeBurst" | "iceRimeNova" | "iceRimeWave" | "iceRimeArrow"
  | "iceGlacierShard" | "iceGlacierBurst" | "iceGlacierNova" | "iceGlacierWave" | "iceGlacierArrow"
  | "earthLoamShard" | "earthLoamBurst" | "earthLoamNova" | "earthLoamWave" | "earthLoamArrow"
  | "earthStoneShard" | "earthStoneBurst" | "earthStoneNova" | "earthStoneWave" | "earthStoneArrow"
  | "earthBedrockShard" | "earthBedrockBurst" | "earthBedrockNova" | "earthBedrockWave" | "earthBedrockArrow"
  | "stormSparkShard" | "stormSparkBurst" | "stormSparkNova" | "stormSparkWave" | "stormSparkArrow"
  | "stormBoltShard" | "stormBoltBurst" | "stormBoltNova" | "stormBoltWave" | "stormBoltArrow"
  | "stormTempestShard" | "stormTempestBurst" | "stormTempestNova" | "stormTempestWave" | "stormTempestArrow"
  | "shadowGloomShard" | "shadowGloomBurst" | "shadowGloomNova" | "shadowGloomWave" | "shadowGloomArrow"
  | "shadowUmbraShard" | "shadowUmbraBurst" | "shadowUmbraNova" | "shadowUmbraWave" | "shadowUmbraArrow"
  | "shadowEclipseShard" | "shadowEclipseBurst" | "shadowEclipseNova" | "shadowEclipseWave" | "shadowEclipseArrow"
  /* ---- ATTUNEMENT STONES (Etap 25) -------------------------------------
   * One per element, and the only key that opens that element's lane in the
   * Alchemy Tower. They replace the Fire Ruby, which gated exactly one
   * project and dropped from half the bestiary — a rare material common
   * enough to be a formality. These drop from nothing at all: they are quest
   * rewards, so opening a lane is a thing you DID rather than a thing that
   * fell out of a corpse.
   *
   * The fiction maps the stone to the element rather than naming it after it:
   * ice is researched with water, storm with lightning, wind with wind.
   * -------------------------------------------------------------------- */
  | "fireCrystal" | "waterCrystal" | "earthCrystal" | "windCrystal" | "lightningCrystal"
  /** Spent buying the strongest crystal of every element. Drops from the dragon. */
  | "magicEssence"
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
  | "backpack" | "booster"
  // currency (Etap 27): money is carried, weighed and dropped like anything else
  | "goldCoin" | "platinumCoin";

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
  /** Container: this item HAS slots of its own, and opens as a window.
   *  Tibia's rule, not the old additive one — a backpack inside a backpack is
   *  a second container you open, never extra cells bolted onto the first. */
  pack?: { slots: number };
  /** Currency: what one of these is worth in gold pieces. Only coins have it. */
  coin?: number;
  /** TEST item: eating grants +5 levels and +20 to every skill. */
  boost?: true;
}

export const ITEMS: Readonly<Record<ItemKind, ItemDef>> = {
  wood:      { name: "Wood",         stack: 9999, value: 1, weight: 10 },
  stone:     { name: "Stone",        stack: 9999, value: 1, weight: 14 },
  bones:     { name: "Bones",        stack: 9999, value: 2, weight: 8 },
  venomGland:{ name: "Venom Gland",  stack: 9999, value: 15, weight: 2 },
  ghoulClaw: { name: "Ghoul Claw",   stack: 9999, value: 25, weight: 3 },
  dragonScale:{ name: "Dragon Scale", stack: 999, value: 60, weight: 4 },
  // ---- trophies. Priced to be worth selling once you have your gems, which
  // ---- is exactly the regret the design wants: sell early, pay later.
  minotaurHorn: { name: "Minotaur Horn", stack: 9999, value: 45, weight: 5 },
  orcEar:       { name: "Orc Ear",       stack: 9999, value: 20, weight: 2 },
  goblinFang:   { name: "Goblin Fang",   stack: 9999, value: 15, weight: 1 },
  cursedRib:    { name: "Cursed Rib",    stack: 9999, value: 30, weight: 3 },
  // ---- forge materials. Iron and steel are LIGHT on purpose: the Alchemy
  // ---- Tower wants 600 iron and 550 steel, and at a realistic weight the
  // ---- logistics of carrying them would be a bigger obstacle than earning
  // ---- them. Storage Chests count towards build costs, so the haul is
  // ---- spread over many trips either way.
  iron:         { name: "Iron",          stack: 9999, value: 12, weight: 5 },
  steel:        { name: "Steel",         stack: 9999, value: 100, weight: 6 },
  essentialGem: { name: "Essential Gem", stack: 999, value: 1000, weight: 3 },
  coal:         { name: "Coal",          stack: 9999, value: 4, weight: 4 },
  mushroom:  { name: "Mushroom",     stack: 999, value: 2, weight: 4, food: 60 },
  meat:      { name: "Raw Meat",     stack: 999, value: 3, weight: 8, food: 180 },
  dragonHam: { name: "Dragon Ham",   stack: 999, value: 8, weight: 10, food: 360 },
  hpPotion:  { name: "Health Potion", stack: 999, value: 12, weight: 5, heal: 45 },
  healCrystal:   { name: "Life Crystal",   stack: 999, value: 8, weight: 2, crystal: true },
  recallCrystal: { name: "Recall Crystal", stack: 999, value: 6, weight: 2, crystal: true },
  // ---- the elemental line. Naming runs Ember/Flame/Pyre by tier, and
  // ---- Shard/Burst by role: a Shard flies at one target, a Burst goes off
  // ---- where it lands. Tier is legible from the name alone, which matters
  // ---- when thirty of them share a backpack.
fireEmberShard: { name: "Ember Shard", stack: 999, value: 9, weight: 2, crystal: true },
  fireEmberBurst: { name: "Ember Burst", stack: 999, value: 14, weight: 2, crystal: true },
  fireEmberNova: { name: "Ember Nova", stack: 999, value: 12, weight: 2, crystal: true },
  fireEmberWave: { name: "Ember Wave", stack: 999, value: 16, weight: 2, crystal: true },
  fireEmberArrow: { name: "Ember Arrow", stack: 999, value: 4, weight: 1, ammo: { dmg: 10 }, element: "fire" },
  fireFlameShard: { name: "Flame Shard", stack: 999, value: 23, weight: 2, crystal: true },
  fireFlameBurst: { name: "Flame Burst", stack: 999, value: 36, weight: 2, crystal: true },
  fireFlameNova: { name: "Flame Nova", stack: 999, value: 30, weight: 2, crystal: true },
  fireFlameWave: { name: "Flame Wave", stack: 999, value: 40, weight: 2, crystal: true },
  fireFlameArrow: { name: "Flame Arrow", stack: 999, value: 10, weight: 1, ammo: { dmg: 20 }, element: "fire" },
  firePyreShard: { name: "Pyre Shard", stack: 999, value: 58, weight: 2, crystal: true },
  firePyreBurst: { name: "Pyre Burst", stack: 999, value: 90, weight: 2, crystal: true },
  firePyreNova: { name: "Pyre Nova", stack: 999, value: 76, weight: 2, crystal: true },
  firePyreWave: { name: "Pyre Wave", stack: 999, value: 100, weight: 2, crystal: true },
  firePyreArrow: { name: "Pyre Arrow", stack: 999, value: 25, weight: 1, ammo: { dmg: 42 }, element: "fire" },
  iceFrostShard: { name: "Frost Shard", stack: 999, value: 9, weight: 2, crystal: true },
  iceFrostBurst: { name: "Frost Burst", stack: 999, value: 14, weight: 2, crystal: true },
  iceFrostNova: { name: "Frost Nova", stack: 999, value: 12, weight: 2, crystal: true },
  iceFrostWave: { name: "Frost Wave", stack: 999, value: 16, weight: 2, crystal: true },
  iceFrostArrow: { name: "Frost Arrow", stack: 999, value: 4, weight: 1, ammo: { dmg: 10 }, element: "ice" },
  iceRimeShard: { name: "Rime Shard", stack: 999, value: 23, weight: 2, crystal: true },
  iceRimeBurst: { name: "Rime Burst", stack: 999, value: 36, weight: 2, crystal: true },
  iceRimeNova: { name: "Rime Nova", stack: 999, value: 30, weight: 2, crystal: true },
  iceRimeWave: { name: "Rime Wave", stack: 999, value: 40, weight: 2, crystal: true },
  iceRimeArrow: { name: "Rime Arrow", stack: 999, value: 10, weight: 1, ammo: { dmg: 20 }, element: "ice" },
  iceGlacierShard: { name: "Glacier Shard", stack: 999, value: 58, weight: 2, crystal: true },
  iceGlacierBurst: { name: "Glacier Burst", stack: 999, value: 90, weight: 2, crystal: true },
  iceGlacierNova: { name: "Glacier Nova", stack: 999, value: 76, weight: 2, crystal: true },
  iceGlacierWave: { name: "Glacier Wave", stack: 999, value: 100, weight: 2, crystal: true },
  iceGlacierArrow: { name: "Glacier Arrow", stack: 999, value: 25, weight: 1, ammo: { dmg: 42 }, element: "ice" },
  earthLoamShard: { name: "Loam Shard", stack: 999, value: 9, weight: 2, crystal: true },
  earthLoamBurst: { name: "Loam Burst", stack: 999, value: 14, weight: 2, crystal: true },
  earthLoamNova: { name: "Loam Nova", stack: 999, value: 12, weight: 2, crystal: true },
  earthLoamWave: { name: "Loam Wave", stack: 999, value: 16, weight: 2, crystal: true },
  earthLoamArrow: { name: "Loam Arrow", stack: 999, value: 4, weight: 1, ammo: { dmg: 10 }, element: "earth" },
  earthStoneShard: { name: "Stone Shard", stack: 999, value: 23, weight: 2, crystal: true },
  earthStoneBurst: { name: "Stone Burst", stack: 999, value: 36, weight: 2, crystal: true },
  earthStoneNova: { name: "Stone Nova", stack: 999, value: 30, weight: 2, crystal: true },
  earthStoneWave: { name: "Stone Wave", stack: 999, value: 40, weight: 2, crystal: true },
  earthStoneArrow: { name: "Stone Arrow", stack: 999, value: 10, weight: 1, ammo: { dmg: 20 }, element: "earth" },
  earthBedrockShard: { name: "Bedrock Shard", stack: 999, value: 58, weight: 2, crystal: true },
  earthBedrockBurst: { name: "Bedrock Burst", stack: 999, value: 90, weight: 2, crystal: true },
  earthBedrockNova: { name: "Bedrock Nova", stack: 999, value: 76, weight: 2, crystal: true },
  earthBedrockWave: { name: "Bedrock Wave", stack: 999, value: 100, weight: 2, crystal: true },
  earthBedrockArrow: { name: "Bedrock Arrow", stack: 999, value: 25, weight: 1, ammo: { dmg: 42 }, element: "earth" },
  stormSparkShard: { name: "Spark Shard", stack: 999, value: 9, weight: 2, crystal: true },
  stormSparkBurst: { name: "Spark Burst", stack: 999, value: 14, weight: 2, crystal: true },
  stormSparkNova: { name: "Spark Nova", stack: 999, value: 12, weight: 2, crystal: true },
  stormSparkWave: { name: "Spark Wave", stack: 999, value: 16, weight: 2, crystal: true },
  stormSparkArrow: { name: "Spark Arrow", stack: 999, value: 4, weight: 1, ammo: { dmg: 10 }, element: "storm" },
  stormBoltShard: { name: "Bolt Shard", stack: 999, value: 23, weight: 2, crystal: true },
  stormBoltBurst: { name: "Bolt Burst", stack: 999, value: 36, weight: 2, crystal: true },
  stormBoltNova: { name: "Bolt Nova", stack: 999, value: 30, weight: 2, crystal: true },
  stormBoltWave: { name: "Bolt Wave", stack: 999, value: 40, weight: 2, crystal: true },
  stormBoltArrow: { name: "Bolt Arrow", stack: 999, value: 10, weight: 1, ammo: { dmg: 20 }, element: "storm" },
  stormTempestShard: { name: "Tempest Shard", stack: 999, value: 58, weight: 2, crystal: true },
  stormTempestBurst: { name: "Tempest Burst", stack: 999, value: 90, weight: 2, crystal: true },
  stormTempestNova: { name: "Tempest Nova", stack: 999, value: 76, weight: 2, crystal: true },
  stormTempestWave: { name: "Tempest Wave", stack: 999, value: 100, weight: 2, crystal: true },
  stormTempestArrow: { name: "Tempest Arrow", stack: 999, value: 25, weight: 1, ammo: { dmg: 42 }, element: "storm" },
  shadowGloomShard: { name: "Zephyr Shard", stack: 999, value: 9, weight: 2, crystal: true },
  shadowGloomBurst: { name: "Zephyr Burst", stack: 999, value: 14, weight: 2, crystal: true },
  shadowGloomNova: { name: "Zephyr Nova", stack: 999, value: 12, weight: 2, crystal: true },
  shadowGloomWave: { name: "Zephyr Wave", stack: 999, value: 16, weight: 2, crystal: true },
  shadowGloomArrow: { name: "Zephyr Arrow", stack: 999, value: 4, weight: 1, ammo: { dmg: 10 }, element: "shadow" },
  shadowUmbraShard: { name: "Squall Shard", stack: 999, value: 23, weight: 2, crystal: true },
  shadowUmbraBurst: { name: "Squall Burst", stack: 999, value: 36, weight: 2, crystal: true },
  shadowUmbraNova: { name: "Squall Nova", stack: 999, value: 30, weight: 2, crystal: true },
  shadowUmbraWave: { name: "Squall Wave", stack: 999, value: 40, weight: 2, crystal: true },
  shadowUmbraArrow: { name: "Squall Arrow", stack: 999, value: 10, weight: 1, ammo: { dmg: 20 }, element: "shadow" },
  shadowEclipseShard: { name: "Cyclone Shard", stack: 999, value: 58, weight: 2, crystal: true },
  shadowEclipseBurst: { name: "Cyclone Burst", stack: 999, value: 90, weight: 2, crystal: true },
  shadowEclipseNova: { name: "Cyclone Nova", stack: 999, value: 76, weight: 2, crystal: true },
  shadowEclipseWave: { name: "Cyclone Wave", stack: 999, value: 100, weight: 2, crystal: true },
  shadowEclipseArrow: { name: "Cyclone Arrow", stack: 999, value: 25, weight: 1, ammo: { dmg: 42 }, element: "shadow" },
  /* Attunement stones and the Essence carry value 0 on purpose. A shop that
   * buys them turns a quest reward into a lump of gold, and a lane you can
   * sell is a lane you can lose. They are keys, not loot. */
  fireCrystal:      { name: "Fire Crystal",      stack: 99, value: 0, weight: 3 },
  waterCrystal:     { name: "Water Crystal",     stack: 99, value: 0, weight: 3 },
  earthCrystal:     { name: "Earth Crystal",     stack: 99, value: 0, weight: 3 },
  windCrystal:      { name: "Wind Crystal",      stack: 99, value: 0, weight: 3 },
  lightningCrystal: { name: "Lightning Crystal", stack: 99, value: 0, weight: 3 },
  magicEssence:     { name: "Essence of Magic",  stack: 99, value: 0, weight: 2 },
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
  marrowBlade: { name: "Marrow Blade", stack: 1, value: 480, weight: 52, slot: "weapon", gear: { atk: 23, def: 21, defBonus: 4 } },
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
  // Backpack: buy it at the smith. A CONTAINER, not a capacity upgrade — it
  // holds BAG_SIZE slots of its own and opens as its own window, so a pack in
  // a pack is a second bag to open rather than cells bolted onto the first.
  // One is worn; every spare rides inside another and earns its 18 oz.
  backpack:  { name: "Backpack",     stack: 1, value: 20, weight: 18, pack: { slots: BAG_SIZE } },
  /* Money, Tibia's way: a thing in your bag with a weight, not a number on
   * the HUD. Platinum exists because gold alone would price wealth out of a
   * level-1 carry cap — 5 000 gp at 0.1 oz is 500 oz, the entire allowance —
   * and a purse that heavy is a chore, not a decision. A crystal coin can be
   * added the day totals justify it; today's richest kill drops ~210. */
  goldCoin:     { name: "Gold Coin",     stack: 100, value: 1, weight: 0.1, coin: 1 },
  platinumCoin: { name: "Platinum Coin", stack: 100, value: 100, weight: 0.1, coin: 100 },
  // TEST ONLY (Radek): a 1-gold forge brew that force-feeds levels & skills so
  // late-game content can be reached instantly. Slated for removal.
  booster:   { name: "Dopalacz",     stack: 999, value: 0, weight: 1, boost: true },
};

/** Weight of `n` of a given item kind, in oz. */
export function itemWeight(kind: ItemKind, n = 1): number {
  return ITEMS[kind].weight * n;
}

/** Total weight of everything in a bag, in oz — nested packs included. */
export function bagWeight(bag: Bag): number {
  let w = 0;
  for (const s of bag) {
    if (!s) continue;
    w += ITEMS[s.kind].weight * s.n;
    if (s.items) w += bagWeight(s.items);
  }
  return w;
}

/** Weight of one stack, counting whatever it is carrying inside. */
export function stackWeight(st: ItemStack): number {
  return ITEMS[st.kind].weight * st.n + (st.items ? bagWeight(st.items) : 0);
}

/**
 * One bag slot: an item kind and how many are stacked there.
 *
 * Container kinds (anything with `pack`) carry their own slots in `items`.
 * That single optional field is what makes the whole inventory a TREE rather
 * than a list: a backpack in your backpack is a node, not eight extra cells,
 * and it travels with its contents wherever it goes — into a chest, onto the
 * floor, into your corpse.
 */
export interface ItemStack {
  kind: ItemKind;
  n: number;
  /** Container items only: the slots inside. Created on demand. */
  items?: Bag;
}

export type Bag = (ItemStack | null)[];

/**
 * The bag of someone wearing no backpack. Frozen, so every `addItem` against
 * it reports that nothing fitted instead of silently growing a phantom
 * inventory — being bagless has to actually cost you something.
 */
export const NO_BAG: Bag = Object.freeze([] as (ItemStack | null)[]) as Bag;
export type Equipment = Record<EqSlot, ItemKind | null>;

export const EQ_SLOT_KEYS: readonly EqSlot[] = [
  "amulet", "head", "ring", "weapon", "body", "shield", "legs", "boots",
];

export function emptyBag(): Bag {
  return new Array<ItemStack | null>(BAG_SIZE).fill(null);
}

/**
 * A container of its own, empty, or null if this kind isn't one.
 * Sizing lives with the item, so a smaller sack is one catalog entry away.
 */
export function newContainer(kind: ItemKind): ItemStack | null {
  const slots = ITEMS[kind].pack?.slots;
  if (!slots) return null;
  return { kind, n: 1, items: new Array<ItemStack | null>(slots).fill(null) };
}

/** True when this kind opens as a window rather than just sitting in a slot. */
export function isContainer(kind: ItemKind): boolean {
  return !!ITEMS[kind].pack;
}

/** A container stack's slots, created at the right size on first touch. */
export function contentsOf(st: ItemStack): Bag | null {
  const slots = ITEMS[st.kind].pack?.slots;
  if (!slots) return null;
  if (!st.items) st.items = new Array<ItemStack | null>(slots).fill(null);
  // an older save (or a hand-built stack) may carry the wrong length
  while (st.items.length < slots) st.items.push(null);
  return st.items;
}

/**
 * Every occupied slot in a bag and everything nested inside it.
 *
 * This is the number a Storage Chest budgets against. Without it, nesting
 * packs would turn a 50-slot chest into 800 and the whole upgrade ladder
 * (10 / 50 / 100) would stop meaning anything — you would never build a
 * Chest III when a Chest I plus five backpacks beats it.
 */
export function bagSlotsUsed(bag: Bag): number {
  let n = 0;
  for (const s of bag) {
    if (!s) continue;
    n++;
    if (s.items) n += bagSlotsUsed(s.items);
  }
  return n;
}

/** What one stack costs a container budget: itself plus anything inside it. */
export function stackSlotCost(st: ItemStack): number {
  return 1 + (st.items ? bagSlotsUsed(st.items) : 0);
}
export function emptyStash(size: number = STASH_SIZE): Bag {
  return new Array<ItemStack | null>(size).fill(null);
}

/** A corpse's slots. Same size as a backpack — a body IS a container now. */
export function emptyCorpseBag(): Bag {
  return new Array<ItemStack | null>(CORPSE_SLOTS).fill(null);
}

/**
 * A corpse pre-filled with a roll of loot and its purse.
 *
 * The coins go in as ITEMS, in the same slots as everything else. A corpse no
 * longer has a `gold` field at all — money that behaves differently from loot
 * is money you cannot drop, chest, or leave in a loot bag, and all three are
 * things the player will now expect to do with it.
 */
export function corpseBag(loot: readonly { kind: ItemKind; n: number }[], gold = 0): Bag {
  const bag = emptyCorpseBag();
  if (gold > 0) giveGold(bag, gold);
  for (const it of loot) addItem(bag, it.kind, it.n);
  return bag;
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
    // a pack inside this one is real room too — that is what makes carrying a
    // spare backpack worth the 18 oz
    else if (s.items && bagRoomFor(s.items, kind, n - room)) return true;
    if (room >= n) return true;
  }
  return room >= n;
}

/** Total count of `kind` in the bag AND every pack nested inside it. */
export function bagCount(bag: Bag, kind: ItemKind): number {
  let n = 0;
  for (const s of bag) {
    if (!s) continue;
    if (s.kind === kind) n += s.n;
    if (s.items) n += bagCount(s.items, kind);
  }
  return n;
}

/**
 * Add `n` of `kind` to the bag (fills stacks first, then empty slots).
 * Returns how many did NOT fit (0 = full success).
 */
export function addItem(bag: Bag, kind: ItemKind, n: number): number {
  const def = ITEMS[kind];
  let left = n;
  // 1. top up partial stacks here…
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
  // 2. …then free cells here…
  for (let i = 0; i < bag.length && left > 0; i++) {
    if (bag[i] === null) {
      const take = Math.min(def.stack, left);
      // a container arriving as loose loot still needs slots of its own
      bag[i] = newContainer(kind) ?? { kind, n: take };
      left -= take;
    }
  }
  // 3. …and only then cascade into nested packs. Depth-last is what makes
  // pickup predictable: things land in the bag you are looking at, and only
  // overflow disappears into a sub-pack.
  for (const s of bag) {
    if (left <= 0) break;
    if (s?.items) left = addItem(s.items, kind, left);
  }
  return left;
}

/**
 * Put an existing stack — contents and all — into the first cell that fits.
 * Returns false and changes nothing when there is no room.
 *
 * Distinct from `addItem` because a container must move as one object: adding
 * it "by kind" would mint a fresh empty pack and strand everything inside it.
 */
export function addStack(bag: Bag, st: ItemStack): boolean {
  const def = ITEMS[st.kind];
  // a plain stackable merges the usual way
  if (def.stack > 1 && !st.items) return addItem(bag, st.kind, st.n) === 0;
  for (let i = 0; i < bag.length; i++) {
    if (bag[i] === null) { bag[i] = st; return true; }
  }
  for (const s of bag) {
    if (s?.items && s !== st && addStack(s.items, st)) return true;
  }
  return false;
}

/**
 * Remove `n` of `kind`, but never a container that still has something in it.
 *
 * Selling, smelting and crafting all run through the plain `removeItem`, and
 * every one of them would happily consume a full backpack and silently take
 * its contents with it. Tibia's NPCs refuse a loaded pack for exactly this
 * reason. Returns false without touching anything when the only copies you
 * own are packed.
 */
export function removeItemUnpacked(bag: Bag, kind: ItemKind, n: number): boolean {
  if (!ITEMS[kind].pack) return removeItem(bag, kind, n);
  const empties: { arr: Bag; i: number }[] = [];
  const walk = (b: Bag): void => {
    for (let i = 0; i < b.length; i++) {
      const s = b[i];
      if (!s) continue;
      if (s.kind === kind && !(s.items ?? []).some((q) => q !== null)) empties.push({ arr: b, i });
      if (s.items) walk(s.items);
    }
  };
  walk(bag);
  if (empties.length < n) return false;
  for (let k = 0; k < n; k++) empties[k].arr[empties[k].i] = null;
  return true;
}

/**
 * Remove `n` of `kind` from the bag or any pack inside it.
 *
 * A CONTAINER kind is handed to `removeItemUnpacked`, which only ever takes
 * empty ones. This is the single most dangerous operation in the tree: every
 * generic "spend one of these" — a recipe cost, a smelt, a task hand-in —
 * goes through here, and deleting a slot that happens to be a full backpack
 * would take everything inside it with no warning and no way back. Making the
 * safe rule the DEFAULT means a future caller cannot get it wrong by
 * forgetting which function to reach for.
 */
export function removeItem(bag: Bag, kind: ItemKind, n: number): boolean {
  if (ITEMS[kind].pack) return removeItemUnpacked(bag, kind, n);
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
  // shallow first, then dig — a crafting cost should empty the bag you can
  // see before it starts rummaging through the pack inside it
  for (const s of bag) {
    if (left <= 0) break;
    if (s?.items) {
      const have = bagCount(s.items, kind);
      const take = Math.min(have, left);
      if (take > 0 && removeItem(s.items, kind, take)) left -= take;
    }
  }
  return left === 0;
}

/* ---------------- money ---------------- */

/**
 * The coin kinds, biggest denomination first. Derived from the catalog so a
 * crystal coin is one entry away from working everywhere.
 */
export const COIN_KINDS: readonly ItemKind[] = (Object.keys(ITEMS) as ItemKind[])
  .filter((k) => ITEMS[k].coin)
  .sort((a, b) => (ITEMS[b].coin ?? 0) - (ITEMS[a].coin ?? 0));

/** What everything in this bag (and every pack inside it) is worth in gp. */
export function walletValue(bag: Bag): number {
  let gp = 0;
  for (const k of COIN_KINDS) gp += bagCount(bag, k) * (ITEMS[k].coin ?? 0);
  return gp;
}

/**
 * Fold small coins into large ones wherever they will go.
 *
 * Called after every payment and pickup, and it is what keeps money from
 * eating the carry cap: a hundred gold pieces weigh 10 oz, the platinum coin
 * they become weighs a tenth of one. Tibia made you walk to a banker for
 * this; doing it silently costs the player nothing they would have chosen
 * differently, and saves a trip that was never a decision.
 */
export function consolidateCoins(bag: Bag): void {
  for (let i = COIN_KINDS.length - 1; i > 0; i--) {
    const small = COIN_KINDS[i];
    const big = COIN_KINDS[i - 1];
    const per = (ITEMS[big].coin ?? 0) / (ITEMS[small].coin ?? 1);
    if (per < 2) continue;
    const have = bagCount(bag, small);
    const up = Math.floor(have / per);
    if (up <= 0) continue;
    // only fold what there is room to fold INTO — a full bag keeps its change
    removeItem(bag, small, up * per);
    const left = addItem(bag, big, up);
    if (left > 0) addItem(bag, small, left * per);
  }
  for (const s of bag) if (s?.items) consolidateCoins(s.items);
}

/** Room enough to receive `gp` worth of coin, once it is folded up? */
export function walletRoomFor(bag: Bag, gp: number): boolean {
  // measured on a copy, because "can I afford to be paid" must not pay anyone
  const probe = cloneBag(bag);
  return giveGold(probe, gp) === 0;
}

/**
 * Pay coins into a bag, largest denomination first. Returns what would not
 * fit, in gp — normally zero.
 */
export function giveGold(bag: Bag, gp: number): number {
  let left = Math.max(0, Math.floor(gp));
  for (const k of COIN_KINDS) {
    if (left <= 0) break;
    const worth = ITEMS[k].coin ?? 1;
    const want = Math.floor(left / worth);
    if (want <= 0) continue;
    const unplaced = addItem(bag, k, want);
    left -= (want - unplaced) * worth;
  }
  consolidateCoins(bag);
  return left;
}

/**
 * Take `gp` out of a bag, making change: a platinum coin is broken back into
 * a hundred gold pieces when the exact coins are not there. Returns false and
 * touches nothing when the bag is not worth that much.
 */
export function takeGold(bag: Bag, gp: number): boolean {
  const want = Math.max(0, Math.floor(gp));
  if (want === 0) return true;
  if (walletValue(bag) < want) return false;
  let left = want;
  // spend the small coins first, so change is only made when it must be
  for (let i = COIN_KINDS.length - 1; i >= 0 && left > 0; i--) {
    const k = COIN_KINDS[i];
    const worth = ITEMS[k].coin ?? 1;
    const spend = Math.min(bagCount(bag, k), Math.floor(left / worth));
    if (spend > 0) { removeItem(bag, k, spend); left -= spend * worth; }
  }
  // whatever is left needs a big coin broken open
  for (let i = 0; i < COIN_KINDS.length && left > 0; i++) {
    const k = COIN_KINDS[i];
    const worth = ITEMS[k].coin ?? 1;
    if (worth <= left || bagCount(bag, k) === 0) continue;
    removeItem(bag, k, 1);
    left = giveGold(bag, worth - left) === 0 ? 0 : left;
  }
  consolidateCoins(bag);
  return left === 0;
}

/** A deep copy — used to ask "would this fit?" without moving anything. */
export function cloneBag(bag: Bag): Bag {
  return bag.map((s) => (s ? { kind: s.kind, n: s.n, ...(s.items ? { items: cloneBag(s.items) } : {}) } : null));
}

/** Total gp across several bags (backpack + every storage chest). */
export function walletAcross(bags: readonly Bag[]): number {
  let gp = 0;
  for (const b of bags) gp += walletValue(b);
  return gp;
}

/** Spend `gp` across several bags in order. All-or-nothing. */
export function takeGoldAcross(bags: readonly Bag[], gp: number): boolean {
  if (walletAcross(bags) < gp) return false;
  let left = gp;
  for (const b of bags) {
    if (left <= 0) break;
    const have = Math.min(walletValue(b), left);
    if (have > 0 && takeGold(b, have)) left -= have;
  }
  return left === 0;
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
    if (take > 0 && removeItem(b, kind, take)) left -= take;
  }
  // a container kind can be counted but refused (a full pack is not spendable),
  // so report what actually happened rather than what the count promised
  return left === 0;
}

/** The bow stats of the equipped weapon, or null if it isn't a bow. */
export function equippedBow(eq: Equipment): { range: number; power: number } | null {
  const w = eq.weapon;
  return w ? ITEMS[w].bow ?? null : null;
}

/**
 * Every kind that can be loaded into the Ammo slot, in a stable display order:
 * the two plain shafts first, then the elemental arrows in registry order.
 * Practice arrows are deliberately excluded — they never fire at monsters.
 *
 * Derived from the registry rather than typed out, so a new arrow tier is
 * shootable the moment it exists. The old hard-coded ["boneArrow", "arrow"]
 * pair was exactly why the fifteen elemental arrows sat in the bag doing
 * nothing: they were valid ammo the bow was never allowed to see.
 */
export const AMMO_KINDS: readonly ItemKind[] = (Object.keys(ITEMS) as ItemKind[])
  .filter((k) => ITEMS[k].ammo && !ITEMS[k].practice);

/**
 * Pick the best COMBAT arrow kind present in the bag, or null if none.
 * "Best" = highest ammo damage among kinds you actually carry.
 *
 * This is now only the FALLBACK for an empty or exhausted Ammo slot — the
 * player's own pick wins whenever they have one. See `activeArrow`.
 */
export function bestArrow(bag: Bag): ItemKind | null {
  let best: ItemKind | null = null;
  let bestDmg = -1;
  for (const kind of AMMO_KINDS) {
    const def = ITEMS[kind].ammo;
    if (def && bagCount(bag, kind) > 0 && def.dmg > bestDmg) { best = kind; bestDmg = def.dmg; }
  }
  return best;
}

/**
 * The arrow a bow actually fires: the player's chosen kind while they still
 * carry it, otherwise the best thing left in the bag.
 *
 * Tibia loads a quiver by hand and so does this — with seventeen arrow kinds
 * in circulation, any automatic pick is wrong half the time. "Strongest
 * first" would burn Pyre Arrows on rats; "cheapest first" would mean the
 * good ammo never leaves the bag. The fallback exists only so that running
 * a stack dry mid-fight doesn't silently disarm you.
 */
export function activeArrow(bag: Bag, pick: ItemKind | null): ItemKind | null {
  if (pick && bagCount(bag, pick) > 0) return pick;
  return bestArrow(bag);
}

/**
 * Next ammo kind to select when the Ammo slot is clicked: cycles through the
 * kinds actually carried, so the list is short even though the registry is
 * long. Returns null when the bag holds no ammo at all.
 */
export function cycleArrow(bag: Bag, pick: ItemKind | null): ItemKind | null {
  const carried = AMMO_KINDS.filter((k) => bagCount(bag, k) > 0);
  if (!carried.length) return null;
  const i = pick ? carried.indexOf(pick) : -1;
  return carried[(i + 1) % carried.length];
}

/**
 * Arrow pick when shooting the Archery Range: training arrows first (that's
 * what they're for — save the real ammo), falling back to combat arrows so a
 * hunter without practice shafts can still use the butt.
 */
export function bestPracticeArrow(bag: Bag, pick: ItemKind | null = null): ItemKind | null {
  if (bagCount(bag, "trainingArrow") > 0) return "trainingArrow";
  return activeArrow(bag, pick);
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
/**
 * Forge recipes — what is left of them.
 *
 * The forge stopped being a workshop and became a foundry (Etap 24). Gear is
 * looted, bought from Borin, or pulled out of a treasure chest; the only
 * things still MADE here are arrows, because an archer who has to walk back
 * to town for ammunition simply stops using the bow.
 *
 * Everything that used to live in this list — the sword ladder, the Leather
 * and Chain sets, jewellery, potions, bows — now has a shop that sells it.
 * See npcs.ts: moving the Amulet of Loss to Oswin was not optional, it is
 * the only death protection in the game.
 */
export const RECIPES: readonly Recipe[] = [
  { out: "arrow",         outN: 10, cost: { wood: 2 } },
  // practice ammo is deliberately dirt cheap: one log → a whole quiver
  { out: "trainingArrow", outN: 25, cost: { wood: 1 } },
  // TEST ONLY: the Dopalacz — 1 gold, +5 levels, +20 every skill
  { out: "booster",       cost: {}, gold: 1 },
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
  // Containers are NOT poured into the tally: they are objects with contents,
  // and rebuilding one "by kind" would mint an empty replacement and drop
  // everything inside it on the floor of nowhere. They keep their identity and
  // are simply pushed up into the freed cells afterwards.
  const total = new Map<ItemKind, number>();
  const order: ItemKind[] = [];
  const kept: ItemStack[] = [];
  for (const s of bag) {
    if (!s) continue;
    if (s.items || ITEMS[s.kind].stack === 1) { kept.push(s); continue; }
    if (!total.has(s.kind)) order.push(s.kind);
    total.set(s.kind, (total.get(s.kind) ?? 0) + s.n);
  }
  bag.fill(null);
  for (const kind of order) addItem(bag, kind, total.get(kind) ?? 0);
  for (const st of kept) {
    const i = bag.indexOf(null);
    if (i >= 0) bag[i] = st;
  }
  for (const s of bag) if (s?.items) compactBag(s.items);
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
  if (d.pack) lines.push(`Container — ${d.pack.slots} slots`, `Open it to see inside`);
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
