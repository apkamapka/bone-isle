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

/**
 * The hotbar grows and shrinks a ROW at a time.
 *
 * Six was never a considered number, it was the number the first bar happened
 * to have. A player who has attuned to two elements wants four attack crystals
 * and still wants heal, recall and the weapon swap — that is seven things in
 * six holes. Rather than pick a bigger fixed number and be wrong in the other
 * direction for everyone else, the bar is adjustable.
 *
 * A ROW at a time, not one at a time: six is the phone deck's width, so every
 * step adds exactly one line of buttons on both interfaces and there is never
 * a ragged half-row to lay out.
 */
export const ACTION_SLOT_STEP = 6;
export const ACTION_SLOTS_MIN = 6;
/**
 * Four rows. Past this the deck is eating half the phone, and a hotbar you
 * have to read rather than know by position has stopped being a hotbar.
 */
export const ACTION_SLOTS_MAX = 24;

/**
 * The array is always MAX long; `count` is how much of it is in play.
 *
 * Allocating the maximum up front rather than resizing is what makes shrinking
 * non-destructive: drop from twelve to six, change your mind, and the six
 * bindings you had are still there. Resizing the array would have thrown them
 * away, and "I lost my hotkeys by tapping minus" is a worse bug than any this
 * feature fixes.
 */
export const ACTION_SLOTS = ACTION_SLOTS_MAX;

let count = ACTION_SLOTS_MIN;

/** How many slots the player currently has. */
export function actionSlotCount(): number {
  return count;
}

/** Set it directly (loading a save). Clamped and rounded to a whole row. */
export function setActionSlotCount(n: number): void {
  const rows = Math.round(n / ACTION_SLOT_STEP);
  count = Math.max(ACTION_SLOTS_MIN,
    Math.min(ACTION_SLOTS_MAX, rows * ACTION_SLOT_STEP));
}

/** Add a row. False when already at the ceiling, so the caller can say so. */
export function addActionSlots(): boolean {
  if (count >= ACTION_SLOTS_MAX) return false;
  count += ACTION_SLOT_STEP;
  return true;
}

/** Drop a row. False at the floor — there is always at least one. */
export function removeActionSlots(): boolean {
  if (count <= ACTION_SLOTS_MIN) return false;
  count -= ACTION_SLOT_STEP;
  return true;
}

/**
 * The live binding. Default layout: the two utility crystals in slots 1–2,
 * the rest empty and waiting for whichever element the player attunes to.
 * A fresh character genuinely has no attack binding, and that is deliberate.
 */
export const actionSlots: (SlotAction | null)[] = Array.from(
  { length: ACTION_SLOTS },
  (_, i): SlotAction | null => {
    if (i === 0) return { type: "crystal", item: "healCrystal" };
    if (i === 1) return { type: "crystal", item: "recallCrystal" };
    return null;
  },
);

/**
 * What slot `i` triggers — null past the end of the visible bar.
 *
 * The bound-but-hidden tail is deliberately unreachable. A key press that
 * fired a crystal from a row the player had removed would be a ghost, and the
 * whole reason the tail is kept is that it is NOT in play until the row comes
 * back.
 */
export function slotAt(i: number): SlotAction | null {
  return i >= 0 && i < count ? actionSlots[i] : null;
}

export function setSlot(i: number, a: SlotAction | null): void {
  if (i >= 0 && i < count) actionSlots[i] = a;
}

/** Snapshot the current bindings for saving — the whole array, tail included. */
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
