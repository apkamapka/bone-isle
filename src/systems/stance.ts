/**
 * Attack stance — Tibia's three fight modes, as one piece of module state.
 *
 * Offensive swings for full damage and blocks poorly; defensive gives up half
 * the damage and doubles the shield's ceiling; balanced sits between the two
 * and is where a character starts. The stance is the only combat choice a
 * player makes mid-fight, so it is deliberately one keypress with no cooldown.
 *
 * Module state rather than a Player field: the save layer writes it explicitly
 * (see save.ts) and an older save that lacks it simply keeps the default.
 */
import { STANCE_ATK, STANCE_DEF } from "../config.ts";

export type Stance = "offensive" | "balanced" | "defensive";

/** In cycle order, so the hotkey walks offensive → balanced → defensive. */
export const STANCES: readonly Stance[] = ["offensive", "balanced", "defensive"];

export const STANCE_LABEL: Readonly<Record<Stance, string>> = {
  offensive: "Offensive",
  balanced: "Balanced",
  defensive: "Defensive",
};

/** Colour used by the HUD chip and the Skills panel row. */
export const STANCE_COLOR: Readonly<Record<Stance, string>> = {
  offensive: "#e1483b",
  balanced: "#caa15a",
  defensive: "#5aa1e8",
};

let current: Stance = "balanced";

export function stance(): Stance {
  return current;
}

export function setStance(s: Stance): void {
  current = s;
}

/** Advance one step through STANCES and return the new stance. */
export function cycleStance(): Stance {
  current = STANCES[(STANCES.indexOf(current) + 1) % STANCES.length];
  return current;
}

/** Back to the starting stance (new game / test isolation). */
export function resetStance(): void {
  current = "balanced";
}

/** Damage multiplier of the current stance. */
export function stanceAtk(): number {
  return STANCE_ATK[current];
}

/** Shield-ceiling multiplier of the current stance. */
export function stanceDef(): number {
  return STANCE_DEF[current];
}
