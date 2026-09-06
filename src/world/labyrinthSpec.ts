/**
 * The Labyrinth — the maze under Knossos, and the end of the Time Sage's
 * fifth mission.
 *
 * Traced from `labiryntmino.tmx` (100x100) and drawn from
 * `public/labyrinth-terrain.png`, the same file's image export. Collision by
 * exclusion, the usual rule: every rock layer seals its squares.
 *
 * GENERATED. Do not hand-edit this file — `tools/gen_minotaur_maps.py` writes
 * it whole from the two Tiled exports, and it will do so again.
 *
 * IT IS NOT A ROOM, WHICH IS THE WHOLE POINT. Every echo before this one is a
 * chamber with a boss standing in it: the redcap's bog is 30x30, Kárr's howe
 * 19x31, Annis' bower fourteen wide and sixteen deep. This is four hundred
 * and thirty-odd tiles of WALKING from the way in to the thing at the middle,
 * through a spiral that doubles back on itself six times. Radek's design note
 * for the errand puts it exactly right: the labyrinth is part of the
 * opponent, and you beat the space before you fight what is in it.
 *
 * SO NOTHING ELSE LIVES DOWN HERE. That is the bower's call made again and
 * for a better reason: filling these corridors with horns would turn the
 * navigation into four hundred tiles of the hunting ground upstairs, and the
 * one idea the mission owns would go with it. The maze is the encounter.
 *
 * WHAT IS DOWN HERE INSTEAD IS BONES, and they are placed rather than
 * scattered: every dead end in the maze carries a pile, because a dead end is
 * where somebody stopped. Athens sent fourteen young people in every few
 * years and the sources are unanimous that none came out. A wrong turn should
 * feel like somebody else's wrong turn first.
 *
 * THE SEALED RING. The trace leaves a corridor running the north and west of
 * the outer ring walled at BOTH ends — a hundred and fifty-eight squares you
 * can see across the wall and can never stand in. It is reported; until the
 * export changes it is painted out of the collision grid as crag, because a
 * permanent unreachable pocket is something every reachability test in the
 * suite would have to be told to forgive forever, and a wall is honest.
 *
 * THE CHAMBER AT THE CENTRE is nineteen by eighteen, the largest single room
 * in the game, and it is dressed with six poles standing well clear of the
 * walls — the correction the bower's boulders got, for the same reason: a
 * prop hard against rock reads as part of the rock. They stand in for what
 * Knossos actually left behind, which is horns of consecration in stone on
 * every wall of the place.
 *
 * THE HOARD IS A CHEST, NOT A POCKET, exactly as in the howe and the bower:
 * he respawns and a chest does not, so routing the payday through his loot
 * table would turn a boss into a press. It sits in open floor with walkable
 * ground on all four sides.
 *
 * THE WAY HOME is dark until he is down, then lit where he fell, so the
 * earring goes straight to Chronos' table without the walk back out through
 * the maze — which, at four hundred tiles, is the difference between a
 * memorable errand and a chore. `applyMissionPads` owns it: a pad out of an
 * echo to the cellar is the relic road, and it opens on `complete` and on
 * nothing else.
 *
 *   U back up to Crete   W the way home, with the earring
 *   X the Minotaur   $ his hoard   Y pole   o bones
 *   x hedge and rock (impassable, drawn by the export)
 */
import type { HandmadeSpec } from "./handmade.ts";

export const LABYRINTH_SPEC: HandmadeSpec = {
  key: "labyrinth",
  name: "The Labyrinth",
  safe: false,
  portals: {
    U: { dest: "crete", label: "back out to Crete" },
    W: {
      dest: "cellar", label: "back to Chronos, with the earring",
      inactive: true,
    },
  },
  solids: "x",
  scenery: { Y: "skullPole" },
  monsters: {
    X: "asterion",
  },
  rows: [
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~..............................................................................~~~~~~~~~~~~",
    "~~~~~~~~~................................................................................~~~~~~~~~~~",
    "~~~~~~~~~..................................................................................~~~~~~~~~",
    "~~~~~~~~~..................................................................................~~~~~~~~~",
    "~~~~~~~~~..................................................................................~~~~~~~~~",
    "~~~~~~~~~...................................................................................~~~~~~~~",
    "~~~~~~~~~......xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx......~~~~~~~~",
    "~~~~~~~~~......xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx......~~~~~~~~",
    "~~~~~~~~~......xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxo..................................oxx......~~~~~~~~",
    "~~~~~~~~~......xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx....................................xx......~~~~~~~~",
    "~~~~~~~~~......xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xxxxxxxxxxxxxxxxxxxxxxxx..xx......~~~~~~~~",
    "~~~~~~~~~......xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xxxxxxxxxxxxxxxxxxxxxxxx..xx......~~~~~~~~",
    "~~~~~~~~~......xxxxxxo............oxx.o.....................xxo.................xx..xx......~~~~~~~~",
    "~~~~~~~~~......xxxxxx......o.......xxo....o................oxx..................xx..xx......~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xxxxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xxxxxxxxx..xx..xx......~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xxxxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xxxxxxxxx..xx..xx......~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx............................................o....o.xx..xx..xx......~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx...................................................xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx.................................o........oxx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..........o.................o..............xxo.xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xxxxxxxxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xxxxxxxxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xx................xxo...............oxx.oxx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx.oxx..xx...........o...oxx.................xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xx..xxxxxxxxxxxxxxxxxxxxxxxx..xxxxx..xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xxooxx..xx..xxxxxxxxxxxxxxxxxxxxxxxx..xxxxx..xx..xx..xx......xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xxxxxx..xx..xx.......o.................o.xx..xx..xx..xx......xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xxxxxx..xx..xx.............o.....o.......xx..xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx.oxx..xx..xx..xxxxxxxxxxxxxxxxxxxxxxx..xx..xx..xx..xxo.xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xx..xx.oxxxxxxxxxxxxxxxxxxxxxxx..xx..xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xx..xx..xxo..................xx..xx..xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx......xx..xx..xx...................xx..xx..xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx......xx..xx..xx.........Y.........xx..xx..xx..xx..xxo.xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xxo.xx.oxx....Y.........Y....xx..xx..xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx.oxx..xx..xx...................xx..xx..xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xxxxxx..xxo.xx...................xx..xx..xx..xx..xx..xx.oxx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xxxxxx..xxxxxx......o......o.....xx..xxo.xx..xxo.xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx.oxx..xxo.xx..xxxxxx...................xx..xx..xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xx..xxo.xx.......................xx..xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx.oxx.oxx..xx.$........X............xx..xx..xx..xx.oxx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xx..xx..xx...................xx..xx..xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xx..xx..xx.W.................xx..xx..xx..xx..xx.oxx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xx..xx..xx......o......o.....xx.oxx..xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xx..xx..xx...................xxxxxx..xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xx..xx..xx....Y.........Y....xxxxxx..xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xx..xx..xx.........Y.........xx......xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xx..xx..xx...................xx......xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx......xx..xxo..................xx..xx..xx..xxo.xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx......xx..xxxxxxxxxxxxxxxxxxxxxxx..xx..xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xx..xx.oxxxxxxxxxxxxxxxxxxxxxxx.oxx.oxx.oxx..xxo.xx..xx.....~~~~~~~~~",
    "~~~~~~~~~......xxxxxx..xx..xx..xx..xx..o........................xxxxxx..xx..xxxxxx..xx.....~~~~~~~~~",
    "~~~~~~~~~......xxxxxx..xx..xx..xx..xx...................o.......xxxxxx..xx..xxxxxx..xx.....~~~~~~~~~",
    "~~~~~~~~~......xxxxxx..xx..xx..xx..xxxxxxxxxxxxxxx..xxxxxxxxxxxxxx.oxx..xx......xx..xx.....~~~~~~~~~",
    "~~~~~~~~~......xxxxxx..xx..xx..xx..xxxxxxxxxxxxxxx..xxxxxxxxxxxxxx..xx..xxo.....xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx......xx..xx...................................xx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx......xx..xxo.................................oxx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx..xx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xx.oxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxx..xxxxxx.....xxo...................................xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxxo.xxxxxxo...oxx..................o.................xx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xxo.xxxxxxo.xxxxxxxxxxxxxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xx..xxxxxx..xxxxxxxxxxxxxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xx..xxo.xx...........................o......oxx..............xx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xx..xx..xxo...............................o..xxo............oxx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xx..xx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xxxxxxxxxxxxxxxx..xxxx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xx..xx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xxxxxxxxxxxxxxxx..xxxx..xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xx..xx......................oxx.................o................xx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xx..xx.......................xxo................o.............o.oxx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xx..xxxxxxxxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xx..xxxxxxxxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xx.....~~~~~~~~~",
    "~~~~~~~~.......xx....................o...................o..................o.......xx.....~~~~~~~~~",
    "~~~~~~~~.......xx...................................................................xx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx......xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.....~~~~~~~~~",
    "~~~~~~~~.......xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.o....xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.....~~~~~~~~~",
    "~~~~~~~~...................................................................................~~~~~~~~~",
    "~~~~~~~~..................................................................................~~~~~~~~~~",
    "~~~~~~~~~.........................................U.......................................~~~~~~~~~~",
    "~~~~~~~~~~...............................................................................~~~~~~~~~~~",
    "~~~~~~~~~~~.............................................................................~~~~~~~~~~~~",
    "~~~~~~~~~~~~...........................................................................~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~..................................~~...............~~~~~~............~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  ],
};
