/**
 * Globally-active passive bonuses (from owned structures) that feed into
 * `refreshDerived`. Kept in its own tiny module so `player.ts` can read it as
 * a default without importing the building system (which would be a cycle).
 */
import type { DerivedBonus } from "../entities/player.ts";
import { active as activeState } from "./playerState.ts";

/**
 * A live view onto the active character's passive bonuses.
 *
 * It was a module-level object, which made it the third and last per-character
 * value still shared by every character in the process. It is genuinely
 * per-character: the bonus comes from the structures on a Home Isle, and each
 * player gets their own Home Isle.
 *
 * `refreshDerived(p, bonus = activeBonus)` takes this as a default and reads
 * `.maxhp` off it, so a getter is enough — the read happens at call time and
 * lands on whoever is active then. No call site changed.
 */
export const activeBonus: Required<DerivedBonus> = Object.freeze({
  get maxhp(): number { return activeState().bonus.maxhp; },
}) as Required<DerivedBonus>;

export function setActiveBonus(b: DerivedBonus): void {
  activeState().bonus.maxhp = b.maxhp ?? 0;
}
