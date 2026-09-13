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
import { ELEMENTS, TIER_CODE } from "./elements.ts";
import { active as activeState } from "./playerState.ts";
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
  /**
   * Sold without a research step. Recall is the only project like this: the
   * shelf shows it stocked from the first visit and the price does the
   * gatekeeping.
   */
  openFromStart?: boolean;
  /**
   * Character level required to BUY this, independent of research.
   *
   * The utility runes all sit open on the shelf, so the level is the only
   * gate they have — and it is the right one for them. A tower tier is a
   * building you pay gold for, which means a level-6 character with a lucky
   * chest could stand in front of an Alchemy Tower III and buy a Fury Rune;
   * the level is the one number that cannot be bought.
   */
  minLevel?: number;
  /** Tier 0..2 for the elemental line; absent on the original crystals. */
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
  storm: "lightningCrystal",
  shadow: "windCrystal",
};

/** The lanes THIS character has opened. On PlayerState, not a module Set:
 *  attunement is progress, and progress belongs to a character. */
const attuned = { has: (e: Element) => activeState().attuned.has(e),
                  add: (e: Element) => activeState().attuned.add(e),
                  clear: () => activeState().attuned.clear(),
                  get size() { return activeState().attuned.size; },
                  [Symbol.iterator]: () => activeState().attuned[Symbol.iterator]() };

export function isAttuned(el: Element): boolean {
  return attuned.has(el);
}

export function markAttuned(el: Element): void {
  attuned.add(el);
}

/** Snapshot for saving. */
/**
 * Forget every attunement this character has.
 *
 * Only the developer resets call this — `/replay` and the test menu — and it
 * clears the WHOLE set rather than the one element the errand granted, which
 * is deliberate and is the safe direction of a real trade-off. Nothing records
 * which element a character chose at Calanais, so an exact undo is not
 * available; over-clearing costs a tester an element they must walk down and
 * pick again, while under-clearing would hand out a second element free and be
 * a live exploit the moment `/replay` reached a player's hands.
 *
 * If a SECOND source of attunement is ever added, this has to become precise,
 * and the smoke suite fails the day that happens.
 */
export function clearAttuned(): void {
  attuned.clear();
}

export function attunedState(): Element[] {
  return [...attuned];
}

/**
 * This character's own element, for anything that needs ONE identity rather
 * than the whole set — PvP, a monster's elemental spell landing on the
 * player, standing in an ambient field. The FIRST lane ever attuned, not the
 * latest: `attuned` is a Set read in insertion order, and nothing in normal
 * play removes from it or reorders it (`clearAttuned` is the developer reset
 * above, unreachable from a real character), so this stays the same answer
 * for as long as the character exists, even after every other lane opens
 * too. Undefined until the first stone is ever spent.
 */
export function playerElement(): Element | undefined {
  return attunedState()[0];
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
 * you committed to. The two surviving originals predate the elemental line
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
    researchCost: {},
    researchGold: 150,
    crystal: "healCrystal",
    buyCost: {},
    buyGold: 80,
    buyN: 10,
  },
  {
    // Recall skips research entirely. The old herb-and-silk gate was busywork
    // in front of a convenience, and 800 gold a charge is a far better brake
    // than a one-off unlock: you can always afford the trip home, you just
    // have to decide every single time whether it was worth it.
    id: "recall",
    name: "Recall Crystals",
    desc: "Teleports you back to Home Isle.",
    researchCost: {},
    openFromStart: true,
    crystal: "recallCrystal",
    buyCost: {},
    buyGold: 800,
    buyN: 1,
  },
  /* ---- THE UTILITY CRYSTALS ------------------------------------------------
   * Five stones that do something other than damage. All open from the
   * first visit — the level is the gate, not a research step, because the
   * interesting question about a Fury Rune is whether you are ready to
   * survive one, and no amount of gold answers that.
   *
   * The ladder is deliberately spread out rather than bunched, and the Grand
   * Life Crystal sits near the TOP of it rather than the bottom. That looks backwards for
   * a heal and is not: a 440-point heal handed to a level-15 character does
   * not help them survive, it removes the part of the game where they learn
   * to. It arrives at 35, five levels before Fury, because Fury is the thing
   * it exists to make survivable — you unlock the antidote first and the
   * poison second, with just enough room to stock up.
   * ---------------------------------------------------------------------- */
  {
    id: "mending",
    name: "Grand Life Crystals",
    desc: "Heals far more than a Life Crystal. Shares its cooldown.",
    researchCost: {},
    openFromStart: true,
    minLevel: 35,
    crystal: "healRune",
    buyCost: {},
    buyGold: 400,
    buyN: 5,
  },
  {
    id: "swiftness",
    name: "Acceleration Crystals",
    desc: "Move 35% faster for 20 seconds.",
    researchCost: {},
    openFromStart: true,
    minLevel: 20,
    crystal: "hasteRune",
    buyCost: {},
    buyGold: 500,
    buyN: 3,
  },
  {
    id: "mire",
    name: "Slowdown Crystals",
    desc: "Halves everything within 5 tiles for 5 seconds.",
    researchCost: {},
    openFromStart: true,
    minLevel: 25,
    crystal: "mireRune",
    buyCost: {},
    buyGold: 700,
    buyN: 3,
  },
  {
    id: "aegis",
    name: "Protective Crystals",
    desc: "Cuts all damage 40% for 15s, elemental too. Once per 5 min.",
    researchCost: {},
    openFromStart: true,
    minLevel: 30,
    crystal: "aegisRune",
    buyCost: {},
    buyGold: 900,
    buyN: 3,
  },
  {
    // The Essential Gem is doing the same job here it does on the Knells:
    // gold is a thing a player eventually has piles of, and a rune this
    // strong has to be rationed by something that is not gold. One gem a
    // charge also puts Fury in the same currency as the Knells, which is
    // correct — they are the two things you spend on a fight you chose.
    id: "fury",
    name: "Fury Crystals",
    // Short enough to fit the shelf row. The full arithmetic lives in
    // config.ts, which is where somebody retuning it will be looking anyway.
    desc: "3x damage for 20s, then a 5 min burn. Once per 30 min.",
    researchCost: {},
    openFromStart: true,
    minLevel: 40,
    crystal: "furyRune",
    buyCost: { essentialGem: 1 },
    buyGold: 2500,
    buyN: 1,
  },
];

/** Is the character high enough level to buy this project's charges? */
export function levelOk(r: Research, level: number): boolean {
  return level >= (r.minLevel ?? 1);
}

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

const FORMS = ["Shard", "Burst", "Nova", "Wave", "Arrow", "Rune"] as const;

const FORM_DESC: Readonly<Record<(typeof FORMS)[number], string>> = {
  Shard: "One creature, longest reach.",
  Burst: "Aimed. Select it, then click the square: 25 tiles, everything on them.",
  Nova: "Every tile touching you at once. No aiming, and no safe distance.",
  Wave: "Sixteen tiles the way you are facing, four deep, widening as it goes.",
  Arrow: "Arrowheads that carry the element. They meet resistance, never armour.",
  Rune: "One creature, twice a Shard, one tile shorter. Cools on the Shard's clock.",
};


/** Gold per batch, by tier and form. Arrows are cheap and bought by the score. */
const PRICE: Readonly<Record<(typeof FORMS)[number], readonly [number, number, number]>> = {
  Shard: [120, 400, 1200],
  Burst: [150, 500, 1500],
  Nova: [140, 460, 1400],
  Wave: [170, 560, 1700],
  Arrow: [60, 150, 400],
  Rune: [350, 1100, 3200],
};

const BATCH: Readonly<Record<(typeof FORMS)[number], readonly [number, number, number]>> = {
  Shard: [10, 8, 6], Burst: [10, 8, 6], Nova: [10, 8, 6], Wave: [10, 8, 6], Arrow: [25, 25, 25],
  // Five, four, three. A Knell is meant to be counted on one hand: the moment
  // you have ten of them it stops being the hit you save for something and
  // becomes the hit you open with, and the Shard has nothing left to do.
  Rune: [5, 4, 3],
};

/**
 * The materials a batch wants on top of its gold.
 *
 * TWO DIFFERENT JOBS, which is why they are written as two rules rather than
 * one table. The Essence gates the single most destructive SHAPE of each
 * element and nothing else — one dragon-only material on one crystal is a
 * landmark, and spread across five it would be a tax. The Gems gate the Knell
 * at EVERY tier, because there the material is not a landmark at all: it is
 * the brake. Gold alone cannot ration a Knell — gold is the thing a player
 * eventually has piles of — and an unrationed Knell is simply a Shard that
 * won.
 */
function materialsFor(form: (typeof FORMS)[number], tier: Tier): Cost {
  if (form === "Rune") return { essentialGem: 2 };
  if (tier === 2 && form === "Wave") return { magicEssence: 1 };
  return {};
}

export const OFFERS: readonly Offer[] = (() => {
  const out: Offer[] = [];
  for (const el of ELEMENTS) {
    for (let t = 0 as Tier; t < 3; t = (t + 1) as Tier) {
      const n = TIER_CODE[el][t];
      for (const f of FORMS) {
        out.push({
          id: `${el}${n}${f}`,
          element: el,
          tier: t,
          crystal: `${el}${n}${f}` as ItemKind,
          desc: FORM_DESC[f],
          gold: PRICE[f][t],
          cost: materialsFor(f, t),
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

/** Projects finished. Only Life Crystals can land here now. */
/** Completed research project ids for THIS character. See `attuned` above. */
const done = { has: (id: string) => activeState().research.has(id),
               add: (id: string) => activeState().research.add(id),
               delete: (id: string) => activeState().research.delete(id),
               clear: () => activeState().research.clear(),
               get size() { return activeState().research.size; },
               [Symbol.iterator]: () => activeState().research[Symbol.iterator]() };

export function isResearched(id: string): boolean {
  if (done.has(id)) return true;
  return RESEARCH.some((r) => r.id === id && r.openFromStart === true);
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
