/**
 * Chronos's errands, the one-time treasure chests, and the testing resets
 * (Etap 3.1c moved this here from main.ts).
 *
 * WHAT HE SAYS IS DECIDED HERE; HOW IT LOOKS IS NOT
 * ------------------------------------------------
 * A conversation with the sage used to be written as a chain of dialogue
 * boxes with callbacks in them. A server cannot open a dialogue box, so the
 * requests here change the errand's state and answer with a `SageSpeech`:
 * which speech he gives, with which words filled in, and which answers it
 * offers. The client puts that in his box and, when an answer is pressed,
 * makes the request it names. The server will answer the same way.
 */
import { CHEST_PRIZES, applyMissionPads, type Game } from "../game.ts";
import type { ItemKind, ItemStack } from "../items.ts";
import { ITEMS, addItem, itemWeight, countAcross, removeAcross } from "../items.ts";
import { totalExpFor, expNeeded } from "../config.ts";
import type { Structure, WorldKey } from "../world/types.ts";
import { freeCap, refreshDerived } from "../entities/player.ts";
import {
  MISSIONS, stageOf, setStage, offeredMission, currentMission, missionHandedIn, relicLost,
  resetMissions, resetMission, missionById, grantsAttunement, type MissionDef,
} from "../systems/missions.ts";
import { clearAttuned } from "../systems/tower.ts";
import { grantExp } from "../systems/combat.ts";
import { saveNow } from "../systems/persist.ts";
import { lang } from "../systems/panelPrefs.ts";
import { t } from "../text/speech.ts";
import { sound, tone, logLine } from "../systems/fxEvents.ts";
import { tell, structInReach } from "./actor.ts";
import { dropToGround } from "./ground.ts";

/* ---- what the sage says ------------------------------------------------ */

/** One of the answers under a speech, and the request it stands for. */
export type SageChoice =
  | { key: string; does: "leave" }
  | { key: string; does: "accept"; mission: string }
  | { key: string; does: "decline"; mission: string };

/** One speech: a text key in speech.ts, the words that fill it, its answers. */
export interface SageSpeech {
  key: string;
  vars?: Record<string, string | number>;
  /** None: the box simply closes on a tap. */
  choices?: SageChoice[];
  /** Talk to him again as soon as this speech is closed. */
  thenTalk?: boolean;
}

/**
 * The way OUT of a conversation, on every speech that ends one.
 *
 * A speech with no answers already closes on a tap, so this button changes
 * nothing mechanically — and that is the point. Without it the last page of a
 * conversation is a wall of text with a blinking arrow, and the player has to
 * guess that tapping the world dismisses it. A labelled door is not a feature,
 * it is the absence of a small puzzle nobody asked for.
 */
const LEAVE: SageChoice = { key: "sage.choice.notYet", does: "leave" };

/**
 * Chronos, downstairs, in front of the pads.
 *
 * One line per click, because that is what `flash` is — a line, not a dialogue
 * box. So the conversation is a state machine rather than a script: what he
 * says is a pure function of where the chain stands, and clicking him again
 * repeats the current state rather than advancing past it. The one click that
 * DOES advance is the handover, and the one that pays is the hand-in.
 *
 * The lost-relic branch is the reconcile point for `relicLost`. Nothing else
 * watches the pack — a cap can leave it by being dropped on death, sold, or
 * traded away, and chasing every one of those from the inventory code would
 * mean four hooks that must all agree. Here there is one, at the only place
 * the answer matters: the man who wants the cap notices you do not have it,
 * and the door you need opens again.
 */
export function talkToSage(g: Game): SageSpeech {
  const P = g.player;
  const cur = currentMission(P.level);
  if (cur) {
    const stage = stageOf(cur.id, P.level);
    if (stage === "complete") {
      // A bossless errand has nothing to hand over: reaching `complete` at all
      // means the circle was walked into and the element is already written.
      // So the hand-in is unconditional for it, and the empty-hands branch
      // below — the whole `relicLost` reconciliation — is skipped, because a
      // state cannot go missing on the walk home.
      if (!cur.relic || countAcross([P.bag], cur.relic) > 0) {
        if (cur.relic) removeAcross([P.bag], cur.relic, 1);
        missionHandedIn(cur.id, P.level);
        grantExp(g.current, P, cur.rewardExp);
        sound("reward");
        saveNow(g);
        logLine(`${t(`mission.title.${cur.id}`, lang())}: ${cur.rewardExp} xp`, "#b9a6d8");
        /* He thanks you and then, without being asked again, moves on to
         * whatever he has next — the following errand if the chain has one and
         * the player is high enough for it, the level to come back at if not.
         *
         * Handing in used to END the conversation, which meant the player was
         * shown the reward speech and then a single button offering to wipe
         * the chain, and had to walk away and click him a second time to find
         * out there was more. Running `talkToSage` again is safe and finite:
         * the mission is `closed` by now, so this pass falls through to the
         * offer or to the level line and stops there. */
        return { key: `sage.handIn.${cur.id}`, thenTalk: true };
      }
      /* He wanted it and you have not got it. The echo reopens — and the world
       * behind it is swept first.
       *
       * THIS SWEEP IS WHAT LETS THE RELIC SIT ON THE BODY. Etap 45 moved it
       * off the pack and onto the corpse, which reopens the old duplication
       * route at exactly one seam: a helm still lying in a body Kárr left
       * behind, plus a door the sage has just unlocked, is two helms one walk
       * apart. Nothing else can produce a second one — `wantsRelic` refuses
       * while the stage is `complete`, `boundRelic` refuses to let a held one
       * out of the pack, and a body that rots takes what is in it.
       *
       * It is also, word for word, what he says while he does it: Kárr pewnie
       * już go sobie założył. He has put it back on. The line was written
       * before the sweep existed and turned out to describe it exactly. */
      /* The sweep runs over EVERY world, and in depth.
       *
       * It used to look in one place and at one level: `game.worlds[cur.echo]`,
       * top-level corpse slots and top-level ground stacks. Both bounds were
       * wrong for the same reason — the relic does not stay where the mission
       * left it. A player who dies on the walk home leaves a body on the
       * SURFACE with the cap in it, and a player who tucked it inside a spare
       * backpack leaves it one slot deeper than the loop could see. Either way
       * the sweep found nothing, reopened the door, and there were two.
       *
       * Reaching into every world is cheap and it is honest: the rule is "one
       * of these exists at a time", and a rule that only holds on one map is
       * not the rule. */
      if (cur.relic) sweepRelic(g, cur.relic);
      relicLost(cur.id, P.level);
      applyMissionPads(g.worlds, P.level);
      saveNow(g);
      return { key: `sage.empty.${cur.id}`, choices: [LEAVE] };
    }
    return { key: `sage.remind.${cur.id}`, choices: [LEAVE] };
  }

  const next = offeredMission(P.level);
  if (next) {
    /* Two answers, and the errand is taken by the FIRST of them rather than by
     * the act of talking. Walking up to him used to be consent — the stage
     * moved to `active` before he had said what the job was — which is a poor
     * bargain to strike on the player's behalf and made the offer speech read
     * as a briefing for something already agreed. */
    return { key: `sage.offer.${next.id}`, choices: [
      { key: "sage.choice.what", does: "accept", mission: next.id },
      { key: "sage.choice.notYet", does: "decline", mission: next.id },
    ] };
  }

  // Nothing to offer: either every link is closed, or the next one is above the
  // player's level. Say which, because "not yet" with no reason was the whole
  // of what he used to say and it told nobody anything.
  const nextLocked = MISSIONS.find((m) => stageOf(m.id, P.level) === "locked");
  if (nextLocked) return { key: "sage.locked", choices: [LEAVE], vars: { lv: nextLocked.reqLevel } };
  return { key: "sage.cold", choices: [LEAVE] };
}

/** Take the errand he has just offered. Anything else is refused: an errand
 *  is taken from his offer, not named out of thin air. */
export function acceptMission(g: Game, id: string): SageSpeech | null {
  const m = offeredMission(g.player.level);
  if (!m || m.id !== id) return null;
  setStage(m.id, "active");
  tone(520, 0.22, "sine", 0.06, 300);
  // The pad that lights is usually on a map the player is not standing on, so
  // the sweep runs over every world rather than the current one.
  applyMissionPads(g.worlds, g.player.level);
  saveNow(g);
  // The box holds the prose; the log holds the record. One line, the objective.
  logLine(t(`mission.goal.${m.id}`, lang()), "#b9a6d8");
  return { key: `sage.accept.${m.id}` };
}

/** "Not yet": what he says to an offer turned down. Nothing changes. */
export function declineMission(id: string): SageSpeech {
  return { key: `sage.decline.${id}` };
}

/**
 * Erase every copy of `kind` lying anywhere in the world, at any depth.
 *
 * The reconcile half of the relic rule. `carriesBound` stops one leaving the
 * player; this cleans up the copies that got out before the gates were
 * complete — an old save, a body from a death on the walk home, a pack the
 * player dropped in a build where dropping was allowed.
 *
 * Bodies and loose stacks only. Storage Chests are deliberately NOT swept: a
 * relic in a chest means the character genuinely put it there under some
 * earlier build, and taking it out of a chest while the player watches reads
 * as theft rather than as bookkeeping. It cannot be carried out to the sage
 * either, so the sage will simply keep asking — which is the honest state.
 */
export function sweepRelic(g: Game, kind: ItemKind): void {
  const scrub = (slots: (ItemStack | null)[], depth = 0): void => {
    if (depth > 8) return;
    for (let i = 0; i < slots.length; i++) {
      const st = slots[i];
      if (!st) continue;
      if (st.kind === kind) { slots[i] = null; continue; }
      if (st.items) scrub(st.items, depth + 1);
    }
  };
  for (const key of Object.keys(g.worlds) as WorldKey[]) {
    const w = g.worlds[key];
    for (const c of w.corpses) scrub(c.items);
    for (let i = w.ground.length - 1; i >= 0; i--) {
      const gi = w.ground[i];
      if (gi.kind === kind) { w.ground.splice(i, 1); continue; }
      if (gi.items) scrub(gi.items);
    }
  }
}

/* ---- the chain, for testing ------------------------------------------- */

/**
 * The chain and where this character stands in it, written to the log.
 *
 * Also the help text for `/replay`, and deliberately the same lines for both:
 * the ids are what the command takes and the stages are what it changes, so a
 * player who can see one can work out the other. The usage line goes LAST
 * because the overlay keeps the newest six lines and drops the rest, so the
 * one line that has to survive a long catalogue is the one printed last.
 */
export function missionReport(g: Game): void {
  const P = g.player;
  for (const m of MISSIONS) {
    const st = stageOf(m.id, P.level);
    logLine(`${m.id} · lv ${m.reqLevel} · ${st} — ${t(`mission.title.${m.id}`, lang())}`, "#b9a6d8");
  }
  logLine("/replay <id> re-opens one errand · /replay all re-opens the chain", "#b9a6d8");
}

/** `/replay <something>`. An id, or `all`, or a typo — and a typo must not be
 *  read as "all", which is why the fall-through lists instead of guessing. */
export function replayCommand(g: Game, arg: string): void {
  if (arg === "all") { replayMissions(g); return; }
  const m = missionById(arg);
  if (!m) {
    logLine(`no errand called "${arg}"`, "#d96a5a");
    missionReport(g);
    return;
  }
  replayMissions(g, m);
}

/**
 * TEMP-ETAP43 — put the mission chain back to the start without paying for it.
 *
 * `forgetEverything` with the two mints removed; see the note on its `/replay`
 * branch in `sendChat` for why that difference is what lets this one ship.
 *
 * The exp claw-back reuses the death penalty's own arithmetic rather than
 * subtracting from `p.exp`: totals are what the curve is defined on, and
 * taking 2400 off a character sitting on 300 into a level has to walk him
 * backwards down it rather than leave him on a negative bar.
 */
/**
 * Put one errand — or the whole chain — back to where it started.
 *
 * `only` is the Etap 44 half. The whole-chain reset was the only thing here
 * and it made re-testing the SECOND mission cost the first one as well: the
 * chain gates on the previous link being `closed`, so wiping the lot meant
 * walking Liddesdale again before Haramsey would open. That is a twenty-minute
 * toll on a one-minute fix, which is the sort of friction that stops a thing
 * from being re-tested at all.
 *
 * Everything that made the full reset safe to ship in front of players is
 * unchanged and applies per mission: no chest is re-opened, and the reward for
 * anything actually being un-closed is taken back.
 */
export function replayMissions(g: Game, only?: MissionDef): void {
  const P = g.player;
  const list = only ? [only] : MISSIONS;
  let owed = 0;
  for (const m of list) if (stageOf(m.id, P.level) === "closed") owed += m.rewardExp;
  for (const m of list) {
    resetMission(m.id);
    // A bossless errand carries nothing back, so there is nothing to strip.
    if (m.relic) {
      const held = countAcross([P.bag], m.relic);
      if (held > 0) removeAcross([P.bag], m.relic, held);
    }
    // …but an errand that pays in STATE has to give the state back, or
    // replaying it is a free element every time. The one-time-chest flag is
    // not the guard here — the circles are not chests and never touched it.
    if (grantsAttunement(m)) clearAttuned();
  }
  if (owed > 0) {
    const total = Math.max(0, totalExpFor(P.level) + P.exp - owed);
    let lv = P.level;
    while (lv > 1 && total < totalExpFor(lv)) lv--;
    P.level = lv;
    P.exp = total - totalExpFor(lv);
    P.expNext = expNeeded(lv);
    refreshDerived(P);
    if (P.hp > P.maxhp) P.hp = P.maxhp;
  }
  applyMissionPads(g.worlds, P.level);
  saveNow(g);
  const what = only ? t(`mission.title.${only.id}`, lang()) : "his errands";
  tell(g, owed > 0
    ? `Chronos takes back ${what} — and the ${owed} xp he paid for them`
    : `Chronos takes back ${what}`, "#b9a6d8");
  // …and say where that leaves the chain, because the answer is not always the
  // obvious one: rolling a later link back can leave an earlier one closed, and
  // rolling an earlier one back does NOT re-lock the links above it.
  missionReport(g);
}

/**
 * TEMP-ETAP42 — the testing reset, reached by typing `/forget` into the chat.
 *
 * The mission chain is one-shot per character by design, which makes the whole
 * of it untestable a second time without rolling a new one. This puts the
 * character back to "has never met him": stages and chronicles wiped, the
 * relic taken out of the pack so a mission that no longer exists cannot leave
 * its prize behind, and the lair's one-time chest un-opened so the pad, the
 * boss, the purse and the way home can all be walked again.
 *
 * The chest is the part that pays out real coin every run, so a character used
 * for this is not a character to read gold balance off — and that same chest is
 * why the branch in `sendChat` is gated on `import.meta.env.DEV`. Thirty
 * platinum, given out again on every `/forget`, is a mint on a shared shard.
 *
 * Grep TEMP-ETAP42 to pull the whole thing — this function, its branch in
 * `sendChat`, and its string in speech.ts.
 */
export function forgetEverything(g: Game): void {
  const P = g.player;
  resetMissions();
  for (const m of MISSIONS) {
    if (m.relic) {
      const held = countAcross([P.bag], m.relic);
      if (held > 0) removeAcross([P.bag], m.relic, held);
    }
    if (grantsAttunement(m)) clearAttuned();
  }
  g.opened = g.opened.filter((id) => !MISSIONS.some((m) => id.startsWith(`treasure:${m.echo}:`)));
  applyMissionPads(g.worlds, P.level);
  saveNow(g);
  tell(g, "Chronos has forgotten you", "#b9a6d8");
}

/* ---- the one-time treasure chests ------------------------------------- */

/**
 * One-time treasure chests, Tibia-style: the first open yields the prize with
 * the classic "You have found a ...", every later open is just an empty chest.
 * Opened IDs persist in the save. If the reward doesn't fit the bag (weight or
 * slots), it drops at the player's feet instead of being lost.
 */
export function openTreasure(g: Game, s: Structure): void {
  const P = g.player;
  /* Only a chest that is really there, and within arm's reach of it — the
   * client walks the player up first, so in a game without a server this
   * never refuses; a request is no proof of where its player stands. */
  if (s.key !== "treasure" || !g.current.structures.includes(s) || !structInReach(g, s)) return;
  const id = `treasure:${g.current.key}:${s.tx},${s.ty}`;
  if (g.opened.includes(id)) { tell(g, "the chest is empty", "#bdb59c"); return; }
  g.opened.push(id);
  // World-keyed prizes. A chest may hold more than one piece — Orc Deep -1
  // buries both plate pieces together — and an entry may carry a count, which
  // is how the minotaur hoard pays ten platinum without reading as ten finds.
  // Anything unmapped falls back to the classic blade, so old saves behave
  // identically.
  const prizes = CHEST_PRIZES[g.current.key] ?? (["marrowBlade"] as const);
  const parts: string[] = [];
  for (const prize of prizes) {
    const kind: ItemKind = Array.isArray(prize) ? prize[0] : (prize as ItemKind);
    const n: number = Array.isArray(prize) ? prize[1] : 1;
    // A stack that will not fit is dropped WHOLE rather than split across the
    // bag and the floor: two half-piles of platinum is worse to pick up than
    // one whole one, and `addItem` already reports the remainder it refused.
    const fits = freeCap(P) >= itemWeight(kind, n) && addItem(P.bag, kind, n) === 0;
    if (!fits) dropToGround(g, kind, n);
    parts.push(n > 1 ? `${n} ${ITEMS[kind].name}` : ITEMS[kind].name);
  }
  tell(g, `You have found ${parts.join(" and ")}.`, "#ffe9a8");
  sound("reward");
  saveNow(g);
}
