/** Building system: structure catalog, affordability, placement. */
import { TILE, LIBRARY_MANA_BONUS, GARDEN_HP_BONUS } from "../config.ts";
import { beep } from "../audio.ts";
import { addFloat } from "../fx.ts";
import { SPR, bakeForge, bakeLibrary, bakeGarden, bakeDummy, bakeChest } from "../gfx/sprites.ts";
import { bagCount, removeItem } from "../items.ts";
import { onStructureBuilt } from "./quests.ts";
import type { ItemKind } from "../items.ts";
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
}

export type StructKey = "forge" | "library" | "garden" | "dummy" | "chest";

export const STRUCTS: Record<StructKey, StructDef> = {
  forge: { name: "Forge", cost: { wood: 20, stone: 15 }, spr: bakeForge(), desc: "Craft weapons, armor & potions", solid: true },
  library: { name: "Library", cost: { wood: 15, stone: 10 }, spr: bakeLibrary(), desc: "Learn spells · +30 max mana", solid: true },
  garden: { name: "Garden", cost: { wood: 10, herb: 4 }, spr: bakeGarden(), desc: "Regen HP & mana nearby · +15 max HP", solid: false },
  dummy: { name: "Training Dummy", cost: { wood: 8, stone: 5 }, spr: bakeDummy(), desc: "Attack it to train Sword Fighting", solid: true },
  chest: { name: "Storage Chest", cost: { wood: 12, stone: 8 }, spr: bakeChest(), desc: "Stash items you don't want to carry", solid: true },
};

export const STRUCT_KEYS: StructKey[] = ["forge", "library", "garden", "dummy", "chest"];

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

export function canAfford(bag: Player["bag"], cost: Cost): boolean {
  return (Object.entries(cost) as [ItemKind, number][]).every(([k, v]) => bagCount(bag, k) >= v);
}
export function payCost(bag: Player["bag"], cost: Cost): void {
  for (const [k, v] of Object.entries(cost) as [ItemKind, number][]) removeItem(bag, k, v);
}
export function costText(cost: Cost): string {
  return (Object.entries(cost) as [string, number][]).map(([k, v]) => `${v} ${k}`).join(" + ");
}

/**
 * Try to place `key` at world pixel (wx,wy) on the home world. Returns true
 * if a structure was placed (cost paid, pad consumed, solidity applied).
 */
export function tryPlace(home: World, p: Player, key: StructKey, wx: number, wy: number): boolean {
  const tx = Math.floor(wx / TILE);
  const ty = Math.floor(wy / TILE);
  const spot = home.buildSpots.find((s) => !s.built && tx >= s.tx && tx < s.tx + 2 && ty >= s.ty && ty < s.ty + 2);
  if (!spot) return false;
  const def = STRUCTS[key];
  if (!canAfford(p.bag, def.cost)) return false;

  payCost(p.bag, def.cost);
  spot.built = key;
  home.structures.push({ key, tx: spot.tx, ty: spot.ty, anim: Math.random() * 6, hurtT: 0 });

  if (def.solid) {
    if (key === "dummy") {
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
    if (s.key === "dummy") {
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
