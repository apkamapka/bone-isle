/**
 * Gorak's Hall — the cut under the Orc Isle, and the end of the Time Sage's
 * sixth mission.
 *
 * Traced from `orkiboss-1.tmx` (40x100) and drawn from
 * `public/gorak-terrain.png`, the same file's image export. Collision by
 * exclusion, the usual rule: `podloga` is the floor and all three rock layers
 * seal their squares — including the one whose name is spelled with a Polish
 * ł and the one that is not, which is why `collision` is told the floor's name
 * rather than the walls'.
 *
 * GENERATED. Do not hand-edit this file — `tools/gen_orc_maps.py` writes it
 * whole from the export, and it will do so again.
 *
 * IT IS ONE ROOM, AND THAT IS THE POINT. Twenty-four squares wide and
 * eighty-three long, walled in rock on all four sides, with nothing in it but
 * what is put there. Seventy-five tiles from the ladder to the man at the far
 * end.
 *
 * SO IT IS THE LABYRINTH'S OPPOSITE, deliberately. Down there the walk is the
 * encounter and nothing else is alive in four hundred tiles; here you can see
 * the whole length of the room from the ladder, and what makes it long is that
 * his army is standing in it. You cannot get lost. You can only get tired.
 *
 * WHAT IS IN THE WAY. Twenty-two posts, sorted by walking distance from Gorak
 * and banded so the eight berserkers hold the far third and fourteen warriors
 * the near two — the hall gets harder in exactly the direction you are
 * walking. Above ground the errand allows ONE berserker, because the tribes
 * are still arriving; down here they are what he has already collected, and
 * that contrast is the whole errand in two maps.
 *
 * NINE TILES BETWEEN POSTS MATTERS MORE HERE than anywhere else in the game.
 * Every other floor has corridor walls to break line of sight; this one has
 * none, so spacing is the only thing keeping a pull to one creature. Gorak
 * carries a wider clearance than his ranks do, so the last berserker cannot be
 * fought inside his aggro.
 *
 * NO TREES, which is Radek's rule and the obvious one — nothing grows in a
 * hall cut out of rock. Stone does both jobs instead, because he asked for
 * both: `R` nodes that can actually be worked and boulders that are only ever
 * scenery. It is the first echo in the game to carry mineable stone, and it
 * earns it, being one long walk with nowhere on it to restock.
 *
 * AND IT IS LIT ALONG ITS WHOLE LENGTH. Eight fires lit Gorak's own end and
 * left seventy tiles of the approach dark, which read as an empty corridor
 * rather than as somewhere an army is camped; there are twenty-eight now, on a
 * floor high enough that the walk has something burning on it the whole way
 * down. A room you can see the far end of should look occupied all the way to
 * it.
 *
 * THE BONE RUNS BACKWARDS FROM THE CAMPS. Totems and fires thicken toward
 * Gorak, because that is where somebody lives; the bone piles thicken toward
 * the LADDER, because that is what the army has already been fed. The two
 * gradients crossing is what makes the room read as occupied rather than
 * decorated.
 *
 * THE HOARD IS A CHEST, NOT A POCKET, exactly as in the howe, the bower and
 * the labyrinth: he respawns and a chest does not, so routing the payday
 * through his loot table would turn a boss into a press. It sits in open floor
 * with walkable ground on all four sides.
 *
 * THE WAY HOME is dark until he is down, then lit where he fell, so the tusk
 * goes straight to Chronos' table without walking the hall a second time
 * through everything that has respawned in it. `applyMissionPads` owns it: a
 * pad out of an echo to the cellar is the relic road, and it opens on
 * `complete` and on nothing else.
 *
 *   U ladder back up to the isle   W the way home, with the tusk
 *   X Gorak   $ his hoard   R stone   Q q boulder   Y totem   N tent
 *   F campfire   o bones   # rock wall   = hall floor
 *   creatures: e orcWarrior   k orcBerserker
 */
import type { HandmadeSpec } from "./handmade.ts";

export const GORAK_SPEC: HandmadeSpec = {
  key: "gorak",
  name: "Gorak's Hall",
  safe: false,
  portals: {
    U: { dest: "orcIsle", label: "back up to the Orc Isle", style: "ladderUp" },
    W: {
      dest: "cellar", label: "back to Chronos, with the tusk",
      inactive: true,
    },
  },
  solids: "x",
  scenery: { N: "tent", Y: "skullPole", Q: "boulderA", q: "boulderB" },
  monsters: {
    e: "orcWarrior",
    k: "orcBerserker",
    X: "gorak",
  },
  rows: [
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxe=====o============e====xxxxxxxx",
    "xxxxxxxx===Q====================xxxxxxxx",
    "xxxxxxxx======================o=xxxxxxxx",
    "xxxxxxxx==oo=======U============xxxxxxxx",
    "xxxxxxxx=================oo=====xxxxxxxx",
    "xxxxxxxx========================xxxxxxxx",
    "xxxxxxxx==RQ================R=F=xxxxxxxx",
    "xxxxxxxx===================R====xxxxxxxx",
    "xxxxxxxx======================o=xxxxxxxx",
    "xxxxxxxx====e=================o=xxxxxxxx",
    "xxxxxxxx========R======e=====o==xxxxxxxx",
    "xxxxxxxxR==========R======R=====xxxxxxxx",
    "xxxxxxxx===o===============o====xxxxxxxx",
    "xxxxxxxx=R============o=========xxxxxxxx",
    "xxxxxxxx====o===oo==============xxxxxxxx",
    "xxxxxxxx=======================Rxxxxxxxx",
    "xxxxxxxx====R=========Q=R=======xxxxxxxx",
    "xxxxxxxx=========e==o==========oxxxxxxxx",
    "xxxxxxxxe============o======e===xxxxxxxx",
    "xxxxxxxx===o===========R========xxxxxxxx",
    "xxxxxxxx========================xxxxxxxx",
    "xxxxxxxx======o=====o==========oxxxxxxxx",
    "xxxxxxxx==========Fo======oo====xxxxxxxx",
    "xxxxxxxx==R=====================xxxxxxxx",
    "xxxxxxxxo=================R=====xxxxxxxx",
    "xxxxxxxx===========o==e======R=oxxxxxxxx",
    "xxxxxxxx=====e===o=============oxxxxxxxx",
    "xxxxxxxx===================o===Fxxxxxxxx",
    "xxxxxxxxo=========q=============xxxxxxxx",
    "xxxxxxxx===F============o===RR==xxxxxxxx",
    "xxxxxxxx=======q========o=======xxxxxxxx",
    "xxxxxxxx====R===================xxxxxxxx",
    "xxxxxxxx======N=================xxxxxxxx",
    "xxxxxxxx=============o=====e====xxxxxxxx",
    "xxxxxxxxe=========e=============xxxxxxxx",
    "xxxxxxxx===R==========q=========xxxxxxxx",
    "xxxxxxxx==============o========oxxxxxxxx",
    "xxxxxxxx================o=======xxxxxxxx",
    "xxxxxxxx======R================Rxxxxxxxx",
    "xxxxxxxx===o=====q=N====RQ======xxxxxxxx",
    "xxxxxxxx========================xxxxxxxx",
    "xxxxxxxx========RQ==F===========xxxxxxxx",
    "xxxxxxxx=====e=========e=====R==xxxxxxxx",
    "xxxxxxxxq=========R========o====xxxxxxxx",
    "xxxxxxxx========================xxxxxxxx",
    "xxxxxxxx==========Y=============xxxxxxxx",
    "xxxxxxxx====o======Q==F=====Q=q=xxxxxxxx",
    "xxxxxxxx========================xxxxxxxx",
    "xxxxxxxx=====N========q=========xxxxxxxx",
    "xxxxxxxx====Y=========o=========xxxxxxxx",
    "xxxxxxxxk=========k===F=====k===xxxxxxxx",
    "xxxxxxxx====Q==========q========xxxxxxxx",
    "xxxxxxxx======F=================xxxxxxxx",
    "xxxxxxxx======F=============F===xxxxxxxx",
    "xxxxxxxx===========q============xxxxxxxx",
    "xxxxxxxx=======F=N==============xxxxxxxx",
    "xxxxxxxx========Y===============xxxxxxxx",
    "xxxxxxxx===========Q===========Rxxxxxxxx",
    "xxxxxxxx=====k=========k========xxxxxxxx",
    "xxxxxxxx========Y===Y=====Q=Y==Fxxxxxxxx",
    "xxxxxxxx==========YR============xxxxxxxx",
    "xxxxxxxx===============N=F=R====xxxxxxxx",
    "xxxxxxxx=Q==Y==o==Y=============xxxxxxxx",
    "xxxxxxxxR=======Q==q=N===Y======xxxxxxxx",
    "xxxxxxxx====FR==================xxxxxxxx",
    "xxxxxxxx======F==============k==xxxxxxxx",
    "xxxxxxxx=F============F=========xxxxxxxx",
    "xxxxxxxxo=Y===R====k====Fq======xxxxxxxx",
    "xxxxxxxx=======F=======F========xxxxxxxx",
    "xxxxxxxx================q===F=Y=xxxxxxxx",
    "xxxxxxxx==k=====================xxxxxxxx",
    "xxxxxxxx============N=Q==q======xxxxxxxx",
    "xxxxxxxx=====YN================Yxxxxxxxx",
    "xxxxxxxx===========R=======R====xxxxxxxx",
    "xxxxxxxx================FY====F=xxxxxxxx",
    "xxxxxxxx=====================R==xxxxxxxx",
    "xxxxxxxx========================xxxxxxxx",
    "xxxxxxxx===================Q====xxxxxxxx",
    "xxxxxxxx======$====X=====q==FQ=Fxxxxxxxx",
    "xxxxxxxx================YF=Y==F=xxxxxxxx",
    "xxxxxxxx======W=================xxxxxxxx",
    "xxxxxxxx=====================F==xxxxxxxx",
    "xxxxxxxxQ==================Y====xxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  ],
};
