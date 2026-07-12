/** Tibia-style skills: levels that climb as you use them, plus gear bonuses. */
import { beep } from "../audio.ts";
import { gearStat, equippedBow } from "../items.ts";
import { DIST_FACTOR_BASE, DIST_FACTOR_PER, DIST_LEVEL_BONUS } from "../config.ts";
import type { Equipment } from "../items.ts";

export type SkillKey = "sword" | "shield" | "dist" | "speed";

export interface Skill {
  name: string;
  lv: number;
  pts: number;
  color: string;
  active: boolean;
  /** Starting skill level (points needed grows from here). 10 for weapons. */
  offset: number;
  /** Geometric growth ratio — higher = slower to advance. */
  factor: number;
  /** Base tries needed for the very first level-up (at lv == offset). */
  base: number;
}

export const skills: Record<SkillKey, Skill> = {
  sword: { name: "Sword Fighting", lv: 10, pts: 0, color: "#e1483b", active: true, offset: 10, factor: 1.1, base: 50 },
  shield: { name: "Shielding", lv: 10, pts: 0, color: "#5aa1e8", active: true, offset: 10, factor: 1.1, base: 50 },
  dist: { name: "Distance Fighting", lv: 10, pts: 0, color: "#6fc06a", active: true, offset: 10, factor: 1.1, base: 50 },
  speed: { name: "Speed", lv: 10, pts: 0, color: "#e3b341", active: true, offset: 10, factor: 1.4, base: 40 },
};

/**
 * Tries/points needed to advance from the skill's current level to the next.
 * Geometric like Tibia 8.6: base · factor^(lv − offset). At factor 1.1 a
 * weapon skill needs ~50 hits at skill 10, ~130 at 20, ~5900 at 60 — the
 * grind ramps hard, so high skills take hours the way they did in 8.6.
 */
export function skillNeed(s: Skill): number {
  return Math.round(s.base * Math.pow(s.factor, Math.max(0, s.lv - s.offset)));
}

export type SkillUpFx = (text: string) => void;

/** Award xp to a skill; may trigger one or more level-ups. */
export function addSkillXp(key: SkillKey, n: number, onLevel?: SkillUpFx): void {
  const s = skills[key];
  if (!s.active) return;
  s.pts += n;
  while (s.pts >= skillNeed(s)) {
    s.pts -= skillNeed(s);
    s.lv++;
    onLevel?.(`${s.name} → ${s.lv}`);
    beep(520, 0.08, "square", 0.05);
  }
}

/** Derived combat stats from skills + level + equipped gear. */
export function attackPower(level: number, eq: Equipment): number {
  return 6 + level + (skills.sword.lv - 10) + gearStat(eq, "atk");
}
/**
 * Damage of a single arrow shot. The raw attack value (bow power + arrow) is
 * scaled by a factor driven almost entirely by Distance Fighting: at skill 10
 * you only land ~30% of it, but the multiplier climbs every level, so a maxed
 * archer hits several times harder with the very same bow and arrows. This is
 * the "damage is proportional to skill" behaviour — a fresh bow is deliberately
 * weak until you train it up.
 */
export function distancePower(level: number, eq: Equipment, arrowAtk: number): number {
  const attackValue = (equippedBow(eq)?.power ?? 0) + arrowAtk;
  const factor = DIST_FACTOR_BASE + (skills.dist.lv - 10) * DIST_FACTOR_PER;
  return Math.max(1, Math.round(attackValue * factor) + Math.floor(level * DIST_LEVEL_BONUS));
}
export function defensePower(eq: Equipment): number {
  return Math.floor((skills.shield.lv - 10) / 2) + gearStat(eq, "def");
}
export function moveSpeedBonus(): number {
  return (skills.speed.lv - 10) * 2;
}
