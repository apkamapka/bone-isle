/**
 * Which of several nearby things did the player point at?
 *
 * WHY THIS IS ITS OWN FILE
 * ------------------------
 * It is four lines of arithmetic that were wrong for months, in two places,
 * and nobody could see it. The searches behind "look" and behind the context
 * menu were `list.find(within one tile)`, which returns the first entry in
 * ARRAY order that happens to be somewhere nearby — not the one under the
 * cursor. With one thing on the ground it is indistinguishable from correct.
 * With two, it is a coin flip decided by drop order.
 *
 * Radek found it with two suits of armour lying together: pointing at either
 * described whichever had been dropped first, and moving one of them changed
 * the answer for no reason visible in the game. Any two entities within a tile
 * of each other had the same bug all along.
 *
 * Living in main.ts, the rule could only be checked by reading the source as
 * a string. Out here it is a function with arguments and a return value, so
 * the tests can actually put two things next to each other and point between
 * them — which is the only kind of test that would have caught this.
 */
import { toTile } from "./grid.ts";

export interface Point {
  x: number;
  y: number;
}

/**
 * The nearest thing in `list` to `at`, or null if nothing is close enough.
 *
 * The search box is ±1 TILE around the pointed-at square, and it stays loose
 * on purpose: a sprite is taller and wider than the tile it stands on, so a
 * creature's head, a chest's lid and a signpost's board all hang over their
 * neighbours. Demanding a pixel-perfect hit would turn looking at a rat into
 * a game of skill.
 *
 * What the box does NOT get to decide is which candidate wins:
 *
 *   1. Anything on the EXACT tile beats anything on a neighbouring one,
 *      however the pixels fall. You pointed at a square, and the square is
 *      the most explicit thing you said.
 *   2. Among things on equal footing, nearest to the actual click point.
 *   3. And when two are EQUALLY near — which is not a corner case but the
 *      normal one, because ten stacks dropped on a single tile all share one
 *      pixel position — the one on TOP of the pile wins.
 *
 * Rule 3 is Tibia's rule and it was missing. The scan kept the first entry it
 * found at the best score, and first in `world.ground` is the OLDEST drop,
 * which the renderer draws at the BOTTOM: `drawList` is sorted by `y` and
 * `sort` is stable, so equal-`y` items keep array order and the last one
 * painted is the one you can see. So the pile you were looking at and the item
 * you picked up were opposite ends of the same stack.
 *
 * Keeping the LAST best rather than the first is the whole of the fix, and it
 * is right for every list this is called with: a newer corpse lies on top of
 * an older one for the same reason.
 *
 * So it is an ORDERING, not a filter — a lone item a tile over is still
 * found, which is the whole reason the loose box exists.
 */
export function nearestHit<T extends Point>(
  list: readonly T[], at: Point, keep?: (t: T) => boolean,
): T | null {
  const tx = toTile(at.x);
  const ty = toTile(at.y);
  let best: T | null = null;
  let bestScore = Infinity;
  for (const e of list) {
    if (keep && !keep(e)) continue;
    const ex = toTile(e.x);
    const ey = toTile(e.y);
    if (Math.abs(ex - tx) > 1 || Math.abs(ey - ty) > 1) continue;
    /* 1e6 is simply "further than any pixel distance inside a 3x3 tile box",
     * which makes the on-tile test a hard sort key rather than a heavy
     * thumb on the scale. A weighted distance would let a neighbour win by
     * being very slightly closer, and that is the bug in a subtler coat. */
    const onTile = ex === tx && ey === ty ? 0 : 1e6;
    const score = onTile + Math.hypot(e.x - at.x, e.y - at.y);
    // `<=`, not `<`: on a tie the LATER entry wins, and later is higher in
    // the pile. See rule 3 above — this single character is the difference
    // between picking up what you can see and picking up what is under it.
    if (score <= bestScore) { bestScore = score; best = e; }
  }
  return best;
}

export interface Footprinted {
  tx: number;
  ty: number;
}

/**
 * The tile-addressed thing whose footprint covers (tx,ty), or null.
 *
 * Separate from `nearestHit` because these are addressed in TILES and by a
 * corner: a structure, a building, a boulder all name their top-left square
 * and grow right and down from it. Measuring to that corner is what made
 * looking at a chest report the ground — three of its four squares are not
 * the square it is filed under.
 *
 * First match wins, with no distance test. Footprints do not overlap, so
 * there is never more than one answer to have an opinion about.
 */
export function footprintHit<T extends Footprinted>(
  list: readonly T[], tx: number, ty: number, size: (t: T) => { w: number; h: number },
): T | null {
  for (const e of list) {
    const { w, h } = size(e);
    if (tx >= e.tx && tx < e.tx + w && ty >= e.ty && ty < e.ty + h) return e;
  }
  return null;
}
