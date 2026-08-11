/**
 * Drawn artwork for the buildings on Home Isle.
 *
 * Every structure in the catalog has always had exactly one sprite, baked from
 * a pixel map, and every tier of it looked the same — a Forge III was a Forge I
 * with a bigger bill. The artwork changes that: a structure names one image PER
 * TIER, so raising a building visibly rebuilds it in a better material (wood →
 * stone → steel for the Forge, wood → stone → amber for the Alchemy Tower).
 * That is the whole reason `structSprite()` grew a tier argument.
 *
 * Every buildable now has artwork, so the baked sprites survive only as the
 * fallback for a failed load. Adding a new one is one line in `STILL` and its
 * PNGs; nothing else has to change.
 *
 * The training post is the one building that MOVES, so it ships as a 4x4 sheet
 * instead of a still: four facings down the rows, four frames of a hit recoil
 * across the columns. See `RECOIL_ROW` for the row order and
 * `recoilFrameIndex()` for the playback.
 *
 * Loading is asynchronous and failure is harmless: until an image lands (or
 * forever, if it 404s) the lookups return null and the caller draws the baked
 * stand-in. Headless there is no `Image` and no `document`, so the loader
 * no-ops and the smoke tests run against the fallbacks.
 *
 * Artwork is authored at WORLD scale — TILE px per tile — anchored
 * bottom-centre to match `drawSprite()`, and carries no painted ground shadow
 * (the renderer still draws its own under a building).
 */
import { adoptSprite } from "./sprites.ts";

/** One still image per tier, lowest first. A one-entry list is a structure
 *  with no upgrades, and the top entry covers every tier above it. */
const STILL: Record<string, readonly string[]> = {
  forge: ["./build-forge-1.png", "./build-forge-2.png", "./build-forge-3.png"],
  tower: ["./build-tower-1.png", "./build-tower-2.png", "./build-tower-3.png"],
  range: ["./build-range.png"],
  chest: ["./build-chest-1.png", "./build-chest-2.png", "./build-chest-3.png"],
};

/** The training post's recoil sheets, one per tier. */
const SHEET: Record<string, readonly string[]> = {
  dummy: ["./build-dummy-1.png", "./build-dummy-2.png", "./build-dummy-3.png"],
};

/**
 * Where a building actually meets the ground, when that is not the whole pad.
 *
 * The default — a shadow as wide as the footprint, sitting on the anchor line —
 * is right for a building drawn square on its plot, and wrong for everything
 * else. The alchemy tower is the clear case: it is a narrow drum with a
 * staircase running down towards the viewer, so a footprint-wide ellipse
 * centred on the sprite's bottom edge pools out around the steps instead of
 * tucking under the drum, which is exactly the dark blob it looked like.
 *
 * `w` is the ellipse's half-width in world px; `dy` lifts it above the anchor.
 * Measured against the artwork, not calculated: the contact point of a drawing
 * in three-quarter view is a judgement about where the eye reads the ground,
 * and the widest opaque row is not it.
 */
const SHADOW: Record<string, { w: number; dy: number }> = {
  tower: { w: 20, dy: -5 },  // the drum, not the steps in front of it
  range: { w: 9, dy: -2 },   // a target on a narrow trestle
  dummy: { w: 12, dy: -2 },  // the plinth, measured: 22 px across at world scale
  chest: { w: 28, dy: -9 },  // furniture: a box sits flat, so it hides nearly all of its own shadow
};

/** The ellipse to lay under a building, given the fallback its footprint
 *  implies. Buildings drawn square on their plot keep the fallback. */
export function buildingShadow(key: string, footprintW: number): { w: number; dy: number } {
  return SHADOW[key] ?? { w: footprintW, dy: 0 };
}

/** Structures whose artwork this module supplies, in any form. */
export const ART_KEYS: readonly string[] = [...Object.keys(STILL), ...Object.keys(SHEET)];

export const RECOIL_COLS = 4;
export const RECOIL_ROWS = 4;

/**
 * Which sheet row shows the post leaning which way. The post is struck, so the
 * lean is AWAY from whoever hit it: a player standing south of the post sees
 * the `north` row.
 */
export const RECOIL_ROW = { north: 0, east: 1, west: 2, south: 3 } as const;

/**
 * The lean, played once per blow: frames 1, 2, 3 and then back to the rest
 * pose in column 0. Column 0 is the pose the post holds between hits, which is
 * why the cycle never opens on it — starting there would swallow the first
 * frame of the reaction and the swing would land on a post that had not moved
 * yet.
 */
const CYCLE: readonly number[] = [1, 2, 3];

/** Frames per second of the lean. Three frames at this rate is a fifth of a
 *  second, comfortably inside the 2.0 s attack cadence, so no two blows ever
 *  overlap their animations. */
export const RECOIL_FPS = 14;

/**
 * Which column the post shows `anim` seconds after being struck.
 *
 * Split out from the blit so the smoke tests can pin the cycle down without a
 * canvas. `s.anim` free-runs from a random start and is reset to 0 by a hit, so
 * anything outside the cycle — including a post nobody has ever touched — has
 * to read as the rest pose.
 */
export function recoilFrameIndex(anim: number): number {
  const step = Math.floor(anim * RECOIL_FPS);
  return step >= 0 && step < CYCLE.length ? CYCLE[step] : 0;
}

/**
 * The row a post leans along when the blow comes from (dx, dy) away, measured
 * post MINUS attacker.
 *
 * Vertical wins a tie for the same reason `faceDelta()` gives it the diagonals:
 * the two side views are the readable ones and the front/back rows are what a
 * near-tie should fall back to.
 */
export function recoilRow(dx: number, dy: number): number {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? RECOIL_ROW.east : RECOIL_ROW.west;
  return dy > 0 ? RECOIL_ROW.south : RECOIL_ROW.north;
}

/** Loaded stills, `art[key][tier - 1]`. Tiers land independently. */
const art: Record<string, (HTMLCanvasElement | undefined)[]> = {};
/** Loaded sheets, `frames[key][tier - 1][row * RECOIL_COLS + col]`. */
const frames: Record<string, (HTMLCanvasElement[] | undefined)[]> = {};

/** Copy a loaded image into the canvas shape the renderer draws. */
function toCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const x = cv.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  x.drawImage(img, 0, 0);
  return adoptSprite(cv);
}

/** Cut a 4x4 sheet into its sixteen cells, row-major. */
function slice(img: HTMLImageElement): HTMLCanvasElement[] {
  const fw = Math.floor(img.naturalWidth / RECOIL_COLS);
  const fh = Math.floor(img.naturalHeight / RECOIL_ROWS);
  const out: HTMLCanvasElement[] = [];
  for (let r = 0; r < RECOIL_ROWS; r++) {
    for (let c = 0; c < RECOIL_COLS; c++) {
      const cv = document.createElement("canvas");
      cv.width = fw;
      cv.height = fh;
      const x = cv.getContext("2d")!;
      x.imageSmoothingEnabled = false;
      x.drawImage(img, c * fw, r * fh, fw, fh, 0, 0, fw, fh);
      out.push(adoptSprite(cv));
    }
  }
  return out;
}

/** Start loading every building image. No-op headless, safe to repeat. */
export function loadBuildingArt(): void {
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  for (const key of Object.keys(STILL)) {
    const slot = (art[key] ??= []);
    STILL[key].forEach((src, i) => {
      if (slot[i]) return;
      const img = new Image();
      img.onload = () => { slot[i] = toCanvas(img); };
      img.onerror = () => { console.warn(`building '${key}' tier ${i + 1} failed to load, the baked stand-in stays`); };
      img.src = src;
    });
  }
  for (const key of Object.keys(SHEET)) {
    const slot = (frames[key] ??= []);
    SHEET[key].forEach((src, i) => {
      if (slot[i]) return;
      const img = new Image();
      img.onload = () => { slot[i] = slice(img); };
      img.onerror = () => { console.warn(`building '${key}' tier ${i + 1} failed to load, the baked stand-in stays`); };
      img.src = src;
    });
  }
}

/** Clamp a tier onto the images a structure actually ships. */
function pick<T>(list: readonly T[] | undefined, tier: number): T | null {
  if (!list || list.length === 0) return null;
  const i = Math.min(Math.max(1, Math.round(tier)), list.length) - 1;
  return list[i] ?? null;
}

/** True once this structure is showing drawn artwork at this tier. */
export function hasBuildingArt(key: string, tier = 1): boolean {
  return buildingArt(key, tier) !== null;
}

/**
 * The still image for a structure at a tier, or null while it is still the
 * baked sprite's job. An animated building answers with its rest pose, which
 * is what the build panel and the placement ghost want.
 */
export function buildingArt(key: string, tier: number): HTMLCanvasElement | null {
  const still = pick(art[key], tier);
  if (still) return still;
  const sheet = pick(frames[key], tier);
  return sheet ? sheet[RECOIL_ROW.south * RECOIL_COLS] ?? null : null;
}

/** One cell of an animated building's sheet, or null until the sheet lands. */
export function buildingFrame(key: string, tier: number, row: number, col: number): HTMLCanvasElement | null {
  const sheet = pick(frames[key], tier);
  if (!sheet) return null;
  const r = Math.min(Math.max(0, row), RECOIL_ROWS - 1);
  const c = Math.min(Math.max(0, col), RECOIL_COLS - 1);
  return sheet[r * RECOIL_COLS + c] ?? null;
}

/** How many tier images a structure ships (0 for one with no artwork). */
export function artTiers(key: string): number {
  return (STILL[key] ?? SHEET[key])?.length ?? 0;
}

/** The files a structure's artwork is made of, lowest tier first. Exported so
 *  the smoke tests can check every one of them is actually in `public/` —
 *  a missing PNG is otherwise a silent 404 and a baked sprite in the browser. */
export function artSources(key: string): readonly string[] {
  return STILL[key] ?? SHEET[key] ?? [];
}

/** True when a structure's artwork is a recoil sheet rather than a still. */
export function isAnimatedBuilding(key: string): boolean {
  return key in SHEET;
}
