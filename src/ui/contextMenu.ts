/**
 * The long-press menu.
 *
 * WHY IT EXISTS
 * -------------
 * One tap cannot carry the verbs this game already has, never mind the ones
 * multiplayer adds. Today a tap on a creature means attack, on a body means
 * loot, on an NPC means talk — the object decides the verb, and every object
 * gets exactly one. That works right up until an object has two: another
 * player is someone you might attack, or message, or trade with, or simply
 * look at, and no amount of cleverness picks the right one from a tap.
 *
 * Tibia's answer is the right-click menu. On a phone the equivalent gesture is
 * the long press, and it is free here — nothing in this game used it.
 *
 * WHY IT IS BUILT NOW, WITH ENTRIES THAT DO NOTHING
 * -------------------------------------------------
 * "Trade" is in the list and greyed out. That is deliberate. The alternative
 * is shipping the menu with three entries and adding two more later, which
 * teaches the player a shape and then changes it; a greyed entry teaches the
 * final shape immediately and explains itself when pressed. It also keeps the
 * decision honest — the menu had to be designed around the verbs it will
 * eventually hold, not the ones that happen to work this month.
 *
 * The verbs a long press on another PLAYER will need: look, attack, trade,
 * message, and later invite-to-party. Four to five entries plus the two
 * ground verbs is seven, which is why the menu is a list rather than a radial
 * — a radial reads beautifully at four and becomes a dartboard at seven.
 */
import type { Vec } from "../world/types.ts";

export type MenuVerb =
  | "walk"
  | "attack"
  | "look"
  | "loot"
  | "take"
  | "talk"
  | "trade"
  | "use";

export interface MenuEntry {
  verb: MenuVerb;
  label: string;
  /**
   * Live, or waiting for a second player? A disabled entry is drawn dim and
   * says why when pressed, rather than being silently absent.
   */
  enabled: boolean;
  /** Shown when a disabled entry is pressed. */
  why?: string;
  run?: () => void;
}

export interface ContextMenu {
  /** Where the finger went down, in device px — the menu hangs off this. */
  sx: number;
  sy: number;
  /** The world point under the finger, for the "walk here" entry. */
  at: Vec;
  entries: MenuEntry[];
  /** Filled in at draw time so the tap handler knows what it drew. */
  rects: { x: number; y: number; w: number; h: number; i: number }[];
}

/**
 * The verbs that always apply to a patch of ground.
 *
 * "Walk here" is first and always present. A menu whose contents depend
 * entirely on what you hit is a menu you cannot predict, and the one thing a
 * player can always do with a tile is stand on it — so there is always at
 * least one entry, and it is always in the same place.
 */
export function groundEntries(walk: () => void, look: () => void): MenuEntry[] {
  return [
    { verb: "walk", label: "Walk here", enabled: true, run: walk },
    { verb: "look", label: "Look", enabled: true, run: look },
  ];
}
