/** Game-wide constants. One place to tune the whole prototype. */

/** Tile size in internal (low-res) pixels. */
export const TILE = 16;

/**
 * The one canonical world seed. Terrain generation is fully deterministic, so a
 * fixed seed means every device — and every future online player — sees the
 * exact same islands. When multiplayer arrives, a server can hand out its own
 * seed instead; the generation code needs no changes.
 */
export const WORLD_SEED = 20260713;

/** Internal viewport resolution (scaled up with pixelated rendering). */
export const VIEW_W = 480;
export const VIEW_H = 320;

/** Player balance. */
export const PLAYER_BASE_SPEED = 58;
export const PLAYER_ATTACK_RATE = 0.7;
export const PLAYER_BASE_HP = 100;

/** Backpack capacity (slots). */
export const BAG_SIZE = 16;

/** Monster respawn delay on the Wildlands (seconds). */
export const MONSTER_RESPAWN_S = 12;

/**
 * Master monster switch. When `false`, no creatures are placed on the map and
 * none respawn — the world is walkable and peaceful for free exploration. The
 * whole combat/AI/respawn machinery stays intact; flip back to `true` to bring
 * the bestiary straight back with no other changes.
 */
export const MONSTERS_ENABLED = false;

/**
 * Wildlands difficulty gradient. Monsters spawn biased by how far they are from
 * the entrance portal (0 = the coast you arrive on, 1 = the farthest reaches),
 * so the weakest creatures ring the entrance and the deadliest lurk in the far
 * corners — Rookgaard-style discovery. No monster spawns within this radius of
 * the entrance, so arriving is never an instant ambush.
 */
export const WILD_ENTRANCE_SAFE_PX = 96;

/** How long a lootable corpse stays on the ground (seconds). */
export const CORPSE_DECAY_S = 75;

/**
 * How close (px) the player must stay to keep using an opened interaction
 * panel (Forge, Alchemy Tower, Storage Chest, NPC shop, task board, corpse
 * loot). Walking further away auto-closes the panel, Tibia-style — otherwise
 * an open chest window would allow remote deposits from anywhere, which would
 * defeat the whole carry-capacity / multi-trip design.
 */
export const USE_RANGE_PX = 56;

/** Resource node regrowth (seconds). Slow enough that you rotate between
 *  nodes and islands rather than farming one spot — paired with denser nodes. */
export const TREE_REGROW_S = 90;
export const ROCK_REGROW_S = 120;
export const HERB_REGROW_S = 75;

/** Garden aura: heal radius (px) and HP per second while standing near. */
export const GARDEN_RADIUS = 40;
export const GARDEN_HEAL_PER_S = 3;

/** Passive max-HP bonus granted while you own a Garden on Home Isle. */
export const GARDEN_HP_BONUS = 15;

/** Crystals (charge-based, replace spells). Values are per single charge. */
export const HEAL_CRYSTAL_BASE = 30;    // HP healed = base + level*3
export const FIRE_CRYSTAL_DMG = 18;     // damage = this + level
export const FIRE_CRYSTAL_RANGE = 120;  // px the fire crystal can reach
export const SPEAR_CRYSTAL_DMG = 40;    // Spear Crystal (tower-researched) = this + level*2
export const SPEAR_CRYSTAL_RANGE = 160; // longer reach than a Fire Crystal

/**
 * Ranged combat. A bow is a two-handed weapon (locks out the shield) that
 * fires arrows — real ammo consumed one per shot. A shot's damage is the
 * combined attack value (bow power + arrow) scaled by a factor that grows with
 * Distance Fighting, so early bows are weak and the skill grind is what makes
 * them hit hard (Tibia-style). See distancePower() in skills.ts.
 */
export const DIST_FACTOR_BASE = 0.30;   // multiplier at skill 10 (start)
export const DIST_FACTOR_PER = 0.025;   // + this per Distance level above 10
export const DIST_LEVEL_BONUS = 0.25;   // small flat + level * this
export const ARROW_MISS_WARN_S = 1.2;   // throttle for the "no arrows" nag
export const SHOT_SPEED = 520;          // px/s the drawn arrow travels

/**
 * Melee mirrors ranged: the weapon's attack value (bare fists + gear Attack) is
 * scaled by a factor that climbs with Sword Fighting. Because the whole attack
 * value is multiplied, a better weapon pulls further ahead as your skill grows
 * (Tibia-style) instead of just adding a flat few points.
 */
export const MELEE_FIST_ATK = 7;        // unarmed attack value (fists)
export const MELEE_FACTOR_BASE = 0.9;   // multiplier at Sword level 10
export const MELEE_FACTOR_PER = 0.09;   // + this per Sword level above 10
export const MELEE_LEVEL_BONUS = 0.5;   // + level * this (rounded down)

/** Dropped items linger on the ground this long (seconds) before vanishing. */
export const GROUND_DESPAWN_S = 3600;

/** Chest storage capacity (slots). */
export const STASH_SIZE = 20;

/** Carry capacity (weight in oz). Grows with level, gates the backpack. */
export const CAP_BASE = 500;
export const CAP_PER_LEVEL = 12;

/**
 * Experience to advance from `level` to `level + 1`, using Tibia's classic
 * curve. Total exp to reach L is (50/3)(L³ − 6L² + 17L − 12); the per-level
 * step simplifies to the integer form below (= 100 for 1→2, 1600 for 7→8…).
 * Cubic growth means high levels take a very long time — no level 100 in a week.
 */
export function expNeeded(level: number): number {
  const x = level + 1;
  return 50 * (x * x - 5 * x + 8);
}

/** Total experience required to *reach* `level` (Tibia's cubic curve). The
 *  cubic is always divisible by 3 for integer levels; round kills float dust. */
export function totalExpFor(level: number): number {
  return Math.round((50 / 3) * (level ** 3 - 6 * level ** 2 + 17 * level - 12));
}

/**
 * Death penalty (Tibia 8.6-style), active from this level up. Below it a death
 * only costs a sliver of current-level progress. From this level on you drop
 * your whole backpack (lootable from your body where you fell), each equipped
 * piece has a chance to drop too, and you lose experience (can de-level) and
 * skill progress. An equipped Amulet of Loss is consumed instead and protects
 * ONLY the items — never the experience or skills.
 */
export const DEATH_PENALTY_LEVEL = 10;
export const DEATH_EXP_LOSS = 0.10;      // fraction of TOTAL exp lost
export const DEATH_SKILL_LOSS = 0.10;    // fraction of current skill tries lost
export const DEATH_EQ_DROP_CHANCE = 0.10; // per equipped piece
export const PLAYER_CORPSE_DECAY_S = 300; // your dropped body waits this long
