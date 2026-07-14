/**
 * Repeatable board tasks (Grizzly Adams style). You take one task at a time from
 * the Huntress in Bonetown, hunt or gather toward it, then hand it in for gold,
 * xp and Task Points — a separate currency. Task Points are spent at the same
 * board to buy rare materials (a Fire Ruby to gate Alchemy Tower research, heavy
 * arrows, ready-made crystals), which closes the loop back into Etap 4.
 *
 * Kill tasks track progress over time (kills only count while the task is
 * active). Collect tasks are deliveries: the items are consumed on hand-in.
 * Only one task is active at a time — a deliberate, easily-expanded choice.
 */
import { addItem, removeItem, bagCount, bagRoomFor } from "../items.ts";
import { canCarry } from "../entities/player.ts";
import type { ItemKind, Bag } from "../items.ts";
import type { MonsterKind } from "../world/types.ts";
import type { Player } from "../entities/player.ts";

export type TaskGoal =
  | { kind: "kill"; monster: MonsterKind; need: number }
  | { kind: "collect"; item: ItemKind; need: number };

export interface TaskReward {
  /** Task Points granted — the board currency. */
  points: number;
  gold?: number;
  exp?: number;
  item?: ItemKind;
  itemN?: number;
}

export interface TaskDef {
  id: string;
  title: string;
  desc: string;
  goal: TaskGoal;
  reward: TaskReward;
  /** Total Task Points you must have *earned* over time before this unlocks. */
  reqPoints: number;
}

/** The task catalogue, loosely tiered by lifetime points earned. */
export const TASKS: readonly TaskDef[] = [
  // --- Tier 0 ---
  {
    id: "t_spiders", title: "Cobweb Cull",
    desc: "Spiders choke the trail. Put down 8 of them.",
    goal: { kind: "kill", monster: "spider", need: 8 },
    reward: { points: 2, gold: 25, exp: 40 }, reqPoints: 0,
  },
  {
    id: "t_wood", title: "Timber Run",
    desc: "The palisade needs lumber. Deliver 15 wood.",
    goal: { kind: "collect", item: "wood", need: 15 },
    reward: { points: 2, gold: 30 }, reqPoints: 0,
  },
  {
    id: "t_skeletons", title: "Bone Sweep",
    desc: "Skeletons rattle through the ruins. Break 8 apart.",
    goal: { kind: "kill", monster: "skeleton", need: 8 },
    reward: { points: 2, gold: 30, exp: 55 }, reqPoints: 0,
  },
  // --- Tier 1 (needs 6 lifetime points) ---
  {
    id: "t_goblins", title: "Goblin Bounty",
    desc: "Goblins raid the outskirts. Hunt down 10.",
    goal: { kind: "kill", monster: "goblin", need: 10 },
    reward: { points: 3, gold: 60, exp: 100 }, reqPoints: 6,
  },
  {
    id: "t_stone", title: "Quarry Order",
    desc: "The mason is short on stone. Deliver 20.",
    goal: { kind: "collect", item: "stone", need: 20 },
    reward: { points: 3, gold: 50 }, reqPoints: 6,
  },
  {
    id: "t_orcs", title: "Orc Warband",
    desc: "An orc pack presses the border. Cut down 8.",
    goal: { kind: "kill", monster: "orc", need: 8 },
    reward: { points: 4, gold: 90, exp: 150 }, reqPoints: 6,
  },
  // --- Tier 2 (needs 16 lifetime points) ---
  {
    id: "t_ghosts", title: "Restless Dead",
    desc: "Ghosts drift the deep Wildlands. Banish 12.",
    goal: { kind: "kill", monster: "ghost", need: 12 },
    reward: { points: 5, gold: 130, exp: 240, item: "boneArrow", itemN: 20 }, reqPoints: 16,
  },
  {
    id: "t_trolls", title: "Troll Trophy",
    desc: "Slay 6 trolls. The Huntress pays in rubies.",
    goal: { kind: "kill", monster: "troll", need: 6 },
    reward: { points: 6, gold: 220, exp: 420, item: "fireRuby", itemN: 1 }, reqPoints: 16,
  },
];

/** Spend Task Points here for rare materials that feed the Alchemy Tower. */
export interface Exchange {
  id: string;
  item: ItemKind;
  itemN: number;
  cost: number; // task points
  desc: string;
}
export const EXCHANGES: readonly Exchange[] = [
  { id: "x_ruby", item: "fireRuby", itemN: 1, cost: 8, desc: "Gate material for tower research" },
  { id: "x_arrows", item: "boneArrow", itemN: 50, cost: 3, desc: "A full quiver of heavy arrows" },
  { id: "x_spears", item: "spearCrystal", itemN: 5, cost: 10, desc: "Ready-made spear charges" },
];

/* ---------------- runtime state (persisted via save.ts) ---------------- */

interface TaskRuntime {
  activeId: string | null;
  /** Kill progress for the active kill-task (collect-tasks read the bag). */
  kills: number;
  /** Lifetime Task Points earned — used to gate higher-tier tasks. */
  earned: number;
}
const rt: TaskRuntime = { activeId: null, kills: 0, earned: 0 };

export function taskById(id: string): TaskDef | undefined {
  return TASKS.find((t) => t.id === id);
}
export function activeTask(): TaskDef | null {
  return rt.activeId ? taskById(rt.activeId) ?? null : null;
}
export function pointsEarned(): number {
  return rt.earned;
}
/** A task is available once you've earned enough lifetime points to unlock it. */
export function isTaskUnlocked(def: TaskDef): boolean {
  return rt.earned >= def.reqPoints;
}

/** Current progress toward a task's goal (kills tracked; collect reads the bag). */
export function progressOf(def: TaskDef, bag: Bag): number {
  if (def.goal.kind === "kill") return Math.min(rt.kills, def.goal.need);
  return Math.min(bagCount(bag, def.goal.item), def.goal.need);
}
export function isComplete(def: TaskDef, bag: Bag): boolean {
  return progressOf(def, bag) >= def.goal.need;
}

/** Take a task. Fails if one is already active or it isn't unlocked yet. */
export function acceptTask(id: string): boolean {
  if (rt.activeId) return false;
  const def = taskById(id);
  if (!def || !isTaskUnlocked(def)) return false;
  rt.activeId = id;
  rt.kills = 0;
  return true;
}
export function abandonTask(): void {
  rt.activeId = null;
  rt.kills = 0;
}

/** Count a kill toward the active task (called from combat on every kill). */
export function onTaskKill(monster: MonsterKind): void {
  const def = activeTask();
  if (def && def.goal.kind === "kill" && def.goal.monster === monster && rt.kills < def.goal.need) {
    rt.kills++;
  }
}

/**
 * Whether the active task can be handed in without losing its item reward —
 * checks both bag slots and carry weight. Collect-tasks skip the checks: the
 * delivered items are consumed first, which frees slots and weight.
 */
export function rewardFits(p: Player, def: TaskDef): boolean {
  const r = def.reward;
  if (!r.item) return true;
  if (def.goal.kind === "collect") return true;
  const n = r.itemN ?? 1;
  return bagRoomFor(p.bag, r.item, n) && canCarry(p, r.item, n);
}

export interface HandInResult {
  title: string;
  reward: TaskReward;
}
/**
 * Hand in the active task. Consumes delivered items for collect-tasks, grants
 * gold/points/item directly, and defers xp to `giveExp` (so level-ups run through
 * combat). Returns the result, or null if there's no complete task or no room.
 */
export function handInTask(p: Player, giveExp: (n: number) => void): HandInResult | null {
  const def = activeTask();
  if (!def || !isComplete(def, p.bag)) return null;
  if (!rewardFits(p, def)) return null;
  if (def.goal.kind === "collect") removeItem(p.bag, def.goal.item, def.goal.need);
  const r = def.reward;
  p.taskPoints += r.points;
  rt.earned += r.points;
  if (r.gold) p.gold += r.gold;
  if (r.item) addItem(p.bag, r.item, r.itemN ?? 1);
  if (r.exp) giveExp(r.exp);
  rt.activeId = null;
  rt.kills = 0;
  return { title: def.title, reward: r };
}

export type ExchangeResult = "ok" | "poor" | "full" | "heavy" | "none";
/** Spend Task Points on a rare-material bundle. */
export function buyExchange(p: Player, id: string): ExchangeResult {
  const e = EXCHANGES.find((x) => x.id === id);
  if (!e) return "none";
  if (p.taskPoints < e.cost) return "poor";
  if (!canCarry(p, e.item, e.itemN)) return "heavy";
  if (!bagRoomFor(p.bag, e.item, e.itemN)) return "full";
  p.taskPoints -= e.cost;
  addItem(p.bag, e.item, e.itemN);
  return "ok";
}

/* ---------------- save / load ---------------- */

export interface TaskSave {
  activeId: string | null;
  kills: number;
  earned: number;
}
export function taskState(): TaskSave {
  return { activeId: rt.activeId, kills: rt.kills, earned: rt.earned };
}
export function loadTaskState(s: Partial<TaskSave> | undefined): void {
  rt.activeId = s?.activeId ?? null;
  rt.kills = s?.kills ?? 0;
  rt.earned = s?.earned ?? 0;
  // guard against a saved active id that no longer exists in the catalogue
  if (rt.activeId && !taskById(rt.activeId)) { rt.activeId = null; rt.kills = 0; }
}
export function resetTasks(): void {
  rt.activeId = null;
  rt.kills = 0;
  rt.earned = 0;
}
