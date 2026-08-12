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
  FX_FPS, BOLT_FPS, fxFrameIndex, fxDuration, loopFrameIndex, spellSheet, type FxSlot,
} from "./spellArt.ts";
import type { World } from "../world/types.ts";

/**
 * How long a blast runs when the element has no artwork. Four elements are in
 * that state right now, so this is not an edge case — it is what most of the
 * game looks like until the sheets land, and it has to be worth watching.
 */
const BARE_BLAST_S = 0.42;

/**
 * How large an effect is drawn, in TILES.
 *
 * One frame used to cover exactly one tile, which sounded right and looked
 * wrong: the wave's flame is only THIRTEEN pixels across inside its 32-px
 * frame, so a tile-sized draw put a sliver on the ground next to a hero who
 * stands two tiles tall. These numbers are the fix, and they are the first
 * knob to reach for if a spell still reads small.
 *
 * The blast shapes are the ones that had to grow: burst peaks at 30 px and can
 * afford less, the rising flames are thin and need more. Bolt is nudged up
 * only enough to stop looking like a thrown pebble.
 */
const SCALE: Readonly<Record<FxSlot, number>> = {
  bolt: 1.25,
  burst: 1.35,
  hit: 1.35,
  wave: 1.4,
  nova: 1.4,
};

/**
 * Shapes that grow UP from the ground rather than blooming around a point.
 * A flame's base belongs on the tile it burns; an explosion's centre does.
 */
const GROUNDED: Readonly<Record<FxSlot, boolean>> = {
  bolt: false, burst: false, hit: false, wave: true, nova: true,
};

/** How bright the baked halo is drawn behind the artwork. */
const GLOW_ALPHA = 0.55;

/** How bright the pool of light under an effect is at its peak. */
const POOL_ALPHA = 0.1;

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
  const sheet = spellSheet(b.el, b.tier, b.slot);
  return sheet ? fxDuration(sheet.base.length, FX_FPS) : BARE_BLAST_S;
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
 * A pool of light on the ground under an effect.
 *
 * Four additive rings rather than a radial gradient: the gradient looks
 * marginally better and needs a `CanvasGradient`, which is one more thing that
 * has to exist for the headless tests to draw a frame. Stacked translucent
 * circles in `lighter` fall off much the same way.
 *
 * This is the part that makes a spell read in a dark cave. The artwork can be
 * as black as tier III likes; the ground still lights up underneath it.
 */
function pool(
  vctx: CanvasRenderingContext2D, sx: number, sy: number, r: number, a: number, col: string,
): void {
  if (a <= 0.001) return;
  vctx.globalCompositeOperation = "lighter";
  vctx.fillStyle = col;
  for (const f of [1, 0.78, 0.55, 0.32]) {
    vctx.globalAlpha = a;
    vctx.beginPath();
    vctx.arc(sx, sy, r * f, 0, Math.PI * 2);
    vctx.fill();
  }
  vctx.globalAlpha = 1;
  vctx.globalCompositeOperation = "source-over";
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
    const col = ELEMENT_COLOR[b.el];
    const sheet = spellSheet(b.el, b.tier, b.slot);
    if (!sheet) {
      bareBlast(vctx, sx, sy, b.t / BARE_BLAST_S, col);
      continue;
    }
    const i = fxFrameIndex(b.t, sheet.base.length, FX_FPS);
    if (i < 0) continue;

    // Brightest at the start and dying with the animation, which is how the
    // eye expects light from a fire to behave.
    const life = 1 - i / sheet.base.length;
    const size = Math.round(TILE * SCALE[b.slot]);
    pool(vctx, sx, sy, TILE * 0.75, POOL_ALPHA * life, col);

    // Bottom-anchored shapes stand ON the tile; the rest bloom around its
    // centre. Either way the halo shares the artwork's centre exactly, so a
    // wider glow canvas never shifts the picture inside it.
    const left = sx - size / 2;
    const top = GROUNDED[b.slot] ? sy + TILE / 2 - size : sy - size / 2;
    const gs = size * sheet.glowScale;
    vctx.globalCompositeOperation = "lighter";
    vctx.globalAlpha = GLOW_ALPHA;
    vctx.drawImage(sheet.glow[i], left + size / 2 - gs / 2, top + size / 2 - gs / 2, gs, gs);
    vctx.globalAlpha = 1;
    vctx.globalCompositeOperation = "source-over";
    vctx.drawImage(sheet.base[i], left, top, size, size);
  }

  for (const s of bolts) {
    if (s.world !== world) continue;
    const p = Math.min(1, s.t / s.dur);
    const cx = s.fromX + (s.toX - s.fromX) * p;
    const cy = s.fromY + (s.toY - s.fromY) * p;
    const sx = Math.round(cx - camX);
    const sy = Math.round(cy - camY);
    const sheet = spellSheet(s.el, s.tier, "bolt");
    if (sheet) {
      // The sheets are drawn pointing RIGHT, so the rotation is the raw angle
      // with no correction term — one convention, stated once, and a new
      // element cannot get it wrong by drawing its fireball facing up.
      const ang = Math.atan2(s.toY - s.fromY, s.toX - s.fromX);
      const i = loopFrameIndex(s.t, sheet.base.length, BOLT_FPS);
      const size = Math.round(TILE * SCALE.bolt);
      const gs = size * sheet.glowScale;
      pool(vctx, sx, sy, TILE * 0.5, POOL_ALPHA, ELEMENT_COLOR[s.el]);
      vctx.save();
      vctx.translate(sx, sy);
      vctx.rotate(ang);
      vctx.globalCompositeOperation = "lighter";
      vctx.globalAlpha = GLOW_ALPHA;
      vctx.drawImage(sheet.glow[i], -gs / 2, -gs / 2, gs, gs);
      vctx.globalAlpha = 1;
      vctx.globalCompositeOperation = "source-over";
      vctx.drawImage(sheet.base[i], -size / 2, -size / 2, size, size);
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
