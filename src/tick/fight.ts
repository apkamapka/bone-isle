/**
 * Fighting: the shots and swings at the mark, and what a fire does to whoever
 * stands in it (Etap 3.1d moved this here from main.ts).
 */
import type { Game } from "../game.ts";
import type { Player, Target } from "../entities/player.ts";
import type { World } from "../world/types.ts";
import { ARROW_MISS_WARN_S, MELEE_REACH_PX, MIN_ELEMENTAL_DAMAGE } from "../config.ts";
import { dist, rndi } from "../util.ts";
import { equippedBow } from "../items.ts";
import { lineOfSight } from "../world/collision.ts";
import { playerAttack, playerShoot, hitDummy, shootDummy, hurtPlayer, burnMonster } from "../systems/combat.ts";
import { FIELD_BURN_TICK_S, FIELD_BURN_DMG, elementEdgeMultiplier } from "../systems/elements.ts";
import { playerElement } from "../systems/tower.ts";
import { tell, refuseFromProtection } from "../intents/actor.ts";
import { targetMob, targetStruct, targetPoint, attackMode, type AttackMode } from "./targets.ts";
import { faceDelta } from "./walk.ts";

/**
 * What standing in a campfire costs, and how often.
 *
 * A campfire stopped sealing its square, because its artwork is one tile
 * exactly and its body only twenty-one rows of thirty-two, so a third of a
 * solid square read as bare ground the player was refused. Walking through one
 * had to become possible. It should not become free.
 *
 * The numbers are deliberately below a monster's burning ground, which bites
 * 14-30 a second: a bonfire someone lit to cook over is not a fire field a
 * shaman dropped on your head. Flat, and unscaled by level, exactly like the
 * spell fields — which means it is a real cost at fourteen and a nuisance at a
 * hundred. That is the right shape for scenery. Crossing one costs a bite;
 * standing in one drains you and says so.
 *
 * The clock is per TILE, like the burning ground's, so walking a line of three
 * camp fires costs three bites rather than one.
 */
export const FIRE_BURN_TICK_S = 1.0;
export const FIRE_BURN_DMG: readonly [number, number] = [6, 12];

/** Seconds until "no arrows" may be said again, per player. */
const arrowWarn = new WeakMap<Player, number>();

/** Say "no arrows" — once per ARROW_MISS_WARN_S, not once per swing. */
export function warnNoArrows(g: Game): void {
  const P = g.player;
  if ((arrowWarn.get(P) ?? 0) > 0) return;
  arrowWarn.set(P, ARROW_MISS_WARN_S);
  tell(g, "no arrows", "#ff9e6a");
}

/** Run the "no arrows" clock down. */
export function coolArrowWarning(P: Player, dt: number): void {
  const left = arrowWarn.get(P) ?? 0;
  if (left > 0) arrowWarn.set(P, Math.max(0, left - dt));
}

/**
 * Fire the currently-kept ranged target when it's within reach and the attack is
 * off cooldown. Runs every frame while kiting, independent of movement, so you
 * can walk away and still loose arrows. Faces the target and drops it on death.
 */
export function tickRangedFire(g: Game, mode: AttackMode): void {
  const P = g.player;
  if (refuseFromProtection(g)) return;
  const t = P.target;
  if (!t || !mode.arrow) return;
  if (t.kind === "mob") {
    // A target that died, decayed or was left on another island simply stops
    // resolving — no separate liveness check needed any more.
    const m = targetMob(g, t);
    if (!m || m.hp <= 0) { P.target = null; return; }
    faceDelta(P, m.x - P.x, m.y - P.y);
    // range AND a clear line of fire — arrows no longer thread cave walls
    // (which made the dragon a shooting-gallery target from total safety)
    if (dist(P.x, P.y, m.x, m.y) <= mode.reach && P.atkCd <= 0
      && lineOfSight(g.current, P.x, P.y, m.x, m.y)) {
      P.atkCd = P.atkRate;
      if (playerShoot(g.current, P, m, mode.arrow)) P.target = null;
    }
  } else if (t.kind === "dummy") {
    const tp = targetPoint(g);
    if (!tp) return;
    faceDelta(P, tp.x - P.x, tp.y - P.y);
    const st = targetStruct(g, t);
    if (st && dist(P.x, P.y, tp.x, tp.y) <= mode.reach && P.atkCd <= 0) {
      P.atkCd = P.atkRate;
      shootDummy(g.current, P, st, mode.arrow);
    }
  }
}

/**
 * Swing at the currently-kept MELEE target whenever it's within arm's reach
 * and the attack is off cooldown. Runs every frame (like tickRangedFire), so
 * the attack persists through manual movement and looting. Slightly more
 * reach slack than the approach stop-distance so a wiggling monster doesn't
 * stutter in and out of range.
 */
export function tickMeleeFire(g: Game): void {
  const P = g.player;
  if (refuseFromProtection(g)) return;
  const t = P.target;
  if (!t || t.kind !== "mob") return;
  const m = targetMob(g, t);
  if (!m || m.hp <= 0) { P.target = null; return; }
  if (dist(P.x, P.y, m.x, m.y) <= MELEE_REACH_PX && P.atkCd <= 0) {
    P.atkCd = P.atkRate;
    faceDelta(P, m.x - P.x, m.y - P.y);
    if (equippedBow(P.eq)) warnNoArrows(g); // bow with an empty quiver pokes, but nags
    if (playerAttack(g.current, P, m)) P.target = null;
  }
}

/**
 * A blow or a shot at the mark, once it is in reach and the attack is off its
 * cooldown — the creature or training dummy the player walked up to (this was
 * the fighting half of `resolveTarget` in main.ts).
 */
export function strike(g: Game, t: Target): void {
  const P = g.player;
  if (t.kind === "mob") {
    const m = targetMob(g, t);
    if (!m) { P.target = null; return; }
    if (P.atkCd <= 0) {
      P.atkCd = P.atkRate;
      const mode = attackMode(g);
      if (mode.ranged && mode.arrow) {
        if (playerShoot(g.current, P, m, mode.arrow)) P.target = null;
      } else {
        if (equippedBow(P.eq)) warnNoArrows(g);
        if (playerAttack(g.current, P, m)) P.target = null;
      }
    }
  } else if (t.kind === "dummy") {
    const st = targetStruct(g, t);
    if (!st) { P.target = null; return; }
    if (P.atkCd <= 0) {
      P.atkCd = P.atkRate;
      const mode = attackMode(g);
      if (mode.ranged && mode.arrow) shootDummy(g.current, P, st, mode.arrow);
      else if (st.key === "range") {
        // the straw butt only takes arrows — no bow (or an empty quiver)
        // means nothing to train with, so let go instead of punching it
        tell(g, "you need a bow and arrows", "#e0a06a");
        P.target = null;
      }
      else { if (equippedBow(P.eq)) warnNoArrows(g); hitDummy(g.current, P, st); }
    }
  }
}

/* ---------------- hazards ---------------- */

/** When each hazard tile may bite this player again, on the hazard clock. */
const fireClocks = new WeakMap<Player, Map<string, number>>();
/** The hazard clock: seconds of game time. One player is ticked per frame
 *  today, so advancing it in `tickCampfireBurn` advances it once a frame; the
 *  server, ticking many, will move it to the world's turn (Etap 3.7). */
let fireT = 0;

/**
 * Standing in a campfire burns you.
 *
 * A camp fire seals nothing — its artwork is one tile exactly and only
 * twenty-one rows of it are flame, so a third of a solid square used to read as
 * bare ground the player was refused entry to. Making it walkable removed that
 * lie; this puts the cost back, which is what "walk through it if you like"
 * ought to mean.
 *
 * Deliberately the same shape as the burning ground a monster's fire field
 * leaves: elemental, so it goes straight past shield and armour — you cannot
 * raise a buckler against a fire you are standing in — one bite per tile per
 * tick, and no floating label, because the flame under your feet is the label.
 * The clock is keyed per TILE, so crossing three fires in a row costs three
 * bites while standing in one costs one.
 */
export function tickCampfireBurn(g: Game, world: World, dt: number): void {
  const P = g.player;
  let fireClock = fireClocks.get(P);
  if (!fireClock) {
    fireClock = new Map<string, number>();
    fireClocks.set(P, fireClock);
  }
  fireT += dt;
  if (P.dead) return;
  for (const f of world.fires) {
    if (f.tx !== P.tx || f.ty !== P.ty) continue;
    const key = `${world.key}|${f.tx}|${f.ty}`;
    const next = fireClock.get(key) ?? 0;
    if (fireT < next) continue;
    fireClock.set(key, fireT + FIRE_BURN_TICK_S);
    const raw = rndi(FIRE_BURN_DMG[0], FIRE_BURN_DMG[1]);
    const dmg = Math.max(MIN_ELEMENTAL_DAMAGE,
      Math.round(raw * elementEdgeMultiplier("fire", playerElement())));
    hurtPlayer(world, P, dmg, true);
  }
  /* THE OTHER FOUR ELEMENTS BITE TOO, on the same terms.
   *
   * The lid of the temple carried sixteen glowing squares that looked exactly
   * as dangerous as the camp fires beside them and cost nothing at all to walk
   * through. That is the ground telling a lie, and it is the same lie the camp
   * fire used to tell before it was made walkable and made to hurt.
   *
   * `ambientFx` ONLY. `attuneNodes` — the five rune circles — are left alone
   * deliberately: they are the thing the errand is about, and charging a
   * player health for accepting the gift he came for would be a joke at his
   * expense. The two lists are separate in `World` for exactly this kind of
   * reason.
   *
   * The clock is shared with the fires and keyed on the tile, so a field and a
   * fire could not double-bite the same square even if one were ever placed on
   * the other — and a test says none ever is.
   */
  for (const nd of world.ambientFx) {
    if (nd.tx !== P.tx || nd.ty !== P.ty) continue;
    const key = `${world.key}|${nd.tx}|${nd.ty}`;
    const next = fireClock.get(key) ?? 0;
    if (fireT < next) continue;
    fireClock.set(key, fireT + FIELD_BURN_TICK_S);
    const raw = rndi(FIELD_BURN_DMG[0], FIELD_BURN_DMG[1]);
    const dmg = Math.max(MIN_ELEMENTAL_DAMAGE,
      Math.round(raw * elementEdgeMultiplier(nd.el, playerElement())));
    hurtPlayer(world, P, dmg, true);
  }
  // the map's fires never move, but travelling between worlds retires the keys
  if (fireClock.size > 64) {
    for (const k of fireClock.keys()) if (!k.startsWith(`${world.key}|`)) fireClock.delete(k);
  }
}

/**
 * The same two hazards biting monsters instead of the player — Tibia burns
 * anything standing in a fire, not just the character. The cooldown lives on
 * the creature itself (`m.burnAt`), not in a map keyed like `fireClock`: a
 * monster's id never repeats, so a map entry per creature would grow by one
 * every respawn for the rest of the session and nothing would ever remove it.
 * A fire and a field are never stacked on one square (see `tickCampfireBurn`),
 * so at most one of the two loops below ever lands a hit per monster per
 * tick — the `break`s are just cheap insurance against that changing later.
 */
export function tickMonsterBurn(g: Game, world: World): void {
  const P = g.player;
  for (const m of [...world.monsters]) {
    if (m.hp <= 0) continue;
    if ((m.burnAt ?? 0) > fireT) continue;
    for (const f of world.fires) {
      if (f.tx !== m.tx || f.ty !== m.ty) continue;
      m.burnAt = fireT + FIRE_BURN_TICK_S;
      burnMonster(world, P, m, "fire", rndi(FIRE_BURN_DMG[0], FIRE_BURN_DMG[1]));
      break;
    }
    if (m.hp <= 0) continue;
    for (const nd of world.ambientFx) {
      if (nd.tx !== m.tx || nd.ty !== m.ty) continue;
      m.burnAt = fireT + FIELD_BURN_TICK_S;
      burnMonster(world, P, m, nd.el, rndi(FIELD_BURN_DMG[0], FIELD_BURN_DMG[1]));
      break;
    }
  }
}
