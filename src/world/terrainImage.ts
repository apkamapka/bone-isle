/**
 * Pre-rendered terrain images (Tiled "Export as Image"): which picture each
 * map is drawn with, by name.
 *
 * A hand-drawn map's look comes from the tilesets it was painted with, which
 * the game itself does not ship — so instead of re-implementing a `.tsx`
 * reader, the finished picture is exported once and blitted straight into the
 * world. Collision does NOT come from here: the glyph grid in `handmade.ts`
 * stays authoritative, so every rule, test and save path behaves the same
 * whether or not the image ever loads.
 *
 * This file only NAMES the pictures. Since Etap 3.1b a world holds none of
 * its own: the client loads them (gfx/terrainArt.ts), refuses one exported at
 * the wrong size, and paints a fallback from the glyph grid until one lands.
 *
 * The image must be exported at NATIVE tile size (TILE px per tile) with the
 * object layers hidden, so it lines up 1:1 with the collision grid.
 */
import type { WorldKey } from "./types.ts";

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
  goblindeep1: "./goblindeep-terrain.png",
  goblindeep2: "./goblindeep2-terrain.png",
  liddesdale: "./liddesdale-terrain.png",
  hermitage: "./hermitage-terrain.png",
  haramsey: "./haramsey-terrain.png",
  haugr: "./haugr-terrain.png",
  calanais: "./calanais-terrain.png",
  tursachan: "./tursachan-terrain.png",
  daneHills: "./danehills-terrain.png",
  bower: "./bower-terrain.png",
  crete: "./crete-terrain.png",
  labyrinth: "./labyrinth-terrain.png",
  orcIsle: "./orcisle-terrain.png",
  gorak: "./gorak-terrain.png",
};
