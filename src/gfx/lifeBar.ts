/**
 * The life bar over a head — players and creatures alike, the way Tibia does it.
 *
 * WHAT IT SHOWS, AND WHY IN PERCENT
 * ---------------------------------
 * A black frame, a fill whose COLOUR is the reading (green, pale green,
 * yellow, red, dark red, darker red — Tibia's six bands, so a fight is read
 * from across the screen without measuring anything), and a pale trail where
 * life was a moment ago.
 *
 * Everything here takes a health PERCENT, not hit points. That is the online
 * shape on purpose: Tibia's server never tells a client another player's hit
 * points, only a percent, and the day this game has a server it will do the
 * same — so the bar is already written against the only number it will have.
 * `lifePercent` is where the local game turns hit points into that number.
 *
 * THE TRAIL
 * ---------
 * When life drops, the part just lost stays on the bar as a pale segment,
 * holds for half a second and then drains down to the fill. A flurry of hits
 * restarts the hold each time, so a combo reads as ONE long trail — which is
 * the thing worth knowing in PvP: not "he is at 40%" but "he just lost half
 * of it in two seconds". Healing never leaves a trail; the fill simply grows.
 *
 * The trail is keyed by who is being drawn — an entity id, or the player's
 * reserved speaker id — so every creature on screen keeps its own, and one
 * that walks out of view is forgotten after a couple of seconds instead of
 * being remembered forever.
 */

/** Width of the coloured fill, in world pixels. The frame adds one each side. */
export const LIFE_BAR_W = 28;
/** Height of the coloured fill. The frame adds one above and one below. */
export const LIFE_BAR_H = 4;

/** How long a freshly lost chunk stays at full length before it drains. */
export const TRAIL_HOLD_S = 0.5;
/** How fast it drains afterwards, in percent of the whole bar per second. */
export const TRAIL_DRAIN_PER_S = 60;
/** The trail's colour: pale, so it reads as "gone" against any of the bands. */
export const TRAIL_COLOR = "#efe3c8";

/**
 * Tibia's health percent: rounded UP, so a single hit point left is 1% and a
 * sliver of life never paints as an empty bar. Anything dead, broken or
 * missing is 0; an overheal cannot push the bar past its frame.
 */
export function lifePercent(hp: number, maxhp: number): number {
  if (!(maxhp > 0) || !(hp > 0)) return 0;
  return Math.min(100, Math.ceil((hp / maxhp) * 100));
}

/**
 * The fill colour for a percent — Tibia's six bands, thresholds and all.
 * The same colour will be the name's colour once characters have names.
 */
export function lifeColor(pct: number): string {
  if (pct > 92) return "#00bc00";
  if (pct > 60) return "#50a150";
  if (pct > 30) return "#a1a100";
  if (pct > 8) return "#bf0a0a";
  if (pct > 3) return "#910f0f";
  return "#850c0c";
}

interface Trail {
  /** The percent at the last look. */
  cur: number;
  /** Where the trail starts from — the top of the chunk being shown as lost. */
  from: number;
  /** When the current hold began, in seconds. */
  t0: number;
  /** When this bar was last drawn, for forgetting ones that left the screen. */
  seen: number;
}

const trails = new Map<number, Trail>();

function trailAt(tr: Trail, now: number): number {
  const age = now - tr.t0;
  return age <= TRAIL_HOLD_S ? tr.from : tr.from - (age - TRAIL_HOLD_S) * TRAIL_DRAIN_PER_S;
}

/**
 * Where the trail ends for `key` right now, given its percent right now.
 * Never below `pct` — with nothing recently lost the answer is simply `pct`.
 * Call it once per drawn frame per bar; `now` is in seconds.
 */
export function lifeTrail(key: number, pct: number, now: number): number {
  const tr = trails.get(key);
  if (!tr) {
    trails.set(key, { cur: pct, from: pct, t0: now, seen: now });
    return pct;
  }
  if (pct < tr.cur) {
    // a hit: the trail keeps whatever top it is showing and the hold starts
    // over, so the second blow of a combo lengthens the trail instead of
    // replacing it with a shorter one
    tr.from = Math.max(trailAt(tr, now), tr.cur);
    tr.t0 = now;
  }
  tr.cur = pct;
  tr.seen = now;
  return Math.max(pct, trailAt(tr, now));
}

/** Forget every bar not drawn for `idleS` seconds — the dead and the departed. */
export function sweepLifeTrails(now: number, idleS = 2): void {
  for (const [k, tr] of trails) if (now - tr.seen > idleS) trails.delete(k);
}

/** How many bars are being remembered. Read by the smoke tests. */
export function lifeTrailCount(): number {
  return trails.size;
}

/** Forget everything. Tests only. */
export function resetLifeTrails(): void {
  trails.clear();
}

/** The drawing surface this needs — a canvas context, or a test's recorder. */
export interface BarCtx {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
}

/**
 * Paint one bar. `cx` is its centre and `top` the top edge of the black
 * frame, both in SCREEN pixels; `pct` is life now and `trail` where the trail
 * ends (from `lifeTrail`), both in percent.
 */
export function drawLifeBar(ctx: BarCtx, cx: number, top: number, pct: number, trail: number): void {
  const left = Math.round(cx - LIFE_BAR_W / 2);
  const y = Math.round(top);
  ctx.fillStyle = "#000";
  ctx.fillRect(left - 1, y, LIFE_BAR_W + 2, LIFE_BAR_H + 2);
  // at least one pixel for anything alive: 1% of a 28px bar rounds to nothing
  const fill = pct > 0 ? Math.max(1, Math.round((LIFE_BAR_W * pct) / 100)) : 0;
  const ghost = Math.round((LIFE_BAR_W * Math.min(100, Math.max(0, trail))) / 100);
  if (ghost > fill) {
    ctx.fillStyle = TRAIL_COLOR;
    ctx.fillRect(left + fill, y + 1, ghost - fill, LIFE_BAR_H);
  }
  if (fill > 0) {
    ctx.fillStyle = lifeColor(pct);
    ctx.fillRect(left, y + 1, fill, LIFE_BAR_H);
  }
}
