/**
 * Tibia's logout block: "You may not logout during or immediately after a
 * fight!" It stands in front of Ctrl+L and Options' Logout (main.ts).
 *
 * A fight is a blow struck at a creature, or by one at you: a swing, a shot,
 * a crystal, a creature's hit or spell. The block lasts BATTLE_S after the
 * last of them. A training dummy does not count (nobody needs keeping at a
 * post), and neither does the ground: only creatures fight.
 *
 * The clock lives on PlayerState beside the blood-hit clock and, like it, is
 * never saved: leaving the world ends the fight, which is the whole point.
 */
import { active as activeState } from "./playerState.ts";

/** Seconds after the last blow during which the player may not log out. */
export const BATTLE_S = 60;

/** Tibia's own words for the refusal. */
export const LOGOUT_REFUSED = "You may not logout during or immediately after a fight!";

const nowS = (): number => performance.now() / 1000;

/** A blow was struck, by the player or at them. */
export function markBattle(now: number = nowS()): void {
  activeState().lastBattleAt = now;
}

/** Seconds of the block still to run; 0 when the player may log out. */
export function battleLeft(now: number = nowS()): number {
  return Math.max(0, activeState().lastBattleAt + BATTLE_S - now);
}

export function inBattle(now: number = nowS()): boolean {
  return battleLeft(now) > 0;
}
