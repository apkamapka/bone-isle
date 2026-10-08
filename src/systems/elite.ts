/**
 * Elite creatures (Etap 73): the rare, stronger roll of an ordinary spawn.
 *
 * One respawn in four hundred comes back as an elite — twice the life, hits a
 * third harder, triple the experience, loot rolled twice, a golden ring at its
 * feet and "Elite" in front of its name. The five mission bosses never roll:
 * each is a story with one ending, and an elite Redcap would be a rewrite.
 *
 * The roll happens once, where a creature is made, and lives on the creature
 * itself; creatures are never saved, so nothing here needs a migration.
 */
import type { Monster, MonsterKind } from "../world/types.ts";

export const ELITE_CHANCE = 1 / 400;
export const ELITE_HP_MULT = 2;
export const ELITE_DMG_MULT = 1.3;
export const ELITE_EXP_MULT = 3;
export const ELITE_PREFIX = "Elite";
export const ELITE_EXCLUDED: ReadonlySet<MonsterKind> = new Set<MonsterKind>([
  "redcap", "draugr", "blackAnnis", "asterion", "gorak",
]);

/** Does this spawn come back as an elite? */
export function rollElite(kind: MonsterKind, rand: () => number = Math.random): boolean {
  if (ELITE_EXCLUDED.has(kind)) return false;
  return rand() < ELITE_CHANCE;
}

export function makeElite(m: Monster): void {
  if (m.elite) return;
  m.elite = true;
  m.maxhp = Math.round(m.maxhp * ELITE_HP_MULT);
  m.hp = m.maxhp;
}

/** Every hit this creature lands — melee, shot or spell — is multiplied by this. */
export function mobDamageMult(m: Monster): number {
  return m.elite ? ELITE_DMG_MULT : 1;
}

export function mobExpMult(m: Monster): number {
  return m.elite ? ELITE_EXP_MULT : 1;
}

/** Two loot rolls on one body. Stacks stay separate: a corpse can hold two. */
export function mergeLoot<K>(
  a: { items: { kind: K; n: number }[]; gold: number },
  b: { items: { kind: K; n: number }[]; gold: number },
): { items: { kind: K; n: number }[]; gold: number } {
  return { items: [...a.items, ...b.items], gold: a.gold + b.gold };
}
