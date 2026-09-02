/**
 * Spells cast BY monsters.
 *
 * Until now a creature's ranged attack was one thing: a coloured line drawn
 * from it to you, resolving the moment it was fired. That is honest for an
 * arrow and a lie for everything else — the dragon's "fire breath" was an
 * orange stroke, and there was no shape a player could step out of. The whole
 * elemental FX pipeline existed and only the player could reach it.
 *
 * This module is the other half. A monster keeps its ordinary ranged jab (see
 * `RangedDef`, which now just draws itself as a spell bolt when it wants to)
 * and gains a list of BIG attacks: cooldown-gated, aimed at ground rather than
 * at a body, and — the part that matters — TELEGRAPHED.
 *
 * ## The windup, and why nothing is painted on the floor
 *
 * Every cast commits to its footprint, then waits `windupS` before anything
 * lands. The caster is ROOTED for that time, and that root is the whole tell:
 * a creature that stops dead is what a Tibia player reads, and it costs the
 * fight nothing to leave it as the only cue.
 *
 * An earlier pass also painted the committed tiles on the ground. It worked
 * exactly as designed and that was the problem — the shape appeared, you
 * walked off it, nothing happened, and a monster meant to be frightening
 * became a puzzle with the answer printed underneath. The windups are short
 * now (a beat, not a dodge window) and the floor stays clean.
 *
 * `telegraphTiles()` survives anyway. It costs nothing, the tests use it to
 * prove a committed footprint never re-aims, and re-enabling the overlay is
 * one loop in the renderer if a later creature wants a readable wind-up that
 * this one deliberately does not get.
 *
 * ## What the shapes are
 *
 *   bolt   one tile, under the target. The jab, promoted to real artwork.
 *   cone   a breath: rows fanning out from the caster toward the target,
 *          each row lighting a beat after the one in front of it.
 *   line   a bolt: one tile wide, reaching further than a cone and arriving
 *          faster, and — unlike every other shape — STOPPED by anything it
 *          cannot pass. A cone skips a blocked tile and carries on behind it,
 *          which is right for a spreading gas and wrong for a discharge. Walls
 *          are cover against lightning and are not cover against fire, and
 *          that difference is most of what separates the two casters.
 *   field  a plus of tiles that KEEPS BURNING after the cast, hurting anyone
 *          who stands in it. The only shape that outlives its own animation.
 *   nova   the eight tiles touching the caster. The answer to being hugged.
 *
 * Footprints are filtered with `groundBlocked()`, never `walkable()` — walls
 * and water stop a blast, trees and rocks do not. Filtering on `walkable()`
 * punches tree-shaped holes in a wall of fire, which reads as a bug.
 */
import { TILE } from "../config.ts";
import { addBlast, addBolt, addField, burningTiles } from "../gfx/spellFx.ts";
import { ELEMENT_COLOR, type Element, type Tier } from "../systems/elements.ts";
import { groundBlocked } from "../world/collision.ts";
import { rndi } from "../util.ts";
import type { Monster, World } from "../world/types.ts";

/** The four footprints a monster can throw. */
export type SpellShape = "bolt" | "cone" | "line" | "field" | "nova";

export interface MonsterSpell {
  /** Shown in the float text when it lands, so a player can name what hit. */
  name: string;
  element: Element;
  /** FX tier ONLY. Damage comes from `dmg`; the two are deliberately
   *  unlinked so a level-20 caster can throw tier-III-looking fire and a
   *  level-50 one can throw the humble tier-I sheet. */
  tier: Tier;
  shape: SpellShape;
  /** Damage roll, applied in full to anything caught. Elemental, so it
   *  ignores armor exactly as the player's crystals do. */
  dmg: readonly [number, number];
  /** Cast range in px. 0 for the shapes anchored on the caster. */
  range: number;
  cooldownS: number;
  /**
   * Seconds between committing to the shape and it landing. Never zero — the
   * caster is rooted for this long, and a cast with no root has no tell at
   * all, just damage appearing out of a creature that never paused.
   */
  windupS: number;
  /** cone/line: how many tiles deep. Ignored by the other shapes. */
  depth?: number;
  /** field: how long each tile burns, seconds. */
  fieldS?: number;
  /** field: seconds between damage ticks while standing in it. */
  tickS?: number;
}

/** A cast that has been committed to but has not landed yet. */
interface Pending {
  world: World;
  caster: Monster;
  spell: MonsterSpell;
  /**
   * The footprint, resolved AT CAST TIME and never re-aimed.
   *
   * This is the whole contract of the telegraph: what glows is what lands.
   * Re-deriving the shape when it goes off would let it follow a player who
   * stepped out of it, which makes the warning a decoration.
   */
  tiles: readonly { tx: number; ty: number; delay: number }[];
  t: number;
}

const pending: Pending[] = [];

/**
 * Seconds since the module woke up.
 *
 * The world has no clock of its own and the burning-ground tick needs one that
 * survives a tile being re-lit. Accumulating `dt` here is the smallest thing
 * that works and cannot drift out of step with the effects it gates, because
 * it is ticked by the same call that ticks them.
 */
let clock = 0;

/**
 * When each burning tile may next charge the player, keyed `world|tx|ty`.
 *
 * A field's damage cannot live on the field record itself: the FX module owns
 * those and refreshes them when a tile is re-lit, which would silently reset
 * the clock and let a caster tick you every frame by re-casting. Keeping the
 * clock here means re-lighting a tile extends how long it burns and changes
 * nothing about how often it bites.
 *
 * The world IS in the key, and until now only the comment said so — the code
 * keyed on `tx|ty` alone, so tile (10,10) burning on two islands shared one
 * clock. It was harmless only because `clearMonsterSpells()` empties this on
 * every crossing, which means the invariant was being held from another
 * module. Putting the world back in the key makes it hold on its own, which
 * is what a key is for.
 */
const fieldClock = new Map<string, number>();

/** True while this creature is mid-cast and must hold still. */
export function isCasting(m: Monster): boolean {
  return pending.some((p) => p.caster === m);
}

/**
 * The eight tiles touching the caster. Same footprint as the player's Nova,
 * and for the same reason: no target to pick, nothing to line up, you are
 * either standing in it or you are not.
 */
const RING: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/** The four tiles orthogonally touching a centre, plus the centre itself. */
const PLUS: readonly (readonly [number, number])[] = [
  [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0],
];

/**
 * The step direction from one tile toward another, snapped to the eight
 * compass points. A breath has to come out of the creature's mouth along one
 * of the directions its artwork can face, not along the exact bearing to the
 * player's feet.
 */
function step8(fx: number, fy: number, tx: number, ty: number): readonly [number, number] {
  const dx = tx - fx;
  const dy = ty - fy;
  if (dx === 0 && dy === 0) return [1, 0];
  const s = Math.sign;
  // A bearing within ~22.5 degrees of an axis snaps to that axis; everything
  // else is a diagonal. Comparing against half the dominant component is the
  // same test without the trigonometry.
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ay * 2 < ax) return [s(dx), 0];
  if (ax * 2 < ay) return [0, s(dy)];
  return [s(dx), s(dy)];
}

/**
 * The tiles a spell covers and the beat each one lands on.
 *
 * Delays are what make a cone read as something travelling outward rather
 * than seven explosions at once; every other shape lands flat.
 */
export function spellFootprint(
  w: World, spell: MonsterSpell,
  fromTx: number, fromTy: number, toTx: number, toTy: number,
): { tx: number; ty: number; delay: number }[] {
  const out: { tx: number; ty: number; delay: number }[] = [];
  const push = (tx: number, ty: number, delay: number): void => {
    if (groundBlocked(w, tx, ty)) return;
    if (out.some((o) => o.tx === tx && o.ty === ty)) return;
    out.push({ tx, ty, delay });
  };
  switch (spell.shape) {
    case "bolt":
      push(toTx, toTy, 0);
      break;
    case "nova":
      for (const [ox, oy] of RING) push(fromTx + ox, fromTy + oy, 0);
      break;
    case "field":
      for (const [ox, oy] of PLUS) push(toTx + ox, toTy + oy, 0);
      break;
    case "line": {
      const [dx, dy] = step8(fromTx, fromTy, toTx, toTy);
      const reach = Math.max(1, spell.depth ?? 5);
      for (let r = 1; r <= reach; r++) {
        const tx = fromTx + dx * r;
        const ty = fromTy + dy * r;
        // The one shape that stops rather than skipping. `push` would quietly
        // drop the blocked tile and keep painting past it, which would let a
        // bolt reach through a wall and hit someone in the next room.
        if (groundBlocked(w, tx, ty)) break;
        // Tighter than a cone's 0.07: lightning crosses the room, it does not
        // roll across it.
        push(tx, ty, (r - 1) * 0.03);
      }
      break;
    }
    case "cone": {
      const [dx, dy] = step8(fromTx, fromTy, toTx, toTy);
      // Perpendicular in the same eight-way space. For a diagonal breath this
      // is also diagonal, so the fan stays square to the direction it travels.
      const px = -dy;
      const py = dx;
      const depth = Math.max(1, spell.depth ?? 3);
      for (let r = 1; r <= depth; r++) {
        // Widens to three and stops: a cone that keeps opening is a screen
        // wipe by row four, and there is nowhere left to stand.
        const halfW = r === 1 ? 0 : 1;
        for (let o = -halfW; o <= halfW; o++) {
          push(fromTx + dx * r + px * o, fromTy + dy * r + py * o, (r - 1) * 0.07);
        }
      }
      break;
    }
  }
  return out;
}

/**
 * Commit `m` to casting `spell` at a tile. Returns false when the footprint
 * came out empty — a breath aimed into a wall should not lock the creature in
 * place for two thirds of a second and put its spell on cooldown.
 */
export function beginCast(
  w: World, m: Monster, spell: MonsterSpell, toTx: number, toTy: number,
): boolean {
  const foot = spellFootprint(w, spell, m.tx, m.ty, toTx, toTy);
  if (!foot.length) return false;
  pending.push({ world: w, caster: m, spell, tiles: foot, t: 0 });
  return true;
}

/**
 * Advance every pending cast and every burning tile.
 *
 * `hurt` is handed the damage rather than the roll so the caller stays a
 * one-liner. `name` is null for damage that needs no announcement — see the
 * burning-ground tick, which fires once a second and would otherwise paper
 * the screen with its own label.
 */
export function updateMonsterSpells(
  w: World, dt: number,
  target: { tx: number; ty: number; dead: boolean },
  hurt: (dmg: number, el: Element, name: string | null) => void,
): void {
  clock += dt;
  for (let i = pending.length - 1; i >= 0; i--) {
    const p = pending[i];
    if (p.world !== w) continue;
    // A caster killed mid-windup takes its spell with it. Anything else means
    // a corpse finishing a fireball, which nobody will read as intended.
    if (p.caster.hp <= 0 || !w.monsters.includes(p.caster)) {
      pending.splice(i, 1);
      continue;
    }
    p.t += dt;
    if (p.t < p.spell.windupS) continue;
    pending.splice(i, 1);
    land(w, p, target, hurt);
  }

  // burning ground: one bite per tile per `tickS`, and only while you stand
  // on it. The clock is per TILE, so walking across three fields in a row
  // costs three ticks and standing in one costs one.
  const hot = burningTiles(w);
  for (const f of hot) {
    if (target.dead || f.tx !== target.tx || f.ty !== target.ty) continue;
    const key = `${w.key}|${f.tx}|${f.ty}`;
    const next = fieldClock.get(key) ?? 0;
    if (clock < next) continue;
    fieldClock.set(key, clock + FIELD_TICK_S);
    // No label: the fire under your feet is the label.
    hurt(rndi(FIELD_TICK_DMG[0], FIELD_TICK_DMG[1]), f.el, null);
  }
  // Tiles that have gone out stop taking up space in the clock.
  if (fieldClock.size > 64) {
    const live = new Set(hot.map((f) => `${w.key}|${f.tx}|${f.ty}`));
    for (const k of fieldClock.keys()) if (!live.has(k)) fieldClock.delete(k);
  }
}

/**
 * What standing in fire costs, and how often.
 *
 * Deliberately NOT read off the spell that made the field. A tile is on fire;
 * it does not remember who lit it, and a player who walks into a two-minute-old
 * flame should not be punished harder because a stronger creature set it. When
 * a second element wants fields of its own this is where the table goes.
 */
const FIELD_TICK_S = 1.0;
const FIELD_TICK_DMG: readonly [number, number] = [14, 30];

/** Paint the footprint, roll the damage, and light anything that lingers. */
function land(
  w: World, p: Pending,
  target: { tx: number; ty: number; dead: boolean },
  hurt: (dmg: number, el: Element, name: string | null) => void,
): void {
  const { spell, caster } = p;
  for (const { tx, ty, delay } of p.tiles) {
    if (spell.shape === "field") {
      addField(w, tx, ty, spell.element, spell.tier, spell.fieldS ?? 6);
    } else {
      addBlast(w, tx, ty, spell.element, spell.tier, "burst", delay);
    }
  }
  // The bolt is thrown for the shapes that travel to a point. A cone comes out
  // of the mouth and a nova is already on top of you; neither has anything to
  // throw, and drawing one would put a fireball inside the creature's chest.
  if (spell.shape === "bolt" || spell.shape === "field") {
    const { tx, ty } = p.tiles[0];
    addBolt(
      w, caster.x, caster.y - 12,
      tx * TILE + TILE / 2, ty * TILE + TILE / 2,
      spell.element, spell.tier,
    );
  }
  if (target.dead) return;
  // A field has no impact damage of its own: the fire IS the attack. Standing
  // where it lands still costs you, because the burning-ground tick runs later
  // in this same update and finds you on a lit tile — which is the right
  // answer. What it means is that dodging the telegraph cleanly costs nothing
  // at all, rather than nothing-plus-one-free-hit.
  if (spell.shape === "field") return;
  if (p.tiles.some((t) => t.tx === target.tx && t.ty === target.ty)) {
    hurt(rndi(spell.dmg[0], spell.dmg[1]), spell.element, spell.name);
  }
}

/**
 * The tiles every committed cast is currently aimed at.
 *
 * NOT drawn by the game — see the note at the top of this file. It stays
 * exported because it is the only window onto the "a footprint is fixed the
 * moment it is cast" rule, which the tests check and which is easy to break
 * by accident. `heat` runs 0 to 1 across the windup.
 */
export function telegraphTiles(w: World): { tx: number; ty: number; heat: number; color: string }[] {
  const out: { tx: number; ty: number; heat: number; color: string }[] = [];
  for (const p of pending) {
    if (p.world !== w) continue;
    const heat = Math.min(1, p.t / Math.max(0.01, p.spell.windupS));
    const color = ELEMENT_COLOR[p.spell.element];
    for (const { tx, ty } of p.tiles) out.push({ tx, ty, heat, color });
  }
  return out;
}

/** Live count. Tests and nothing else. */
export function pendingCastCount(): number {
  return pending.length;
}

/** Drop every pending cast — travelling between islands, and the tests. */
export function clearMonsterSpells(): void {
  pending.length = 0;
  fieldClock.clear();
}

/** Reset the tick clock as well. Tests only — the game never rewinds. */
export function resetMonsterSpellClock(): void {
  clock = 0;
}
