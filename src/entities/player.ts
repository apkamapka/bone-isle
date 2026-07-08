/** The player: state, mana, backpack, equipment and derived stats. */
import { PLAYER_BASE_HP, PLAYER_BASE_MANA, PLAYER_BASE_SPEED, PLAYER_ATTACK_RATE, expNeeded } from "../config.ts";
import { SPR } from "../gfx/sprites.ts";
import { moveSpeedBonus } from "../systems/skills.ts";
import { emptyBag, emptyEquipment, gearStat } from "../items.ts";
import type { Bag, Equipment } from "../items.ts";
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
  mana: number;
  maxmana: number;
  gold: number;
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
  return {
    x: spawn.x,
    y: spawn.y,
    spr: SPR.player,
    hp: PLAYER_BASE_HP,
    maxhp: PLAYER_BASE_HP,
    mana: PLAYER_BASE_MANA,
    maxmana: PLAYER_BASE_MANA,
    gold: 0,
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
    bag: emptyBag(),
    eq: emptyEquipment(),
  };
}

/** Recompute max HP/mana from base + level + gear (call after (un)equip). */
export function refreshDerived(p: Player): void {
  const lvBonus = (p.level - 1) * 20;
  p.maxhp = PLAYER_BASE_HP + lvBonus + gearStat(p.eq, "maxhp");
  p.maxmana = PLAYER_BASE_MANA + (p.level - 1) * 5 + gearStat(p.eq, "maxmana");
  if (p.hp > p.maxhp) p.hp = p.maxhp;
  if (p.mana > p.maxmana) p.mana = p.maxmana;
}

/** Movement speed in px/s, including Speed skill + boots. */
export function playerSpeed(p: Player): number {
  return PLAYER_BASE_SPEED + moveSpeedBonus() + gearStat(p.eq, "speed");
}
