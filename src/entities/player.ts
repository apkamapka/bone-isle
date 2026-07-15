/** The player: state, backpack, equipment and derived stats. */
import { PLAYER_BASE_HP, PLAYER_BASE_SPEED, SPEED_PER_LEVEL, PLAYER_ATTACK_RATE, expNeeded, CAP_BASE, CAP_PER_LEVEL } from "../config.ts";
import { SPR } from "../gfx/sprites.ts";
import { activeBonus } from "../systems/derived.ts";
import { emptyBag, emptyEquipment, gearStat, itemWeight, bagWeight, addItem } from "../items.ts";
import type { Bag, Equipment, ItemKind } from "../items.ts";
import type { Vec, Monster, Tree, RockNode, HerbNode, Structure, Corpse, Npc } from "../world/types.ts";

/**
 * What the player is currently auto-acting on. A discriminated union so the
 * update loop can branch safely without `any`.
 */
export type Target =
  | { kind: "mob"; m: Monster }
  | { kind: "dummy"; s: Structure }
  | { kind: "corpse"; c: Corpse }
  | { kind: "npc"; n: Npc }
  | { kind: "structure"; s: Structure };

/** Resource node the player is walking up to and harvesting. */
export type GatherTask =
  | { kind: "tree"; obj: Tree }
  | { kind: "rock"; obj: RockNode }
  | { kind: "herb"; obj: HerbNode };

export interface Player {
  x: number;
  y: number;
  spr: HTMLCanvasElement;
  hp: number;
  maxhp: number;
  gold: number;
  /** Task points — a separate currency earned from repeatable board tasks. */
  taskPoints: number;
  level: number;
  exp: number;
  expNext: number;
  atkCd: number;
  atkRate: number;
  regen: number;
  dest: Vec | null;
  target: Target | null;
  gather: GatherTask | null;
  dead: boolean;
  deadT: number;
  tpCd: number;
  bob: number;
  face: 1 | -1;
  bag: Bag;
  eq: Equipment;
}

/** Create a fresh player positioned at `spawn`. */
export function createPlayer(spawn: Vec): Player {
  const bag = emptyBag();
  // Starter crystals so the action bar is usable before the Alchemy Tower exists.
  addItem(bag, "healCrystal", 25);
  addItem(bag, "fireCrystal", 15);
  addItem(bag, "recallCrystal", 5);
  // Starter bow + arrows so ranged combat is usable before the Forge.
  addItem(bag, "bow", 1);
  addItem(bag, "arrow", 30);
  return {
    x: spawn.x,
    y: spawn.y,
    spr: SPR.player,
    hp: PLAYER_BASE_HP,
    maxhp: PLAYER_BASE_HP,
    gold: 0,
    taskPoints: 0,
    level: 1,
    exp: 0,
    expNext: expNeeded(1),
    atkCd: 0,
    atkRate: PLAYER_ATTACK_RATE,
    regen: 0,
    dest: null,
    target: null,
    gather: null,
    dead: false,
    deadT: 0,
    tpCd: 0,
    bob: 0,
    face: 1,
    bag,
    eq: emptyEquipment(),
  };
}

/** Passive bonuses to max HP from owned structures (Garden). */
export interface DerivedBonus {
  maxhp?: number;
}

/** Recompute max HP from base + level + gear + structure bonuses. */
export function refreshDerived(p: Player, bonus: DerivedBonus = activeBonus): void {
  const lvBonus = (p.level - 1) * 20;
  p.maxhp = PLAYER_BASE_HP + lvBonus + gearStat(p.eq, "maxhp") + (bonus.maxhp ?? 0);
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

/** Current weight (oz) sitting in the backpack. Worn gear does not count. */
export function carriedWeight(p: Player): number {
  return bagWeight(p.bag);
}

/** Spare carry capacity in oz (never negative for display purposes). */
export function freeCap(p: Player): number {
  return carryCap(p) - carriedWeight(p);
}

/** Whether the player can still pick up `n` of `kind` without going over cap. */
export function canCarry(p: Player, kind: ItemKind, n = 1): boolean {
  return itemWeight(kind, n) <= freeCap(p);
}
