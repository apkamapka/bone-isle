/** Tibia-style skills: levels that climb as you use them. */
import { beep } from "../audio.ts";

export type SkillKey = "sword" | "shield" | "magic" | "dist" | "speed";

export interface Skill {
  name: string;
  lv: number;
  pts: number;
  color: string;
  /** Inactive skills are placeholders shown as "coming soon". */
  active: boolean;
}

export const skills: Record<SkillKey, Skill> = {
  sword: { name: "Sword Fighting", lv: 10, pts: 0, color: "#e1483b", active: true },
  shield: { name: "Shielding", lv: 10, pts: 0, color: "#5aa1e8", active: true },
  magic: { name: "Magic Level", lv: 0, pts: 0, color: "#b07fe8", active: false },
  dist: { name: "Distance Fighting", lv: 10, pts: 0, color: "#6fc06a", active: false },
  speed: { name: "Speed", lv: 10, pts: 0, color: "#e3b341", active: true },
};

/** Points needed to reach the next level of a skill. */
export function skillNeed(s: Skill): number {
  const base = s === skills.magic ? 0 : 10;
  return 20 + (s.lv - base) * 12;
}

/** Callback so the system can surface a "skill up!" float without importing fx→player. */
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

/** Derived combat stats from skills + level. */
export function attackPower(level: number): number {
  return 6 + level + (skills.sword.lv - 10);
}
export function defensePower(): number {
  return Math.floor((skills.shield.lv - 10) / 2);
}
export function moveSpeedBonus(): number {
  return (skills.speed.lv - 10) * 2;
}
