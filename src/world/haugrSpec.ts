/**
 * Kárr's howe - the grave chamber under Haramsey, and the end of the Time
 * Sage's second mission.
 *
 * Traced from `Draugr-1.tmx` (30x40) and drawn from `public/haugr-terrain.png`,
 * the same file's image export. Collision by exclusion, the usual rule: every
 * tile layer that is not `podloga` seals its square. All three rock layers do,
 * and what they leave is ONE rectangle - x 6..24, y 4..34, nineteen wide and
 * thirty-one deep. There is no maze here and none was added. A howe is a room.
 *
 * THE BLACK MARGIN. Five to six tiles of solid rock around the hall, exactly
 * as the cellar has, and for the same reason: the camera can centre on you in
 * a corner instead of clamping to the map edge and shoving you off to one
 * side. The terrain PNG carries the same margin as flat black.
 *
 * THE FLOOR GRID IS CAVE EVERYWHERE INSIDE. Without it the parser reads a bone
 * pile or a boulder as sitting on grass and paints a lawn under a grave.
 *
 * THE TWO ENDS. The ladder up is centred on the north wall; Kárr stands
 * twenty-eight tiles south of it, at the far end of his own house. You come
 * down at one end and he is at the other, which is the whole of the level
 * design, and it is the shape the export gave.
 *
 * TWENTY FIRES. Not decoration - the hall is unlit stone and the export paints
 * it black, so these ARE the lighting. Grave-lamps down both long walls and a
 * ring of them around him, because the one thing a room this plain can do is
 * make you walk from one pool of light to the next. A fire seals nothing (see
 * `handmade.ts`), so twenty of them cost the floor nothing.
 *
 * THE HOARD IS A CHEST, NOT A POCKET. A Power Ring and twenty platinum sit in
 * a one-time chest against the south wall, keyed to this world in
 * `CHEST_PRIZES`. It is not on the creature: `game.opened` makes a chest
 * unrepeatable per character and a respawning boss is the opposite of that, so
 * routing the payday through his loot table would have turned a boss into a
 * press. He carries the helm, and the helm is what the errand is about.
 *
 * WHO ELSE IS DOWN HERE. Eight ghouls and nothing else - what he killed, still
 * walking, which is the one thing the sagas say happens to a draugr's victims.
 * They are LIGHTER than the moor above (240 hit points against a raider's 440)
 * and that is deliberate: the corridor is not the exam, he is. Every one of
 * them stands eight tiles from its neighbour and eight from the ladder, so you
 * land, you draw, and you fight one.
 *
 *   U ladder back up to Haramsey   W the way home, lit when he falls
 *   X Kárr the Old   $ his hoard   g ghoul
 *   # rock   = cave floor   F grave-lamp   Y totem   Q q black boulder   o bones
 */
import type { HandmadeSpec } from "./handmade.ts";
import { Tile } from "./types.ts";

export const HAUGR_SPEC: HandmadeSpec = {
  key: "haugr",
  name: "Kárr's Howe",
  safe: false,
  portals: {
    U: { dest: "haramsey", label: "back up to Haramsey", style: "ladderUp" },
    // THE WAY HOME. Dark until Kárr is down, then lit where he fell so the
    // helm goes straight to the sage's table without the walk back across the
    // moor. `applyMissionPads` owns it: a pad out of an echo to the cellar is
    // the relic road, and it opens on `complete` and on nothing else.
    W: {
      dest: "cellar", label: "back to Chronos, with the helm",
      floor: Tile.Cave, inactive: true,
    },
  },
  scenery: { Y: "skullPole", Q: "boulderA", q: "boulderB" },
  monsters: {
    g: "ghoul",
    X: "draugr",
  },
  rows: [
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "######===================#####",
    "######===================#####",
    "######====F====U====F====#####",
    "######===================#####",
    "######=========Y=========#####",
    "######=F===============F=#####",
    "######=========o=========#####",
    "######====Q=q=====Q=q====#####",
    "######=F===============F=#####",
    "######===o===========o===#####",
    "######=g=======g=======g=#####",
    "######===================#####",
    "######===o===========o===#####",
    "######=F===Y=======Y===F=#####",
    "######=========o=========#####",
    "######====q=Q=====q=Q====#####",
    "######=F===============F=#####",
    "######=====o=======o=====#####",
    "######=g=======g=======g=#####",
    "######===================#####",
    "######===================#####",
    "######=F=======o=======F=#####",
    "######======o=====o======#####",
    "######====Q=q=====Q=q====#####",
    "######=F===============F=#####",
    "######===Y===========Y===#####",
    "######=g=====F===F=====g=#####",
    "######=====F=======F=====#####",
    "######======q==X===Q=====#####",
    "######===F===========F===#####",
    "######==o=====W===$====o=#####",
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
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "######===================#####",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
  ],
};
