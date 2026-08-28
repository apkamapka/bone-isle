/**
 * The Time Sage's missions: the chain of one-time errands into history that
 * runs alongside the repeatable board tasks.
 *
 * THE CATALOGUE IS EMPTY. This module is the machinery only — the shape the
 * fourteen missions will be poured into, landed ahead of them so the save
 * format, the pad wiring and the tests settle once instead of fourteen times.
 * Every function below is correct against an empty `MISSIONS`, which is why it
 * can ship before a single mission exists.
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
 * real loss, and it is why buying a relic off another player is worth gold.
 *
 * The other half of that bargain is `wantsRelic` below: the echo yields its
 * relic only while you are carrying none. Without it the same open door that
 * saves a careless player becomes a relic printing press for a patient one.
 */
import type { ItemKind } from "../items.ts";
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
  /** What the echo's boss leaves behind, and what the sage takes back. */
  relic: ItemKind;
  /** Paid when the relic reaches the sage's table. Experience only: the coin
   *  is already down in the echo, in a chest the player has to fight for, and
   *  paying twice for one errand would make the ladder's own purses look silly. */
  rewardExp: number;
}

/**
 * The chain. One link so far.
 *
 * The redcap is the first, at level ten, and he has no `after`: nothing has to
 * be closed before the sage will speak about him. Everything that follows will
 * name him, so this entry's `id` is now permanent — it is written into every
 * save that has ever started the mission.
 */
export const MISSIONS: readonly MissionDef[] = [
  {
    id: "redcap",
    title: "The Cap of Hermitage",
    reqLevel: 10,
    ground: "liddesdale",
    echo: "hermitage",
    relic: "bloodCap",
    // Roughly a third of the level it is gated at (level 10 needs 3700), which
    // is a real bite without being a shortcut past the ground it is set on.
    rewardExp: 1200,
  },
];

/** The mission whose echo this world is, if any. Used where a world key is all
 *  the caller has: the loot roll, the pad sweep. */
export function missionByEcho(key: WorldKey): MissionDef | undefined {
  return MISSIONS.find((m) => m.echo === key);
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
 * Should this echo's boss drop its relic right now?
 *
 * Only while the mission is `active` — that is, the relic has not been taken
 * yet. Re-entering after a death to replace a lost one works, because losing
 * the relic is what puts the mission back to `active` (see `relicLost`);
 * farming a second one to sell does not, because the first kill moved the
 * mission to `complete` and it stays there until the sage is paid.
 */
export function wantsRelic(id: string, level: number): boolean {
  return stageOf(id, level) === "active";
}

/** The boss is down and the relic is in the pack. */
export function relicTaken(id: string, level: number): void {
  if (stageOf(id, level) === "active") setStage(id, "complete");
}

/**
 * The relic left the player's hands without reaching the sage — dropped on
 * death, sold, or handed to another player. The echo reopens; nothing else
 * changes. Called from wherever inventory is reconciled, not from the mission
 * flow itself, because the mission flow is not what loses it.
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

export function resetMissions(): void {
  const to = stages();
  for (const k of Object.keys(to)) delete to[k];
}
