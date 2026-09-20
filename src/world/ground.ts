/**
 * A square's PILE: the loose stacks lying on one tile, in the order they were
 * put there.
 *
 * WHY THIS IS ITS OWN FILE
 * ------------------------
 * Twice now the answer to "which item did I point at" was fixed — in
 * `pick.ts`, in the touch tap, in both mouse scans — and twice Radek came
 * back saying a pile still hands over the wrong thing, "sometimes". It did,
 * and none of those fixes could have helped, because every one of them rests
 * on an assumption that was never true: that a pile HAS an order.
 *
 * It did not. Three separate things decided which stack was on top:
 *
 *   1. THE PIXEL POSITION. `drawList` is sorted by `y`, so the stack painted
 *      last — the visible one — is the one with the largest `y`, not the one
 *      dropped last. A stack dropped at the player's feet was jittered by
 *      ±8px for looks, so half the time it landed ABOVE the tile centre and
 *      slid under everything thrown there. That is the "sometimes".
 *   2. THE ARRAY SLOT. Dragging a stack from one square to another moved its
 *      coordinates and left it where it was in `world.ground`, so a thing
 *      moved onto a pile kept the depth of the square it came from.
 *   3. THE MERGE. Dropping loose material joined the FIRST stack of that kind
 *      within 14px — which, under a helmet dropped later, is the bottom of
 *      the pile. The gold went to the floor of the heap and appeared to
 *      vanish.
 *
 * So the pile gets ONE rule, stated here and nowhere else: every loose stack
 * on a square sits at that square's centre, `world.ground` order IS pile
 * order, and anything that lands goes on the END of it. Equal `y` plus a
 * stable sort means array order is what the renderer paints, and every "what
 * did I point at" scan already breaks its ties in favour of the last entry —
 * so with one position per square, what you see, what you take and what you
 * dropped last are finally the same stack.
 *
 * It lives out here rather than in main.ts for the same reason `pick.ts`
 * does: a rule that only exists inside a pointer handler can only be tested
 * by reading the source as a string, and this one has now been wrong three
 * times.
 */
import { GROUND_DESPAWN_S } from "../config.ts";
import { ITEMS, isContainer } from "../items.ts";
import type { Bag, ItemKind } from "../items.ts";
import { toTile, tileCenter } from "./grid.ts";
import { nextEntityId } from "./entities.ts";
import type { GroundItem, World } from "./types.ts";

/** The one spot every loose stack on a square occupies: that tile's centre. */
export function pileSpot(x: number, y: number): { x: number; y: number } {
  return { x: tileCenter(toTile(x)), y: tileCenter(toTile(y)) };
}

/** True when two world points name the same square. */
export function sameTile(ax: number, ay: number, bx: number, by: number): boolean {
  return toTile(ax) === toTile(bx) && toTile(ay) === toTile(by);
}

/** Everything lying on the square that holds (x,y), bottom of the pile first. */
export function pileAt(w: World, x: number, y: number): GroundItem[] {
  return w.ground.filter((gi) => sameTile(gi.x, gi.y, x, y));
}

/** What lies on TOP of that square's pile, or null when the square is bare. */
export function topOfPile(w: World, x: number, y: number): GroundItem | null {
  for (let i = w.ground.length - 1; i >= 0; i--) {
    const gi = w.ground[i];
    if (sameTile(gi.x, gi.y, x, y)) return gi;
  }
  return null;
}

/** Lift an existing stack to the top of its own pile. Already-top is a no-op. */
export function raiseToTop(w: World, gi: GroundItem): void {
  const i = w.ground.indexOf(gi);
  if (i < 0 || i === w.ground.length - 1) return;
  w.ground.splice(i, 1);
  w.ground.push(gi);
}

/**
 * May an incoming stack join the one already on top?
 *
 * Only loose material of the same kind may, and only what genuinely stacks:
 * two swords are two objects and the second must lie ON the first, or "the
 * newest goes on top" is a promise the floor quietly breaks for gear. A
 * container never merges — folding two backpacks into a stack of two would
 * fuse two sets of contents and delete the loser's.
 */
function joinsTop(top: GroundItem, kind: ItemKind, contents?: Bag): boolean {
  if (contents || top.items) return false;
  if (isContainer(kind) || isContainer(top.kind)) return false;
  if (top.kind !== kind) return false;
  return ITEMS[kind].stack > 1;
}

/**
 * Put `n` of `kind` on the square holding (x,y) and answer with the entry it
 * landed in — the top one it merged into, or the new one now crowning the
 * pile. The only way anything is added to `world.ground`.
 */
export function placeOnGround(
  w: World, kind: ItemKind, n: number, x: number, y: number,
  opts: { items?: Bag; t?: number } = {},
): GroundItem {
  const at = pileSpot(x, y);
  const top = topOfPile(w, at.x, at.y);
  if (top && joinsTop(top, kind, opts.items)) {
    top.n += n;
    return top;
  }
  const gi: GroundItem = {
    id: nextEntityId(), kind, n, x: at.x, y: at.y,
    t: opts.t ?? GROUND_DESPAWN_S,
    ...(opts.items ? { items: opts.items } : {}),
  };
  w.ground.push(gi);
  return gi;
}

/**
 * Move a stack that is ALREADY on the floor onto the square holding (x,y).
 *
 * Landing on a pile makes it the newest thing there, so it goes to the top —
 * including when the square it lands on is the one it was already on, which
 * is how a drag can deliberately raise something back into view.
 */
export function moveToPile(w: World, gi: GroundItem, x: number, y: number): GroundItem {
  const at = pileSpot(x, y);
  const top = topOfPile(w, at.x, at.y);
  if (top && top !== gi && joinsTop(top, gi.kind, gi.items)) {
    top.n += gi.n;
    const i = w.ground.indexOf(gi);
    if (i >= 0) w.ground.splice(i, 1);
    return top;
  }
  gi.x = at.x;
  gi.y = at.y;
  raiseToTop(w, gi);
  return gi;
}
