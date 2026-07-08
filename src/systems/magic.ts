/** Spells: Heal and Fire Bolt, powered by mana and gated behind the Library. */
import { beep } from "../audio.ts";
import { addFloat } from "../fx.ts";
import { dist } from "../util.ts";
import { magicPower, addSkillXp } from "./skills.ts";
import { killMonster } from "./combat.ts";
import type { Player } from "../entities/player.ts";
import type { World } from "../world/types.ts";

export type SpellKey = "heal" | "firebolt";

export interface Spell {
  key: SpellKey;
  name: string;
  cost: number;
  desc: string;
}

export const SPELLS: readonly Spell[] = [
  { key: "heal", name: "Heal", cost: 15, desc: "Restore HP over your Magic Level." },
  { key: "firebolt", name: "Fire Bolt", cost: 12, desc: "Blast the nearest monster with fire." },
];

/** True once the player has built a Library on Home Isle. */
export function spellsUnlocked(home: World): boolean {
  return home.structures.some((s) => s.key === "library");
}

/** Cast a spell. Returns true if it fired (enough mana, valid target). */
export function castSpell(world: World, p: Player, key: SpellKey): boolean {
  const spell = SPELLS.find((s) => s.key === key);
  if (!spell || p.dead) return false;
  if (p.mana < spell.cost) {
    addFloat(world, p.x, p.y - 22, "no mana", "#8ab6ff");
    return false;
  }

  if (key === "heal") {
    const amount = 25 + magicPower() * 3;
    p.hp = Math.min(p.maxhp, p.hp + amount);
    p.mana -= spell.cost;
    addFloat(world, p.x, p.y - 20, `+${amount}`, "#7dff9e");
    addSkillXp("magic", 2, (t) => addFloat(world, p.x, p.y - 30, t, "#caa6ff"));
    beep(660, 0.2, "sine", 0.06, 220);
    return true;
  }

  // firebolt: nearest monster within range
  let best = null as (typeof world.monsters)[number] | null;
  let bd = 120;
  for (const m of world.monsters) {
    const d = dist(p.x, p.y, m.x, m.y);
    if (d < bd) { bd = d; best = m; }
  }
  if (!best) {
    addFloat(world, p.x, p.y - 22, "no target", "#ff9e6a");
    return false;
  }
  p.mana -= spell.cost;
  const dmg = 14 + magicPower() * 2;
  best.hp -= dmg;
  best.hurtT = 0.2;
  addFloat(world, best.x, best.y - 16, String(dmg), "#ff8a3a");
  addSkillXp("magic", 3, (t) => addFloat(world, p.x, p.y - 30, t, "#caa6ff"));
  beep(300, 0.18, "sawtooth", 0.06, -120);
  if (best.hp <= 0) killMonster(world, p, best);
  return true;
}
