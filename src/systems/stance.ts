/**
 * Attack stance — Tibia's three fight modes, as one piece of module state.
 *
 * Offensive swings for full damage and blocks poorly; defensive gives up half
 * the damage and doubles the shield's ceiling; balanced sits between the two
 * and is where a character starts. The stance is the only combat choice a
 * player makes mid-fight, so it is deliberately one keypress with no cooldown.
 *
 * The stance itself lives on the character's PlayerState (with the other two
 * combat toggles, chase and secure mode) rather than in a module `let`, so a
 * process can hold more than one character. This file keeps the rules — the
 * cycle order, the labels, the multipliers — because those are the same for
 * everyone and belong to the game, not to a character.
 */
import { STANCE_ATK, STANCE_DEF } from "../config.ts";
import { active } from "./playerState.ts";

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

export function stance(): Stance {
  return active().modes.stance;
}

export function setStance(s: Stance): void {
  active().modes.stance = s;
}

/** Advance one step through STANCES and return the new stance. */
export function cycleStance(): Stance {
  const m = active().modes;
  m.stance = STANCES[(STANCES.indexOf(m.stance) + 1) % STANCES.length];
  return m.stance;
}

/** Back to the starting stance (new game / test isolation). */
export function resetStance(): void {
  active().modes.stance = "balanced";
}

/** Damage multiplier of the current stance. */
export function stanceAtk(): number {
  return STANCE_ATK[stance()];
}

/** Shield-ceiling multiplier of the current stance. */
export function stanceDef(): number {
  return STANCE_DEF[stance()];
}
