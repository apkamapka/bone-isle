/**
 * The Time Sage's missions: the chain of one-time errands into history that
 * runs alongside the repeatable board tasks.
 *
 * TWO LINKS ARE IN. The machinery landed empty and ahead of the catalogue on
 * purpose, so the save format, the pad wiring and the tests settled once
 * instead of once per mission; the redcap was poured into it in Etap 41-42 and
 * Kárr the Old in Etap 43. Every function below is still correct against an
 * EMPTY `MISSIONS` as well as a full one, which is what lets a mission be
 * added or retired without touching any of them — and Etap 43 proved it: the
 * ten-mission ladder that had been designed above the redcap was scrapped
 * wholesale when the creature balance changed, and not one function here
 * needed an edit for it.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT `quests.ts`
 *
 * A quest is a five-item tutorial: kill some snakes, gather some stone, claim
 * a reward. A mission is a level gate, a prerequisite, an NPC who hands it
 * over, a hunting ground that opens permanently, a one-time instance that
 * closes permanently, a page of story, and a relic that has to be carried
 * back. Bending `Quest` to carry all that would mean every future migration
 * touched both systems and the quest panel rendered two different animals.
 * ---------------------------------------------------------------------------
 *
 * THE TWO GATES
 *
 * A mission opens on the player's LEVEL, and it becomes takeable when the
 * PREVIOUS one has been handed in. These are deliberately separate: outlevelling
 * the chain must never skip a link, and finishing a link must never hand you
 * one you are too green for.
 *
 * THE FIVE STAGES
 *
 *   locked     nothing yet — too low a level, or the link before is open
 *   available  the sage will talk about it
 *   active     the pad is lit; the hunting ground is yours FROM NOW ON, the
 *              echo behind it is enterable
 *   complete   the echo's boss is down and the relic is in your pack
 *   closed     the relic is handed in, the reward is paid, the echo is dark
 *              for good. The hunting ground stays open forever.
 *
 * Only `closed` retires the echo — NOT killing the boss. That one choice is
 * what stops a lost relic from bricking a character: die on the way back, and
 * the door you need is still standing open. It costs a repeat run, which is a
 * real loss, and not the character.
 *
 * ONE RELIC PER HEAD. That is the rule, and it is worth being exact about how
 * it is held, because the open door above is also the way to abuse it: reopen
 * the echo with a relic hidden somewhere the sage cannot see, and the same
 * mercy that saves a careless player becomes a printing press for a patient
 * one. Three things close it, and all three are needed:
 *
 *   1. `wantsRelic` asks how many the character is HOLDING, not only what the
 *      stage says. A character with a cap is never handed a second.
 *   2. the kill puts the relic straight into the pack rather than into the
 *      corpse (`killMonster`), so there is no moment where the mission reads
 *      `complete` and the cap is lying on the floor of a room the player can
 *      walk back into.
 *   3. `boundRelic` refuses to let it out of the pack at all while the sage
 *      still wants it — not to the ground, not into a chest, not into a body.
 *
 * DEATH IS THE ONE THING IT DOES NOT STOP, and this comment used to claim the
 * opposite. `applyDeathPenalty` drops the whole backpack into your body from
 * DEATH_PENALTY_LEVEL up, contents and all, and every mission in the catalogue
 * is gated well above that level — so a bound relic dying with its carrier is
 * the NORMAL case, not a corner. It is safe: you can loot your own body, and
 * if you do not, `relicLost` below is what Chronos runs on empty hands and the
 * echo reopens. It is also not an exploit, because the road it opens is the
 * one that costs a whole second run. Left as it is on purpose — dropping your
 * pack when you die is the game — but written down truthfully, because a
 * comment that lies is worse than no comment, and this one lied for two
 * etaps.
 *
 * Together those mean `complete` and "the cap is in the pack" are the same
 * statement, which is what makes the count honest. `relicLost` survives as the
 * reconcile point but is now a road almost nothing travels — see its comment.
 */
import type { ItemKind, ItemStack } from "../items.ts";
import type { WorldKey } from "../world/types.ts";
import { active } from "./playerState.ts";

/** Where a mission sits in the chain, for one character. */
export type MissionStage = "locked" | "available" | "active" | "complete" | "closed";

export interface MissionDef {
  /** Stable id. Persisted, so it never changes once a mission has shipped. */
  id: string;
  /** Shown by the sage and in the log. */
  title: string;
  /** The level that lights this mission's pad. */
  reqLevel: number;
  /**
   * The mission that must be `closed` first. Absent on the first link only.
   * Checked rather than assumed from array order, so the chain can be
   * reordered or a mission slotted between two others without a migration.
   */
  after?: string;
  /** The hunting ground the pad opens onto — permanent once `active`. */
  ground: WorldKey;
  /** The one-time instance reached from the hunting ground. */
  echo: WorldKey;
  /**
   * What the echo's boss leaves behind, and what the sage takes back.
   *
   * OPTIONAL, and the absence is a real shape rather than an oversight. An
   * errand whose reward is a THING has to survive that thing going missing,
   * which is why `relicLost` exists and why the relic is bound while the
   * errand is live. An errand whose reward is a STATE - the Calanais circles
   * write straight into `attuned` - cannot lose anything on the way home, so
   * there is nothing for those guards to guard. `wantsRelic` is only ever
   * asked from the boss-kill path, which a bossless errand never walks;
   * `boundRelic` compares `undefined === kind` and is false for everything;
   * and the sage's empty-hands branch checks for a relic before it looks.
   */
  relic?: ItemKind;
  /** Paid when the relic reaches the sage's table. Experience only: the coin
   *  is already down in the echo, in a chest the player has to fight for, and
   *  paying twice for one errand would make the ladder's own purses look silly. */
  rewardExp: number;
}

/**
 * The text keys a mission owns, derived from its id rather than listed on it.
 *
 * Convention over configuration, so that adding the ninth mission is one entry
 * in `MISSIONS` and eight entries in `speech.ts` — and so that a missing
 * translation is a test failure rather than a blank box, because the smoke
 * suite can enumerate exactly which keys must exist for every id in the
 * catalogue without the catalogue having to name them.
 */
export function missionKeys(id: string): readonly string[] {
  return [
    `mission.title.${id}`, `mission.goal.${id}`,
    `sage.offer.${id}`, `sage.accept.${id}`, `sage.decline.${id}`,
    `sage.remind.${id}`, `sage.handIn.${id}`, `sage.empty.${id}`,
    `lore.title.${id}`, `lore.${id}`,
  ];
}

/**
 * The chain, in the order the sage offers it.
 *
 * CALANAIS IS FIRST AND THE REDCAP IS SECOND, which reverses what shipped.
 * Inserting a link in FRONT of one that is already in people's saves is safe,
 * and the reason is `stageOf`: a stored stage is returned before either gate
 * is consulted, so a character who has already closed the redcap keeps him
 * closed no matter what is now written in his `after`. The one visible effect
 * on an existing save is on a character who is past level 8 and has NOT yet
 * taken the redcap — they are offered Calanais first. That is the intended
 * order, not a regression.
 *
 * WHY IN FRONT AND NOT BEHIND. Calanais hands out the element, and the redcap
 * is the first creature in the game whose resistances make the choice mean
 * something. Putting the gift after the fight it pays off in would be telling
 * the joke and then the setup.
 */
export const MISSIONS: readonly MissionDef[] = [
  {
    // The gift-errand. No `after`, level 8, and NO RELIC — the first entry in
    // the catalogue to leave `relic` off, and the reason it became optional.
    //
    // Nothing is carried back from the sanctum because nothing is picked up
    // there: walking into a circle writes the element into `attuned` on the
    // spot. That also closes the only door a mule could have used. An element
    // that is never an item cannot be dropped on death, looted off a corpse,
    // put in a chest or traded — so a player cannot run five throwaway
    // characters through this errand and funnel five elements onto one main.
    // The absorb IS the anti-mule design; the one-per-character scarcity is a
    // separate matter, and deliberately NOT enforced anywhere in code. It
    // falls out of the errand being one-time, which means a second source at
    // some later level is one catalogue entry and no migration at all.
    id: "calanais",
    title: "The Circles of Calanais",
    reqLevel: 8,
    ground: "calanais",
    echo: "tursachan",
    // Level 8 needs 2400 to advance, so this is a shade over a fifth of a
    // level — lighter than the cap, because the errand's real payment is the
    // element and the island stays open afterwards.
    rewardExp: 500,
  },
  {
    id: "redcap",
    title: "The Cap of Hermitage",
    reqLevel: 10,
    after: "calanais",
    ground: "liddesdale",
    echo: "hermitage",
    relic: "bloodCap",
    // Roughly a third of the level it is gated at (level 10 needs 3700), which
    // is a real bite without being a shortcut past the ground it is set on.
    rewardExp: 1200,
  },
  {
    // The second link, and the first one with an `after`. Both gates are real
    // and they are checked separately: a level-20 character who never took the
    // cap still cannot have this, and a level-12 character who did still has
    // to wait. The ten-mission ladder that was sketched around this slot is
    // GONE — the creature rebalance retired it — so this is not "mission three
    // of ten with two missing", it is simply the next one written.
    id: "draugr",
    title: "The Helm in the Howe",
    reqLevel: 15,
    after: "redcap",
    ground: "haramsey",
    echo: "haugr",
    relic: "graveHelm",
    // Level 15 needs 5000 to advance, so this is a shade under a quarter of a
    // level — the same proportion the cap paid, scaled up with the curve.
    rewardExp: 2400,
  },
  {
    /* The third door, and the fourth link — Chronos numbers DOORS, not links,
     * so Calanais is unnumbered in his mouth ("before we begin properly") and
     * this is the third thing he sends anyone through for a relic. Radek's
     * draft said "Trzecie wrota" and it was right; I queried it and I was
     * wrong.
     *
     * WHY TWENTY. The draugr sits at fifteen and the heath behind this door
     * fields ranks 18 to 23, which is the first hunting ground in the chain
     * that a character is expected to WORK rather than cross — four ranks and
     * thirty-four posts, against Haramsey's one rank and thirty-two. Five
     * levels is roughly the distance that island covers. */
    id: "blackannis",
    title: "The Effigy in the Oak",
    reqLevel: 20,
    after: "draugr",
    ground: "daneHills",
    echo: "bower",
    relic: "hairEffigy",
    // Level 20 needs 17200 to advance. The cap paid 32% of its level, the helm
    // 26%, and this pays 23% — the same slow taper, which is what keeps the
    // errands from outrunning the grind they are supposed to punctuate.
    rewardExp: 4000,
  },
];

/** The mission whose echo this world is, if any. Used where a world key is all
 *  the caller has: the loot roll, the pad sweep. */
export function missionByEcho(key: WorldKey): MissionDef | undefined {
  return MISSIONS.find((m) => m.echo === key);
}

/**
 * Does this errand pay in ATTUNEMENT rather than in a thing?
 *
 * Asked by the developer resets, which have to give back whatever an errand
 * paid before they can honestly call it un-done. A relic is taken out of the
 * pack; an element has to come out of `attuned`, and nothing else in the game
 * would think to look there.
 *
 * Derived from the SHAPE of the errand — no relic, and an echo whose spec
 * carries rune circles — rather than from a flag on the entry, so a second
 * bossless errand cannot be added and quietly miss the reset.
 */
export function grantsAttunement(m: MissionDef): boolean {
  return !m.relic;
}

/** The mission whose hunting ground this world is, if any. */
export function missionByGround(key: WorldKey): MissionDef | undefined {
  return MISSIONS.find((m) => m.ground === key);
}

export function missionById(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/** This character's stage per mission id. Anything absent is `locked`. */
function stages(): Record<string, MissionStage> {
  return active().missions;
}

/* ---------------- the chronicles ---------------- */

/**
 * Which mission's history this character has already been told.
 *
 * Stored per CHARACTER and not per device, because it is a thing that happened
 * to this character on the way in — the same reason the mission stage is. A
 * second character walks onto the same pad and gets the same page of history,
 * which is right: they have not read it.
 *
 * Kept separate from the stage rather than folded into it as a sixth value,
 * because it is orthogonal to all five. A player can read the history and
 * decline the errand; a player who loses the relic drops from `complete` back
 * to `active` and must not be told the story again on the way down.
 */
function loreBook(): Record<string, true> {
  return active().lore;
}

export function loreSeen(id: string): boolean {
  return loreBook()[id] === true;
}

export function markLoreSeen(id: string): void {
  loreBook()[id] = true;
}

/** Every mission whose history this character has read, in catalogue order. */
export function loreRead(): readonly MissionDef[] {
  return MISSIONS.filter((m) => loreSeen(m.id));
}

/** The recorded stage — before the level and prerequisite gates are applied. */
function stored(id: string): MissionStage {
  return stages()[id] ?? "locked";
}

/**
 * What stage a mission is really at for a character of this level.
 *
 * `locked` is computed, never stored: a mission the player has not started is
 * promoted to `available` the moment both gates open, so levelling up is
 * enough to make the sage talk — no tick, no event, nothing to forget to fire.
 * Anything the player HAS started is reported as recorded, because a mission
 * in hand cannot be taken back by a de-level after a death.
 */
export function stageOf(id: string, level: number): MissionStage {
  const st = stored(id);
  if (st !== "locked") return st;
  const def = missionById(id);
  if (!def) return "locked";
  if (level < def.reqLevel) return "locked";
  if (def.after && stored(def.after) !== "closed") return "locked";
  return "available";
}

/** Move a mission along. The caller owns the rules; this only records. */
export function setStage(id: string, stage: MissionStage): void {
  if (!missionById(id)) return;
  stages()[id] = stage;
}

/** The mission the sage will hand over next, if any. */
export function offeredMission(level: number): MissionDef | undefined {
  return MISSIONS.find((m) => stageOf(m.id, level) === "available");
}

/** The mission in hand, if any. At most one is ever past `available`. */
export function currentMission(level: number): MissionDef | undefined {
  return MISSIONS.find((m) => {
    const s = stageOf(m.id, level);
    return s === "active" || s === "complete";
  });
}

/**
 * Is this hunting ground open to the player? True from the moment its mission
 * goes `active` and true forever after — closing the echo never closes the
 * ground, which is the whole point of the two being separate maps.
 */
export function groundOpen(key: WorldKey, level: number): boolean {
  return MISSIONS.some((m) => m.ground === key && stageOf(m.id, level) !== "locked"
    && stageOf(m.id, level) !== "available");
}

/**
 * Is this echo still enterable? Only while the boss is still standing.
 *
 * The door shuts on the KILL, not on the hand-in: the boss is a one-time
 * fight, and a mouth that stayed open at `complete` would let the same
 * character walk back down to an empty room whose chest is already spent.
 *
 * That would brick a careless player — die on the way home and the relic is
 * gone with the door — were it not for `relicLost`. Chronos notices empty
 * hands, puts the mission back to `active`, and this reopens with it. So the
 * safety net is still there; it just runs through the man who wants the cap
 * instead of leaving the door hanging open for everyone.
 */
export function echoOpen(key: WorldKey, level: number): boolean {
  return MISSIONS.some((m) => m.echo === key && stageOf(m.id, level) === "active");
}

/**
 * Is the way home lit — the pad that appears in an echo when its boss falls?
 *
 * The exact complement of `echoOpen` for the same mission: the door in shuts
 * as the door out opens, both on the kill. It is `complete` and nothing else,
 * so a player who loses the relic and reopens the echo has to walk back down
 * and earn the ride home again.
 */
export function relicRoadOpen(key: WorldKey, level: number): boolean {
  return MISSIONS.some((m) => m.echo === key && stageOf(m.id, level) === "complete");
}

/**
 * Should this echo's boss part with its relic right now?
 *
 * TWO questions, not one, and the second is the one that matters. The stage
 * must be `active` — the relic has not been taken yet — AND the character must
 * be holding none.
 *
 * The stage alone used to be the whole rule, and the stage alone can be walked
 * backwards on purpose: park the cap somewhere the sage cannot see it, let him
 * find your hands empty, and the echo reopens with the cap still yours. Asking
 * `held` as well means the reopened door is worth nothing to anyone who has
 * not genuinely lost it. It is the same question `talkToSage` asks before
 * reopening, put to the boss instead of to the man.
 *
 * `held` is passed in rather than read here because this module knows nothing
 * about bags and should not start to: it is the caller who has the pack.
 */
export function wantsRelic(id: string, level: number, held: number): boolean {
  return stageOf(id, level) === "active" && held <= 0;
}

/**
 * Is this item nailed to the character who carries it?
 *
 * True while a mission that wants this relic is in hand — `active` or
 * `complete`, which is exactly `currentMission`. A bound item cannot be
 * dropped, chested, put in a body or otherwise moved out of the pack, so the
 * only two places a live relic can be is the pack or the sage's table.
 *
 * This is what makes the count in `wantsRelic` mean anything. Without it the
 * question "are you holding one?" is answered by where the player chose to
 * leave it thirty seconds ago, which is not a question, it is a suggestion.
 *
 * It costs the player the ability to make room by dropping the cap. That is a
 * real cost and it is the price of the rule: six weight, and the errand ends
 * with it leaving the pack anyway.
 */
export function boundRelic(kind: ItemKind, level: number): boolean {
  return currentMission(level)?.relic === kind;
}

/**
 * Does this STACK carry a bound relic — as itself, or anywhere inside it?
 *
 * `boundRelic` asks about a kind, and every gate that used it asked about the
 * kind of the stack being moved. That is the wrong question the moment the
 * stack is a container, because a backpack's kind is "backpack" however many
 * relics are sleeping in it: the cap went into a spare pack, the pack went
 * into a chest, and the gate waved it through because it was looking at the
 * wrong noun. `dropFromContainer` even says out loud two lines below its own
 * gate that "a pack goes down whole, contents and all" — which is exactly the
 * hole.
 *
 * So the question every exit asks is this one instead. It walks the tree,
 * because the tree is how deep a player can hide something, and `null` slots
 * are normal rather than exceptional.
 *
 * The depth bound is not a rule the player meets; it is the same defence
 * `slotsOf` carries, so that a corrupt save cannot turn a containment check
 * into an infinite walk. A cycle is already impossible by construction (see
 * the `isInside` gate in `moveItems`) and this is the belt to that's braces.
 */
export function carriesBound(st: ItemStack, level: number, depth = 0): boolean {
  if (boundRelic(st.kind, level)) return true;
  if (!st.items || depth > 8) return false;
  for (const inner of st.items) {
    if (inner && carriesBound(inner, level, depth + 1)) return true;
  }
  return false;
}

/**
 * Take every bound relic out of `st` and hand them back as loose stacks.
 *
 * The mirror of `carriesBound`, for the one caller that cannot simply refuse:
 * death. A dying character drops the backpack AS ITSELF, whole, which is
 * Tibia's rule and is right — but a relic riding along inside it is the same
 * escape the move gates exist to close, and worse, because the body rots. So
 * the relic is lifted out first and stays on the character, and the pack drops
 * with everything else still in it.
 *
 * `missions.ts:417` has claimed since Etap 45 that "dying does not cost the
 * bag". It was describing the intent rather than the code; this is the code.
 */
export function extractBound(st: ItemStack, level: number, out: ItemStack[] = [], depth = 0): ItemStack[] {
  if (!st.items || depth > 8) return out;
  for (let i = 0; i < st.items.length; i++) {
    const inner = st.items[i];
    if (!inner) continue;
    if (boundRelic(inner.kind, level)) { out.push(inner); st.items[i] = null; continue; }
    extractBound(inner, level, out, depth + 1);
  }
  return out;
}

/** The boss is down and the relic is in the pack. */
export function relicTaken(id: string, level: number): void {
  if (stageOf(id, level) === "active") setStage(id, "complete");
}

/**
 * The relic left the player's hands without reaching the sage. The echo
 * reopens; nothing else changes.
 *
 * `boundRelic` has since closed every road that led here for a live character:
 * it cannot be dropped, chested, bodied or sold, and dying does not cost the
 * bag. So this is no longer the routine mercy it was written as — it is the
 * catch for the cases the rule cannot reach. A save written before the bind
 * landed, with a cap already sitting in a home chest. A trade, when there is
 * trading. It stays because those are real and because the alternative to
 * catching them is a character that can never finish the errand.
 */
export function relicLost(id: string, level: number): void {
  if (stageOf(id, level) === "complete") setStage(id, "active");
}

/** The relic is on the sage's table. The echo goes dark for good. */
export function missionHandedIn(id: string, level: number): void {
  if (stageOf(id, level) === "complete") setStage(id, "closed");
}

/* ---------------- save / load ---------------- */

export type MissionSave = Record<string, MissionStage>;

/** The chronicles this character has read, as a plain id list. */
export function loreState(): string[] {
  return Object.keys(loreBook()).filter((id) => missionById(id));
}

/** Restore the read list, dropping ids this build no longer knows. */
export function loadLoreState(s: unknown): void {
  const to = loreBook();
  for (const k of Object.keys(to)) delete to[k];
  if (!Array.isArray(s)) return;
  for (const id of s) if (typeof id === "string" && missionById(id)) to[id] = true;
}

/**
 * Snapshot for saving. Stages equal to `locked` are dropped: it is the
 * default, so storing it is noise, and a mission that has not shipped yet
 * would otherwise pin a row in every save file.
 */
export function missionState(): MissionSave {
  const out: MissionSave = {};
  for (const [id, st] of Object.entries(stages())) if (st !== "locked") out[id] = st;
  return out;
}

const STAGES: readonly MissionStage[] = ["locked", "available", "active", "complete", "closed"];

/**
 * Restore from a save, discarding anything unrecognised — an id that has been
 * retired from the catalogue, or a stage from a future version. Both are
 * dropped rather than defaulted, so a save written by a newer build degrades
 * to "this mission has not been started" instead of to a broken state.
 */
export function loadMissionState(s: unknown): void {
  const to = stages();
  for (const k of Object.keys(to)) delete to[k];
  if (!s || typeof s !== "object") return;
  for (const [id, st] of Object.entries(s as Record<string, unknown>)) {
    if (!missionById(id)) continue;
    if (typeof st !== "string" || !STAGES.includes(st as MissionStage)) continue;
    to[id] = st as MissionStage;
  }
}

/**
 * Back to a character who has never spoken to the sage.
 *
 * Wipes the chronicles as well as the stages: a reset that left the history
 * marked as read would put the mission back at the start of the chain and skip
 * the page of it that is the whole reason the pad stops you.
 */
export function resetMissions(): void {
  const to = stages();
  for (const k of Object.keys(to)) delete to[k];
  const lr = loreBook();
  for (const k of Object.keys(lr)) delete lr[k];
}

/**
 * The same thing for ONE link: its stage and its chronicle, nothing else.
 *
 * This is what `/replay draugr` is built on, and the reason it is a separate
 * function rather than a loop over `resetMissions` is the chronicle. Both have
 * to go together — a mission put back to the start with its history still
 * marked read would skip the page of folklore that is the whole reason the pad
 * stops you — and getting that pairing wrong is exactly the bug the full reset
 * already had once.
 *
 * The chain around it is left ALONE, which is deliberate and is what makes the
 * command usable for testing. Rolling the redcap back does not roll the draugr
 * back with it: the draugr's `after` looks at the redcap's STORED stage, so a
 * still-closed draugr stays closed and a not-yet-taken one goes back behind the
 * gate. Both are correct, and neither costs the player anything they had
 * finished.
 */
export function resetMission(id: string): void {
  if (!missionById(id)) return;
  delete stages()[id];
  delete loreBook()[id];
}
