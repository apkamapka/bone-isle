/**
 * Drawn artwork for the elemental crystals.
 *
 * Every element casts the SAME four spells — only the picture changes. That is
 * the whole reason this module derives its filenames instead of listing them:
 * a new element is five PNGs dropped into `public/` and not one line of code.
 *
 *   fx-<element>-<tier>-<slot>.png      e.g. fx-fire-1-burst.png
 *
 * element  fire | ice | earth | storm | shadow
 * tier     1 | 2 | 3            (the NUMBER, never the tier's name — Ember can
 *                                be renamed Muspell tomorrow and the art lives)
 * slot     bolt  the flying projectile: thrown by Shard, and by Burst on its
 *                way out. Authored pointing RIGHT; the renderer rotates it.
 *          burst the impact bloom, played once on every tile of the blast
 *          wave  the flame that stands on one tile, played once per tile
 *          nova  optional. Falls back to `wave` when absent, which is what
 *                Nova uses today — same picture, eight tiles instead of eleven
 *          hit   optional. A Shard's single-target impact. Falls back to
 *                `burst`, so one tile of the explosion stands in until there
 *                is something better
 *
 * A sheet is a HORIZONTAL STRIP of square frames and the frame count is read
 * off the image — `width / height`, rounded. Nobody has to declare that an
 * explosion is nine frames and a wave is ten, which means nobody can declare
 * it wrong, and a redrawn sheet with two more frames needs no code change.
 *
 * Frames are authored at WORLD scale: one frame covers one TILE. A 32-px frame
 * is 1:1 today; a future 64-px redraw scales down to the same tile and still
 * looks right.
 *
 * Loading is asynchronous and failure is harmless: until a sheet lands (or
 * forever, if it 404s) the lookup returns null and the caller paints its own
 * procedural bloom instead. Headless there is no `Image` and no `document`, so
 * the loader no-ops and the smoke tests run against the fallback.
 */
import { ELEMENTS, ELEMENT_COLOR, type Element, type Tier } from "../systems/elements.ts";

/** The five pictures a spell can ask for. */
export type FxSlot = "bolt" | "burst" | "wave" | "nova" | "hit";

export const FX_SLOTS: readonly FxSlot[] = ["bolt", "burst", "wave", "nova", "hit"];

/**
 * Which slot stands in when a file is missing, so artwork can arrive in any
 * order. Only the three REQUIRED slots have no fallback — those are the ones
 * that must exist for an element to look like anything at all.
 */
const FALLBACK: Readonly<Record<FxSlot, FxSlot | null>> = {
  bolt: null,
  burst: null,
  wave: null,
  nova: "wave",
  hit: "burst",
};

/**
 * Lowercase kebab, always. Vercel serves from Linux and Linux is
 * case-sensitive, so an `fx-Fire-1-Burst.png` works on the machine that drew
 * it and 404s in production — the worst possible place to find that out.
 */
export function fxFile(el: Element, tier: Tier, slot: FxSlot): string {
  return `fx-${el}-${tier + 1}-${slot}.png`;
}

/** Frames per second for the tile effects (burst, wave, nova). */
export const FX_FPS = 15;

/** Frames per second the projectile cycles at while it flies. */
export const BOLT_FPS = 14;

/**
 * How far the baked glow spreads, in SOURCE pixels. Three is enough to read as
 * a halo at every zoom the camera offers and small enough that the padded
 * canvas stays cheap.
 */
const GLOW_PAD = 4;

/** One loaded sheet: the artwork, and a halo baked from it. */
export interface Sheet {
  /** The frames as drawn. */
  base: HTMLCanvasElement[];
  /**
   * The same frames as a dilated silhouette flooded with the element's colour.
   * Drawn UNDER the artwork in additive mode, which is what makes a spell
   * legible on grass — and the only thing that saves tier III, whose artwork
   * is near-black and adds almost nothing to a lit scene by itself.
   */
  glow: HTMLCanvasElement[];
  /** How much wider the glow canvas is than the frame, as a ratio. */
  glowScale: number;
}

/** `strips[element|tier|slot]` once loaded. */
const strips: Partial<Record<string, Sheet>> = {};

function key(el: Element, tier: Tier, slot: FxSlot): string {
  return `${el}|${tier}|${slot}`;
}

/**
 * Cut a horizontal strip into square frames.
 *
 * The count comes from the aspect ratio rather than a table. A 288x32 sheet is
 * nine frames because nothing else it could be makes sense, and inferring it
 * removes the one number an artist and a programmer can disagree about.
 */
/**
 * Flood a frame with one colour, keeping its shape.
 *
 * `source-in` paints only where the frame already has pixels, so what comes
 * back is the silhouette in the element's colour — bright regardless of how
 * dark the artwork underneath happens to be.
 */
function tint(frame: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = frame.width;
  cv.height = frame.height;
  const x = cv.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  x.drawImage(frame, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = color;
  x.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

/**
 * Spread a silhouette outwards into a halo.
 *
 * A proper blur would want `ctx.filter`, which not every browser we care about
 * implements the same way. Stamping the silhouette around a small ring is a
 * dilate by hand: it costs a dozen blits ONCE at load, needs nothing exotic,
 * and at this resolution the difference is not visible.
 */
function halo(frame: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const t = tint(frame, color);
  const cv = document.createElement("canvas");
  cv.width = frame.width + GLOW_PAD * 2;
  cv.height = frame.height + GLOW_PAD * 2;
  const x = cv.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  // Rings of decreasing strength rather than one hard ring at full radius.
  // A single ring dilates into a sticker outline; stacking four gives the
  // falloff that reads as light instead of a border.
  const RING = [0.16, 0.11, 0.07, 0.04];
  for (let r = 1; r <= GLOW_PAD; r++) {
    x.globalAlpha = RING[r - 1] ?? 0.03;
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      x.drawImage(t, GLOW_PAD + Math.round(Math.cos(ang) * r), GLOW_PAD + Math.round(Math.sin(ang) * r));
    }
  }
  x.globalAlpha = 1;
  return cv;
}

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

/**
 * Start loading every spell sheet. No-op headless, safe to call twice.
 *
 * A missing file is the normal case, not an error — four of the five elements
 * have no artwork yet and the optional slots may never get any — so misses are
 * silent. Fifty red console lines is a console nobody reads.
 */
export function loadSpellArt(): void {
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  for (const el of ELEMENTS) {
    for (let t = 0 as Tier; t < 3; t = (t + 1) as Tier) {
      for (const slot of FX_SLOTS) {
        const k = key(el, t, slot);
        if (strips[k]) continue;
        const img = new Image();
        img.onload = () => {
          const base = slice(img);
          const col = ELEMENT_COLOR[el];
          strips[k] = {
            base,
            glow: base.map((f) => halo(f, col)),
            glowScale: base.length ? (base[0].width + GLOW_PAD * 2) / base[0].width : 1,
          };
        };
        img.onerror = () => { /* no artwork yet — the procedural bloom stands in */ };
        img.src = `./${fxFile(el, t, slot)}`;
      }
    }
  }
}

/**
 * The frames for one effect, walking the fallback chain, or null while there
 * is no artwork for it at all.
 */
export function spellSheet(el: Element, tier: Tier, slot: FxSlot): Sheet | null {
  let s: FxSlot | null = slot;
  // bounded by the chain, which is two links deep at its longest
  for (let guard = 0; s && guard < FX_SLOTS.length; guard++) {
    const hit = strips[key(el, tier, s)];
    if (hit) return hit;
    s = FALLBACK[s];
  }
  return null;
}

/** True once this effect has real artwork behind it (directly or via fallback). */
export function hasSpellArt(el: Element, tier: Tier, slot: FxSlot): boolean {
  return spellSheet(el, tier, slot) !== null;
}

/**
 * Which frame a one-shot effect shows `t` seconds in, or -1 once it is over.
 *
 * Split out from the blit so the smoke tests can pin the playback down without
 * a canvas: the arithmetic is the part worth checking, not the drawImage.
 */
export function fxFrameIndex(t: number, frames: number, fps = FX_FPS): number {
  if (t < 0) return -1;
  const i = Math.floor(t * fps);
  return i < frames ? i : -1;
}

/** How long a one-shot effect of `frames` frames runs, in seconds. */
export function fxDuration(frames: number, fps = FX_FPS): number {
  return frames / fps;
}

/** Which frame a LOOPING effect (the projectile) shows at time `t`. */
export function loopFrameIndex(t: number, frames: number, fps = BOLT_FPS): number {
  if (frames <= 0) return 0;
  const i = Math.floor(Math.max(0, t) * fps);
  return ((i % frames) + frames) % frames;
}

/** Drop every loaded sheet. Tests only. */
export function resetSpellArt(): void {
  for (const k of Object.keys(strips)) delete strips[k];
}
