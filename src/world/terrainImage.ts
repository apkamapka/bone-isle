/**
 * Pre-rendered terrain images (Tiled "Export as Image").
 *
 * A hand-drawn map's look comes from the tilesets it was painted with, which
 * the game itself does not ship — so instead of re-implementing a `.tsx`
 * reader, the finished picture is exported once and blitted straight into the
 * world. Collision does NOT come from here: the glyph grid in `handmade.ts`
 * stays authoritative, so every rule, test and save path behaves the same
 * whether or not the image ever loads.
 *
 * The load is asynchronous and failure is harmless — the procedural bake in
 * `mapCanvas` is already sitting there as a fallback, which also keeps the
 * headless smoke tests (no `Image`, no `document`) running untouched.
 *
 * The image must be exported at NATIVE tile size (TILE px per tile) with the
 * object layers hidden, so it lines up 1:1 with the collision grid.
 */
import { TILE } from "../config.ts";
import type { World, WorldKey } from "./types.ts";

/** Which maps have an exported terrain picture, and where it lives. */
const TERRAIN_SRC: Partial<Record<WorldKey, string>> = {
  home: "./home-terrain.png",
  town: "./town-terrain.png",
  cellar: "./cellar-terrain.png",
  reach: "./reach-terrain.png",
  orcdeep1: "./orcdeep-terrain.png",
};

/**
 * Kick off terrain loading for every world that has an exported image.
 * Safe to call more than once; safe headless (returns immediately).
 */
export function loadTerrainImages(worlds: Record<WorldKey, World>): void {
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  for (const key of Object.keys(TERRAIN_SRC) as WorldKey[]) {
    const w = worlds[key];
    const src = TERRAIN_SRC[key];
    if (!w || !src || w.mapImage) continue;
    const img = new Image();
    img.onload = () => {
      // A mismatched export would silently shift the whole map against its
      // collision grid, so refuse it loudly rather than draw something wrong.
      if (img.naturalWidth !== w.w * TILE || img.naturalHeight !== w.h * TILE) {
        console.warn(
          `terrain '${key}': image is ${img.naturalWidth}x${img.naturalHeight}, ` +
          `expected ${w.w * TILE}x${w.h * TILE} — keeping the baked terrain`,
        );
        return;
      }
      w.mapImage = img;
    };
    img.onerror = () => {
      console.warn(`terrain '${key}' failed to load, keeping the baked terrain`);
    };
    img.src = src;
  }
}
