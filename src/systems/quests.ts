/** A small quest chain. Quests advance on game events and reward the player. */
import type { MonsterKind } from "../world/types.ts";
import type { Player } from "../entities/player.ts";
import { addItem, bagCount, bagRoomFor, giveGold, walletRoomFor } from "../items.ts";
import type { ItemKind } from "../items.ts";
import { active } from "./playerState.ts";

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

/**
 * The quest chain of whichever character is active.
 *
 * A FUNCTION, not an exported array: the chain is progress, and progress
 * belongs to a character, so it lives on PlayerState. The pristine copy is
 * built by `defaultQuests()` in playerState.ts — kept there rather than here
 * so this module can import `active()` without the two files forming a value
 * cycle.
 */
export function questList(): Quest[] {
  return active().quests;
}

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
  for (const q of questList()) {
    if (!q.done && q.goal.kind === "kill" && q.goal.monster === kind) {
      q.progress++;
      bump(q, fx);
    }
  }
}

export function onItemCollected(item: ItemKind, n: number, fx?: QuestFx): void {
  for (const q of questList()) {
    if (!q.done && q.goal.kind === "collect" && q.goal.item === item) {
      q.progress += n;
      bump(q, fx);
    }
  }
}

export function onStructureBuilt(struct: string, fx?: QuestFx): void {
  for (const q of questList()) {
    if (!q.done && q.goal.kind === "build" && q.goal.struct === struct) {
      q.progress = 1;
      bump(q, fx);
    }
  }
}

/** Sync collect-quests to the current bag total (called after any pickup). */
export function syncCollectQuests(p: Player, fx?: QuestFx): void {
  for (const q of questList()) {
    if (!q.done && q.goal.kind === "collect") {
      q.progress = Math.max(q.progress, bagCount(p.bag, q.goal.item));
      bump(q, fx);
    }
  }
}

export type ClaimResult = "ok" | "full" | "no";

/**
 * Claim a finished quest's reward. Returns "full" (and changes nothing) if an
 * item reward wouldn't fit in the bag, so rewards are never silently lost.
 * Experience is granted through `giveExp` so level-ups run through the normal
 * combat path (refreshDerived, level-up fanfare, etc.).
 */
export function claimQuest(p: Player, q: Quest, giveExp?: (n: number) => void, fx?: QuestFx): ClaimResult {
  if (!q.done || q.claimed) return "no";
  const r = q.reward;
  if (r.item && !bagRoomFor(p.bag, r.item, r.itemN ?? 1)) return "full";
  // Coin needs a slot like anything else now. Without this the purse simply
  // evaporates against a full pack — and unlike a dropped item there is no
  // pile on the floor to go back for, because it was never minted.
  if (r.gold && !walletRoomFor(p.bag, r.gold)) return "full";
  if (r.gold) giveGold(p.bag, r.gold);
  if (r.item) addItem(p.bag, r.item, r.itemN ?? 1);
  q.claimed = true;
  fx?.(`Reward claimed: ${q.title}`);
  if (r.exp) giveExp?.(r.exp);
  return "ok";
}

/** Reset the whole chain to its pristine state (used when starting a new game). */
export function resetQuests(): void {
  for (const q of questList()) {
    q.progress = 0;
    q.done = false;
    q.claimed = false;
  }
}
