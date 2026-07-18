/** Monster definitions, danger-band spawning and the wander/chase/attack AI. */
import { rnd, rndi, wrnd, dist } from "../util.ts";
import { WILD_ENTRANCE_SAFE_PX, SPAWN_SPACING_PX, SPAWN_AVOID_PLAYER_PX, MONSTER_AGGRO_RANGE, SHOT_SPEED, TILE } from "../config.ts";
import { SPR } from "../gfx/sprites.ts";
import { randomWalkable, lineOfSight } from "../world/collision.ts";
import { toTile, tileCenter, glideWalker, tryStep, chebTiles, octile, STEPS8, walkable } from "../world/grid.ts";
import type { Occupied } from "../world/grid.ts";
import { Tile } from "../world/types.ts";
import type { World, Monster, MonsterKind, Camp } from "../world/types.ts";
import type { ItemKind } from "../items.ts";

/** A weighted loot entry: item, drop chance, and min/max quantity. */
export interface LootEntry {
  kind: ItemKind;
  chance: number;
  n: readonly [number, number];
}

/** A monster's ranged attack (archers, shamans, dragon fire). */
export interface RangedDef {
  /** Firing reach in px. Must stay under MONSTER_AGGRO_RANGE so a shooter
   *  never plinks the player from beyond its own awareness. */
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
export const MONSTER_DEFS: Readonly<Record<MonsterKind, MonsterDef>> = {
  rat: {
    spr: SPR.rat, hp: 10, dmg: [1, 5], speed: 30, atkRate: 2.0, exp: 5, gold: [0, 1], danger: 0.06,
    loot: [{ kind: "meat", chance: 0.15, n: [1, 1] }],
  },
  snake: {
    spr: SPR.snake, hp: 14, dmg: [2, 7], speed: 34, atkRate: 2.0, exp: 8, gold: [0, 1], danger: 0.1,
    loot: [{ kind: "venomGland", chance: 0.25, n: [1, 1] }],
  },
  crab: {
    spr: SPR.crab, hp: 26, dmg: [2, 8], speed: 22, atkRate: 2.0, exp: 11, gold: [0, 2], danger: 0.12,
    loot: [{ kind: "meat", chance: 0.4, n: [1, 1] }, { kind: "shell", chance: 0.3, n: [1, 1] }],
  },
  wasp: {
    spr: SPR.wasp, hp: 18, dmg: [4, 11], speed: 60, atkRate: 2.0, exp: 15, gold: [0, 0], danger: 0.18,
    loot: [{ kind: "venomGland", chance: 0.15, n: [1, 1] }],
  },
  poisonSpider: {
    // the first shooter you meet: spits venom, then bites weakly if cornered
    spr: SPR.poisonSpider, hp: 30, dmg: [2, 6], speed: 40, atkRate: 2.0, exp: 20, gold: [0, 3], danger: 0.35,
    ranged: { range: 90, dmg: [4, 9], color: "#7dbb3f" },
    loot: [{ kind: "silk", chance: 0.6, n: [1, 2] }, { kind: "venomGland", chance: 0.35, n: [1, 1] }],
  },
  spider: {
    spr: SPR.spider, hp: 22, dmg: [3, 9], speed: 40, atkRate: 2.0, exp: 12, gold: [0, 2], danger: 0.14,
    loot: [{ kind: "silk", chance: 0.7, n: [1, 2] }],
  },
  bat: {
    spr: SPR.bat, hp: 16, dmg: [3, 8], speed: 54, atkRate: 2.0, exp: 10, gold: [0, 2], danger: 0.2,
    loot: [{ kind: "meat", chance: 0.2, n: [1, 1] }],
  },
  skeleton: {
    spr: SPR.skeleton, hp: 34, dmg: [4, 11], speed: 20, atkRate: 2.0, exp: 18, gold: [1, 4], danger: 0.3,
    loot: [{ kind: "bones", chance: 0.9, n: [1, 3] }],
  },
  goblin: {
    spr: SPR.goblin, hp: 52, dmg: [6, 18], speed: 34, atkRate: 2.0, exp: 30, gold: [3, 8], danger: 0.4,
    loot: [{ kind: "meat", chance: 0.4, n: [1, 1] }, { kind: "hpPotion", chance: 0.12, n: [1, 1] }],
  },
  wolf: {
    spr: SPR.wolf, hp: 44, dmg: [7, 20], speed: 48, atkRate: 2.0, exp: 26, gold: [1, 4], danger: 0.5,
    loot: [{ kind: "meat", chance: 0.6, n: [1, 2] }],
  },
  rotworm: {
    spr: SPR.rotworm, hp: 55, dmg: [4, 13], speed: 16, atkRate: 2.0, exp: 24, gold: [1, 5], danger: 0.33,
    loot: [{ kind: "meat", chance: 0.6, n: [1, 2] }, { kind: "hpPotion", chance: 0.08, n: [1, 1] }],
  },
  amazon: {
    spr: SPR.amazon, hp: 60, dmg: [4, 10], speed: 36, atkRate: 2.0, exp: 35, gold: [4, 10], danger: 0.5,
    ranged: { range: 95, dmg: [5, 14] }, // thrown knives
    loot: [{ kind: "leatherArmor", chance: 0.05, n: [1, 1] }, { kind: "hpPotion", chance: 0.1, n: [1, 1] }],
  },
  warWolf: {
    spr: SPR.warWolf, hp: 70, dmg: [9, 24], speed: 52, atkRate: 2.0, exp: 40, gold: [1, 5], danger: 0.45,
    loot: [{ kind: "meat", chance: 0.7, n: [1, 2] }, { kind: "wolfFur", chance: 0.4, n: [1, 1] }],
  },
  ghoul: {
    spr: SPR.ghoul, hp: 85, dmg: [7, 19], speed: 30, atkRate: 2.0, exp: 45, gold: [2, 8], danger: 0.5,
    loot: [{ kind: "bones", chance: 0.8, n: [1, 3] }, { kind: "ghoulClaw", chance: 0.2, n: [1, 1] }],
  },
  ghost: {
    spr: SPR.ghost, hp: 60, dmg: [6, 17], speed: 42, atkRate: 2.0, exp: 48, gold: [4, 10], danger: 0.56,
    loot: [{ kind: "fireCrystal", chance: 0.35, n: [2, 4] }, { kind: "ring", chance: 0.04, n: [1, 1] }, { kind: "fireRuby", chance: 0.07, n: [1, 1] }],
  },
  orc: {
    spr: SPR.orc, hp: 90, dmg: [8, 23], speed: 28, atkRate: 2.0, exp: 55, gold: [6, 14], danger: 0.62,
    loot: [{ kind: "meat", chance: 0.5, n: [1, 2] }, { kind: "ironSword", chance: 0.06, n: [1, 1] }, { kind: "fireRuby", chance: 0.05, n: [1, 1] }],
  },
  orcSpearman: {
    spr: SPR.orcSpearman, hp: 80, dmg: [5, 13], speed: 32, atkRate: 2.0, exp: 58, gold: [5, 12], danger: 0.55,
    ranged: { range: 110, dmg: [6, 17], color: "#b98a4e" }, // hurled spears
    loot: [{ kind: "boneArrow", chance: 0.4, n: [2, 6] }, { kind: "meat", chance: 0.3, n: [1, 1] }],
  },
  bear: {
    spr: SPR.bear, hp: 120, dmg: [9, 25], speed: 30, atkRate: 2.0, exp: 70, gold: [4, 10], danger: 0.7,
    loot: [{ kind: "meat", chance: 0.7, n: [1, 3] }],
  },
  orcWarrior: {
    spr: SPR.orcWarrior, hp: 125, dmg: [10, 28], speed: 30, atkRate: 2.0, exp: 78, gold: [8, 18], danger: 0.6,
    loot: [{ kind: "chainArmor", chance: 0.04, n: [1, 1] }, { kind: "ironSword", chance: 0.08, n: [1, 1] }, { kind: "meat", chance: 0.4, n: [1, 1] }],
  },
  hunter: {
    spr: SPR.hunter, hp: 100, dmg: [5, 14], speed: 34, atkRate: 2.0, exp: 85, gold: [6, 15], danger: 0.62,
    ranged: { range: 140, dmg: [8, 22] },
    loot: [{ kind: "arrow", chance: 0.7, n: [5, 15] }, { kind: "bow", chance: 0.04, n: [1, 1] }, { kind: "meat", chance: 0.3, n: [1, 1] }],
  },
  minotaur: {
    spr: SPR.minotaur, hp: 140, dmg: [12, 33], speed: 30, atkRate: 2.0, exp: 95, gold: [8, 18], danger: 0.8,
    loot: [{ kind: "bones", chance: 0.6, n: [1, 3] }, { kind: "meat", chance: 0.4, n: [1, 2] }, { kind: "ironSword", chance: 0.05, n: [1, 1] }],
  },
  minotaurArcher: {
    spr: SPR.minotaurArcher, hp: 130, dmg: [6, 16], speed: 30, atkRate: 2.0, exp: 100, gold: [8, 16], danger: 0.68,
    ranged: { range: 150, dmg: [9, 26], color: "#efe9d6" }, // bone-tipped bolts
    loot: [{ kind: "boneArrow", chance: 0.6, n: [3, 10] }, { kind: "longbow", chance: 0.03, n: [1, 1] }],
  },
  orcShaman: {
    spr: SPR.orcShaman, hp: 110, dmg: [5, 13], speed: 26, atkRate: 2.0, exp: 115, gold: [10, 22], danger: 0.72,
    ranged: { range: 130, dmg: [8, 20], color: "#8a6cff" }, // crackling magic bolt
    loot: [{ kind: "fireCrystal", chance: 0.4, n: [1, 3] }, { kind: "healCrystal", chance: 0.2, n: [1, 2] }, { kind: "fireRuby", chance: 0.1, n: [1, 1] }],
  },
  troll: {
    spr: SPR.troll, hp: 160, dmg: [10, 27], speed: 24, atkRate: 2.0, exp: 110, gold: [12, 28], danger: 0.9,
    loot: [{ kind: "bones", chance: 0.8, n: [2, 4] }, { kind: "boneSword", chance: 0.05, n: [1, 1] }, { kind: "amulet", chance: 0.03, n: [1, 1] }, { kind: "fireRuby", chance: 0.12, n: [1, 1] }],
  },
  mummy: {
    spr: SPR.mummy, hp: 180, dmg: [12, 30], speed: 22, atkRate: 2.0, exp: 130, gold: [10, 24], danger: 0.75,
    loot: [{ kind: "bones", chance: 0.7, n: [1, 3] }, { kind: "amulet", chance: 0.05, n: [1, 1] }, { kind: "ring", chance: 0.05, n: [1, 1] }, { kind: "fireRuby", chance: 0.1, n: [1, 1] }],
  },
  orcBerserker: {
    spr: SPR.orcBerserker, hp: 210, dmg: [15, 38], speed: 44, atkRate: 2.0, exp: 155, gold: [12, 26], danger: 0.8,
    loot: [{ kind: "battleAxe", chance: 0.06, n: [1, 1] }, { kind: "meat", chance: 0.5, n: [1, 2] }, { kind: "fireRuby", chance: 0.12, n: [1, 1] }],
  },
  cyclops: {
    spr: SPR.cyclops, hp: 240, dmg: [14, 40], speed: 26, atkRate: 2.0, exp: 180, gold: [14, 30], danger: 0.95,
    loot: [{ kind: "bones", chance: 0.7, n: [2, 4] }, { kind: "fireRuby", chance: 0.15, n: [1, 1] }, { kind: "boneSword", chance: 0.06, n: [1, 1] }, { kind: "amulet", chance: 0.05, n: [1, 1] }],
  },
  minotaurGuard: {
    spr: SPR.minotaurGuard, hp: 280, dmg: [16, 42], speed: 28, atkRate: 2.0, exp: 210, gold: [16, 34], danger: 0.85,
    loot: [{ kind: "steelShield", chance: 0.05, n: [1, 1] }, { kind: "chainArmor", chance: 0.06, n: [1, 1] }, { kind: "bones", chance: 0.6, n: [2, 4] }, { kind: "fireRuby", chance: 0.15, n: [1, 1] }],
  },
  minotaurMage: {
    spr: SPR.minotaurMage, hp: 220, dmg: [8, 20], speed: 26, atkRate: 2.0, exp: 240, gold: [18, 38], danger: 0.9,
    ranged: { range: 140, dmg: [12, 32], color: "#ff8a3a", wide: true }, // fire bolt
    loot: [{ kind: "fireCrystal", chance: 0.6, n: [2, 5] }, { kind: "fireRuby", chance: 0.2, n: [1, 1] }, { kind: "ring", chance: 0.06, n: [1, 1] }],
  },
  boneLord: {
    spr: SPR.boneLord, hp: 340, dmg: [18, 49], speed: 22, atkRate: 2.0, exp: 300, gold: [25, 50], danger: 0.99,
    loot: [{ kind: "fireRuby", chance: 0.3, n: [1, 2] }, { kind: "boneSword", chance: 0.12, n: [1, 1] }, { kind: "amulet", chance: 0.08, n: [1, 1] }, { kind: "ring", chance: 0.06, n: [1, 1] }],
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
    spr: SPR.dragon, hp: 1000, dmg: [45, 120], speed: 30, atkRate: 2.0, exp: 900, gold: [60, 140], danger: 0.99,
    ranged: { range: 160, dmg: [38, 100], color: "#ff5a2a", wide: true, brute: true }, // dragon fire
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
  w.monsters.push({
    kind,
    x: tileCenter(tx),
    y: tileCenter(ty),
    tx,
    ty,
    spr: d.spr,
    hp: d.hp,
    maxhp: d.hp,
    speed: d.speed,
    atkRate: d.atkRate,
    atkCd: wrnd(0, 1),
    wanderT: wrnd(0, 2),
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
    const rr = (camp.r - 20) * Math.sqrt(wrnd(0, 1));
    const x = camp.x + Math.cos(a) * rr;
    const y = camp.y + Math.sin(a) * rr;
    const tx = Math.floor(x / 16);
    const ty = Math.floor(y / 16);
    if (w.solid[ty]?.[tx] !== false || w.tile[ty][tx] === Tile.Water) continue;
    if (avoid && dist(x, y, avoid.x, avoid.y) < SPAWN_AVOID_PLAYER_PX) continue;
    // keep the descent hole clear so arrivals from the lair aren't body-blocked
    if (w.portals.some((pt) => dist(pt.x, pt.y, x, y) < 24)) continue;
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
    if (w.camps.some((c) => dist(c.x, c.y, cand.x, cand.y) < c.r + 48)) continue;
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
        // tag it so a slain guard respawns back onto its hoard
        w.monsters[w.monsters.length - 1].guard = { tx, ty };
        return true;
      }
    }
  }
  return false;
}

export function spawnMonster(w: World, kind: MonsterKind, avoid?: { x: number; y: number }, uniform = false): boolean {
  const d = MONSTER_DEFS[kind];
  const entrance = w.portals[0];
  const ex = entrance ? entrance.x : (w.w / 2) * 16;
  const ey = entrance ? entrance.y : (w.h / 2) * 16;
  // farthest a tile can sit from the entrance ≈ span to the opposite corner
  const maxD = Math.max(
    dist(ex, ey, 0, 0), dist(ex, ey, w.w * 16, 0),
    dist(ex, ey, 0, w.h * 16), dist(ex, ey, w.w * 16, w.h * 16),
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
  const occOf = (self: Monster): Occupied => (tx, ty) =>
    (tx === ptx && ty === pty) || w.monsters.some((o) => o !== self && o.tx === tx && o.ty === ty);

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
    return tryStep(w, m, pick[0], pick[1], occ);
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
    return tryStep(w, m, best[0], best[1], occ);
  };

  for (const m of w.monsters) {
    m.hurtT = Math.max(0, m.hurtT - dt);
    m.aggroT = Math.max(0, m.aggroT - dt);
    m.atkCd -= dt;
    const occ = occOf(m);
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
          fromX: m.x, fromY: m.y - 8,
          toX: target.x, toY: target.y - 6,
          p: 0, dur: Math.max(0.06, d / SHOT_SPEED),
          bone: false, color: rd.color ?? "#cfd8da", wide: rd.wide,
        });
        onHit(m, true);
      }
      if (!rd.brute) {
        // distance fighter (Tibia-style): hold ground in range; back away
        // tile by tile when the player closes in. With the retreat blocked
        // (walls, pack mates) it simply stands and keeps firing.
        const keepTiles = Math.max(2, Math.round(Math.min(rd.range * 0.5, 64) / TILE));
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
            if (tryStep(w, m, sx, sy, occ)) m.bob += dt * 6;
          }
        }
      }
    } else {
      m.bob += dt * 6; // still gliding a wander step
    }
  }
}
