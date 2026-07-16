/** Shared data shapes for the world: terrain, nodes, monsters, NPCs. */
import type { ItemStack } from "../items.ts";

/** Terrain tile codes. (Plain const object so the syntax is fully erasable.) */
export const Tile = {
  Water: 0,
  Grass: 1,
  Sand: 2,
  Wall: 3,
  Cave: 4,
  /** Packed-earth camp floors and trails (walkable). */
  Dirt: 5,
  /** Wooden camp palisade (solid) — goblin & orc settlements. */
  Palisade: 6,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** The surface islands, the Deep Wildlands, and the Bone Caverns (-1..-3). */
export type WorldKey = "home" | "town" | "wild" | "deepwild" | "cave1" | "cave2" | "cave3"
  // Deep Wildlands camp lairs — each settlement descends into its own dungeon
  // (one to three floors; deeper floors are larger and will carry harder tiers)
  | "warren1"
  | "cove1"
  | "hollow1" | "hollow2"
  | "goblin1" | "goblin2"
  | "orcfort1" | "orcfort2"
  | "bastion1" | "bastion2"
  | "grave1" | "grave2"
  | "roost1" | "roost2" | "roost3";

/** A point in world (pixel) space. */
export interface Vec {
  x: number;
  y: number;
}

/** A teleport pad linking to another map. A `style` renders it as a ladder or
 * a prominent cave mouth instead of the default swirl. */
export interface Portal {
  x: number;
  y: number;
  dest: WorldKey;
  label: string;
  style?: "ladderDown" | "ladderUp" | "caveMouth";
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
  /** Storage Chests only: this chest's own inventory (Etap 11). Rides inside
   *  the structure dump in the save, so persistence needs no extra field. */
  inv?: (ItemStack | null)[];
}

/** Reserved circular area kept clear during procedural placement. */
export interface Reserved {
  x: number;
  y: number;
  r: number;
}

/**
 * A themed monster settlement on the Deep Wildlands (orc fort, graveyard,
 * dragon roost…). Purely descriptive for now: it marks a circle of terrain
 * and decoration; a later stage attaches per-camp rosters and respawns so
 * creatures live in their villages instead of roaming in bands.
 */
export interface Camp {
  key: string;
  name: string;
  /** Centre in world px. */
  x: number;
  y: number;
  /** Radius in px. */
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

/** Monster kinds present on the Wildlands and down the Bone Caverns. */
export type MonsterKind =
  | "rat" | "spider" | "bat" | "skeleton" | "goblin" | "wolf"
  | "ghost" | "orc" | "bear" | "minotaur" | "troll" | "cyclops" | "boneLord"
  // Etap 8 — the extended bestiary (Tibia 8.6-inspired tiers to ~level 20)
  | "snake" | "crab" | "wasp" | "poisonSpider" | "rotworm" | "amazon"
  | "warWolf" | "ghoul" | "orcSpearman" | "orcWarrior" | "hunter"
  | "minotaurArcher" | "orcShaman" | "mummy" | "orcBerserker"
  | "minotaurGuard" | "minotaurMage"
  // the boss: one lair at the bottom of the Bone Caverns, long respawn
  | "dragon";

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
  /** Seconds of forced aggression left after taking a hit — the creature
   *  chases even beyond its normal sight range (LoS still required), so
   *  shooting anything always provokes it regardless of bow reach. */
  aggroT: number;
  /** Preferred detour side (+1/-1) when the direct path to the target is
   *  body-blocked — half the pack circles left, half right, so they surround
   *  the player instead of queueing in a single line behind each other. */
  orbit: 1 | -1;
  /** Camp this creature belongs to (Deep Wildlands settlements). A slain
   *  camp dweller respawns back home instead of anywhere on the continent. */
  camp?: string;
  /** Home point + leash radius in px: wandering beyond it turns the creature
   *  back toward home, so villagers idle around their village. Roamers
   *  (wilderness wolves) simply have no home set. */
  hx?: number;
  hy?: number;
  hr?: number;
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
export type NpcKey = "smith" | "herbalist" | "elder" | "taskmaster" | "tailor";

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
  /** Optional projectile tint (monster spit, magic bolts, dragon fire).
   *  When absent the classic arrow colors apply (bone-white / steel-gray). */
  color?: string;
  /** Thicker stroke for heavy projectiles (fireballs). */
  wide?: boolean;
}

/** A pending respawn (kind + countdown seconds). */
export interface Respawn {
  kind: MonsterKind;
  t: number;
  /** Camp the slain creature came from — it respawns back there. */
  camp?: string;
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
  /**
   * Optional land mask (tile space): when present the coastline comes from
   * this predicate instead of the radial island silhouette — noise-shaped
   * continents with bays, peninsulas and inland lakes (the Deep Wildlands).
   * The radial path below is untouched, so every older island still rolls
   * byte-identically.
   */
  mask?: (tx: number, ty: number) => boolean;
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
  /** Themed settlements (Deep Wildlands); empty elsewhere. */
  camps: Camp[];
  coastWater: CoastWater[];
  landR: (theta: number) => number;
  mapCanvas: HTMLCanvasElement;
}
