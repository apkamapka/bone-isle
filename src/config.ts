/** Game-wide constants. One place to tune the whole prototype. */

/** Tile size in internal (low-res) pixels. */
export const TILE = 16;

/** Internal viewport resolution (scaled up with pixelated rendering). */
export const VIEW_W = 480;
export const VIEW_H = 320;

/** Player balance. */
export const PLAYER_BASE_SPEED = 58;
export const PLAYER_ATTACK_RATE = 0.7;
export const PLAYER_BASE_HP = 100;
export const PLAYER_BASE_MANA = 50;
export const MANA_REGEN_PER_S = 1.6;

/** Backpack capacity (slots). */
export const BAG_SIZE = 16;

/** Monster respawn delay on the Wildlands (seconds). */
export const MONSTER_RESPAWN_S = 12;

/** How long a lootable corpse stays on the ground (seconds). */
export const CORPSE_DECAY_S = 75;

/** Resource node regrowth (seconds). */
export const TREE_REGROW_S = 30;
export const ROCK_REGROW_S = 40;
export const HERB_REGROW_S = 45;

/** Garden aura: heal radius (px) and HP/mana per second while standing near. */
export const GARDEN_RADIUS = 40;
export const GARDEN_HEAL_PER_S = 3;
export const GARDEN_MANA_PER_S = 2.2;

/** Passive max-stat bonuses granted while you own a structure on Home Isle. */
export const LIBRARY_MANA_BONUS = 30; // +max mana per Library owned
export const GARDEN_HP_BONUS = 15;    // +max HP per Garden owned

/** Recall spell: mana cost to teleport back to Home Isle (Library-gated). */
export const RECALL_COST = 20;

/** Chest storage capacity (slots). */
export const STASH_SIZE = 20;

export function expNeeded(level: number): number {
  return 40 + level * 40 + level * level * 10;
}
