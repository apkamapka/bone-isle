/** Monster definitions, danger-band spawning and the wander/chase/attack AI. */
import { rnd, rndi, wrnd, dist } from "../util.ts";
import { WILD_ENTRANCE_SAFE_PX, BODY_SEPARATION_PX, SPAWN_SPACING_PX, SPAWN_AVOID_PLAYER_PX } from "../config.ts";
import { SPR } from "../gfx/sprites.ts";
import { moveEntity, randomWalkable, lineOfSight, stepAllowed } from "../world/collision.ts";
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
  ghost: {
    spr: SPR.ghost, hp: 60, dmg: [6, 17], speed: 42, atkRate: 2.0, exp: 48, gold: [4, 10], danger: 0.56,
    loot: [{ kind: "fireCrystal", chance: 0.35, n: [2, 4] }, { kind: "ring", chance: 0.04, n: [1, 1] }, { kind: "fireRuby", chance: 0.07, n: [1, 1] }],
  },
  orc: {
    spr: SPR.orc, hp: 90, dmg: [8, 23], speed: 28, atkRate: 2.0, exp: 55, gold: [6, 14], danger: 0.62,
    loot: [{ kind: "meat", chance: 0.5, n: [1, 2] }, { kind: "ironSword", chance: 0.06, n: [1, 1] }, { kind: "fireRuby", chance: 0.05, n: [1, 1] }],
  },
  bear: {
    spr: SPR.bear, hp: 120, dmg: [9, 25], speed: 30, atkRate: 2.0, exp: 70, gold: [4, 10], danger: 0.7,
    loot: [{ kind: "meat", chance: 0.7, n: [1, 3] }],
  },
  minotaur: {
    spr: SPR.minotaur, hp: 140, dmg: [12, 33], speed: 30, atkRate: 2.0, exp: 95, gold: [8, 18], danger: 0.8,
    loot: [{ kind: "bones", chance: 0.6, n: [1, 3] }, { kind: "meat", chance: 0.4, n: [1, 2] }, { kind: "ironSword", chance: 0.05, n: [1, 1] }],
  },
  troll: {
    spr: SPR.troll, hp: 160, dmg: [10, 27], speed: 24, atkRate: 2.0, exp: 110, gold: [12, 28], danger: 0.9,
    loot: [{ kind: "bones", chance: 0.8, n: [2, 4] }, { kind: "boneSword", chance: 0.05, n: [1, 1] }, { kind: "amulet", chance: 0.03, n: [1, 1] }, { kind: "fireRuby", chance: 0.12, n: [1, 1] }],
  },
  cyclops: {
    spr: SPR.cyclops, hp: 240, dmg: [14, 40], speed: 26, atkRate: 2.0, exp: 180, gold: [14, 30], danger: 0.95,
    loot: [{ kind: "bones", chance: 0.7, n: [2, 4] }, { kind: "fireRuby", chance: 0.15, n: [1, 1] }, { kind: "boneSword", chance: 0.06, n: [1, 1] }, { kind: "amulet", chance: 0.05, n: [1, 1] }],
  },
  boneLord: {
    spr: SPR.boneLord, hp: 340, dmg: [18, 49], speed: 22, atkRate: 2.0, exp: 300, gold: [25, 50], danger: 0.99,
    loot: [{ kind: "fireRuby", chance: 0.3, n: [1, 2] }, { kind: "boneSword", chance: 0.12, n: [1, 1] }, { kind: "amulet", chance: 0.08, n: [1, 1] }, { kind: "ring", chance: 0.06, n: [1, 1] }],
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
export function spawnMonster(w: World, kind: MonsterKind, avoid?: { x: number; y: number }): boolean {
  const d = MONSTER_DEFS[kind];
  const entrance = w.portals[0];
  const ex = entrance ? entrance.x : (w.w / 2) * 16;
  const ey = entrance ? entrance.y : (w.h / 2) * 16;
  // farthest a tile can sit from the entrance ≈ span to the opposite corner
  const maxD = Math.max(
    dist(ex, ey, 0, 0), dist(ex, ey, w.w * 16, 0),
    dist(ex, ey, 0, w.h * 16), dist(ex, ey, w.w * 16, w.h * 16),
  ) || 1;

  let match: { x: number; y: number } | null = null;   // spaced + right danger band
  let spaced: { x: number; y: number } | null = null;  // spaced, wrong band
  let fallback: { x: number; y: number } | null = null; // passes hard constraints only
  for (let tries = 0; tries < 40 && !match; tries++) {
    const cand = randomWalkable(w);
    const dd = dist(cand.x, cand.y, ex, ey);
    if (dd < WILD_ENTRANCE_SAFE_PX) continue; // keep the arrival area clear
    if (avoid && dist(cand.x, cand.y, avoid.x, avoid.y) < SPAWN_AVOID_PLAYER_PX) continue;
    fallback ??= cand;
    if (!w.monsters.every((m) => dist(m.x, m.y, cand.x, cand.y) >= SPAWN_SPACING_PX)) continue;
    spaced ??= cand;
    if (Math.abs(dd / maxD - d.danger) < 0.16) match = cand;
  }
  // a fresh populate must never lose a creature — but a respawn near a camping
  // player simply reports failure and gets retried by the caller
  const p = match ?? spaced ?? (avoid ? null : fallback ?? randomWalkable(w));
  if (!p) return false;

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
    orbit: wrnd(0, 1) < 0.5 ? 1 : -1,
  });
  return true;
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
  // every creature body-blocks every other one, and the player blocks them all
  const blockers: { x: number; y: number }[] = [target, ...w.monsters];
  for (const m of w.monsters) {
    m.hurtT = Math.max(0, m.hurtT - dt);
    m.atkCd -= dt;
    const d = dist(m.x, m.y, target.x, target.y);
    // chase only what it can actually see — cave walls break line of sight,
    // so creatures in the next chamber stay put instead of chasing through rock
    if (!target.dead && d < 82 && d > 13 && lineOfSight(w, m.x, m.y, target.x, target.y)) {
      // Steered chase: try the direct step first; if a body (usually the pack
      // mate in front) blocks it, probe steps at growing angles, preferring
      // the monster's own detour side. The last pair sits just past 90° —
      // a purely tangential orbit around the blocker (any smaller angle still
      // closes the distance to it and is rightly refused by body blocking).
      // Half the pack circles left, half right, so instead of queueing in a
      // line they flow around each other and SURROUND the target, exactly the
      // Tibia feel. In a walled corridor every angle is blocked and they
      // correctly queue single-file.
      const base = Math.atan2(target.y - m.y, target.x - m.x);
      const step = m.speed * dt;
      const s = m.orbit;
      let stepped = false;
      for (const a of [0, 0.5 * s, -0.5 * s, 0.95 * s, -0.95 * s, 1.35 * s, -1.35 * s, 1.7 * s, -1.7 * s]) {
        const dx = Math.cos(base + a) * step;
        const dy = Math.sin(base + a) * step;
        if (stepAllowed(w, m, dx, dy, blockers)) {
          m.x += dx;
          m.y += dy;
          stepped = true;
          break;
        }
      }
      // axis-sliding fallback keeps the old wall-hugging behaviour near terrain
      if (!stepped) moveEntity(w, m, Math.cos(base) * step, Math.sin(base) * step, blockers);
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
        moveEntity(w, m, m.wx * m.speed * 0.5 * dt, m.wy * m.speed * 0.5 * dt, blockers);
        m.bob += dt * 6;
      }
    }
  }

  // positional correction: resolve any residual overlaps (spawns, portals,
  // legacy saves) by pushing pairs apart. Between monsters the soft target is
  // slightly WIDER than the hard body distance — this evens out the attack
  // ring (opening gaps newcomers can join through) and frees a chaser wedged
  // in the "V" between two ring members, where every step would otherwise be
  // body-blocked.
  const SOFT = BODY_SEPARATION_PX + 1.5;
  for (let i = 0; i < w.monsters.length; i++) {
    for (let j = i + 1; j < w.monsters.length; j++) {
      const a = w.monsters[i];
      const b = w.monsters[j];
      const d = dist(a.x, a.y, b.x, b.y);
      if (d < SOFT && d > 0.01) {
        const push = (SOFT - d) * 2.5 * dt + 2 * dt;
        const px = (a.x - b.x) / d;
        const py = (a.y - b.y) / d;
        moveEntity(w, a, px * push, py * push);
        moveEntity(w, b, -px * push, -py * push);
      }
    }
    // …and never let a creature rest on top of the player
    const m = w.monsters[i];
    const dp = dist(m.x, m.y, target.x, target.y);
    if (dp < BODY_SEPARATION_PX && dp > 0.01) {
      const push = (BODY_SEPARATION_PX - dp) * 3 * dt + 2 * dt;
      moveEntity(w, m, ((m.x - target.x) / dp) * push, ((m.y - target.y) / dp) * push);
    }
  }
}
