/**
 * Two things some creatures do besides walk at you and swing (Etap 73).
 *
 * COWARDS RUN. The bottom of the human ladder — beggars, vagrants, thieves,
 * poachers, smugglers — breaks below 15% of its life and runs from you until
 * it dies or gets out of range. A running creature neither swings nor shoots,
 * and one with its back to a wall simply stands there. This is what gives the
 * chase button something to do.
 *
 * HEALERS HEAL. Orc shamans and minotaur mages, every ten seconds, mend the
 * worst-hurt creature within four squares of them — themselves included — by
 * a fifth of its life. Only while the fight is on, and never a scratch: a
 * creature above 90% is not worth the spell. Which one to kill first is now a
 * question with an answer.
 */
import type { Monster, MonsterKind, World } from "../world/types.ts";
import { sound, floatAt } from "./fxEvents.ts";

export const COWARDS: ReadonlySet<MonsterKind> = new Set<MonsterKind>([
  "beggar", "vagrant", "thief", "poacher", "smuggler",
]);
export const FLEE_HP_FRAC = 0.15;

export function isFleeing(m: Monster): boolean {
  return COWARDS.has(m.kind) && m.hp > 0 && m.hp < m.maxhp * FLEE_HP_FRAC;
}

export const HEALERS: ReadonlySet<MonsterKind> = new Set<MonsterKind>(["orcShaman", "minotaurMage"]);
export const HEAL_RADIUS_TILES = 4;
export const HEAL_FRAC = 0.2;
export const HEAL_CD_S = 10;
/** Nobody above this share of their life gets healed. */
export const HEAL_TRIGGER_FRAC = 0.9;
/** A healer's first heal comes this soon after the fight starts. */
export const HEAL_FIRST_S = 2;
export const HEAL_COLOR = "#3ee07a";

/** The worst-hurt creature in reach, by share of life, or null. */
export function pickPatient(w: { monsters: readonly Monster[] }, healer: Monster): Monster | null {
  let best: Monster | null = null;
  let bestFrac = HEAL_TRIGGER_FRAC;
  for (const o of w.monsters) {
    if (o.hp <= 0 || o.hp >= o.maxhp) continue;
    if (Math.max(Math.abs(o.tx - healer.tx), Math.abs(o.ty - healer.ty)) > HEAL_RADIUS_TILES) continue;
    const f = o.hp / o.maxhp;
    if (f < bestFrac) { bestFrac = f; best = o; }
  }
  return best;
}

export function healAmount(p: Monster): number {
  return Math.max(0, Math.min(p.maxhp - p.hp, Math.max(1, Math.round(p.maxhp * HEAL_FRAC))));
}

/**
 * Run one healer's clock, and heal if it is due. `active` is whether the
 * fight is on. Returns the life restored, 0 if nothing happened.
 */
export function tickHealer(w: World, m: Monster, dt: number, active: boolean): number {
  if (!HEALERS.has(m.kind)) return 0;
  m.healCd = Math.max(0, (m.healCd ?? HEAL_FIRST_S) - dt);
  if (!active || m.healCd > 0) return 0;
  const patient = pickPatient(w, m);
  if (!patient) return 0;
  const amt = healAmount(patient);
  if (amt <= 0) return 0;
  patient.hp += amt;
  m.healCd = HEAL_CD_S;
  floatAt(w, patient.x, patient.y - 32, `+${amt}`, HEAL_COLOR);
  sound("mobheal", { world: w, x: patient.x, y: patient.y });
  return amt;
}
