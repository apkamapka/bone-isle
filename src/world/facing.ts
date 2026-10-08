/**
 * Which way a creature faces after it steps (Etap 3.1b moved this here from
 * gfx/mobSheet.ts).
 *
 * Facing is part of what a creature IS, not of how it is drawn: the server
 * will decide it and every client will draw it, so the rule cannot live in the
 * module that cuts walk sheets. The one fact about artwork it needs — which
 * creatures were only ever drawn from the side — is written down here as a
 * property of those creatures.
 */
import type { MobDir, MonsterKind } from "./types.ts";

/**
 * Creatures whose artwork has only a side view.
 *
 * The snake was drawn facing one way and nothing else — no front, no back. The
 * honest answer is to never show a pose that was never drawn: a step with any
 * horizontal component turns the creature, and a straight up-or-down step
 * leaves it facing where it already was. It slithers across the screen rather
 * than pretending to look at the camera. Both vertical rows of its sheet still
 * carry the side view, because a monster spawns facing "down" before it has
 * taken a single step.
 *
 * The dragon arrived the same way: a pack of side-view frames and nothing
 * else. A quadruped reads better for it than it did for the snake — a big
 * animal crossing the screen in profile is what a dragon looks like in every
 * game that has one — but the rule is identical and so is the reason.
 */
export const SIDE_ONLY_KINDS: ReadonlySet<string> = new Set<string>(["snake", "dragon"]);

/** Facing implied by a grid step. Ties break to the vertical, matching the
 *  player: diagonals read as up/down with a sideways drift. */
export function dirOfStep(sx: number, sy: number): MobDir | null {
  if (sx === 0 && sy === 0) return null;
  if (Math.abs(sy) >= Math.abs(sx)) return sy < 0 ? "up" : "down";
  return sx < 0 ? "left" : "right";
}

/**
 * The facing a creature ends a step in, given where it was already looking.
 *
 * Everything with a full four-view sheet just turns. A side-only creature
 * (see SIDE_ONLY_KINDS) turns on the horizontal and keeps its facing through a
 * purely vertical step, so it never has to show a view nobody drew.
 */
export function stepFacing(
  kind: MonsterKind, sx: number, sy: number, current: MobDir,
): MobDir {
  if (!SIDE_ONLY_KINDS.has(kind)) return dirOfStep(sx, sy) ?? current;
  if (sx === 0) return current;
  return sx < 0 ? "left" : "right";
}
