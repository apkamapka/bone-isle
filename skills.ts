/** Tibia-style skills: levels that climb as you use them, plus gear bonuses. */
import { beep } from "../audio.ts";
import { gearStat } from "../items.ts";
import type { Equipment } from "../items.ts";

export type SkillKey = "sword" | "shield" | "magic" | "dist" | "speed";

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
  magic: { name: "Magic Level", lv: 0, pts: 0, color: "#b07fe8", active: true, offset: 0, factor: 1.1, base: 400 },
  dist: { name: "Distance Fighting", lv: 10, pts: 0, color: "#6fc06a", active: false, offset: 10, factor: 1.1, base: 50 },
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
export function defensePower(eq: Equipment): number {
  return Math.floor((skills.shield.lv - 10) / 2) + gearStat(eq, "def");
}
export function magicPower(): number {
  return 4 + skills.magic.lv * 2;
}
export function moveSpeedBonus(): number {
  return (skills.speed.lv - 10) * 2;
}
