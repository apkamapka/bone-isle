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
export const PLAYER_BASE_SPEED = 93;
/**
 * Movement speed gained per character level above 1 (px/s). Tibia 8.6 has no
 * Speed skill — haste comes from the character level itself (+2 speed/level on
 * a 220 base, ~0.9%). Scaled to our base that's ~0.8 px/s per level, so a
 * level-50 character moves ~42% faster, matching the 8.6 curve.
 *
 * Both numbers came down 20% in Etap 30, together with a 15% cut across every
 * creature in MONSTER_DEFS. The measurement behind it: converted to tiles per
 * second, Tibia's own creatures move at roughly speed/100 on normal ground —
 * an orc 0.75, a minotaur 0.84, a dragon 0.86 — against a level-1 player's
 * 2.20. Bone Isle was running the whole clock about twice as fast as that,
 * which is why a fight covered seven tiles per swing where Tibia covers four.
 * The cuts are deliberately UNEQUAL and in this direction on purpose: the
 * player's edge over the average creature was 1.9x here against Tibia's 2.7x,
 * so shaving the player harder than the creatures would have widened a gap
 * that was already on the wrong side of the reference. This narrows the
 * absolute pace while leaving that ratio roughly where it was.
 */
export const SPEED_PER_LEVEL = 0.8;

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

/** Backpack capacity (slots) — and, since a backpack is now a container item
 *  like any other, the size of every backpack in the game. Tibia's is 20; 16
 *  is the deliberate difference, and a 4x4 grid reads better on a phone. */
export const BAG_SIZE = 16;

/** How many slots a corpse holds. A body is a container too: monster loot
 *  lands in it, and a dead player's whole backpack sits in it as one object. */
export const CORPSE_SLOTS = 16;

/**
 * Monster respawn delay (seconds).
 *
 * Twelve was a carousel. Tibia keys respawn off a per-home "regen" value and
 * the number of players online: a typical home at regen 600 refills in five
 * to ten minutes on an empty server and two to four on a full one. Bone Isle
 * is single-player, so the empty-server branch is the honest comparison — and
 * twelve seconds was twenty-five to fifty times faster than it.
 *
 * Ninety is a deliberate compromise rather than a copy: still four times
 * quicker than Tibia, because this game has no second player to race for a
 * spawn and a cleared floor that stays cleared for ten minutes would be dead
 * air. Long enough that clearing a camp MEANS something for a while.
 */
export const MONSTER_RESPAWN_S = 90;

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
 * Tibia's "creatures don't spawn on screen": a respawn never pops within this
 * radius of the player — if the area is camped, it retries a bit later.
 *
 * Its companion SPAWN_SPACING_PX went in Etap 40. It kept scattered spawns from
 * starting the world in pre-formed blobs, and nothing scatters any more: the
 * map's author decides the spacing by where the glyphs go.
 */
export const SPAWN_AVOID_PLAYER_PX = 240;
export const RESPAWN_RETRY_S = 3;


/** How long a lootable corpse stays on the ground (seconds). */
export const CORPSE_DECAY_S = 75;

/**
 * How close (px) the player must stay to keep TALKING to a townsperson — the
 * shop, the task board and the wardrobe. Walking further away auto-closes the
 * panel, Tibia-style.
 *
 * NPCs keep a pixel radius, and a loose one, for a reason the static panels
 * don't share: townsfolk pace. The smith walks a 3x3 beat around his anvil, so
 * a one-square rule would slam his shop shut because HE took a step — a bug
 * from the player's side, and not one they could do anything about. Tibia
 * likewise gives the trade window a wider leash than it gives containers.
 */
export const USE_RANGE_PX = 112;

/**
 * How many squares the player may stand from a thing and still keep its panel
 * open: the Forge, the Alchemy Tower, a Storage Chest, a corpse, a container
 * on the floor. One, Tibia's reach — the eight tiles around you plus your own.
 *
 * Measured in SQUARES rather than pixels (see `tileGap`), because that is the
 * unit the rule is actually about. The old 112 px radius was three and a half
 * tiles, so a chest stayed usable from most of the way across a room and the
 * carry-cap / multi-trip design leaked accordingly.
 */
export const PANEL_REACH_TILES = 1;

/**
 * Townsfolk pacing, Tibia-style. NPCs in the original shuffle: one square,
 * a long pause, another square. They are not going anywhere and must never
 * look like they are fleeing you, so the speed is roughly a third of a level-1
 * player — and the pause between steps is long and randomised so no two of
 * them fall into a rhythm.
 *
 * Tracks PLAYER_BASE_SPEED: it fell with it in Etap 30 (34 -> 27), because
 * "a third of the player" is the actual rule and leaving it alone would have
 * quietly promoted the town blacksmith to a brisk walker.
 */
export const NPC_WALK_SPEED = 27;
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


/** Crystals (charge-based, replace spells). Values are per single charge. */
export const HEAL_CRYSTAL_BASE = 30;    // HP healed = base + level*3
/**
 * ONE cooldown across every crystal — the elemental line and the Life Crystal
 * alike. Etap 30 merged what used to be an offence-only timer.
 *
 * Tibia brakes healing with mana: a spell you cannot pay for is a spell you
 * do not cast, and the exhaust on top of it is about a second. Bone Isle has
 * no mana, so before this the brake was nothing at all — a Life Crystal heals
 * 30 + 3·level for eight gold with no timer, which at level 50 is 180 HP a
 * click and a full bar for thirty-seven gold. A character could out-heal
 * fourteen creatures at once and simply walk through a floor.
 *
 * Sharing the timer is what makes healing cost something the game has: a
 * turn. At three seconds a single creature eats roughly 40% of the player's
 * casts just to stand still, two creatures eat 75-90%, and three outpace the
 * crystal entirely — which lands the ceiling on 2.3-2.7 attackers at every
 * level from 20 to 50, with no per-level dial. That is the same number as
 * SHIELD_BLOCK_MAX, and the two now say the same thing: a third body is the
 * one you cannot afford.
 */
export const CRYSTAL_COOLDOWN_S = 3.0;

/* ------------------------------------------------------------------ *
 *  CRYSTAL COOLDOWNS, per crystal and per group (Etap 46)
 *
 *  The single timer above described the whole bar, which meant the bar was
 *  one button drawn many times. These three replace it. See
 *  systems/cooldowns.ts for the model; what follows is why the numbers are
 *  these numbers.
 * ------------------------------------------------------------------ */

/**
 * A crystal's own lockout, by tier.
 *
 * Rising, because Tibia charges more for a bigger spell — Exori is four
 * seconds and Exori Gran is six — and because a flat number would collapse the
 * whole bar onto four t3 Shards. The tier ladder has to cost something other
 * than gold or it is not a ladder, it is a price list.
 */
export const CRYSTAL_CD_TIER: readonly number[] = [3.0, 4.0, 6.0];

/**
 * Between two DIFFERENT attack crystals. One second, as in Tibia.
 *
 * This one number is the whole of the rebalance. At level 36 the old shared
 * timer left crystals at 50 dps against a sword's 158; chaining four distinct
 * ones on a one-second wheel reaches ~149 single-target and roughly doubles a
 * sword against a pack — without a single damage constant moving. What was a
 * demand for bigger numbers becomes a reason to carry a varied set.
 */
export const CRYSTAL_GCD_S = 1.0;

/**
 * The Life Crystal, on a clock of its own.
 *
 * Healing used to share the attack timer, and the reasoning was sound: with no
 * mana in the game, the TURN was the only price a heal could pay. The cost was
 * that every top-up stopped the fight dead, which Tibia never does — Exura
 * Vita runs on one second and you keep swinging.
 *
 * Two seconds rather than one because a heal here is 30 + 3·level with no mana
 * behind it: at level 36 that is 138 HP, and on a one-second clock it would be
 * 138 HP/s of sustain bought with nothing but coin. Two seconds halves that
 * and leaves room for the better heal runes to sit UNDER it later, which is
 * the shape you want — a new rune should buy you something, and there is
 * nothing to buy if the first one is already at the ceiling.
 */
export const HEAL_CRYSTAL_CD_S = 2.0;

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
 *  HP_PER_LEVEL → attack rate.
 *
 *  The skill curve itself (skills.ts `factor` = 1.1) is NOT on that list and
 *  is not up for tuning. It is Tibia 8.6's own constant, and 8.6's pacing is
 *  the thing being reproduced — the long grind is the feature, not a cost to
 *  be optimised away. Lowering it to 1.07/1.08 would buy hybrid-build parity
 *  at the price of that pacing, and `mastery` above already buys the same
 *  parity without touching the curve. The game is built to keep growing past
 *  level 50 with new creatures and islands, so the high end of the curve is
 *  content that has not shipped yet, not dead weight.
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
 *  · the defense pool in your hands · stance. The actual block is rolled
 *  triangular over half..ceiling, so defense is steady rather than a lottery.
 *  SHIELD_SKILL_FACTOR is the main attack↔defense dial of the game; it matches
 *  the constant The Forgotten Server uses in Player::getDefense. */
export const SHIELD_SKILL_FACTOR = 0.015;
export const SHIELD_FLAT_FACTOR = 0.1;

/**
 * Physical damage has NO floor and NO percentage cap — Etap 21 replaced both.
 *
 * The old model summed armor and shield and then clipped the total at half the
 * incoming hit. That clip was the reason a level 25 character in the best set
 * in the game still took 8 damage from a bandit: armor 38 alone already
 * exceeded half of a 16-point hit, so the cap bound every single time and the
 * shield contributed literally nothing (removing it changed the damage by
 * under one percent). Being well equipped could not, by construction, make a
 * weak creature harmless.
 *
 * Tibia does it the other way around and that is what we now copy: the shield
 * rolls first and, if it eats the hit outright, the hit is over at zero and
 * armor is never consulted; whatever survives meets armor as a flat, uncapped
 * subtraction that can also land on zero. A creature far below your gear ends
 * up unable to scratch you, which is exactly the intended feel, while a big
 * hitter is barely inconvenienced because flat reduction is a chip off a large
 * number. Elemental damage keeps its own floor — see MIN_ELEMENTAL_DAMAGE.
 */
export const MIN_ELEMENTAL_DAMAGE = 1;

/** Player-to-monster floor. Monsters keep a floor where the player no longer
 *  has one, because a creature whose armor exceeded your weapon would
 *  otherwise be unkillable rather than merely tough. */
export const MIN_DAMAGE_TO_MONSTER = 1;

/** How long a blow you landed keeps you "in combat" for skill purposes.
 *  Long enough to cover repositioning and a healing pause, short enough that
 *  walking away stops the clock. */
export const BLOOD_HIT_WINDOW_S = 60;

/** Retired in Etap 24 — see DUMMY_TIER_RATE / DUMMY_TIER_SHIELD in
 *  systems/building.ts, which key the same numbers off the post's tier. */

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
 *
 *  Etap 21 pulled all three curves sharply down. Once the damage pipeline
 *  stopped capping reduction at half the hit, armor became a flat uncapped
 *  subtraction — and at the old values (a 38-point set against a dragon whose
 *  hardest swing is 109) it was a wall rather than a chip. Tibia keeps the
 *  ratio near a tenth; these curves target roughly a fifth of a same-tier
 *  creature's maximum hit for a full set, and a seventh for a shield, which
 *  is what makes a creature several tiers below you unable to land anything
 *  while leaving a same-tier one dangerous.
 * ------------------------------------------------------------------ */

/** Best attack VALUE available at a level — fists included, so compare it
 *  against MELEE_FIST_ATK + the weapon's gear Attack, not the weapon alone. */
export function bestWeaponAtk(level: number): number {
  return Math.min(31, 10.5 + 0.41 * level);
}

/** Best shield Defense available at a level. Unlike the weapon curve this one
 *  bends: defense climbs briskly to level 25, then flattens out, so the early
 *  game is where a shield upgrade is genuinely felt. */
export function bestShieldDef(level: number): number {
  return Math.min(17, 1.1 + 0.32 * level);
}

/** Best TOTAL armor rating of a full worn set (head + body + legs + boots).
 *  Same two-part shape as the shield, five points lower at the start — a
 *  beginner finds a shield before a matched set of plate. */
export function bestArmorSet(level: number): number {
  return Math.min(22, 0.4 + 0.43 * level);
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
 * How much further a creature that has ALREADY noticed you will follow before
 * losing interest. Six tiles to be seen, eight to shake off.
 *
 * Without the gap the two thresholds are the same line, and a player skirting
 * it makes the whole floor flicker: creatures commit for half a step, snap
 * back, commit again. The measured cost of the hysteresis is small — on the
 * Bone Reach it changes hits taken not at all and only stretches the average
 * chase from 4.2 to 4.6 seconds — so this is a fix for how pursuit READS, not
 * a difficulty change.
 *
 * Two tiles and no more, deliberately: a chased creature drifts about 6.4
 * tiles from its post at this setting, and POST_LEASH_PX is ten. Widen the
 * hysteresis much past this and the leash starts fighting the chase, which
 * looks like yo-yoing.
 */
export const MONSTER_AGGRO_HOLD_RANGE = 8 * TILE;

/**
 * How far "attack nearest" will reach for a creature.
 *
 * Eight tiles, matching MONSTER_AGGRO_HOLD_RANGE rather than the tighter
 * aggro range: the button should be able to mark anything that could already
 * be coming for you, and one that stops short of that reads as broken. It is
 * also comfortably inside the game window, so the button never marks
 * something the player cannot see.
 */
export const TARGET_SEEK_PX = 8 * TILE;

/**
 * How far a creature posted by a hand-drawn map may drift from its post while
 * idle. Camp dwellers in the Deep Wildlands have always carried a leash like
 * this; creatures placed by a map glyph did not, and `guard` — the only thing
 * they were tagged with — governs where they RESPAWN, not where they wander.
 * The result on a large authored island was zones bleeding into each other:
 * orcs drifting up into the minotaur ground over the course of a session.
 *
 * Comfortably wider than MONSTER_AGGRO_RANGE, so the leash never cuts a chase
 * short: it only applies while idle, and pulling home is what an idle creature
 * does once it has strayed.
 */
export const POST_LEASH_PX = 10 * TILE;
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
