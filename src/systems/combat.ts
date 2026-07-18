/** Combat: player hits monsters, monsters hit the player, corpses & leveling. */
import {
  expNeeded, totalExpFor, MONSTER_RESPAWN_S, CORPSE_DECAY_S, SHOT_SPEED, MONSTER_AGGRO_HIT_S,
  DEATH_PENALTY_LEVEL, DEATH_EXP_LOSS, DEATH_SKILL_LOSS, DEATH_EQ_DROP_CHANCE, PLAYER_CORPSE_DECAY_S,
  SHIELD_BLOCK_MAX, SHIELD_BLOCK_WINDOW_S,
} from "../config.ts";
import { beep } from "../audio.ts";
import { addFloat } from "../fx.ts";
import { MONSTER_DEFS, rollLoot } from "../entities/monsters.ts";
import { ITEMS, removeItem, emptyBag } from "../items.ts";
import { refreshDerived } from "../entities/player.ts";
import { structCenter } from "./building.ts";
import {
  addSkillXp, applySkillDeathLoss, attackPower, defenseShield, defenseArmor, distancePower,
  rollMeleeDamage, rollDistanceDamage, distanceHitChance,
} from "./skills.ts";
import type { ItemKind } from "../items.ts";
import { onMonsterKilled } from "./quests.ts";
import { onTaskKill } from "./tasks.ts";
import type { Player } from "../entities/player.ts";
import type { World, Monster, Structure } from "../world/types.ts";

/** Player strikes a monster. Returns true if the monster died. */
export function playerAttack(world: World, p: Player, m: Monster): boolean {
  const dmg = rollMeleeDamage(attackPower(p.level, p.eq));
  addSkillXp("sword", 1, (t) => addFloat(world, p.x, p.y - 26, t, "#7dff9e"));
  if (dmg <= 0) {
    // the classic Tibia whiff — the swing lands for nothing
    addFloat(world, m.x, m.y - 16, "poof", "#9aa0a8");
    beep(140, 0.05, "sine", 0.03);
    return false;
  }
  m.hp -= dmg;
  m.hurtT = 0.15;
  m.aggroT = MONSTER_AGGRO_HIT_S;
  addFloat(world, m.x, m.y - 16, String(dmg), "#ffe27a");
  beep(160, 0.07, "square", 0.05);
  if (m.hp <= 0) {
    killMonster(world, p, m);
    return true;
  }
  return false;
}

/**
 * Fire an arrow at a monster with the equipped bow. Consumes one `arrowKind`
 * from the bag, trains Distance Fighting, spawns a cosmetic projectile and
 * applies the hit instantly. Returns true if the monster died.
 */
export function playerShoot(world: World, p: Player, m: Monster, arrowKind: ItemKind): boolean {
  const arrowDmg = ITEMS[arrowKind].ammo?.dmg ?? 0;
  if (!removeItem(p.bag, arrowKind, 1)) return false;
  const flight = Math.hypot(m.x - p.x, m.y - p.y) / SHOT_SPEED;
  world.shots.push({
    fromX: p.x, fromY: p.y - 8,
    toX: m.x, toY: m.y - 6,
    p: 0, dur: Math.max(0.06, flight), bone: arrowKind === "boneArrow",
  });
  if (m.x < p.x) p.face = -1; else p.face = 1;
  beep(430, 0.06, "triangle", 0.045, -120);
  // accuracy first, Tibia-style: the arrow is spent either way, a miss trains
  // Distance once, a hit trains it DOUBLE (as in the real skill system)
  if (Math.random() > distanceHitChance()) {
    m.aggroT = MONSTER_AGGRO_HIT_S; // even a whizzing miss provokes the target
    addFloat(world, m.x, m.y - 16, "miss", "#9aa0a8");
    addSkillXp("dist", 1, (t) => addFloat(world, p.x, p.y - 26, t, "#7dff9e"));
    return false;
  }
  const dmg = rollDistanceDamage(distancePower(p.level, p.eq, arrowDmg), p.level);
  m.hp -= dmg;
  m.hurtT = 0.15;
  m.aggroT = MONSTER_AGGRO_HIT_S;
  addFloat(world, m.x, m.y - 16, String(dmg), "#bfe08a");
  addSkillXp("dist", 2, (t) => addFloat(world, p.x, p.y - 26, t, "#7dff9e"));
  if (m.hp <= 0) {
    killMonster(world, p, m);
    return true;
  }
  return false;
}

/**
 * Train Distance Fighting on a dummy by firing at it with a bow. Consumes one
 * arrow, spawns the projectile and shows the hit, but never destroys the dummy.
 */
export function shootDummy(world: World, p: Player, s: Structure, arrowKind: ItemKind): boolean {
  const arrowAtk = ITEMS[arrowKind].ammo?.dmg ?? 0;
  if (!removeItem(p.bag, arrowKind, 1)) return false;
  const dp = distancePower(p.level, p.eq, arrowAtk);
  const c = structCenter(s);
  const tx = c.x;
  const ty = c.baseY - 8;
  s.hurtT = 0.2;
  s.anim = 0;
  const flight = Math.hypot(tx - p.x, ty - p.y) / SHOT_SPEED;
  world.shots.push({ fromX: p.x, fromY: p.y - 8, toX: tx, toY: ty - 6, p: 0, dur: Math.max(0.06, flight), bone: arrowKind === "boneArrow" });
  if (Math.random() > distanceHitChance()) {
    addFloat(world, c.x, s.ty * 16 - 4, "miss", "#9aa0a8");
    addSkillXp("dist", 1, (t) => addFloat(world, p.x, p.y - 26, t, "#7dff9e"));
    return true;
  }
  const dmg = rollDistanceDamage(dp, p.level);
  addFloat(world, c.x, s.ty * 16 - 4, String(dmg), "#bfe08a");
  addSkillXp("dist", 2, (t) => addFloat(world, p.x, p.y - 26, t, "#7dff9e"));
  beep(430, 0.06, "triangle", 0.045, -120);
  return true;
}

/** Whack a training dummy: trains Sword Fighting, no death. */
export function hitDummy(world: World, p: Player, s: Structure): void {
  const dmg = rollMeleeDamage(attackPower(p.level, p.eq));
  s.hurtT = 0.2;
  s.anim = 0;
  addFloat(world, structCenter(s).x, s.ty * 16 - 4, dmg > 0 ? String(dmg) : "poof", dmg > 0 ? "#d8d2c0" : "#9aa0a8");
  addSkillXp("sword", 1, (t) => addFloat(world, p.x, p.y - 26, t, "#7dff9e"));
  // The War Dummy hits back for training value: also trains Shielding.
  if (s.key === "dummyII") addSkillXp("shield", 1, (t) => addFloat(world, p.x, p.y - 38, t, "#7dff9e"));
  beep(220, 0.05, "triangle", 0.05);
}

/** Grant xp and process any level-ups. */
export function grantExp(world: World, p: Player, exp: number): void {
  p.exp += exp;
  addFloat(world, p.x, p.y - 18, `+${exp} xp`, "#caa6ff");
  while (p.exp >= p.expNext) {
    p.exp -= p.expNext;
    p.level++;
    p.expNext = expNeeded(p.level);
    refreshDerived(p);
    p.hp = p.maxhp;
    addFloat(world, p.x, p.y - 24, "LEVEL UP!", "#7dff9e");
    beep(440, 0.1, "square", 0.06);
  }
}

/** Resolve a monster death: xp, level-ups, a lootable corpse, schedule respawn. */
export function killMonster(world: World, p: Player, m: Monster): void {
  const d = MONSTER_DEFS[m.kind];
  beep(220, 0.18, "sawtooth", 0.05, -160);
  grantExp(world, p, d.exp);

  const { items, gold } = rollLoot(m.kind);
  world.corpses.push({
    name: m.kind,
    x: m.x,
    y: m.y,
    items,
    gold,
    t: CORPSE_DECAY_S,
  });

  onMonsterKilled(m.kind, (t) => addFloat(world, p.x, p.y - 32, t, "#ffe9a8"));
  onTaskKill(m.kind);

  const idx = world.monsters.indexOf(m);
  if (idx >= 0) world.monsters.splice(idx, 1);
  // per-kind respawn override: the dragon's lair refills on a long clock.
  // Camp dwellers remember their settlement and respawn back home.
  world.respawns.push({ kind: m.kind, t: d.respawnS ?? MONSTER_RESPAWN_S, camp: m.camp, guard: m.guard });
}

/**
 * Tibia-style death penalty. Below DEATH_PENALTY_LEVEL: only a sliver of
 * current-level progress is lost (the old gentle rule). From that level on:
 *  - your whole backpack drops into a lootable "your body" corpse where you
 *    fell, and each equipped piece has a chance to drop with it,
 *  - UNLESS an Amulet of Loss is worn — it shatters and saves the items,
 *  - you lose a fraction of TOTAL experience (you can de-level),
 *  - every skill loses a fraction of its current tries (can drop a level).
 * The amulet never protects experience or skills — exactly like in Tibia.
 */
export function applyDeathPenalty(world: World, p: Player): void {
  if (p.level < DEATH_PENALTY_LEVEL) {
    p.exp = Math.floor(p.exp * 0.9);
    return;
  }

  // --- items ---
  const aol = p.eq.amulet && ITEMS[p.eq.amulet].deathProtect ? p.eq.amulet : null;
  if (aol) {
    p.eq.amulet = null; // consumed
    addFloat(world, p.x, p.y - 30, "Amulet of Loss shattered!", "#c9a6ff");
  } else {
    const dropped: { kind: ItemKind; n: number }[] = [];
    for (const s of p.bag) if (s) dropped.push({ kind: s.kind, n: s.n });
    p.bag = emptyBag();
    for (const slot of Object.keys(p.eq) as (keyof typeof p.eq)[]) {
      const it = p.eq[slot];
      if (it && Math.random() < DEATH_EQ_DROP_CHANCE) {
        dropped.push({ kind: it, n: 1 });
        p.eq[slot] = null;
      }
    }
    if (dropped.length) {
      world.corpses.push({ name: "your body", x: p.x, y: p.y, items: dropped, gold: 0, t: PLAYER_CORPSE_DECAY_S });
      addFloat(world, p.x, p.y - 30, "you dropped your backpack!", "#ff9e6a");
    }
  }

  // --- experience (10% of TOTAL — can de-level) ---
  const total = totalExpFor(p.level) + p.exp;
  const newTotal = Math.max(0, Math.floor(total * (1 - DEATH_EXP_LOSS)));
  let lv = p.level;
  while (lv > 1 && newTotal < totalExpFor(lv)) lv--;
  p.level = lv;
  p.exp = newTotal - totalExpFor(lv);
  p.expNext = expNeeded(lv);

  // --- skills ---
  applySkillDeathLoss(DEATH_SKILL_LOSS);

  refreshDerived(p);
}

/**
 * Rolling record of when the shield engaged a hit. Only SHIELD_BLOCK_MAX hits
 * per SHIELD_BLOCK_WINDOW_S get shield defense (Tibia's "your shield can only
 * block two creatures"); any further hit inside the window bypasses the shield
 * and is reduced by worn armor alone. Module state — resets naturally as the
 * window slides, and explicitly via resetShieldWindow (tests, respawn).
 */
let shieldBlockTimes: number[] = [];

export function resetShieldWindow(): void {
  shieldBlockTimes = [];
}

/** Apply raw damage to the player. Returns true if this killed them. */
export function hurtPlayer(world: World, p: Player, raw: number): boolean {
  if (p.dead) return false;
  const now = performance.now() / 1000;
  shieldBlockTimes = shieldBlockTimes.filter((t) => now - t < SHIELD_BLOCK_WINDOW_S);
  const blocked = shieldBlockTimes.length < SHIELD_BLOCK_MAX;
  if (blocked) shieldBlockTimes.push(now);
  const def = blocked ? defenseShield(p.eq) + defenseArmor(p.eq) : defenseArmor(p.eq);
  const dmg = Math.max(1, raw - def);
  p.hp -= dmg;
  // Shielding trains only on hits the shield actually engaged — more than
  // SHIELD_BLOCK_MAX attackers won't train it faster, exactly like Tibia.
  if (blocked) addSkillXp("shield", 1, (t) => addFloat(world, p.x, p.y - 26, t, "#7dff9e"));
  // pierced hits (past the shield cap) glow hotter so a swarm reads as danger
  addFloat(world, p.x, p.y - 18, `-${dmg}`, blocked ? "#ff6a5e" : "#ff9e3a");
  beep(90, 0.1, "sawtooth", 0.05);
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    p.deadT = 3;
    p.target = null;
    p.dest = null;
    p.gather = null;
    resetShieldWindow();
    applyDeathPenalty(world, p);
    beep(120, 0.5, "sawtooth", 0.07, -90);
    return true;
  }
  return false;
}
