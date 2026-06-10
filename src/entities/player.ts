/** The player: state, inventory and derived combat stats. */
import { PLAYER_BASE_HP, PLAYER_BASE_SPEED, PLAYER_ATTACK_RATE, expNeeded } from "../config.ts";
import { SPR } from "../gfx/sprites.ts";
import type { Vec } from "../world/types.ts";

/** Resource / loot counters shown in the HUD. */
export interface Inventory {
  wood: number;
  stone: number;
  bones: number;
  coins: number;
}

/**
 * What the player is currently auto-acting on. A discriminated union so the
 * update loop can branch safely without `any` — this is exactly the kind of
 * bug the strict-TS migration is meant to kill. (Concrete monster/structure
 * targets get wired in when those entities are ported.)
 */
export type Target =
  | { kind: "mob"; ref: unknown }
  | { kind: "dummy"; ref: unknown };

/** Resource node the player is walking up to and harvesting. */
export type GatherTask =
  | { kind: "tree"; ref: unknown }
  | { kind: "rock"; ref: unknown };

export interface Player {
  x: number;
  y: number;
  spr: HTMLCanvasElement;
  hp: number;
  maxhp: number;
  level: number;
  exp: number;
  expNext: number;
  atkCd: number;
  atkRate: number;
  regen: number;
  speedTrain: number;
  dest: Vec | null;
  target: Target | null;
  gather: GatherTask | null;
  dead: boolean;
  deadT: number;
  tpCd: number;
  bob: number;
  face: 1 | -1;
  inv: Inventory;
}

/** Create a fresh player positioned at `spawn`. */
export function createPlayer(spawn: Vec): Player {
  return {
    x: spawn.x,
    y: spawn.y,
    spr: SPR.player,
    hp: PLAYER_BASE_HP,
    maxhp: PLAYER_BASE_HP,
    level: 1,
    exp: 0,
    expNext: expNeeded(1),
    atkCd: 0,
    atkRate: PLAYER_ATTACK_RATE,
    regen: 0,
    speedTrain: 0,
    dest: null,
    target: null,
    gather: null,
    dead: false,
    deadT: 0,
    tpCd: 0,
    bob: 0,
    face: 1,
    inv: { wood: 0, stone: 0, bones: 0, coins: 0 },
  };
}

/** Movement speed in px/s (will scale with the Speed skill once ported). */
export function playerSpeed(_p: Player): number {
  return PLAYER_BASE_SPEED;
}
