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
 * Gold is drawn from the same folder but is not an item — it never sits in a
 * bag slot, so it has no ItemKind and no entry in the table above. It loads
 * over SPR.coin instead, which every gold readout reads fresh each frame.
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
    (SPR as unknown as Record<string, HTMLCanvasElement>).coin =
      adoptSprite(cv, cv.width / ITEM_ICON_PX);
  };
  img.onerror = () => { /* no artwork yet — the baked coin stands in */ };
  img.src = "./ui-gold.png";
}

/** The sprite to draw: artwork if it has loaded, else the baked stand-in. */
export function itemSprite(kind: ItemKind): HTMLCanvasElement {
  return art[kind] ?? BAKED_ITEM_SPR[kind];
}
