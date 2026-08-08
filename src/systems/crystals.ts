/**
 * Crystals: charge-based consumables that replace the old spell system.
 * Each crystal kind is a stackable item whose stack count IS its charges —
 * one use spends one charge. Life = heal, Fire = ranged damage. Recall is a
 * travel action handled in the main loop (it needs the game object).
 */
import { beep } from "../audio.ts";
import { markBloodHit } from "./skills.ts";
import { ELEMENTS, ELEMENT_COLOR, crystalDamage, type Element, type Tier } from "./elements.ts";
import { MONSTER_DEFS } from "../entities/monsters.ts";
import { addFloat } from "../fx.ts";
import { dist } from "../util.ts";
import { bagCount, removeItem } from "../items.ts";
import { HEAL_CRYSTAL_BASE, FIRE_CRYSTAL_DMG, FIRE_CRYSTAL_RANGE, SPEAR_CRYSTAL_DMG, SPEAR_CRYSTAL_RANGE, MONSTER_AGGRO_HIT_S, CRYSTAL_COOLDOWN_S } from "../config.ts";
import { killMonster } from "./combat.ts";
import { lineOfSight } from "../world/collision.ts";
import type { Player } from "../entities/player.ts";
import type { World } from "../world/types.ts";
import type { ItemKind } from "../items.ts";

/** The crystal kinds, in the order they bind to default action slots. */
export const CRYSTAL_KINDS: readonly ItemKind[] = ["healCrystal", "flameCrystal", "recallCrystal", "spearCrystal"];

export function isCrystal(kind: ItemKind): boolean {
  return CRYSTAL_KINDS.includes(kind);
}

/**
 * Shared cooldown for the OFFENSIVE crystals (Fire, Spear). Module state, not
 * a Player field, so saves need no migration; ticked from the main loop.
 */
let offensiveCd = 0;
export function tickCrystalCooldown(dt: number): void {
  offensiveCd = Math.max(0, offensiveCd - dt);
}

/** Damage + reach for the two offensive crystals. */
/**
 * The elemental crystal table, generated from the naming scheme so a new tier
 * or element cannot drift out of step with its neighbours.
 *
 * A Shard flies at one creature and hits hard. A Burst is thrown, goes off
 * where it lands and splits its damage across everything in the blast — worse
 * against one target, decisive against a pack. That is the whole role split:
 * not "more damage", but "damage arranged differently".
 */
export interface CrystalSpec {
  element: Element;
  tier: Tier;
  role: "projectile" | "burst";
  base: readonly [number, number];
  range: number;
  /** Blast radius in px; 0 for a single-target shard. */
  splash: number;
}

const TIER_NAMES: Readonly<Record<Element, readonly [string, string, string]>> = {
  fire: ["Ember", "Flame", "Pyre"],
  ice: ["Frost", "Rime", "Glacier"],
  earth: ["Loam", "Stone", "Bedrock"],
  storm: ["Spark", "Bolt", "Tempest"],
  shadow: ["Gloom", "Umbra", "Eclipse"],
};

export const CRYSTAL_SPECS: Readonly<Record<string, CrystalSpec>> = (() => {
  const out: Record<string, CrystalSpec> = {};
  for (const el of ELEMENTS) {
    for (let t = 0 as Tier; t < 3; t = (t + 1) as Tier) {
      const n = TIER_NAMES[el][t];
      // a shard concentrates, a burst spreads — same budget, different shape
      out[`${el}${n}Shard`] = { element: el, tier: t, role: "projectile", base: [14, 22], range: 260 + t * 30, splash: 0 };
      out[`${el}${n}Burst`] = { element: el, tier: t, role: "burst", base: [9, 15], range: 220 + t * 30, splash: 56 + t * 12 };
    }
  }
  return out;
})();

/**
 * Choose what a crystal goes at. The MARKED target comes first — before this
 * existed, bolts flew at whatever wandered closest rather than the creature
 * you were fighting. A marked target out of range or behind rock refuses the
 * cast and keeps the charge, which is far better than silently retargeting.
 */
function pickTarget(world: World, p: Player, range: number): World["monsters"][number] | null {
  const t = p.target;
  if (t && t.kind === "mob" && t.m.hp > 0 && world.monsters.includes(t.m)) {
    if (dist(p.x, p.y, t.m.x, t.m.y) > range) {
      addFloat(world, p.x, p.y - 44, "too far", "#ff9e6a");
      return null;
    }
    if (!lineOfSight(world, p.x, p.y, t.m.x, t.m.y)) {
      addFloat(world, p.x, p.y - 44, "no line of sight", "#ff9e6a");
      return null;
    }
    return t.m;
  }
  // no marked target: nearest creature with a CLEAR line — crystals never
  // blast through cave walls, same rule as every other ranged attack
  let best: World["monsters"][number] | null = null;
  let bd = range;
  for (const m of world.monsters) {
    const d = dist(p.x, p.y, m.x, m.y);
    if (d < bd && lineOfSight(world, p.x, p.y, m.x, m.y)) { bd = d; best = m; }
  }
  if (!best) addFloat(world, p.x, p.y - 44, "no target", "#ff9e6a");
  return best;
}

function offensiveStats(kind: ItemKind, level: number): { dmg: number; range: number } | null {
  if (kind === "flameCrystal") return { dmg: FIRE_CRYSTAL_DMG + level, range: FIRE_CRYSTAL_RANGE };
  if (kind === "spearCrystal") return { dmg: SPEAR_CRYSTAL_DMG + level * 2, range: SPEAR_CRYSTAL_RANGE };
  return null;
}

/**
 * Apply a Life / Fire / Spear crystal. Returns true if a charge was consumed.
 * Recall is NOT handled here — the caller (main loop) does travel + charge.
 */
export function useCrystal(world: World, p: Player, kind: ItemKind): boolean {
  if (p.dead) return false;
  if (bagCount(p.bag, kind) <= 0) {
    addFloat(world, p.x, p.y - 44, "no crystal", "#8ab6ff");
    return false;
  }

  if (kind === "healCrystal") {
    if (p.hp >= p.maxhp) {
      addFloat(world, p.x, p.y - 44, "full hp", "#7dff9e");
      return false;
    }
    removeItem(p.bag, kind, 1);
    const amount = HEAL_CRYSTAL_BASE + p.level * 3;
    p.hp = Math.min(p.maxhp, p.hp + amount);
    addFloat(world, p.x, p.y - 40, `+${amount}`, "#7dff9e");
    beep(660, 0.2, "sine", 0.06, 220);
    return true;
  }

  // ---- the elemental line ----
  const spec = CRYSTAL_SPECS[kind];
  if (spec) {
    if (offensiveCd > 0) {
      addFloat(world, p.x, p.y - 44, "not ready", "#8ab6ff");
      return false;
    }
    const target = pickTarget(world, p, spec.range);
    if (!target) return false;
    removeItem(p.bag, kind, 1);
    offensiveCd = CRYSTAL_COOLDOWN_S;
    markBloodHit();
    const col = ELEMENT_COLOR[spec.element];
    // A burst splits its roll across everything caught in the blast; a shard
    // puts all of it into one creature. Both go STRAIGHT to hp — elemental
    // damage is the channel that armor does not get to stop, and that bypass
    // is the entire reason to spend materials on crystals at all.
    const caught = spec.splash > 0
      ? world.monsters.filter((m) => m.hp > 0 && dist(m.x, m.y, target.x, target.y) <= spec.splash)
      : [target];
    for (const m of caught) {
      const dmg = crystalDamage(spec.base, spec.tier, p.level, MONSTER_DEFS[m.kind].resist, spec.element);
      m.hp -= dmg;
      m.hurtT = 0.2;
      m.aggroT = MONSTER_AGGRO_HIT_S;
      const resisted = (MONSTER_DEFS[m.kind].resist?.[spec.element] ?? 1) < 1;
      addFloat(world, m.x, m.y - 32, resisted ? `${dmg}!` : String(dmg), col);
      if (m.hp <= 0) killMonster(world, p, m);
    }
    beep(spec.role === "burst" ? 180 : 320, 0.2, "sawtooth", 0.06, spec.role === "burst" ? -160 : 120);
    return true;
  }

  const off = offensiveStats(kind, p.level);
  if (off) {
    if (offensiveCd > 0) {
      addFloat(world, p.x, p.y - 44, "not ready", "#8ab6ff");
      return false;
    }
    const best = pickTarget(world, p, off.range);
    if (!best) return false;
    removeItem(p.bag, kind, 1);
    offensiveCd = CRYSTAL_COOLDOWN_S;
    best.hp -= off.dmg;
    markBloodHit(); // a crystal counts as drawing blood too
    best.hurtT = 0.2;
    best.aggroT = MONSTER_AGGRO_HIT_S;
    const col = kind === "spearCrystal" ? "#ffce4a" : "#ff8a3a";
    addFloat(world, best.x, best.y - 32, String(off.dmg), col);
    beep(kind === "spearCrystal" ? 240 : 300, 0.2, "sawtooth", 0.06, -140);
    if (best.hp <= 0) killMonster(world, p, best);
    return true;
  }

  return false;
}
