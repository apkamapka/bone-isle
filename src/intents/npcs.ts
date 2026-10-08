/**
 * The task board and the Task Points shelf at the taskmaster, and the
 * Wardrobe at the tailor (Etap 3.1c moved this here from main.ts).
 *
 * Each is asked over a counter, so each is refused to a player who is not
 * standing at it — the window closes behind anyone who walks off, and a
 * request is held to the same reach.
 */
import type { Game } from "../game.ts";
import { MAX_ACTIVE, acceptTask, abandonTask, handInTask, taskById, hasRoomForTask, isActive, isComplete, rewardFits, maxActive } from "../systems/tasks.ts";
import { buyShelf, shelfEntry, shelfLabel, RANKS } from "../systems/shelf.ts";
import { setOutfitColor, resetOutfitColors, wearOutfit, type OutfitZone } from "../systems/outfit.ts";
import { grantExp } from "../systems/combat.ts";
import { sound, tone } from "../systems/fxEvents.ts";
import { tell, nearNpc } from "./actor.ts";

/** Standing at the taskmaster's board? */
function atBoard(g: Game): boolean {
  if (nearNpc(g, (n) => n.key === "taskmaster")) return true;
  tell(g, "too far away", "#d96a5a");
  return false;
}

/** Standing at the tailor's Wardrobe? */
function atWardrobe(g: Game): boolean {
  if (nearNpc(g, (n) => n.key === "tailor")) return true;
  tell(g, "too far away", "#d96a5a");
  return false;
}

/** Take task `id` off the board. */
export function takeTask(g: Game, id: string): void {
  const P = g.player;
  if (!atBoard(g)) return;
  if (acceptTask(id, P.level)) { tell(g, "task accepted", "#9ad0ff"); tone(440, 0.12, "sine", 0.05, 120); }
  /* The only reason a legal entry is ever refused: three is the ceiling.
   * Say which one it is rather than "no", because the fix is a click away. */
  else if (!hasRoomForTask() && !isActive(id)) tell(g, maxActive() > MAX_ACTIVE ? "four tasks is the limit" : "three tasks is the limit", "#e0a06a");
}

/** Give task `id` back. The kills already made still count. */
export function dropTask(g: Game, id: string): void {
  if (!atBoard(g)) return;
  if (abandonTask(id)) { tell(g, "task dropped · kills still count", "#e0a06a"); tone(240, 0.1, "triangle", 0.05, -80); }
}

/** Hand task `id` in for its Task Points, purse and experience. */
export function turnInTask(g: Game, id: string): void {
  const P = g.player;
  if (!atBoard(g)) return;
  const res = handInTask(P, id, (xp) => grantExp(g.current, P, xp));
  if (res) {
    tell(g, res.points > 0 ? `+${res.points} TP · ${res.title}` : `${res.title} · no TP at your level`, "#9fe8a8");
    sound("reward");
  } else {
    /* Two ways to get here and they need different advice: an unfinished
     * errand, or a finished one whose purse has nowhere to go. */
    const def = taskById(id);
    const full = !!def && isComplete(def) && !rewardFits(P, def);
    tell(g, full ? "no room for the purse" : "not ready to hand in", "#e0a06a");
  }
}

/** Spend Task Points on shelf entry `id`. */
export function buyFromShelf(g: Game, id: string): void {
  const P = g.player;
  if (!atBoard(g)) return;
  const r = buyShelf(P, id);
  if (r.ok) {
    tell(g, `${shelfLabel(r.entry)} · −${r.entry.price} TP`, "#9fe8a8");
    sound("reward");
    return;
  }
  const e = shelfEntry(id);
  const why = r.why === "rank" && e ? `needs the rank of ${RANKS[e.rank].name}`
    : r.why === "points" ? "not enough Task Points"
    : r.why === "owned" ? "already yours"
    : r.why === "heavy" ? "too heavy"
    : r.why === "full" ? "bag full"
    : "";
  if (why) tell(g, why, "#e0a06a");
}

/** Put on outfit `id`, if it is one the character owns. */
export function changeOutfit(g: Game, id: string): void {
  if (!atWardrobe(g)) return;
  if (wearOutfit(id)) tone(480, 0.05, "sine", 0.04, 60);
}

/** Dye one zone of the outfit with colour `idx`. */
export function dyeOutfit(g: Game, zone: OutfitZone, idx: number): void {
  if (!atWardrobe(g)) return;
  setOutfitColor(zone, idx);
  tone(480, 0.05, "sine", 0.04, 60);
}

/** Wash every dye out, back to the classic look. */
export function resetDyes(g: Game): void {
  if (!atWardrobe(g)) return;
  resetOutfitColors();
  tell(g, "back to the classic look", "#e8dcc0");
  tone(360, 0.08, "sine", 0.04);
}
