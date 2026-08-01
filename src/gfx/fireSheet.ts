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
