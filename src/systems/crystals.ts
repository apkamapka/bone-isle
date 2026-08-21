/**
 * Crystals: charge-based consumables that replace the old spell system.
 * Each crystal kind is a stackable item whose stack count IS its charges —
 * one use spends one charge. Life = heal; every offensive shape belongs to
 * the elemental line. Recall is a travel action handled in the main loop
 * (it needs the game object).
 */
import { beep } from "../audio.ts";
import { markBloodHit } from "./skills.ts";
import { active as activeState } from "./playerState.ts";
import { monsterById } from "../world/entities.ts";
import { ELEMENTS, ELEMENT_COLOR, TIER_CODE, crystalDamage, type Element, type Tier } from "./elements.ts";
import { MONSTER_DEFS } from "../entities/monsters.ts";
import { addFloat } from "../fx.ts";
import { dist } from "../util.ts";
import { TILE } from "../config.ts";
import { bagCount, removeItem } from "../items.ts";
import { HEAL_CRYSTAL_BASE, MONSTER_AGGRO_HIT_S, CRYSTAL_COOLDOWN_S } from "../config.ts";
import { killMonster } from "./combat.ts";
import { lineOfSight, groundBlocked } from "../world/collision.ts";
import { addBlast, addBolt } from "../gfx/spellFx.ts";
import type { Player } from "../entities/player.ts";
import type { Facing } from "./outfit.ts";
import type { World } from "../world/types.ts";
import type { ItemKind } from "../items.ts";

/**
 * The two UTILITY crystals. Flare and Spear left in Etap 26 — the elemental
 * line covers offence now, and it does it behind an attunement stone, which
 * is the point: a crystal that hurts things is something you go and earn.
 */
export const CRYSTAL_KINDS: readonly ItemKind[] = ["healCrystal", "recallCrystal"];

export function isCrystal(kind: ItemKind): boolean {
  return CRYSTAL_KINDS.includes(kind);
}

/**
 * The ONE crystal cooldown — elemental line and Life Crystal alike (Etap 30).
 * Module state, not a Player field, so saves need no migration; ticked from
 * the main loop. See CRYSTAL_COOLDOWN_S in config.ts for why healing joined
 * it: with no mana in the game, the turn is the only price a heal can pay.
 */
export function tickCrystalCooldown(dt: number): void {
  const st = activeState();
  st.crystalCd = Math.max(0, st.crystalCd - dt);
}

/** Seconds left on the shared crystal cooldown. Read by the smoke tests. */
export function crystalCooldownLeft(): number {
  return activeState().crystalCd;
}

/** Clear the timer (new game / test isolation). */
export function resetCrystalCooldown(): void {
  activeState().crystalCd = 0;
}

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
  role: "shard" | "burst" | "nova" | "wave";
  base: readonly [number, number];
  /** Cast range in px. 0 for the shapes anchored on the caster. */
  range: number;
}

/**
 * Exori: the eight tiles touching the caster, and nothing further. No target
 * to pick and no line of sight to check — you are standing in it. That is the
 * trade: the widest damage in the game for the price of being in reach of
 * everything it hits.
 */
const NOVA_TILES: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/**
 * Exevo flam hur: three tiles wide at distance 1 and 2, five wide at 3 and 4.
 * Sixteen tiles, fired along the way the character is facing.
 *
 * Written here facing UP and rotated at cast time, so the shape is stated
 * once. Getting a wave to point the right way is otherwise four copies of the
 * same table that drift apart the first time anyone edits one.
 */
const WAVE_TILES: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, -2], [0, -2], [1, -2],
  [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3],
  [-2, -4], [-1, -4], [0, -4], [1, -4], [2, -4],
];

/**
 * Exevo gran mas flam: the diamond, thirteen tiles, every square within two
 * steps counted the way you walk them — |dx| + |dy| <= 2.
 *
 * This replaced a splash measured in PIXELS, which was the older and worse
 * idea: the blast was a circle of 56-80 px that the player could not see, so
 * whether the goblin one tile past the target was caught came down to
 * sub-tile positioning nobody could read. A footprint drawn in tiles is a
 * footprint the player can count, and it is the same every tier — a Pyre
 * Burst hits HARDER than an Ember Burst, not WIDER.
 */
export const BURST_REACH = 3;

const BURST_TILES: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = [];
  for (let dy = -BURST_REACH; dy <= BURST_REACH; dy++) {
    for (let dx = -BURST_REACH; dx <= BURST_REACH; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= BURST_REACH) out.push([dx, dy]);
    }
  }
  return out;
})();

/** The Burst footprint, for the tower blurb and the tests. */
export { BURST_TILES, NOVA_TILES, WAVE_TILES };

/** Turn an UP-facing offset to face where the player is looking. */
function rotate(dx: number, dy: number, dir: Facing, face: 1 | -1): [number, number] {
  if (dir === "up") return [dx, dy];
  if (dir === "down") return [-dx, -dy];
  return face === 1 ? [-dy, dx] : [dy, -dx];
}


/**
 * Damage budgets per form. Every creature caught takes a FULL roll — the same
 * rule Tibia runs on, where a wave that clips four creatures hurts all four.
 * The forms are separated by base damage and by how hard their shape is to
 * land, not by dividing one number up.
 */
const FORM_BASE: Readonly<Record<CrystalSpec["role"], readonly [number, number]>> = {
  shard: [14, 22],  // one target, longest reach, safest
  burst: [9, 15],   // thrown, lands on a pack at range
  nova: [11, 17],   // everything touching you, no aiming, worst position
  wave: [8, 14],    // eleven tiles, but only where you are looking
};

export const CRYSTAL_SPECS: Readonly<Record<string, CrystalSpec>> = (() => {
  const out: Record<string, CrystalSpec> = {};
  for (const el of ELEMENTS) {
    for (let t = 0 as Tier; t < 3; t = (t + 1) as Tier) {
      const n = TIER_CODE[el][t];
      out[`${el}${n}Shard`] = { element: el, tier: t, role: "shard", base: FORM_BASE.shard, range: 260 + t * 30 };
      out[`${el}${n}Burst`] = { element: el, tier: t, role: "burst", base: FORM_BASE.burst, range: 220 + t * 30 };
      out[`${el}${n}Nova`] = { element: el, tier: t, role: "nova", base: FORM_BASE.nova, range: 0 };
      out[`${el}${n}Wave`] = { element: el, tier: t, role: "wave", base: FORM_BASE.wave, range: 0 };
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
  // The marked creature, resolved in THIS world. A mark left behind on another
  // island resolves to nothing here and falls through to the nearest-target
  // search below, which is exactly right — it is not on screen to aim at.
  const marked = t && t.kind === "mob" ? monsterById(world, t.id) : undefined;
  if (marked && marked.hp > 0) {
    if (dist(p.x, p.y, marked.x, marked.y) > range) {
      addFloat(world, p.x, p.y - 44, "too far", "#ff9e6a");
      return null;
    }
    if (!lineOfSight(world, p.x, p.y, marked.x, marked.y)) {
      addFloat(world, p.x, p.y - 44, "no line of sight", "#ff9e6a");
      return null;
    }
    return marked;
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

/** One tile of a spell's footprint: where it lands and when it goes off. */
interface Struck {
  tx: number;
  ty: number;
  /** Seconds to wait before this tile lights up. Turns thirteen simultaneous
   *  explosions into something that reads as a blast travelling outwards. */
  delay: number;
}

/**
 * Light up a footprint.
 *
 * Only the GROUND can refuse a flame — water, a cave wall, a palisade. A tree
 * or a rock does not: the tile burns and the prop stands in front of the fire,
 * exactly the way it stands in front of the player who walks behind it. The
 * first version skipped those tiles too and punched a visible hole in every
 * blast that clipped a trunk.
 *
 * A wave whose far end vanishes into rock still tells the player where the
 * room ends — that part was right, and walls keep doing it.
 */
function paint(
  world: World, tiles: readonly Struck[], el: Element, tier: Tier, slot: "burst" | "wave" | "nova" | "hit",
): void {
  for (const s of tiles) {
    if (groundBlocked(world, s.tx, s.ty)) continue;
    addBlast(world, s.tx, s.ty, el, tier, slot, s.delay);
  }
}

/** Every living creature standing on one of these tiles. */
function caughtOn(world: World, tiles: readonly Struck[]): World["monsters"] {
  return world.monsters.filter((m) => {
    if (m.hp <= 0) return false;
    const mx = Math.floor(m.x / TILE);
    const my = Math.floor(m.y / TILE);
    return tiles.some((s) => s.tx === mx && s.ty === my);
  });
}

/** One creature takes one full elemental roll, straight past its armor. */
function damageWithElement(
  world: World, p: Player, m: World["monsters"][number], spec: CrystalSpec, col: string,
): void {
  const dmg = crystalDamage(spec.base, spec.tier, p.level, MONSTER_DEFS[m.kind].resist, spec.element);
  m.hp -= dmg;
  m.hurtT = 0.2;
  m.aggroT = MONSTER_AGGRO_HIT_S;
  const resisted = (MONSTER_DEFS[m.kind].resist?.[spec.element] ?? 1) < 1;
  addFloat(world, m.x, m.y - 32, resisted ? `${dmg}!` : String(dmg), col);
  if (m.hp <= 0) killMonster(world, p, m);
}

/**
 * Crystals the player AIMS rather than points at a creature.
 *
 * A Burst is thrown at GROUND, not at a target: twenty-five tiles land where
 * you put them, so letting it pick the nearest creature threw away the only
 * decision the shape exists to offer. This is Tibia's great fireball — select
 * the rune, then click the square.
 *
 * Everything else keeps auto-targeting. A Shard is one bolt at one creature
 * and a second click to say which would be ceremony, and Nova and Wave are
 * anchored on the caster with nothing to aim at.
 */
export function isAimedCrystal(kind: ItemKind): boolean {
  return CRYSTAL_SPECS[kind]?.role === "burst";
}

/**
 * Apply a Life or elemental crystal. Returns true if a charge was consumed.
 * Recall is NOT handled here — the caller (main loop) does travel + charge.
 *
 * `aim` is the world point an aimed crystal was thrown at. An aimed crystal
 * with no aim point refuses the cast and keeps the charge: that is the signal
 * for the caller to arm its targeting cursor instead of guessing a target.
 */
export function useCrystal(
  world: World, p: Player, kind: ItemKind, aim?: { x: number; y: number },
): boolean {
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
    // Healing shares ONE timer with the elemental line (Etap 30). Tibia pays
    // for a heal in mana; with no mana here the only currency left is the
    // turn, so a crystal spent on your own bar is a crystal not thrown at
    // what is hitting you. The refusal is silent about which crystal blocked
    // it — "not ready" is the same message either way, because to the player
    // there is now only one cooldown to learn.
    if (activeState().crystalCd > 0) {
      addFloat(world, p.x, p.y - 44, "not ready", "#8ab6ff");
      return false;
    }
    removeItem(p.bag, kind, 1);
    activeState().crystalCd = CRYSTAL_COOLDOWN_S;
    const amount = HEAL_CRYSTAL_BASE + p.level * 3;
    p.hp = Math.min(p.maxhp, p.hp + amount);
    addFloat(world, p.x, p.y - 40, `+${amount}`, "#7dff9e");
    beep(660, 0.2, "sine", 0.06, 220);
    return true;
  }

  // ---- the elemental line ----
  const spec = CRYSTAL_SPECS[kind];
  if (spec) {
    if (activeState().crystalCd > 0) {
      addFloat(world, p.x, p.y - 44, "not ready", "#8ab6ff");
      return false;
    }
    const col = ELEMENT_COLOR[spec.element];

    // Nova and Wave are anchored on the caster: no target to pick, no line of
    // sight to fail. They resolve on TILES, so what they hit is exactly what
    // the player can see themselves standing next to or looking at.
    if (spec.role === "nova" || spec.role === "wave") {
      const px = Math.floor(p.x / TILE);
      const py = Math.floor(p.y / TILE);
      // A Nova goes off all at once — you are standing in the middle of it.
      // A Wave travels, so its rows light up in order, and the delay is read
      // off the offset BEFORE rotation: `dy` is -1, -2, -3 no matter which way
      // the caster is looking, which is the one number that survives the turn.
      const shape: Struck[] = spec.role === "nova"
        ? NOVA_TILES.map(([dx, dy]) => ({ tx: px + dx, ty: py + dy, delay: 0 }))
        : WAVE_TILES.map(([dx, dy]) => {
          const [rx, ry] = rotate(dx, dy, p.dir, p.face);
          return { tx: px + rx, ty: py + ry, delay: (Math.abs(dy) - 1) * 0.05 };
        });
      const hit = caughtOn(world, shape);
      // The charge is spent whether or not anything was standing there —
      // aiming is the skill, and a wave that refunds itself on a miss is a
      // wave you fire blindly.
      removeItem(p.bag, kind, 1);
      activeState().crystalCd = CRYSTAL_COOLDOWN_S;
      paint(world, shape, spec.element, spec.tier, spec.role);
      if (hit.length) markBloodHit();
      for (const m of hit) damageWithElement(world, p, m, spec, col);
      beep(spec.role === "nova" ? 150 : 240, 0.22, "sawtooth", 0.07, spec.role === "nova" ? -200 : 180);
      return true;
    }

    // Where this one is going. A Burst goes where it was AIMED and nowhere
    // else; a Shard still finds its own creature.
    let toX: number;
    let toY: number;
    let target: World["monsters"][number] | null = null;
    if (spec.role === "burst") {
      // No aim point means the caller has not asked the player yet. Refuse
      // quietly and keep the charge — the cursor gets armed instead.
      if (!aim) return false;
      if (dist(p.x, p.y, aim.x, aim.y) > spec.range) {
        addFloat(world, p.x, p.y - 44, "too far", "#ff9e6a");
        return false;
      }
      if (!lineOfSight(world, p.x, p.y, aim.x, aim.y)) {
        addFloat(world, p.x, p.y - 44, "no line of sight", "#ff9e6a");
        return false;
      }
      if (groundBlocked(world, Math.floor(aim.x / TILE), Math.floor(aim.y / TILE))) {
        addFloat(world, p.x, p.y - 44, "you cannot throw there", "#ff9e6a");
        return false;
      }
      toX = aim.x;
      toY = aim.y;
    } else {
      target = pickTarget(world, p, spec.range);
      if (!target) return false;
      toX = target.x;
      toY = target.y;
    }
    removeItem(p.bag, kind, 1);
    activeState().crystalCd = CRYSTAL_COOLDOWN_S;
    markBloodHit();
    p.face = toX < p.x ? -1 : 1;

    // The projectile is cosmetic and the hit is already resolved, exactly as
    // an arrow's is — but the BLOOM waits for it to arrive, so an explosion
    // never beats its own fireball to the ground.
    const flight = addBolt(world, p.x, p.y - 16, toX, toY - 12, spec.element, spec.tier);
    const ox = Math.floor(toX / TILE);
    const oy = Math.floor(toY / TILE);
    const shape: Struck[] = spec.role === "burst"
      ? BURST_TILES.map(([dx, dy]) => ({
        tx: ox + dx, ty: oy + dy,
        delay: flight + (Math.abs(dx) + Math.abs(dy)) * 0.045,
      }))
      : [{ tx: ox, ty: oy, delay: flight }];
    paint(world, shape, spec.element, spec.tier, spec.role === "burst" ? "burst" : "hit");

    // A burst catches everything on its footprint, a shard puts it all into
    // one creature. Both go STRAIGHT to hp — elemental damage is the channel
    // that armor does not get to stop, and that bypass is the entire reason to
    // spend gold on crystals at all.
    const caught = spec.role === "burst" ? caughtOn(world, shape) : [target!];
    for (const m of caught) damageWithElement(world, p, m, spec, col);
    beep(spec.role === "burst" ? 180 : 320, 0.2, "sawtooth", 0.06, spec.role === "burst" ? -160 : 120);
    return true;
  }

  return false;
}
