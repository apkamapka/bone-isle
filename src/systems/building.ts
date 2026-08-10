/** Building system: structure catalog, tiers, affordability, free-form placement. */
import { TILE } from "../config.ts";
import { beep } from "../audio.ts";
import { addFloat } from "../fx.ts";
import { dist } from "../util.ts";
import { SPR, bakeForge, bakeLibrary, bakeDummy, bakeRange, bakeChest, bakeTreasureChest } from "../gfx/sprites.ts";
import { countAcross, removeAcross, emptyStash } from "../items.ts";
import { onStructureBuilt } from "./quests.ts";
import { unstick } from "../world/collision.ts";
import { Tile } from "../world/types.ts";
import type { ItemKind, Bag } from "../items.ts";
import type { Player } from "../entities/player.ts";
import type { World, Structure } from "../world/types.ts";

/** Which bag items a structure costs. */
export type Cost = Partial<Record<ItemKind, number>>;

/** Structure tier. Everything starts at I and is upgraded in place. */
export type Tier = 1 | 2 | 3;

export interface TierDef {
  /** Full cost of reaching this tier — NOT the difference from the one below.
   *  Upgrading is meant to be a second building project, not a discount. */
  cost: Cost;
  /** What this tier adds, shown in the build panel. */
  desc: string;
}

export interface StructDef {
  name: string;
  spr: HTMLCanvasElement;
  /** Solid structures block movement. */
  solid: boolean;
  /** Occupies a single tile instead of the full 2×2 pad. */
  single?: boolean;
  /** Tier I first. A one-entry list means the structure has no upgrades. */
  tiers: readonly TierDef[];
}

export type StructKey = "forge" | "tower" | "dummy" | "range" | "chest";

/**
 * The catalog.
 *
 * Iron, steel and Essential Gems appear in the upper tiers on purpose, and
 * the ladder they form is airtight: a Forge II costs iron, which only a
 * Forge I can smelt; a Forge III costs steel, which only a Forge II can
 * pull; and an Alchemy Tower III costs gems, which only a Forge III can cut.
 * No tier can be skipped and no tier exists without a job.
 */
export const STRUCTS: Record<StructKey, StructDef> = {
  forge: {
    name: "Forge", spr: bakeForge(), solid: true,
    tiers: [
      { cost: { wood: 50, stone: 20 }, desc: "Smelt looted gear into iron · craft arrows" },
      { cost: { stone: 100, wood: 50, iron: 20 }, desc: "The same gear now yields steel" },
      { cost: { wood: 100, iron: 160, stone: 100, steel: 20 }, desc: "Cut Essential Gems from trophies" },
    ],
  },
  tower: {
    name: "Alchemy Tower", spr: bakeLibrary(), solid: true,
    tiers: [
      { cost: { wood: 50, stone: 30 }, desc: "Research tier I crystals" },
      { cost: { wood: 100, stone: 100, iron: 100, steel: 50 }, desc: "Unlocks tier II crystals" },
      { cost: { wood: 1000, stone: 1000, iron: 500, essentialGem: 100, steel: 500 }, desc: "Unlocks tier III crystals" },
    ],
  },
  dummy: {
    name: "Training Dummy", spr: bakeDummy(), solid: true, single: true,
    tiers: [
      { cost: { wood: 20, stone: 15 }, desc: "Trains Sword Fighting at half rate" },
      { cost: { wood: 50, stone: 30, bones: 20 }, desc: "Also trains Shielding" },
      { cost: { wood: 100, stone: 80, bones: 50, steel: 20 }, desc: "Faster on both" },
    ],
  },
  range: {
    name: "Archery Range", spr: bakeRange(), solid: true, single: true,
    tiers: [{ cost: { wood: 20, stone: 10 }, desc: "Shoot it to train Distance Fighting" }],
  },
  chest: {
    name: "Storage Chest", spr: bakeChest(), solid: true,
    tiers: [
      { cost: { wood: 10, stone: 5 }, desc: "10 slots" },
      { cost: { wood: 60, stone: 60, bones: 40 }, desc: "50 slots" },
      { cost: { wood: 80, stone: 80, bones: 80 }, desc: "100 slots" },
    ],
  },
};

export const STRUCT_KEYS: StructKey[] = ["forge", "tower", "dummy", "range", "chest"];

/** Slots a Storage Chest holds at each tier. */
export const CHEST_SLOTS: readonly number[] = [10, 50, 100];

/**
 * Training rates by dummy tier, as a fraction of real combat.
 *
 * A dummy costs no travel, no food, no arrows and cannot kill you, so at
 * parity it would be strictly better than hunting — which inverts the point
 * of both. Even a tier III post stays below one, and Shielding lags melee
 * throughout: Shielding's doubled cost is paid back by blocking two
 * creatures at once, and a post in the ground is exactly one creature.
 */
export const DUMMY_TIER_RATE: readonly number[] = [0.5, 0.5, 0.6];
export const DUMMY_TIER_SHIELD: readonly number[] = [0, 0.25, 0.5];

/** A structure's tier, defaulting old saves (and world-placed props) to I. */
export function tierOf(s: Structure): Tier {
  const t = s.tier ?? 1;
  return (t < 1 ? 1 : t > 3 ? 3 : t) as Tier;
}

export function maxTier(key: string): number {
  return STRUCTS[key as StructKey]?.tiers.length ?? 1;
}

/** Cost of the NEXT tier above `tier`, or null when already at the top. */
export function upgradeCost(key: string, tier: number): Cost | null {
  const def = STRUCTS[key as StructKey];
  if (!def || tier >= def.tiers.length) return null;
  return def.tiers[tier].cost;
}

/** Cost of building this structure fresh (always tier I). */
export function buildCost(key: string): Cost {
  return STRUCTS[key as StructKey]?.tiers[0].cost ?? {};
}

/**
 * Highest tier of `key` standing on Home Isle, or 0 if there is none.
 *
 * Deliberately the HIGHEST rather than the nearest: a player who has paid
 * for a Forge III should not lose gem-cutting because they happened to walk
 * up to the old Forge I they never tore down (and nothing can be torn down).
 */
export function bestTier(home: World, key: string): number {
  let best = 0;
  for (const s of home.structures) if (s.key === key) best = Math.max(best, tierOf(s));
  return best;
}

/** Costs draw from the backpack plus EVERY Storage Chest. */
export function canAfford(bag: Bag, cost: Cost, stash?: readonly Bag[]): boolean {
  const bags = stash ? [bag, ...stash] : [bag];
  return (Object.entries(cost) as [ItemKind, number][]).every(([k, v]) => countAcross(bags, k) >= v);
}
export function payCost(bag: Bag, cost: Cost, stash?: readonly Bag[]): void {
  const bags = stash ? [bag, ...stash] : [bag];
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
 * (tx,ty)? Every footprint tile must be clear grass, the spot must keep
 * clear of portals' stone rings, and it can't overlap any existing
 * structure. `ignore` lets save-migration validate a structure against the
 * others without tripping over itself.
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
      if (home.decos.some((d) => d.tx === x && d.ty === y)) return false;
    }
  }
  const cx = (tx + n / 2) * TILE;
  const cy = (ty + n / 2) * TILE;
  for (const pt of home.portals) {
    if (dist(pt.x, pt.y, cx, cy) < 44 + n * 16) return false;
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
 * anywhere on Home Isle the ground allows. Always builds at tier I.
 */
export function tryPlace(home: World, p: Player, key: StructKey, wx: number, wy: number, stash?: readonly Bag[]): boolean {
  const def = STRUCTS[key];
  const n = def.single ? 1 : 2;
  const tx = Math.round(wx / TILE - n / 2);
  const ty = Math.round(wy / TILE - n / 2);
  const cost = buildCost(key);
  if (!canPlaceAt(home, key, tx, ty)) return false;
  if (!canAfford(p.bag, cost, stash)) return false;

  payCost(p.bag, cost, stash);
  // a fresh Storage Chest is born with its own tier-I inventory
  home.structures.push({ key, tx, ty, tier: 1, anim: Math.random() * 6, hurtT: 0, ...(key === "chest" ? { inv: emptyStash(CHEST_SLOTS[0]) } : {}) });
  markSolid(home, key, tx, ty);
  unstick(home, p); // if you built on the tile you were standing on, step out of it
  onStructureBuilt(key, (t) => addFloat(home, tx * TILE + TILE, ty * TILE - 16, t, "#ffe9a8"));
  addFloat(home, tx * TILE + TILE, ty * TILE, `${def.name} built!`, "#ffe27a");
  beep(330, 0.1, "triangle", 0.06);
  return true;
}

/**
 * Raise one structure by a tier, paying the full cost of the new tier.
 *
 * A Storage Chest grows its inventory in place — the existing stacks keep
 * their slots and empty ones are appended, so an upgrade can never cost a
 * player an item.
 */
export function tryUpgrade(home: World, p: Player, s: Structure, stash?: readonly Bag[]): boolean {
  const tier = tierOf(s);
  const cost = upgradeCost(s.key, tier);
  if (!cost) return false;
  if (!canAfford(p.bag, cost, stash)) return false;
  payCost(p.bag, cost, stash);
  s.tier = tier + 1;
  if (s.key === "chest" && s.inv) {
    const want = CHEST_SLOTS[s.tier - 1];
    while (s.inv.length < want) s.inv.push(null);
  }
  const def = STRUCTS[s.key as StructKey];
  addFloat(home, s.tx * TILE + TILE, s.ty * TILE, `${def.name} ${"I".repeat(s.tier)}!`, "#ffe27a");
  beep(392, 0.12, "triangle", 0.06);
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
