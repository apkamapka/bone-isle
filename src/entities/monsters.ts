/** Monster definitions, spawning and the wander/chase/attack AI. */
import { rnd, dist } from "../util.ts";
import { SPR } from "../gfx/sprites.ts";
import { moveEntity, randomWalkable } from "../world/collision.ts";
import type { World, Monster, MonsterKind } from "../world/types.ts";

export interface MonsterDef {
  spr: HTMLCanvasElement;
  hp: number;
  dmg: readonly [number, number];
  speed: number;
  atkRate: number;
  exp: number;
  drop: "bones" | "coins";
  dropN: readonly [number, number];
}

export const MONSTER_DEFS: Readonly<Record<MonsterKind, MonsterDef>> = {
  skeleton: { spr: SPR.skeleton, hp: 30, dmg: [3, 6], speed: 19, atkRate: 1.3, exp: 15, drop: "bones", dropN: [1, 2] },
  goblin: { spr: SPR.goblin, hp: 55, dmg: [5, 9], speed: 35, atkRate: 1.0, exp: 30, drop: "coins", dropN: [1, 3] },
};

/** Spawn one monster of `kind` at a random walkable tile in `w`. */
export function spawnMonster(w: World, kind: MonsterKind): void {
  const d = MONSTER_DEFS[kind];
  const p = randomWalkable(w);
  w.monsters.push({
    kind,
    x: p.x,
    y: p.y,
    spr: d.spr,
    hp: d.hp,
    maxhp: d.hp,
    speed: d.speed,
    atkRate: d.atkRate,
    atkCd: rnd(0, 1),
    wanderT: rnd(0, 2),
    wx: 0,
    wy: 0,
    bob: rnd(0, 3),
    hurtT: 0,
  });
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
    if (!target.dead && d < 75 && d > 13) {
      // chase
      const vx = (target.x - m.x) / d;
      const vy = (target.y - m.y) / d;
      moveEntity(w, m, vx * m.speed * dt, vy * m.speed * dt);
      m.bob += dt * 9;
    } else if (!target.dead && d <= 13) {
      // attack
      if (m.atkCd <= 0) {
        m.atkCd = m.atkRate;
        onHit(m);
      }
    } else {
      // wander
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
