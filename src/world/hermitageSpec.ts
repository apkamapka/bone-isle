/**
 * The redcap's lair — the cave under Liddesdale, and the end of the Time
 * Sage's first mission.
 *
 * Traced from `redcapleboss.tmx` (30x30). Both rock layers are collision, both
 * floor layers are walkable, and the shape they leave is a flattened S: an
 * upper chamber, a throat six tiles wide, and a lower chamber. That shape is
 * the whole of the level design and nothing was added to it.
 *
 * THE TWO ENDS. The ladder up stands in the far west of the UPPER chamber and
 * the redcap in the far west of the LOWER one, which are the two points
 * furthest apart by walking — thirty-four tiles, the length of the S. You come
 * down at one end of his house and he is at the other.
 *
 * THE HOARD IS A CHEST, NOT A POCKET. Thirty platinum sits in a one-time chest
 * against the west wall three squares behind him, keyed to this world in
 * `CHEST_PRIZES`. It is not on the creature. `game.opened` makes a chest
 * unrepeatable per character and a respawning post is the opposite of that, so
 * routing the mission's payday through his loot table would have turned a boss
 * into a press the first time anyone walked back down. He still carries the
 * cap and the tooth, which are the things the story is about.
 *
 * WHO ELSE IS DOWN HERE. Six skeletons and nothing else — what he has killed,
 * still walking. They weigh the same as the highwaymen guarding the hole
 * above, so the lair reads as a continuation of the island rather than a
 * spike, and they stand eight tiles apart like every other post in the game:
 * the walk in is six single pulls and never a train. The boss is the exam; the
 * corridor is not.
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
    "#######U==o=R===o=R======R=###",
    "#######===q======Y======o==###",
    "#######===o====o===========###",
    "#######=================q=o###",
    "#######============k=======###",
    "#######===k============o=o=###",
    "#######========o===========###",
    "#######Y=======Q=====o=o==R###",
    "####################=Y====o###",
    "####################=R=====###",
    "####################=====q=###",
    "####################=======###",
    "####################=k==Q==###",
    "####################=======###",
    "####===R=Q=================###",
    "####X====================R=###",
    "####========k==============###",
    "####===========Q====o======###",
    "####$==================o===###",
    "####===================q===###",
    "####===R========Ro=========###",
    "####================k======###",
    "####============o=======o==###",
    "####===o====R====Q=========###",
    "##############################",
    "##############################",
    "##############################",
  ],
};
