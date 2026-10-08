/**
 * Choosing what to fight, and what to walk up to and use (Etap 3.1c moved
 * this here from main.ts).
 *
 * Which thing is under the cursor or the thumb is the client's question —
 * it is answered with sprite sizes, and only the client has sprites. What is
 * done about it is this: the thing becomes the player's mark, and for a
 * creature or a training dummy a second click on the same mark is Tibia's
 * toggle and stops the attack. The swings themselves come with the world's
 * tick, once the mark is in reach.
 */
import type { Game } from "../game.ts";
import type { Target } from "../entities/player.ts";
import type { Monster } from "../world/types.ts";
import { NPC_TALK_HOLD_S, TARGET_SEEK_PX } from "../config.ts";
import { dist } from "../util.ts";
import { lineOfSight } from "../world/collision.ts";
import { npcById } from "../world/entities.ts";
import { faceToward } from "../entities/npcs.ts";
import { tell } from "./actor.ts";

/**
 * Mark `t` — a creature or a dummy to attack, a body, a stack, a townsperson
 * or a building to walk up to and use. Whatever the player was walking to or
 * gathering is dropped for it.
 *
 * `toggle` is how a CLICK reads: on the creature or dummy already being
 * attacked it is `stopped` instead, the second click being the way to stop.
 * A menu's "Attack" says what it means and never toggles.
 */
export function setTarget(g: Game, t: Target, toggle = true): "marked" | "stopped" {
  const P = g.player;
  // clicking the monster (or the dummy) you're already attacking STOPS the
  // attack — Tibia-style toggle
  if (toggle && (t.kind === "mob" || t.kind === "dummy") && P.target?.kind === t.kind && P.target.id === t.id) {
    P.target = null;
    tell(g, "attack stopped", "#8ab6ff");
    return "stopped";
  }
  P.target = t;
  if (t.kind === "npc") {
    // clicked: he stops where he is and turns to face you, Tibia-style. The
    // hold is refreshed by tickNpcTalk for as long as the conversation lasts.
    const n = npcById(g.current, t.id);
    if (n) {
      n.talk = NPC_TALK_HOLD_S;
      faceToward(n, P.x, P.y);
    }
  }
  P.dest = null;
  P.gather = null;
  return "marked";
}

/**
 * Mark the nearest creature — or let the current mark go.
 *
 * Chase is half a feature without something to chase. Until now the only way
 * to pick a fight was to tap the creature itself, which is fine alone on a
 * beach and hopeless in a corridor with four skeletons and (soon) three other
 * players standing on each other. This is Tibia's crossed-swords button.
 *
 * Nearest by WALKING distance would be the honest measure, but a BFS per
 * keypress across a 105x100 floor to answer "which one is closest" is a lot
 * of work for a question the player is asking about what they can see. Line
 * of sight plus straight-line distance gets the same answer everywhere it
 * matters and cannot pick something through a wall.
 */
export function targetNearest(g: Game): "marked" | "released" | "none" {
  const P = g.player;
  // pressing it again with a mark in hand releases it — one key, both ways
  if (P.target?.kind === "mob") {
    P.target = null;
    tell(g, "target released", "#8ab6ff");
    return "released";
  }
  const world = g.current;
  let best: Monster | null = null;
  let bestD = Infinity;
  for (const m of world.monsters) {
    if (m.hp <= 0) continue;
    const d = dist(P.x, P.y, m.x, m.y);
    if (d >= bestD || d > TARGET_SEEK_PX) continue;
    if (!lineOfSight(world, P.x, P.y, m.x, m.y)) continue;
    best = m;
    bestD = d;
  }
  if (!best) { tell(g, "nothing in sight", "#e0a06a"); return "none"; }
  P.target = { kind: "mob", id: best.id };
  P.dest = null;
  P.gather = null;
  return "marked";
}
