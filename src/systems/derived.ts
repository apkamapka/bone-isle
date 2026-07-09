/**
 * Globally-active passive bonuses (from owned structures) that feed into
 * `refreshDerived`. Kept in its own tiny module so `player.ts` can read it as
 * a default without importing the building system (which would be a cycle).
 */
import type { DerivedBonus } from "../entities/player.ts";

export const activeBonus: Required<DerivedBonus> = { maxhp: 0, maxmana: 0 };

export function setActiveBonus(b: DerivedBonus): void {
  activeBonus.maxhp = b.maxhp ?? 0;
  activeBonus.maxmana = b.maxmana ?? 0;
}
