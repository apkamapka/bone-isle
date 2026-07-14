/** Monster definitions, danger-band spawning and the wander/chase/attack AI. */
import { rnd, rndi, wrnd, dist } from "../util.ts";
import { WILD_ENTRANCE_SAFE_PX } from "../config.ts";
import { SPR } from "../gfx/sprites.ts";
import { moveEntity, randomWalkable, lineOfSight } from "../world/collision.ts";
import type { World, Monster, MonsterKind } from "../world/types.ts";
import type { ItemKind } from "../items.ts";

/** A weighted loot entry: item, drop chance, and min/max quantity. */
export interface LootEntry {
  kind: ItemKind;
  chance: number;
  n: readonly [number, number];
}

export interface MonsterDef {
  spr: HTMLCanvasElement;
  hp: number;
  dmg: readonly [number, number];
  speed: number;
  atkRate: number;
  exp: number;
  gold: readonly [number, number];
  loot: readonly LootEntry[];
  /** Danger band: how far from the town-side coast it spawns (0..1). */
  danger: number;
}

/**
 * The bestiary, ordered from the entrance outward. `danger` is the spawn band:
 * distance from the Wildlands entrance (0 = the arrival coast, 1 = the farthest
 * reaches). The six original creatures keep their stats — only their bands were
 * re-tuned to the new distance-from-entrance gradient; the other seven fill and
 * extend the difficulty curve so tougher foes are discovered further in.
 */
export const MONSTER_DEFS: Readonly<Record<MonsterKind, MonsterDef>> = {
  rat: {
    spr: SPR.rat, hp: 10, dmg: [1, 3], speed: 30, atkRate: 1.1, exp: 5, gold: [0, 1], danger: 0.06,
    loot: [{ kind: "meat", chance: 0.15, n: [1, 1] }],
  },
  spider: {
    spr: SPR.spider, hp: 22, dmg: [2, 5], speed: 40, atkRate: 1.1, exp: 12, gold: [0, 2], danger: 0.14,
    loot: [{ kind: "silk", chance: 0.7, n: [1, 2] }],
  },
  bat: {
    spr: SPR.bat, hp: 16, dmg: [2, 4], speed: 54, atkRate: 1.0, exp: 10, gold: [0, 2], danger: 0.2,
    loot: [{ kind: "meat", chance: 0.2, n: [1, 1] }],
  },
  skeleton: {
    spr: SPR.skeleton, hp: 34, dmg: [4, 7], speed: 20, atkRate: 1.3, exp: 18, gold: [1, 4], danger: 0.3,
    loot: [{ kind: "bones", chance: 0.9, n: [1, 3] }],
  },
  goblin: {
    spr: SPR.goblin, hp: 52, dmg: [5, 9], speed: 34, atkRate: 1.0, exp: 30, gold: [3, 8], danger: 0.4,
    loot: [{ kind: "meat", chance: 0.4, n: [1, 1] }, { kind: "hpPotion", chance: 0.12, n: [1, 1] }],
  },
  wolf: {
    spr: SPR.wolf, hp: 44, dmg: [5, 9], speed: 48, atkRate: 0.9, exp: 26, gold: [1, 4], danger: 0.5,
    loot: [{ kind: "meat", chance: 0.6, n: [1, 2] }],
  },
  ghost: {
    spr: SPR.ghost, hp: 60, dmg: [7, 12], speed: 42, atkRate: 1.4, exp: 48, gold: [4, 10], danger: 0.56,
    loot: [{ kind: "fireCrystal", chance: 0.35, n: [2, 4] }, { kind: "ring", chance: 0.04, n: [1, 1] }, { kind: "fireRuby", chance: 0.07, n: [1, 1] }],
  },
  orc: {
    spr: SPR.orc, hp: 90, dmg: [8, 14], speed: 28, atkRate: 1.2, exp: 55, gold: [6, 14], danger: 0.62,
    loot: [{ kind: "meat", chance: 0.5, n: [1, 2] }, { kind: "ironSword", chance: 0.06, n: [1, 1] }, { kind: "fireRuby", chance: 0.05, n: [1, 1] }],
  },
  bear: {
    spr: SPR.bear, hp: 120, dmg: [9, 15], speed: 30, atkRate: 1.2, exp: 70, gold: [4, 10], danger: 0.7,
    loot: [{ kind: "meat", chance: 0.7, n: [1, 3] }],
  },
  minotaur: {
    spr: SPR.minotaur, hp: 140, dmg: [11, 18], speed: 30, atkRate: 1.1, exp: 95, gold: [8, 18], danger: 0.8,
    loot: [{ kind: "bones", chance: 0.6, n: [1, 3] }, { kind: "meat", chance: 0.4, n: [1, 2] }, { kind: "ironSword", chance: 0.05, n: [1, 1] }],
  },
  troll: {
    spr: SPR.troll, hp: 160, dmg: [12, 20], speed: 24, atkRate: 1.5, exp: 110, gold: [12, 28], danger: 0.9,
    loot: [{ kind: "bones", chance: 0.8, n: [2, 4] }, { kind: "boneSword", chance: 0.05, n: [1, 1] }, { kind: "amulet", chance: 0.03, n: [1, 1] }, { kind: "fireRuby", chance: 0.12, n: [1, 1] }],
  },
  cyclops: {
    spr: SPR.cyclops, hp: 240, dmg: [16, 26], speed: 26, atkRate: 1.3, exp: 180, gold: [14, 30], danger: 0.95,
    loot: [{ kind: "bones", chance: 0.7, n: [2, 4] }, { kind: "fireRuby", chance: 0.15, n: [1, 1] }, { kind: "boneSword", chance: 0.06, n: [1, 1] }, { kind: "amulet", chance: 0.05, n: [1, 1] }],
  },
  boneLord: {
    spr: SPR.boneLord, hp: 340, dmg: [20, 34], speed: 22, atkRate: 1.4, exp: 300, gold: [25, 50], danger: 0.99,
    loot: [{ kind: "fireRuby", chance: 0.3, n: [1, 2] }, { kind: "boneSword", chance: 0.12, n: [1, 1] }, { kind: "amulet", chance: 0.08, n: [1, 1] }, { kind: "ring", chance: 0.06, n: [1, 1] }],
  },
};

export const MONSTER_KINDS = Object.keys(MONSTER_DEFS) as MonsterKind[];

/**
 * Spawn one monster of `kind`, placed by its danger band: distance from the
 * Wildlands entrance portal, normalised so 0 is the arrival coast and ~1 the
 * farthest reaches. Nothing spawns within the entrance safe radius, so weak
 * creatures ring the landing and the deadliest lurk deep in the far corners.
 */
export function spawnMonster(w: World, kind: MonsterKind): void {
  const d = MONSTER_DEFS[kind];
  const entrance = w.portals[0];
  const ex = entrance ? entrance.x : (w.w / 2) * 16;
  const ey = entrance ? entrance.y : (w.h / 2) * 16;
  // farthest a tile can sit from the entrance ≈ span to the opposite corner
  const maxD = Math.max(
    dist(ex, ey, 0, 0), dist(ex, ey, w.w * 16, 0),
    dist(ex, ey, 0, w.h * 16), dist(ex, ey, w.w * 16, w.h * 16),
  ) || 1;

  let match: { x: number; y: number } | null = null;
  let fallback = randomWalkable(w);
  for (let tries = 0; tries < 28 && !match; tries++) {
    const cand = randomWalkable(w);
    const dd = dist(cand.x, cand.y, ex, ey);
    if (dd < WILD_ENTRANCE_SAFE_PX) continue; // keep the arrival area clear
    fallback = cand;
    if (Math.abs(dd / maxD - d.danger) < 0.16) match = cand;
  }
  const p = match ?? fallback;

  w.monsters.push({
    kind,
    x: p.x,
    y: p.y,
    spr: d.spr,
    hp: d.hp,
    maxhp: d.hp,
    speed: d.speed,
    atkRate: d.atkRate,
    atkCd: wrnd(0, 1),
    wanderT: wrnd(0, 2),
    wx: 0,
    wy: 0,
    bob: wrnd(0, 3),
    hurtT: 0,
  });
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
  dead: boolean;
}

/**
 * Advance every monster in `w`. When a monster reaches the target it calls
 * `onHit(monster)` so the caller (combat system) applies damage to the player.
 */
export function updateMonsters(
  w: World,
  dt: number,
  target: AttackTarget,
  onHit: (m: Monster) => void,
): void {
  for (const m of w.monsters) {
    m.hurtT = Math.max(0, m.hurtT - dt);
    m.atkCd -= dt;
    const d = dist(m.x, m.y, target.x, target.y);
    // chase only what it can actually see — cave walls break line of sight,
    // so creatures in the next chamber stay put instead of chasing through rock
    if (!target.dead && d < 82 && d > 13 && lineOfSight(w, m.x, m.y, target.x, target.y)) {
      const vx = (target.x - m.x) / d;
      const vy = (target.y - m.y) / d;
      moveEntity(w, m, vx * m.speed * dt, vy * m.speed * dt);
      m.bob += dt * 9;
    } else if (!target.dead && d <= 13) {
      if (m.atkCd <= 0) {
        m.atkCd = m.atkRate;
        onHit(m);
      }
    } else {
      m.wanderT -= dt;
      if (m.wanderT <= 0) {
        m.wanderT = rnd(1, 3);
        if (Math.random() < 0.4) {
          m.wx = 0;
          m.wy = 0;
        } else {
          const a = rnd(0, 6.28);
          m.wx = Math.cos(a);
          m.wy = Math.sin(a);
        }
      }
      if (m.wx || m.wy) {
        moveEntity(w, m, m.wx * m.speed * 0.5 * dt, m.wy * m.speed * 0.5 * dt);
        m.bob += dt * 6;
      }
    }
  }

  // gentle separation so monsters don't stack on one tile
  for (let i = 0; i < w.monsters.length; i++) {
    for (let j = i + 1; j < w.monsters.length; j++) {
      const a = w.monsters[i];
      const b = w.monsters[j];
      const d = dist(a.x, a.y, b.x, b.y);
      if (d < 8 && d > 0.01) {
        const px = (a.x - b.x) / d;
        const py = (a.y - b.y) / d;
        moveEntity(w, a, px * 8 * dt, py * 8 * dt);
        moveEntity(w, b, -px * 8 * dt, -py * 8 * dt);
      }
    }
  }
}
