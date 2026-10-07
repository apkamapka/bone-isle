/**
 * Grizelda's shelf (Etap 92): what Task Points buy.
 *
 * RANKS ARE LIFETIME, PRICES ARE SPENDABLE. A rank is read off every point a
 * character has ever been paid (`pointsEarned`, which nothing reduces), and it
 * opens a part of the shelf; the price comes out of the points in hand. So
 * buying never costs a rank, and a rank is a record of hunting rather than of
 * thrift. The five steps are Grizzly Adams' own, 10 / 20 / 40 / 70 / 100, and
 * against the board's pay they land near levels 15, 22, 30, 40 and 50 for a
 * character who always has the right errand in hand.
 *
 * THE POINT ECONOMY. Every kill on an errand, levels 1 to 50, pays about a
 * hundred points; a real character, who is not always on an errand, nearer
 * seventy. Everything here that is kept comes to 270, so at the cap a
 * character owns about a third of it and the rest is what the points are for
 * afterwards; the blessing spends them for as long as anyone dies. Two rules
 * hold that together and both live elsewhere: an errand far below the
 * character pays no points (`pointsFor` in tasks.ts), and nothing bought here
 * can be sold (value 0 in items.ts).
 *
 * The rings sit BESIDE the three from the mission hoards, not above them, and
 * the necklaces share their slot with the Amulet of Loss — see items.ts.
 */
import { ITEMS, addItem, type ItemKind } from "../items.ts";
import { canCarry, type Player } from "../entities/player.ts";
import { pointsEarned, extraSlots, grantExtraSlot } from "./tasks.ts";
import { OUTFITS, ownsOutfit, grantOutfit } from "./outfit.ts";

export interface Rank {
  name: string;
  /** Lifetime Task Points that reach it. */
  at: number;
}

export const RANKS: readonly Rank[] = [
  { name: "Huntsman", at: 10 },
  { name: "Ranger", at: 20 },
  { name: "Big Game Hunter", at: 40 },
  { name: "Trophy Hunter", at: 70 },
  { name: "Elite Hunter", at: 100 },
];

/** Index into RANKS of the rank this many lifetime points reach; -1 below the first. */
export function rankIndex(earned: number = pointsEarned()): number {
  let r = -1;
  RANKS.forEach((k, i) => { if (earned >= k.at) r = i; });
  return r;
}

/** The rank after the one held, or null at the top. */
export function nextRank(earned: number = pointsEarned()): Rank | null {
  return RANKS[rankIndex(earned) + 1] ?? null;
}

export type ShelfGood =
  | { type: "item"; item: ItemKind }
  /** An outfit for the Wardrobe, by its key in OUTFITS. */
  | { type: "outfit"; outfit: string }
  /** A fourth errand in hand, for good. */
  | { type: "slot" };

export interface ShelfEntry {
  id: string;
  good: ShelfGood;
  /** Index into RANKS: the rank that opens it. */
  rank: number;
  /** Task Points. */
  price: number;
}

const item = (k: ItemKind, rank: number, price: number): ShelfEntry =>
  ({ id: k, good: { type: "item", item: k }, rank, price });

/** The stock, lowest rank first. Nothing else in the game sells any of it. */
export const SHELF: readonly ShelfEntry[] = [
  item("fangNecklace", 0, 8),
  item("blessingScroll", 0, 6),
  item("stalkerRing", 1, 15),
  { id: "outfitRanger", good: { type: "outfit", outfit: "ranger" }, rank: 1, price: 12 },
  item("bowyerRing", 2, 25),
  item("hornNecklace", 2, 25),
  { id: "taskSlot", good: { type: "slot" }, rank: 2, price: 30 },
  item("wardenRing", 3, 35),
  item("huntressSignet", 4, 60),
  item("trophyNecklace", 4, 60),
];

export function shelfEntry(id: string): ShelfEntry | undefined {
  return SHELF.find((e) => e.id === id);
}

/** What the row is called. */
export function shelfLabel(e: ShelfEntry): string {
  const g = e.good;
  if (g.type === "item") return ITEMS[g.item].name;
  if (g.type === "outfit") return `${OUTFITS[g.outfit]?.name ?? g.outfit} outfit`;
  return "Fourth task slot";
}

/** One short line under the name: what it does. */
export function shelfNote(e: ShelfEntry): string {
  const g = e.good;
  if (g.type === "outfit") return "a look for the Wardrobe, dyed like any other";
  if (g.type === "slot") return "hold four errands at once, for good";
  const d = ITEMS[g.item];
  if (d.blessing) return "your next death costs half the experience";
  const s = d.gear ?? {};
  const parts: string[] = [];
  if (s.atk) parts.push(`+${s.atk} attack`);
  if (s.defBonus) parts.push(`+${s.defBonus} guard`);
  if (s.maxhp) parts.push(`+${s.maxhp} HP`);
  if (s.speed) parts.push(`+${s.speed} speed`);
  if (s.dist) parts.push(`+${s.dist} Distance`);
  return `${d.slot === "ring" ? "ring" : "amulet"} · ${parts.join(" · ")}`;
}

export type ShelfRefusal = "rank" | "points" | "owned" | "heavy";

/** Whether this character could buy it right now, and if not, the first reason why. */
export function shelfState(p: Player, e: ShelfEntry): "ok" | ShelfRefusal {
  const g = e.good;
  if (g.type === "outfit" && ownsOutfit(g.outfit)) return "owned";
  if (g.type === "slot" && extraSlots() > 0) return "owned";
  if (rankIndex() < e.rank) return "rank";
  if (p.taskPoints < e.price) return "points";
  if (g.type === "item" && !canCarry(p, g.item, 1)) return "heavy";
  return "ok";
}

export type ShelfResult =
  | { ok: true; entry: ShelfEntry }
  | { ok: false; why: ShelfRefusal | "full" | "unknown" };

/**
 * Buy one. The points go only once the good has landed: an item that finds no
 * cell in the pack is refused and nothing is charged, the order the shops keep.
 */
export function buyShelf(p: Player, id: string): ShelfResult {
  const e = shelfEntry(id);
  if (!e) return { ok: false, why: "unknown" };
  const st = shelfState(p, e);
  if (st !== "ok") return { ok: false, why: st };
  const g = e.good;
  if (g.type === "item") {
    if (addItem(p.bag, g.item, 1) > 0) return { ok: false, why: "full" };
  } else if (g.type === "outfit") {
    grantOutfit(g.outfit);
  } else {
    grantExtraSlot();
  }
  p.taskPoints -= e.price;
  return { ok: true, entry: e };
}
