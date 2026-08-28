/**
 * The redcap's lair - the cave under Liddesdale, and the end of the Time
 * Sage's first mission.
 *
 * Traced from `redcapleboss.tmx` (30x30) and drawn from
 * `public/hermitage-terrain.png`, the same file's image export. Both rock
 * layers are collision, both floor layers are walkable, and the shape they
 * leave is a flattened S: an upper chamber, a throat six tiles wide, and a
 * lower chamber. That shape is the whole of the level design and nothing was
 * added to it.
 *
 * THE FLOOR GRID IS CAVE EVERYWHERE. Without it the parser reads a bone pile
 * or a boulder as sitting on grass, and paints a lawn under the skulls - which
 * shows on the minimap and in the fallback bake even with the export loaded
 * over the top.
 *
 * THE TWO ENDS. The ladder up stands in the far west of the UPPER chamber and
 * the redcap in the far west of the LOWER one, the two points furthest apart
 * by walking - thirty-four tiles, the length of the S. You come down at one
 * end of his house and he is at the other.
 *
 * THE HOARD IS A CHEST, NOT A POCKET. Thirty platinum sits in a one-time chest
 * against the west wall three squares behind him, keyed to this world in
 * `CHEST_PRIZES`. It is not on the creature. `game.opened` makes a chest
 * unrepeatable per character and a respawning post is the opposite of that, so
 * routing the mission's payday through his loot table would have turned a boss
 * into a press the first time anyone walked back down. He carries the cap, and
 * the cap is what the story is about.
 *
 * WHO ELSE IS DOWN HERE. Five skeletons and nothing else - what he has killed,
 * still walking. They weigh the same as the highwaymen guarding the hole
 * above, so the lair reads as a continuation of the island rather than a
 * spike, and they stand eight tiles apart like every other post in the game.
 * The boss is the exam; the corridor is not.
 *
 *   U ladder back up to Liddesdale   X the redcap   $ his hoard
 *   # rock   = cave floor
 *   R stone   Q q boulder   Y march-stone   o bones
 *   creatures: k skeleton   X redcap
 */
import type { HandmadeSpec } from "./handmade.ts";

export const HERMITAGE_SPEC: HandmadeSpec = {
  key: "hermitage",
  name: "The Redcap's Lair",
  safe: false,
  portals: {
    U: { dest: "liddesdale", label: "back up to Liddesdale", style: "ladderUp" },
  },
  scenery: { Y: "skullPole", Q: "boulderA", q: "boulderB" },
  monsters: {
    k: "skeleton",
    X: "redcap",
  },
  rows: [
    "##############################",
    "##############################",
    "##############################",
    "#######U==Yo=o=============###",
    "#######=========R==R=======###",
    "#######======o====o=o=o====###",
    "#######====================###",
    "#######============q=======###",
    "#######=k==o============k==###",
    "#######=========k==========###",
    "#######====================###",
    "####################==o====###",
    "####################====R==###",
    "####################R===Q==###",
    "####################=======###",
    "####################=o=====###",
    "####################=====k=###",
    "####====R==o=========R=====###",
    "####X==============Y=======###",
    "####====Q=======Ro==q======###",
    "####====R=o====Q===========###",
    "####$==o=====o========R====###",
    "####====q==================###",
    "####======o=============Q==###",
    "####===========o==k======R=###",
    "####=======================###",
    "####=Yq=====oQ=======o=====###",
    "##############################",
    "##############################",
    "##############################",
  ],
  floor: [
    "##############################",
    "##############################",
    "##############################",
    "#######====================###",
    "#######====================###",
    "#######====================###",
    "#######====================###",
    "#######====================###",
    "#######====================###",
    "#######====================###",
    "#######====================###",
    "####################=======###",
    "####################=======###",
    "####################=======###",
    "####################=======###",
    "####################=======###",
    "####################=======###",
    "####=======================###",
    "####=======================###",
    "####=======================###",
    "####=======================###",
    "####=======================###",
    "####=======================###",
    "####=======================###",
    "####=======================###",
    "####=======================###",
    "####=======================###",
    "##############################",
    "##############################",
    "##############################",
  ],
};
