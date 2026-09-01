/**
 * Na Tursachan - the sanctum under Calanais. Five wedges, five circles.
 *
 * Traced from `questna8-1.tmx` (32x32) and DRAWN from
 * `public/tursachan-terrain.png`. The `czern` layer is a full-map fill standing
 * in for the rock the chamber is cut out of, and every square a later layer
 * paints is floor. The whole disc is one open room, all of it reachable from
 * the dais.
 *
 * THE FLOOR IS THE LEGEND. The export ships the five wedges in flat marker
 * colours; the picture in `public/` is that export RETINTED wedge by wedge to
 * the colour of the element it grants - red fire, blue water, pale grey wind,
 * yellow lightning, brown earth. Nothing in the game reads those colours. They
 * are there so a player standing in the doorway can see all five choices at
 * once, which matters because the choice is permanent.
 *
 * HOW THE RETINT DECIDES WHICH WEDGE A SQUARE IS IN, and the two ways that
 * went wrong first. Every floor square is classified by a MAJORITY VOTE of its
 * own painted pixels. Classifying by the square's MEAN colour failed on the
 * rim, where half of every square is black rock and drags the mean off every
 * wedge colour - fifty squares kept their original marker paint and the game
 * showed green fringes along the edges. Inheriting the wedge from a NEIGHBOUR
 * failed differently: a diagonal step reached the wrong wedge first and thirty
 * squares along the top were tinted as lightning while sitting in the fire
 * wedge, which left them the original red. Voting on pixels has no geometry in
 * it and gets both right. Zero pixels of the original marker colours survive,
 * and the suite counts them.
 *
 * ONE OPEN ROOM, ON PURPOSE. A choice made blind is a bad choice, so every
 * circle has to be readable BEFORE any of them is walked into.
 *
 * NO LADDER BACK UP. The one echo in the game with no way out but forward: the
 * stair from Calanais is one-way and the only exit is the dais, which goes
 * straight to Chronos. You came down to choose, and you leave by telling him.
 *
 * THE DAIS IS PAINTED AS A 4x4 AT x=14..17, y=14..17 and the pad is the 2x2 at
 * 15,15 - one square in on every side, so it reads as centred rather than as
 * having slipped into a corner, which is what a 2x2 anchored at 16,16 did.
 *
 * TWO KINDS OF EFFECT, AND THEY ARE NOT THE SAME THING.
 *
 *   1..5  THE CIRCLES. One per element, on the squares the TMX object layer
 *         marks. `attuneNodes`: 2x2 of artwork, seal nothing, and walking into
 *         one IS the errand. Their squares are a contract - which one the
 *         player walked to is the choice they made.
 *   a..e  AMBIENT. One square each, scattered nine to eleven a wedge, three
 *         squares apart minimum. `ambientFx`: pure decoration, drawn from the
 *         same `fx-<el>-1-field` strips the spells use. They exist so a wedge
 *         reads as ITS element from across the room rather than as a coloured
 *         floor, and they are kept clear of the circles so the thing you can
 *         actually walk into is never lost in a crowd of things you cannot.
 *
 * NOTHING LIVES DOWN HERE. The difficulty of this errand is the island on top.
 * A room holding a permanent choice is not a place to be interrupted.
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
  ambient: { a: "fire", b: "ice", c: "earth", d: "storm", e: "shadow" },
  rows: [
    "################################",
    "################################",
    "################################",
    "################################",
    "#########===a===b===b==#########",
    "########================########",
    "#######==a=====a=======b=#######",
    "######============b=======######",
    "#####=====1=a=======2=====b#####",
    "####=a=========a======b=====####",
    "####=======================d####",
    "####e==ea==a======b=========####",
    "####=================b======####",
    "####==========a===========d=####",
    "####====e==a======b====d====####",
    "####===========C============####",
    "####=e=====e=======d====4=d=####",
    "####===5==============d=====####",
    "####========================####",
    "####========ec==c==d=====d==####",
    "####====e=============d=====####",
    "####e==============c========####",
    "####======================d=####",
    "#####====c===c==3======d===#####",
    "######e===================######",
    "#######==========c===c==c#######",
    "########======c=========########",
    "#########c=============#########",
    "################################",
    "################################",
    "################################",
    "################################",
  ],
};
