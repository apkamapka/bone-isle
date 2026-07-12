/**
 * Action slots: the abstraction behind hotkeys 1–6 (desktop) and the on-screen
 * action buttons (mobile). Each slot points at something the player can trigger
 * — for now a crystal, later a weapon swap or a plain attack. Building it as a
 * single indirection now means the mobile rebind UI (a later stage) only has to
 * mutate this array; every input path already reads through it.
 */
import type { ItemKind } from "../items.ts";

export type SlotAction =
  | { type: "crystal"; item: ItemKind }
  | { type: "attack" }
  | { type: "swap" };

export const ACTION_SLOTS = 6;

/**
 * The live binding. Default layout for now: the three crystals in slots 1–3,
 * the rest empty. A rebinding UI will overwrite these entries later.
 */
export const actionSlots: (SlotAction | null)[] = [
  { type: "crystal", item: "healCrystal" },
  { type: "crystal", item: "fireCrystal" },
  { type: "crystal", item: "recallCrystal" },
  null,
  null,
  null,
];

export function slotAt(i: number): SlotAction | null {
  return i >= 0 && i < actionSlots.length ? actionSlots[i] : null;
}

export function setSlot(i: number, a: SlotAction | null): void {
  if (i >= 0 && i < actionSlots.length) actionSlots[i] = a;
}
