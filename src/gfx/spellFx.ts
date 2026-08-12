/**
 * Spell effects in flight: the bolt travelling and the blooms it leaves.
 *
 * Before this existed a crystal was a number appearing over a creature. The
 * damage was right and the screen said nothing, which made the whole elemental
 * channel feel like a spreadsheet — you could not tell a Nova from a Wave
 * without reading the bag.
 *
 * Two things live here, and the split is Tibia's:
 *
 *   BLAST  a one-shot animation played on ONE TILE. Everything that lands on
 *          ground is made of these — a Burst is thirteen of them, a Wave is
 *          eleven, a Nova is eight. The spell decides which tiles; this module
 *          only knows how to make a tile catch fire.
 *   BOLT   the projectile, drawn between two points and rotated to face the
 *          way it flies. Purely cosmetic: the hit resolved when it was cast,
 *          exactly as an arrow's does.
 *
 * Both are world-bound so an explosion on Bone Reach does not flash over Home
 * Isle, the same guard `fx.ts` puts on floating text.
 *
 * A blast can carry a DELAY. That is what turns thirteen simultaneous
 * explosions into something that reads as a blast wave travelling outwards,
 * and it costs one number.
 */
import { TILE } from "../config.ts";
import { ELEMENT_COLOR, type Element, type Tier } from "../systems/elements.ts";
import {
  FX_FPS, BOLT_FPS, fxFrameIndex, fxDuration, loopFrameIndex, spellFrames, type FxSlot,
} from "./spellArt.ts";
import type { World } from "../world/types.ts";

/**
 * How long a blast runs when the element has no artwork. Four elements are in
 * that state right now, so this is not an edge case — it is what most of the
 * game looks like until the sheets land, and it has to be worth watching.
 */
const BARE_BLAST_S = 0.42;

/** A one-shot animation sitting on a single tile. */
interface Blast {
  world: World;
  /** Tile CENTRE in world px. */
  x: number;
  y: number;
  el: Element;
  tier: Tier;
  slot: FxSlot;
  /** Seconds since it should have started — negative while it waits. */
  t: number;
}

/** A projectile crossing the map. Cosmetic; the hit already landed. */
interface Bolt {
  world: World;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  el: Element;
  tier: Tier;
  t: number;
  dur: number;
}

const blasts: Blast[] = [];
const bolts: Bolt[] = [];

/** How fast a bolt crosses the map, px/s. Matches the arrow so a fireball and
 *  an arrow fired at the same creature arrive together. */
export const BOLT_SPEED = 1040;

/**
 * Light a tile. Coordinates are TILE indices, not pixels — every caller here
 * thinks in tiles, and converting in one place is one place to get it wrong.
 */
export function addBlast(
  world: World, tx: number, ty: number, el: Element, tier: Tier,
  slot: FxSlot, delay = 0,
): void {
  blasts.push({
    world,
    x: tx * TILE + TILE / 2,
    y: ty * TILE + TILE / 2,
    el, tier, slot,
    t: -delay,
  });
}

/** Throw a projectile. Returns its flight time so the caller can time the
 *  blast that follows it. */
export function addBolt(
  world: World, fromX: number, fromY: number, toX: number, toY: number,
  el: Element, tier: Tier,
): number {
  const dur = Math.max(0.06, Math.hypot(toX - fromX, toY - fromY) / BOLT_SPEED);
  bolts.push({ world, fromX, fromY, toX, toY, el, tier, t: 0, dur });
  return dur;
}

/** How long one blast lives, given whatever artwork it has right now. */
function blastLife(b: Blast): number {
  const frames = spellFrames(b.el, b.tier, b.slot);
  return frames ? fxDuration(frames.length, FX_FPS) : BARE_BLAST_S;
}

export function updateSpellFx(dt: number): void {
  for (let i = blasts.length - 1; i >= 0; i--) {
    const b = blasts[i];
    b.t += dt;
    if (b.t >= blastLife(b)) blasts.splice(i, 1);
  }
  for (let i = bolts.length - 1; i >= 0; i--) {
    const s = bolts[i];
    s.t += dt;
    if (s.t >= s.dur) bolts.splice(i, 1);
  }
}

/**
 * The bloom drawn when an element has no sheet: a ring opening out of a bright
 * core and fading. Deliberately not a good explosion — it is legible, it is
 * the right colour, and it is obviously a placeholder, which is what a
 * placeholder should be.
 */
function bareBlast(
  vctx: CanvasRenderingContext2D, sx: number, sy: number, p: number, col: string,
): void {
  const r = 4 + p * (TILE * 0.5);
  vctx.globalAlpha = Math.max(0, 1 - p) * 0.9;
  vctx.strokeStyle = col;
  vctx.lineWidth = 3;
  vctx.beginPath();
  vctx.arc(sx, sy, r, 0, Math.PI * 2);
  vctx.stroke();
  vctx.globalAlpha = Math.max(0, 1 - p * 1.8) * 0.8;
  vctx.fillStyle = col;
  vctx.beginPath();
  vctx.arc(sx, sy, Math.max(1, 6 - p * 6), 0, Math.PI * 2);
  vctx.fill();
  vctx.globalAlpha = 1;
}

/**
 * Draw everything belonging to `world`, offset by the camera.
 *
 * Called after the depth-sorted scene: a spell goes off in FRONT of whatever
 * it hits, because an explosion hidden behind a minotaur is an explosion the
 * player has to be told about.
 */
export function drawSpellFx(
  vctx: CanvasRenderingContext2D, world: World, camX: number, camY: number,
): void {
  for (const b of blasts) {
    if (b.world !== world || b.t < 0) continue;
    const sx = Math.round(b.x - camX);
    const sy = Math.round(b.y - camY);
    const frames = spellFrames(b.el, b.tier, b.slot);
    if (frames) {
      const i = fxFrameIndex(b.t, frames.length, FX_FPS);
      if (i >= 0) vctx.drawImage(frames[i], sx - TILE / 2, sy - TILE / 2, TILE, TILE);
    } else {
      bareBlast(vctx, sx, sy, b.t / BARE_BLAST_S, ELEMENT_COLOR[b.el]);
    }
  }

  for (const s of bolts) {
    if (s.world !== world) continue;
    const p = Math.min(1, s.t / s.dur);
    const cx = s.fromX + (s.toX - s.fromX) * p;
    const cy = s.fromY + (s.toY - s.fromY) * p;
    const sx = Math.round(cx - camX);
    const sy = Math.round(cy - camY);
    const frames = spellFrames(s.el, s.tier, "bolt");
    if (frames) {
      // The sheets are drawn pointing RIGHT, so the rotation is the raw angle
      // with no correction term — one convention, stated once, and a new
      // element cannot get it wrong by drawing its fireball facing up.
      const ang = Math.atan2(s.toY - s.fromY, s.toX - s.fromX);
      const f = frames[loopFrameIndex(s.t, frames.length, BOLT_FPS)];
      vctx.save();
      vctx.translate(sx, sy);
      vctx.rotate(ang);
      vctx.drawImage(f, -TILE / 2, -TILE / 2, TILE, TILE);
      vctx.restore();
    } else {
      vctx.fillStyle = ELEMENT_COLOR[s.el];
      vctx.beginPath();
      vctx.arc(sx, sy, 5, 0, Math.PI * 2);
      vctx.fill();
    }
  }
}

/** Live counts. Tests and nothing else. */
export function spellFxCounts(): { blasts: number; bolts: number } {
  return { blasts: blasts.length, bolts: bolts.length };
}

/** Wipe every effect — used when travelling, and by the tests. */
export function clearSpellFx(): void {
  blasts.length = 0;
  bolts.length = 0;
}
