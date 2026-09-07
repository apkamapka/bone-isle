/**
 * The Orc Isle — the Time Sage's SIXTH mission ground, and the island Gorak's
 * hall is cut into.
 *
 * Traced from `orkipowieschnia.tmx` (110x110) and drawn from
 * `public/orcisle-terrain.png`, the same file's image export at native tile
 * size. Collision by exclusion, the house rule: the `wyspa` layer says where
 * land is and nothing else seals anything — this export has no rock layers at
 * all, only a coastline.
 *
 * GENERATED. Do not hand-edit this file — `tools/gen_orc_maps.py` writes it
 * whole from the export and the picture, and it will do so again.
 *
 * THE TWO ENDS ARE CHOSEN HERE, which is a first. Every mission ground before
 * this one carried an object layer with its doors painted into it; this export
 * has none, so the pad and the descent are picked by the generator to the same
 * rule the traced ones happened to meet — four clear squares of land in every
 * direction, and as far apart as the island allows. The pad back to the cellar
 * sits on the north-west shoulder at (22,11) and the descent in the south-east
 * corner at (86,84). That is a hundred and thirty-seven tiles of WALKING
 * between them, over Crete's hundred and fourteen, which is the right way
 * round: this island is seven and a half thousand squares against Crete's five
 * and it is behind the highest door the chain has opened.
 *
 * WHO LIVES HERE, and why all five ranks are orcs. The errand's whole argument
 * is that they are GATHERING. A sellsword or a minotaur on this island would
 * say that it is somewhere orcs happen to be, and it is not — it is where they
 * are all walking to.
 *
 *   r orc          tier 25, 215 exp — the shallow end, and the bulk of it
 *   c orcArcher    tier 25, 280 exp — the only RANGED rank here
 *   e orcWarrior   tier 28, 295 exp — thickening toward the descent
 *   S orcShaman    tier 27, 440 exp — exactly ONE
 *   k orcBerserker tier 36, 460 exp — exactly ONE, and nearest the hole
 *
 * THE BERSERKER IS `k` AND NOT `B`, which is not a style choice. `handmade.ts`
 * handles `B` in its own switch as a BUILD SPOT, before a spec's `monsters`
 * map is ever consulted, so a berserker written as `B` does not fail — it
 * silently becomes a plot of empty ground. The first cut of this map shipped
 * a rank short that way with every test green.
 *
 * ONE BERSERKER AND ONE SHAMAN. That is Radek's cap and it is also the story:
 * what is on the island is the tribes still arriving, and the heavy things are
 * already down the hole with the man who called them. An island fielding a
 * dozen berserkers would have answered the question the errand is asking.
 *
 * THE GRADIENT RUNS BY WALKING DISTANCE FROM THE DESCENT, not from the pad and
 * not in a straight line. Seventy posts on a hexagonal lattice with a small
 * jitter — maximin, which every ground before this one used, ran out at
 * fifty-nine on six and a half thousand legal squares — sorted by BFS distance from the hole and cut into bands: the
 * berserker is the nearest post to it, the shaman behind him, then twenty
 * warriors, twenty archers, and twenty-eight plain orcs holding the far half
 * of the island. Nothing stands within nine tiles of another post, comfortably
 * over the eight the aggro range asks for, and nothing stands within eight of
 * either door.
 *
 * THE BREATHER IS AT THE PAD, WHICH INVERTS CRETE. There the camp sits at the
 * mouth of the labyrinth, somewhere to sit down before you go in. That is
 * exactly wrong here, because the hole in the ground is the enemy's own heart
 * and the walk toward it is meant to get worse — so the tents and the fire you
 * can rest at are where you LAND, and the orc camps run the other way.
 *
 * THE CAMPS THICKEN TOWARD THE DESCENT. Totems, fires, tents and bone, all
 * weighted by walking distance from the hole rather than scattered flat, and
 * on a SQUARED falloff — there is far more island far from the hole than near
 * it, so a linear weight put most of the camp out on the shore where it said
 * nothing. Near the coast it reads as a few war-bands; by the time the descent
 * is in sight it reads as one host. The island says what Chronos says out loud.
 *
 * AND THE WOOD IS MOSTLY DEAD, which is the note Radek came back with after
 * walking it: too much green for orc country. Three hundred bare trunks
 * against ninety-five leafy ones and seventy stumps — dry woodland is the
 * default cover here and the green stands are the exception, because five
 * ranks have been felling, burning and camping across this ground long enough
 * to use it up. A full canopy would say nobody has been here, which is the
 * opposite of the errand.
 *
 * THE CAMPS ARE PLACED BEFORE THE WOOD, and that ordering is load-bearing. Run
 * the other way round, four hundred dead trees paint a 3x3 of clearance apiece
 * and a tent's 2x2 footprint can no longer find open ground: the island came
 * out with THREE tents on it. It is also the truer order — the camps are the
 * reason the wood is dead, so they choose their ground first.
 *
 * THE DESCENT IS A MISSION DOOR. It ships dormant and `applyMissionPads` puts
 * it to sleep whenever the echo behind it is not enterable — dark before
 * Chronos speaks and dark again once the tusk is on his table.
 *
 *   P pad back to the cellar (2x2)   D down into Gorak's hall
 *   V dead tree (the default cover)   T green wood   v stump
 *   R stone   Q q boulder
 *   N tent   F campfire   Y totem   o bones   x crag (impassable, drawn)
 *   creatures: r orc   c archer   e warrior   S shaman   k berserker
 */
import type { HandmadeSpec } from "./handmade.ts";
import { Tile } from "./types.ts";

export const ORCISLE_SPEC: HandmadeSpec = {
  key: "orcIsle",
  name: "The Orc Isle",
  safe: false,
  portals: {
    P: { dest: "cellar", label: "back to the Time Sage's cellar", span: 2, floor: Tile.Dirt },
    D: {
      dest: "gorak", label: "down into Gorak's hall",
      style: "caveMouth", floor: Tile.Dirt, inactive: true,
    },
  },
  // Nothing in this export seals a square, so the glyph is here only because
  // the parser wants a `solids` string and a later re-export may well add one.
  solids: "x",
  scenery: { V: "deadTree", v: "felledTree", N: "tent", Y: "skullPole", Q: "boulderA", q: "boulderB" },
  monsters: {
    r: "orc",
    c: "orcArcher",
    e: "orcWarrior",
    S: "orcShaman",
    k: "orcBerserker",
  },
  rows: [
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~.............~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~...............~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~.................~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...............~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~...................~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.................F......~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~.....V...............~~~~~~~~~~~~~~~~~~~~~~~~...............r.............~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~...R.......P..........~~~~~~~~~~~~~~~~~~~~~........r.................r.......~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~........................~~~~~~~~~~~~~~~~~~~.............V.R.......V............~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~.......V............V....~~~~~~~~~~~~~~~~~~......................................~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~....V............F.N......~~~~~~~~~~~~~~~~....v............o.v..v................~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~.......RR.............v.....~~~~~~~~~~~~~........V...v...V.........V.........V....~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~..............................~~~~~~~~~................R........R.o...V...V........~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~...r...........o....v.............~~~........V................V.........Y...........~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~.......V..T............V................r........V..V............v....R.............~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~............V.............V....r...........T..........T...r.........V.F.....c.......~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~..................V.T.v..............R.........R.......R......V..........R......V...~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~...R.....V.....V..................T..........V...................V..................~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~....Y.V.....V.....T.T...R..........T...........q..V..V.R...............V.R..........~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~......................V...V..v.......V.T.....v.............v..V.T.o.V.....FR.........~~~~~~~~~~~~~~~~",
    "~~~~~~~~~..T..............................V.......V.........TRT..........................V.....~~~~~~~~~~~~~~~",
    "~~~~~~~~~........r....V...r.....R.........................V.o...V................o....V.........~~~~~~~~~~~~~~",
    "~~~~~~~~~....V................V........V........RT.R..r.............V.......V..V...V..............~~~~~~~~~~~~",
    "~~~~~~~~~...........T...........R..r.........r.............v.....R......c............ToT..c.......~~~~~~~~~~~~",
    "~~~~~~~~~.............V......T..................R..............V..............................v...~~~~~~~~~~~~",
    "~~~~~~~~~...V..............v..........Q..V........V................V........V......V...........o..~~~~~~~~~~~~",
    "~~~~~~~~~......V..V.R..........V........................TT.V.........R.........V......V.......R...~~~~~~~~~~~~",
    "~~~~~~~~~~.............V....q.........................V.......V.R........v..v.......o.............~~~~~~~~~~~~",
    "~~~~~~~~~~~..RT....T......V.......V..V.R.V..V.....V...............V...............V.........V....o~~~~~~~~~~~~",
    "~~~~~~~~~~~~................Q..V...............V...............v......V...............V..V.....R..~~~~~~~~~~~~",
    "~~~~~~~~~~~~~..R.V.T..r..............Q...............R.V...r.........F...V.R..c..R..........R.....~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~............V..v.q..V...o.V..V..T....V...............V...............V..v..........o~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~..................................V....R.........V.......................o..V.R.V...~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~......................v.....R.v.....T......................V.......v..............~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~...V..........V..V.......V.......R.o.R.........R.....V..V....T.v.Ro...V.......v...~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~.........V.Q...........................V..V......V........Q......................~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~...T.V..............r...v....r..............V.......v...........v...v.T..c..Y...~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~................V................V........T..................V.................~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~..T........r..........................r.....v...c........c............T........~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~....V..V................V...........................V...........V..V........F.~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~..............V..v............T.............................V......F....Q...~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~....................V.....V.Q.o..V.......V...........T...........RR.........~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~...V..V................V.............v.............V...T...........TT.V.Q...~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~.......T.V...V..V..........R.v..........v..V..V.....oR..V..V..V.q.o..N.....~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~...................V............V....TT.........Yq.R...............q........~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~...r...T.v.............r...........V.........R.................R..........e..~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~.............r.....R......R.V...........c..................e....V..v.o.......~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~.................V.............V.T............V...V...V.R.........o..........~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~.....V..V..........................V.............o............RF...T........~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~..........................V....FoT....................Q......................~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~...v..v.RT..........V..V.....V.........T....V..V....V.......N..F.V..Y.V......~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~...........V..V..V.............oR.R.V....V.......Q....Q..V....R..........V...~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~..T..........................R.........F.........................v...........~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~......r..R....R...........c......q..v...Q...............N.................oR..~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~.............o...r....V........V............c..T.V...e...........Q...e...Ro...~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~...........V........T.................o....................V...V..F........Y..~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~..T.................................V...V........F......q.....................~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~.......R.....v........V.........V.o...............T......o......v........V.RR..~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~...T.V.....V.........T.....V...............R.q.Q.RTF...T....F.V....oR.v.To.o....~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~.........................v.....V.R....................V...oQ...........F..........~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~.......TT.V.......V..V..............V...c..TR.............R.....R..V...............~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~.....r.........r...o..........R................V..V.R..............o...V...V...e.....~~~~~~~~~",
    "~~~~~~~~~~~~~~~.............R.............c..R..V.RT.v......Q.........V..V....e.....Yo.F...............~~~~~~~",
    "~~~~~~~~~~~~~~~..q.......V.......................o.................q..................R................~~~~~~~",
    "~~~~~~~~~~~~~~....o................V..V......To.............o....V......o.........YoR..o..V........YR..~~~~~~~",
    "~~~~~~~~~~~~~....T.................................T.V....R...V.......V.F.V..........T...............o.~~~~~~~",
    "~~~~~~~~~~~~.......R.V..V..V......v..v..........V.......V........T...........R.............R.V.Y.V.R...~~~~~~~",
    "~~~~~~~~~~~~......T...........V.........V..T.......................V..............V.....e..............~~~~~~~",
    "~~~~~~~~~~~....r......T...................T..V..v...e..RR.v...e.....o..e...V...V..............q.YR.....~~~~~~~",
    "~~~~~~~~~~..o.......V.....c...v.Q...c....................F.......N........o.................V.......e..~~~~~~~",
    "~~~~~~~~~...............................V......YR..........F.......Y.............o.V.........F.o.......~~~~~~~",
    "~~~~~~~~~..............Y......R............V.oR........T......N.............V..V......o.....R....T.....~~~~~~~",
    "~~~~~~~~...o..........o.........V.................RN.....V...R.......o...R.......N..v......R.FTT.......~~~~~~~",
    "~~~~~~~~.........YR.V.....................R.....V..........RY....V.....V........R....oQ..V.......RTRo.~~~~~~~~",
    "~~~~~~~....v..V..........V...V.YT.v..V..V....V....R.......F...v.o..Q.....o.V..V....T...N.o............~~~~~~~~",
    "~~~~~~~........o.v.................o........FF........V.R.......o................v..q.o...R..e........~~~~~~~~",
    "~~~~~~~.......................................................R..R.........Y....N................V....~~~~~~~~",
    "~~~~~~......r........c...V.R...c..R..V...c........e....N...e....N...e....V...V........................~~~~~~~~",
    "~~~~~~...R......V.............................................R..................................v....~~~~~~~~",
    "~~~~~~..R...............T..v......R.TT.......V..........o..............T.......................N.....~~~~~~~~~",
    "~~~~~~.............................To...o..........................o..o...V...k.......D......V...q...~~~~~~~~~",
    "~~~~~~..........V....T...........v...........F........V.......v........T.....................o......~~~~~~~~~~",
    "~~~~~~...V.........V....V..V..V...oT..V.T..V...V..V.....o.V.....Y.v..........................F......~~~~~~~~~~",
    "~~~~~~.......V..v....q.........o.R................N.........R......o.V.T.V.TF......................~~~~~~~~~~~",
    "~~~~~~.................................T............R.V..v.F..V...............v.............q...e..~~~~~~~~~~~",
    "~~~~~~...V................c.....Q...c....V.YR..V............F...o....T...T........................~~~~~~~~~~~~",
    "~~~~~~~.....V..V...V..V.......V........R................T.....F......F.V......R.............q....~~~~~~~~~~~~~",
    "~~~~~~~~...........N............R..........Q..v....T.V....V.....oR.V.....Y.V....V.R.o............~~~~~~~~~~~~~",
    "~~~~~~~~~~......RTY...v.....................F....V..........R.........v.Yo...........o.V........~~~~~~~~~~~~~~",
    "~~~~~~~~~~~.............Y..v..V.........V.T..YQ.........Y.....RT.........................R.V....~~~~~~~~~~~~~~",
    "~~~~~~~~~~~..r...R..........o......T.V.....R..........V..........R..........................F..~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~.........~~~......q..V................e........e........e...V....e...V....S...v....~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~.......~~~~~~~~..........v.........................V..............................~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...........c....V...................................v..........~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.....................V......R......................o.....~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~..............................~~~~~~~~~~...........~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~F..........o......~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  ],
};
