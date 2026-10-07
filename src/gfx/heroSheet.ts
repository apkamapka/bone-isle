/**
 * The player's LPC sprite — now composited from LAYERS so the Wardrobe can
 * recolor it. Each body (male, female: systems/sex.ts) ships five sheets in
 * public/, each 9 x 5 cells of 64 px in the same layout:
 *   rows 0..3 — walk cycle facing up / left / down / right, 9 frames each
 *   row 4 col 0 — the death frame (the body on the ground)
 *   row 4 cols 1..8 — the two-frame idle loop for the four facings
 *
 *   hero-base.png            body + head + eyes (skin, never dyed)
 *   hero-{hair,shirt,pants,shoes}.png   grayscale layers, 128 = mid-tone
 *   hero-female-*.png        the same five for the female body
 *   hero-ranger-*.png, hero-female-ranger-*.png
 *                            the Ranger outfit's four layers (Etap 92), drawn
 *                            over the same two bases
 *
 * On load, and whenever a dye changes, the four grayscale layers are tinted
 * (out = gray/128 * color, so the artwork's shading survives) and composited
 * over the base into one cached sheet, which is then sliced exactly as before.
 * The render loop still blits one canvas per frame.
 *
 * The layers are trimmed exports from the Universal LPC Spritesheet Character
 * Generator. See CREDITS.md: the male set is OGA-BY 3.0, and so is the female
 * set except its hair, which is CC-BY-SA 3.0, and so are the Ranger's layers
 * except the hood file, which carries the same loose hair and is CC-BY-SA 3.0
 * too. The attribution is not optional.
 *
 * Loading is asynchronous and best-effort. Until the sheets arrive — and
 * forever, if they 404 — heroSprite() returns null and the caller falls back to
 * the procedural Adventurer outfit, which also keeps the Wardrobe dyes working.
 */

import type { Sex } from "../systems/sex.ts";

const CELL = 64;
const COLS = 9;
const ROWS = 5;
const SHEET_W = COLS * CELL;
const SHEET_H = ROWS * CELL;
/** Frames per direction in the walk cycle. Frame 0 is a neutral stride. */
const WALK_FRAMES = 9;
const WALK_FPS = 8;
/** The idle loop is two frames of breathing — slow. */
const IDLE_FRAMES = 2;
const IDLE_FPS = 2;
const EXTRA_ROW = 4;
const DEATH_COL = 0;

type LpcDir = "up" | "left" | "down" | "right";
const ROW: Record<LpcDir, number> = { up: 0, left: 1, down: 2, right: 3 };
const IDLE_COL: Record<LpcDir, number> = { up: 1, left: 3, down: 5, right: 7 };

export type HeroZone = "hair" | "shirt" | "pants" | "shoes";
/** The clothes a body is drawn in: the shipped set, or an outfit's own (Etap 92). */
export type HeroLook = "adventurer" | "ranger";
/** Draw order of the tinted layers over the base (back to front). */
const TINT_ORDER: readonly HeroZone[] = ["shoes", "pants", "shirt", "hair"];
/** The classic silver/gray look — matches the character as first shipped. The
 *  female sheets were measured against the same four dyes and land on them too. */
const DEFAULT_DYE: Record<HeroZone, string> = {
  hair: "#929292", shirt: "#494949", pants: "#494949", shoes: "#242424",
};

const dye: Record<HeroZone, string> = { ...DEFAULT_DYE };

let baseData: ImageData | null = null;
let layerData: Record<HeroZone, ImageData> | null = null;
let composed: HTMLCanvasElement | null = null;

let walk: Record<LpcDir, HTMLCanvasElement[]> | null = null;
let idle: Record<LpcDir, HTMLCanvasElement[]> | null = null;
let corpse: HTMLCanvasElement | null = null;

/** True once the layers have loaded and been composited + sliced. */
export function heroReady(): boolean {
  return walk !== null;
}

function toData(img: HTMLImageElement): ImageData {
  const c = document.createElement("canvas");
  c.width = SHEET_W;
  c.height = SHEET_H;
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  x.drawImage(img, 0, 0);
  return x.getImageData(0, 0, SHEET_W, SHEET_H);
}

function hexRGB(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function cut(src: CanvasImageSource, col: number, row: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = CELL;
  c.height = CELL;
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  x.drawImage(src, col * CELL, row * CELL, CELL, CELL, 0, 0, CELL, CELL);
  return c;
}

function slice(src: CanvasImageSource): void {
  const w = {} as Record<LpcDir, HTMLCanvasElement[]>;
  const i = {} as Record<LpcDir, HTMLCanvasElement[]>;
  for (const d of Object.keys(ROW) as LpcDir[]) {
    w[d] = [];
    for (let f = 0; f < WALK_FRAMES; f++) w[d].push(cut(src, f, ROW[d]));
    i[d] = [];
    for (let f = 0; f < IDLE_FRAMES; f++) i[d].push(cut(src, IDLE_COL[d] + f, EXTRA_ROW));
  }
  corpse = cut(src, DEATH_COL, EXTRA_ROW);
  walk = w;
  idle = i;
}

/** Composite base + tinted layers into the cached sheet, then re-slice. */
function rebuild(): void {
  if (!baseData || !layerData || typeof document === "undefined") return;
  const acc = new Uint8ClampedArray(baseData.data); // start from the skin base
  for (const z of TINT_ORDER) {
    const [r, g, b] = hexRGB(dye[z]);
    const l = layerData[z].data;
    for (let i = 0; i < l.length; i += 4) {
      const la = l[i + 3];
      if (!la) continue;
      const n = l[i] / 128;             // grayscale, 128 = mid-tone
      const tr = n * r < 255 ? n * r : 255;
      const tg = n * g < 255 ? n * g : 255;
      const tb = n * b < 255 ? n * b : 255;
      const af = la / 255;
      const inv = 1 - af;
      acc[i] = tr * af + acc[i] * inv;
      acc[i + 1] = tg * af + acc[i + 1] * inv;
      acc[i + 2] = tb * af + acc[i + 2] * inv;
      const oa = la + acc[i + 3] * inv;
      acc[i + 3] = oa < 255 ? oa : 255;
    }
  }
  if (!composed) {
    composed = document.createElement("canvas");
    composed.width = SHEET_W;
    composed.height = SHEET_H;
  }
  const cx = composed.getContext("2d")!;
  cx.imageSmoothingEnabled = false;
  cx.putImageData(new ImageData(acc, SHEET_W, SHEET_H), 0, 0);
  slice(composed);
}

/** The skin each body is drawn on, whatever it wears. */
const BASE_SRC: Readonly<Record<Sex, string>> = {
  male: "./hero-base.png",
  female: "./hero-female-base.png",
};

/** The four dye layers of each look, per body. The Adventurer keeps the names
 *  it shipped with; every other look sits on the same two bases (Etap 92). */
const LOOK_SRC: Readonly<Record<HeroLook, Readonly<Record<Sex, Readonly<Record<HeroZone, string>>>>>> = {
  adventurer: {
    male: { hair: "./hero-hair.png", shirt: "./hero-shirt.png", pants: "./hero-pants.png", shoes: "./hero-shoes.png" },
    female: {
      hair: "./hero-female-hair.png", shirt: "./hero-female-shirt.png",
      pants: "./hero-female-pants.png", shoes: "./hero-female-shoes.png",
    },
  },
  ranger: {
    male: {
      hair: "./hero-ranger-hair.png", shirt: "./hero-ranger-shirt.png",
      pants: "./hero-ranger-pants.png", shoes: "./hero-ranger-shoes.png",
    },
    female: {
      hair: "./hero-female-ranger-hair.png", shirt: "./hero-female-ranger-shirt.png",
      pants: "./hero-female-ranger-pants.png", shoes: "./hero-female-ranger-shoes.png",
    },
  },
};

/** The five files one body in one look is drawn from, in the order
 *  `loadHeroSheet` reads them. Exported for the smoke suite. */
export function heroLayerFiles(sex: Sex, look: HeroLook = "adventurer"): Readonly<Record<"base" | HeroZone, string>> {
  return { base: BASE_SRC[sex], ...LOOK_SRC[look][sex] };
}

/** Bumped by every load, so that an older load still in flight can never land
 *  on top of a newer one. */
let loadGen = 0;

/** The body and the clothes last asked for; `setHeroLook` reloads with them. */
let curSex: Sex = "male";
let curLook: HeroLook = "adventurer";
let bodyAsked = false;

/** Kick off the load of one body, in a look (the last one asked for unless
 *  named). No-op headless, so the smoke tests use the fallback. Until the new
 *  sheets arrive, whatever was drawn before stays. */
export function loadHeroSheet(sex: Sex = "male", look: HeroLook = curLook): void {
  curSex = sex;
  curLook = look;
  bodyAsked = true;
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  const gen = ++loadGen;
  const src = heroLayerFiles(sex, look);
  const keys = ["base", "hair", "shirt", "pants", "shoes"] as const;
  const parts: Partial<Record<string, HTMLImageElement>> = {};
  let left = keys.length;
  let failed = false;
  for (const k of keys) {
    const img = new Image();
    img.onload = () => {
      if (gen !== loadGen) return; // a later load has taken over
      parts[k] = img;
      if (--left === 0 && !failed) {
        baseData = toData(parts.base!);
        layerData = {
          hair: toData(parts.hair!),
          shirt: toData(parts.shirt!),
          pants: toData(parts.pants!),
          shoes: toData(parts.shoes!),
        };
        rebuild();
      }
    };
    img.onerror = () => {
      if (gen !== loadGen) return;
      if (!failed) {
        failed = true;
        console.warn(`hero layer '${k}' (${sex}) failed to load, falling back to the baked outfit`);
      }
    };
    img.src = src[k];
  }
}

/** Change the clothes (the Wardrobe's outfit, Etap 92). A save can name its
 *  outfit before main.ts asks for a body, so until then this only remembers
 *  the look; once a body is loaded it reloads, if the look really changed. */
export function setHeroLook(look: HeroLook): void {
  if (look === curLook) return;
  curLook = look;
  if (bodyAsked) loadHeroSheet(curSex, look);
}

/** The look last asked for. */
export function heroLook(): HeroLook {
  return curLook;
}

/** Apply Wardrobe dye colors (hex) and rebuild the cached sheet. */
export function setHeroDyes(next: Partial<Record<HeroZone, string>>): void {
  let changed = false;
  for (const z of TINT_ORDER) {
    const v = next[z];
    if (v && v !== dye[z]) { dye[z] = v; changed = true; }
  }
  if (changed) rebuild();
}

/** The idle-down cell, for the Wardrobe live preview. Null until loaded. */
export function heroPreviewFrame(): HTMLCanvasElement | null {
  return idle ? idle.down[0] : null;
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
 * The player's body lying on the ground, or null before the sheets load.
 *
 * `heroSprite(..., dead)` already returns this for the dying player; this
 * accessor exists for the OTHER place the same body shows up — the lootable
 * "your body" corpse, which outlives the death animation and is drawn by the
 * corpse pass, not the player pass.
 */
export function heroCorpse(): HTMLCanvasElement | null {
  return corpse;
}

/**
 * The sprite to draw for the player this frame, or null if the sheets have not
 * loaded and the caller should fall back to the baked outfit.
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
