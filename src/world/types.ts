/** Shared data shapes for the world: terrain, nodes, monsters, NPCs. */
import type { MobDir } from "../gfx/mobSheet.ts";
import type { Bag, ItemStack } from "../items.ts";

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
  // The Gallows Coast — the human ladder's hunting ground, traced from Tiled,
  // and the cellars under it. Six holes are cut into the island and all six
  // drop onto the same floor, each onto its own ladder.
  | "bandit" | "banditdeep1" | "banditdeep2" | "banditdeep3"
  // The Bone Reach — the island behind the Time Sage's fourth pad, traced from
  // Tiled. Three descents are cut into it; two of the three are dug.
  | "reach"
  // Orc Deep -1 — the pit under the Reach's southern descent, hand-authored in
  // Tiled. Thirty-one orcs and the two Marrow plate pieces.
  | "orcdeep1"
  // Minotaur Deep -1 — the labyrinth under the Reach's western descent.
  // Forty-five minotaurs and the Marrow helm and boots.
  | "minodeep1"
  // Charnel Deep -1 — the maze under the Reach's northern descent, and the
  // hollow below it. The dead hold the maze in equal thirds; the hollow holds
  // one dragon and nothing else.
  | "deaddeep1" | "deaddeep2"
  // The Bone Sanctum — the crypt beneath the western temple; its level-gated
  // teleport chambers will link to quest realms in a future stage.
  | "sanctum"
  // The Time Sage's cellar under Bonetown: fourteen dormant pads that will
  // become the hunting grounds (orcs, trolls, minotaurs, undead) later on.
  | "cellar"
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
  /** A dormant pad: rendered ashen, refuses travel with a flash message.
   *  Placeholder for quest-realm teleports that don't exist yet. */
  inactive?: boolean;
  /** Side of the tile block this pad covers, in tiles (default 1). A pad
   *  painted 2x2 in Tiled is ONE portal with `span: 2`, centred on the block —
   *  so all four squares carry you, and one swirl is drawn across the lot
   *  instead of four crowded into the corners. */
  span?: number;
}

/** A level-sealed doorway: solid until the player's level reaches `lv`. */
export interface LevelGate {
  tx: number;
  ty: number;
  lv: number;
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

/**
 * A campfire.
 *
 * Not a Deco: decorations are baked into the map canvas when the world is
 * built, and a fire has to be redrawn every frame to flicker. It is drawn from
 * the depth-sorted list instead, like a tree.
 */
export interface Fire {
  tx: number;
  ty: number;
  /** Seconds of offset into the flicker cycle, so neighbouring fires in one
   *  camp do not pulse in unison. */
  phase: number;
}

/** Scenery a map may plant. Artwork and fallbacks live in gfx/sceneryArt.ts. */
export type SceneryKind = "skullPole" | "deadTree" | "felledTree"
  | "well" | "tent" | "boulderA" | "boulderB"
  // Buildings. Same contract as everything else here — the glyph names the
  // top-left square of the footprint and the sprite is anchored bottom-centre
  // over the block — they are simply four and five tiles instead of one.
  | "barn" | "houseA" | "houseB" | "smithy" | "windmill";

/**
 * A standing object taller than its tile — a skull totem, a dead tree.
 *
 * Not a Deco either, and for the opposite reason to a Fire: decorations are
 * baked under everything, and these have to be drawn from the depth-sorted
 * list so the player can pass behind them. The tile they name is theirs; the
 * sprite overhangs upward from it.
 */
export interface Scenery {
  /** TOP-LEFT tile of the object's footprint, following the portal `span`
   *  convention. Anything wider than one tile grows right and down from here. */
  tx: number;
  ty: number;
  kind: SceneryKind;
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
  /** 1..3, upgraded in place (Etap 24). Absent on old saves and on
   *  world-placed props like treasure chests — both read as tier I. */
  tier?: number;
  anim: number;
  hurtT?: number;
  /** Storage Chests only: this chest's own inventory (Etap 11). Rides inside
   *  the structure dump in the save, so persistence needs no extra field. */
  inv?: Bag;
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
  /**
   * Container kinds only: what is inside the pack lying here. A dropped
   * backpack keeps its contents on the floor — that is the whole "loot bag"
   * idea, a container you leave by the corpses and fill as you go.
   */
  items?: Bag;
}

/**
 * Monster kinds present on the Wildlands and down the Bone Caverns.
 *
 * Etap 19 cut the bestiary down to the creatures that own real artwork: every
 * kind listed here has a drawn walk sheet under `public/`. The sixteen that
 * only ever existed as a baked pixel blob — spiders, bats, crabs, wasps,
 * rotworms, wolves, war wolves, bears, ghosts, mummies, trolls, cyclopes,
 * amazons, hunters and the bone lord — are gone, kind and sprite alike. The
 * dragon was the long-standing exception, carried on a baked blob because the
 * bottom of the difficulty curve hangs off it; Etap 27 gave it real artwork
 * and it now plays by the same rule as everything else.
 */
export type MonsterKind =
  // The human ladder, low half: vermin of the road, levels 1-14. These are the
  // creatures the fantastic bestiary used to cover and no longer does — with
  // goblins and skeletons pushed up to level 15+, something has to hold the
  // opening stretch, and a person with a knife is the honest answer.
  | "beggar" | "vagrant" | "thief" | "poacher" | "bandit"
  | "smuggler" | "cutthroat" | "deserter" | "brigand" | "highwayman"
  // The human ladder, upper half: trained fighters, levels 16-40. They run
  // beside the fantastic creatures rather than under them, so the whole
  // mid-game has two parallel families instead of one.
  | "mercenary" | "corsair" | "wildWarrior" | "amazon" | "hunter"
  | "gladiator" | "barbarian" | "raider" | "warlord" | "chieftain"
  // The fantastic bestiary. Deliberately NOT Tibia's tiering: there a goblin
  // is a level-8 nuisance, here it is a level-16 monster, because a creature
  // out of myth should outclass a man with a sword rather than lose to one.
  | "skeleton" | "goblin"
  | "orc" | "minotaur"
  | "snake" | "ghoul" | "orcArcher" | "orcWarrior"
  | "minotaurArcher" | "orcShaman" | "orcBerserker"
  | "minotaurGuard" | "minotaurMage"
  // The armoured goblin rank: the camps' answer to the orc warrior.
  | "goblinLegionary"
  // Etap 18 — the undead heavies. Both are skeletons and both leave the
  // skeleton's body; the demon is the last thing short of the dragon.
  | "skeletonWarrior" | "demonSkeleton"
  // The first caster proper: it charges, breathes, and leaves the ground on
  // fire. Not a boss — a strong monster that happens to sit at the top of the
  // curve today, and will have company above it later.
  | "dragon"
  // …and here is that company. A man in black plate who fights the dragon's
  // fight with lightning instead of fire: narrower shapes, shorter cooldowns,
  // and legs fast enough to close the gap the dragon has to lumber across.
  | "blackKnight";

/** A live monster instance. */
export interface Monster {
  kind: MonsterKind;
  x: number;
  y: number;
  /** Logical tile the creature stands on (claims) — grid movement core. */
  tx: number;
  ty: number;
  spr: HTMLCanvasElement;
  hp: number;
  maxhp: number;
  speed: number;
  atkRate: number;
  atkCd: number;
  /**
   * One cooldown per entry in the creature's `spells` list, in seconds.
   *
   * Lazily created on the first cast rather than at spawn: the overwhelming
   * majority of the bestiary casts nothing, and an array of zeroes on every
   * beggar is a per-creature allocation to describe an absence. Monsters are
   * never serialised, so this needed no save migration.
   */
  spellCd?: number[];
  wanderT: number;
  bob: number;
  /** Facing, for creatures drawn from a directional walk sheet. */
  dir: MobDir;
  hurtT: number;
  /** Seconds of forced aggression left after taking a hit — the creature
   *  chases even beyond its normal sight range (LoS still required), so
   *  shooting anything always provokes it regardless of bow reach. */
  aggroT: number;
  /** True once this creature has actually noticed the player, and until it
   *  loses them again. While set, the sight test uses the wider
   *  MONSTER_AGGRO_HOLD_RANGE instead of MONSTER_AGGRO_RANGE — six tiles to
   *  spot you, eight to shake off. Runtime only; never saved. */
  engaged?: boolean;
  /** Preferred detour side (+1/-1) when the direct path to the target is
   *  body-blocked — half the pack circles left, half right, so they surround
   *  the player instead of queueing in a single line behind each other. */
  orbit: 1 | -1;
  /** Camp this creature belongs to (Deep Wildlands settlements). A slain
   *  camp dweller respawns back home instead of anywhere on the continent. */
  camp?: string;
  /** Treasure-chest guard: the chest tile it is posted on, so a slain guard
   *  respawns back beside its hoard rather than anywhere on the floor. */
  guard?: { tx: number; ty: number };
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
  /**
   * A real container's slots, not a compact list. Fixed length with holes, so
   * the loot window is a grid you can drag INTO as well as out of — which is
   * what makes a corpse usable as somewhere to stash things mid-hunt, and what
   * lets a dead player's backpack sit in their body with its contents intact.
   */
  items: Bag;
  gold: number;
  t: number; // seconds until decay
}

/** Town NPC kinds. */
export type NpcKey = "smith" | "herbalist" | "elder" | "taskmaster" | "tailor" | "timesage";

/** Facing of a townsperson — the LPC sheet's row order. */
export type NpcDir = "up" | "left" | "down" | "right";

/**
 * A town NPC. Townsfolk are grid walkers like everyone else: they stand on one
 * tile (tx,ty) and glide toward its centre. Most are rooted (`roam` 0) and
 * simply never take a step; the smith paces a small square around the spot the
 * map placed him on.
 */
export interface Npc {
  key: NpcKey;
  name: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  spr: HTMLCanvasElement;
  bob: number;
  /** The tile he was authored on — the centre of his beat. */
  hx: number;
  hy: number;
  /** The rectangle he may walk, in absolute tile coordinates (inclusive).
   *  A shopkeeper gets a 3x3 box around his home; the town sage a nine-tile
   *  line; the cellar sage a 2x2 square hanging off his corner. Equal bounds
   *  on both axes mean rooted. Kept as bounds rather than a radius because
   *  a beat is not always centred on where the map put him. */
  bx0: number;
  by0: number;
  bx1: number;
  by1: number;
  dir: NpcDir;
  /** Seconds of standing about before the next step is considered. */
  rest: number;
  /** Free-running walk clock, so two NPCs never march in lockstep. */
  phase: number;
  /** Set by the mover each tick — drives stride vs. stance. */
  moving: boolean;
  /** Seconds left of "someone is talking to me": stand still, face them. */
  talk: number;
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
  /** The tile this creature is posted to: a treasure hoard, or an authored
   *  spawn point on a hand-drawn map. Either way it respawns back here rather
   *  than anywhere on the floor. */
  guard?: { tx: number; ty: number };
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
  /** Retired as a resource in Etap 26 — still scattered, now as decor. */
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
  decos: Deco[];
  fires: Fire[];
  scenery: Scenery[];
  monsters: Monster[];
  corpses: Corpse[];
  ground: GroundItem[];
  npcs: Npc[];
  respawns: Respawn[];
  shots: Shot[];
  structures: Structure[];
  buildSpots: BuildSpot[];
  portals: Portal[];
  /** Level-sealed doorways (Bone Sanctum); toggled by applyGates(). */
  gates: LevelGate[];
  /** Themed settlements (Deep Wildlands); empty elsewhere. */
  camps: Camp[];
  coastWater: CoastWater[];
  /** Authored spawn point (world px) — the map's own start tile. Hand-drawn
   *  maps mark it with a glyph; when absent the player lands beside a portal
   *  exactly as before, so procedural islands are unaffected. */
  spawn?: Vec;
  /** Rows 0..safeMaxY are a haven inside an otherwise dangerous map: no
   *  creature may spawn there and none may step into it. Bonetown uses it —
   *  north of the fence is town, south of it is hunting ground. Absent on
   *  maps that are wholly safe or wholly hostile. */
  safeMaxY?: number;
  /** Authored creature posts: exactly where the map says a creature stands.
   *  Maps carrying these populate from them instead of scattering a roster,
   *  and each creature respawns back onto its own post. */
  mobPosts?: { kind: MonsterKind; tx: number; ty: number }[];
  /** Pre-rendered terrain (a Tiled "export as image" PNG) drawn 1:1 in place
   *  of the procedural bake. Native tile resolution, so it is sharper than
   *  `mapCanvas`, which is painted at half scale and blown up. Attached
   *  asynchronously — until the image arrives the baked canvas shows. */
  mapImage?: HTMLImageElement;
  landR: (theta: number) => number;
  mapCanvas: HTMLCanvasElement;
}
