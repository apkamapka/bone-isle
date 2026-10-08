/**
 * The player's mark, and what it means to fight it (Etap 3.1d moved these
 * here from main.ts).
 *
 * The tick needs them to walk up to a mark and to swing or shoot at it; the
 * client needs the same answers to draw the reticle and the gathering box. A
 * mark is an id, and every helper here turns it back into the thing in the
 * world the player is standing in — or null once it has gone.
 */
import type { Game } from "../game.ts";
import type { Target } from "../entities/player.ts";
import type { ItemKind } from "../items.ts";
import { equippedBow, activeArrow, bestPracticeArrow } from "../items.ts";
import { TILE, MELEE_REACH_PX } from "../config.ts";
import type { Corpse, GroundItem, Monster, Npc, Structure, Vec } from "../world/types.ts";
import { monsterById, corpseById, groundById, npcById, structureById } from "../world/entities.ts";
import { structCenter } from "../systems/building.ts";

/* ---------------- resolving the target ----------------
 *
 * The five helpers below turn the held id back into the thing itself, in the
 * CURRENT world, or null when it is gone. Null is the useful half: a monster
 * that died, a corpse that decayed, a stack somebody else picked up — all of
 * them stop resolving on their own, so the "is this still real?" question
 * that used to be scattered through the update loop as `includes()` calls is
 * answered by the same call that fetches the thing.
 *
 * Each one refuses a target of the wrong kind, so a call site cannot resolve
 * a corpse id against the monster list and get a coincidental hit. */

export function targetMob(g: Game, t: Target | null = g.player.target): Monster | null {
  return t?.kind === "mob" ? monsterById(g.current, t.id) ?? null : null;
}
export function targetCorpse(g: Game, t: Target | null = g.player.target): Corpse | null {
  return t?.kind === "corpse" ? corpseById(g.current, t.id) ?? null : null;
}
export function targetGround(g: Game, t: Target | null = g.player.target): GroundItem | null {
  return t?.kind === "ground" ? groundById(g.current, t.id) ?? null : null;
}
export function targetNpc(g: Game, t: Target | null = g.player.target): Npc | null {
  return t?.kind === "npc" ? npcById(g.current, t.id) ?? null : null;
}
/** Dummies and plain structures share a list, so they share a resolver. */
export function targetStruct(g: Game, t: Target | null = g.player.target): Structure | null {
  return t?.kind === "dummy" || t?.kind === "structure"
    ? structureById(g.current, t.id, g.worlds.home) ?? null : null;
}

/** Where the mark stands: the spot to walk to, aim at and measure reach from. */
export function targetPoint(g: Game): Vec | null {
  const t = g.player.target;
  if (!t) return null;
  if (t.kind === "mob") { const m = targetMob(g, t); return m ? { x: m.x, y: m.y } : null; }
  if (t.kind === "corpse") { const c = targetCorpse(g, t); return c ? { x: c.x, y: c.y } : null; }
  if (t.kind === "ground") { const gi = targetGround(g, t); return gi ? { x: gi.x, y: gi.y } : null; }
  if (t.kind === "npc") { const n = targetNpc(g, t); return n ? { x: n.x, y: n.y } : null; }
  // structure: stand just below the sprite base (footprint-aware anchor)
  const st = targetStruct(g, t);
  if (!st) return null;
  const c = structCenter(st);
  return { x: c.x, y: c.baseY - 4 };
}

/** The tree or rock the player is walking up to and working. */
export function gatherPoint(g: Game): Vec | null {
  const job = g.player.gather;
  if (!job) return null;
  const o = job.obj;
  return { x: o.tx * TILE + TILE / 2, y: o.ty * TILE + TILE / 2 };
}

/** How the player engages a creature right now: shooting from afar, with
 *  the arrow that will fly, or closing to arm's length. */
export interface AttackMode {
  ranged: boolean;
  reach: number;
  arrow: ItemKind | null;
}

/**
 * How the player engages a monster right now. A bow with arrows shoots from
 * afar (its own reach); anything else closes to melee range. A bow with no
 * arrows falls back to a melee poke so you're never fully stuck.
 */
export function attackMode(g: Game): AttackMode {
  const P = g.player;
  const bow = equippedBow(P.eq);
  if (bow) {
    // at the Archery Range practice arrows fire first (that's their job);
    // against anything else only combat arrows count.
    const t = P.target;
    const arrow = t?.kind === "dummy" && targetStruct(g, t)?.key === "range"
      ? bestPracticeArrow(P.bag, P.ammo)
      : activeArrow(P.bag, P.ammo);
    if (arrow) return { ranged: true, reach: bow.range, arrow };
  }
  return { ranged: false, reach: MELEE_REACH_PX, arrow: null };
}
