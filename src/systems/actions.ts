/**
 * Action slots: the abstraction behind hotkeys 1–6 (desktop) and the on-screen
 * action buttons (mobile). Each slot points at something the player can trigger
 * — for now a crystal, later a weapon swap or a plain attack. Building it as a
 * single indirection now means the mobile rebind UI (a later stage) only has to
 * mutate this array; every input path already reads through it.
 */
import type { ItemKind } from "../items.ts";
import { ITEMS } from "../items.ts";

export type SlotAction =
  | { type: "crystal"; item: ItemKind }
  | { type: "attack" }
  | { type: "swap" };

export const ACTION_SLOTS = 6;

/**
 * The live binding. Default layout: the two utility crystals in slots 1–2,
 * the rest empty and waiting for whichever element the player attunes to.
 * A fresh character genuinely has no attack binding, and that is deliberate.
 */
export const actionSlots: (SlotAction | null)[] = [
  { type: "crystal", item: "healCrystal" },
  { type: "crystal", item: "recallCrystal" },
  null,
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

/** Snapshot the current bindings for saving. */
export function serializeSlots(): (SlotAction | null)[] {
  return actionSlots.map((s) => (s ? { ...s } : null));
}

/** Restore bindings from a save (validates crystal kinds against the registry). */
export function loadSlots(data: unknown): void {
  if (!Array.isArray(data)) return;
  for (let i = 0; i < ACTION_SLOTS; i++) {
    const s = data[i] as { type?: string; item?: string } | null | undefined;
    if (s && typeof s === "object" && typeof s.type === "string") {
      if (s.type === "crystal" && typeof s.item === "string" && s.item in ITEMS && ITEMS[s.item as ItemKind].crystal) {
        actionSlots[i] = { type: "crystal", item: s.item as ItemKind };
      } else if (s.type === "swap") {
        actionSlots[i] = { type: "swap" };
      } else if (s.type === "attack") {
        actionSlots[i] = { type: "attack" };
      } else {
        actionSlots[i] = null;
      }
    } else {
      actionSlots[i] = null;
    }
  }
}

/**
 * Crystal kinds that can be bound to a slot (used by the mobile rebind picker).
 *
 * Derived from the registry now rather than listed by hand. With the two
 * originals gone, a hard-coded list would have left the player no offensive
 * binding at all — every attack crystal in the game is elemental, so every
 * elemental crystal has to be bindable.
 */
export const BINDABLE_CRYSTALS: readonly ItemKind[] =
  (Object.keys(ITEMS) as ItemKind[]).filter((k) => ITEMS[k].crystal);
