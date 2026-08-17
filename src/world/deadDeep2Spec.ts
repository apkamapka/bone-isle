/**
 * The Cinder Hollow — the dragon's room, two floors under the Bone Reach.
 *
 * Traced from `-2_szkielety.tmx` (30x30). The smallest map in the game and the
 * only one built around a single creature: 260 squares of floor in the shape
 * of an inverted T, a corridor rising into one hall. Collision comes from the
 * two rock layers by the same exclusion rule as the floor above; the shadow
 * layer is decoration.
 *
 * You arrive at the foot of the corridor at (14,22) and it is waiting in the
 * hall at (14,7). Nothing else is posted. A dragon you have to find in a crowd
 * is not a dragon, and this floor exists so there is one place in the game
 * where the fight is only that fight — which its three shapes deserve, since
 * Roar punishes hugging it, Breath punishes standing in front of it, and the
 * Field punishes standing still anywhere.
 *
 * Fire and bone, and very little else. Forty-eight fires and eighty-six bone
 * piles over 260 squares: what furnishes a single creature's room is what it
 * has burned and what it has eaten. Both are walk-through, so the density
 * costs nothing in movement — but three squares at the foot of the ladder and
 * the ring around the dragon stay bare, so you do not arrive standing in a
 * fire and its nova has somewhere to land that is not already burning.
 *
 *   1 ladder back up to Charnel Deep -1
 *   # rock wall   = cave floor
 *   R rock   F campfire   Q q black boulder   o bones
 *   creatures: d the dragon
 */
import type { HandmadeSpec } from "./handmade.ts";

export const DEADDEEP2_SPEC: HandmadeSpec = {
  key: "deaddeep2",
  name: "The Cinder Hollow",
  safe: false,
  portals: {
    1: { dest: "deaddeep1", label: "back up to the charnel deep", style: "ladderUp" },
  },
  scenery: { Q: "boulderA", q: "boulderB" },
  monsters: {
    d: "dragon",
  },
  rows: [
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "####oF=FFoFo=o=FFoo=oF==oo####",
    "####oFoFoq=o=====RoQ==oF=o####",
    "####oo=ooFo======ooQ=R==oF####",
    "####oo=FoRo===d==o=RR=Q=F=####",
    "####FoooFq=R=====Q=o==oo=o####",
    "####oooFoooo=====ooFR=ooo=####",
    "####F=F=oF=oQ=q=ooFo=oFo==####",
    "####=ooF=F=F=ooFFooq=oFF=F####",
    "####FoF=o==R=RF=F=oFooFoFF####",
    "###########FooQ==F############",
    "############ooR=o#############",
    "############F=F==#############",
    "############ooooF#############",
    "############o===F#############",
    "############oooFo#############",
    "############oo=F=#############",
    "############F===o#############",
    "############=====#############",
    "############==1==#############",
    "############=====#############",
    "############o====#############",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
    "##############################",
  ],
};
