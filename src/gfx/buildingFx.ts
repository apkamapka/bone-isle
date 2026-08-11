/**
 * The bit of life that plays ON TOP of a building's artwork.
 *
 * The drawn buildings are stills, and a still forge on a still island reads as
 * scenery rather than as something the player built and uses. This module adds
 * the movement: a hearth that flickers and throws embers, a chimney that
 * smokes, an alchemical basin that breathes and gives off motes in its tier's
 * colour. Nothing here changes what a building IS — strip the module out and
 * the game plays identically.
 *
 * Everything is a pure function of `(t, seed)`. Nothing is stored, nothing is
 * spawned, nothing accumulates: a particle is just a sine sampled at a phase
 * offset, so two forges never fall into lockstep, a building that scrolls off
 * screen costs nothing, and a save file never has to know any of it happened.
 * `seed` comes from the structure's tile, so the same forge flickers the same
 * way on every device and across every reload.
 *
 * The anchors below are measured from the artwork in ART space, relative to the
 * bottom-centre point `drawSprite()` anchors to — the same origin the renderer
 * hands us — so they stay correct wherever a building is placed.
 */

/** Where the forge's fire sits in the doorway, from the sprite's bottom-centre. */
const HEARTH_X = -13;
const HEARTH_Y = -8;
/** The chimney mouth, where the drawn puff of smoke leaves off. */
const FLUE_X = 15;
const FLUE_Y = -92;
/** The middle of the alchemy basin at the top of the tower. */
const BASIN_X = -2;
const BASIN_Y = -78;
/** Half-width and half-height of the pool inside the basin rim. */
const BASIN_RX = 17;
const BASIN_RY = 8;

/** Mote colour per tower tier, keyed off what is actually in the pool: herbal
 *  green, then scrying blue, then amber. */
const MOTE: readonly string[] = ["168,214,92", "159,224,255", "255,233,160"];

/** How many motes drift off the basin at once. */
const MOTES = 8;
/** Seconds one mote takes to rise and fade out. */
const MOTE_LIFE = 2.6;
/** How far above the basin a mote gets before it is gone. */
const MOTE_RISE = 32;

const EMBERS = 4;
const EMBER_LIFE = 1.1;
const EMBER_RISE = 16;

const PUFFS = 4;
const PUFF_LIFE = 3.2;
const PUFF_RISE = 24;

/**
 * A particle's progress through its life, 0 at birth and 1 at death.
 *
 * Staggering by `i / n` is what turns one clock into a steady stream: the
 * particles are always evenly spread along the path rather than emitted in
 * bursts, which is both cheaper and calmer to look at than real spawning.
 */
function life(t: number, i: number, n: number, span: number, seed: number): number {
  const p = (t / span + i / n + seed) % 1;
  return p < 0 ? p + 1 : p;
}

/** Fade in over the first fifth of a life, then out across the rest. */
function fade(p: number): number {
  return p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
}

/**
 * Firelight: two sines that do not share a period, so the beat never repeats
 * on any interval short enough for the eye to catch. A single sine reads as a
 * pulsing lamp; this reads as a fire.
 */
function flicker(t: number, seed: number): number {
  return 0.62 + 0.22 * Math.sin(t * 11 + seed * 30) + 0.16 * Math.sin(t * 19.3 + seed * 11);
}

/** A crisp 1-2 px speck. Fills only — the pixel grid stays intact. */
function speck(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.fillRect(Math.round(x), Math.round(y), w, w);
}

/** The forge: firelight in the doorway, embers off it, smoke from the flue. */
function forgeFx(ctx: CanvasRenderingContext2D, sx: number, sy: number, t: number, seed: number): void {
  const f = flicker(t, seed);
  const hx = sx + HEARTH_X;
  const hy = sy + HEARTH_Y;

  // Firelight spilling out of the hearth. Additive, so it lifts the artwork's
  // own painted fire instead of laying a flat orange disc over the top of it.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const r = 9 + f * 3;
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
  g.addColorStop(0, `rgba(255,168,72,${(0.3 * f).toFixed(3)})`);
  g.addColorStop(0.55, `rgba(224,96,24,${(0.13 * f).toFixed(3)})`);
  g.addColorStop(1, "rgba(180,60,10,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(hx, hy, r, 0, 6.2832);
  ctx.fill();

  // Embers, rising and guttering out. They keep the additive mode: an ember is
  // light, and a dark speck on a dark doorway would simply vanish.
  for (let i = 0; i < EMBERS; i++) {
    const p = life(t, i, EMBERS, EMBER_LIFE, seed);
    const a = fade(p) * f;
    if (a <= 0.02) continue;
    ctx.fillStyle = `rgba(255,${150 + Math.round(70 * (1 - p))},80,${(a * 0.85).toFixed(3)})`;
    speck(ctx, hx + Math.sin(p * 5 + i * 2.1 + seed * 6) * 3 - 1, hy - 3 - p * EMBER_RISE, 1);
  }
  ctx.restore();

  // Smoke, leaving the flue and spreading as it cools. Drawn normally, not
  // additively — smoke darkens the sky behind it.
  for (let i = 0; i < PUFFS; i++) {
    const p = life(t, i, PUFFS, PUFF_LIFE, seed + 0.37);
    const a = fade(p) * 0.32;
    if (a <= 0.02) continue;
    const w = 1 + Math.round(p * 2);
    ctx.fillStyle = `rgba(206,206,214,${a.toFixed(3)})`;
    speck(ctx, sx + FLUE_X + Math.sin(p * 3.4 + i + seed * 5) * 4 + p * 3 - w / 2, sy + FLUE_Y - 2 - p * PUFF_RISE, w);
  }
}

/** The alchemy tower: a basin that breathes, and motes coming off the brew. */
function towerFx(ctx: CanvasRenderingContext2D, tier: number, sx: number, sy: number, t: number, seed: number): void {
  const col = MOTE[Math.min(Math.max(1, Math.round(tier)), MOTE.length) - 1];
  const bx = sx + BASIN_X;
  const by = sy + BASIN_Y;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // The pool breathing. Slow — this is a vat of something working, not a lamp.
  const pulse = 0.09 + 0.055 * Math.sin(t * 1.6 + seed * 6.3);
  ctx.fillStyle = `rgba(${col},${pulse.toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(bx, by, BASIN_RX, BASIN_RY, 0, 0, 6.2832);
  ctx.fill();

  // Motes lifting off it. Each takes its own sideways path, and the slower
  // ones climb less far, so the column reads as drift rather than a fountain.
  for (let i = 0; i < MOTES; i++) {
    const p = life(t, i, MOTES, MOTE_LIFE, seed);
    const a = fade(p) * 0.95;
    if (a <= 0.02) continue;
    const swing = 4 + (i % 3) * 4;
    const x = bx + Math.sin(p * 2.4 + i * 2.3 + seed * 7) * swing + ((i % 5) - 2) * 4;
    const y = by - 6 - p * (MOTE_RISE - (i % 3) * 6);
    ctx.fillStyle = `rgba(${col},${a.toFixed(3)})`;
    speck(ctx, x, y, i % 4 === 0 ? 2 : 1);
  }
  ctx.restore();
}

/**
 * Draw whatever a building does while it stands there, at the screen position
 * the sprite was just drawn to. Buildings with nothing to say draw nothing.
 */
export function drawBuildingFx(
  ctx: CanvasRenderingContext2D,
  key: string,
  tier: number,
  sx: number,
  sy: number,
  t: number,
  seed: number,
): void {
  if (key === "forge") forgeFx(ctx, sx, sy, t, seed);
  else if (key === "tower") towerFx(ctx, tier, sx, sy, t, seed);
}

/** True for buildings that animate — the renderer skips the call otherwise. */
export function hasBuildingFx(key: string): boolean {
  return key === "forge" || key === "tower";
}

/**
 * A building's own phase, from the tile it stands on. Two forges side by side
 * must not flicker in step, and the same forge must flicker identically after
 * a reload, so this comes from position rather than from a clock or a roll.
 */
export function fxSeed(tx: number, ty: number): number {
  return ((tx * 7 + ty * 13) % 16) / 16;
}
