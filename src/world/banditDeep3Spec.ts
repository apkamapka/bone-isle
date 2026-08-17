/**
 * Bandit Deep -3 — the black cell.
 *
 * Traced from `bandit_piwnica_-3.tmx`. Forty by forty, and only 250 squares of
 * it are floor: this is not another hunting ground but a chamber carved out of
 * solid rock, and it is laid out by hand rather than scattered. Both wall
 * layers measure 0.86 and 0.92 ink per square against the open floor's 0.01,
 * so unlike the two floors above it this map is drawn ON the grid and every
 * wall square is sealed whole.
 *
 * The three markers in the drawing are honoured where they stand: the ladder
 * back up to -2 at (22,31), three of the heaviest human ranks barring the way
 * at (22,23), and the Black Knight alone at (22,9) with three clear squares
 * around him. You come up the room, you get past the gate, and then it is only
 * him. Nothing else is posted, because a boss you have to find in a crowd is
 * not a boss.
 *
 * Bones, totems, a few fires and some loose rock furnish it. No tents: nobody
 * camps down here.
 *
 *   1 ladder back up to -2   # rock   = floor
 *   R rock   F campfire   Y skull totem   o bones
 *   creatures: c chieftain  v warlord  K the Black Knight
 */
import type { HandmadeSpec } from "./handmade.ts";

export const BANDITDEEP3_SPEC: HandmadeSpec = {
  key: "banditdeep3",
  name: "The Black Cell",
  safe: false,
  portals: {
    1: { dest: "banditdeep2", label: "back up to the deep cells", style: "ladderUp" },
  },
  scenery: { Y: "skullPole" },
  monsters: {
    c: "chieftain",
    v: "warlord",
    K: "blackKnight",
  },
  rows: [
    "########################################",
    "########################################",
    "########################################",
    "########################################",
    "########################################",
    "########################################",
    "########################################",
    "########################################",
    "###############===========oF=o##########",
    "###############Yo=o===K=======##########",
    "###############==R============##########",
    "###############==============R##########",
    "###############===============##########",
    "###############===o=====o===Fo##########",
    "###############o============o=##########",
    "###############RY=======R=Y===##########",
    "################==F==========###########",
    "################==o==========###########",
    "#################======o====############",
    "#################===o==F====############",
    "##################===Y=====#############",
    "##################=====oR==#############",
    "###################R==c==o##############",
    "###################==vc===##############",
    "####################=====###############",
    "####################o===o###############",
    "####################=Y=R=###############",
    "####################=o===###############",
    "####################=====###############",
    "####################o===Y###############",
    "####################=o=o=###############",
    "####################==1==###############",
    "####################=o==F###############",
    "####################==R=o###############",
    "########################################",
    "########################################",
    "########################################",
    "########################################",
    "########################################",
    "########################################",
  ],
};
