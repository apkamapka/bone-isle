/**
 * Alchemy Tower: a research tree that gates which charge crystals you can buy.
 * Each project is researched once (instant on payment, but some are gated by a
 * rare material like a Fire Ruby). Once researched, that crystal can be bought
 * repeatedly in batches. Costs draw from backpack + Storage Chest, same as
 * building, so the chest doubles as your alchemy stockpile.
 *
 * This is the permanent crystal source that replaces the Forge stopgap recipes.
 */
import type { Cost } from "./building.ts";
import type { ItemKind } from "../items.ts";
import type { Element, Tier } from "./elements.ts";

export interface Research {
  id: string;
  name: string;
  desc: string;
  /** One-time cost to unlock (may include a rare gating material). */
  researchCost: Cost;
  /** The crystal this unlocks for purchase. */
  crystal: ItemKind;
  /** Cost of one purchase once researched. */
  buyCost: Cost;
  /** Charges granted per purchase. */
  buyN: number;
  /** Tier 0..2 for the elemental line; absent on the four original crystals. */
  tier?: Tier;
  /** Element, for grouping the tower's project list by colour. */
  element?: Element;
  /**
   * Project that must be researched first. This is what turns the tower from a
   * shopping list into a progression: an element is a LANE you commit to, and
   * the cost of the third tier is only worth paying in a lane you already use.
   * Spreading across all five is legal and deliberately unaffordable.
   */
  requires?: string;
}

/** Every project that must be finished before `id` becomes available. */
export function researchChain(id: string): string[] {
  const out: string[] = [];
  let cur = RESEARCH.find((r) => r.id === id)?.requires;
  while (cur) {
    out.push(cur);
    cur = RESEARCH.find((r) => r.id === cur)?.requires;
  }
  return out;
}

/** True when every prerequisite of `id` sits in `done`. */
export function researchAvailable(id: string, done: readonly string[]): boolean {
  return researchChain(id).every((r) => done.includes(r));
}

/**
 * Which Alchemy Tower tier a project needs standing on Home Isle.
 *
 * The building IS the tier gate: a tier-I tower researches Ember, a tier-II
 * tower Flame, a tier-III tower Pyre — and the same one step at a time in
 * every other lane. The lane prerequisites stay on top of this, so depth
 * costs two different things at once: a building you paid for, and a lane
 * you committed to. The four original crystals predate the elemental line
 * and sit at tier I, where they have always been.
 */
export function towerTierFor(r: Research): 1 | 2 | 3 {
  return r.tier === undefined ? 1 : ((r.tier + 1) as 1 | 2 | 3);
}

/** Is this project buildable given the best tower the player owns? */
export function towerTierOk(r: Research, towerTier: number): boolean {
  return towerTier >= towerTierFor(r);
}

export const RESEARCH: readonly Research[] = [
  {
    id: "life",
    name: "Life Crystals",
    desc: "Restores HP on use.",
    researchCost: { herb: 10, silk: 8 },
    crystal: "healCrystal",
    buyCost: { herb: 4, silk: 3 },
    buyN: 10,
  },
  {
    id: "fire",
    name: "Fire Crystals",
    desc: "Hurls fire at the nearest enemy.",
    researchCost: { bones: 12, stone: 10 },
    crystal: "fireCrystal",
    buyCost: { bones: 5, stone: 4 },
    buyN: 8,
  },
  {
    id: "recall",
    name: "Recall Crystals",
    desc: "Teleports you back to Home Isle.",
    researchCost: { silk: 10, bones: 8 },
    crystal: "recallCrystal",
    buyCost: { silk: 4, bones: 3 },
    buyN: 4,
  },
  {
    id: "spear",
    name: "Fire Spear Crystals",
    desc: "Heavy ranged damage, longer reach.",
    researchCost: { bones: 15, stone: 12, fireRuby: 1 },
    crystal: "spearCrystal",
    buyCost: { bones: 8, stone: 6 },
    buyN: 4,
  },
  // ---- the elemental line: five lanes, three tiers, two roles, plus the
  // ---- tier-I arrowheads. Each tier requires the one below it in the SAME
  // ---- lane and role, so depth is bought by commitment rather than by gold.
  {
    id: "fire1shard",
    name: "Ember Shards",
    desc: "Flame that armour cannot turn. Shards put it all into one target.",
    researchCost: { bones: 14, stone: 10 },
    crystal: "fireEmberShard",
    buyCost: { bones: 5, stone: 4 },
    buyN: 10,
    tier: 0,
    element: "fire",
    requires: undefined,
  },
  {
    id: "fire1burst",
    name: "Ember Bursts",
    desc: "Flame that armour cannot turn. Bursts split the blast across a pack.",
    researchCost: { bones: 20, stone: 14 },
    crystal: "fireEmberBurst",
    buyCost: { bones: 7, stone: 5 },
    buyN: 10,
    tier: 0,
    element: "fire",
    requires: undefined,
  },
  {
    id: "fire2shard",
    name: "Flame Shards",
    desc: "Flame that armour cannot turn. Shards put it all into one target.",
    researchCost: { bones: 40, stone: 28 },
    crystal: "fireFlameShard",
    buyCost: { bones: 12, stone: 8 },
    buyN: 8,
    tier: 1,
    element: "fire",
    requires: "fire1shard",
  },
  {
    id: "fire2burst",
    name: "Flame Bursts",
    desc: "Flame that armour cannot turn. Bursts split the blast across a pack.",
    researchCost: { bones: 46, stone: 32 },
    crystal: "fireFlameBurst",
    buyCost: { bones: 14, stone: 9 },
    buyN: 8,
    tier: 1,
    element: "fire",
    requires: "fire1burst",
  },
  {
    id: "fire3shard",
    name: "Pyre Shards",
    desc: "Flame that armour cannot turn. Shards put it all into one target.",
    researchCost: { bones: 110, stone: 77 },
    crystal: "firePyreShard",
    buyCost: { bones: 30, stone: 21 },
    buyN: 6,
    tier: 2,
    element: "fire",
    requires: "fire2shard",
  },
  {
    id: "fire3burst",
    name: "Pyre Bursts",
    desc: "Flame that armour cannot turn. Bursts split the blast across a pack.",
    researchCost: { bones: 116, stone: 81 },
    crystal: "firePyreBurst",
    buyCost: { bones: 32, stone: 22 },
    buyN: 6,
    tier: 2,
    element: "fire",
    requires: "fire2burst",
  },
  {
    id: "firearrow",
    name: "Ember Arrows",
    desc: "Arrowheads that carry the fire. They meet resistance, never armour.",
    researchCost: { bones: 18, stone: 12 },
    crystal: "fireArrow",
    buyCost: { bones: 3, stone: 2 },
    buyN: 25,
    tier: 0,
    element: "fire",
    requires: "fire1shard",
  },
  {
    id: "ice1shard",
    name: "Frost Shards",
    desc: "Cold that bites through plate. Shards put it all into one target.",
    researchCost: { herb: 14, silk: 10 },
    crystal: "iceFrostShard",
    buyCost: { herb: 5, silk: 4 },
    buyN: 10,
    tier: 0,
    element: "ice",
    requires: undefined,
  },
  {
    id: "ice1burst",
    name: "Frost Bursts",
    desc: "Cold that bites through plate. Bursts split the blast across a pack.",
    researchCost: { herb: 20, silk: 14 },
    crystal: "iceFrostBurst",
    buyCost: { herb: 7, silk: 5 },
    buyN: 10,
    tier: 0,
    element: "ice",
    requires: undefined,
  },
  {
    id: "ice2shard",
    name: "Rime Shards",
    desc: "Cold that bites through plate. Shards put it all into one target.",
    researchCost: { herb: 40, silk: 28 },
    crystal: "iceRimeShard",
    buyCost: { herb: 12, silk: 8 },
    buyN: 8,
    tier: 1,
    element: "ice",
    requires: "ice1shard",
  },
  {
    id: "ice2burst",
    name: "Rime Bursts",
    desc: "Cold that bites through plate. Bursts split the blast across a pack.",
    researchCost: { herb: 46, silk: 32 },
    crystal: "iceRimeBurst",
    buyCost: { herb: 14, silk: 9 },
    buyN: 8,
    tier: 1,
    element: "ice",
    requires: "ice1burst",
  },
  {
    id: "ice3shard",
    name: "Glacier Shards",
    desc: "Cold that bites through plate. Shards put it all into one target.",
    researchCost: { herb: 110, silk: 77 },
    crystal: "iceGlacierShard",
    buyCost: { herb: 30, silk: 21 },
    buyN: 6,
    tier: 2,
    element: "ice",
    requires: "ice2shard",
  },
  {
    id: "ice3burst",
    name: "Glacier Bursts",
    desc: "Cold that bites through plate. Bursts split the blast across a pack.",
    researchCost: { herb: 116, silk: 81 },
    crystal: "iceGlacierBurst",
    buyCost: { herb: 32, silk: 22 },
    buyN: 6,
    tier: 2,
    element: "ice",
    requires: "ice2burst",
  },
  {
    id: "icearrow",
    name: "Frost Arrows",
    desc: "Arrowheads that carry the ice. They meet resistance, never armour.",
    researchCost: { herb: 18, silk: 12 },
    crystal: "iceArrow",
    buyCost: { herb: 3, silk: 2 },
    buyN: 25,
    tier: 0,
    element: "ice",
    requires: "ice1shard",
  },
  {
    id: "earth1shard",
    name: "Loam Shards",
    desc: "Weight and grit, heedless of steel. Shards put it all into one target.",
    researchCost: { stone: 14, wood: 10 },
    crystal: "earthLoamShard",
    buyCost: { stone: 5, wood: 4 },
    buyN: 10,
    tier: 0,
    element: "earth",
    requires: undefined,
  },
  {
    id: "earth1burst",
    name: "Loam Bursts",
    desc: "Weight and grit, heedless of steel. Bursts split the blast across a pack.",
    researchCost: { stone: 20, wood: 14 },
    crystal: "earthLoamBurst",
    buyCost: { stone: 7, wood: 5 },
    buyN: 10,
    tier: 0,
    element: "earth",
    requires: undefined,
  },
  {
    id: "earth2shard",
    name: "Stone Shards",
    desc: "Weight and grit, heedless of steel. Shards put it all into one target.",
    researchCost: { stone: 40, wood: 28 },
    crystal: "earthStoneShard",
    buyCost: { stone: 12, wood: 8 },
    buyN: 8,
    tier: 1,
    element: "earth",
    requires: "earth1shard",
  },
  {
    id: "earth2burst",
    name: "Stone Bursts",
    desc: "Weight and grit, heedless of steel. Bursts split the blast across a pack.",
    researchCost: { stone: 46, wood: 32 },
    crystal: "earthStoneBurst",
    buyCost: { stone: 14, wood: 9 },
    buyN: 8,
    tier: 1,
    element: "earth",
    requires: "earth1burst",
  },
  {
    id: "earth3shard",
    name: "Bedrock Shards",
    desc: "Weight and grit, heedless of steel. Shards put it all into one target.",
    researchCost: { stone: 110, wood: 77 },
    crystal: "earthBedrockShard",
    buyCost: { stone: 30, wood: 21 },
    buyN: 6,
    tier: 2,
    element: "earth",
    requires: "earth2shard",
  },
  {
    id: "earth3burst",
    name: "Bedrock Bursts",
    desc: "Weight and grit, heedless of steel. Bursts split the blast across a pack.",
    researchCost: { stone: 116, wood: 81 },
    crystal: "earthBedrockBurst",
    buyCost: { stone: 32, wood: 22 },
    buyN: 6,
    tier: 2,
    element: "earth",
    requires: "earth2burst",
  },
  {
    id: "eartharrow",
    name: "Loam Arrows",
    desc: "Arrowheads that carry the earth. They meet resistance, never armour.",
    researchCost: { stone: 18, wood: 12 },
    crystal: "earthArrow",
    buyCost: { stone: 3, wood: 2 },
    buyN: 25,
    tier: 0,
    element: "earth",
    requires: "earth1shard",
  },
  {
    id: "storm1shard",
    name: "Spark Shards",
    desc: "A charge that finds its way in. Shards put it all into one target.",
    researchCost: { silk: 14, stone: 10 },
    crystal: "stormSparkShard",
    buyCost: { silk: 5, stone: 4 },
    buyN: 10,
    tier: 0,
    element: "storm",
    requires: undefined,
  },
  {
    id: "storm1burst",
    name: "Spark Bursts",
    desc: "A charge that finds its way in. Bursts split the blast across a pack.",
    researchCost: { silk: 20, stone: 14 },
    crystal: "stormSparkBurst",
    buyCost: { silk: 7, stone: 5 },
    buyN: 10,
    tier: 0,
    element: "storm",
    requires: undefined,
  },
  {
    id: "storm2shard",
    name: "Bolt Shards",
    desc: "A charge that finds its way in. Shards put it all into one target.",
    researchCost: { silk: 40, stone: 28 },
    crystal: "stormBoltShard",
    buyCost: { silk: 12, stone: 8 },
    buyN: 8,
    tier: 1,
    element: "storm",
    requires: "storm1shard",
  },
  {
    id: "storm2burst",
    name: "Bolt Bursts",
    desc: "A charge that finds its way in. Bursts split the blast across a pack.",
    researchCost: { silk: 46, stone: 32 },
    crystal: "stormBoltBurst",
    buyCost: { silk: 14, stone: 9 },
    buyN: 8,
    tier: 1,
    element: "storm",
    requires: "storm1burst",
  },
  {
    id: "storm3shard",
    name: "Tempest Shards",
    desc: "A charge that finds its way in. Shards put it all into one target.",
    researchCost: { silk: 110, stone: 77 },
    crystal: "stormTempestShard",
    buyCost: { silk: 30, stone: 21 },
    buyN: 6,
    tier: 2,
    element: "storm",
    requires: "storm2shard",
  },
  {
    id: "storm3burst",
    name: "Tempest Bursts",
    desc: "A charge that finds its way in. Bursts split the blast across a pack.",
    researchCost: { silk: 116, stone: 81 },
    crystal: "stormTempestBurst",
    buyCost: { silk: 32, stone: 22 },
    buyN: 6,
    tier: 2,
    element: "storm",
    requires: "storm2burst",
  },
  {
    id: "stormarrow",
    name: "Spark Arrows",
    desc: "Arrowheads that carry the storm. They meet resistance, never armour.",
    researchCost: { silk: 18, stone: 12 },
    crystal: "stormArrow",
    buyCost: { silk: 3, stone: 2 },
    buyN: 25,
    tier: 0,
    element: "storm",
    requires: "storm1shard",
  },
  {
    id: "shadow1shard",
    name: "Gloom Shards",
    desc: "Cold light that unmakes the undying. Shards put it all into one target.",
    researchCost: { bones: 14, herb: 10 },
    crystal: "shadowGloomShard",
    buyCost: { bones: 5, herb: 4 },
    buyN: 10,
    tier: 0,
    element: "shadow",
    requires: undefined,
  },
  {
    id: "shadow1burst",
    name: "Gloom Bursts",
    desc: "Cold light that unmakes the undying. Bursts split the blast across a pack.",
    researchCost: { bones: 20, herb: 14 },
    crystal: "shadowGloomBurst",
    buyCost: { bones: 7, herb: 5 },
    buyN: 10,
    tier: 0,
    element: "shadow",
    requires: undefined,
  },
  {
    id: "shadow2shard",
    name: "Umbra Shards",
    desc: "Cold light that unmakes the undying. Shards put it all into one target.",
    researchCost: { bones: 40, herb: 28 },
    crystal: "shadowUmbraShard",
    buyCost: { bones: 12, herb: 8 },
    buyN: 8,
    tier: 1,
    element: "shadow",
    requires: "shadow1shard",
  },
  {
    id: "shadow2burst",
    name: "Umbra Bursts",
    desc: "Cold light that unmakes the undying. Bursts split the blast across a pack.",
    researchCost: { bones: 46, herb: 32 },
    crystal: "shadowUmbraBurst",
    buyCost: { bones: 14, herb: 9 },
    buyN: 8,
    tier: 1,
    element: "shadow",
    requires: "shadow1burst",
  },
  {
    id: "shadow3shard",
    name: "Eclipse Shards",
    desc: "Cold light that unmakes the undying. Shards put it all into one target.",
    researchCost: { bones: 110, herb: 77 },
    crystal: "shadowEclipseShard",
    buyCost: { bones: 30, herb: 21 },
    buyN: 6,
    tier: 2,
    element: "shadow",
    requires: "shadow2shard",
  },
  {
    id: "shadow3burst",
    name: "Eclipse Bursts",
    desc: "Cold light that unmakes the undying. Bursts split the blast across a pack.",
    researchCost: { bones: 116, herb: 81 },
    crystal: "shadowEclipseBurst",
    buyCost: { bones: 32, herb: 22 },
    buyN: 6,
    tier: 2,
    element: "shadow",
    requires: "shadow2burst",
  },
  {
    id: "shadowarrow",
    name: "Gloom Arrows",
    desc: "Arrowheads that carry the shadow. They meet resistance, never armour.",
    researchCost: { bones: 18, herb: 12 },
    crystal: "shadowArrow",
    buyCost: { bones: 3, herb: 2 },
    buyN: 25,
    tier: 0,
    element: "shadow",
    requires: "shadow1shard",
  },
];

/** Completed research ids. Mutated in place; persisted via save/load. */
const done = new Set<string>();

export function isResearched(id: string): boolean {
  return done.has(id);
}

export function markResearched(id: string): void {
  done.add(id);
}

/** Snapshot for saving. */
export function researchState(): string[] {
  return [...done];
}

/** Restore from a save (clears any current state first). */
export function loadResearchState(ids: readonly string[] | undefined): void {
  done.clear();
  if (ids) for (const id of ids) done.add(id);
}

export function researchById(id: string): Research | undefined {
  return RESEARCH.find((r) => r.id === id);
}
