/** Game-wide constants. One place to tune the whole prototype. */

/** Tile size in internal (low-res) pixels. Doubled from 16 in Etap 17: a tile
 *  now carries four times the pixel budget, which is what lets a hero sprite
 *  be 32x48 instead of 12x16. */
export const TILE = 32;

/**
 * The tile size every existing pixel map, terrain painter and structure baker
 * was authored against. Nothing was redrawn for TILE=32 — legacy art is baked
 * once at this resolution and blown up SPRITE_SCALE times with nearest-
 * neighbour, so the game looks pixel-for-pixel identical to the 16-px era.
 * Native 32-px maps arrive sprite by sprite in later stages.
 */
export const LEGACY_TILE = 16;

/** Nearest-neighbour magnification applied to legacy art. */
export const SPRITE_SCALE = TILE / LEGACY_TILE;

/**
 * Resolution (px per tile) of the static terrain canvas. It deliberately stays
 * at legacy scale and is blitted SPRITE_SCALE times bigger every frame: the
 * 368x272-tile continent already bakes to a ~5900x4350 bitmap, and painting it
 * at TILE would need four times that (~100 Mpx) — an allocation phones refuse.
 * Keeping it small also means the per-frame blit reads a quarter of the pixels.
 */
export const MAP_TILE = TILE / SPRITE_SCALE;

/**
 * Bake magnification for ACTORS — monsters, townsfolk, corpses — as opposed to
 * props and icons, which stay at SPRITE_SCALE. The hand-drawn hero is 64-px
 * LPC art standing about 1.6 tiles tall; creatures baked at 2x barely fill a
 * tile and read as dolls beside him. Bumping them one step closes most of the
 * gap without making them as blocky as a 4x bake would.
 *
 * Temporary scaffolding: as each creature gets its own native 32-px artwork it
 * moves to bakeNative() and drops off the ACTORS list in sprites.ts.
 */
export const ACTOR_SCALE = 3;

/**
 * The one canonical world seed. Terrain generation is fully deterministic, so a
 * fixed seed means every device — and every future online player — sees the
 * exact same islands. When multiplayer arrives, a server can hand out its own
 * seed instead; the generation code needs no changes.
 */
export const WORLD_SEED = 20260713;

/**
 * CSS pixels per internal world pixel — the zoom. Larger means closer in and
 * chunkier, and directly sets how much of the island is on screen:
 * visible tiles = viewport / (f * TILE).
 *
 * Both divisors doubled with TILE (Etap 17). A world pixel is half a tile-width
 * of what it used to be, so the zoom factor must halve for the framing to stay
 * put — and the clamps halve with it (desktop 4..6.4 became 2..3.2, mobile
 * 2..6 became 1..3). Desktop stays near 23 x 11 tiles, phones keep exactly the
 * framing they had.
 *
 * Mobile rounds in HALF steps, not whole ones. A plain round() at the doubled
 * divisor is not the old value halved: a 768-px tablet used to land on f=3
 * (768/220 -> 3) and would now land on round(768/440) = 2, quietly showing a
 * third more world. round(lo / MOBILE_ZOOM_DIV * 2) / 2 is exactly the old
 * factor divided by two for every viewport. Half steps stay perfectly crisp
 * because legacy art is baked SPRITE_SCALE times chunkier: one art pixel is
 * two world pixels, so f=2.5 is still a whole number of screen pixels per
 * pixel of artwork.
 */
export const DESKTOP_ZOOM_DIV = 360;
export const MOBILE_ZOOM_DIV = 440;

export function worldZoom(cw: number, ch: number, mobile: boolean): number {
  const lo = Math.min(cw, ch);
  const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  return mobile
    ? cl(Math.round((lo / MOBILE_ZOOM_DIV) * 2) / 2, 1, 3)
    : cl(lo / DESKTOP_ZOOM_DIV, 2, 3.2);
}

/** Floor on the internal render buffer (world px). Ten by seven-and-a-half
 *  tiles — the same slice of world the old 160x120 floor guaranteed. */
export const MIN_VIEW_W = 10 * TILE;
export const MIN_VIEW_H = 7.5 * TILE;

/** How many tiles fit across a viewport at the given zoom — the number that
 *  actually matters when judging framing. */
export function visibleTiles(cw: number, ch: number, mobile: boolean): { w: number; h: number } {
  const f = worldZoom(cw, ch, mobile);
  return {
    w: Math.max(MIN_VIEW_W, Math.ceil(cw / f)) / TILE,
    h: Math.max(MIN_VIEW_H, Math.ceil(ch / f)) / TILE,
  };
}

export const VIEW_W = 30 * TILE;
export const VIEW_H = 20 * TILE;

/** Player balance. */
export const PLAYER_BASE_SPEED = 116;
/**
 * Movement speed gained per character level above 1 (px/s). Tibia 8.6 has no
 * Speed skill — haste comes from the character level itself (+2 speed/level on
 * a 220 base, ~0.9%). Scaled to our 116 px/s base that's ~1 px/s per level,
 * so a level-50 character moves ~42% faster, matching the 8.6 curve.
 */
export const SPEED_PER_LEVEL = 1;

/**
 * Food & regeneration, Tibia 8.6 style: eating banks "fed" seconds and HP only
 * regenerates while fed. The bank caps at 20 minutes — trying to eat past it
 * refuses with "You are full" (exactly the classic rule), so food can't be
 * hoarded into an infinite buffer.
 */
export const FED_MAX_S = 1200;
export const FED_HP_PER_S = 1;
/**
 * One swing/shot every 2 seconds — the standard weapon speed of Tibia 8.6.
 * Monsters attack at the same cadence (see MONSTER_DEFS), so a duel is
 * blow-for-blow instead of the player attacking three times per monster hit.
 */
export const PLAYER_ATTACK_RATE = 2.0;

/**
 * Distance-weapon accuracy, Tibia-style: every shot first rolls to hit.
 * Chance = BASE + (Distance skill − 10) · PER, capped at MAX (bows in Tibia
 * top out at 90% and only around skill ~70+). A miss still spends the arrow
 * and still trains the skill — but a HIT trains it double, as in Tibia.
 */
export const DIST_HITCHANCE_BASE = 0.60;
export const DIST_HITCHANCE_PER = 0.005;
export const DIST_HITCHANCE_MAX = 0.90;
/**
 * Health, on Tibia's knight curve plus a small starting cushion:
 *   maxHP = HP_BASE + HP_PER_LEVEL · level      (level 1 = 95, level 25 = 455)
 * The knight curve is the right model because there is one character class and
 * it has to stand in melee — a paladin's 10/level would leave the archer
 * playable and the swordsman not. HP_PER_LEVEL is the single dial for how long
 * fights run: raise it and defense stops mattering, because you survive either
 * way and only healing throughput counts.
 */
export const HP_BASE = 80;
export const HP_PER_LEVEL = 15;
export const PLAYER_BASE_HP = HP_BASE + HP_PER_LEVEL; // level 1

/** Backpack capacity (slots). */
export const BAG_SIZE = 16;

/** Monster respawn delay on the Wildlands (seconds). */
export const MONSTER_RESPAWN_S = 12;

/**
 * Crowd multiplier for the undergrounds (every dangerous floor except the
 * surface Wildlands). The cave/lair floors are large and were reading as empty
 * between packs, so their per-kind spawn counts are scaled up by this factor;
 * because each kill schedules exactly one same-kind respawn, this raises the
 * steady-state population too, not just the opening one. Bosses (the dragon)
 * are exempt so a lair still nests exactly one. Tune here after playtests.
 */
export const CAVE_CROWD_MULT = 2.2;

/**
 * Guaranteed underground density (Etap 13). The per-floor rosters above are
 * hand-authored, but floor SIZES vary enormously (the Roost's heart is ~2400
 * walkable tiles against a 6-creature roster), so several floors still read as
 * half-empty however high the multiplier goes. After the roster is placed, a
 * floor holding fewer than one creature per this many walkable tiles is topped
 * up from its OWN roster — the thematic mix is preserved, only the count
 * rises — until it clears the bar. This is what removes the dead zones; raise
 * the number for sparser caves, lower it for a wall-to-wall meat grinder.
 * Bosses (the dragon) are never used as filler.
 */
export const CAVE_TILES_PER_MONSTER = 34;

/**
 * Master monster switch. When `false`, no creatures are placed on the map and
 * none respawn — the world is walkable and peaceful for free exploration. The
 * whole combat/AI/respawn machinery stays intact; flip back to `true` to bring
 * the bestiary straight back with no other changes.
 */
export const MONSTERS_ENABLED = true;

/**
 * Body blocking (Tibia's "one creature per square", adapted to free pixel
 * movement): no two creatures — player included — may come closer than this
 * many pixels centre-to-centre. Creatures physically block each other and the
 * player, so only ~6 melee bodies fit around you, narrow cave corridors are
 * real chokepoints, and getting cornered is genuinely dangerous.
 */
/** Melee/interaction reach in px: covers the 8 adjacent tile centres
 *  (diagonal ≈ 45.3px) but never a tile two squares away (64px). */
export const MELEE_REACH_PX = 48;

/**
 * Shielding cap, straight from Tibia: your shield blocks at most this many
 * attackers per combat round (window below) — hits from any further attackers
 * bypass the shield entirely and are reduced by worn armor only. This is what
 * makes a swarm dangerous no matter how high your Shielding skill is.
 */
export const SHIELD_BLOCK_MAX = 2;
export const SHIELD_BLOCK_WINDOW_S = 2;

/**
 * Spawn placement quality. SPAWN_SPACING_PX keeps freshly placed monsters
 * spread out instead of starting the world in pre-formed blobs (with body
 * blocking a blob instantly becomes a deadly surround). SPAWN_AVOID_PLAYER_PX
 * is Tibia's "creatures don't spawn on screen": a respawn never pops within
 * this radius of the player — if the area is camped, it retries a bit later.
 */
export const SPAWN_SPACING_PX = 56;
export const SPAWN_AVOID_PLAYER_PX = 240;
export const RESPAWN_RETRY_S = 3;

/**
 * Wildlands difficulty gradient. Monsters spawn biased by how far they are from
 * the entrance portal (0 = the coast you arrive on, 1 = the farthest reaches),
 * so the weakest creatures ring the entrance and the deadliest lurk in the far
 * corners — Rookgaard-style discovery. No monster spawns within this radius of
 * the entrance, so arriving is never an instant ambush.
 */
export const WILD_ENTRANCE_SAFE_PX = 192;

/** How long a lootable corpse stays on the ground (seconds). */
export const CORPSE_DECAY_S = 75;

/**
 * How close (px) the player must stay to keep using an opened interaction
 * panel (Forge, Alchemy Tower, Storage Chest, NPC shop, task board, corpse
 * loot). Walking further away auto-closes the panel, Tibia-style — otherwise
 * an open chest window would allow remote deposits from anywhere, which would
 * defeat the whole carry-capacity / multi-trip design.
 */
export const USE_RANGE_PX = 112;

/**
 * Townsfolk pacing, Tibia-style. NPCs in the original shuffle: one square,
 * a long pause, another square. They are not going anywhere and must never
 * look like they are fleeing you, so the speed is roughly a third of a level-1
 * player (116 px/s) — about one tile per second — and the pause between steps
 * is long and randomised so no two of them fall into a rhythm.
 */
export const NPC_WALK_SPEED = 34;
export const NPC_REST_MIN_S = 1.4;
export const NPC_REST_MAX_S = 4.2;

/**
 * How long a townsperson keeps standing still after being spoken to. Refreshed
 * every frame while the conversation is live (target held or the shop / task /
 * wardrobe window open), so this only governs the grace period AFTER it ends:
 * long enough that the NPC does not bolt the instant you close the window.
 */
export const NPC_TALK_HOLD_S = 2.5;

/**
 * Teleport pad colours. A live pad breathes violet; a dormant one — a pad whose
 * destination has not been built yet — burns red, so "you cannot go there yet"
 * reads from across the hall without walking onto it. The halo is an "r,g,b"
 * triplet because the swirl fades it through several alphas.
 */
export const PORTAL_LIVE_HALO = "150,110,230";
export const PORTAL_LIVE_CORE = "#c9a6ff";
export const PORTAL_DORMANT_HALO = "214,66,58";
export const PORTAL_DORMANT_CORE = "#e0574c";

/** Resource node regrowth (seconds). Slow enough that you rotate between
 *  nodes and islands rather than farming one spot — paired with denser nodes. */
export const TREE_REGROW_S = 90;
export const ROCK_REGROW_S = 120;
export const HERB_REGROW_S = 75;

/** Garden aura: heal radius (px) and HP per second while standing near. */
export const GARDEN_RADIUS = 80;
export const GARDEN_HEAL_PER_S = 3;

/** Passive max-HP bonus granted while you own a Garden on Home Isle. */
export const GARDEN_HP_BONUS = 15;

/** Crystals (charge-based, replace spells). Values are per single charge. */
export const HEAL_CRYSTAL_BASE = 30;    // HP healed = base + level*3
export const FIRE_CRYSTAL_DMG = 18;     // damage = this + level
export const FIRE_CRYSTAL_RANGE = 240;  // px the fire crystal can reach
export const SPEAR_CRYSTAL_DMG = 40;    // Spear Crystal (tower-researched) = this + level*2
export const SPEAR_CRYSTAL_RANGE = 320; // longer reach than a Fire Crystal
/** Shared cooldown for OFFENSIVE crystals (Fire, Spear) — they were spammable
 *  into a machine-gun burst; one bolt per this many seconds now. */
export const CRYSTAL_COOLDOWN_S = 1.5;

/**
 * Ranged combat. A bow is a two-handed weapon (locks out the shield) that
 * fires arrows — real ammo consumed one per shot. A shot's damage is the
 * combined attack value (bow power + arrow) scaled by a factor that grows with
 * Distance Fighting, so early bows are weak and the skill grind is what makes
 * them hit hard (Tibia-style). See distancePower() in skills.ts.
 */
// Distance shares the melee pipeline (skillTerm · levelFactor · mastery ·
// stance) with a slightly hotter per-point term, SKILL_TERM_PER_DIST — see the
// COMBAT MODEL block below. The bow's own balancing act is its accuracy roll
// plus the fact that it is two-handed, so an archer carries no shield.
export const ARROW_MISS_WARN_S = 1.2;   // throttle for the "no arrows" nag
export const SHOT_SPEED = 1040;          // px/s the drawn arrow travels

/**
 * Melee mirrors ranged: the weapon's attack value (bare fists + gear Attack) is
 * scaled by a factor that climbs with Sword Fighting. Because the whole attack
 * value is multiplied, a better weapon pulls further ahead as your skill grows
 * (Tibia-style) instead of just adding a flat few points.
 */
export const MELEE_FIST_ATK = 7;        // unarmed attack value (fists)

/* ------------------------------------------------------------------ *
 *  COMBAT MODEL — every knob of the damage/defense pipeline
 *
 *  maxHit = attackValue · skillTerm · levelFactor · mastery · stanceAtk
 *  minHit = MIN_HIT_RATIO · maxHit
 *
 *  skillTerm   = SKILL_TERM_PER · skill + SKILL_TERM_FLAT
 *  levelFactor = 1 + level / LEVEL_DIVISOR      (level is a MULTIPLIER, not a
 *                bonus — this is what guarantees a level-30 character out-hits
 *                a level-8 one even when the low level trained harder)
 *  mastery     = 1 + (thisSkill − highest OTHER weapon skill) / MASTERY_DIVISOR
 *
 *  Tuning order, most to least safe: MASTERY_DIVISOR → SHIELD_SKILL_FACTOR →
 *  HP_PER_LEVEL → attack rate. Touch the skill curve (skills.ts `factor`) last:
 *  it rebuilds the whole progression and breaks build parity.
 * ------------------------------------------------------------------ */

/** Damage roll floor as a fraction of max. 0 = the old "poof" whiff on every
 *  swing; 0.40 is Tibia's melee band and makes the average hit 0.70 · max. */
export const MIN_HIT_RATIO = 0.40;

/** skillTerm: a linear ramp on the weapon skill. At skill 10 it is ~1.2, at
 *  100 it is ~8.8 — so training is worth ~7× while gear is worth ~3×. */
export const SKILL_TERM_PER = 0.085;    // melee, per point of Sword Fighting
export const SKILL_TERM_PER_DIST = 0.09; // distance runs slightly hotter
export const SKILL_TERM_FLAT = 1 / 3;

/** Character level as a damage multiplier: 1 level ≈ +1% damage, so 10 points
 *  of skill trade against roughly 15 levels. Deliberate departure from Tibia
 *  (which only adds level/5) — it is the hard guarantee that a low-level
 *  character with a bought-up skill cannot out-damage a high-level one. */
export const LEVEL_DIVISOR = 100;

/** Specialisation bonus, standing in for Tibia's vocations: the gap between
 *  the skill you are using and your best OTHER weapon skill. A pure swordsman
 *  at 60/10 gains +8%; a 50/50 hybrid gains nothing. Shielding is deliberately
 *  NOT counted — sword and bow exclude each other in the moment, a shield does
 *  not, so taxing Shielding would turn defense into a trap. Raise the divisor
 *  to be kinder to hybrids (900 ≈ half the penalty). */
export const MASTERY_DIVISOR = 600;

/** Attack stance multipliers. Offensive/balanced/defensive, straight from
 *  Tibia's fight modes: what you give up in damage you get back in blocking. */
export const STANCE_ATK = { offensive: 1.0, balanced: 5 / 6, defensive: 0.5 } as const;
export const STANCE_DEF = { offensive: 1.0, balanced: 1.2, defensive: 2.0 } as const;

/** Armor: flat but random reduction, from half the rating to all of it (avg
 *  0.75×). Flat reduction shreds many small hits and barely dents one big one
 *  — that asymmetry is the quiet backbone of the whole balance. */
export const ARMOR_MIN_RATIO = 0.5;

/** Shield block ceiling: (SHIELD_SKILL_FACTOR · Shielding + SHIELD_FLAT_FACTOR)
 *  · the defense of what is in your hands · stance. The actual block is rolled
 *  triangular over 0..ceiling, so defense is steady rather than a lottery.
 *  SHIELD_SKILL_FACTOR is the main attack↔defense dial of the game. */
export const SHIELD_SKILL_FACTOR = 0.020;
export const SHIELD_FLAT_FACTOR = 0.1;

/** Hard ceiling on how much of one hit armor + shield may erase. Without it a
 *  well-geared character becomes literally untouchable by weaker attackers;
 *  as a PERCENTAGE it also guarantees that big hits always land for something. */
export const DEFENSE_CAP_FRAC = 0.5;

/** Damage that always gets through, no matter the defense. */
export const MIN_DAMAGE = 1;

/* ------------------------------------------------------------------ *
 *  GEAR LADDER — the design curve the item table has to track
 *
 *  Gear is a multiplier on training, never a substitute for it. Between
 *  level 1 and 60 the best weapon roughly triples while skillTerm grows
 *  four and a half times and levelFactor adds another 60% on top, so
 *  equipment accounts for well under a third of a character's growth. The
 *  moment that stops being true, players stop training and start shopping,
 *  and the whole skill curve becomes decoration.
 *
 *  The plateau matters as much as the slope: past the cap there is simply
 *  nothing better to buy, and every further point of power has to be
 *  trained. These functions are the design targets, checked against the
 *  real item table in the smoke tests rather than read by the game.
 * ------------------------------------------------------------------ */

/** Best attack VALUE available at a level — fists included, so compare it
 *  against MELEE_FIST_ATK + the weapon's gear Attack, not the weapon alone. */
export function bestWeaponAtk(level: number): number {
  return Math.min(50, 12 + 0.45 * level);
}

/** Best shield Defense available at a level. Unlike the weapon curve this one
 *  bends: defense climbs briskly to level 25, then flattens out, so the early
 *  game is where a shield upgrade is genuinely felt. */
export function bestShieldDef(level: number): number {
  const raw = level <= 25 ? 8 + 0.583 * (level - 1) : 22 + 0.307 * (level - 25);
  return Math.min(45, raw);
}

/** Best TOTAL armor rating of a full worn set (head + body + legs + boots).
 *  Same two-part shape as the shield, five points lower at the start — a
 *  beginner finds a shield before a matched set of plate. */
export function bestArmorSet(level: number): number {
  const raw = level <= 25 ? 5 + 0.71 * (level - 1) : 22 + 0.31 * (level - 25);
  return Math.min(45, raw);
}

/** Dropped items linger on the ground this long (seconds) before vanishing. */
export const GROUND_DESPAWN_S = 3600;

/**
 * How far (px) an item can be thrown from the backpack onto the ground —
 * about 7½ tiles, roughly the Tibia feel of tossing loot across the screen.
 * Throws also require line of sight and a walkable landing tile; an illegal
 * target slides back along the throw line toward the player until legal.
 */
export const THROW_RANGE_PX = 240;

/**
 * How close (px) the player must STAND to a loose ground item to grab it —
 * push it to another tile or drag it into the bag. One diagonal tile
 * (√2·16 ≈ 23), the Tibia adjacency rule: you can throw far, but you can't
 * manipulate loot from across the room ("You are too far away").
 */
export const ITEM_MOVE_REACH_PX = 48;

/**
 * Monster sight range. Deliberately one tile MORE than the longest bow in the
 * game (every bow now reaches 5 tiles / 160 px), so no bow can shoot from
 * outside every creature's awareness — archers can still kite, but never plink
 * at a target that won't react. If a longer weapon is ever added, bump this
 * with it (the aggro-on-hit timer below is the safety net if it's forgotten).
 */
export const MONSTER_AGGRO_RANGE = 6 * TILE;
/**
 * After taking a hit a monster stays aggressive for this many seconds even
 * beyond its sight range (line of sight still required) — shooting something
 * always makes it come for you, Tibia-style, regardless of bow reach.
 */
export const MONSTER_AGGRO_HIT_S = 6;

/** Chest storage capacity (slots) — PER CHEST. Every Storage Chest built on
 *  Home Isle carries its own independent inventory (Etap 11); building more
 *  chests means more total storage, not a second window onto the same one. */
export const STASH_SIZE = 50;

/**
 * Carried backpacks (Etap 11): each Backpack item in your bag adds this many
 * extra bag slots, up to PACK_MAX packs. Dropping/selling/stashing a pack
 * shrinks the bag again — anything sitting in the lost slots spills to the
 * ground at your feet (Tibia would drop the container with its contents).
 */
export const PACK_BONUS_SLOTS = 8;
export const PACK_MAX = 2;

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

/**
 * Animated sea for image-based terrain (a Tiled export is a still picture, so
 * the swell is painted over it). Glints are short bright dashes that drift
 * across a water tile and fade in and out; each tile takes its phase from its
 * own coordinates, so the surface never pulses in unison. Only a fraction of
 * tiles glint at a time — a dash on every square reads as static noise.
 */
export const WATER_GLINT_COLOR = "#cfeef4";
export const WATER_GLINT_PCT = 26;    // % of water tiles carrying a glint
export const WATER_GLINT_ALPHA = 0.5; // peak opacity
export const WATER_GLINT_DRIFT = 6;   // px per second the dash slides
export const WATER_GLINT_LEN = 5;     // dash length in px
