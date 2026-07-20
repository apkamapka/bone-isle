/**
 * The player's LPC sprite sheet.
 *
 * Everything else in the game is baked procedurally from character maps, but
 * the hero is hand-drawn art loaded from public/hero.png — a trimmed export
 * from the Universal LPC Spritesheet Character Generator. See CREDITS.md; the
 * artwork is CC-BY-SA 3.0 and the attribution is not optional.
 *
 * The sheet is 9 x 5 cells of 64 px:
 *   rows 0..3 — the walk cycle facing up / left / down / right, 9 frames each
 *   row 4 col 0 — the last frame of the death animation, i.e. the body
 *   row 4 cols 1..8 — the two-frame idle loop for the same four facings.
 *     LPC draws a separate standing pose, calmer than walk frame 0, so a
 *     motionless player breathes instead of marching on the spot.
 *
 * LPC ships real left AND right art, so the engine's usual mirror-the-side-
 * sprite trick is not used here: the drawing code passes face = 1 and picks
 * the correct row instead.
 *
 * Loading is asynchronous and best-effort. Until the image arrives — and
 * forever, if it 404s — heroSprite() returns null and the caller falls back to
 * the procedural Adventurer outfit, which also keeps the Wardrobe dyes working.
 */

const CELL = 64;
/** Frames per direction in the walk cycle. Frame 0 is a neutral stride. */
const WALK_FRAMES = 9;
/** Walk cycle speed, frames per second. */
const WALK_FPS = 8;
/** The idle loop is two frames of breathing — slow. */
const IDLE_FRAMES = 2;
const IDLE_FPS = 2;
/** Row holding the body and the idle loops. */
const EXTRA_ROW = 4;
const DEATH_COL = 0;

type LpcDir = "up" | "left" | "down" | "right";
const ROW: Record<LpcDir, number> = { up: 0, left: 1, down: 2, right: 3 };
/** First idle column for each facing; the pair sits at col and col + 1. */
const IDLE_COL: Record<LpcDir, number> = { up: 1, left: 3, down: 5, right: 7 };

let walk: Record<LpcDir, HTMLCanvasElement[]> | null = null;
let idle: Record<LpcDir, HTMLCanvasElement[]> | null = null;
let corpse: HTMLCanvasElement | null = null;

/** True once the sheet has loaded and been sliced. */
export function heroReady(): boolean {
  return walk !== null;
}

function cut(img: HTMLImageElement, col: number, row: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = CELL;
  c.height = CELL;
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  x.drawImage(img, col * CELL, row * CELL, CELL, CELL, 0, 0, CELL, CELL);
  return c;
}

function slice(img: HTMLImageElement): void {
  const w = {} as Record<LpcDir, HTMLCanvasElement[]>;
  const i = {} as Record<LpcDir, HTMLCanvasElement[]>;
  for (const d of Object.keys(ROW) as LpcDir[]) {
    w[d] = [];
    for (let f = 0; f < WALK_FRAMES; f++) w[d].push(cut(img, f, ROW[d]));
    i[d] = [];
    for (let f = 0; f < IDLE_FRAMES; f++) i[d].push(cut(img, IDLE_COL[d] + f, EXTRA_ROW));
  }
  corpse = cut(img, DEATH_COL, EXTRA_ROW);
  walk = w;
  idle = i;
}

/** Kick off the load. Safe to call in a headless context — it simply does
 *  nothing there, so the smoke tests exercise the fallback path. */
export function loadHeroSheet(url = "./hero.png"): void {
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  const img = new Image();
  img.onload = () => slice(img);
  img.onerror = () => {
    // Missing or broken sheet is not fatal: the procedural outfit stands in.
    console.warn("hero sheet failed to load, falling back to the baked outfit");
  };
  img.src = url;
}

/** Which frame of the 8-strong walk cycle to show. Exported for the tests. */
export function walkFrameIndex(t: number): number {
  const n = WALK_FRAMES - 1;
  return 1 + (((Math.floor(t * WALK_FPS) % n) + n) % n);
}

/** Which frame of the two-frame idle loop to show. Exported for the tests. */
export function idleFrameIndex(t: number): number {
  const n = IDLE_FRAMES;
  return ((Math.floor(t * IDLE_FPS) % n) + n) % n;
}

/**
 * The sprite to draw for the player this frame, or null if the sheet has not
 * loaded and the caller should fall back to the baked outfit.
 *
 * `face` is only consulted for the "side" facing, where it selects the real
 * left or right artwork instead of mirroring.
 *
 * Two clocks, deliberately: `walkT` only advances while the player is actually
 * moving, so a stride never plays on the spot and resumes where it left off,
 * while `idleT` is the free-running animation clock that drives breathing.
 */
export function heroSprite(
  dir: "down" | "side" | "up",
  face: number,
  moving: boolean,
  walkT: number,
  idleT: number,
  dead: boolean,
): HTMLCanvasElement | null {
  if (!walk || !idle) return null;
  if (dead) return corpse;
  const d: LpcDir = dir === "side" ? (face < 0 ? "left" : "right") : dir;
  return moving ? walk[d][walkFrameIndex(walkT)] : idle[d][idleFrameIndex(idleT)];
}
