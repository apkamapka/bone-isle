/**
 * The kill ledger: how many of each creature this character has ever killed.
 *
 * It is deliberately NOT part of tasks.ts. A task is an errand you take and
 * hand in; this is a fact about a character that outlives every errand, and
 * the board is only its first reader. The count runs whether or not a task is
 * open — hunting without an errand is never wasted — which is exactly what
 * makes a board entry repeatable: the errand asks for the NEXT fifty, and the
 * ledger already knows how many there have been.
 *
 * Per character, so it lives on PlayerState rather than in a module `let`,
 * for the same reason the skills and the task board do.
 */
import { active as activeState } from "./playerState.ts";
import type { MonsterKind } from "../world/types.ts";

/** Every kill this character has made, keyed by creature. Sparse: a creature
 *  never met costs nothing. */
export type KillSave = Partial<Record<MonsterKind, number>>;

function ledger(): KillSave {
  return activeState().kills;
}

/** How many of this creature the character has killed, ever. */
export function killCount(kind: MonsterKind): number {
  return ledger()[kind] ?? 0;
}

/** The same question across a family — an orc camp is five ranks of orc. */
export function killCountOf(kinds: readonly MonsterKind[]): number {
  let n = 0;
  for (const k of kinds) n += killCount(k);
  return n;
}

/** Count one kill. Called from combat on every creature the player puts down. */
export function recordKill(kind: MonsterKind): void {
  const l = ledger();
  l[kind] = (l[kind] ?? 0) + 1;
}

/** Creatures this character has killed at least once, commonest first. */
export function killedKinds(): MonsterKind[] {
  const l = ledger();
  return (Object.keys(l) as MonsterKind[])
    .filter((k) => (l[k] ?? 0) > 0)
    .sort((a, b) => (l[b] ?? 0) - (l[a] ?? 0));
}

/* ---------------- save / load ---------------- */

export function killState(): KillSave {
  return { ...ledger() };
}

/**
 * Restore the ledger. Anything that is not a positive whole number is dropped
 * rather than coerced: a save carrying `"12"` or `-3` for a creature is a
 * corrupt save, and a silent zero is easier to explain than a negative tally
 * that makes a task unreachable forever.
 */
export function loadKillState(s: KillSave | undefined): void {
  const l = ledger();
  for (const k of Object.keys(l) as MonsterKind[]) delete l[k];
  if (!s) return;
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      l[k as MonsterKind] = Math.floor(v);
    }
  }
}

export function resetKills(): void {
  const l = ledger();
  for (const k of Object.keys(l) as MonsterKind[]) delete l[k];
}
