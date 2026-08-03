/** Monster definitions, danger-band spawning and the wander/chase/attack AI. */
import { rnd, rndi, wrnd, dist } from "../util.ts";
import { WILD_ENTRANCE_SAFE_PX, SPAWN_SPACING_PX, SPAWN_AVOID_PLAYER_PX, MONSTER_AGGRO_RANGE, POST_LEASH_PX, SHOT_SPEED, TILE } from "../config.ts";
import { SPR } from "../gfx/sprites.ts";
import { randomWalkable, lineOfSight } from "../world/collision.ts";
import { toTile, tileCenter, glideWalker, tryStep, chebTiles, octile, STEPS8, walkable } from "../world/grid.ts";
import { inHavenBand } from "../world/collision.ts";
import { stepFacing } from "../gfx/mobSheet.ts";
import type { Occupied } from "../world/grid.ts";
import { Tile } from "../world/types.ts";
import type { World, Monster, MonsterKind, Camp } from "../world/types.ts";
import type { ItemKind } from "../items.ts";
import type { Resistances } from "../systems/elements.ts";

/** A weighted loot entry: item, drop chance, and min/max quantity. */
export interface LootEntry {
  kind: ItemKind;
  chance: number;
  n: readonly [number, number];
}

/** A monster's ranged attack (archers, shamans, dragon fire). */
export interface RangedDef {
  /** Firing reach in WORLD px (doubled with TILE in Etap 17). Must stay under
   *  MONSTER_AGGRO_RANGE so a shooter never plinks from beyond its awareness. */
  range: number;
  /** Ranged damage roll — separate from `dmg`, which stays the melee roll. */
  dmg: readonly [number, number];
  /** Projectile tint; omit for the classic steel-gray arrow. */
  color?: string;
  /** Thicker projectile stroke (fireballs). */
  wide?: boolean;
  /** Brute shooter (the dragon): does NOT kite. It keeps advancing like a
   *  melee monster, breathes at range, then switches to its paw (the melee
   *  `dmg` roll) once it reaches you — so it both closes in AND blasts fire,
   *  instead of backing away and only spitting. */
  brute?: boolean;
}

export interface MonsterDef {
  spr: HTMLCanvasElement;
  hp: number;
  /** MELEE damage roll (shooters stab weakly when cornered). */
  dmg: readonly [number, number];
  speed: number;
  atkRate: number;
  exp: number;
  gold: readonly [number, number];
  loot: readonly LootEntry[];
  /** Danger band: how far from the world's entrance it spawns (0..1). */
  danger: number;
  /**
   * Flat armor rating, mirroring the player's: every incoming hit is reduced
   * by a roll from half this value to all of it. Absent means bare flesh.
   *
   * Because the reduction is flat it costs a hail of weak blows far more than
   * one heavy one, which is what makes a hulking armored creature a genuine
   * wall to a low-skill character and merely an inconvenience to a trained
   * one. It is also the reason elemental damage will matter: crystals are
   * meant to bypass this entirely, so armor is what they are the answer to.
   */
  armor?: number;
  /**
   * Elemental resistances, as multipliers on incoming crystal damage. Absent
   * means ordinary flesh (1.0 to everything). Kept sparse on purpose: if every
   * creature had a full table the player would carry five pouches and consult
   * a chart before each fight, which is bookkeeping, not a decision.
   */
  resist?: Resistances;
  /** Present on distance fighters: they hold ground and shoot (Tibia-style),
   *  back away when the player closes in, and fall back to `dmg` in melee. */
  ranged?: RangedDef;
  /** Respawn override in seconds (the dragon's lair refills slowly). */
  respawnS?: number;
}

/**
 * The bestiary, ordered from the entrance outward. `danger` is the spawn band:
 * distance from the Wildlands entrance (0 = the arrival coast, 1 = the farthest
 * reaches). The six original creatures keep their stats — only their bands were
 * re-tuned to the new distance-from-entrance gradient; the other seven fill and
 * extend the difficulty curve so tougher foes are discovered further in.
 */
/**
 * The bestiary. All creatures attack on the same 2.0 s cadence as the player
 * (Tibia 8.6's standard weapon speed — duels are blow-for-blow); their damage
 * ranges were scaled up from the old faster cadence so DPS stayed the same:
 * rarer, heavier hits, exactly the old-Tibia feel. A monster's actual hit is
 * rolled uniformly inside `dmg` and then reduced by the player's defense.
 */
/**
 * Creature artwork loaded from PNGs, keyed by kind.
 *
 * `MONSTER_DEFS` is readonly and its baked sprite is the guaranteed fallback,
 * so drawn artwork lives beside it: `mobSprite()` prefers the loaded canvas
 * and drops back to the bake when there is none. Instances copy the sprite at
 * spawn, so anything alive when a PNG lands is swept by the loader.
 */
const mobArt: Partial<Record<MonsterKind, HTMLCanvasElement>> = {};

/** Install artwork for a creature; pass null to fall back to the baked sprite. */
export function setMobArt(k: MonsterKind, c: HTMLCanvasElement | null): void {
  if (c) mobArt[k] = c;
  else delete mobArt[k];
}

/** The sprite a creature of this kind should draw with. */
export function mobSprite(k: MonsterKind): HTMLCanvasElement {
  return mobArt[k] ?? MONSTER_DEFS[k].spr;
}

/* ------------------------------------------------------------------ *
 *  MONSTER BUDGET — what a creature meant for a given level should cost
 *
 *  The bestiary was built by hand, one creature at a time, and it shows: exp
 *  per unit of threat runs from 0.33 on a bandit down to 0.022 on a dragon.
 *  Part of that slope is intentional — deeper creatures SHOULD pay less per
 *  point of danger, or levelling accelerates instead of decelerating — but
 *  nothing was governing it, so every new creature was a freehand guess
 *  against its neighbours.
 *
 *  These functions make the intent explicit: place a creature by naming the
 *  level it is FOR, and read off what it should carry. The smoke tests hold
 *  the shipped bestiary to them within a deliberately wide band, because a
 *  creature that is pointedly glassy or pointedly spongy is good design and
 *  should still be allowed to exist.
 * ------------------------------------------------------------------ */

/** HP a creature built for `level` should carry — six to eight swings from a
 *  properly geared character of that level. */
export function monsterHpBudget(level: number): number {
  return Math.round(14 + 7.5 * level + 0.16 * level * level);
}

/** Damage per second it should deal, BEFORE the player's armor. */
export function monsterDpsBudget(level: number): number {
  return 1.6 + 0.72 * level;
}

/** Experience it should award. Threat is hp × dps, and the sub-unit exponent
 *  is what makes deeper creatures pay less per point of danger — without it,
 *  levelling would accelerate instead of decelerating.
 *
 *  The coefficients are a least-squares fit to the bestiary as shipped, not an
 *  invention: whoever placed those 33 creatures by hand was following a curve
 *  without writing it down, and this is that curve recovered. Median error
 *  0.95×, which is why the tests band at ±40% rather than pretending to more
 *  precision than hand-placed data can support. */
export function monsterExpBudget(level: number): number {
  const threat = monsterHpBudget(level) * monsterDpsBudget(level);
  return Math.round(0.879 * Math.pow(threat, 0.663));
}

/** Armor rating for that level. Zero is always legitimate — ghosts and vermin
 *  are supposed to be soft. */
export function monsterArmorBudget(level: number): number {
  return Math.round(0.42 * level);
}

/** The level a creature's stats actually correspond to, read back from its HP. */
export function monsterTierOf(hp: number): number {
  for (let l = 1; l <= 100; l++) if (monsterHpBudget(l) >= hp) return l;
  return 100;
}

export const MONSTER_DEFS: Readonly<Record<MonsterKind, MonsterDef>> = {
  // Tier 1, the creature a fresh character meets first. A person rather than
  // vermin, so it carries coin and the odd bit of kit — but the stats stay at
  // the very bottom of the ladder: a level 1 player must be able to win.
  bandit: {
    spr: SPR.rat, hp: 14, dmg: [1, 6], speed: 62, atkRate: 2.0, exp: 8, gold: [1, 4], danger: 0.06, armor: 1,
    // Etap 19: silk used to come off the two spiders and nothing else, and the
    // Alchemy Tower prices every research row in it. With the spiders gone the
    // supply moved onto the two commonest early creatures — the bandit carries
    // it as stolen cloth, the goblin as loot from a raided pack.
    loot: [{ kind: "hpPotion", chance: 0.08, n: [1, 1] }, { kind: "leatherArmor", chance: 0.03, n: [1, 1] },
           { kind: "silk", chance: 0.5, n: [1, 2] }],
  },
  snake: {
    spr: SPR.snake, hp: 14, dmg: [2, 7], speed: 68, atkRate: 2.0, exp: 8, gold: [0, 1], danger: 0.1, resist: { earth: 0.6, ice: 1.5 },
    loot: [{ kind: "venomGland", chance: 0.25, n: [1, 1] }],
  },
  skeleton: {
    spr: SPR.skeleton, hp: 34, dmg: [4, 11], speed: 40, atkRate: 2.0, exp: 18, gold: [1, 4], danger: 0.3, armor: 2, resist: { shadow: 0.6, fire: 1.3 },
    loot: [{ kind: "bones", chance: 0.9, n: [1, 3] }],
  },
  goblin: {
    spr: SPR.goblin, hp: 52, dmg: [6, 18], speed: 68, atkRate: 2.0, exp: 30, gold: [3, 8], danger: 0.4, armor: 2,
    loot: [{ kind: "meat", chance: 0.4, n: [1, 1] }, { kind: "hpPotion", chance: 0.12, n: [1, 1] },
           { kind: "silk", chance: 0.5, n: [1, 2] }],
  },
  ghoul: {
    spr: SPR.ghoul, hp: 85, dmg: [7, 19], speed: 60, atkRate: 2.0, exp: 45, gold: [2, 8], danger: 0.5, armor: 3, resist: { shadow: 0.5, fire: 1.4 },
    loot: [{ kind: "bones", chance: 0.8, n: [1, 3] }, { kind: "ghoulClaw", chance: 0.2, n: [1, 1] }],
  },
  orc: {
    spr: SPR.orc, hp: 90, dmg: [8, 23], speed: 56, atkRate: 2.0, exp: 55, gold: [6, 14], danger: 0.62, armor: 4,
    loot: [{ kind: "meat", chance: 0.5, n: [1, 2] }, { kind: "ironSword", chance: 0.06, n: [1, 1] }, { kind: "fireRuby", chance: 0.05, n: [1, 1] }],
  },
  orcArcher: {
    spr: SPR.orcArcher, hp: 80, dmg: [5, 13], speed: 64, atkRate: 2.0, exp: 58, gold: [5, 12], danger: 0.55, armor: 3,
    ranged: { range: 220, dmg: [6, 17], color: "#b98a4e" }, // crossbow bolts
    loot: [{ kind: "boneArrow", chance: 0.4, n: [2, 6] }, { kind: "meat", chance: 0.3, n: [1, 1] }],
  },
  // Same fight as an orc warrior, wearing the same iron and swinging on the same
  // two-second beat — the armour is what the rank is, not the goblin under it.
  // Marginally quicker and marginally softer than the orc, which is the goblin
  // showing through: a smaller frame carries plate better but takes a hit worse.
  goblinLegionary: {
    spr: SPR.goblin, hp: 122, dmg: [10, 27], speed: 62, atkRate: 2.0, exp: 76, gold: [8, 18], danger: 0.6, armor: 8,
    loot: [],
  },
  orcWarrior: {
    spr: SPR.orcWarrior, hp: 125, dmg: [10, 28], speed: 60, atkRate: 2.0, exp: 78, gold: [8, 18], danger: 0.6, armor: 8,
    loot: [{ kind: "chainArmor", chance: 0.04, n: [1, 1] }, { kind: "ironSword", chance: 0.08, n: [1, 1] }, { kind: "meat", chance: 0.4, n: [1, 1] }],
  },
  minotaur: {
    spr: SPR.minotaur, hp: 140, dmg: [12, 33], speed: 60, atkRate: 2.0, exp: 95, gold: [8, 18], danger: 0.8, armor: 6,
    loot: [{ kind: "bones", chance: 0.6, n: [1, 3] }, { kind: "meat", chance: 0.4, n: [1, 2] }, { kind: "ironSword", chance: 0.05, n: [1, 1] }],
  },
  minotaurArcher: {
    spr: SPR.minotaurArcher, hp: 130, dmg: [6, 16], speed: 60, atkRate: 2.0, exp: 100, gold: [8, 16], danger: 0.68, armor: 4,
    ranged: { range: 300, dmg: [9, 26], color: "#efe9d6" }, // bone-tipped bolts
    loot: [{ kind: "boneArrow", chance: 0.6, n: [3, 10] }, { kind: "longbow", chance: 0.03, n: [1, 1] }],
  },
  orcShaman: {
    spr: SPR.orcShaman, hp: 110, dmg: [5, 13], speed: 52, atkRate: 2.0, exp: 115, gold: [10, 22], danger: 0.72, armor: 2, resist: { fire: 0.6, ice: 1.4 },
    ranged: { range: 260, dmg: [8, 20], color: "#8a6cff" }, // crackling magic bolt
    loot: [{ kind: "fireCrystal", chance: 0.4, n: [1, 3] }, { kind: "healCrystal", chance: 0.2, n: [1, 2] }, { kind: "fireRuby", chance: 0.1, n: [1, 1] }],
  },
  orcBerserker: {
    spr: SPR.orcBerserker, hp: 210, dmg: [15, 38], speed: 88, atkRate: 2.0, exp: 155, gold: [12, 26], danger: 0.8, armor: 7,
    loot: [{ kind: "battleAxe", chance: 0.06, n: [1, 1] }, { kind: "meat", chance: 0.5, n: [1, 2] }, { kind: "fireRuby", chance: 0.12, n: [1, 1] }],
  },
  minotaurGuard: {
    spr: SPR.minotaurGuard, hp: 280, dmg: [16, 42], speed: 56, atkRate: 2.0, exp: 210, gold: [16, 34], danger: 0.85, armor: 12,
    loot: [{ kind: "steelShield", chance: 0.05, n: [1, 1] }, { kind: "boneHelmet", chance: 0.04, n: [1, 1] }, { kind: "chainArmor", chance: 0.06, n: [1, 1] }, { kind: "bones", chance: 0.6, n: [2, 4] }, { kind: "fireRuby", chance: 0.15, n: [1, 1] }],
  },
  // A minotaur guard's equal, built out of the skeleton instead of the bull:
  // same wall of HP, same heavy two-second swing, marginally quicker on its
  // feet because it carries no shield. Pure melee — the dagger is a stabbing
  // weapon, not a thrown one, so it must close the distance like the guard.
  skeletonWarrior: {
    spr: SPR.skeleton, hp: 275, dmg: [15, 41], speed: 58, atkRate: 2.0, exp: 205, gold: [14, 30], danger: 0.85, armor: 10, resist: { shadow: 0.6, fire: 1.3 },
    loot: [],
  },
  minotaurMage: {
    spr: SPR.minotaurMage, hp: 220, dmg: [8, 20], speed: 52, atkRate: 2.0, exp: 240, gold: [18, 38], danger: 0.9, armor: 4, resist: { storm: 0.5, earth: 1.4 },
    ranged: { range: 280, dmg: [12, 32], color: "#ff8a3a", wide: true }, // fire bolt
    loot: [{ kind: "fireCrystal", chance: 0.6, n: [2, 5] }, { kind: "fireRuby", chance: 0.2, n: [1, 1] }, { kind: "ring", chance: 0.06, n: [1, 1] }],
  },
  // Second-hardest thing in the game, and deliberately shaped as the dragon's
  // shadow: roughly three quarters of its damage, four fifths of its HP, three
  // quarters of its experience. The difference that matters is reach — the
  // dragon breathes, this one has only claws, so it can be fought at a bow's
  // length in a way the dragon never allows. It is slightly faster to make the
  // closing distance cost you something.
  demonSkeleton: {
    spr: SPR.skeleton, hp: 780, dmg: [36, 95], speed: 62, atkRate: 2.0, exp: 700, gold: [45, 105], danger: 0.97, armor: 16, resist: { fire: 0.5, shadow: 0.3, storm: 1.5 },
    loot: [],
  },
  // The boss. One dragon nests in the deepest reaches of Bone Caverns -3
  // (Tibia's Dragon Lair feel): a wall for anyone under ~level 15, a real but
  // winnable fight at 18-20 with good gear and kite-and-shoot. Its lair refills
  // on a long clock instead of the standard 12 s trickle.
  dragon: {
    // The hardest thing in the game and now it plays like it: a brute that
    // charges in, mauls with its paw (melee) for heavy hits, and breathes fire
    // at range — no more backing away and plinking. Both rolls reach past 100
    // on the high end, so a careless approach genuinely hurts.
    spr: SPR.dragon, hp: 1000, dmg: [45, 120], speed: 60, atkRate: 2.0, exp: 900, gold: [60, 140], danger: 0.99, armor: 20, resist: { fire: 0.25, ice: 1.6 },
    ranged: { range: 320, dmg: [38, 100], color: "#ff5a2a", wide: true, brute: true }, // dragon fire
    respawnS: 600,
    loot: [
      { kind: "dragonHam", chance: 0.9, n: [2, 5] },
      { kind: "dragonScale", chance: 0.6, n: [1, 3] },
      { kind: "fireRuby", chance: 0.5, n: [2, 4] },
      { kind: "dragonShield", chance: 0.08, n: [1, 1] },
      { kind: "fireSword", chance: 0.06, n: [1, 1] },
      { kind: "dragonScaleArmor", chance: 0.04, n: [1, 1] },
    ],
  },
};

export const MONSTER_KINDS = Object.keys(MONSTER_DEFS) as MonsterKind[];

/**
 * Spawn one monster of `kind`, placed by its danger band: distance from the
 * Wildlands entrance portal, normalised so 0 is the arrival coast and ~1 the
 * farthest reaches. Nothing spawns within the entrance safe radius, spawns
 * keep SPAWN_SPACING_PX apart (no day-one blobs), and when `avoid` is given
 * (the player, on respawns) nothing pops within SPAWN_AVOID_PLAYER_PX of it —
 * returns false in that case so the caller can retry later, Tibia-style.
 */
/** Shared constructor for a freshly spawned creature. */
function pushMonster(
  w: World,
  kind: MonsterKind,
  p: { x: number; y: number },
  home?: { camp: string; x: number; y: number; r: number },
): boolean {
  const d = MONSTER_DEFS[kind];
  // grid rule: every creature claims exactly one tile — never spawn onto a
  // square already claimed by another creature
  const tx = toTile(p.x);
  const ty = toTile(p.y);
  if (w.monsters.some((o) => o.tx === tx && o.ty === ty)) return false;
  // never materialise ON a portal either — a creature spawned on the ladder
  // would block the floor's entrance from the very first frame. Covers every
  // spawn path at once (roster, density top-up, chest guard, camp, respawn).
  if (w.portals.some((pt) => toTile(pt.x) === tx && toTile(pt.y) === ty)) return false;
  // A haven inside a hostile map is off limits to every spawn path at once —
  // roster, density top-up, respawn, camp and chest guard all land here.
  if (inHavenBand(w, ty)) return false;
  w.monsters.push({
    kind,
    x: tileCenter(tx),
    y: tileCenter(ty),
    tx,
    ty,
    spr: mobSprite(kind),
    hp: d.hp,
    maxhp: d.hp,
    speed: d.speed,
    atkRate: d.atkRate,
    atkCd: wrnd(0, 1),
    wanderT: wrnd(0, 2),
    dir: "down",
    bob: wrnd(0, 3),
    hurtT: 0,
    aggroT: 0,
    orbit: wrnd(0, 1) < 0.5 ? 1 : -1,
    camp: home?.camp,
    hx: home?.x,
    hy: home?.y,
    hr: home?.r,
  });
  return true;
}

/**
 * Spawn a creature inside its settlement: a uniform point in the camp disc,
 * walkable, spaced from its packmates, off the lair mouth, and never beside a
 * player standing in the camp. Camp dwellers carry a home leash so they idle
 * around their village instead of drifting across the continent.
 */
export function spawnMonsterInCamp(
  w: World,
  kind: MonsterKind,
  camp: Camp,
  avoid?: { x: number; y: number },
): boolean {
  for (let tries = 0; tries < 60; tries++) {
    const a = wrnd(0, Math.PI * 2);
    const rr = (camp.r - 40) * Math.sqrt(wrnd(0, 1));
    const x = camp.x + Math.cos(a) * rr;
    const y = camp.y + Math.sin(a) * rr;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (w.solid[ty]?.[tx] !== false || w.tile[ty][tx] === Tile.Water) continue;
    if (avoid && dist(x, y, avoid.x, avoid.y) < SPAWN_AVOID_PLAYER_PX) continue;
    // keep the descent hole clear so arrivals from the lair aren't body-blocked
    if (w.portals.some((pt) => dist(pt.x, pt.y, x, y) < 48)) continue;
    if (!w.monsters.every((m) => dist(m.x, m.y, x, y) >= SPAWN_SPACING_PX)) continue;
    if (pushMonster(w, kind, { x, y }, { camp: camp.key, x: camp.x, y: camp.y, r: camp.r })) return true;
  }
  return false;
}

/**
 * Spawn a free roamer in the open wilderness — anywhere walkable on the
 * continent EXCEPT inside settlements and the dock's arrival area. These are
 * the wolves loping through the forests between camps; they carry no home
 * leash and wander wherever the woods take them.
 */
export function spawnWilderness(w: World, kind: MonsterKind, avoid?: { x: number; y: number }): boolean {
  const dock = w.portals.find((pt) => pt.dest === "town");
  for (let tries = 0; tries < 60; tries++) {
    const cand = randomWalkable(w);
    if (dock && dist(cand.x, cand.y, dock.x, dock.y) < WILD_ENTRANCE_SAFE_PX) continue;
    if (w.camps.some((c) => dist(c.x, c.y, cand.x, cand.y) < c.r + 96)) continue;
    if (avoid && dist(cand.x, cand.y, avoid.x, avoid.y) < SPAWN_AVOID_PLAYER_PX) continue;
    if (!w.monsters.every((m) => dist(m.x, m.y, cand.x, cand.y) >= SPAWN_SPACING_PX)) continue;
    if (pushMonster(w, kind, cand)) return true;
  }
  return false;
}

/**
 * Plant a creature right beside a fixed tile — used for the treasure-chest
 * guards (Etap 13): every one-time chest is now watched by a dragon coiled on
 * top of its hoard, so the prize has to be fought for rather than walked to.
 * Rings outward from the chest until a free walkable tile turns up, so it
 * always lands as close to the chest as the cavern allows.
 */
/**
 * Put a creature on the exact tile a map author marked, falling back to the
 * nearest free ring if that square is taken (a corpse-blocked respawn, say).
 * The post is recorded so the creature returns here when it is killed.
 */
export function spawnAtPost(
  w: World, kind: MonsterKind, tx: number, ty: number, avoid?: { x: number; y: number },
): boolean {
  const free =
    w.solid[ty]?.[tx] === false && (w.tile[ty]?.[tx] ?? 0) > 0 &&
    !w.monsters.some((m) => m.tx === tx && m.ty === ty);
  if (free) {
    const cx = tileCenter(tx);
    const cy = tileCenter(ty);
    const clear = !avoid || dist(cx, cy, avoid.x, avoid.y) >= SPAWN_AVOID_PLAYER_PX;
    if (clear && pushMonster(w, kind, { x: cx, y: cy })) {
      const m = w.monsters[w.monsters.length - 1];
      m.guard = { tx, ty };
      // Leash it to its post. `guard` alone only decides where it comes back
      // after dying; without this the creature wanders off its zone entirely.
      m.hx = cx;
      m.hy = cy;
      m.hr = POST_LEASH_PX;
      return true;
    }
  }
  return spawnGuard(w, kind, tx, ty, avoid);
}

export function spawnGuard(
  w: World, kind: MonsterKind, tx: number, ty: number, avoid?: { x: number; y: number },
): boolean {
  for (let r = 1; r <= 6; r++) {
    const ring: Array<[number, number]> = [];
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue; // ring edge only
        ring.push([tx + ox, ty + oy]);
      }
    }
    for (const [nx, ny] of ring) {
      if (nx < 1 || ny < 1 || nx >= w.w - 1 || ny >= w.h - 1) continue;
      if (w.solid[ny]?.[nx] !== false || !(w.tile[ny]?.[nx] > 0)) continue;
      if (w.monsters.some((m) => m.tx === nx && m.ty === ny)) continue;
      const cx = tileCenter(nx);
      const cy = tileCenter(ny);
      // never materialise on top of the player
      if (avoid && dist(cx, cy, avoid.x, avoid.y) < SPAWN_AVOID_PLAYER_PX) continue;
      if (pushMonster(w, kind, { x: cx, y: cy })) {
        // tag it so a slain guard respawns back onto its hoard, and leash it
        // to the post so it keeps to its own ground while idle
        const g = w.monsters[w.monsters.length - 1];
        g.guard = { tx, ty };
        g.hx = tileCenter(tx);
        g.hy = tileCenter(ty);
        g.hr = POST_LEASH_PX;
        return true;
      }
    }
  }
  return false;
}

export function spawnMonster(w: World, kind: MonsterKind, avoid?: { x: number; y: number }, uniform = false): boolean {
  const d = MONSTER_DEFS[kind];
  const entrance = w.portals[0];
  const ex = entrance ? entrance.x : (w.w / 2) * TILE;
  const ey = entrance ? entrance.y : (w.h / 2) * TILE;
  // farthest a tile can sit from the entrance ≈ span to the opposite corner
  const maxD = Math.max(
    dist(ex, ey, 0, 0), dist(ex, ey, w.w * TILE, 0),
    dist(ex, ey, 0, w.h * TILE), dist(ex, ey, w.w * TILE, w.h * TILE),
  ) || 1;

  // UNIFORM mode (caves/undergrounds): the danger band is a radial-island idea
  // — spawn distance from the entrance ∝ danger — which in a rectangular cavern
  // packs every same-tier creature into one far corner and leaves the other
  // half empty. Underground floors instead spread their roster evenly across
  // ALL walkable rock, so the whole cavern is populated (Etap 13). We still
  // keep the entrance clear and honour spacing so it isn't a wall-to-wall blob.
  if (uniform) {
    // Prefer a genuinely OPEN cavern tile (most orthogonal neighbours walkable)
    // so creatures — especially the lone dragon — never end up jammed in a
    // one-tile rock pocket that reads as "spawned in the wall".
    const openness = (x: number, y: number): number => {
      const tx = toTile(x), ty = toTile(y);
      let open = 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = tx + ox, ny = ty + oy;
        if (w.solid[ny]?.[nx] === false && w.tile[ny]?.[nx] > 0) open++;
      }
      return open;
    };
    let best: { x: number; y: number } | null = null;
    let bestOpen = -1;
    let fb: { x: number; y: number } | null = null;
    for (let tries = 0; tries < 100; tries++) {
      const cand = randomWalkable(w);
      if (dist(cand.x, cand.y, ex, ey) < WILD_ENTRANCE_SAFE_PX) continue;
      if (avoid && dist(cand.x, cand.y, avoid.x, avoid.y) < SPAWN_AVOID_PLAYER_PX) continue;
      if (w.monsters.some((m) => m.tx === toTile(cand.x) && m.ty === toTile(cand.y))) continue;
      fb ??= cand;
      if (!w.monsters.every((m) => dist(m.x, m.y, cand.x, cand.y) >= SPAWN_SPACING_PX)) continue;
      const o = openness(cand.x, cand.y);
      if (o >= 3) { best = cand; break; }        // wide-open tile: take it
      if (o > bestOpen) { bestOpen = o; best = cand; } // otherwise keep the most open one
    }
    const p = best ?? (avoid ? null : fb);
    if (!p) return false;
    return pushMonster(w, kind, p);
  }

  let match: { x: number; y: number } | null = null;   // spaced + right danger band
  let spaced: { x: number; y: number } | null = null;  // spaced, wrong band
  let fallback: { x: number; y: number } | null = null; // passes hard constraints only
  for (let tries = 0; tries < 40 && !match; tries++) {
    const cand = randomWalkable(w);
    const dd = dist(cand.x, cand.y, ex, ey);
    if (dd < WILD_ENTRANCE_SAFE_PX) continue; // keep the arrival area clear
    if (avoid && dist(cand.x, cand.y, avoid.x, avoid.y) < SPAWN_AVOID_PLAYER_PX) continue;
    // grid hard rule: the candidate SQUARE must be free — one creature per tile
    if (w.monsters.some((m) => m.tx === toTile(cand.x) && m.ty === toTile(cand.y))) continue;
    fallback ??= cand;
    if (!w.monsters.every((m) => dist(m.x, m.y, cand.x, cand.y) >= SPAWN_SPACING_PX)) continue;
    spaced ??= cand;
    if (Math.abs(dd / maxD - d.danger) < 0.16) match = cand;
  }
  // a fresh populate must never lose a creature — but a respawn near a camping
  // player simply reports failure and gets retried by the caller
  let p = match ?? spaced ?? (avoid ? null : fallback);
  // a fresh populate must never lose a creature: last-ditch free-square hunt
  if (!p && !avoid) {
    for (let tries = 0; tries < 40 && !p; tries++) {
      const cand = randomWalkable(w);
      if (!w.monsters.some((m) => m.tx === toTile(cand.x) && m.ty === toTile(cand.y))) p = cand;
    }
  }
  if (!p) return false;
  return pushMonster(w, kind, p);
}

/** Roll a monster's loot into concrete stacks + gold. Runtime randomness —
 *  deliberately NOT the deterministic world RNG, so kills never perturb the
 *  world-generation stream and drop chances/amounts share one RNG source. */
export function rollLoot(kind: MonsterKind): { items: { kind: ItemKind; n: number }[]; gold: number } {
  const d = MONSTER_DEFS[kind];
  const items: { kind: ItemKind; n: number }[] = [];
  for (const e of d.loot) {
    if (Math.random() < e.chance) {
      const n = rndi(e.n[0], e.n[1]);
      if (n > 0) items.push({ kind: e.kind, n });
    }
  }
  const gold = rndi(d.gold[0], d.gold[1]);
  return { items, gold };
}

/** A target the monster AI can chase and hit. */
export interface AttackTarget {
  x: number;
  y: number;
  /** Logical tile the target CLAIMS (may differ from x,y mid-glide). When
   *  given, occupancy and ring checks use it — the claimed square stays
   *  blocked for the whole step, exactly like every other creature's. */
  tx?: number;
  ty?: number;
  dead: boolean;
}

/**
 * Advance every monster in `w` on the tile grid. When a monster lands a hit it
 * calls `onHit(monster, ranged)` so the caller (combat system) applies damage
 * to the player — `ranged` picks between the melee and the ranged damage roll.
 *
 * Movement is fully Tibia-style: a creature logically stands on ONE tile,
 * glides toward its centre, and only from the centre may claim an adjacent
 * tile (8 directions). The player's tile and every other creature's tile are
 * hard-blocked, so at most 8 bodies can ring the player and a free square is
 * always a genuine escape route.
 */
export function updateMonsters(
  w: World,
  dt: number,
  target: AttackTarget,
  onHit: (m: Monster, ranged: boolean) => void,
): void {
  const ptx = target.tx ?? toTile(target.x);
  const pty = target.ty ?? toTile(target.y);
  // Portal tiles are off-limits to creatures (Etap 13). A monster parked on a
  // ladder/cave mouth while it trades blows with you physically blocks the
  // only way out of the floor, which reads as the game cheating. Treating the
  // pad as permanently "occupied" means the whole existing steering stack —
  // chase, arc-around, retreat, wander — routes around it for free, and the
  // creature still happily stands on any adjacent tile to keep fighting.
  const portalTiles = new Set(w.portals.map((pt) => toTile(pt.y) * w.w + toTile(pt.x)));
  const onPortal = (tx: number, ty: number): boolean => portalTiles.has(ty * w.w + tx);

  /** A step that also records which way the creature ended up facing. */
  const step = (m: Monster, sx: number, sy: number, occ: Occupied): boolean => {
    if (!tryStep(w, m, sx, sy, occ)) return false;
    m.dir = stepFacing(m.kind, sx, sy, m.dir);
    return true;
  };

  const occOf = (self: Monster): Occupied => (tx, ty) =>
    (tx === ptx && ty === pty) || onPortal(tx, ty) || inHavenBand(w, ty) ||
    w.monsters.some((o) => o !== self && o.tx === tx && o.ty === ty);

  /**
   * One chase step toward (gx,gy), Tibia-style. First choice: any free square
   * that REDUCES the Chebyshev distance (fastest octile route as tiebreak).
   * When every closer square is claimed, walk the ARC — a free square at the
   * SAME Chebyshev distance, rotating in the creature's own preferred
   * direction (`orbit`). Half the pack circles left, half right, so they flow
   * around each other and surround the target instead of queueing single-file.
   * In a walled corridor the arc is solid rock and they correctly queue.
   */
  const chaseStep = (m: Monster, occ: Occupied, gx: number, gy: number): boolean => {
    const curC = chebTiles(m.tx, m.ty, gx, gy);
    let best: readonly [number, number] | null = null;
    let bestO = Infinity;
    let arc: readonly [number, number] | null = null;
    for (const [sx, sy] of STEPS8) {
      const nx = m.tx + sx;
      const ny = m.ty + sy;
      if (!walkable(w, nx, ny) || occ(nx, ny)) continue;
      const c = chebTiles(nx, ny, gx, gy);
      const o = octile(nx, ny, gx, gy);
      if (c < curC) {
        if (o < bestO) { bestO = o; best = [sx, sy]; }
      } else if (c === curC && !arc) {
        // rotation side split by `orbit` keeps the arc walk consistent
        const cross = sx * (gy - m.ty) - sy * (gx - m.tx);
        if (Math.sign(cross) === m.orbit) arc = [sx, sy];
      }
    }
    const pick = best ?? arc;
    if (!pick) return false;
    return step(m, pick[0], pick[1], occ);
  };

  /** One retreat step: the free square that maximises walking distance from
   *  the player. With the path of retreat blocked the shooter holds ground. */
  const retreatStep = (m: Monster, occ: Occupied): boolean => {
    const cur = octile(m.tx, m.ty, ptx, pty);
    let best: readonly [number, number] | null = null;
    let bestO = cur;
    for (const [sx, sy] of STEPS8) {
      const nx = m.tx + sx;
      const ny = m.ty + sy;
      if (!walkable(w, nx, ny) || occ(nx, ny)) continue;
      const o = octile(nx, ny, ptx, pty);
      if (o > bestO) { bestO = o; best = [sx, sy]; }
    }
    if (!best) return false;
    return step(m, best[0], best[1], occ);
  };

  for (const m of w.monsters) {
    m.hurtT = Math.max(0, m.hurtT - dt);
    m.aggroT = Math.max(0, m.aggroT - dt);
    m.atkCd -= dt;
    const occ = occOf(m);
    // Evict anything already standing on a portal — from an older save, or
    // shoved there before this rule existed. `occ` only stops a creature
    // ENTERING a pad, so without this a squatter would never leave. Step it
    // onto the nearest free neighbour; it keeps fighting from right beside
    // the pad, the exit is simply usable again.
    if (onPortal(m.tx, m.ty)) {
      for (const [sx, sy] of STEPS8) {
        if (step(m, sx, sy, occ)) break;
      }
    }
    const d = dist(m.x, m.y, target.x, target.y);
    const cheb = chebTiles(m.tx, m.ty, ptx, pty);
    const provoked = d < MONSTER_AGGRO_RANGE || m.aggroT > 0;
    const rd = MONSTER_DEFS[m.kind].ranged;

    // ---- attacks (cadence-gated, independent of the glide phase) ----
    if (!target.dead && provoked && cheb <= 1) {
      // adjacent: the ordinary melee exchange — shooters stab with their
      // (weaker) melee roll when cornered, exactly the old behaviour
      if (m.atkCd <= 0) {
        m.atkCd = m.atkRate;
        onHit(m, false);
      }
      // an adjacent creature holds its square (no movement) — but still
      // finish any glide already in flight so it settles on its centre
      glideWalker(m, m.speed * dt);
      continue;
    }
    if (rd && !target.dead && provoked && cheb > 1 && d <= rd.range
      && lineOfSight(w, m.x, m.y, target.x, target.y)) {
      if (m.atkCd <= 0) {
        m.atkCd = m.atkRate;
        // cosmetic projectile, instant hit — same contract as the player's bow
        w.shots.push({
          fromX: m.x, fromY: m.y - 16,
          toX: target.x, toY: target.y - 12,
          p: 0, dur: Math.max(0.06, d / SHOT_SPEED),
          bone: false, color: rd.color ?? "#cfd8da", wide: rd.wide,
        });
        onHit(m, true);
      }
      if (!rd.brute) {
        // distance fighter (Tibia-style): hold ground in range; back away
        // tile by tile when the player closes in. With the retreat blocked
        // (walls, pack mates) it simply stands and keeps firing.
        const keepTiles = Math.max(2, Math.round(Math.min(rd.range * 0.5, 128) / TILE));
        let budget = m.speed * dt;
        for (;;) {
          budget = glideWalker(m, budget);
          if (budget <= 0) break;
          if (chebTiles(m.tx, m.ty, ptx, pty) >= keepTiles) break;
          if (!retreatStep(m, occ)) break;
          m.bob += 0.4;
        }
        continue;
      }
      // a brute shooter (the dragon) does NOT kite — fall through to chase
    }

    if (!target.dead && provoked && cheb > 1 && lineOfSight(w, m.x, m.y, target.x, target.y)) {
      // ---- tile-grid chase ----
      let budget = m.speed * dt;
      for (;;) {
        budget = glideWalker(m, budget);
        if (budget <= 0) break;
        if (chebTiles(m.tx, m.ty, ptx, pty) <= 1) break; // arrived at the ring
        if (!chaseStep(m, occ, ptx, pty)) break;
      }
      m.bob += dt * 9;
      continue;
    }

    // ---- idle: wander / home leash ----
    let budget = m.speed * 0.5 * dt;
    budget = glideWalker(m, budget);
    if (budget > 0) {
      const leashed = m.hr && m.hx !== undefined && m.hy !== undefined
        && dist(m.x, m.y, m.hx, m.hy) > m.hr;
      if (leashed && m.hx !== undefined && m.hy !== undefined) {
        // drifted beyond its camp: turn back toward home, square by square
        const hx = toTile(m.hx);
        const hy = toTile(m.hy);
        if (chaseStep(m, occ, hx, hy)) m.bob += dt * 6;
      } else {
        m.wanderT -= dt;
        if (m.wanderT <= 0) {
          m.wanderT = rnd(1, 3);
          if (Math.random() >= 0.4) {
            const [sx, sy] = STEPS8[rndi(0, 7)];
            if (step(m, sx, sy, occ)) m.bob += dt * 6;
          }
        }
      }
    } else {
      m.bob += dt * 6; // still gliding a wander step
    }
  }
}
