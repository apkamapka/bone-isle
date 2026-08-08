/**
 * Alchemy Tower: a research tree that gates which charge crystals you can buy.
 * Each project is researched once (instant on payment). Once researched, that
 * crystal can be bought repeatedly in batches. Material costs draw from
 * backpack + Storage Chest, same as building, so the chest doubles as your
 * alchemy stockpile.
 *
 * Etap 25 split the tree in two. The four ORIGINAL crystals still cost
 * materials, because they are the early game and bones are what an early
 * player has. The ELEMENTAL line costs gold and nothing else, with one
 * exception: the strongest crystal of each element also wants an Essence of
 * Magic, which only the dragon carries. The elemental line also wants an
 * attunement stone before it opens at all — see ATTUNEMENT below.
 *
 * This is the permanent crystal source that replaces the Forge stopgap recipes.
 */
import type { Cost } from "./building.ts";
import type { ItemKind } from "../items.ts";
import { ELEMENTS } from "./elements.ts";
import type { Element, Tier } from "./elements.ts";

export interface Research {
  id: string;
  name: string;
  desc: string;
  /** One-time material cost to unlock. Empty on the elemental line, which
   *  is paid for in gold — see researchGold. */
  researchCost: Cost;
  /**
   * One-time GOLD cost to unlock, on top of researchCost.
   *
   * The elemental line stopped charging bones and stone in Etap 25. Those
   * materials were the tree's only real sink, and paying for magic in
   * firewood made every lane feel like a woodpile. They now leave the
   * economy through the shop instead, which puts one number — gold — between
   * everything you kill and everything you research.
   */
  researchGold?: number;
  /** The crystal this unlocks for purchase. */
  crystal: ItemKind;
  /** Material cost of one purchase once researched. */
  buyCost: Cost;
  /** Gold cost of one purchase, on top of buyCost. */
  buyGold?: number;
  /** Charges granted per purchase. */
  buyN: number;
  /** Tier 0..2 for the elemental line; absent on the four original crystals. */
  tier?: Tier;
  /** Element, for grouping the tower's project list by colour. */
  element?: Element;
  /**
   * Project that must be researched first.
   *
   * RETIRED in Etap 24. The tower's own tier is now the progression, and the
   * panel only ever shows the tier the building is at — which made these
   * chains actively harmful: a player who upgraded to a tier-II tower without
   * having researched Ember could no longer SEE Ember, and so could never
   * research Flame either. The lane would be dead forever, with nothing on
   * screen explaining why. The field is kept so old data and researchChain()
   * still typecheck, but nothing sets it any more.
   */
  requires?: string;
}

/* ------------------------------------------------------------------ *
 *  ATTUNEMENT — the key that opens a lane
 *
 *  Every elemental project is locked until its element is attuned, which
 *  costs exactly one stone and happens once. The stone is spent, not held,
 *  so a lane is a door you walk through rather than a key you carry.
 *
 *  This is deliberately NOT the retired `requires` chain. That failed
 *  because the panel only ever shows the tier your tower is at, so a
 *  prerequisite sitting at a tier you had already climbed past became
 *  invisible and the lane died. Attunement lives OUTSIDE the tier-filtered
 *  list — it is drawn at the head of every element tab at every tower tier,
 *  so it can never fall off the screen.
 * ------------------------------------------------------------------ */

/** Which stone opens which lane. Ice is bought with water, storm with wind,
 *  shadow with lightning — the stone names the source, not the spell. */
export const ATTUNEMENT: Readonly<Record<Element, ItemKind>> = {
  fire: "fireCrystal",
  ice: "waterCrystal",
  earth: "earthCrystal",
  storm: "windCrystal",
  shadow: "lightningCrystal",
};

const attuned = new Set<Element>();

export function isAttuned(el: Element): boolean {
  return attuned.has(el);
}

export function markAttuned(el: Element): void {
  attuned.add(el);
}

/** Snapshot for saving. */
export function attunedState(): Element[] {
  return [...attuned];
}

/** Restore from a save (clears any current state first). */
export function loadAttunedState(els: readonly string[] | undefined): void {
  attuned.clear();
  if (els) for (const el of els) if ((ELEMENTS as readonly string[]).includes(el)) attuned.add(el as Element);
}

/**
 * Can this project be researched at all yet? The four originals have no
 * element and are never gated; everything else waits on its stone.
 */
export function attunementOk(r: Research): boolean {
  return r.element === undefined || isAttuned(r.element);
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
    name: "Flare Crystals",
    desc: "Hurls fire at the nearest enemy.",
    researchCost: { bones: 12, stone: 10 },
    crystal: "flameCrystal",
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
    researchCost: { bones: 15, stone: 12 },
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
    researchCost: {},
    researchGold: 400,
    crystal: "fireEmberShard",
    buyCost: {},
    buyGold: 120,
    buyN: 10,
    tier: 0,
    element: "fire",
  },
  {
    id: "fire1burst",
    name: "Ember Bursts",
    desc: "Flame that armour cannot turn. Bursts split the blast across a pack.",
    researchCost: {},
    researchGold: 500,
    crystal: "fireEmberBurst",
    buyCost: {},
    buyGold: 150,
    buyN: 10,
    tier: 0,
    element: "fire",
  },
  {
    id: "fire2shard",
    name: "Flame Shards",
    desc: "Flame that armour cannot turn. Shards put it all into one target.",
    researchCost: {},
    researchGold: 1600,
    crystal: "fireFlameShard",
    buyCost: {},
    buyGold: 400,
    buyN: 8,
    tier: 1,
    element: "fire",
    // was gated behind fire1shard
  },
  {
    id: "fire2burst",
    name: "Flame Bursts",
    desc: "Flame that armour cannot turn. Bursts split the blast across a pack.",
    researchCost: {},
    researchGold: 2000,
    crystal: "fireFlameBurst",
    buyCost: {},
    buyGold: 500,
    buyN: 8,
    tier: 1,
    element: "fire",
    // was gated behind fire1burst
  },
  {
    id: "fire3shard",
    name: "Pyre Shards",
    desc: "Flame that armour cannot turn. Shards put it all into one target.",
    researchCost: {},
    researchGold: 6000,
    crystal: "firePyreShard",
    buyCost: {},
    buyGold: 1200,
    buyN: 6,
    tier: 2,
    element: "fire",
    // was gated behind fire2shard
  },
  {
    id: "fire3burst",
    name: "Pyre Bursts",
    desc: "Flame that armour cannot turn. Bursts split the blast across a pack.",
    researchCost: {},
    researchGold: 7000,
    crystal: "firePyreBurst",
    buyCost: { magicEssence: 1 },
    buyGold: 1500,
    buyN: 6,
    tier: 2,
    element: "fire",
    // was gated behind fire2burst
  },
  {
    id: "firearrow",
    name: "Ember Arrows",
    desc: "Arrowheads that carry the fire. They meet resistance, never armour.",
    researchCost: {},
    researchGold: 250,
    crystal: "fireArrow",
    buyCost: {},
    buyGold: 60,
    buyN: 25,
    tier: 0,
    element: "fire",
    // was gated behind fire1shard
  },
  {
    id: "ice1shard",
    name: "Frost Shards",
    desc: "Cold that bites through plate. Shards put it all into one target.",
    researchCost: {},
    researchGold: 400,
    crystal: "iceFrostShard",
    buyCost: {},
    buyGold: 120,
    buyN: 10,
    tier: 0,
    element: "ice",
  },
  {
    id: "ice1burst",
    name: "Frost Bursts",
    desc: "Cold that bites through plate. Bursts split the blast across a pack.",
    researchCost: {},
    researchGold: 500,
    crystal: "iceFrostBurst",
    buyCost: {},
    buyGold: 150,
    buyN: 10,
    tier: 0,
    element: "ice",
  },
  {
    id: "ice2shard",
    name: "Rime Shards",
    desc: "Cold that bites through plate. Shards put it all into one target.",
    researchCost: {},
    researchGold: 1600,
    crystal: "iceRimeShard",
    buyCost: {},
    buyGold: 400,
    buyN: 8,
    tier: 1,
    element: "ice",
    // was gated behind ice1shard
  },
  {
    id: "ice2burst",
    name: "Rime Bursts",
    desc: "Cold that bites through plate. Bursts split the blast across a pack.",
    researchCost: {},
    researchGold: 2000,
    crystal: "iceRimeBurst",
    buyCost: {},
    buyGold: 500,
    buyN: 8,
    tier: 1,
    element: "ice",
    // was gated behind ice1burst
  },
  {
    id: "ice3shard",
    name: "Glacier Shards",
    desc: "Cold that bites through plate. Shards put it all into one target.",
    researchCost: {},
    researchGold: 6000,
    crystal: "iceGlacierShard",
    buyCost: {},
    buyGold: 1200,
    buyN: 6,
    tier: 2,
    element: "ice",
    // was gated behind ice2shard
  },
  {
    id: "ice3burst",
    name: "Glacier Bursts",
    desc: "Cold that bites through plate. Bursts split the blast across a pack.",
    researchCost: {},
    researchGold: 7000,
    crystal: "iceGlacierBurst",
    buyCost: { magicEssence: 1 },
    buyGold: 1500,
    buyN: 6,
    tier: 2,
    element: "ice",
    // was gated behind ice2burst
  },
  {
    id: "icearrow",
    name: "Frost Arrows",
    desc: "Arrowheads that carry the ice. They meet resistance, never armour.",
    researchCost: {},
    researchGold: 250,
    crystal: "iceArrow",
    buyCost: {},
    buyGold: 60,
    buyN: 25,
    tier: 0,
    element: "ice",
    // was gated behind ice1shard
  },
  {
    id: "earth1shard",
    name: "Loam Shards",
    desc: "Weight and grit, heedless of steel. Shards put it all into one target.",
    researchCost: {},
    researchGold: 400,
    crystal: "earthLoamShard",
    buyCost: {},
    buyGold: 120,
    buyN: 10,
    tier: 0,
    element: "earth",
  },
  {
    id: "earth1burst",
    name: "Loam Bursts",
    desc: "Weight and grit, heedless of steel. Bursts split the blast across a pack.",
    researchCost: {},
    researchGold: 500,
    crystal: "earthLoamBurst",
    buyCost: {},
    buyGold: 150,
    buyN: 10,
    tier: 0,
    element: "earth",
  },
  {
    id: "earth2shard",
    name: "Stone Shards",
    desc: "Weight and grit, heedless of steel. Shards put it all into one target.",
    researchCost: {},
    researchGold: 1600,
    crystal: "earthStoneShard",
    buyCost: {},
    buyGold: 400,
    buyN: 8,
    tier: 1,
    element: "earth",
    // was gated behind earth1shard
  },
  {
    id: "earth2burst",
    name: "Stone Bursts",
    desc: "Weight and grit, heedless of steel. Bursts split the blast across a pack.",
    researchCost: {},
    researchGold: 2000,
    crystal: "earthStoneBurst",
    buyCost: {},
    buyGold: 500,
    buyN: 8,
    tier: 1,
    element: "earth",
    // was gated behind earth1burst
  },
  {
    id: "earth3shard",
    name: "Bedrock Shards",
    desc: "Weight and grit, heedless of steel. Shards put it all into one target.",
    researchCost: {},
    researchGold: 6000,
    crystal: "earthBedrockShard",
    buyCost: {},
    buyGold: 1200,
    buyN: 6,
    tier: 2,
    element: "earth",
    // was gated behind earth2shard
  },
  {
    id: "earth3burst",
    name: "Bedrock Bursts",
    desc: "Weight and grit, heedless of steel. Bursts split the blast across a pack.",
    researchCost: {},
    researchGold: 7000,
    crystal: "earthBedrockBurst",
    buyCost: { magicEssence: 1 },
    buyGold: 1500,
    buyN: 6,
    tier: 2,
    element: "earth",
    // was gated behind earth2burst
  },
  {
    id: "eartharrow",
    name: "Loam Arrows",
    desc: "Arrowheads that carry the earth. They meet resistance, never armour.",
    researchCost: {},
    researchGold: 250,
    crystal: "earthArrow",
    buyCost: {},
    buyGold: 60,
    buyN: 25,
    tier: 0,
    element: "earth",
    // was gated behind earth1shard
  },
  {
    id: "storm1shard",
    name: "Spark Shards",
    desc: "A charge that finds its way in. Shards put it all into one target.",
    researchCost: {},
    researchGold: 400,
    crystal: "stormSparkShard",
    buyCost: {},
    buyGold: 120,
    buyN: 10,
    tier: 0,
    element: "storm",
  },
  {
    id: "storm1burst",
    name: "Spark Bursts",
    desc: "A charge that finds its way in. Bursts split the blast across a pack.",
    researchCost: {},
    researchGold: 500,
    crystal: "stormSparkBurst",
    buyCost: {},
    buyGold: 150,
    buyN: 10,
    tier: 0,
    element: "storm",
  },
  {
    id: "storm2shard",
    name: "Bolt Shards",
    desc: "A charge that finds its way in. Shards put it all into one target.",
    researchCost: {},
    researchGold: 1600,
    crystal: "stormBoltShard",
    buyCost: {},
    buyGold: 400,
    buyN: 8,
    tier: 1,
    element: "storm",
    // was gated behind storm1shard
  },
  {
    id: "storm2burst",
    name: "Bolt Bursts",
    desc: "A charge that finds its way in. Bursts split the blast across a pack.",
    researchCost: {},
    researchGold: 2000,
    crystal: "stormBoltBurst",
    buyCost: {},
    buyGold: 500,
    buyN: 8,
    tier: 1,
    element: "storm",
    // was gated behind storm1burst
  },
  {
    id: "storm3shard",
    name: "Tempest Shards",
    desc: "A charge that finds its way in. Shards put it all into one target.",
    researchCost: {},
    researchGold: 6000,
    crystal: "stormTempestShard",
    buyCost: {},
    buyGold: 1200,
    buyN: 6,
    tier: 2,
    element: "storm",
    // was gated behind storm2shard
  },
  {
    id: "storm3burst",
    name: "Tempest Bursts",
    desc: "A charge that finds its way in. Bursts split the blast across a pack.",
    researchCost: {},
    researchGold: 7000,
    crystal: "stormTempestBurst",
    buyCost: { magicEssence: 1 },
    buyGold: 1500,
    buyN: 6,
    tier: 2,
    element: "storm",
    // was gated behind storm2burst
  },
  {
    id: "stormarrow",
    name: "Spark Arrows",
    desc: "Arrowheads that carry the storm. They meet resistance, never armour.",
    researchCost: {},
    researchGold: 250,
    crystal: "stormArrow",
    buyCost: {},
    buyGold: 60,
    buyN: 25,
    tier: 0,
    element: "storm",
    // was gated behind storm1shard
  },
  {
    id: "shadow1shard",
    name: "Gloom Shards",
    desc: "Cold light that unmakes the undying. Shards put it all into one target.",
    researchCost: {},
    researchGold: 400,
    crystal: "shadowGloomShard",
    buyCost: {},
    buyGold: 120,
    buyN: 10,
    tier: 0,
    element: "shadow",
  },
  {
    id: "shadow1burst",
    name: "Gloom Bursts",
    desc: "Cold light that unmakes the undying. Bursts split the blast across a pack.",
    researchCost: {},
    researchGold: 500,
    crystal: "shadowGloomBurst",
    buyCost: {},
    buyGold: 150,
    buyN: 10,
    tier: 0,
    element: "shadow",
  },
  {
    id: "shadow2shard",
    name: "Umbra Shards",
    desc: "Cold light that unmakes the undying. Shards put it all into one target.",
    researchCost: {},
    researchGold: 1600,
    crystal: "shadowUmbraShard",
    buyCost: {},
    buyGold: 400,
    buyN: 8,
    tier: 1,
    element: "shadow",
    // was gated behind shadow1shard
  },
  {
    id: "shadow2burst",
    name: "Umbra Bursts",
    desc: "Cold light that unmakes the undying. Bursts split the blast across a pack.",
    researchCost: {},
    researchGold: 2000,
    crystal: "shadowUmbraBurst",
    buyCost: {},
    buyGold: 500,
    buyN: 8,
    tier: 1,
    element: "shadow",
    // was gated behind shadow1burst
  },
  {
    id: "shadow3shard",
    name: "Eclipse Shards",
    desc: "Cold light that unmakes the undying. Shards put it all into one target.",
    researchCost: {},
    researchGold: 6000,
    crystal: "shadowEclipseShard",
    buyCost: {},
    buyGold: 1200,
    buyN: 6,
    tier: 2,
    element: "shadow",
    // was gated behind shadow2shard
  },
  {
    id: "shadow3burst",
    name: "Eclipse Bursts",
    desc: "Cold light that unmakes the undying. Bursts split the blast across a pack.",
    researchCost: {},
    researchGold: 7000,
    crystal: "shadowEclipseBurst",
    buyCost: { magicEssence: 1 },
    buyGold: 1500,
    buyN: 6,
    tier: 2,
    element: "shadow",
    // was gated behind shadow2burst
  },
  {
    id: "shadowarrow",
    name: "Gloom Arrows",
    desc: "Arrowheads that carry the shadow. They meet resistance, never armour.",
    researchCost: {},
    researchGold: 250,
    crystal: "shadowArrow",
    buyCost: {},
    buyGold: 60,
    buyN: 25,
    tier: 0,
    element: "shadow",
    // was gated behind shadow1shard
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
