/** The player: state, backpack, equipment and derived stats. */
import { HP_BASE, HP_PER_LEVEL, PLAYER_BASE_HP, PLAYER_BASE_SPEED, SPEED_PER_LEVEL, PLAYER_ATTACK_RATE, expNeeded, CAP_BASE, CAP_PER_LEVEL } from "../config.ts";
import { bakeOutfitSprites } from "../systems/outfit.ts";
import type { Facing, DirSprites } from "../systems/outfit.ts";
import { toTile, tileCenter } from "../world/grid.ts";
import { activeBonus } from "../systems/derived.ts";
import { ITEMS, walletValue, emptyEquipment, gearStat, itemWeight, bagWeight, addItem, newContainer, NO_BAG } from "../items.ts";
import type { Bag, Equipment, ItemKind, ItemStack } from "../items.ts";
import type { Vec, Monster, Tree, RockNode, Structure, Corpse, Npc, GroundItem } from "../world/types.ts";

/**
 * What the player is currently auto-acting on. A discriminated union so the
 * update loop can branch safely without `any`.
 */
export type Target =
  | { kind: "mob"; m: Monster }
  | { kind: "dummy"; s: Structure }
  | { kind: "corpse"; c: Corpse }
  | { kind: "npc"; n: Npc }
  | { kind: "structure"; s: Structure }
  | { kind: "ground"; gi: GroundItem };

/** Resource node the player is walking up to and harvesting. */
export type GatherTask =
  | { kind: "tree"; obj: Tree }
  | { kind: "rock"; obj: RockNode }
;

export interface Player {
  x: number;
  y: number;
  /** Logical tile the player stands on (claims) — grid movement core. */
  tx: number;
  ty: number;
  spr: HTMLCanvasElement;
  hp: number;
  maxhp: number;
  /**
   * What the coins in your backpack are worth. A READ-ONLY view, because gold
   * is no longer a number the game may adjust — it is items, with weight, that
   * live in slots and can be dropped, chested and looted off your corpse.
   * Paying is `takeGold(p.bag, n)`; being paid is `giveGold(p.bag, n)`.
   */
  readonly gold: number;
  /** Task points — a separate currency earned from repeatable board tasks. */
  taskPoints: number;
  level: number;
  exp: number;
  expNext: number;
  atkCd: number;
  /** Seconds of "fed" time left — HP regenerates only while this is > 0.
   *  Eating food banks more, capped at FED_MAX_S (Tibia's 20 minutes). */
  fedS: number;
  atkRate: number;
  regen: number;
  dest: Vec | null;
  target: Target | null;
  gather: GatherTask | null;
  /**
   * The arrow kind the player loaded into the Ammo slot, or null for "let the
   * bow decide". Kept as a kind rather than a stack: arrows stay in the bag
   * and the slot only points at them, so a pick never strands ammo somewhere
   * the weight and stack maths cannot see.
   */
  ammo: ItemKind | null;
  dead: boolean;
  deadT: number;
  tpCd: number;
  bob: number;
  face: 1 | -1;
  /** Which of the three baked views to draw. `side` is mirrored by `face`. */
  dir: Facing;
  /** The current outfit baked in all three facings. */
  sprDir: DirSprites;
  /**
   * The worn backpack, or null when you are carrying nothing to carry things
   * in. Tibia's rule: the bag is an OBJECT you wear, not a property of being
   * alive — take it off and you have nowhere to put a single coin.
   */
  pack: ItemStack | null;
  /**
   * The worn backpack's slots. A read-only view of `pack.items`, so the eighty
   * existing `p.bag` readers keep working unchanged; assigning a whole new bag
   * is deliberately a compile error, because the only honest way to change
   * what you are carrying is to change the pack.
   *
   * With no pack this is a frozen empty array: every `addItem` reports that
   * nothing fits, which is exactly right.
   */
  readonly bag: Bag;
  eq: Equipment;
}

/** Create a fresh player positioned at `spawn`. */
export function createPlayer(spawn: Vec): Player {
  // You start wearing one. A bagless level-1 character would be unable to
  // pick up the first stick of wood, which is a tutorial nobody wants.
  const pack = newContainer("backpack")!;
  const bag = pack.items!;
  const startSet = bakeOutfitSprites();
  // No crystals at all. Every one of them — even the healing kind — is now
  // something the Alchemy Tower sells you, and the action slots start bound
  // to two you cannot yet afford on purpose: the empty counts are the hint.
  // Until then a bow and a blade are the whole arsenal.
  // Starter bow + arrows so ranged combat is usable before the Forge.
  addItem(bag, "bow", 1);
  addItem(bag, "arrow", 30);
  return {
    x: tileCenter(toTile(spawn.x)),
    y: tileCenter(toTile(spawn.y)),
    tx: toTile(spawn.x),
    ty: toTile(spawn.y),
    spr: startSet.down,
    hp: PLAYER_BASE_HP,
    maxhp: PLAYER_BASE_HP,
    taskPoints: 0,
    level: 1,
    exp: 0,
    expNext: expNeeded(1),
    atkCd: 0,
    fedS: 0,
    atkRate: PLAYER_ATTACK_RATE,
    regen: 0,
    dest: null,
    target: null,
    gather: null,
    ammo: null,
    dead: false,
    deadT: 0,
    tpCd: 0,
    bob: 0,
    face: 1,
    dir: "down",
    sprDir: startSet,
    pack,
    get bag(): Bag { return this.pack?.items ?? NO_BAG; },
    get gold(): number { return walletValue(this.bag); },
    eq: emptyEquipment(),
  };
}

/** Passive bonuses to max HP from owned structures (Garden). */
export interface DerivedBonus {
  maxhp?: number;
}

/**
 * Recompute max HP: HP_BASE + HP_PER_LEVEL · level, plus gear and structures.
 * The knight curve — one character class that has to stand in melee — so a
 * level 25 character sits at 455 rather than the old 580. That 22% cut is
 * deliberate: an overstuffed HP pool makes fights drag, which quietly makes
 * armor and shielding irrelevant and leaves healing throughput as the only
 * statistic that decides anything.
 */
export function refreshDerived(p: Player, bonus: DerivedBonus = activeBonus): void {
  p.maxhp = HP_BASE + HP_PER_LEVEL * p.level + gearStat(p.eq, "maxhp") + (bonus.maxhp ?? 0);
  if (p.hp > p.maxhp) p.hp = p.maxhp;
}

/** Movement speed in px/s: base + character level (Tibia 8.6 style) + boots. */
export function playerSpeed(p: Player): number {
  return PLAYER_BASE_SPEED + (p.level - 1) * SPEED_PER_LEVEL + gearStat(p.eq, "speed");
}

/** Maximum weight (oz) the player can carry in the backpack. Grows with level. */
export function carryCap(p: Player): number {
  return CAP_BASE + (p.level - 1) * CAP_PER_LEVEL;
}

/**
 * Current weight (oz) the player is hauling. Worn gear does not count — but
 * the backpack does, both its own 18 oz and everything nested inside it,
 * which is the only brake on stuffing packs inside packs forever.
 */
export function carriedWeight(p: Player): number {
  return p.pack ? ITEMS[p.pack.kind].weight + bagWeight(p.bag) : 0;
}

/** Spare carry capacity in oz (never negative for display purposes). */
export function freeCap(p: Player): number {
  return carryCap(p) - carriedWeight(p);
}

/** Whether the player can still pick up `n` of `kind` without going over cap. */
export function canCarry(p: Player, kind: ItemKind, n = 1): boolean {
  return itemWeight(kind, n) <= freeCap(p);
}
