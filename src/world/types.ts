/** Shared data shapes for the world: terrain, nodes, monsters, NPCs. */
import type { ItemStack } from "../items.ts";

/** Terrain tile codes. (Plain const object so the syntax is fully erasable.) */
export const Tile = {
  Water: 0,
  Grass: 1,
  Sand: 2,
  Wall: 3,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** The three islands. */
export type WorldKey = "home" | "town" | "wild";

/** A point in world (pixel) space. */
export interface Vec {
  x: number;
  y: number;
}

/** A teleport pad linking to another island. */
export interface Portal {
  x: number;
  y: number;
  dest: WorldKey;
  label: string;
}

/** Choppable tree node, occupies one tile. */
export interface Tree {
  tx: number;
  ty: number;
  spr: HTMLCanvasElement;
  hp: number;
  maxhp: number;
  stump: boolean;
  respawnT: number;
  hurtT: number;
}

/** Mineable rock node, occupies one tile. */
export interface RockNode {
  tx: number;
  ty: number;
  hp: number;
  maxhp: number;
  depleted: boolean;
  respawnT: number;
  hurtT: number;
}

/** Pickable herb patch (non-solid, one tap). */
export interface HerbNode {
  tx: number;
  ty: number;
  picked: boolean;
  respawnT: number;
}

/** Ground decoration baked into the map canvas (non-interactive). */
export interface Deco {
  spr: HTMLCanvasElement;
  tx: number;
  ty: number;
}

/** A 2x2 grass pad on Home Isle where a structure may be placed. */
export interface BuildSpot {
  tx: number;
  ty: number;
  built: string | null;
}

/** A placed structure instance. */
export interface Structure {
  key: string;
  tx: number;
  ty: number;
  anim: number;
  hurtT?: number;
}

/** Reserved circular area kept clear during procedural placement. */
export interface Reserved {
  x: number;
  y: number;
  r: number;
}

/** Animated coastal water tile (foam/wave dashes). */
export interface CoastWater {
  x: number;
  y: number;
  ph: number;
}

/** Item stack lying on the ground (e.g. dropped when the bag is full). */
export interface GroundItem {
  kind: ItemStack["kind"];
  n: number;
  x: number;
  y: number;
  t: number;
}

/** Monster kinds present on the Wildlands. */
export type MonsterKind = "spider" | "skeleton" | "goblin" | "orc" | "ghost" | "troll";

/** A live monster instance. */
export interface Monster {
  kind: MonsterKind;
  x: number;
  y: number;
  spr: HTMLCanvasElement;
  hp: number;
  maxhp: number;
  speed: number;
  atkRate: number;
  atkCd: number;
  wanderT: number;
  wx: number;
  wy: number;
  bob: number;
  hurtT: number;
}

/** A lootable corpse left behind when a monster dies. */
export interface Corpse {
  name: string;
  x: number;
  y: number;
  items: ItemStack[];
  gold: number;
  t: number; // seconds until decay
}

/** Town NPC kinds. */
export type NpcKey = "smith" | "herbalist" | "elder";

/** A town NPC. */
export interface Npc {
  key: NpcKey;
  name: string;
  x: number;
  y: number;
  spr: HTMLCanvasElement;
  bob: number;
}

/**
 * A flying arrow. Purely cosmetic — the hit is resolved instantly when fired;
 * this just draws the projectile travelling from the shooter to where the
 * target stood at release. `p` is 0→1 travel progress.
 */
export interface Shot {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  p: number;
  dur: number;
  bone: boolean;
}

/** A pending respawn (kind + countdown seconds). */
export interface Respawn {
  kind: MonsterKind;
  t: number;
}

/** Options for generating a world. */
export interface WorldOpts {
  key: WorldKey;
  name: string;
  safe: boolean;
  w: number;
  h: number;
  buildSpots: boolean;
  npcs: boolean;
  trees: number;
  rocks: number;
  herbs: number;
  mushrooms: number;
  bones: number;
  grassShift?: number;
  portals: readonly { dest: WorldKey; label: string }[];
}

/** A full island world. */
export interface World {
  key: WorldKey;
  name: string;
  safe: boolean;
  w: number;
  h: number;
  tile: Tile[][];
  solid: boolean[][];
  reserved: Reserved[];
  trees: Tree[];
  rocks: RockNode[];
  herbs: HerbNode[];
  decos: Deco[];
  monsters: Monster[];
  corpses: Corpse[];
  ground: GroundItem[];
  npcs: Npc[];
  respawns: Respawn[];
  shots: Shot[];
  structures: Structure[];
  buildSpots: BuildSpot[];
  portals: Portal[];
  coastWater: CoastWater[];
  landR: (theta: number) => number;
  mapCanvas: HTMLCanvasElement;
}
