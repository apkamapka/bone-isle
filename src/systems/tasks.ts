/**
 * The Huntress' board (Grizzly Adams style). You take up to three errands at a
 * time from Grizelda in Bonetown, hunt, and hand them in for gold, experience
 * and Task Points.
 *
 * WHAT CHANGED, AND WHY IT MATTERS
 *
 * Progress is no longer counted per errand. It is read out of the kill ledger
 * in `kills.ts`, which counts every creature this character has ever killed
 * whether or not a board entry was open at the time. Three consequences, all
 * of them deliberate:
 *
 *   - Hunting is never wasted. Walk into the Orc Deep with no errand, come
 *     back with two hundred dead orcs, and the board owes you for them.
 *   - Abandoning costs nothing. The ledger does not care what you had in hand,
 *     so dropping an errand and taking it again later resumes exactly where it
 *     stood. `abandonTask` exists to free a slot, not to punish.
 *   - Errands repeat forever. An entry asks for the NEXT `need` kills, so the
 *     threshold for its n-th hand-in is `need x n`. Surplus carries: four
 *     hundred orcs is four hand-ins of a hundred, claimable back to back.
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
import { killCountOf } from "./kills.ts";
import type { MonsterKind } from "../world/types.ts";
import type { Player } from "../entities/player.ts";

/** Errands in hand at once. Three, as in the game this board comes from. */
export const MAX_ACTIVE = 3;

/**
 * How far below the player's level an errand stays on the board.
 *
 * Without a window the list only ever grows: by level forty a character would
 * scroll past thirty entries to reach the two that are worth taking, and the
 * panel would be taller than a phone screen. Fifteen levels keeps the visible
 * list at roughly the six to ten entries that actually suit the character —
 * and an errand already in hand is never hidden by it, however far it falls
 * behind, so nothing can be stranded half-done.
 */
export const TASK_WINDOW = 15;

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
  /** The level the board hands this out at. See TASK_WINDOW for the top end. */
  reqLevel: number;
}

/* ------------------------------------------------------------------ *
 *  THE BANDS
 *
 *  A creature's `need` is set by the level its stats were built for, not by
 *  how it feels: fifty for the vermin of the road, a hundred and fifty for
 *  the things at the bottom of the Charnel Deep. The reward is pegged to the
 *  same band at roughly a quarter of what the kills themselves pay, so an
 *  errand is a bonus on top of a hunt and never a substitute for one.
 *
 *  Spawn density was checked against the maps before these numbers were set.
 *  Two creatures are absent on purpose: the dragon and the black knight have
 *  exactly one post each in the whole world, so any kill count at all would
 *  be a respawn-timer errand rather than a hunt. The orc shaman (eleven posts)
 *  and the minotaur mage (seven) appear only inside camp errands, where the
 *  rest of the family carries the count.
 * ------------------------------------------------------------------ */
const A: TaskReward = { points: 1, gold: 150, exp: 600 };      // lvl 1-10,  need 50
const B: TaskReward = { points: 2, gold: 400, exp: 2500 };     // lvl 11-20, need 75
const C: TaskReward = { points: 3, gold: 800, exp: 5000 };     // lvl 21-30, need 100
const D: TaskReward = { points: 4, gold: 1800, exp: 12000 };   // lvl 31-40, need 125
const E: TaskReward = { points: 5, gold: 3000, exp: 20000 };   // lvl 41+,   need 150

export const TASKS: readonly TaskDef[] = [
  /* ---- band A: the vermin of the road, fifty a piece ---- */
  {
    id: "t_snakes", title: "Snake Cull",
    desc: "Snakes choke the trails of the Gallows Coast. Put down 50.",
    goal: { kinds: ["snake"], need: 50 }, reward: A, reqLevel: 1,
  },
  {
    id: "t_vermin", title: "Road Vermin",
    desc: "Beggars, vagrants and thieves work the coast road. Clear 50.",
    goal: { kinds: ["beggar", "vagrant", "thief"], need: 50 }, reward: A, reqLevel: 1,
  },
  {
    id: "t_poachers", title: "Poacher Sweep",
    desc: "Poachers thin the game around Calanais. Hunt 50.",
    goal: { kinds: ["poacher"], need: 50 }, reward: A, reqLevel: 3,
  },
  {
    id: "t_bandits", title: "Bandit Bounty",
    desc: "Bandits hold the Gallows Coast road. Cut down 50.",
    goal: { kinds: ["bandit"], need: 50 }, reward: A, reqLevel: 5,
  },
  {
    id: "t_cutthroats", title: "Cutthroats",
    desc: "Cutthroats work the Calanais track after dark. Kill 50.",
    goal: { kinds: ["cutthroat"], need: 50 }, reward: A, reqLevel: 7,
  },
  {
    id: "t_smugglers", title: "Smuggler Run",
    desc: "Smugglers move goods through Liddesdale. Stop 50 of them.",
    goal: { kinds: ["smuggler"], need: 50 }, reward: A, reqLevel: 8,
  },
  {
    id: "t_coastroad", title: "The Gallows Road",
    desc: "Everything that preys on the coast road. Clear 100 of any rank.",
    goal: { kinds: ["beggar", "vagrant", "thief", "poacher", "bandit"], need: 100 },
    reward: { points: 2, gold: 350, exp: 1400 }, reqLevel: 6,
  },

  /* ---- band B: seventy-five a piece ---- */
  {
    id: "t_brigands", title: "Brigand Patrol",
    desc: "Brigands press the Liddesdale border. Break 75.",
    goal: { kinds: ["brigand"], need: 75 }, reward: B, reqLevel: 10,
  },
  {
    id: "t_deserters", title: "Deserters",
    desc: "Deserters camp in the Liddesdale hollows. Bring in 75.",
    goal: { kinds: ["deserter"], need: 75 }, reward: B, reqLevel: 10,
  },
  {
    id: "t_skeletons", title: "Bone Sweep",
    desc: "Skeletons rattle through the Reach ruins. Break 75 apart.",
    goal: { kinds: ["skeleton"], need: 75 }, reward: B, reqLevel: 12,
  },
  {
    id: "t_highwaymen", title: "Highwaymen",
    desc: "Highwaymen tax the Gallows Coast road. Hang 75.",
    goal: { kinds: ["highwayman"], need: 75 }, reward: B, reqLevel: 12,
  },
  {
    id: "t_goblins", title: "Goblin Bounty",
    desc: "Goblins raid out of the Goblin Deep. Hunt down 75.",
    goal: { kinds: ["goblin"], need: 75 }, reward: B, reqLevel: 13,
  },
  {
    id: "t_mercenaries", title: "Paid Swords",
    desc: "Mercenaries drill in the Bandit Deep. Cut down 75.",
    goal: { kinds: ["mercenary"], need: 75 }, reward: B, reqLevel: 14,
  },
  {
    id: "t_corsairs", title: "Corsairs",
    desc: "Corsairs put in along the Dane Hills shore. Kill 75.",
    goal: { kinds: ["corsair"], need: 75 }, reward: B, reqLevel: 16,
  },
  {
    id: "t_amazons", title: "Amazon Camp",
    desc: "Amazons hold the Bandit Deep's upper halls. Fell 75.",
    goal: { kinds: ["amazon"], need: 75 }, reward: B, reqLevel: 18,
  },

  /* ---- band C: a hundred a piece ---- */
  {
    id: "t_ghouls", title: "Restless Dead",
    desc: "Ghouls prowl the Charnel Deep. Put 100 back in the ground.",
    goal: { kinds: ["ghoul"], need: 100 }, reward: C, reqLevel: 18,
  },
  {
    id: "t_orcs", title: "Orc Warband",
    desc: "Orcs press the Reach from the Orc Deep. Cut down 100.",
    goal: { kinds: ["orc"], need: 100 }, reward: C, reqLevel: 18,
  },
  {
    id: "t_orcarchers", title: "Orc Bowmen",
    desc: "Orc archers cover the Orc Isle approaches. Kill 100.",
    goal: { kinds: ["orcArcher"], need: 100 }, reward: C, reqLevel: 19,
  },
  {
    id: "t_hunters", title: "Rival Hunters",
    desc: "Hunters work the Dane Hills for our bounties. Kill 100.",
    goal: { kinds: ["hunter"], need: 100 }, reward: C, reqLevel: 20,
  },
  {
    id: "t_wildwarriors", title: "Wild Warriors",
    desc: "Wild warriors hold the Bandit Deep's lower halls. Fell 100.",
    goal: { kinds: ["wildWarrior"], need: 100 }, reward: C, reqLevel: 20,
  },
  {
    id: "t_legionaries", title: "Goblin Legion",
    desc: "Armoured goblins mass in the Goblin Deep. Break 100.",
    goal: { kinds: ["goblinLegionary"], need: 100 }, reward: C, reqLevel: 21,
  },
  {
    id: "t_vikings", title: "Northmen",
    desc: "Mailed Northmen walk Haramsey. Put down 100.",
    goal: { kinds: ["viking"], need: 100 }, reward: C, reqLevel: 22,
  },
  {
    id: "t_minoarchers", title: "Horned Bowmen",
    desc: "Minotaur archers hold the Minotaur Deep. Kill 100.",
    goal: { kinds: ["minotaurArcher"], need: 100 }, reward: C, reqLevel: 24,
  },
  {
    id: "t_orcwarriors", title: "Orc Warriors",
    desc: "Orc warriors guard the Orc Deep's halls. Cut down 100.",
    goal: { kinds: ["orcWarrior"], need: 100 }, reward: C, reqLevel: 25,
  },
  {
    id: "t_minotaurs", title: "Horns of the Deep",
    desc: "Minotaurs hold the deep under the Reach. Slay 100.",
    goal: { kinds: ["minotaur"], need: 100 }, reward: C, reqLevel: 26,
  },
  {
    id: "t_boneguard", title: "Bone Guard",
    desc: "Skeleton warriors stand watch in the Charnel Deep. Break 100.",
    goal: { kinds: ["skeletonWarrior"], need: 100 }, reward: C, reqLevel: 27,
  },
  {
    id: "t_gladiators", title: "Pit Fighters",
    desc: "Gladiators fight for coin in the Bandit Deep. Kill 100.",
    goal: { kinds: ["gladiator"], need: 100 }, reward: C, reqLevel: 27,
  },

  /* ---- camp errands: a whole family at once ---- */
  {
    id: "t_warren", title: "The Goblin Warren",
    desc: "Goblins of any rank, out of the Goblin Deep. Clear 150.",
    goal: { kinds: ["goblin", "goblinLegionary"], need: 150 },
    reward: { points: 3, gold: 900, exp: 5500 }, reqLevel: 21,
  },
  {
    id: "t_orccamp", title: "The Orc Camp",
    desc: "Orcs of any rank — grunts, bowmen, warriors, shamans, berserkers. Clear 200.",
    goal: { kinds: ["orc", "orcArcher", "orcWarrior", "orcShaman", "orcBerserker"], need: 200 },
    reward: { points: 4, gold: 1600, exp: 11000 }, reqLevel: 24,
  },
  {
    id: "t_charnel", title: "The Charnel Deep",
    desc: "Anything walking dead below the Reach. Put 150 back in the ground.",
    goal: { kinds: ["skeleton", "skeletonWarrior", "ghoul", "demonSkeleton"], need: 150 },
    reward: { points: 4, gold: 1500, exp: 10000 }, reqLevel: 28,
  },
  {
    id: "t_labyrinth", title: "The Labyrinth",
    desc: "Minotaurs of any rank, horns and all. Clear 200.",
    goal: { kinds: ["minotaur", "minotaurArcher", "minotaurGuard", "minotaurMage"], need: 200 },
    reward: { points: 5, gold: 2600, exp: 20000 }, reqLevel: 30,
  },

  /* ---- band D: a hundred and twenty-five a piece ---- */
  {
    id: "t_barbarians", title: "Barbarians",
    desc: "Barbarians raid out of the Bandit Deep's second floor. Fell 125.",
    goal: { kinds: ["barbarian"], need: 125 }, reward: D, reqLevel: 30,
  },
  {
    id: "t_raiders", title: "Raiders",
    desc: "Raiders hold the Bandit Deep's second floor. Cut down 125.",
    goal: { kinds: ["raider"], need: 125 }, reward: D, reqLevel: 31,
  },
  {
    id: "t_berserkers", title: "Berserker Trophy",
    desc: "Orc berserkers rage through the Orc Deep. Kill 125.",
    goal: { kinds: ["orcBerserker"], need: 125 }, reward: D, reqLevel: 33,
  },
  {
    id: "t_warlords", title: "Warlords",
    desc: "Warlords command the Bandit Deep's warbands. Kill 125.",
    goal: { kinds: ["warlord"], need: 125 }, reward: D, reqLevel: 35,
  },
  {
    id: "t_minoguards", title: "Horned Guard",
    desc: "Minotaur guards wall off the deepest halls. Break 125.",
    goal: { kinds: ["minotaurGuard"], need: 125 }, reward: D, reqLevel: 36,
  },

  /* ---- band E: a hundred and fifty a piece ---- */
  {
    id: "t_chieftains", title: "Chieftains",
    desc: "Chieftains hold the Bandit Deep's lowest halls. Kill 150.",
    goal: { kinds: ["chieftain"], need: 150 }, reward: E, reqLevel: 40,
  },
  {
    id: "t_demonskeletons", title: "Demon Skeletons",
    desc: "The worst of the Charnel Deep. Break 150 apart.",
    goal: { kinds: ["demonSkeleton"], need: 150 }, reward: E, reqLevel: 41,
  },
  {
    id: "t_warband", title: "The Warband",
    desc: "Barbarians, raiders, warlords, chieftains — any of them. Clear 200.",
    goal: { kinds: ["barbarian", "raider", "warlord", "chieftain"], need: 200 },
    reward: { points: 6, gold: 3400, exp: 24000 }, reqLevel: 38,
  },
];

/* ---------------- runtime state (persisted via save.ts) ---------------- */

/**
 * This character's board. Lives on PlayerState, not in a module `let`, so a
 * process can run more than one character at a time.
 *
 * `claims` is the whole repeat mechanism: it counts hand-ins per entry, and
 * the threshold for the next one is `need x (claims + 1)`. There is no stored
 * progress anywhere — progress is the ledger minus what has been paid for,
 * which is why abandoning an errand cannot lose anything.
 */
const rt = {
  get active() { return activeState().tasks.active; },
  set active(v: string[]) { activeState().tasks.active = v; },
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

/**
 * Whether the board offers this entry to a character of that level.
 *
 * An entry in hand is always offered, whatever the level: falling out of the
 * window must never strand a half-finished errand on the board.
 */
export function isTaskUnlocked(def: TaskDef, level: number): boolean {
  if (isActive(def.id)) return true;
  return level >= def.reqLevel && level - def.reqLevel <= TASK_WINDOW;
}

/** Everything the board shows this character, in catalogue order. */
export function offeredTasks(level: number): TaskDef[] {
  return TASKS.filter((t) => isTaskUnlocked(t, level));
}

/** Kills toward the CURRENT hand-in: the ledger, less what is already paid. */
export function progressOf(def: TaskDef): number {
  const paid = claimsOf(def.id) * def.goal.need;
  const have = killCountOf(def.goal.kinds) - paid;
  return Math.max(0, Math.min(have, def.goal.need));
}

export function isComplete(def: TaskDef): boolean {
  return progressOf(def) >= def.goal.need;
}

/**
 * Take an errand. Fails if it is already in hand, the three slots are full, or
 * the board does not offer it at this level.
 *
 * Note what it does NOT do: it takes no snapshot and zeroes nothing. Kills
 * made before the errand was taken already count, which is the point — a
 * character who has been hunting orcs all week can take the orc errand and
 * hand it in on the spot.
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
 * The entry leaves the active list on success and can be taken again at once:
 * with two hundred orcs in the ledger and a hundred asked for, the second
 * hand-in is already waiting.
 */
export function handInTask(p: Player, id: string, giveExp: (n: number) => void): HandInResult | null {
  const def = taskById(id);
  if (!def || !isActive(id) || !isComplete(def)) return null;
  if (!rewardFits(p, def)) return null;
  const time = claimsOf(def.id) + 1;
  rt.claims = { ...rt.claims, [def.id]: time };
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
  return { active: [...rt.active], claims: { ...rt.claims }, earned: rt.earned };
}

/**
 * Restore the board, accepting the old single-errand shape.
 *
 * A legacy `activeId` survives if the catalogue still carries that id — the
 * six kill errands kept their ids for exactly this reason. Its `kills` tally
 * is dropped rather than migrated: it counted toward a goal of eight, the
 * ledger it would have to move into counts every kill ever made, and seeding
 * one from the other would either invent kills or lose them. Nothing is lost
 * that the ledger will not earn back.
 */
export function loadTaskState(s: (Partial<TaskSave> & LegacyTaskSave) | undefined): void {
  rt.active = [];
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

  if (s.claims && typeof s.claims === "object") {
    const out: Record<string, number> = {};
    for (const [id, n] of Object.entries(s.claims)) {
      if (taskById(id) && typeof n === "number" && Number.isFinite(n) && n > 0) {
        out[id] = Math.floor(n);
      }
    }
    rt.claims = out;
  }
}

export function resetTasks(): void {
  rt.active = [];
  rt.claims = {};
  rt.earned = 0;
}
