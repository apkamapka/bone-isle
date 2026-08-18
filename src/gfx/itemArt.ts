/**
 * Drawn item icons.
 *
 * Every item has a procedural icon baked at startup (see BAKED_ITEM_SPR).
 * This module loads a PNG over the top of any item that has one and leaves
 * the rest alone, so artwork can land one file at a time without the game
 * ever showing a hole where an icon should be.
 *
 * The same shape as `sceneryArt.ts`: async load, synchronous lookup, baked
 * fallback. Draw code calls `itemSprite()` and never learns which it got.
 */
import { BAKED_ITEM_SPR, SPR, adoptSprite } from "./sprites.ts";
import { ITEMS } from "../items.ts";
import type { ItemKind } from "../items.ts";

/**
 * The filename is DERIVED from the item id, never listed in a table:
 *   shortSword → item-short-sword.png
 *
 * Kebab rather than the id verbatim because Windows filenames are
 * case-insensitive and Linux (which is what Vercel serves from) is not — an
 * `item-shortSword.png` would work on the machine that made it and 404 in
 * production, which is the worst possible place to find out.
 */
export function iconFile(kind: ItemKind): string {
  return `item-${kind.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}.png`;
}

/**
 * Legacy pixels an item icon occupies on screen, whatever the PNG's own
 * resolution. Icons sit in a 32-px bag cell, so 12 leaves a comfortable
 * margin and keeps a 32×32 and a future 64×64 source drawing the same size.
 */
export const ITEM_ICON_PX = 12;

const art: Partial<Record<ItemKind, HTMLCanvasElement>> = {};

/**
 * Start loading every item PNG. No-op headless, safe to call twice.
 *
 * A missing file is the normal case, not an error: most items are still on
 * their baked icon and will be for a while. Failures are counted rather than
 * logged one by one, because a console with fifty red lines in it is a
 * console nobody reads.
 */
export function loadItemArt(): void {
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  for (const kind of Object.keys(ITEMS) as ItemKind[]) {
    if (art[kind]) continue;
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      const x = cv.getContext("2d")!;
      x.imageSmoothingEnabled = false;
      x.drawImage(img, 0, 0);
      // Registering the zoom is what makes iconW/iconH size this thing
      // correctly; without it every drawn icon comes out at source resolution.
      art[kind] = adoptSprite(cv, cv.width / ITEM_ICON_PX);
    };
    img.onerror = () => { /* no artwork yet — the baked icon stands in */ };
    img.src = `./${iconFile(kind)}`;
  }
  loadCoinArt();
}

/** True once this item is showing drawn artwork rather than its baked icon. */
export function hasItemArt(kind: ItemKind): boolean {
  return art[kind] !== undefined;
}

/**
 * The gold coin.
 *
 * It used to be pure HUD decoration — gold was a number, never a bag slot —
 * and so it loaded over `SPR.coin` and had no ItemKind at all. Money is an
 * item now, so the SAME drawn coin has to reach the inventory: the item table
 * is built once at module load and captured the BAKED stand-in, which is why
 * a purse rendered as a yellow blob while the HUD showed a proper coin.
 *
 * Platinum is struck from the gold coin rather than drawn separately: same
 * die, cool white metal. Deriving it means the two can never drift apart, and
 * a hundred-fold denomination reads at a glance without a second asset.
 */
function loadCoinArt(): void {
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement("canvas");
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const x = cv.getContext("2d")!;
    x.imageSmoothingEnabled = false;
    x.drawImage(img, 0, 0);
    const zoom = cv.width / ITEM_ICON_PX;
    (SPR as unknown as Record<string, HTMLCanvasElement>).coin = adoptSprite(cv, zoom);
    art.goldCoin = adoptSprite(cv, zoom);
    const pt = strikeInPlatinum(cv);
    if (pt) art.platinumCoin = adoptSprite(pt, pt.width / ITEM_ICON_PX);
  };
  img.onerror = () => { /* no artwork yet — the baked coin stands in */ };
  img.src = "./ui-gold.png";
}

/**
 * Recolour the gold coin into platinum: keep every pixel's LIGHTNESS, throw
 * away its hue, then lean the result very slightly cold.
 *
 * Working from luminance rather than swapping fixed colours is what preserves
 * the original's shading — the rim highlight and the struck face survive, so
 * the platinum piece reads as the same coin in another metal instead of a
 * flat grey disc. Transparent pixels are left strictly alone.
 */
function strikeInPlatinum(src: HTMLCanvasElement): HTMLCanvasElement | null {
  const cv = document.createElement("canvas");
  cv.width = src.width;
  cv.height = src.height;
  const x = cv.getContext("2d");
  if (!x) return null;
  x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0);
  const img = x.getImageData(0, 0, cv.width, cv.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // gold is dark for its brightness, so lift a little or platinum reads grey
    const v = Math.min(255, lum * 1.18 + 26);
    d[i] = Math.min(255, v * 0.96);
    d[i + 1] = Math.min(255, v * 0.98);
    d[i + 2] = Math.min(255, v * 1.06); // a touch of blue = white metal
  }
  x.putImageData(img, 0, 0);
  return cv;
}

/** The sprite to draw: artwork if it has loaded, else the baked stand-in. */
export function itemSprite(kind: ItemKind): HTMLCanvasElement {
  return art[kind] ?? BAKED_ITEM_SPR[kind];
}
