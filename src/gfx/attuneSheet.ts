/**
 * The five attunement circles in the sanctum under Calanais.
 *
 * These are the ONLY animated ground effect in the game that is not a campfire,
 * and they are built on exactly the campfire's contract for that reason: a
 * strip of twelve frames, played straight through and round again, redrawn
 * every frame from the depth-sorted list rather than baked into the map canvas.
 * If you have read `fireSheet.ts` you have read this one.
 *
 * WHAT IS DIFFERENT FROM A CAMPFIRE, AND WHY.
 *
 * The frames are 64x64, not 32x32 — two tiles by two. The art is a rune ring
 * lying on the floor with a column of light rising out of it, and a ring drawn
 * inside a single tile reads as a coin rather than as something you could walk
 * into. So the circle OWNS a 2x2 block and is anchored on the centre of it.
 *
 * Nothing here seals. A campfire stopped sealing its square because its art
 * could not tell the truth about its collision; a circle must not seal for a
 * much simpler reason — the whole errand is walking into one. Standing in it
 * is the input.
 *
 * There is no burn tick and no clock. A campfire costs you something every
 * second you stand in it; a circle costs you nothing and fires once, ever, and
 * the once is enforced by the mission stage rather than by a timer.
 *
 * Loading is asynchronous and failure is harmless in the same way: until the
 * strips land (or forever, if they 404) `attuneFrame()` returns null and the
 * caller draws nothing at all. That is a real difference from the campfire,
 * which falls back to a baked sprite — there is no baked stand-in for a rune
 * circle, and a missing circle is better than a wrong one, because the floor
 * underneath is already coloured for its element and says which wedge you are
 * in without any help.
 */
import { adoptSprite } from "./sprites.ts";
import { ELEMENTS, type Element } from "../systems/elements.ts";

/** Frames per strip, left to right, as the generator ships them. */
export const ATTUNE_FRAMES = 12;

/** One second a loop, the same rate the campfire runs at. Slower reads as a
 *  decal, faster as a strobe. */
export const ATTUNE_FPS = 12;

/** The block a circle owns, in tiles. The art is 64x64 and TILE is 32. */
export const ATTUNE_SPAN = 2;

const SRC: Readonly<Record<Element, string>> = {
  fire: "./fx-attune-fire.png",
  ice: "./fx-attune-ice.png",
  earth: "./fx-attune-earth.png",
  storm: "./fx-attune-storm.png",
  shadow: "./fx-attune-shadow.png",
};

const strips: Partial<Record<Element, HTMLCanvasElement[]>> = {};

function slice(img: HTMLImageElement): HTMLCanvasElement[] {
  const fw = Math.floor(img.naturalWidth / ATTUNE_FRAMES);
  const fh = img.naturalHeight;
  const out: HTMLCanvasElement[] = [];
  for (let i = 0; i < ATTUNE_FRAMES; i++) {
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

/** Start loading all five strips. No-op headless, safe to call twice. */
export function loadAttuneArt(): void {
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  for (const el of ELEMENTS) {
    if (strips[el]) continue;
    const img = new Image();
    img.onload = () => { strips[el] = slice(img); };
    img.onerror = () => {
      console.warn(`attune circle '${el}' failed to load; the floor colour stands alone`);
    };
    img.src = SRC[el];
  }
}

/**
 * Which frame a circle shows at time `t` seconds with the given phase.
 *
 * Split from the blit so the smoke suite can pin the maths without a canvas,
 * exactly as `fireFrameIndex` is. The double modulo keeps a negative phase from
 * indexing off the front of the strip.
 */
export function attuneFrameIndex(t: number, phase: number): number {
  const step = Math.floor((t + phase) * ATTUNE_FPS);
  return ((step % ATTUNE_FRAMES) + ATTUNE_FRAMES) % ATTUNE_FRAMES;
}

/** The frame to draw, or null while the art is still coming (or never came). */
export function attuneFrame(el: Element, t: number, phase: number): HTMLCanvasElement | null {
  const s = strips[el];
  return s ? s[attuneFrameIndex(t, phase)] : null;
}

/** True once every circle can be animated. */
export function hasAttuneArt(): boolean {
  return ELEMENTS.every((e) => !!strips[e]);
}
