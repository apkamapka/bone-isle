/** Game-wide constants. One place to tune the whole prototype. */

/** Tile size in internal (low-res) pixels. */
export const TILE = 16;

/** Map dimensions in tiles. */
export const MAP_W = 44;
export const MAP_H = 32;

/** Internal viewport resolution (scaled up with pixelated rendering). */
export const VIEW_W = 480;
export const VIEW_H = 320;

/** Island center in tile coordinates. */
export const CENTER_X = MAP_W / 2;
export const CENTER_Y = MAP_H / 2;

/** Player balance. */
export const PLAYER_BASE_SPEED = 58;
export const PLAYER_ATTACK_RATE = 0.7;
export const PLAYER_BASE_HP = 100;

/** Monster respawn delay on the Wild Isle (seconds). */
export const MONSTER_RESPAWN_S = 10;

/** Resource node regrowth (seconds). */
export const TREE_REGROW_S = 30;
export const ROCK_REGROW_S = 40;

export function expNeeded(level: number): number {
  return 40 + level * 40 + level * level * 10;
}
