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
