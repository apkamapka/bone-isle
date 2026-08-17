/**
 * Charnel Deep -1 — the pit under the Bone Reach's northern descent.
 *
 * The third of the Reach's three holes, and the last to be dug. Traced from
 * `-1_szkielety.tmx` (60x60). Collision is taken by EXCLUSION: every tile
 * layer that is not `podloze` and does not carry "cien" in its name seals its
 * square. Tiled has produced four spellings of "sciany" across these maps and
 * matching on names would quietly drop a whole collision layer at the fifth,
 * so the rule is stated once and holds. The shadow layer is decoration and is
 * deliberately not solid, exactly as its name says.
 *
 * 1771 squares of floor, every one of them reachable from the ladder.
 *
 * WHO LIVES HERE. The dead, in equal thirds: fifteen ghouls, fifteen skeleton
 * warriors, fifteen demon skeletons. Forty-five posts over 1771 squares is
 * thirty-nine tiles apiece — a shade sparser than the orc and minotaur floors
 * beside it, because their heaviest rank is an orc and this floor's is a demon
 * skeleton carrying three orcs' worth of hit points. None of the three throws
 * anything, so no corridor here is shot down its whole length.
 *
 * THE GRADIENT. Ranked by WALK-distance from the ladder up, not by straight
 * line: this is a maze and the two disagree. Ghouls hold the squares you land
 * on (9 to 66 tiles out), warriors the middle (66 to 111), demons the far end
 * (111 to 141) — and the far end is where the hole down to -2 was cut, so the
 * descent is guarded by the worst thing on the floor rather than by distance.
 * Eight squares around the ladder stay clear so you can land and draw.
 *
 * A crypt's furniture: loose rock, bone piles, skull totems, black boulders,
 * and fires left burning by whoever came down here before you. No tents and no
 * wells — nobody camps among the dead and nobody draws water here. Solid
 * furniture only stands where the square has open ground on both axes, so
 * nothing scattered can pinch a corridor shut.
 *
 *   1 ladder back up to the Bone Reach   D descent to -2
 *   # rock wall   = cave floor
 *   R rock   F campfire   Y skull totem   Q q black boulder   o bones
 *   creatures: g ghoul  K skeletonWarrior  d demonSkeleton
 */
import type { HandmadeSpec } from "./handmade.ts";

export const DEADDEEP_SPEC: HandmadeSpec = {
  key: "deaddeep1",
  name: "Charnel Deep -1",
  safe: false,
  portals: {
    1: { dest: "reach", label: "back up to the Bone Reach", style: "ladderUp" },
    D: { dest: "deaddeep2", label: "down into the burning hollow", style: "caveMouth" },
  },
  scenery: { Y: "skullPole", Q: "boulderA", q: "boulderB" },
  monsters: {
    g: "ghoul",
    K: "skeletonWarrior",
    d: "demonSkeleton",
  },
  rows: [
    "############################################################",
    "############################################################",
    "############################################################",
    "############################################################",
    "############################################################",
    "#######====o========F=====od=========F==##=d=======o########",
    "######d============ooR=======R====Y=====##=====D====d#######",
    "######======R======d==========Q=o=====R=##===========#######",
    "######========Ro##===========R==========##F########==#######",
    "######==####====##========o========do===##=########==#######",
    "######==####=R==##=====R==################========o==#######",
    "######=Y=====o==##==R==RR=################========YRF#######",
    "######==R==q=q==##=======YK===o=========##====q=====F#######",
    "######=======R==##===o===RQ=============##====R======#######",
    "######=========o##==========q==oR==Q==R=##o=d=======F#######",
    "######======Y=d=##=YR==d=======Y=R======###########==#######",
    "######=========o##o=====o===========K===###########F=#######",
    "##################################=====o##ooo=o##====#######",
    "##################################======##=====##====#######",
    "######======K====F=====oo========o======##===R=##K==F#######",
    "######d=========Q===========q===RQ=====F##====o##====#######",
    "######==========R====K=o======K=oF===oo=##=====##F=Yd#######",
    "######==Q======RR=q====Q=======#######==##F==o=##o=Y=#######",
    "######===F=F=====o===o=========#######=K##oo===##=o=o#######",
    "############################============##=R=======Y=#######",
    "############################F=o==R===Q==##F=========K#######",
    "######K===o==o==o=======oo=====R==q==RRRF====o======F#######",
    "######g========Q=R====================o======K==Ro==F#######",
    "######o=====o##=====Ro==##=K==R================R=====#######",
    "######o=o====##==R======##===Y==========##=======R===#######",
    "######=q=R==o##oK======F##===========K==##==o=======o#######",
    "######==R====##g========##########################===#######",
    "######oq=Q==o##====o===o##########################==F#######",
    "######=q=====##=========##d========##===d=========RK=#######",
    "######FR=====##=====o=R=##========F##o=============o=#######",
    "######oq=====##===####==##===YR==R=##=============Y==#######",
    "######=======##=R=####==##=========##==q========Q====#######",
    "######=======##===F==oRK##===Q=====##=====YR===R=====#######",
    "######F=====o##=====R=g=##===============o=R=======R=#######",
    "######==Rq===##o========##=======d==o==o=F==========d#######",
    "######==og==============####################################",
    "######=R================####################################",
    "######========Y===Q=====##=o=o=====F===Fg==o========g#######",
    "######==============o===##o==R=========Y===Y====q====#######",
    "######====################====g=##======R===R=g=====o#######",
    "######o===################===R==##==============RR===#######",
    "######gR=======o========##F=====##=========o=o=======#######",
    "######=RR==o==g===RR====##===YR=##oYR===###########==#######",
    "######o==========F======##==o===##======###########==#######",
    "######=Q==########===Q===Fo===R=##==R=====g==========#######",
    "######====########o=======Q=====##o==Q===Y===========#######",
    "######=======o========o===Q=g====================1===#######",
    "######========R======g=o=============================#######",
    "#######go=Fo=====F=================g==o=============########",
    "############################################################",
    "############################################################",
    "############################################################",
    "############################################################",
    "############################################################",
    "############################################################",
  ],
};
