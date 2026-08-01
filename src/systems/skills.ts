/** Tibia-style skills: levels that climb as you use them, plus gear bonuses. */
import { beep } from "../audio.ts";
import { gearStat, gearStatOf, equippedBow } from "../items.ts";
import {
  MELEE_FIST_ATK, MIN_HIT_RATIO,
  SKILL_TERM_PER, SKILL_TERM_PER_DIST, SKILL_TERM_FLAT,
  LEVEL_DIVISOR, MASTERY_DIVISOR,
  ARMOR_MIN_RATIO, SHIELD_SKILL_FACTOR, SHIELD_FLAT_FACTOR,
  DIST_HITCHANCE_BASE, DIST_HITCHANCE_PER, DIST_HITCHANCE_MAX,
} from "../config.ts";
import { stanceAtk, stanceDef } from "./stance.ts";
import type { Equipment } from "../items.ts";

export type SkillKey = "sword" | "shield" | "dist";

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
};
// NOTE: there is deliberately no "speed" skill — Tibia 8.6 has none. Movement
// speed grows with the character LEVEL instead (SPEED_PER_LEVEL in config.ts,
// applied in playerSpeed()). A "speed" entry in old saves is simply ignored.

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

/* ================================================================== *
 *  ATTACK
 *
 *  maxHit = attackValue · skillTerm · levelFactor · mastery · stance
 *
 *  Four multiplied terms, each bought with a different currency: gear with
 *  gold, skillTerm with training hours, levelFactor with experience, mastery
 *  with the decision not to spread yourself thin. Nothing here is additive,
 *  which is why gear can never substitute for training.
 * ================================================================== */

/** The linear skill ramp. `per` differs between melee and distance. */
function skillTerm(skillLv: number, per: number): number {
  return per * skillLv + SKILL_TERM_FLAT;
}

/** Character level as a straight multiplier: 1 level ≈ +1% damage. */
export function levelFactor(level: number): number {
  return 1 + level / LEVEL_DIVISOR;
}

/**
 * Specialisation bonus. `used` is the skill you are swinging with; the penalty
 * is measured against your best OTHER *weapon* skill, so a 60/10 specialist is
 * rewarded and a 50/50 hybrid is not. Shielding never enters this calculation:
 * sword and bow are mutually exclusive in the moment, a shield is not, and
 * taxing it would make training defense strictly wrong.
 */
export function mastery(used: SkillKey): number {
  const other = used === "sword" ? skills.dist.lv : skills.sword.lv;
  return 1 + Math.max(0, skills[used].lv - other) / MASTERY_DIVISOR;
}

/**
 * Maximum melee hit. Unarmed you swing bare fists (MELEE_FIST_ATK); a weapon's
 * gear Attack adds to that attack value before every multiplier, so a better
 * blade pulls further ahead the more Sword Fighting you have.
 */
export function attackPower(level: number, eq: Equipment): number {
  const attackValue = MELEE_FIST_ATK + gearStat(eq, "atk");
  const raw = attackValue
    * skillTerm(skills.sword.lv, SKILL_TERM_PER)
    * levelFactor(level)
    * mastery("sword")
    * stanceAtk();
  return Math.max(1, Math.round(raw));
}

/**
 * Maximum damage of a single arrow. Same pipeline as melee, driven by Distance
 * Fighting and a marginally hotter per-point term — the bow pays for that with
 * its accuracy roll, its ammunition and the shield it cannot hold.
 */
export function distancePower(level: number, eq: Equipment, arrowAtk: number): number {
  const attackValue = (equippedBow(eq)?.power ?? 0) + arrowAtk;
  const raw = attackValue
    * skillTerm(skills.dist.lv, SKILL_TERM_PER_DIST)
    * levelFactor(level)
    * mastery("dist")
    * stanceAtk();
  return Math.max(1, Math.round(raw));
}

/**
 * The damage roll. Both channels land uniformly between MIN_HIT_RATIO · max
 * and max, so the average blow is 0.70 · max. The old floor of zero meant a
 * flat 1-in-max chance to whiff entirely on every single swing — dramatic the
 * first time, maddening by the hundredth, and it made high defense feel like
 * nothing because half your damage was noise anyway.
 */
function rollHit(max: number): number {
  const min = Math.floor(max * MIN_HIT_RATIO);
  return min + Math.floor(Math.random() * (max - min + 1));
}
export function rollMeleeDamage(max: number): number {
  return rollHit(max);
}
export function rollDistanceDamage(max: number, _level?: number): number {
  return rollHit(max);
}

/** Accuracy of one bow shot at the current Distance Fighting skill. */
export function distanceHitChance(): number {
  return Math.min(DIST_HITCHANCE_MAX, DIST_HITCHANCE_BASE + (skills.dist.lv - 10) * DIST_HITCHANCE_PER);
}

/* ================================================================== *
 *  DEFENSE
 *
 *  raw damage → armor → shield → HP
 *
 *  Two stages that behave completely differently. Armor is a flat subtraction
 *  and therefore shreds a hail of small hits while barely denting one heavy
 *  one. The shield is a proportional roll and does the opposite. Which of the
 *  two saved you is worth showing on screen — armor sparks, a shield puffs.
 * ================================================================== */

/**
 * Shield-side rating: what is in your hands (a shield, or a weapon's own def).
 * Note that unlike the old model the Shielding SKILL is not folded in here —
 * it multiplies this rating inside shieldBlockMax instead, which is what lets
 * a trained character get real value out of a good shield rather than a flat
 * bonus that a wooden buckler would have given just as well.
 */
export function defenseShield(eq: Equipment): number {
  return gearStatOf(eq, "def", ["shield", "weapon"]);
}

/** Armor-side rating: worn pieces (helmet, armor, legs, boots, jewellery).
 *  Always applies, to every hit, no matter how many creatures are on you. */
export function defenseArmor(eq: Equipment): number {
  return gearStatOf(eq, "def", ["head", "body", "legs", "boots", "ring", "amulet"]);
}

/** Both ratings together — used by the UI, never by the damage pipeline. */
export function defensePower(eq: Equipment): number {
  return defenseShield(eq) + defenseArmor(eq);
}

/**
 * Flat armor reduction, rolled from half the rating to all of it. An odd total
 * therefore protects exactly as well as the next even number down — a quirk
 * inherited from Tibia and kept deliberately, because it makes armor values
 * read as chunky steps rather than a smooth dial.
 */
export function rollArmorReduction(armor: number): number {
  const half = Math.floor(armor * ARMOR_MIN_RATIO);
  return half + Math.floor(Math.random() * (armor - half + 1));
}

/** Ceiling of a shield block at the current Shielding skill and stance. */
export function shieldBlockMax(eq: Equipment): number {
  const src = defenseShield(eq);
  return (SHIELD_SKILL_FACTOR * skills.shield.lv * src + SHIELD_FLAT_FACTOR * src) * stanceDef();
}

/**
 * One shield block, rolled triangular over 0..ceiling. The triangular shape
 * ((a+b)/2 of two uniforms) averages half the ceiling with far less spread
 * than a flat roll, so defense reads as dependable instead of a coin flip.
 */
export function rollShieldBlock(eq: Equipment): number {
  const max = shieldBlockMax(eq);
  return ((Math.random() + Math.random()) / 2) * max;
}

