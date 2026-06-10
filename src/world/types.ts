/** Shared data shapes for the world: terrain, resource nodes, structures. */

/** Terrain tile codes. (Plain const object so the syntax is fully erasable.) */
export const Tile = {
  Water: 0,
  Grass: 1,
  Sand: 2,
  Wall: 3,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** A point in world (pixel) space. */
export interface Vec {
  x: number;
  y: number;
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

/** Loot dropped on the ground (bones from skeletons, coins from goblins). */
export type LootKind = "bones" | "coins";
export interface LootItem {
  type: LootKind;
  x: number;
  y: number;
  t: number;
}

/** Monster kinds present on the Wild Isle. */
export type MonsterKind = "skeleton" | "goblin";

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

/** A pending respawn (kind + countdown seconds). */
export interface Respawn {
  kind: MonsterKind;
  t: number;
}

/** Options for generating a world. */
export interface WorldOpts {
  name: string;
  safe: boolean;
  buildSpots: boolean;
  trees: number;
  rocks: number;
  mushrooms: number;
  bones: number;
  grassShift?: number;
}

/** A full island world. `monsters`/`loot`/`respawns` are typed loosely
 *  for now; they'll get concrete types when entities are ported (step 3). */
export interface World {
  name: string;
  safe: boolean;
  tile: Tile[][];
  solid: boolean[][];
  reserved: Reserved[];
  trees: Tree[];
  rocks: RockNode[];
  decos: Deco[];
  monsters: Monster[];
  loot: LootItem[];
  respawns: Respawn[];
  structures: Structure[];
  buildSpots: BuildSpot[];
  portal: Vec;
  coastWater: CoastWater[];
  landR: (theta: number) => number;
  mapCanvas: HTMLCanvasElement;
}
