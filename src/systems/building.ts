/** Building system: structure catalog, affordability, free-form placement. */
import { TILE, GARDEN_HP_BONUS } from "../config.ts";
import { beep } from "../audio.ts";
import { addFloat } from "../fx.ts";
import { dist } from "../util.ts";
import { SPR, bakeForge, bakeLibrary, bakeGarden, bakeDummy, bakeRange, bakeChest, bakeTreasureChest } from "../gfx/sprites.ts";
import { countAcross, removeAcross } from "../items.ts";
import { onStructureBuilt } from "./quests.ts";
import { unstick } from "../world/collision.ts";
import { Tile } from "../world/types.ts";
import type { ItemKind, Bag } from "../items.ts";
import type { Player } from "../entities/player.ts";
import type { World, Structure } from "../world/types.ts";

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

export type StructKey = "forge" | "tower" | "garden" | "dummy" | "dummyII" | "range" | "chest";

export const STRUCTS: Record<StructKey, StructDef> = {
  forge: { name: "Forge", cost: { wood: 40, stone: 30 }, spr: bakeForge(), desc: "Craft gear & potions", solid: true },
  tower: { name: "Alchemy Tower", cost: { wood: 35, stone: 30, bones: 12 }, spr: bakeLibrary(), desc: "Research & buy charge crystals", solid: true },
  garden: { name: "Garden", cost: { wood: 22, herb: 12, stone: 6 }, spr: bakeGarden(), desc: "Regen HP nearby · +15 max HP", solid: false },
  dummy: { name: "Training Dummy", cost: { wood: 16, stone: 12 }, spr: bakeDummy(), desc: "Attack it to train Sword Fighting", solid: true, single: true },
  dummyII: { name: "War Dummy", cost: { wood: 30, stone: 24, bones: 16 }, spr: bakeDummy(), desc: "Trains Sword Fighting + Shielding", solid: true, single: true },
  range: { name: "Archery Range", cost: { wood: 18, stone: 8 }, spr: bakeRange(), desc: "Shoot it to train Distance Fighting", solid: true, single: true },
  chest: { name: "Storage Chest", cost: { wood: 24, stone: 16 }, spr: bakeChest(), desc: "Stash items you don't want to carry", solid: true },
};

export const STRUCT_KEYS: StructKey[] = ["forge", "tower", "garden", "dummy", "dummyII", "range", "chest"];

/** Passive max-HP bonus from structures owned on Home Isle (Garden). */
export function structureBonuses(home: World): { maxhp: number } {
  let maxhp = 0;
  for (const s of home.structures) {
    if (s.key === "garden") maxhp += GARDEN_HP_BONUS;
  }
  return { maxhp };
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

/** Footprint side length in tiles: 1 for `single` structures, else 2. */
export function footprint(key: string): number {
  if (key === "treasure") return 1; // world-placed chest, not a buildable
  return STRUCTS[key as StructKey]?.single ? 1 : 2;
}

/** Visual anchor of a placed structure: centre + sprite-base Y (world px). */
export function structCenter(s: Structure): { x: number; y: number; baseY: number } {
  const n = footprint(s.key);
  return {
    x: s.tx * TILE + (n * TILE) / 2,
    y: s.ty * TILE + (n * TILE) / 2,
    baseY: s.ty * TILE + n * TILE,
  };
}

/**
 * Free-form placement check: can `key` stand with its top-left tile at
 * (tx,ty)? Every footprint tile must be clear grass (no water/sand/walls, no
 * trees/rocks via solidity, no herb patches or baked decor underneath), the
 * spot must keep clear of portals' stone rings, and it can't overlap any
 * existing structure. `ignore` lets save-migration validate a structure
 * against the others without tripping over itself.
 */
export function canPlaceAt(home: World, key: StructKey, tx: number, ty: number, ignore?: Structure): boolean {
  const n = footprint(key);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = tx + i;
      const y = ty + j;
      if (x < 1 || y < 1 || x >= home.w - 1 || y >= home.h - 1) return false;
      if (home.tile[y][x] !== Tile.Grass) return false;
      if (home.solid[y][x]) return false;
      if (home.herbs.some((hb) => hb.tx === x && hb.ty === y)) return false;
      if (home.decos.some((d) => d.tx === x && d.ty === y)) return false;
    }
  }
  const cx = (tx + n / 2) * TILE;
  const cy = (ty + n / 2) * TILE;
  for (const pt of home.portals) {
    if (dist(pt.x, pt.y, cx, cy) < 22 + n * 8) return false;
  }
  for (const s of home.structures) {
    if (s === ignore) continue;
    const m = footprint(s.key);
    if (tx < s.tx + m && s.tx < tx + n && ty < s.ty + m && s.ty < ty + n) return false;
  }
  return true;
}

/** Apply a structure's footprint to the solidity grid. */
function markSolid(home: World, key: string, tx: number, ty: number): void {
  const def = STRUCTS[key as StructKey];
  if (!def?.solid) return;
  const n = footprint(key);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) home.solid[ty + j][tx + i] = true;
}

/**
 * Try to place `key` with its footprint centred on world pixel (wx,wy),
 * anywhere on Home Isle the ground allows — no fixed build pads. Returns true
 * if the structure was placed (cost paid, solidity applied).
 */
export function tryPlace(home: World, p: Player, key: StructKey, wx: number, wy: number, stash?: Bag): boolean {
  const def = STRUCTS[key];
  const n = def.single ? 1 : 2;
  const tx = Math.round(wx / TILE - n / 2);
  const ty = Math.round(wy / TILE - n / 2);
  if (!canPlaceAt(home, key, tx, ty)) return false;
  if (!canAfford(p.bag, def.cost, stash)) return false;

  payCost(p.bag, def.cost, stash);
  home.structures.push({ key, tx, ty, anim: Math.random() * 6, hurtT: 0 });
  markSolid(home, key, tx, ty);
  unstick(home, p); // if you built on the tile you were standing on, step out of it
  onStructureBuilt(key, (t) => addFloat(home, tx * TILE + TILE, ty * TILE - 8, t, "#ffe9a8"));
  addFloat(home, tx * TILE + TILE, ty * TILE, `${def.name} built!`, "#ffe27a");
  beep(330, 0.1, "triangle", 0.06);
  return true;
}

/** Rebuild solidity from saved structures (used on load). */
export function applyStructureSolidity(home: World): void {
  for (const s of home.structures) {
    if (!STRUCTS[s.key as StructKey]) continue;
    markSolid(home, s.key, s.tx, s.ty);
  }
}

let treasureSpr: HTMLCanvasElement | null = null;

/** Look up the sprite for a placed structure key. */
export function structSprite(key: string): HTMLCanvasElement {
  if (key === "treasure") return (treasureSpr ??= bakeTreasureChest());
  return STRUCTS[key as StructKey]?.spr ?? SPR.rock;
}
