/**
 * Calanais - the Temple Isle. The Time Sage's gift-errand, level 8.
 *
 * Traced from `questna8.tmx` (110x110) and DRAWN from
 * `public/calanais-terrain.png`, that file's own "Export as Image" at native
 * tile size. The picture is the whole look; the grid below is only what the
 * picture cannot say - collision, portals, posts.
 *
 * COLLISION COMES FROM THE LAYER STACK, NOT FROM THE COLOURS. This map stacks
 * its layers for looks: `woda` is a full-map water fill and every later layer
 * is painted ON TOP of it. A square is land exactly when something above the
 * water paints it. That is the OPPOSITE of the rule the older Tiled maps in
 * this folder follow, where the extra layers SEAL their square - and reading
 * this one the old way is a real trap, because the temple's dark inlay and the
 * moat both come out as "dark pixels" and the derived grid then walls the
 * descent chamber in completely, with no door at all. Flood-filling from the
 * arrival pad is what tells the two apart, and the smoke suite does it.
 *
 * THE BRIDGES ARE NARROWER THAN THE LAYER THAT PAINTS THEM. The `most` layer
 * covers five columns, x=58..62, and the decking in the export is three -
 * x=59..61 - with the posts standing on the outer two. Taking the layer at
 * face value put a walkable square on open water down each side of both
 * crossings, and the player standing on it was standing on the sea. So 58 and
 * 62 are water here on the bridge rows, and the deck is the three squares you
 * can actually see planks under.
 *
 * WHO LIVES HERE, AND WHY THIS BAND. Snake, poacher, bandit, smuggler,
 * cutthroat - 20 to 80 experience. Deliberately capped BELOW Liddesdale, which
 * opens on the smuggler and closes on the highwayman: a character arrives here
 * at eight and on Liddesdale at ten, and if this island reached brigands the
 * two grounds would be the same ground and the next errand would have nothing
 * left to be.
 *
 * THE GRADIENT RUNS AT THE TEMPLE, NOT AWAY FROM THE PAD. Every other island
 * ranks its posts by walk distance from where you land, which works because
 * the hole is at the far end of the walk. Here the hole is in the MIDDLE, so
 * ranking from the pad would leave the softest creatures guarding the thing
 * the errand is about. Posts are ranked by walk distance to the platform
 * instead: cutthroats nearest it, snakes furthest. The crossing IS the
 * mission - there is nothing to kill at the end of it.
 *
 * 64 posts, no two within 8 squares, so every pull is a single one.
 *
 * NOTHING IS POSTED ON THE TEMPLE ITSELF, or within three squares of it or of
 * either bridge. Two reasons, and they are different. The bridges are one
 * square of deck wide with no way off, so a creature on or beside them turns a
 * crossing into a corridor fight with no retreat. The platform is where the
 * player stands still and reads - the descent is on it - and an ambush there
 * is an ambush on a menu.
 *
 * TWELVE FIRES INSTEAD, AND THEY ARE SYMMETRIC ON PURPOSE. Four on the inner
 * cross at three squares, eight on the outer arms at (1,6) and its whole
 * eight-fold orbit, all about the platform's own centre at 60,52. The set is
 * closed under both mirrors AND the diagonal swap, and a test checks all
 * three, because a ring of fires that is nearly symmetric looks like a mistake
 * where a scatter would have looked deliberate. The descent square itself is
 * left clear. Fires seal nothing, so they light the temple without walling it.
 *
 * AND FOUR RINGS OF THE OTHER ELEMENTS, ADDED IN ETAP 48. The platform used to
 * show fire and nothing else, which told the player the wrong thing about the
 * room underneath: five circles wait down there and the lid advertised one.
 * Now every element is on the lid, drawn from the same `fx-<el>-1-field`
 * strips the sanctum uses, so the two floors read as the same place seen from
 * two sides.
 *
 * Each element gets FOUR squares on its own orbit about 60,52, and every orbit
 * is closed under the same three symmetries the fires are — a cross {(0,±r),
 * (±r,0)} and a diagonal {(±r,±r)} both are, which is why those are the only
 * two shapes used. Read outward from the hole:
 *
 *   r=2 diagonal   water        nearest the descent
 *   r=3 cross      FIRE         (campfires, unchanged)
 *   r=4 diagonal   lightning
 *   r=5 cross      earth
 *   r=6 orbit      FIRE         (campfires, unchanged)
 *   r=7 cross      wind         outermost — the one always trying to leave
 *
 * Fire keeps the campfires rather than growing a field of its own: it is the
 * only element the surface already had, and a lit camp reads as a lit camp.
 * The ambient squares seal nothing and are walkable, exactly as in the sanctum.
 *
 * 356 LIVE TREES. `T` and not the dead wood of Liddesdale - this island is
 * alive, and the contrast is the point when the two sit next to each other in
 * the sage's cellar. 87 minable stones scattered between them.
 *
 * IT WAS 135, AND THEY WERE ALL ON THE RIM. Nine groves, every one of them
 * within a dozen squares of a shore, and the whole middle of the island bare -
 * so a player walking the crossing saw grass, grass, grass and concluded the
 * trees had been deleted. They had not; they were simply all somewhere he was
 * not. A count is not a distribution.
 *
 * The fix is placed by COVERAGE rather than by scatter: one or two groves in
 * every 20x20 block that has real land in it, four to eight trees each, sized
 * from a list so that no two come out the same. An even count per block reads
 * as an orchard; the variation is what makes it read as ground.
 *
 * THREE THINGS THE PLANTER REFUSES, each of which it did on the first attempt:
 *
 *   - THE TEMPLE ISLET, as a SHAPE and not as a radius. Excluding "within 14
 *     of 60,52" left the islet's own shoreline just outside the circle, and a
 *     grove found that thin strip and grew a hedge fourteen trees long down
 *     both banks of the moat. The islet is now the land you can reach from the
 *     platform without crossing a bridge, plus two squares of its shore.
 *   - A FOURTH TREE IN A STRAIGHT RUN. Three is a copse edge, four is a fence.
 *   - ANY SQUARE THAT WOULD POCKET ANOTHER. The island is re-walked from the
 *     arrival pad after every single tree, and one that closes something off
 *     is taken straight back out. Trees seal their square and a boulder seals
 *     two, so a tree planted beside a boulder is the pair that pinches a gap
 *     shut - which is why nothing is planted within one square of one.
 *
 *   P pad back to the cellar (2x2)   D down into the sanctum
 *   T tree   R stone   F fire
 *   element fields: i water  l lightning  e earth  w wind
 *   Q black boulder (2x1)   q black boulder, the other one
 *   creatures: n snake  p poacher  b bandit  s smuggler  c cutthroat
 *
 * TWO SNAKES, at opposite ends of the island. There were ten, and ten of the
 * weakest thing on the map is filler rather than a population — the errand is
 * the crossing, and a crossing interrupted every twenty squares by a 20-exp
 * pull is a chore. The two that stay are the furthest-apart pair of the
 * original ten, so the species is still on the island and still nowhere near
 * itself. `n` in the legend above is deliberately kept.
 */
import type { HandmadeSpec } from "./handmade.ts";
import { Tile } from "./types.ts";

export const CALANAIS_SPEC: HandmadeSpec = {
  key: "calanais",
  name: "Calanais",
  safe: false,
  portals: {
    P: { dest: "cellar", label: "back to the Time Sage's cellar", span: 2, floor: Tile.Dirt },
    // The one way down, and a MISSION door: `applyMissionPads` puts it to
    // sleep whenever the sanctum behind it is not enterable, so it is dark
    // before the sage speaks and dark again the moment a circle is walked into.
    D: {
      dest: "tursachan", label: "down into the sanctum",
      style: "caveMouth", floor: Tile.Dirt, inactive: true,
    },
  },
  monsters: { n: "snake", p: "poacher", b: "bandit", s: "smuggler", c: "cutthroat" },
  /* Decoration only — `ambientFx`, never `attuneNodes`. The squares you can
   * actually WALK INTO are all in the sanctum below; nothing on this island
   * grants anything, and giving the lid a real circle would let a player take
   * an element without ever making the crossing the errand is about. */
  ambient: { i: "ice", l: "storm", e: "earth", w: "shadow" },
  /* Thirty black boulders, fifteen of each. The island had `R` — the grey rock
   * you mine — and nothing you simply walk around, so every obstacle on it was
   * a resource and the ground read as a lawn with quarries in it.
   *
   * Each is two squares wide and seals both, so the scatter is checked rather
   * than trusted: none within six squares of another, none within three of a
   * creature's post (a boulder that walls a snake into a corner is a creature
   * that can never be fought), none within twelve of the platform's centre —
   * which keeps them off the element rings and out of the place the player
   * stands still to read — and none near either crossing or the arrival pad.
   * The suite re-walks the island from the pad and reaches every post. */
  scenery: { Q: "boulderA", q: "boulderB" },
  rows: [
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...s...........~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.................................~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.....p....................R.TT.T..T.....b...........~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~.....................R..T.T.......T.....T..T..R..T.T.......p~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~..n.......T..R...T....Q........T..TT..T.......T..........T.T.....~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~.......T..T..........T.......T.T......TT..T..........T..T............~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~.....R...........T..T..............T..T..T.....T..T..T........TT...R....~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~.........................T.T..T..........T.T................R......T......~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~...T..TT..TT..q....T...T..........T.R...T.........T..T....Q...TT....T.T.....~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~.......T.T............T.....T.........q...T..T..c.......T..........T.....T....~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~..........................T.....s...........T.....R.T.T................T....R...~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~..............T..R....T..T...T......T........T.............T....T.T.T...T..T......~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~..T.T.......T........T......T...R........T..T....T.T.T...T....T........T............~~~~~~~~~~~~~~",
    "~~~~~~~~~~~...T...........T........T.T.............T...............T....T....T.T..........T..T..~~~~~~~~~~~~~~",
    "~~~~~~~~~~.......RP....T.....T..T.......T.T.............T.T..T.T.T..................R.b.....T....~~~~~~~~~~~~~",
    "~~~~~~~~~.................T...........T.......q.......T............T..T...R....T.T............RT..~~~~~~~~~~~~",
    "~~~~~~~~~..R.T.........T....T..T..T.T...T.T.........T.......T.T...........s..T..............T....p~~~~~~~~~~~~",
    "~~~~~~~~~......T.T.......T............................T.Rc.......T.T..T.........T.........T...T....~~~~~~~~~~~",
    "~~~~~~~~~..............T.......T...........T.T..T.T.T.......T.......................Q..............~~~~~~~~~~~",
    "~~~~~~~~~...TT...T..T....T.T.T.....b..T..T....................T.R..T.T..T.T...T.T.........T.T.TT.T.~~~~~~~~~~~",
    "~~~~~~~~~.............T........T.R..............T..T..T.T.T.................T...T.............T....~~~~~~~~~~~",
    "~~~~~~~~~..Q...T...T........T...........T....s...............T.....T.T.T..T...T.....T.T.T......T...~~~~~~~~~~~",
    "~~~~~~~~~.....T......T...b............T....R......T....T.T.T...T.T...............T.........T.T.....~~~~~~~~~~~",
    "~~~~~~~~~........T.....R....T...T..T................T........T.....T...T......T......T.T.......T...~~~~~~~~~~~",
    "~~~~~~~~~..T..TT........................T...T............................q......T..T......T.T......~~~~~~~~~~~",
    "~~~~~~~~~..R.T....T.T.....T...T..T.T...T.....T.Q........T.T.T..T.T...T.....R.........R.............~~~~~~~~~~~",
    "~~~~~~~~~.......T.....T.T..T...........T..TT.T......T.R...............................s.....T..R..~~~~~~~~~~~~",
    "~~~~~~~~~.........T.......T....T..T..R....T.......................R....T.T..c...T.T......T......b.~~~~~~~~~~~~",
    "~~~~~~~~~.......T.........T..T.............T..T.T.....T.T.........c..T............................~~~~~~~~~~~~",
    "~~~~~~~~~..q.........T.T................T.TTT......T......~.::~.........T.......T..T..T..T.T......~~~~~~~~~~~~",
    "~~~~~~~~~.......T.TT.....T...T...q....T...................~:::~~...........T...............T......~~~~~~~~~~~~",
    "~~~~~~~~~~.................T............T.T.T.Rc.....~~~~~~:::~~~~~~~...T.....T.....T.....T..T.T..~~~~~~~~~~~~",
    "~~~~~~~~~~..R.T....T.T................T.............~~~~~~~:::~~~~~~~~....T.....T.T...T.T.........~~~~~~~~~~~~",
    "~~~~~~~~~~......T..TRT..b..T.T.T....T...T.T.......~~~~~~~~~:::~~~~~~~~~...........................~~~~~~~~~~~~",
    "~~~~~~~~~~.......................R..............~~~~~~~~~.~:::~.~~~~~~~~~....T.T..T.R.............~~~~~~~~~~~~",
    "~~~~~~~~~~~..T.T.T.T.T........T........T.T...~~~~~~~~~...:~:::~:...~~~~~~~...................Q....~~~~~~~~~~~~",
    "~~~~~~~~~~~.............q........T..s...T...~~~~~~~~..:::.:::::.:::..~~~~~~...........q........R..~~~~~~~~~~~~",
    "~~~~~~~~~~~~..T...T.T.......T..............~~~~~~~..::....:::::....::..~~~~~...RQ................p~~~~~~~~~~~~",
    "~~~~~~~~~~~~....T............T.T.T.........~~~~~~.::.....:::::::.....::.~~~~~s.............T.......~~~~~~~~~~~",
    "~~~~~~~~~~~.............T.T.........T..T..~~~~~~.:.::.....:::::.....::.:.~~~~~...............T.....~~~~~~~~~~~",
    "~~~~~~~~~~~..R.T.T.T..T......T...T....TR..~~~~~.::::::.....:::.....::::::.~~~~......T..b.......T...~~~~~~~~~~~",
    "~~~~~~~~~~~.................RT.T...T..TT..~~~~~.:::::::...::w::...:::::::.~~~~~.TT........T.T.......~~~~~~~~~~",
    "~~~~~~~~~~~.............T.T..T.......T...~~~~~.:.::::.::..:F:F:..::.::::.:.~~~~..T.T...R............~~~~~~~~~~",
    "~~~~~~~~~~~..T.T..T..T.............T..TT.~~~~.:..::::..::::.e.::::..::::..:.~~~...........T...T.T...~~~~~~~~~~",
    "~~~~~~~~~~~.................T.T..T....T.~~~~~.:.........l:.:::.:l.........:.~~~..T....T.T...........~~~~~~~~~~",
    "~~~~~~~~~~~...TT.....R...p.........T....~~~~~.:.......:::.::F::.:::.......:.~~~..T.T......T.T...T....~~~~~~~~~",
    "~~~~~~~~~~~..T..T..T........T...T....T..~~~~~.:.......::.:i:::i:.::.......:.~~~..R......T............~~~~~~~~~",
    "~~~~~~~~~~~......T......................~~~~~.:...c...F:::::D:::::F...c...:.~~~.T.....T....T....R.T..~~~~~~~~~",
    "~~~~~~~~~~~...T.T.T.T.T.....T.T..R.....~~~~~~.:......w:e.F:::::F.e:w......:.~~~...T.T....T....p......~~~~~~~~~",
    "~~~~~~~~~~~...T...........T...TT....b..~~~~~~.:.......F::.:::::.::F.......:.~~~.......T...........T..~~~~~~~~~",
    "~~~~~~~~~~~..T..TT..T...T........T.....~~~~~~.:.........::i:::i::.........:.~~~.....T......T..........~~~~~~~~",
    "~~~~~~~~~~~..RT.......T.....T.T.T......~~~~~~.:.::::...::::.F.::::..::::..:.~~~...T....T.T......T.T.T.~~~~~~~~",
    "~~~~~~~~~~~...T.........T.T.....TT.....~~~~~~.:.::::..::l.:::::.l::.::::..:.~~~.............T.T....TT.~~~~~~~~",
    "~~~~~~~~~~~......T..T..............T...~~~~~~.:.::::.::...::e::...::::::..:.~~~.....R..T..............~~~~~~~~",
    "~~~~~~~~~~~~.......T..T.T...T...T......~~~~~~~.:::::::.....F:F.....:::::.:.~~~~.T...b....T..T..T.T.TT.~~~~~~~~",
    "~~~~~~~~~~~~..T...T.......T...T...T.T..~~~~~~~~.:..::.....::w::.....::..:.~~~~~.T...............T.....~~~~~~~~",
    "~~~~~~~~~~~~.T..T..T.T.R................~~~~~~~.:..::....:::::::....::..:.~~~~..........T...R.T...TR..~~~~~~~~",
    "~~~~~~~~~~~~......T..........T.R..T..T...~~~~~~~.:........:::::........:.~~~~.............T..........p~~~~~~~~",
    "~~~~~~~~~~~~...T.T..TT....b.................~~~~~.::.......:::.......::.~~~~~...T.Q.....T...T.......T.~~~~~~~~",
    "~~~~~~~~~~~~....................T............~~~~~..::......:......::..~~~~~...R..............T..T....~~~~~~~~",
    "~~~~~~~~~~~~~......T..T....q..............T...~~~~~~..:::.......:::..~~~~~~c.............TT.T...TT.T.~~~~~~~~~",
    "~~~~~~~~~~~~~...p..................Q..R.........~~~~~~...:~:::~:...~~~~~~~....T.T.T....T......T....T.~~~~~~~~~",
    "~~~~~~~~~~~~~..R......T.T...T.T........s..T......~~~~~~~~.~:::~.~~~~~~~~~............T...T.T.....TT.~~~~~~~~~~",
    "~~~~~~~~~~~~~.......T..........T............T.T...~~~~~~~~~:::~~~~~~~~~~...T.T..T.T.................~~~~~~~~~~",
    "~~~~~~~~~~~~~...T.....T..T.T......T.............T...c~~~~~~:::~~~~~~~~..............T.T.......q.R..~~~~~~~~~~~",
    "~~~~~~~~~~~~~.....T.T.........T......T...T.T.T...T........~:::~...........T...T...T.....T.Rs.......~~~~~~~~~~~",
    "~~~~~~~~~~~~~...T......T..TT....T..T.............TTT......~:::~........T....T...T...T.T...........~~~~~~~~~~~~",
    "~~~~~~~~~~~~.....T...........T.............T.T.T.T.T.T..T.~.::~.T..R.....T....T.........T......T..~~~~~~~~~~~~",
    "~~~~~~~~~~~~...T...............T.T.R..Q.............TTT..............T.............T..T......T....~~~~~~~~~~~~",
    "~~~~~~~~~~~~....T..T..q....R...................T.T...T..........T..........T.R...T......T..T...T..~~~~~~~~~~~~",
    "~~~~~~~~~~~p...T...R..............T.....................T...T.....T.T....T....c.....T.T......T....~~~~~~~~~~~~",
    "~~~~~~~~~~~.......T...T......b..T....T...T..c......T..T...T............T.........T................~~~~~~~~~~~~",
    "~~~~~~~~~~~..R.T...T.T.T.T.............T.......R.T........T.TT.............T.............T........~~~~~~~~~~~~",
    "~~~~~~~~~~.......T.....T.T.......TT.T....T.....T............TT..c..T..T...T..T.T.T.T..T.....Q.....~~~~~~~~~~~~",
    "~~~~~~~~~~...T.....T.........T...............T.....T..c.....T.R........T..T..............T........~~~~~~~~~~~~",
    "~~~~~~~~~~......T....T.T........T...T.R.T.T...T..T........T........T.T....TT..........R...........~~~~~~~~~~~~",
    "~~~~~~~~~~..T.....T.......T....TT.........T.T................T...........................T.T.T.R..~~~~~~~~~~~~",
    "~~~~~~~~~~.....T........T...T.R..T..T........T...................T.T.T.R.T.T..q....T..b..........p~~~~~~~~~~~~",
    "~~~~~~~~~~......................T.....T.T.T......Q.....T..T................TT............T.T.T....~~~~~~~~~~~~",
    "~~~~~~~~~......T....p.....T.T.T.............................T........T....T.......................~~~~~~~~~~~~",
    "~~~~~~~~~..q.....T....R.T.......T..b...T.T.T..........T..T......Q.......T.T.TT....T...T..T..T.T...~~~~~~~~~~~~",
    "~~~~~~~~~..R...T.T............................s..R..........T..............T...T....T.............~~~~~~~~~~~~",
    "~~~~~~~~~.......T....T..T..............T.T.T........T.....R...........T..........T.......T.T.....~~~~~~~~~~~~~",
    "~~~~~~~~~..T......q.........Q..........................T.......T........T......R.....T.T......T..~~~~~~~~~~~~~",
    "~~~~~~~~~~.T.TTT........T...............T..T..T.T.T.T....T...T.....T.T....T...s...T......T.R.....~~~~~~~~~~~~~",
    "~~~~~~~~~~.T.T.......T............q............................T.T...............T..T...........~~~~~~~~~~~~~~",
    "~~~~~~~~~~.T.TTTT...T..T....T.................T..T.T.T..T...T.........T.T..T.........T.T....T..~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~..TTT..........T...T.R......T..T.T.............T.........T...........TTT.T....T.....~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~.....T.T.R..T...T.....T.T........................T...sR............................~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~...R.............T..............T.T.T.T..s..T.T..........T..Q........T..T..T.....~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~.....T.T..T.T.T....T.......bR...........R.............T.....R....T.............~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~...............T....T.T........T..T.......T..T....................T..TT...TT.~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~..........T.....T..................T..........T..T.T..T..T....T....T.TT...~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~.......R..........T.T....T....T.....T.....T...............T..........TT.~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~......T.T.T......T....T.....T....T.T....T..T.....T.....T.T.TT.T.TR~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~..................T.T...T.T.TT.......T........T..T..T......TTT.n~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~........R..T.....T.T.........T.T....T.T..T.........T.......~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~............T.....R.TTT..T.....R..............R........~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~................................................~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.........p............s....~~~~.....p......~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  ],
};
