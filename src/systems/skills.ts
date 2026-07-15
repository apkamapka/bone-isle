/** Tibia-style skills: levels that climb as you use them, plus gear bonuses. */
import { beep } from "../audio.ts";
import { gearStat, gearStatOf, equippedBow } from "../items.ts";
import {
  DIST_FACTOR_BASE, DIST_FACTOR_PER, DIST_LEVEL_BONUS,
  MELEE_FIST_ATK, MELEE_FACTOR_BASE, MELEE_FACTOR_PER, MELEE_LEVEL_BONUS,
  DIST_HITCHANCE_BASE, DIST_HITCHANCE_PER, DIST_HITCHANCE_MAX,
} from "../config.ts";
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

/** Reset every skill to its starting level (used when starting a new game —
 *  skills live in module state, so without this a fresh game after an old one
 *  would inherit the previous character's training). */
export function resetSkills(): void {
  for (const key of Object.keys(skills) as SkillKey[]) {
    const s = skills[key];
    s.lv = s.offset;
    s.pts = 0;
  }
}

/**
 * Death penalty for skills (Tibia-style): every skill loses `frac` of the
 * tries needed for its current level. If that dips below zero the skill
 * level itself drops. Called from combat when the player dies at high level.
 */
export function applySkillDeathLoss(frac: number): void {
  for (const key of Object.keys(skills) as SkillKey[]) {
    const s = skills[key];
    if (!s.active) continue;
    s.pts -= Math.round(skillNeed(s) * frac);
    while (s.pts < 0 && s.lv > s.offset) {
      s.lv--;
      s.pts += skillNeed(s);
    }
    if (s.pts < 0) s.pts = 0;
  }
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
/**
 * Melee attack value scaled by Sword Fighting. Unarmed you swing bare fists
 * (MELEE_FIST_ATK); a weapon adds its gear Attack on top, and the whole thing is
 * multiplied by a skill-driven factor — so a +7 sword pulls much further ahead
 * of fists as your Sword skill climbs, rather than being a flat +7.
 */
export function attackPower(level: number, eq: Equipment): number {
  const attackValue = MELEE_FIST_ATK + gearStat(eq, "atk");
  const factor = MELEE_FACTOR_BASE + (skills.sword.lv - 10) * MELEE_FACTOR_PER;
  return Math.max(1, Math.round(attackValue * factor) + Math.floor(level * MELEE_LEVEL_BONUS));
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
/**
 * Tibia 8.6 damage rolls. attackPower/distancePower above compute the MAX hit;
 * an actual melee blow is uniform 0..max (a 0 is the classic whiffed "poof"),
 * and an arrow that passes its accuracy roll lands for uniform lvl/5..max.
 * Average damage is therefore about HALF the max — the single biggest reason
 * leveling now paces like the real game instead of every hit being a crit.
 */
export function rollMeleeDamage(max: number): number {
  return Math.floor(Math.random() * (max + 1));
}
export function rollDistanceDamage(max: number, level: number): number {
  const min = Math.min(max, Math.floor(level / 5));
  return min + Math.floor(Math.random() * (max - min + 1));
}
/** Accuracy of one bow shot at the current Distance Fighting skill. */
export function distanceHitChance(): number {
  return Math.min(DIST_HITCHANCE_MAX, DIST_HITCHANCE_BASE + (skills.dist.lv - 10) * DIST_HITCHANCE_PER);
}

/**
 * Shield-side defense: the Shielding skill plus the def of what's in your
 * hands (shield, or a weapon's def bonus). This part only applies to hits
 * your shield actually engages — at most SHIELD_BLOCK_MAX attackers per round.
 */
export function defenseShield(eq: Equipment): number {
  return Math.floor((skills.shield.lv - 10) / 2) + gearStatOf(eq, "def", ["shield", "weapon"]);
}

/** Armor-side defense: worn pieces (helmet, armor, legs, boots, jewellery).
 *  Always applies, to every hit, no matter how many creatures are on you. */
export function defenseArmor(eq: Equipment): number {
  return gearStatOf(eq, "def", ["head", "body", "legs", "boots", "ring", "amulet"]);
}

/** Full defense (shield + armor) — what a blocked hit is reduced by. */
export function defensePower(eq: Equipment): number {
  return defenseShield(eq) + defenseArmor(eq);
}
export function moveSpeedBonus(): number {
  return (skills.speed.lv - 10) * 2;
}
