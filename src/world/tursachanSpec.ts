/**
 * Na Tursachan - the sanctum under Calanais. Five wedges, five monuments.
 *
 * Traced from `questna8-1.tmx` (48x44) and DRAWN from
 * `public/tursachan-terrain.png`. Same layer rule as the isle above it: the
 * `czern` layer is a full-map fill standing in for the rock the chamber is cut
 * out of, and every square something later paints is floor. Nothing here
 * seals except that rock, which is why the whole disc is one connected room -
 * 1031 squares, all of them reachable from the stair.
 *
 * THE DIVIDING LINES ARE PAINT, NOT WALLS. The dark bars that cut the disc
 * into five are drawn on the floor layers, and floor is floor: you walk over
 * them. They are there to tell you which wedge you are standing in, and that
 * is the only job they have for now. If they should ever actually stop the
 * player - a hub with five doorways rather than one open room - that is a
 * change to the TMX, not to this file, and the flood-fill test below will
 * report it the moment it happens.
 *
 * WHY IT IS ONE OPEN ROOM AND WHY THAT IS RIGHT. The errand asks the player to
 * choose one element out of five and live with it. A choice made blind is a
 * bad choice, so every rune has to be readable BEFORE any of them is touched,
 * and an open disc lets the player walk the whole ring and read all five.
 *
 * THE FIVE MONUMENTS ARE PLACEHOLDERS AND ARE TAGGED AS SUCH. They stand on
 * the exact squares the TMX object layer marks - `ogien`, `woda`, `ziemia`,
 * `blyskawica`, `wiatr` - and they are skull totems, because that is the only
 * one-square standing prop the scenery vocabulary has. They are the right
 * SHAPE (one tile, solid, you stand next to them, not on them) and the wrong
 * PICTURE. Swapping the art is a line in `sceneryArt.ts` once the column
 * sprite exists; the squares will not move.
 *
 * NOTHING LIVES DOWN HERE. No posts, no respawns. The difficulty of this
 * errand is the island on top, and a chamber with a permanent choice in it is
 * not a place to be interrupted while making it.
 *
 *   U stair back up to Calanais     C pad to Chronos (opens once a monument is touched)
 *   1 fire  2 water  3 earth  4 lightning  5 wind
 */
import type { HandmadeSpec } from "./handmade.ts";
import { Tile } from "./types.ts";

export const TURSACHAN_SPEC: HandmadeSpec = {
  key: "tursachan",
  name: "Na Tursachan",
  safe: false,
  portals: {
    U: { dest: "calanais", label: "back up to Calanais", style: "ladderUp", floor: Tile.Cave },
    // The road out, and the third of the three mission pads: dark until a
    // monument has been touched, exactly as the relic road out of a lair is
    // dark until the relic is on the floor.
    C: {
      dest: "cellar", label: "back to Chronos, with the element",
      floor: Tile.Cave, inactive: true,
    },
  },
  // TEMP-ETAP47-COLUMNS - placeholder art, see the header. The GLYPHS are the
  // contract; whatever sprite these five carry later, they stay one-tile,
  // solid, and on these squares.
  scenery: {
    "1": "skullPole",
    "2": "skullPole",
    "3": "skullPole",
    "4": "skullPole",
    "5": "skullPole",
  },
  rows: [
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "###################==========###################",
    "#################==============#################",
    "###############==================###############",
    "#############==========5===========#############",
    "############========================############",
    "###########==========================###########",
    "##########============================##########",
    "#########==============================#########",
    "#########==============================#########",
    "########=================================#######",
    "########================================########",
    "#######==================================#######",
    "#######==================================#######",
    "######====================================######",
    "######==========================2=========######",
    "######=======1============================######",
    "######====================================######",
    "######==================U=================######",
    "######====================================######",
    "######====================================######",
    "######====================================######",
    "######====================================######",
    "######================C===================######",
    "#######==================================#######",
    "#######==================================#######",
    "########=======================4========########",
    "########================================########",
    "#########========3=====================#########",
    "#########==============================#########",
    "##########============================##########",
    "##########===========================###########",
    "############========================############",
    "#############======================#############",
    "###############==================###############",
    "#################==============#################",
    "###################==========###################",
    "#######################=########################",
    "################################################",
    "################################################",
    "################################################",
  ],
};
