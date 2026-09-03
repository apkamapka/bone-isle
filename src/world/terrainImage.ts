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
/**
 * Exported so the smoke suite can walk it. It used to be private and the suite
 * kept its own hand-written list of which maps had art — which is precisely
 * how a 48x44 export survived a map being redrawn at 32x32: the list had never
 * heard of that map, so nothing failed and the sanctum quietly rendered in the
 * procedural bake.
 */
export const TERRAIN_SRC: Partial<Record<WorldKey, string>> = {
  home: "./home-terrain.png",
  town: "./town-terrain.png",
  cellar: "./cellar-terrain.png",
  reach: "./reach-terrain.png",
  bandit: "./bandit-terrain.png",
  banditdeep1: "./banditdeep-terrain.png",
  banditdeep2: "./banditdeep2-terrain.png",
  banditdeep3: "./banditdeep3-terrain.png",
  orcdeep1: "./orcdeep-terrain.png",
  orcdeep2: "./orcdeep2-terrain.png",
  minodeep1: "./minodeep-terrain.png",
  minodeep2: "./minodeep2-terrain.png",
  deaddeep1: "./deaddeep-terrain.png",
  deaddeep2: "./deaddeep2-terrain.png",
  liddesdale: "./liddesdale-terrain.png",
  hermitage: "./hermitage-terrain.png",
  haramsey: "./haramsey-terrain.png",
  haugr: "./haugr-terrain.png",
  calanais: "./calanais-terrain.png",
  tursachan: "./tursachan-terrain.png",
  daneHills: "./danehills-terrain.png",
  bower: "./bower-terrain.png",
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
