/** Combat: player hits monsters, monsters hit the player, corpses & leveling. */
import { rndi } from "../util.ts";
import { expNeeded, MONSTER_RESPAWN_S, CORPSE_DECAY_S } from "../config.ts";
import { beep } from "../audio.ts";
import { addFloat } from "../fx.ts";
import { MONSTER_DEFS, rollLoot } from "../entities/monsters.ts";
import { ITEMS } from "../items.ts";
import { refreshDerived } from "../entities/player.ts";
import { addSkillXp, attackPower, defensePower } from "./skills.ts";
import { onMonsterKilled } from "./quests.ts";
import type { Player } from "../entities/player.ts";
import type { World, Monster, Structure } from "../world/types.ts";

/** Player strikes a monster. Returns true if the monster died. */
export function playerAttack(world: World, p: Player, m: Monster): boolean {
  const ap = attackPower(p.level, p.eq);
  const dmg = rndi(ap - 2, ap + 4);
  m.hp -= dmg;
  m.hurtT = 0.15;
  addFloat(world, m.x, m.y - 16, String(dmg), "#ffe27a");
  addSkillXp("sword", 1, (t) => addFloat(world, p.x, p.y - 26, t, "#7dff9e"));
  beep(160, 0.07, "square", 0.05);
  if (m.hp <= 0) {
    killMonster(world, p, m);
    return true;
  }
  return false;
}

/** Whack a training dummy: trains Sword Fighting, no death. */
export function hitDummy(world: World, p: Player, s: Structure): void {
  const ap = attackPower(p.level, p.eq);
  const dmg = rndi(ap - 2, ap + 4);
  s.hurtT = 0.2;
  s.anim = 0;
  addFloat(world, s.tx * 16 + 8, s.ty * 16 - 4, String(dmg), "#d8d2c0");
  addSkillXp("sword", 1, (t) => addFloat(world, p.x, p.y - 26, t, "#7dff9e"));
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
    p.mana = p.maxmana;
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
    name: ITEMS[m.kind as keyof typeof ITEMS] ? m.kind : m.kind,
    x: m.x,
    y: m.y,
    items,
    gold,
    t: CORPSE_DECAY_S,
  });

  onMonsterKilled(m.kind, (t) => addFloat(world, p.x, p.y - 32, t, "#ffe9a8"));

  const idx = world.monsters.indexOf(m);
  if (idx >= 0) world.monsters.splice(idx, 1);
  world.respawns.push({ kind: m.kind, t: MONSTER_RESPAWN_S });
}

/** Apply raw damage to the player. Returns true if this killed them. */
export function hurtPlayer(world: World, p: Player, raw: number): boolean {
  if (p.dead) return false;
  const dmg = Math.max(1, raw - defensePower(p.eq));
  p.hp -= dmg;
  addSkillXp("shield", 1, (t) => addFloat(world, p.x, p.y - 26, t, "#7dff9e"));
  addFloat(world, p.x, p.y - 18, `-${dmg}`, "#ff6a5e");
  beep(90, 0.1, "sawtooth", 0.05);
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    p.deadT = 3;
    p.target = null;
    p.dest = null;
    p.gather = null;
    p.exp = Math.floor(p.exp * 0.9);
    beep(120, 0.5, "sawtooth", 0.07, -90);
    return true;
  }
  return false;
}
