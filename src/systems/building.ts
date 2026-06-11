/** Building system: structure catalog, affordability, placement. */
import { TILE } from "../config.ts";
import { beep } from "../audio.ts";
import { addFloat } from "../fx.ts";
import { SPR, bakeForge, bakeLibrary, bakeGarden, bakeDummy } from "../gfx/sprites.ts";
import type { Player, Inventory } from "../entities/player.ts";
import type { World } from "../world/types.ts";

/** Which inventory resources a structure costs. */
export type Cost = Partial<Pick<Inventory, "wood" | "stone" | "coins">>;

export interface StructDef {
  name: string;
  cost: Cost;
  spr: HTMLCanvasElement;
  desc: string;
  /** Solid structures block movement; gardens you can walk onto. */
  solid: boolean;
}

export type StructKey = "forge" | "library" | "garden" | "dummy";

export const STRUCTS: Record<StructKey, StructDef> = {
  forge: { name: "Forge", cost: { wood: 20, stone: 15 }, spr: bakeForge(), desc: "Unlocks weapon crafting (soon)", solid: true },
  library: { name: "Library", cost: { wood: 15, stone: 10 }, spr: bakeLibrary(), desc: "Unlocks magic (soon)", solid: true },
  garden: { name: "Garden", cost: { wood: 10 }, spr: bakeGarden(), desc: "Regenerates HP while nearby", solid: false },
  dummy: { name: "Training Dummy", cost: { wood: 8, stone: 5 }, spr: bakeDummy(), desc: "Attack it to train Sword Fighting", solid: true },
};

export const STRUCT_KEYS: StructKey[] = ["forge", "library", "garden", "dummy"];

export function canAfford(inv: Inventory, cost: Cost): boolean {
  return (Object.entries(cost) as [keyof Inventory, number][]).every(([k, v]) => inv[k] >= v);
}
export function payCost(inv: Inventory, cost: Cost): void {
  for (const [k, v] of Object.entries(cost) as [keyof Inventory, number][]) inv[k] -= v;
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
  if (!canAfford(p.inv, def.cost)) return false;

  payCost(p.inv, def.cost);
  spot.built = key;
  home.structures.push({ key, tx: spot.tx, ty: spot.ty, anim: Math.random() * 6, hurtT: 0 });

  if (def.solid) {
    if (key === "dummy") {
      home.solid[spot.ty][spot.tx] = true;
    } else {
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) home.solid[spot.ty + j][spot.tx + i] = true;
    }
  }
  addFloat(home, spot.tx * TILE + TILE, spot.ty * TILE, `${def.name} built!`, "#ffe27a");
  beep(330, 0.1, "triangle", 0.06);
  return true;
}

/** Look up the sprite for a placed structure key. */
export function structSprite(key: string): HTMLCanvasElement {
  return STRUCTS[key as StructKey]?.spr ?? SPR.rock;
}
