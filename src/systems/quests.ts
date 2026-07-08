/** A small quest chain. Quests advance on game events and reward the player. */
import type { MonsterKind } from "../world/types.ts";
import type { Player } from "../entities/player.ts";
import { addItem, bagCount } from "../items.ts";
import type { ItemKind } from "../items.ts";

export type QuestGoal =
  | { kind: "kill"; monster: MonsterKind; need: number }
  | { kind: "collect"; item: ItemKind; need: number }
  | { kind: "build"; struct: string };

export interface Quest {
  id: string;
  title: string;
  desc: string;
  goal: QuestGoal;
  reward: { gold?: number; item?: ItemKind; itemN?: number; exp?: number };
  progress: number;
  done: boolean;
  claimed: boolean;
}

export const quests: Quest[] = [
  {
    id: "q1", title: "Pest Control",
    desc: "The road to the Wildlands crawls with spiders. Cull 5 of them.",
    goal: { kind: "kill", monster: "spider", need: 5 },
    reward: { gold: 20, exp: 30 },
    progress: 0, done: false, claimed: false,
  },
  {
    id: "q2", title: "Rattle the Bones",
    desc: "Skeletons haunt the ruins. Bring peace to 6 of them.",
    goal: { kind: "kill", monster: "skeleton", need: 6 },
    reward: { item: "sword", itemN: 1, exp: 50 },
    progress: 0, done: false, claimed: false,
  },
  {
    id: "q3", title: "Stock the Forge",
    desc: "The smith needs raw stone. Gather 20 stone.",
    goal: { kind: "collect", item: "stone", need: 20 },
    reward: { gold: 30, exp: 40 },
    progress: 0, done: false, claimed: false,
  },
  {
    id: "q4", title: "A Roof of Your Own",
    desc: "Build a Forge on your Home Isle to craft real gear.",
    goal: { kind: "build", struct: "forge" },
    reward: { item: "hpPotion", itemN: 3, exp: 60 },
    progress: 0, done: false, claimed: false,
  },
  {
    id: "q5", title: "Troll Toll",
    desc: "Deep in the Wildlands lurk trolls. Slay 3 to prove your strength.",
    goal: { kind: "kill", monster: "troll", need: 3 },
    reward: { item: "amulet", itemN: 1, gold: 100, exp: 200 },
    progress: 0, done: false, claimed: false,
  },
];

export type QuestFx = (text: string) => void;

function bump(q: Quest, fx?: QuestFx): void {
  if (q.done) return;
  const need = q.goal.kind === "build" ? 1 : q.goal.need;
  if (q.progress >= need) {
    q.done = true;
    fx?.(`Quest complete: ${q.title}`);
  }
}

export function onMonsterKilled(kind: MonsterKind, fx?: QuestFx): void {
  for (const q of quests) {
    if (!q.done && q.goal.kind === "kill" && q.goal.monster === kind) {
      q.progress++;
      bump(q, fx);
    }
  }
}

export function onItemCollected(item: ItemKind, n: number, fx?: QuestFx): void {
  for (const q of quests) {
    if (!q.done && q.goal.kind === "collect" && q.goal.item === item) {
      q.progress += n;
      bump(q, fx);
    }
  }
}

export function onStructureBuilt(struct: string, fx?: QuestFx): void {
  for (const q of quests) {
    if (!q.done && q.goal.kind === "build" && q.goal.struct === struct) {
      q.progress = 1;
      bump(q, fx);
    }
  }
}

/** Sync collect-quests to the current bag total (called after any pickup). */
export function syncCollectQuests(p: Player, fx?: QuestFx): void {
  for (const q of quests) {
    if (!q.done && q.goal.kind === "collect") {
      q.progress = Math.max(q.progress, bagCount(p.bag, q.goal.item));
      bump(q, fx);
    }
  }
}

/** Claim a finished quest's reward. Returns true on success. */
export function claimQuest(p: Player, q: Quest, fx?: QuestFx): boolean {
  if (!q.done || q.claimed) return false;
  const r = q.reward;
  if (r.gold) p.gold += r.gold;
  if (r.item) addItem(p.bag, r.item, r.itemN ?? 1);
  q.claimed = true;
  fx?.(`Reward claimed: ${q.title}`);
  return true;
}
