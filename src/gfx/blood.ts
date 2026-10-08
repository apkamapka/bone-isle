/**
 * Blood on the ground (Etap 73): a splash under every physical hit that drew
 * any, and a pool where a body falls.
 *
 * Cosmetic only. Nothing reads a decal, and none is ever saved — a reload
 * starts on clean ground, the way a creature is never saved either.
 *
 * WHO BLEEDS WHAT. Red is the default and covers everything with a heart in
 * it, the player included. Snakes bleed green. The dead do not bleed at all:
 * a skeleton, a ghoul or a draugr leaves a smear of grey bone dust instead.
 *
 * WHAT DRAWS BLOOD. A sword, an arrow, a claw, a bolt. A crystal's fire or a
 * burning floor does not — the element paints its own effect, and blood under
 * a fireball reads as two things happening at once.
 */
import type { World } from "../world/types.ts";
import { mulberry32 } from "../util.ts";
import type { BloodKind } from "../systems/fxEvents.ts";

/* WHO bleeds what is decided where the hit is reported — systems/fxEvents.ts,
 * since Etap 3.1a — and arrives here as a `blood` event. Re-exported so the
 * old import path still reads. */
export { bloodOf, type BloodKind } from "../systems/fxEvents.ts";

/** How long a decal lies there; the last BLOOD_FADE_S of it fades. */
export const BLOOD_LIFE_S = 60;
export const BLOOD_FADE_S = 15;
/** Per map. The oldest goes first, so a long fight never piles up. */
export const BLOOD_MAX_PER_WORLD = 120;

interface Decal {
  world: World;
  x: number;
  y: number;
  kind: BloodKind;
  pool: boolean;
  t: number;
  seed: number;
}

const decals: Decal[] = [];
let seedCounter = 1;

function add(world: World, x: number, y: number, kind: BloodKind, isPool: boolean): void {
  let n = 0;
  for (const d of decals) if (d.world === world) n++;
  if (n >= BLOOD_MAX_PER_WORLD) {
    const i = decals.findIndex((d) => d.world === world);
    if (i >= 0) decals.splice(i, 1);
  }
  seedCounter = (seedCounter + 1) >>> 0;
  decals.push({ world, x, y, kind, pool: isPool, t: BLOOD_LIFE_S, seed: Math.imul(seedCounter, 2654435761) >>> 0 });
}

/** A small splash where a hit landed. */
export function splash(world: World, x: number, y: number, kind: BloodKind): void {
  add(world, x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 6, kind, false);
}

/** The pool a body leaves. */
export function pool(world: World, x: number, y: number, kind: BloodKind): void {
  add(world, x, y + 2, kind, true);
}

export function tickBlood(dt: number): void {
  for (let i = decals.length - 1; i >= 0; i--) {
    decals[i].t -= dt;
    if (decals[i].t <= 0) decals.splice(i, 1);
  }
}

/** Every decal on one map. */
export function bloodOn(world: World): readonly { x: number; y: number; kind: BloodKind; pool: boolean; t: number }[] {
  return decals.filter((d) => d.world === world);
}

export function clearBlood(): void {
  decals.length = 0;
}

/** Dark, body, highlight. */
const PALETTE: Readonly<Record<BloodKind, readonly [string, string, string]>> = {
  red: ["#5c0a0a", "#8f1414", "#b52222"],
  green: ["#1f4a12", "#2f7a1a", "#4aa02a"],
  bone: ["#6f695e", "#9d9588", "#c9c2b3"],
};

/**
 * Flat on the ground, under everything that stands on it. Drawn in two-pixel
 * cells so a splash has the same grain as the art around it, and shaped from
 * its own seed so it keeps its shape from one frame to the next.
 */
export function drawBlood(ctx: CanvasRenderingContext2D, world: World, camX: number, camY: number): void {
  const zoom = typeof ctx.getTransform === "function" ? (ctx.getTransform().a || 1) : 1;
  const vw = ctx.canvas.width / zoom;
  const vh = ctx.canvas.height / zoom;
  for (const d of decals) {
    if (d.world !== world) continue;
    const sx = Math.round(d.x - camX);
    const sy = Math.round(d.y - camY);
    if (sx < -32 || sy < -32 || sx > vw + 32 || sy > vh + 32) continue;
    const r = mulberry32(d.seed);
    const pal = PALETTE[d.kind];
    ctx.globalAlpha = Math.min(1, d.t / BLOOD_FADE_S) * (d.kind === "bone" ? 0.7 : 0.9);
    const blobs = d.pool ? 9 : 5;
    const reach = d.pool ? 11 : 6;
    for (let i = 0; i < blobs; i++) {
      const a = r() * Math.PI * 2;
      const dd = i === 0 ? 0 : r() * reach;
      const w = 2 * (1 + Math.floor(r() * (d.pool ? 4 : 2))) + (i === 0 ? 2 : 0);
      const h = 2 * (1 + Math.floor(r() * (d.pool ? 3 : 2)));
      const bx = sx + Math.round((Math.cos(a) * dd) / 2) * 2 - Math.round(w / 2);
      const by = sy + Math.round((Math.sin(a) * dd * 0.55) / 2) * 2 - Math.round(h / 2);
      ctx.fillStyle = pal[i === 0 ? 0 : 1];
      ctx.fillRect(bx, by, w, h);
      if (i % 3 === 1) {
        ctx.fillStyle = pal[2];
        ctx.fillRect(bx, by, 2, 2);
      }
    }
    // a few droplets thrown clear of the rest
    const drops = d.pool ? 4 : 3;
    ctx.fillStyle = pal[1];
    for (let i = 0; i < drops; i++) {
      const a = r() * Math.PI * 2;
      const dd = reach + 2 + r() * 6;
      ctx.fillRect(sx + Math.round((Math.cos(a) * dd) / 2) * 2, sy + Math.round((Math.sin(a) * dd * 0.55) / 2) * 2, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}
