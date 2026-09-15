/**
 * The Huntress' board (Grizzly Adams style). You take up to three errands at a
 * time from Grizelda in Bonetown, hunt, and hand them in for gold, experience
 * and Task Points.
 *
 * HOW COUNTING WORKS
 *
 * An errand counts from the moment it is TAKEN. Each active entry keeps its
 * own tally in `progress`, advanced by `onTaskKill` for every creature in its
 * goal — so walking into the Orc Deep with empty hands fills the kill ledger
 * in `kills.ts` (which is a separate lifetime record, kept for its own sake)
 * but moves no errand.
 *
 * Two things follow, and both are deliberate:
 *
 *   - Abandoning still costs nothing. The tally is keyed by entry, not by
 *     "what is in hand", so dropping an errand and taking it back later
 *     resumes exactly where it stood. `abandonTask` frees a slot; it does not
 *     punish.
 *   - Errands repeat forever. A hand-in subtracts `need` from the tally rather
 *     than zeroing it, so overkill carries into the next round: finishing on
 *     a hundred and eight orcs starts the next hundred at eight.
 *
 * The board is kills only. The old delivery errands (fifteen wood, twenty
 * stone) read the BAG rather than a ledger and had no sensible repeat rule —
 * the bag is a photograph, not a tally — so they are gone rather than bent
 * into a shape they never fitted.
 *
 * Task Points still accrue on every hand-in and still show in the HUD. There
 * is nothing to spend them on yet, by decision: the reward shelf is a separate
 * piece of design and an empty shop is more honest than a placeholder one.
 */
import { giveGold, walletRoomFor } from "../items.ts";
import { active as activeState } from "./playerState.ts";
import type { MonsterKind } from "../world/types.ts";
import type { Player } from "../entities/player.ts";

/** Errands in hand at once. Three, as in the game this board comes from. */
export const MAX_ACTIVE = 3;

export interface TaskGoal {
  /** Everything that counts. One entry for a single rank, several for a camp. */
  kinds: readonly MonsterKind[];
  /** Kills per hand-in. The n-th hand-in wants `need x n` in the ledger. */
  need: number;
}

export interface TaskReward {
  /** Task Points granted — the board currency. */
  points: number;
  gold: number;
  exp: number;
}

export interface TaskDef {
  id: string;
  title: string;
  desc: string;
  goal: TaskGoal;
  reward: TaskReward;
  /** The level the board hands this out at. Nothing ever expires off the top:
   *  the errands repeat forever and a level-40 character is welcome to go and
   *  cull snakes if that is what he feels like. */
  reqLevel: number;
}

/* ------------------------------------------------------------------ *
 *  ONE GROUND, ONE ERRAND
 *
 *  Each entry counts everything that shares a hunting ground, because that is
 *  what a hunt actually looks like: nobody walks into a floor of orcs and
 *  steps over the archers. So the orc errand takes grunts, bowmen and warriors
 *  together, the deep floor below it takes berserkers and shamans, and the
 *  road takes the whole spread of vermin that works it. No creature appears on
 *  two entries, and every creature in the game is on one.
 *
 *  Three entries break the one-ground rule on purpose, because they are not
 *  really ground creatures: the demon skeleton is pulled out of the charnel
 *  floor it shares with ghouls, so that errand cannot be finished on the soft
 *  half of the floor, and the black knight and the dragon each get their own.
 *
 *  `desc` is the roster and nothing else. It deliberately does NOT say where
 *  the ground is: finding it is the player's half of the errand.
 *
 *  THE BANDS
 *
 *  A creature's `need` is set by the level its stats were built for, not by
 *  how it feels: fifty for the vermin of the road, a hundred and fifty for
 *  the things at the bottom of the Charnel Deep. The reward is pegged to the
 *  same band at roughly a quarter of what the kills themselves pay, so an
 *  errand is a bonus on top of a hunt and never a substitute for one.
 *
 *  Spawn density was checked against the maps before these numbers were set:
 *  thin ranks like the orc shaman (eleven posts) and the minotaur mage (seven)
 *  never carry an errand alone, only alongside the rest of their floor. The
 *  black knight and dragon errands are the exception, written for the hunting
 *  grounds that are coming rather than for the single post each has today.
 * ------------------------------------------------------------------ */
/* Task Points run on the creature, not on the size of the errand: one for the
 * vermin of the road, two for goblins and their like, three for minotaurs and
 * their like, four for everything between them and the dragon, five for the
 * dragon itself. Gold and experience still climb with the band underneath. */
const A: TaskReward = { points: 1, gold: 150, exp: 600 };      // lvl 1-10,  need 50
const B: TaskReward = { points: 2, gold: 400, exp: 2500 };     // lvl 11-20, need 75
const C: TaskReward = { points: 3, gold: 800, exp: 5000 };     // lvl 21-30, need 100
const D: TaskReward = { points: 4, gold: 1800, exp: 12000 };   // lvl 31-40, need 125
const E: TaskReward = { points: 4, gold: 3000, exp: 20000 };   // lvl 41-50, need 150

export const TASKS: readonly TaskDef[] = [
  {
    id: "t_snakes", title: "Snake Cull",
    desc: "Snake",
    goal: { kinds: ["snake"], need: 50 }, reward: A, reqLevel: 1,
  },
  {
    id: "t_vermin", title: "Road Vermin",
    desc: "Beggar, Vagrant, Thief, Poacher, Bandit",
    goal: { kinds: ["beggar", "vagrant", "thief", "poacher", "bandit"], need: 50 },
    reward: A, reqLevel: 2,
  },
  {
    id: "t_highway", title: "Highway Gang",
    desc: "Smuggler, Cutthroat, Brigand, Deserter, Highwayman",
    goal: { kinds: ["smuggler", "cutthroat", "brigand", "deserter", "highwayman"], need: 75 },
    reward: B, reqLevel: 10,
  },
  {
    id: "t_skeletons", title: "Bone Sweep",
    desc: "Skeleton",
    goal: { kinds: ["skeleton"], need: 75 }, reward: B, reqLevel: 13,
  },
  {
    id: "t_goblins", title: "Goblin Raid",
    desc: "Goblin, Goblin Legionary",
    goal: { kinds: ["goblin", "goblinLegionary"], need: 100 },
    reward: { points: 2, gold: 600, exp: 3500 }, reqLevel: 15,
  },
  {
    id: "t_vikings", title: "Northmen",
    desc: "Viking",
    goal: { kinds: ["viking"], need: 100 }, reward: C, reqLevel: 20,
  },
  {
    id: "t_orcs", title: "Orc Warband",
    desc: "Orc, Orc Archer, Orc Warrior",
    goal: { kinds: ["orc", "orcArcher", "orcWarrior"], need: 100 }, reward: C, reqLevel: 21,
  },
  {
    id: "t_sellswords", title: "Sellswords",
    desc: "Mercenary, Corsair, Amazon, Hunter, Wild Warrior, Gladiator",
    goal: { kinds: ["mercenary", "corsair", "amazon", "hunter", "wildWarrior", "gladiator"], need: 100 },
    reward: C, reqLevel: 22,
  },
  {
    id: "t_minotaurs", title: "Horned Legion",
    desc: "Minotaur, Minotaur Archer",
    goal: { kinds: ["minotaur", "minotaurArcher"], need: 100 }, reward: C, reqLevel: 25,
  },
  {
    id: "t_berserkers", title: "Berserker Trophy",
    desc: "Orc Berserker, Orc Shaman",
    goal: { kinds: ["orcBerserker", "orcShaman"], need: 125 }, reward: D, reqLevel: 30,
  },
  {
    id: "t_charnel", title: "The Restless Dead",
    desc: "Ghoul, Skeleton Warrior",
    goal: { kinds: ["ghoul", "skeletonWarrior"], need: 100 }, reward: C, reqLevel: 28,
  },
  {
    id: "t_minoguards", title: "Horned Guard",
    desc: "Minotaur Guard, Minotaur Mage",
    goal: { kinds: ["minotaurGuard", "minotaurMage"], need: 125 }, reward: D, reqLevel: 35,
  },
  {
    id: "t_warband", title: "The Warband",
    desc: "Barbarian, Raider, Warlord, Chieftain",
    goal: { kinds: ["barbarian", "raider", "warlord", "chieftain"], need: 150 }, reward: E, reqLevel: 38,
  },
  {
    id: "t_demonskeletons", title: "Demon Skeletons",
    desc: "Demon Skeleton",
    goal: { kinds: ["demonSkeleton"], need: 150 }, reward: E, reqLevel: 41,
  },
  {
    id: "t_blackknights", title: "Black Knight Hunt",
    desc: "Black Knight",
    goal: { kinds: ["blackKnight"], need: 150 },
    reward: { points: 5, gold: 4000, exp: 32000 }, reqLevel: 45,
  },
  {
    id: "t_dragons", title: "Dragon Hunt",
    desc: "Dragon",
    goal: { kinds: ["dragon"], need: 150 },
    reward: { points: 5, gold: 9000, exp: 80000 }, reqLevel: 45,
  },
];

/* ---------------- runtime state (persisted via save.ts) ---------------- */

/**
 * This character's board. Lives on PlayerState, not in a module `let`, so a
 * process can run more than one character at a time.
 *
 * `progress` is the tally per entry, advanced only while the entry is in hand.
 * It is keyed by entry rather than living on the active list, which is what
 * makes abandoning free: the number stays behind and is found again when the
 * errand is taken back. `claims` counts hand-ins, purely so the board can say
 * "x3 done".
 */
const rt = {
  get active() { return activeState().tasks.active; },
  set active(v: string[]) { activeState().tasks.active = v; },
  get progress() { return activeState().tasks.progress; },
  set progress(v: Record<string, number>) { activeState().tasks.progress = v; },
  get claims() { return activeState().tasks.claims; },
  set claims(v: Record<string, number>) { activeState().tasks.claims = v; },
  get earned() { return activeState().tasks.earned; },
  set earned(v: number) { activeState().tasks.earned = v; },
};

export function taskById(id: string): TaskDef | undefined {
  return TASKS.find((t) => t.id === id);
}

/** The errands in hand, in the order they were taken. */
export function activeTasks(): TaskDef[] {
  return rt.active.map((id) => taskById(id)).filter((t): t is TaskDef => !!t);
}

export function isActive(id: string): boolean {
  return rt.active.includes(id);
}

export function hasRoomForTask(): boolean {
  return rt.active.length < MAX_ACTIVE;
}

export function pointsEarned(): number {
  return rt.earned;
}

/** How many times this entry has been handed in. */
export function claimsOf(id: string): number {
  return rt.claims[id] ?? 0;
}

/** Whether the board offers this entry. One gate, at the bottom: an errand
 *  the character has outgrown stays on the board, because they repeat and
 *  nothing says a veteran cannot go and cull snakes for an afternoon. */
export function isTaskUnlocked(def: TaskDef, level: number): boolean {
  if (isActive(def.id)) return true;
  return level >= def.reqLevel;
}

/** Everything the board shows this character, easiest first. */
export function offeredTasks(level: number): TaskDef[] {
  return TASKS.filter((t) => isTaskUnlocked(t, level))
    .sort((a, b) => a.reqLevel - b.reqLevel || a.goal.need - b.goal.need);
}

/** Kills banked toward the next hand-in of this entry. */
export function progressOf(def: TaskDef): number {
  return Math.max(0, Math.min(rt.progress[def.id] ?? 0, def.goal.need));
}

/**
 * Count one kill against every errand in hand that wants it.
 *
 * Every errand, not the first match: a goblin killed while both the goblin
 * bounty and the warren are in hand counts for both. Nothing here looks at
 * the creature twice for the SAME entry, so a camp errand listing five ranks
 * still advances by one per corpse.
 */
export function onTaskKill(kind: MonsterKind): void {
  let next: Record<string, number> | null = null;
  for (const id of rt.active) {
    const def = taskById(id);
    if (!def || !def.goal.kinds.includes(kind)) continue;
    next ??= { ...rt.progress };
    next[id] = (next[id] ?? 0) + 1;
  }
  if (next) rt.progress = next;
}

export function isComplete(def: TaskDef): boolean {
  return progressOf(def) >= def.goal.need;
}

/**
 * Take an errand. Fails if it is already in hand, the three slots are full, or
 * the board does not offer it at this level.
 *
 * Note what it does NOT do: it does not zero the tally. Kills made BEFORE the
 * errand was first taken never counted, but kills made while it was in hand
 * on an earlier outing still do — taking an abandoned errand back resumes it
 * rather than restarting it.
 */
export function acceptTask(id: string, level: number): boolean {
  const def = taskById(id);
  if (!def || isActive(id) || !hasRoomForTask()) return false;
  if (!isTaskUnlocked(def, level)) return false;
  rt.active = [...rt.active, id];
  return true;
}

/** Drop an errand to free a slot. Costs nothing — see the note on `rt`. */
export function abandonTask(id: string): boolean {
  if (!isActive(id)) return false;
  rt.active = rt.active.filter((x) => x !== id);
  return true;
}

/**
 * Whether the hand-in's coin has somewhere to go. The purse needs a cell like
 * anything else, and a reward that vanishes into a full pack is worse than one
 * the board refuses to pay until there is room.
 */
export function rewardFits(p: Player, def: TaskDef): boolean {
  return walletRoomFor(p.bag, def.reward.gold);
}

export interface HandInResult {
  title: string;
  reward: TaskReward;
  /** Which hand-in this was for that entry — 1 the first time, 2 the next. */
  time: number;
}

/**
 * Hand in an errand. Grants gold and points directly and defers experience to
 * `giveExp` (so level-ups run through combat's normal path). Returns null if
 * the errand is not in hand, not finished, or the purse has nowhere to go.
 *
 * The entry leaves the active list on success and can be taken again at once.
 * The tally is REDUCED by what was asked for rather than zeroed, so a hundred
 * and eight orcs pays out once and starts the next round at eight.
 */
export function handInTask(p: Player, id: string, giveExp: (n: number) => void): HandInResult | null {
  const def = taskById(id);
  if (!def || !isActive(id) || !isComplete(def)) return null;
  if (!rewardFits(p, def)) return null;
  const time = claimsOf(def.id) + 1;
  rt.claims = { ...rt.claims, [def.id]: time };
  rt.progress = { ...rt.progress, [def.id]: Math.max(0, (rt.progress[def.id] ?? 0) - def.goal.need) };
  rt.active = rt.active.filter((x) => x !== def.id);
  const r = def.reward;
  p.taskPoints += r.points;
  rt.earned += r.points;
  if (r.gold) giveGold(p.bag, r.gold);
  if (r.exp) giveExp(r.exp);
  return { title: def.title, reward: r, time };
}

/* ---------------- save / load ---------------- */

export interface TaskSave {
  /** Errand ids in hand, at most MAX_ACTIVE of them. */
  active: string[];
  /** Kills banked per entry id. Survives abandoning, which is the point. */
  progress: Record<string, number>;
  /** Hand-ins per entry id. Absent means never handed in. */
  claims: Record<string, number>;
  /** Lifetime Task Points earned, which no spending ever reduces. */
  earned: number;
}

/** The pre-Etap shape: one errand, its own kill tally, lifetime points. */
interface LegacyTaskSave {
  activeId?: string | null;
  kills?: number;
  earned?: number;
}

export function taskState(): TaskSave {
  return {
    active: [...rt.active], progress: { ...rt.progress },
    claims: { ...rt.claims }, earned: rt.earned,
  };
}

/** Shared by `progress` and `claims`: ids the catalogue still carries, whole
 *  positive numbers only. A save naming an errand that has been retired, or
 *  carrying a fraction or a negative, loses that entry rather than the file. */
function sanitizeCounts(src: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!src || typeof src !== "object") return out;
  for (const [id, n] of Object.entries(src as Record<string, unknown>)) {
    if (taskById(id) && typeof n === "number" && Number.isFinite(n) && n > 0) {
      out[id] = Math.floor(n);
    }
  }
  return out;
}

/**
 * Restore the board, accepting the old single-errand shape.
 *
 * A legacy `activeId` survives if the catalogue still carries that id — the
 * six kill errands kept their ids for exactly this reason — and its `kills`
 * tally moves across as that entry's progress. The goal grew from eight to
 * fifty under it, so the bar is further away than it was, but the corpses
 * were real and counting them again would be the ruder answer.
 */
export function loadTaskState(s: (Partial<TaskSave> & LegacyTaskSave) | undefined): void {
  rt.active = [];
  rt.progress = {};
  rt.claims = {};
  rt.earned = typeof s?.earned === "number" && s.earned > 0 ? Math.floor(s.earned) : 0;
  if (!s) return;

  const ids = Array.isArray(s.active) ? s.active
    : typeof s.activeId === "string" ? [s.activeId]
    : [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string" || seen.has(id) || !taskById(id)) continue;
    if (rt.active.length >= MAX_ACTIVE) break;
    seen.add(id);
    rt.active = [...rt.active, id];
  }

  rt.claims = sanitizeCounts(s.claims);
  rt.progress = sanitizeCounts(s.progress);
  /* The old single-errand tally, if this is a pre-rewrite save and its errand
   * survived the catalogue. Never overwrites a real `progress` entry. */
  const legacy = Math.floor(s.kills ?? 0);
  const only = rt.active[0];
  if (legacy > 0 && only && !(only in rt.progress)) {
    rt.progress = { ...rt.progress, [only]: legacy };
  }
}

export function resetTasks(): void {
  rt.active = [];
  rt.progress = {};
  rt.claims = {};
  rt.earned = 0;
}
