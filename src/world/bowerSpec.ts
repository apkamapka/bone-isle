/**
 * Annis' Bower — the cave under the Dane Hills, and the end of the Time Sage's
 * fourth mission.
 *
 * Traced from `blackanni-1.tmx` (30x30) and drawn from
 * `public/bower-terrain.png`, the same file's image export. Collision by
 * exclusion, the usual rule: both rock layers seal their squares, and what
 * they leave is ONE rectangle — x 8..21, y 6..21, fourteen wide and sixteen
 * deep. Two hundred and twenty-four squares.
 *
 * THE BLACK MARGIN. Everything outside the room is `#`, matching the export,
 * which paints it flat black. Same reason the howe and the cellar have one:
 * the camera can centre on you in a corner instead of clamping to the map edge
 * and shoving you off to one side.
 *
 * IT IS A THIRD THE SIZE OF THE HOWE, and that changes what it can be. Kárr's
 * hall is 19x31 — 589 squares, room for eight ghouls at the spacing the aggro
 * range asks for, so the walk to him IS a corridor of fights. Two hundred and
 * twenty-four squares is not a corridor. It is a room with one thing in it,
 * and the design follows the size rather than fighting it.
 *
 * NOBODY ELSE IS DOWN HERE, and that is the point rather than a shortcut. The
 * howe is full of ghouls because the sagas are explicit that a draugr's
 * victims get up. The folklore is equally explicit about the opposite here:
 * Black Annis ate what she took and wore the skins afterwards. Nothing she
 * caught ever walked again, so putting anything on this floor would be
 * contradicting the one thing the legend is sure of — and it would make the
 * room a smaller copy of a room the player has already cleared.
 *
 * THE DARK IS THE LEVEL DESIGN. Six fires and not the howe's twenty: two at
 * the throat where you come down, two flanking her, two behind her framing the
 * hoard and the way home. Rows 9 through 17 carry NO light at all. You come
 * down into a lit square, you cross nine rows of unlit stone, and the next
 * thing the fires show you is her. The export's floor is a dark olive and the
 * margin is black, so the picture is already doing most of this; the fires
 * only say where the two ends are.
 *
 * THE BOULDERS ARE THERE TO BREAK THE RECTANGLE. She dug this out with her
 * nails — every account says so, and the poem is specific that the rooms were
 * "scooped with her claws beneath the flinty ground". A room with four square
 * corners and four straight walls reads as something BUILT.
 *
 * THEY DO NOT TOUCH THE WALLS, and that is a correction. The first pass put
 * eight of them in the corners and hard against the long sides, where they
 * read as part of the rock rather than as anything standing in the room —
 * Radek could see it on screen the moment he walked in. Four now, pulled two
 * clear squares off both walls, where a boulder is an obstacle you go round
 * instead of a bump in the masonry. Six skull poles down the sides stand in
 * for what the accounts call the drying racks, and they are off the walls for
 * the same reason.
 *
 * THE HOARD IS A CHEST, NOT A POCKET, exactly as in the howe: she respawns and
 * a chest does not, so routing the payday through her loot table would turn a
 * boss into a press. She carries the effigy and the effigy is what the errand
 * is about. It sits in open floor with walkable ground on all four sides — the
 * fire south of it does not seal, so that neighbour counts.
 *
 * THE WAY HOME is dark until she is down, then lit where she fell, so the
 * effigy goes straight to Chronos' table without the walk back across the
 * heath. `applyMissionPads` owns it: a pad out of an echo to the cellar is the
 * relic road, and it opens on `complete` and on nothing else.
 *
 *   U ladder back up to Dane Hills   W the way home, with the effigy
 *   X Black Annis   $ her hoard
 *   # rock   = cave floor   F fire   Y drying pole   Q q boulder   o bones
 */
import type { HandmadeSpec } from "./handmade.ts";
import { Tile } from "./types.ts";

export const BOWER_SPEC: HandmadeSpec = {
  key: "bower",
  name: "Annis' Bower",
  safe: false,
  portals: {
    U: { dest: "daneHills", label: "back up to the Dane Hills", style: "ladderUp" },
    W: {
      dest: "cellar", label: "back to Chronos, with the effigy",
      floor: Tile.Cave, inactive: true,
    },
  },
  scenery: { Y: "skullPole", Q: "boulderA", q: "boulderB" },
  monsters: {
    X: "blackAnnis",
  },
  rows: [
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "########==============########",
    "########======U=======########",
    "########==F========F==########",
    "########==Y========Y==########",
    "########=====o==o=====########",
    "########==Q=======q===########",
    "########====o====o====########",
    "########==Y========Y==########",
    "########=====o==o=====########",
    "########==q=======Q===########",
    "########====o====o====########",
    "########==Y========Y==########",
    "########==F========F==########",
    "########======X=======########",
    "########===$======W===########",
    "########==F========F==########",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
  ],
  floor: [
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "########==============########",
    "########==============########",
    "########==============########",
    "########==============########",
    "########==============########",
    "########==============########",
    "########==============########",
    "########==============########",
    "########==============########",
    "########==============########",
    "########==============########",
    "########==============########",
    "########==============########",
    "########==============########",
    "########==============########",
    "########==============########",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
  ],
};
