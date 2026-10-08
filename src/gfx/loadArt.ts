/**
 * Start loading every picture the game draws (Etap 3.1b).
 *
 * This used to be the tail of `buildWorlds()` in game.ts, which meant building
 * the islands also fetched their artwork — fine with one screen, wrong for a
 * server that has none. Pictures are the client's business now: main.ts calls
 * this once at boot, and building a world touches no picture at all.
 *
 * Every loader is asynchronous, harmless when a file fails (the baked stand-in
 * stays), and a no-op headless.
 */
import { loadTerrainArt } from "./terrainArt.ts";
import { loadPropArt } from "./propArt.ts";
import { loadMobSheets } from "./mobSheet.ts";
import { loadFireSheet } from "./fireSheet.ts";
import { loadSceneryArt } from "./sceneryArt.ts";
import { loadBuildingArt } from "./buildingArt.ts";
import { loadControlIcons } from "../ui/icons.ts";
import { loadItemArt } from "./itemArt.ts";
import { loadSpellArt } from "./spellArt.ts";
import { loadAuraArt } from "./auraFx.ts";
import { loadAttuneArt } from "./attuneSheet.ts";

export function loadAllArt(): void {
  loadTerrainArt();   // async; the baked terrain shows until it lands
  loadPropArt();      // likewise for trees, rocks, stumps and rubble
  loadMobSheets();    // directional walk cycles for humanoid creatures
  loadFireSheet();    // the campfire flicker
  loadSceneryArt();   // totems and dead trees the player walks behind
  loadBuildingArt();  // the forge, the tower and the posts, one image per tier
  loadControlIcons(); // the five sidebar buttons, 16x16 each
  loadItemArt();      // drawn icons over the baked stand-ins
  loadSpellArt();     // bolts and blooms, one strip per element and tier
  loadAuraArt();      // the five crystal auras, one strip each
  loadAttuneArt();    // the five rune circles in the sanctum under Calanais
}
