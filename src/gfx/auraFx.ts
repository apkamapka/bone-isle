/**
 * What a utility crystal looks like once it is on you.
 *
 * Everything in `spellFx.ts` happens to a TILE: a blast goes off on a square,
 * a field burns on a square, a bolt crosses between two of them. None of that
 * fits a Protective Crystal, which happens to a PERSON and follows them for
 * fifteen seconds — so this is a second, much smaller effect system rather than
 * a sixth slot bolted onto the first.
 *
 * Two kinds, from one animation:
 *
 *   AURA  looped for as long as the effect runs, drawn over the character and
 *         moving with them. Protective and Fury only.
 *   FLARE one pass of the same loop, played where the caster stood. Mending,
 *         Acceleration and Slowdown, which are instants and have nothing to
 *         keep showing.
 *
 * That split is why five colourways of one eight-frame loop do not read as one
 * effect used five times. A thing still circling you is a state; a thing that
 * flares and stops is an event, and the eye sorts those apart before it has
 * registered the colour.
 *
 * AURAS HOLD NO STATE. Protective and Fury are drawn straight from the buff
 * clocks in `Buffs`, so they cannot drift out of step with the effect they
 * illustrate, cannot survive it, and cost nothing to save. Only the flares need
 * a list, because an instant has no clock of its own to read.
 */
import { loopFrameIndex, fxFrameIndex, fxDuration } from "./spellArt.ts";
import type { Buffs } from "../systems/buffs.ts";
import type { World } from "../world/types.ts";

/** Which aura art a thing uses. Matches `public/fx-aura-<name>.png`. */
export type AuraName = "guard" | "fury" | "mend" | "speed" | "slow";

export const AURA_NAMES: readonly AuraName[] = ["guard", "fury", "mend", "speed", "slow"];

/** Frames per second for both kinds. Slower than a blast: a blast is an
 *  impact and wants to be over, an aura is weather and wants to circle. */
export const AURA_FPS = 10;

const sheets: Partial<Record<AuraName, HTMLCanvasElement[]>> = {};

function slice(img: HTMLImageElement): HTMLCanvasElement[] {
  const fh = img.naturalHeight;
  const n = Math.max(1, Math.round(img.naturalWidth / Math.max(1, fh)));
  const fw = Math.floor(img.naturalWidth / n);
  const out: HTMLCanvasElement[] = [];
  for (let i = 0; i < n; i++) {
    const cv = document.createElement("canvas");
    cv.width = fw;
    cv.height = fh;
    const x = cv.getContext("2d")!;
    x.imageSmoothingEnabled = false;
    x.drawImage(img, i * fw, 0, fw, fh, 0, 0, fw, fh);
    out.push(cv);
  }
  return out;
}

/** Start loading the five sheets. No-op headless, safe to call twice. */
export function loadAuraArt(): void {
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  for (const name of AURA_NAMES) {
    if (sheets[name]) continue;
    const img = new Image();
    img.onload = () => { sheets[name] = slice(img); };
    img.onerror = () => { /* no artwork — the effect still works, silently */ };
    img.src = `./fx-aura-${name}.png`;
  }
}

export function auraSheet(name: AuraName): HTMLCanvasElement[] | null {
  return sheets[name] ?? null;
}

/* ------------------------------------------------------------------ *
 *  Flares: one pass, at a fixed spot
 * ------------------------------------------------------------------ */

interface Flare {
  world: World;
  x: number;
  y: number;
  name: AuraName;
  t: number;
}

const flares: Flare[] = [];

/** Play one pass of `name` centred on (x, y). */
export function addFlare(world: World, x: number, y: number, name: AuraName): void {
  flares.push({ world, x, y, name, t: 0 });
}

export function tickAuraFx(dt: number): void {
  for (let i = flares.length - 1; i >= 0; i--) {
    const f = flares[i];
    f.t += dt;
    const frames = sheets[f.name]?.length ?? 8;
    if (f.t > fxDuration(frames, AURA_FPS)) flares.splice(i, 1);
  }
}

/** Drop every flare in a world — travelling should not carry one along. */
export function clearAuraFx(world?: World): void {
  for (let i = flares.length - 1; i >= 0; i--) {
    if (!world || flares[i].world === world) flares.splice(i, 1);
  }
}

/** Count, for the tests. */
export function flareCount(): number {
  return flares.length;
}

/* ------------------------------------------------------------------ *
 *  Drawing
 * ------------------------------------------------------------------ */

/** How many tiles across an aura is drawn. Fury is bigger, and should be. */
const AURA_SCALE: Readonly<Record<AuraName, number>> = {
  guard: 1.9,
  fury: 2.3,
  mend: 1.8,
  speed: 1.8,
  slow: 2.1,
};

function blit(
  ctx: CanvasRenderingContext2D, frame: HTMLCanvasElement,
  cx: number, cy: number, scale: number, alpha: number,
): void {
  const w = frame.width * scale;
  const h = frame.height * scale;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(frame, Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
  ctx.globalAlpha = prev;
}

/**
 * Which auras are on this character, and how solid each should be.
 *
 * The last second and a half FADES rather than cutting out. A fifteen-second
 * ward that vanishes between one frame and the next reads as a bug the first
 * time and as a lost second of protection every time after — the fade is the
 * only warning the player gets that the thing is about to stop working, and it
 * costs nothing.
 */
const FADE_S = 1.5;

export function activeAuras(b: Buffs): { name: AuraName; alpha: number }[] {
  const out: { name: AuraName; alpha: number }[] = [];
  if (b.aegis > 0) out.push({ name: "guard", alpha: Math.min(1, b.aegis / FADE_S) });
  if (b.fury > 0) out.push({ name: "fury", alpha: Math.min(1, b.fury / FADE_S) });
  return out;
}

/**
 * Draw the auras on a character at screen position (cx, cy).
 *
 * Called from the player's own entry in the depth-sorted draw list, so an aura
 * is occluded by whatever occludes its owner rather than floating over the
 * whole scene.
 */
export function drawAuras(
  ctx: CanvasRenderingContext2D, b: Buffs, cx: number, cy: number, now: number,
): void {
  for (const a of activeAuras(b)) {
    const frames = sheets[a.name];
    if (!frames || !frames.length) continue;
    const i = loopFrameIndex(now, frames.length, AURA_FPS);
    blit(ctx, frames[i], cx, cy, AURA_SCALE[a.name], a.alpha);
  }
}

/** Draw every flare in `world`, in screen space via the camera offset. */
export function drawFlares(
  ctx: CanvasRenderingContext2D, world: World, camX: number, camY: number,
): void {
  for (const f of flares) {
    if (f.world !== world) continue;
    const frames = sheets[f.name];
    if (!frames || !frames.length) continue;
    const i = fxFrameIndex(f.t, frames.length, AURA_FPS);
    if (i < 0) continue;
    // Flares brighten as they open and thin out as they close, so a one-pass
    // effect does not simply stop mid-swirl.
    const p = i / Math.max(1, frames.length - 1);
    blit(ctx, frames[i], f.x - camX, f.y - camY, AURA_SCALE[f.name], 1 - p * 0.65);
  }
}
