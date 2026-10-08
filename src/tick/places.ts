/**
 * The places a step can trigger: the rune circles of the Calanais sanctum,
 * and the pads that carry the player between worlds (Etap 3.1d moved this
 * here from main.ts).
 *
 * Each runs every tick and answers to where the player is STANDING, which is
 * why it is the tick's and not a request's: nobody clicks a pad.
 */
import { travelTo, padRefusal, applyMissionPads, type Game } from "../game.ts";
import type { Player } from "../entities/player.ts";
import type { World } from "../world/types.ts";
import { portalCovers } from "../world/collision.ts";
import {
  missionByEcho, missionByGround, groundOpen, loreSeen, markLoreSeen, stageOf, relicTaken, grantsAttunement,
} from "../systems/missions.ts";
import { isAttuned, markAttuned } from "../systems/tower.ts";
import { ELEMENT_LABEL, ELEMENT_COLOR } from "../systems/elements.ts";
import { lang } from "../systems/panelPrefs.ts";
import { t } from "../text/speech.ts";
import { sound, floatSelf } from "../systems/fxEvents.ts";
import { saveNow } from "../systems/persist.ts";
import { tell } from "../intents/actor.ts";
import type { TickControls } from "./controls.ts";

/**
 * The circle whose refusal has already been spoken, as `"tx,ty"`, or null when
 * the player is not standing in one. Purely a UI latch — transient, never
 * saved, and reset by simply walking off.
 */
const refusedCircles = new WeakMap<Player, string | null>();

/**
 * Walking into a rune circle, which is the whole of the Calanais errand.
 *
 * There is no click and no prompt. The player has walked the disc, looked at
 * five coloured wedges, and stepped into one — stepping in IS the answer, and
 * asking "are you sure?" after they crossed an island to do it would be the
 * game second-guessing a decision it just watched them make.
 *
 * ONCE, EVER, and the guard is the mission stage rather than a flag or a
 * clock. `relicTaken` moves `active` to `complete`, and this returns early on
 * anything that is not `active` — so the other four circles go quiet the
 * instant the first one fires, the sanctum door upstairs goes dark behind the
 * player, and the dais to Chronos lights. The same three pads, in the same
 * three states, that a boss kill drives on the other two errands.
 *
 * `isAttuned` is checked as well, and it is not redundant: a character who
 * somehow already holds this element gets the circle refused rather than
 * spending their one errand on a duplicate.
 */
export function checkAttuneCircles(g: Game, world: World, c: TickControls): void {
  const P = g.player;
  const md = missionByEcho(world.key);
  if (P.dead || !md || !grantsAttunement(md) || stageOf(md.id, P.level) !== "active") {
    /* Not standing anywhere that can refuse, so the latch below is cleared on
     * every path out — including leaving the sanctum entirely, which is why
     * the four guards are one branch rather than four early returns. */
    refusedCircles.set(P, null);
    return;
  }
  for (const nd of world.attuneNodes) {
    // The circle owns the 2x2 block it is centred on, so standing anywhere on
    // its artwork counts — being refused by a ring you are visibly inside is
    // the campfire's old collision bug wearing a different hat.
    if (Math.abs(P.tx - nd.tx) > 1 || Math.abs(P.ty - nd.ty) > 1) continue;
    if (isAttuned(nd.el)) {
      /* SAID ONCE PER VISIT, not once per frame.
       *
       * This runs every tick, and `flash` writes a float AND a log line, so
       * standing on a circle you already carry stacked six copies of "ten już
       * w tobie jest" up the left of the screen and buried the chat log under
       * them. The successful path never showed it because `markAttuned` moves
       * the stage off `active` and the guard above then returns forever — so
       * the bug only ever appeared on the refusal, which is exactly what
       * Radek found: "robi tak wtedy kiedy juz ten żywioł mam".
       *
       * Latched on the SQUARE rather than on a timer, because the useful
       * behaviour is per visit: stand still and it is said once, step off and
       * back on — or onto a different circle — and it is said again, which is
       * what a player checking two rings actually wants. */
      const here = `${nd.tx},${nd.ty}`;
      if ((refusedCircles.get(P) ?? null) !== here) {
        refusedCircles.set(P, here);
        tell(g, t("attune.already", lang()), ELEMENT_COLOR[nd.el]);
      }
      return;
    }
    markAttuned(nd.el);
    relicTaken(md.id, P.level);
    applyMissionPads(g.worlds, P.level);
    floatSelf(world, P.x, P.y - 64, ELEMENT_LABEL[nd.el], ELEMENT_COLOR[nd.el]);
    sound("chime");
    saveNow(g);
    c.notice({ kind: "sage", key: "sage.attuned.calanais" });
    return;
  }
  // Off every circle: the next one stepped into may speak again.
  refusedCircles.set(P, null);
}

/**
 * Stepping onto a pad: the jump to where it leads, or — on a dark pad — why
 * it will not carry you. Held while a box is up on the player's screen.
 */
export function checkPortals(g: Game, c: TickControls): void {
  const P = g.player;
  /* A box on screen holds the pad. The player is standing on it, the jump has
   * not happened, and the moment the box closes this runs again and takes it —
   * so the chronicle below needs no callback and no "already travelling" flag.
   * It simply refuses to move anyone who is reading. */
  if (c.reading()) return;
  if (P.tpCd > 0) return;
  for (const pt of g.current.portals) {
    if (portalCovers(pt, P.x, P.y)) {
      if (pt.inactive) {
        // a dark pad: hum, and say WHY it is dark — see `padRefusal`
        const why = padRefusal(g.current.key, pt.dest, P.level);
        tell(g, t(why.key, lang(), why.vars), "#b9a6d8");
        P.tpCd = 1.6; // don't spam the flash while standing on the pad
        return;
      }
      /* THE CHRONICLE. Once per character, on the pad that opens a mission's
       * hunting ground, BEFORE the jump rather than after it.
       *
       * Before, because this pad is in the sage's cellar and the cellar is a
       * safe tile. The far side is not: the arrival pad on Liddesdale has
       * smugglers inside the first fifth of the island, and a modal box that
       * blocks input while one of them walks over is a page of folklore read
       * at the cost of the health bar. The story is told where nothing can
       * interrupt it, and the valley is entered with it already read. */
      const m = missionByGround(pt.dest);
      if (m && groundOpen(pt.dest, P.level) && !loreSeen(m.id)) {
        markLoreSeen(m.id);
        saveNow(g);
        c.notice({ kind: "lore", titleKey: `lore.title.${m.id}`, bodyKey: `lore.${m.id}` });
        return;
      }
      /* THE SAGE'S WORD IN THE SANCTUM. Same trick as the chronicle above and
       * for the same reason: said on THIS side of the jump, where the player
       * is standing on a mission pad and nothing can walk over while they
       * read. The difference is that it is not once-per-character — the
       * sanctum has no ladder back up, so a descent happens once per errand
       * anyway, and gating it on a flag would only mean a player who logged
       * out on the stair came back to a room of five permanent choices and no
       * instructions.
       *
       * Gated on the stage rather than on the destination alone: once a circle
       * has been walked into the errand is `complete`, the door is dark, and
       * this cannot be reached at all. */
      const echoM = missionByEcho(pt.dest);
      if (echoM && grantsAttunement(echoM) && stageOf(echoM.id, P.level) === "active") {
        travelTo(g, pt.dest);
        c.notice({ kind: "lore", titleKey: `lore.title.${echoM.id}`, bodyKey: `sage.descend.${echoM.id}` });
        return;
      }
      travelTo(g, pt.dest);
      return;
    }
  }
}
