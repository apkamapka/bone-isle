/**
 * The player walking: the A* route to a goal, and which way they face (Etap
 * 3.1d moved this here from main.ts).
 */
import type { Game } from "../game.ts";
import type { Player } from "../entities/player.ts";
import type { World } from "../world/types.ts";
import { glideWalker, tryStep, findPath, type Occupied } from "../world/grid.ts";

/* ---------------- grid walking (player) ---------------- */

/** The cached A* route a player is following (tile coords), and the goal it
 *  was planned for. One per player: two people walking must not share one. */
interface Route {
  steps: { x: number; y: number }[];
  key: string;
}

const routes = new WeakMap<Player, Route>();

function routeOf(p: Player): Route {
  let r = routes.get(p);
  if (!r) {
    r = { steps: [], key: "" };
    routes.set(p, r);
  }
  return r;
}

/** Steps taken by hand make any planned route stale. */
export function forgetRoute(p: Player): void {
  routeOf(p).key = "";
}

/**
 * Tiles claimed by creatures — the player can never step onto one. Townsfolk
 * count: now that the smith walks, sharing his square would let him slide
 * through you, and A* routes around him for free anyway.
 */
export function playerOcc(world: World): Occupied {
  return (tx, ty) => world.monsters.some((m) => m.tx === tx && m.ty === ty)
    || world.npcs.some((n) => n.tx === tx && n.ty === ty);
}

/**
 * Walk the player toward the goal tile along an A*-planned route, spending up
 * to `budget` px of movement this frame. The route is cached and replanned
 * only when the goal changes or a monster steps into the next square, so the
 * cost stays negligible. Returns true while genuinely progressing — false
 * means "stuck or arrived", letting callers clear their destination.
 */
export function walkGrid(g: Game, world: World, gx: number, gy: number, budget: number): boolean {
  const P = g.player;
  const r = routeOf(P);
  const occ = playerOcc(world);
  const key = world.key + ":" + gx + "," + gy;
  if (key !== r.key) {
    r.key = key;
    r.steps = [];
  }
  let moved = false;
  for (;;) {
    const left = glideWalker(P, budget);
    if (left < budget) moved = true; // some glide happened
    budget = left;
    if (budget <= 0) break;
    if (P.tx === gx && P.ty === gy) break;
    if (!r.steps.length) {
      r.steps = findPath(world, P.tx, P.ty, gx, gy, occ);
      if (!r.steps.length) break;
    }
    const n = r.steps[0];
    const sx = n.x - P.tx;
    const sy = n.y - P.ty;
    const ok = Math.abs(sx) <= 1 && Math.abs(sy) <= 1 && tryStep(world, P, sx, sy, occ);
    if (ok) {
      r.steps.shift();
      faceDelta(P, sx, sy);
      moved = true;
      continue;
    }
    // a monster claimed the next square (or the route went stale): replan once
    r.steps = findPath(world, P.tx, P.ty, gx, gy, occ);
    const n2 = r.steps[0];
    const s2x = n2 ? n2.x - P.tx : 0;
    const s2y = n2 ? n2.y - P.ty : 0;
    if (n2 && tryStep(world, P, s2x, s2y, occ)) {
      r.steps.shift();
      faceDelta(P, s2x, s2y);
      moved = true;
      continue;
    }
    break; // boxed in this frame — try again next frame
  }
  return moved;
}

/**
 * Pick the render facing from a movement/aim delta. Vertical wins only when it
 * clearly dominates, so diagonal movement keeps the more readable side view —
 * the same bias Tibia's outfits use.
 */
export function faceDelta(P: Player, dx: number, dy: number): void {
  if (Math.abs(dy) > Math.abs(dx) * 1.4) P.dir = dy < 0 ? "up" : "down";
  else if (dx !== 0) { P.dir = "side"; P.face = dx < 0 ? -1 : 1; }
}
