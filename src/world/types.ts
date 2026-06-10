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
  monsters: unknown[];
  loot: unknown[];
  respawns: unknown[];
  structures: Structure[];
  buildSpots: BuildSpot[];
  portal: Vec;
  coastWater: CoastWater[];
  landR: (theta: number) => number;
  mapCanvas: HTMLCanvasElement;
}
