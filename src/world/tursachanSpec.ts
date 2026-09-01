/**
 * Na Tursachan - the sanctum under Calanais. Five wedges, five circles.
 *
 * Traced from `questna8-1.tmx` (32x32) and DRAWN from
 * `public/tursachan-terrain.png`. Same layer rule as the isle above it: the
 * `czern` layer is a full-map fill standing in for the rock the chamber is cut
 * out of, and every square a later layer paints is floor. The whole disc is
 * one open room - 516 squares, all reachable from the dais.
 *
 * THE FLOOR IS THE LEGEND. The export ships the five wedges in flat marker
 * colours; the picture in `public/` is that export RETINTED, wedge by wedge,
 * to the colour of the element that wedge grants - red fire, blue water, pale
 * grey wind, yellow lightning, brown earth. The retint is per PIXEL and keyed
 * on each wedge's own base colour, so the texture survives and the black rock
 * rim does not bleed. Nothing in the game reads those colours; they are there
 * so a player standing in the doorway can see all five choices at once,
 * which matters because the choice is permanent.
 *
 * ONE OPEN ROOM, ON PURPOSE. A choice made blind is a bad choice, so every
 * circle has to be readable BEFORE any of them is walked into. The disc lets
 * the player walk the whole ring, look at all five, and then commit.
 *
 * NO LADDER BACK UP. This is the one echo in the game with no way out except
 * forward: the stair from Calanais is one-way and the only exit is the dais in
 * the middle, which goes straight to Chronos. That is not a shortcut, it is
 * the shape of the errand - you came down here to choose, and you leave by
 * telling him what you chose.
 *
 * THE DAIS IS 2x2 INSIDE A 4x3 PAINTED SQUARE. The art paints x=14..17,
 * y=15..17 dark; the pad itself is the four squares at 16,16. Sitting the pad
 * inside the painting rather than matching it means the player steps onto
 * something that plainly is the thing they stepped onto.
 *
 * THE CIRCLES SEAL NOTHING. They are `attuneNodes`, not scenery and not fires,
 * and the reason is one line: walking into one is the input. Each is anchored
 * on the square its wedge marks in the TMX object layer and its artwork covers
 * the 2x2 block around it.
 *
 * NOTHING LIVES DOWN HERE. The difficulty of this errand is the island on top.
 * A room holding a permanent choice is not a place to be interrupted.
 *
 *   C dais to Chronos (2x2)
 *   1 fire  2 water  3 earth  4 lightning  5 wind
 */
import type { HandmadeSpec } from "./handmade.ts";
import { Tile } from "./types.ts";

export const TURSACHAN_SPEC: HandmadeSpec = {
  key: "tursachan",
  name: "Na Tursachan",
  safe: false,
  portals: {
    // The only way out. Dark until a circle has been walked into, exactly as
    // the relic road out of a lair is dark until the relic is on the floor.
    C: {
      dest: "cellar", label: "back to Chronos, with the element",
      span: 2, floor: Tile.Cave, inactive: true,
    },
  },
  attune: { "1": "fire", "2": "ice", "3": "earth", "4": "storm", "5": "shadow" },
  rows: [
    "################################",
    "################################",
    "################################",
    "################################",
    "#########==============#########",
    "########================########",
    "#######==================#######",
    "######====================######",
    "#####=====1=========2======#####",
    "####========================####",
    "####========================####",
    "####========================####",
    "####========================####",
    "####========================####",
    "####========================####",
    "####========================####",
    "####============C=======4===####",
    "####===5====================####",
    "####========================####",
    "####========================####",
    "####========================####",
    "####========================####",
    "####========================####",
    "#####===========3==========#####",
    "######====================######",
    "#######==================#######",
    "########================########",
    "#########==============#########",
    "################################",
    "################################",
    "################################",
    "################################",
  ],
};
