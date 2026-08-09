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
];
/* ------------------------------------------------------------------ *
 *  THE ELEMENTAL SHELF
 *
 *  The elemental line has no research step. An element is either attuned or
 *  it is not, and once it is, the tower simply SELLS you its crystals for
 *  gold. Nothing is listed before the stone is spent — a locked row that
 *  spells out what you cannot have yet is a worse teacher than an empty
 *  shelf, and the stones are meant to feel like picking a school of magic
 *  rather than ticking off a checklist.
 *
 *  Which five appear is decided by the tower: an Alchemy Tower II shows the
 *  five second-tier crystals and nothing else. Upgrading the building is the
 *  only power curve here, which is why the tiers are named rather than
 *  numbered — you buy Rime Waves, not "Wave (2)".
 * ------------------------------------------------------------------ */

export interface Offer {
  id: string;
  element: Element;
  tier: Tier;
  /** The item bought. Its name carries the tier, so no label is needed. */
  crystal: ItemKind;
  desc: string;
  gold: number;
  /** Materials, on top of the gold. Empty for everything but the top shelf. */
  cost: Cost;
  buyN: number;
}

const FORMS = ["Shard", "Burst", "Nova", "Wave", "Arrow"] as const;

const FORM_DESC: Readonly<Record<(typeof FORMS)[number], string>> = {
  Shard: "One creature, longest reach.",
  Burst: "Thrown. Goes off where it lands and catches the pack around it.",
  Nova: "Every tile touching you at once. No aiming, and no safe distance.",
  Wave: "Eleven tiles the way you are facing, widening as it goes.",
  Arrow: "Arrowheads that carry the element. They meet resistance, never armour.",
};

const TIER_NAMES: Readonly<Record<Element, readonly [string, string, string]>> = {
  fire: ["Ember", "Flame", "Pyre"],
  ice: ["Frost", "Rime", "Glacier"],
  earth: ["Loam", "Stone", "Bedrock"],
  storm: ["Spark", "Bolt", "Tempest"],
  shadow: ["Gloom", "Umbra", "Eclipse"],
};

/** Gold per batch, by tier and form. Arrows are cheap and bought by the score. */
const PRICE: Readonly<Record<(typeof FORMS)[number], readonly [number, number, number]>> = {
  Shard: [120, 400, 1200],
  Burst: [150, 500, 1500],
  Nova: [140, 460, 1400],
  Wave: [170, 560, 1700],
  Arrow: [60, 150, 400],
};

const BATCH: Readonly<Record<(typeof FORMS)[number], readonly [number, number, number]>> = {
  Shard: [10, 8, 6], Burst: [10, 8, 6], Nova: [10, 8, 6], Wave: [10, 8, 6], Arrow: [25, 25, 25],
};

export const OFFERS: readonly Offer[] = (() => {
  const out: Offer[] = [];
  for (const el of ELEMENTS) {
    for (let t = 0 as Tier; t < 3; t = (t + 1) as Tier) {
      const n = TIER_NAMES[el][t];
      for (const f of FORMS) {
        out.push({
          id: `${el}${n}${f}`,
          element: el,
          tier: t,
          crystal: `${el}${n}${f}` as ItemKind,
          desc: FORM_DESC[f],
          gold: PRICE[f][t],
          // The Essence gates the single most destructive shape of each
          // element, and nothing else. One dragon-only material sitting on
          // one crystal is a landmark; spread across five it is a tax.
          cost: t === 2 && f === "Wave" ? { magicEssence: 1 } : {},
          buyN: BATCH[f][t],
        });
      }
    }
  }
  return out;
})();

export function offerById(id: string): Offer | undefined {
  return OFFERS.find((o) => o.id === id);
}

/**
 * What the shelf shows: nothing at all until the element is attuned, then the
 * five crystals matching the tower's own tier.
 */
export function offersFor(el: Element, towerTier: number): readonly Offer[] {
  if (!isAttuned(el)) return [];
  return OFFERS.filter((o) => o.element === el && o.tier === Math.max(1, towerTier) - 1);
}

/** Projects finished. Only the four originals live here now. */
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
