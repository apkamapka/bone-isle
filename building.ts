/** Building system: structure catalog, affordability, placement. */
import { TILE, LIBRARY_MANA_BONUS, GARDEN_HP_BONUS } from "../config.ts";
import { beep } from "../audio.ts";
import { addFloat } from "../fx.ts";
import { SPR, bakeForge, bakeLibrary, bakeGarden, bakeDummy, bakeChest } from "../gfx/sprites.ts";
import { countAcross, removeAcross } from "../items.ts";
import { onStructureBuilt } from "./quests.ts";
import type { ItemKind, Bag } from "../items.ts";
import type { Player } from "../entities/player.ts";
import type { World } from "../world/types.ts";

/** Which bag items a structure costs. */
export type Cost = Partial<Record<ItemKind, number>>;

export interface StructDef {
  name: string;
  cost: Cost;
  spr: HTMLCanvasElement;
  desc: string;
  /** Solid structures block movement; gardens you can walk onto. */
  solid: boolean;
  /** Occupies a single tile (like the dummies) instead of the full 2×2 pad. */
  single?: boolean;
}

export type StructKey = "forge" | "library" | "garden" | "dummy" | "dummyII" | "chest";

export const STRUCTS: Record<StructKey, StructDef> = {
  forge: { name: "Forge", cost: { wood: 40, stone: 30 }, spr: bakeForge(), desc: "Craft weapons, armor & potions", solid: true },
  library: { name: "Library", cost: { wood: 30, stone: 24, herb: 6 }, spr: bakeLibrary(), desc: "Learn spells · +30 max mana", solid: true },
  garden: { name: "Garden", cost: { wood: 22, herb: 12, stone: 6 }, spr: bakeGarden(), desc: "Regen HP & mana nearby · +15 max HP", solid: false },
  dummy: { name: "Training Dummy", cost: { wood: 16, stone: 12 }, spr: bakeDummy(), desc: "Attack it to train Sword Fighting", solid: true, single: true },
  dummyII: { name: "War Dummy", cost: { wood: 30, stone: 24, bones: 16 }, spr: bakeDummy(), desc: "Trains Sword Fighting + Shielding", solid: true, single: true },
  chest: { name: "Storage Chest", cost: { wood: 24, stone: 16 }, spr: bakeChest(), desc: "Stash items you don't want to carry", solid: true },
};

export const STRUCT_KEYS: StructKey[] = ["forge", "library", "garden", "dummy", "dummyII", "chest"];

/** Passive max HP/mana bonuses from structures owned on Home Isle. */
export function structureBonuses(home: World): { maxhp: number; maxmana: number } {
  let maxhp = 0;
  let maxmana = 0;
  for (const s of home.structures) {
    if (s.key === "library") maxmana += LIBRARY_MANA_BONUS;
    if (s.key === "garden") maxhp += GARDEN_HP_BONUS;
  }
  return { maxhp, maxmana };
}

export function canAfford(bag: Bag, cost: Cost, stash?: Bag): boolean {
  const bags = stash ? [bag, stash] : [bag];
  return (Object.entries(cost) as [ItemKind, number][]).every(([k, v]) => countAcross(bags, k) >= v);
}
export function payCost(bag: Bag, cost: Cost, stash?: Bag): void {
  const bags = stash ? [bag, stash] : [bag];
  for (const [k, v] of Object.entries(cost) as [ItemKind, number][]) removeAcross(bags, k, v);
}
export function costText(cost: Cost): string {
  return (Object.entries(cost) as [string, number][]).map(([k, v]) => `${v} ${k}`).join(" + ");
}

/**
 * Try to place `key` at world pixel (wx,wy) on the home world. Returns true
 * if a structure was placed (cost paid, pad consumed, solidity applied).
 */
export function tryPlace(home: World, p: Player, key: StructKey, wx: number, wy: number, stash?: Bag): boolean {
  const tx = Math.floor(wx / TILE);
  const ty = Math.floor(wy / TILE);
  const spot = home.buildSpots.find((s) => !s.built && tx >= s.tx && tx < s.tx + 2 && ty >= s.ty && ty < s.ty + 2);
  if (!spot) return false;
  const def = STRUCTS[key];
  if (!canAfford(p.bag, def.cost, stash)) return false;

  payCost(p.bag, def.cost, stash);
  spot.built = key;
  home.structures.push({ key, tx: spot.tx, ty: spot.ty, anim: Math.random() * 6, hurtT: 0 });

  if (def.solid) {
    if (def.single) {
      home.solid[spot.ty][spot.tx] = true;
    } else {
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) home.solid[spot.ty + j][spot.tx + i] = true;
    }
  }
  onStructureBuilt(key, (t) => addFloat(home, spot.tx * TILE + TILE, spot.ty * TILE - 8, t, "#ffe9a8"));
  addFloat(home, spot.tx * TILE + TILE, spot.ty * TILE, `${def.name} built!`, "#ffe27a");
  beep(330, 0.1, "triangle", 0.06);
  return true;
}

/** Rebuild solidity + pad state from saved structures (used on load). */
export function applyStructureSolidity(home: World): void {
  for (const s of home.structures) {
    const def = STRUCTS[s.key as StructKey];
    if (!def || !def.solid) continue;
    if (def.single) {
      home.solid[s.ty][s.tx] = true;
    } else {
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) home.solid[s.ty + j][s.tx + i] = true;
    }
    const spot = home.buildSpots.find((b) => b.tx === s.tx && b.ty === s.ty);
    if (spot) spot.built = s.key;
  }
}

/** Look up the sprite for a placed structure key. */
export function structSprite(key: string): HTMLCanvasElement {
  return STRUCTS[key as StructKey]?.spr ?? SPR.rock;
}
