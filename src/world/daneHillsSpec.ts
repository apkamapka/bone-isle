/**
 * Dane Hills — the heath west of Leicester, and the Time Sage's FOURTH mission
 * ground.
 *
 * Traced from `blackannispowieschnia.tmx` (90x90) and drawn from
 * `public/danehills-terrain.png`, the same file's image export at native tile
 * size. Collision by exclusion, the house rule: the `wyspa` layer says where
 * land is and the rock layer seals every square it covers. That leaves 3522
 * walkable tiles, all of them reachable from the pad.
 *
 * THE ROCK IS A `solids` GLYPH, not a wall. The export already draws the
 * outcrops; the grid only has to tell collision about them. Painting `#` would
 * have shown ten crags as ruined masonry on the minimap and in the fallback
 * bake, which is what `solids` exists to avoid — the square is impassable and
 * nothing else.
 *
 * THE TWO ENDS, and both came out of the export's own object layer rather than
 * being chosen here. The pad back to the cellar is the point named `tp z
 * piwnicy...` at (62,24), on the north-east shoulder beside the crag; the
 * mouth of the bower is `tp na -1...` at (12,80), on the south-west spit. That
 * is 106 tiles of WALKING between them — a shade under Haramsey's 107, which
 * is the right length for the mission after it.
 *
 * WHO LIVES HERE, and why four ranks and not Haramsey's one. This is a GRIND
 * ground before it is a mission ground: the errand behind it sits at level 20
 * and a player will walk this island more than once for the experience, which
 * is the opposite of the barrow coast's job. Haramsey is a crossing you make
 * to reach a hole; Dane Hills is a place you come back to. Four ranks give the
 * repeat visit somewhere to go.
 *
 *   c corsair      tier 18  — came ashore and stayed; the shallow end
 *   h hunter       tier 21  — the only RANGED rank on any mission ground
 *   w wildWarrior  tier 22  — armour 0 and damage 18-46, a glass hammer
 *   k viking       tier 23  — armour 16, the Danelaw camp the hills are named
 *                             for, and the same people met at Haramsey
 *
 * THE GRADIENT RUNS BY WALKING DISTANCE FROM THE HOLE, not from the pad and
 * not in a straight line. Thirty-four posts, maximin-sampled so they spread
 * instead of clumping, sorted by BFS distance from (12,80) and cut into
 * quarters: the eight nearest the descent are vikings, the nine farthest are
 * corsairs. Nothing stands within nine tiles of another post, comfortably over
 * the eight the aggro range asks for, so every pull is a single one. Nothing
 * stands within eight of the pad or eight of the hole either — you land clear
 * and you leave clear.
 *
 * THE VIKINGS ARE A DELIBERATE REPEAT. Dane Hills is named for a Danelaw
 * encampment of about 877, so the one rank on the island that is not a
 * sellsword is the one the place is called after. A player who crossed
 * Haramsey meets the same men two hundred miles and two hundred years away,
 * which reads as a connection rather than a palette swap — and they are the
 * heaviest thing here, standing between the walk and the hole.
 *
 * THE SCENERY CARRIES THE SAME GRADIENT AS THE RANKS. Live oak in the northern
 * half and NOWHERE else — the only living wood on any mission ground, because
 * this is Leicestershire and not the North Atlantic — then dead wood, felled
 * wood, bones and stone thickening the whole way south. Six camps, a fire and
 * two tents and a totem and bones apiece. Five stone settings, two boulders
 * and a totem each, all of them south of the halfway line: graves nobody has
 * opened, and they thicken toward her the way everything else does.
 *
 * THE CAMP AT THE MOUTH. Radek's ask, and the island's last lit ground: a fire
 * two squares north of the hole with a tent beside it, bones either side and
 * dead wood behind. Nothing hostile stands within eight tiles of it, so it is
 * a breather and not a trap — you can sit down, eat, and then go down.
 *
 * THE DESCENT IS A MISSION DOOR. It ships dormant and `applyMissionPads` puts
 * it to sleep whenever the echo behind it is not enterable — dark before
 * Chronos speaks and dark again once the effigy is on his table. It spent one
 * pass live under a TEMP tag, while the map existed and the errand did not;
 * the errand landed in the same Etap and the tag is gone.
 *
 *   P pad back to the cellar (2x2)   D down into Annis' Bower
 *   T live oak   V dead tree   v felled wood   R stone   Q q black boulder
 *   N tent   F campfire   Y totem   M heath mushrooms   o bones
 *   x crag (impassable, drawn by the export)
 *   creatures: c corsair   h hunter   w wildWarrior   k viking
 */
import type { HandmadeSpec } from "./handmade.ts";
import { Tile } from "./types.ts";

export const DANEHILLS_SPEC: HandmadeSpec = {
  key: "daneHills",
  name: "Dane Hills",
  safe: false,
  portals: {
    P: { dest: "cellar", label: "back to the Time Sage's cellar", span: 2, floor: Tile.Dirt },
    D: {
      dest: "bower", label: "down into Annis' Bower",
      style: "caveMouth", floor: Tile.Dirt, inactive: true,
    },
  },
  // The crags the export draws. Collision only: no wall, no ruin, no minimap
  // masonry — just a square you cannot cross.
  solids: "x",
  scenery: { V: "deadTree", v: "felledTree", N: "tent", Y: "skullPole", Q: "boulderA", q: "boulderB" },
  monsters: {
    c: "corsair",
    h: "hunter",
    w: "wildWarrior",
    k: "viking",
  },
  rows: [
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~....c......~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~.h...........~~~~..R..........~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~.............o.............T......~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~..........R.................R.........~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~.............M......................M..o...c..~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~h......o...........R............................~~~.......~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~.................................T.........................~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~......N.F.N.o...h.............T.....q....M..................c~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~......................o................o......................~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~.........Y.....o............................................R..~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~....R..................R..........c............................~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~...........T..R.....o.....T....R....o..........P...........T..~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~.....................M.......................................~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~....h..........M..T........T...T.N.F.N......................~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~..........T............................................R.M~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~.........................M.......Y........xxxxxxx........~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~.......~........T.R........o.............xxxxxxx....o.Q~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~....T...~~~~~~o.........R................xxxxxxx.......~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~........M~~~~~~.M..................c.....xxxxxxx.R...R.~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~.........~~~~~~....c.......o............xxxxxxx.......~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~........~~~~~~~~......................Txxxxxxx.T.....~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~........~~~~~~~~~~~~~~~~....R....R.....xxxxxxx....T...~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~....w...~~~~~~~~~~~~~~~~~........................o.....c~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~.........~~~~~~~~~~~~~~~~~......T........Q...............~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~..V...o...~~~~~~~~~~~~~~~~.M.................c...........~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~............~~~~~~~~~~~~~~~~...R......o...............T...~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~......N.F.N.~~~~~~~~~~~~~~~~.h..............o.....o.......~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~............~~~~~~~~~~~~~~~~.............................~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~....w..V.....V..Y..~~~~~~~~~~~~~~~~............R...T......T..T.~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~............R........~~~~~~~~~~~~~~~~...R..T....................~~~~~~~~~~~~~~",
    "~~~~~~~~~~~...............v.......~~~~~~~~~~~~~~~................R.q.......~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~M......................o...M.~~~~~~~~~~........................M~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~..Y..xxxx..V..................o..~~~~~~........h...T....M........~~~~~~~~~~~~~~",
    "~~~~~~~~~~~q...Qxxxx........V.......V............~......o...................~~~~~~~~~~~~~~",
    "~~~~~~~~~~~.....xxxx.......................w...............o.............T...~~~~~~~~~~~~~",
    "~~~~~~~~~~~.....xxxx.V.......w.........................T.....................~~~~~~~~~~~~~",
    "~~~~~~~~~~~.....xxxx.....................R................N.F.N......R..c....~~~~~~~~~~~~~",
    "~~~~~~~~~~~w...oxxxx......q.R..................T....T.o.............xxxx......~~~~~~~~~~~~",
    "~~~~~~~~~~~.....xxxx...........V.............................Y.....TxxxxR..R...~~~~~~~~~~~",
    "~~~~~~~~~~~~..........V.xxxx............Y..........w..R...T.........xxxx.......~~~~~~~~~~~",
    "~~~~~~~~~~~~............xxxx..v.......q...Q....o........o...........xxxx...T...~~~~~~~~~~~",
    "~~~~~~~~~~~~o...........xxxx.........................T..............xxxxR......~~~~~~~~~~~",
    "~~~~~~~~~~~~...o....k...xxxx....o...................................xxxx..M....~~~~~~~~~~~",
    "~~~~~~~~~~~~............xxxx....................R.........M.........xxxx.......~~~~~~~~~~~",
    "~~~~~~~~~~~~..N.F.N.....xxxx...V...xxxx...V.....................R.....o........~~~~~~~~~~~",
    "~~~~~~~~~~~~...........Vxxxx......Vxxxx.........v............R....T.......R....~~~~~~~~~~~",
    "~~~~~~~~~~~~.o...Y........V........xxxx......V...........w.....T...............~~~~~~~~~~~",
    "~~~~~~~~~~~~.......V.Q..v..........xxxx.............T..................T......~~~~~~~~~~~~",
    "~~~~~~~~~~~~.......................xxxx...w..................................M~~~~~~~~~~~~",
    "~~~~~~~~~~~.................k...v.Vxxxx.....V......Y...........R..............~~~~~~~~~~~~",
    "~~~~~~~~~~~....V....V..............xxxx..........q...Q....T...............h.q.~~~~~~~~~~~~",
    "~~~~~~~~~~~V.k...............................................T...............~~~~~~~~~~~~~",
    "~~~~~~~~~~~xxxxxxxxxx.v.............V....................R...xxxx.....R.M.T..~~~~~~~~~~~~~",
    "~~~~~~~~~~~xxxxxxxxxx...................v....................xxxx............~~~~~~~~~~~~~",
    "~~~~~~~~~~~xxxxxxxxxx..V......................v..............xxxx.R....T.....~~~~~~~~~~~~~",
    "~~~~~~~~~~~xxxxxxxxxxxxx................V...........v.......oxxxx............~~~~~~~~~~~~~",
    "~~~~~~~~~~~xxxxxxxxxxxxx........v....k..xxxx.V.Q..........T..xxxx.........o..~~~~~~~~~~~~~",
    "~~~~~~~~~~~xxxxxxxxxxxxxV.........Y.....xxxx.................xxxxo.....o.....~~~~~~~~~~~~~",
    "~~~~~~~~~~~~xxxxxxxxxxxx........q...Q..Vxxxx.....V.......o...xxxx..T.........~~~~~~~~~~~~~",
    "~~~~~~~~~~~~....vxxxxxxx.k...v..........xxxx...v......V......................~~~~~~~~~~~~~",
    "~~~~~~~~~~~~.....xxxxxxx..xxxxxx........xxxx............N.F.N.w....R.........~~~~~~~~~~~~~",
    "~~~~~~~~~~~~.....xxxxxxx..xxxxxx......V.xxxx.................................~~~~~~~~~~~~~",
    "~~~~~~~~~~~~..............xxxxxx...V....xxxx..V.k..V.......Y.................~~~~~~~~~~~~~",
    "~~~~~~~~~~~..........Y....xxxxxx......v.............~~~~~....................~~~~~~~~~~~~~",
    "~~~~~~~~~~...V.....q...Q..xxxxxx................v.~~~~~~~~...R...........R..h~~~~~~~~~~~~~",
    "~~~~~~~~~.oF..............xxxxxx..k.V...........~~~~~~~~~~~~..........R.....~~~~~~~~~~~~~~",
    "~~~~~~~~.N..T.o............~~xxx.............~~~~~~~~~~~~~~~~~~~~~.........~~~~~~~~~~~~~~~",
    "~~~~~~~.....D...........v.~~~~..............~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~..V.........k....~~~~~~............~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~.......~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  ],
};
