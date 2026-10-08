/**
 * Who a request is made by, and the questions every request asks about them
 * (Etap 3.1c).
 *
 * WHAT THIS FOLDER IS
 * -------------------
 * Everything a player can ASK the game for — move a stack, eat, put a sword
 * on, throw a bag into the sea — used to be written inside main.ts, beside the
 * code that draws the windows it is asked from. A server has no windows. It
 * receives "move five wood from that body into my bag" from a client and has
 * to carry it out under exactly the same rules, or refuse it with the same
 * words. So each request is now a plain function in `intents/`: it takes the
 * game and the request, changes the state, and reports what should be seen
 * and heard as events. main.ts only turns clicks and drags into these calls.
 *
 * THE ACTOR
 * ---------
 * `g.player` is who is asking and `g.current` is the world they stand in.
 * Today there is one of each. The server will hand every request a Game whose
 * `player` and `current` belong to the client that sent it, with `worlds`
 * shared by everybody — the functions here will not have to change for it.
 *
 * WHAT A REQUEST MAY NOT DO
 * -------------------------
 * Touch a window. When a window has to follow — a body looted bare takes its
 * loot window with it — the client notices the body is gone and closes it,
 * which it must be able to do anyway once somebody else can empty the body
 * you are looking at.
 */
import type { Game } from "../game.ts";
import type { Npc, Structure } from "../world/types.ts";
import { PANEL_REACH_TILES, USE_RANGE_PX } from "../config.ts";
import { dist } from "../util.ts";
import { chebToPoint } from "../world/grid.ts";
import { isSafeTile } from "../world/collision.ts";
import { structGap } from "../systems/building.ts";
import { floatSelf, logLine } from "../systems/fxEvents.ts";

/** The colour a plain remark to the player is written in. */
export const TELL_COLOR = "#ffe9a8";

/**
 * Say something to the player who asked.
 *
 * Two places at once, on purpose. The float is how it is READ — it appears
 * where the eyes already are and needs no attention — and the Server Log is
 * how it is RE-read: a refusal you blinked past is still there. Both are for
 * the asking player alone; nobody standing beside them sees "too heavy".
 * (This was `flash` in main.ts, and says exactly what it said.)
 */
export function tell(g: Game, text: string, color = TELL_COLOR): void {
  const p = g.player;
  floatSelf(g.current, p.x, p.y - 60, text, color);
  logLine(text, color);
}

/**
 * Within arm's reach of a loose thing in the world — a body, a container on
 * the floor. One square, counted on the grid, so a diagonal neighbour counts
 * and a tile two along never does.
 */
export function withinReach(g: Game, x: number, y: number): boolean {
  return chebToPoint(g.player.tx, g.player.ty, x, y) <= PANEL_REACH_TILES;
}

/** The same reach, against a placed structure's footprint. */
export function structInReach(g: Game, s: Structure): boolean {
  return structGap(s, g.player.tx, g.player.ty) <= PANEL_REACH_TILES;
}

/** Is the player near any owned Home-Isle structure of the given kinds? The
 *  Forge and the Tower answer only to someone standing at them. */
export function nearStructure(g: Game, ...keys: string[]): boolean {
  if (g.current !== g.worlds.home) return false;
  for (const s of g.worlds.home.structures) {
    if (!keys.includes(s.key)) continue;
    if (structInReach(g, s)) return true;
  }
  return false;
}

/** Is the player near an NPC accepted by `match` on the current island? A
 *  counter serves only whoever is standing at it. */
export function nearNpc(g: Game, match: (n: Npc) => boolean): boolean {
  const P = g.player;
  return g.current.npcs.some((n) => match(n) && dist(P.x, P.y, n.x, n.y) < USE_RANGE_PX);
}

/**
 * Is the player standing somewhere they may not fight from?
 *
 * A protection zone is a protection zone: you cannot strike out of one and
 * nothing can reach you inside it. Half of that was already true — a creature
 * cannot walk into a haven (`occOf` refuses the tile, `pushMonster` refuses
 * the spawn) — and the missing half is what made it an exploit rather than a
 * refuge. From a safe tile you could shell a pack that had no way to answer:
 * crystals, arrows, and a sword swung across the boundary all landed.
 *
 * `mayHit` in pvp.ts has always said this about PLAYERS and its comment notes
 * that monsters never come through it. This is the same sentence about
 * everything else, so the zone finally means one thing rather than two.
 */
export function inProtection(g: Game): boolean {
  const P = g.player;
  return isSafeTile(g.current, P.tx, P.ty);
}

/**
 * Refuse an attack made from a protection zone, and say so once.
 *
 * Once is the whole reason this is a function. Auto-attack asks twice a
 * second, so a refusal that flashed every time it was asked would bury the
 * screen; the mark is dropped instead, which is what Tibia does when you step
 * into a temple and is a thing the player can actually see happen.
 */
export function refuseFromProtection(g: Game): boolean {
  const P = g.player;
  if (!inProtection(g)) return false;
  if (P.target) {
    P.target = null;
    tell(g, "no fighting from a protected zone", "#8ab6ff");
  }
  return true;
}
