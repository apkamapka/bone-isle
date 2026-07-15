/**
 * Crystals: charge-based consumables that replace the old spell system.
 * Each crystal kind is a stackable item whose stack count IS its charges —
 * one use spends one charge. Life = heal, Fire = ranged damage. Recall is a
 * travel action handled in the main loop (it needs the game object).
 */
import { beep } from "../audio.ts";
import { addFloat } from "../fx.ts";
import { dist } from "../util.ts";
import { bagCount, removeItem } from "../items.ts";
import { HEAL_CRYSTAL_BASE, FIRE_CRYSTAL_DMG, FIRE_CRYSTAL_RANGE, SPEAR_CRYSTAL_DMG, SPEAR_CRYSTAL_RANGE, MONSTER_AGGRO_HIT_S } from "../config.ts";
import { killMonster } from "./combat.ts";
import type { Player } from "../entities/player.ts";
import type { World } from "../world/types.ts";
import type { ItemKind } from "../items.ts";

/** The crystal kinds, in the order they bind to default action slots. */
export const CRYSTAL_KINDS: readonly ItemKind[] = ["healCrystal", "fireCrystal", "recallCrystal", "spearCrystal"];

export function isCrystal(kind: ItemKind): boolean {
  return CRYSTAL_KINDS.includes(kind);
}

/** Damage + reach for the two offensive crystals. */
function offensiveStats(kind: ItemKind, level: number): { dmg: number; range: number } | null {
  if (kind === "fireCrystal") return { dmg: FIRE_CRYSTAL_DMG + level, range: FIRE_CRYSTAL_RANGE };
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
    addFloat(world, p.x, p.y - 22, "no crystal", "#8ab6ff");
    return false;
  }

  if (kind === "healCrystal") {
    if (p.hp >= p.maxhp) {
      addFloat(world, p.x, p.y - 22, "full hp", "#7dff9e");
      return false;
    }
    removeItem(p.bag, kind, 1);
    const amount = HEAL_CRYSTAL_BASE + p.level * 3;
    p.hp = Math.min(p.maxhp, p.hp + amount);
    addFloat(world, p.x, p.y - 20, `+${amount}`, "#7dff9e");
    beep(660, 0.2, "sine", 0.06, 220);
    return true;
  }

  const off = offensiveStats(kind, p.level);
  if (off) {
    let best: (typeof world.monsters)[number] | null = null;
    let bd = off.range;
    for (const m of world.monsters) {
      const d = dist(p.x, p.y, m.x, m.y);
      if (d < bd) { bd = d; best = m; }
    }
    if (!best) {
      addFloat(world, p.x, p.y - 22, "no target", "#ff9e6a");
      return false;
    }
    removeItem(p.bag, kind, 1);
    best.hp -= off.dmg;
    best.hurtT = 0.2;
    best.aggroT = MONSTER_AGGRO_HIT_S;
    const col = kind === "spearCrystal" ? "#ffce4a" : "#ff8a3a";
    addFloat(world, best.x, best.y - 16, String(off.dmg), col);
    beep(kind === "spearCrystal" ? 240 : 300, 0.2, "sawtooth", 0.06, -140);
    if (best.hp <= 0) killMonster(world, p, best);
    return true;
  }

  return false;
}
