/**
 * Animated campfires.
 *
 * Every other piece of scenery in the game is a still image: `w.decos` are
 * blitted into the map canvas once when the world is built and never touched
 * again, which is exactly why a fire cannot be one. A fire has to be redrawn
 * every frame, so it lives in `w.fires` and is pushed into the depth-sorted
 * draw list alongside trees and rocks instead.
 *
 * The artwork is twelve 32x32 frames in one strip, played straight through
 * and round again. The pack was drawn as a loop, so the wrap from the last
 * frame back to the first is no larger a jump than any step inside it — an
 * earlier three-frame stand-in had to be ping-ponged to hide exactly that
 * seam, and this one does not.
 *
 * Each fire carries its own phase so that two fires in one camp never flicker
 * in lockstep, the same trick the water glint uses.
 *
 * Loading is asynchronous and failure is harmless: until the strip lands (or
 * forever, if it 404s) `campfireFrame()` returns null and the caller draws the
 * baked `SPR.campfire` instead. Headless runs have no `Image` and no
 * `document`, so the loader no-ops and the smoke tests exercise the fallback.
 */
import { adoptSprite } from "./sprites.ts";

const SRC = "./prop-campfire.png";

/** Frames in the strip, left to right, in the order the pack ships them. */
export const FIRE_FRAMES = 12;

/** Flicker speed. Twelve frames at this rate is a one-second loop: slower and
 *  it reads as a lamp, faster and it strobes. */
export const FIRE_FPS = 12;

/**
 * How far above the bottom of its square the fire is drawn, in pixels.
 *
 * A hand-placed campfire seals the square it stands on, and it is the only
 * solid prop in the game whose art is exactly one tile and no more. Everything
 * else — tree, tent, house — is taller than the square it blocks, so the thing
 * you see and the thing that stops you are obviously the same object. The fire
 * is not: the logs sit flush on the bottom edge of the cell and the flame licks
 * up from there, which across the twelve frames leaves the top eight to twelve
 * pixels of a solid square as bare ground. Walking south onto a fire you are
 * therefore refused by a third of a tile that plainly looks walkable.
 *
 * Lifting the sprite splits that slack between the top of the square and the
 * bottom, so the flame is centred on the tile it owns and neither edge reads as
 * free. Four pixels is half the median frame's headroom — enough to close the
 * gap, small enough that the fire still reads as sitting on the ground rather
 * than hovering over it.
 */
export const FIRE_LIFT = 4;

/**
 * What standing in a campfire costs, and how often.
 *
 * A campfire stopped sealing its square, because its artwork is one tile
 * exactly and its body only twenty-one rows of thirty-two, so a third of a
 * solid square read as bare ground the player was refused. Walking through one
 * had to become possible. It should not become free.
 *
 * The numbers are deliberately below a monster's burning ground, which bites
 * 14-30 a second: a bonfire someone lit to cook over is not a fire field a
 * shaman dropped on your head. Flat, and unscaled by level, exactly like the
 * spell fields — which means it is a real cost at fourteen and a nuisance at a
 * hundred. That is the right shape for scenery. Crossing one costs a bite;
 * standing in one drains you and says so.
 *
 * The clock is per TILE, like the burning ground's, so walking a line of three
 * camp fires costs three bites rather than one.
 */
export const FIRE_BURN_TICK_S = 1.0;
export const FIRE_BURN_DMG: readonly [number, number] = [6, 12];

let strip: HTMLCanvasElement[] | null = null;

/** Cut the strip into its frames. */
function slice(img: HTMLImageElement): HTMLCanvasElement[] {
  const fw = Math.floor(img.naturalWidth / FIRE_FRAMES);
  const fh = img.naturalHeight;
  const out: HTMLCanvasElement[] = [];
  for (let i = 0; i < FIRE_FRAMES; i++) {
    const cv = document.createElement("canvas");
    cv.width = fw;
    cv.height = fh;
    const x = cv.getContext("2d")!;
    x.imageSmoothingEnabled = false;
    x.drawImage(img, i * fw, 0, fw, fh, 0, 0, fw, fh);
    out.push(adoptSprite(cv));
  }
  return out;
}

/** Start loading the strip. No-op headless, safe to call more than once. */
export function loadFireSheet(): void {
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  if (strip) return;
  const img = new Image();
  img.onload = () => { strip = slice(img); };
  img.onerror = () => {
    console.warn("campfire strip failed to load, fires will stand still");
  };
  img.src = SRC;
}

/** True once fires can be animated. */
export function hasFireArt(): boolean {
  return strip !== null;
}

/**
 * Which frame index a fire shows at time `t` seconds with the given phase.
 *
 * Split out from `campfireFrame()` so the smoke tests can check the cycle
 * without a canvas: the maths is the part worth pinning down, not the blit.
 * The double modulo keeps a negative phase from indexing off the front of the
 * strip — nothing passes one today, but a wrapped clock would.
 */
export function fireFrameIndex(t: number, phase: number): number {
  const step = Math.floor((t + phase) * FIRE_FPS);
  return ((step % FIRE_FRAMES) + FIRE_FRAMES) % FIRE_FRAMES;
}

/** The frame to draw, or null while the artwork is missing. */
export function campfireFrame(t: number, phase: number): HTMLCanvasElement | null {
  return strip ? strip[fireFrameIndex(t, phase)] : null;
}
