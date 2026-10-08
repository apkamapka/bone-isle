/**
 * Moving things between containers (Etap 3.1c moved this here from main.ts).
 *
 * One rule for every window. The backpack and every pack inside it, a body on
 * the ground, a bag lying on the floor and a Storage Chest are all addressed
 * by a `ContainerRef`, and every move between any two of them goes through
 * `moveItems`: reach, weight, the chest's budget, the sage's bound relic and
 * the no-pack-inside-itself rule are checked there, once, for a click, a drag
 * and a double tap alike — and, from Etap 3 on, for a request from a client.
 *
 * Which window a move started in, which one it was dropped on, and whether to
 * ask "how many?" first are the client's questions and stay in main.ts.
 */
import type { Game } from "../game.ts";
import type { Bag, EqSlot, ItemStack } from "../items.ts";
import { ITEMS, addItem, addStack, bagWeight, bagSlotsUsed, itemWeight, stackSlotCost, isContainer } from "../items.ts";
import type { Corpse, GroundItem } from "../world/types.ts";
import {
  slotsOf, baseOf, rootOf, sameRef, isInside, depthOf, MAX_NEST_DEPTH,
  type ContainerRef, type RefWorld,
} from "../systems/containers.ts";
import { carriesBound } from "../systems/missions.ts";
import { freeCap, refreshDerived } from "../entities/player.ts";
import { byId, corpseById, groundById, structureById } from "../world/entities.ts";
import { tone } from "../systems/fxEvents.ts";
import { tell, withinReach, structInReach } from "./actor.ts";
import { dropToGround, dropContainerToGround } from "./ground.ts";

/**
 * What a container address resolves against, for the player who asked: their
 * own pack, the world they stand in, and Home Isle, where the chests are.
 *
 * Built afresh on every call rather than kept: the world changes when the
 * player takes a ladder, and a stale one would resolve a body's id against
 * the floor above.
 */
export function refCtxOf(g: Game): RefWorld {
  return { bag: g.player.bag, world: g.current, home: g.worlds.home };
}

/** The slots behind an address, or null if the address has gone stale. */
export function refSlots(g: Game, ref: ContainerRef): Bag | null {
  return slotsOf(ref, refCtxOf(g));
}

/**
 * Can the player act on this container at all right now?
 *
 * Two different questions folded into one: does the thing still EXIST (the
 * corpse may have rotted, the pack may have been picked up, the chest torn
 * down), and is the player close enough to touch it. Both have to be asked on
 * every single move, because a window can outlive its subject by a frame and
 * a drag can outlive the walk that started it.
 */
export function refUsable(g: Game, ref: ContainerRef): boolean {
  const P = g.player;
  const base = baseOf(ref);
  const world = g.current;
  switch (base.c) {
    case "bag": return !!P.pack;
    case "stash": {
      // Deliberately looked up in HOME only, not through the home fallback:
      // a chest is reachable when you are standing on the island with it.
      const st = byId(g.worlds.home.structures, base.id);
      return g.current === g.worlds.home && !!st && structInReach(g, st);
    }
    // The "is it still there?" half of these used to be an `includes()` call
    // beside the reach test. A missing entity now simply fails to resolve.
    case "corpse": {
      const c = corpseById(world, base.id);
      return !!c && withinReach(g, c.x, c.y);
    }
    case "ground": {
      const gi = groundById(world, base.id);
      return !!gi && withinReach(g, gi.x, gi.y);
    }
    // Held in hand for one statement, by code that already checked the source.
    case "loose": return true;
  }
}

/**
 * Slots still free in a Storage Chest's whole tree, or null for anything else.
 *
 * The chest is the one container with a budget rather than a shape, and the
 * budget is recursive on purpose (see the panel's comment): a pack inside it
 * costs its own cell plus one for everything within.
 */
export function chestRoomLeft(g: Game, ref: ContainerRef): number | null {
  const base = baseOf(ref);
  if (base.c !== "stash") return null;
  const inv = structureById(g.current, base.id, g.worlds.home)?.inv;
  if (!inv) return null;
  return inv.length - bagSlotsUsed(inv);
}

/** Rearrange within one container: fill empty, merge like kinds, else swap. */
function swapOrMerge(arr: Bag, from: number, to: number): void {
  if (from === to) return;
  const a = arr[from];
  if (!a) return;
  const b = arr[to];
  if (!b) { arr[to] = a; arr[from] = null; return; }
  if (b.kind === a.kind && ITEMS[a.kind].stack > 1 && !a.items && !b.items) {
    const space = ITEMS[a.kind].stack - b.n;
    const mv = Math.min(space, a.n);
    b.n += mv; a.n -= mv;
    if (a.n <= 0) arr[from] = null;
  } else {
    arr[from] = b; arr[to] = a;
  }
}

/**
 * Move part or all of one slot into another container. THE move — every
 * window, every direction, every nesting depth goes through here.
 *
 * `ti` is where the drag was released; null means "wherever it fits". A
 * container always travels whole, contents included, because splitting one
 * is meaningless and merging two would silently destroy the contents of one.
 */
export function moveItems(
  g: Game, from: ContainerRef, fi: number, to: ContainerRef, ti: number | null, n: number,
  opts?: { sourceChecked?: boolean },
): boolean {
  const P = g.player;
  const src = refSlots(g, from);
  const dst = refSlots(g, to);
  if (!src || !dst) return false;
  // `sourceChecked` is for a source that is NOT a live container in the world
  // — a loose stack on the floor, wrapped in a throwaway holder by
  // `liftFloorStack`. Asking `refUsable` about that holder always says no,
  // because it is not in `world.corpses` and never will be.
  if ((!opts?.sourceChecked && !refUsable(g, from)) || !refUsable(g, to)) {
    tell(g, "too far away", "#d96a5a");
    return false;
  }
  const st = src[fi];
  if (!st) return false;

  /* Dropping ONTO a container puts the thing INSIDE it rather than swapping
   * cells with it. Tibia's rule, and the one a player assumes: an open box is
   * a destination, not an obstacle. Without it, dragging wood onto the spare
   * backpack in your bag merely traded their positions — the two of them
   * looked identical afterwards and nothing had gone in. */
  if (ti !== null && !(sameRef(from, to) && ti === fi)) {
    const cell = dst[ti];
    if (cell?.items && cell !== st) {
      return moveItems(g, from, fi, { c: "nested", via: to, i: ti }, null, n, opts);
    }
  }

  // same container: pure rearrangement, no rules to check
  if (sameRef(from, to)) {
    if (ti !== null) swapOrMerge(src, fi, ti);
    return true;
  }

  /* THE BOUND RELIC. A mission relic the sage is still waiting for does not
   * leave the player — not into a chest, not into a body, not into a bag on
   * the floor. The rule is one relic per head, and a relic parked out of sight
   * is how one head comes to hold two: the sage finds empty hands, reopens the
   * echo, and the boss is standing there again with the same cap on.
   *
   * Checked HERE because this is the one funnel every move goes through, which
   * is the same reason weight and the chest budget are checked two lines down.
   * Moving it about inside the player's own pack is untouched — the rule is
   * about leaving, not about tidiness. */
  if (rootOf(from) === "player" && rootOf(to) === "world" && carriesBound(st, P.level)) {
    tell(g, "the sage is waiting for that — it stays with you", "#e0a06a");
    return false;
  }

  /* A container may not be put inside itself, at any depth. Without this the
   * tree becomes a cycle: the pack still renders, but its contents are now
   * unreachable from any root and every recursive walk runs forever. */
  if (st.items && isInside(to, { c: "nested", via: from, i: fi })) {
    tell(g, "it will not fit inside itself", "#d96a5a");
    return false;
  }

  /* …and a container may not be buried deeper than the resolver can read.
   *
   * MAX_NEST_DEPTH was enforced in exactly one place — `slotsOf`, on the way
   * OUT — and nothing checked it on the way in. So the seventh nested pack
   * could be placed and then never opened again: its view ref resolves to
   * null, the window shows nothing, and `bagWeight` goes on charging the
   * player for contents no hand can reach. Containers travel whole, so one
   * drag of a full loot bag was enough to lose everything in it.
   *
   * The check belongs here, where there is still a player to tell. The one in
   * `slotsOf` stays exactly as its comment describes it — the defence against
   * a corrupt save, not the rule. */
  if (st.items && depthOf(to) >= MAX_NEST_DEPTH) {
    tell(g, "that pack is already too deep to open", "#d96a5a");
    return false;
  }

  const whole = !!st.items || ITEMS[st.kind].stack === 1;
  const take = whole ? st.n : Math.max(1, Math.min(n, st.n));

  // weight is charged only on the way IN to the player
  if (rootOf(to) === "player" && rootOf(from) === "world") {
    const wgt = ITEMS[st.kind].weight * take + (st.items ? bagWeight(st.items) : 0);
    if (wgt > freeCap(P)) { tell(g, "too heavy", "#d96a5a"); return false; }
  }
  // …and the chest budget only on the way in to a chest
  const room = chestRoomLeft(g, to);
  if (room !== null) {
    const cost = whole ? stackSlotCost(st) : 1;
    // topping up a stack already in the chest costs no new slot
    const merging = ti !== null && dst[ti]?.kind === st.kind && !whole;
    if (!merging && cost > room) { tell(g, "the chest is full", "#d96a5a"); return false; }
  }

  if (whole) {
    // detach first, so addStack cannot see it in two places at once
    src[fi] = null;
    const placed = ti !== null && dst[ti] === null ? (dst[ti] = st, true) : addStack(dst, st);
    if (!placed) { src[fi] = st; tell(g, "no room", "#d96a5a"); return false; }
  } else {
    const before = take;
    let left: number;
    if (ti !== null && (dst[ti] === null || dst[ti]?.kind === st.kind)) {
      const cell = dst[ti];
      if (!cell) { dst[ti] = { kind: st.kind, n: take }; left = 0; }
      else {
        const space = ITEMS[st.kind].stack - cell.n;
        const mv = Math.min(space, take);
        cell.n += mv;
        left = take - mv;
      }
    } else {
      left = addItem(dst, st.kind, take);
    }
    const moved = before - left;
    if (moved <= 0) { tell(g, "no room", "#d96a5a"); return false; }
    st.n -= moved;
    if (st.n <= 0) src[fi] = null;
  }

  tone(rootOf(to) === "player" ? 440 : 360, 0.06, "sine", 0.04);
  return true;
}

/** Empty a world container into the bag, as far as weight and space allow. */
export function takeAllFrom(g: Game, ref: ContainerRef): void {
  const slots = refSlots(g, ref);
  if (!slots) return;
  let blocked = false;
  for (let i = slots.length - 1; i >= 0; i--) {
    if (!slots[i]) continue;
    if (!moveItems(g, ref, i, { c: "bag" }, null, slots[i]!.n)) { blocked = true; break; }
  }
  if (!blocked) closeIfEmpty(g, ref);
}

/** A looted-out corpse disappears, exactly as it always did. Its loot
 *  window notices it has gone and closes itself (main.ts). */
export function closeIfEmpty(g: Game, ref: ContainerRef): void {
  const base = baseOf(ref);
  if (base.c !== "corpse") return;
  const c = corpseById(g.current, base.id);
  if (!c || c.items.some((s) => s !== null)) return;
  const w = g.current;
  const idx = w.corpses.indexOf(c);
  if (idx >= 0) w.corpses.splice(idx, 1);
}

/** Take `n` out of a container and put them on the ground (optionally aimed). */
export function dropFromContainer(g: Game, ref: ContainerRef, index: number, n: number, tx?: number, ty?: number): void {
  const P = g.player;
  const slots = refSlots(g, ref);
  const st = slots ? slots[index] : null;
  if (!slots || !st) return;
  /* A body or a bag on the floor has to be within reach to be emptied onto
   * the ground — the drag that used to be the only thing asking is not the
   * only way here (the "how many?" chooser can sit open while you walk off),
   * and a request from a client is no proof of where its player stands. */
  if (rootOf(ref) === "world" && !refUsable(g, ref)) { tell(g, "too far away", "#d96a5a"); return; }
  /* The other door out of the pack, and the same rule as in `moveItems`: a
   * relic the sage is still waiting for cannot be put down. The ground is the
   * easiest hiding place of the lot — it is one drag and the cap is still four
   * tiles away when Chronos looks at your hands. */
  if (rootOf(ref) === "player" && carriesBound(st, P.level)) {
    tell(g, "the sage is waiting for that — it stays with you", "#e0a06a");
    return;
  }
  if (st.items) {
    // a pack goes down whole, contents and all — that IS the loot bag
    slots[index] = null;
    dropContainerToGround(g, st, tx, ty);
    return;
  }
  const take = Math.min(n, st.n);
  st.n -= take;
  if (st.n <= 0) slots[index] = null;
  dropToGround(g, st.kind, take, tx, ty);
}

/** A loose floor stack dragged into a container. */
export function liftFloorStack(g: Game, gi: GroundItem, to: ContainerRef, ti: number | null): void {
  const world = g.current;
  if (!world.ground.includes(gi)) return;
  if (!withinReach(g, gi.x, gi.y)) { tell(g, "too far away", "#d96a5a"); return; }
  if (!refUsable(g, to)) { tell(g, "too far away", "#d96a5a"); return; }
  const dst = refSlots(g, to);
  if (!dst) return;
  // a pack cannot be lifted into itself
  if (baseOf(to).c === "ground" && (baseOf(to) as { id: number }).id === gi.id) {
    tell(g, "it will not fit inside itself", "#d96a5a");
    return;
  }
  /* Route it through a throwaway one-slot holder so the ONE move with all the
   * rules in it stays the only code that puts something somewhere. The holder
   * is not in the world, so its reach was checked above instead — hence
   * `sourceChecked`. */
  const shim: Bag = [{ kind: gi.kind, n: gi.n, items: gi.items }];
  /* A `loose` address rather than a fake corpse. The stack being lifted is
   * not in any container yet, so it is handed an address that names the shim
   * directly — which is exactly what the `loose` member exists for, and it
   * stops this from being a body that pretends to lie on the floor. */
  const via: ContainerRef = { c: "loose", slots: shim };
  if (!moveItems(g, via, 0, to, ti, gi.n, { sourceChecked: true })) return;
  const leftover = shim[0];
  if (leftover) { gi.n = leftover.n; gi.items = leftover.items; }
  else {
    const idx = world.ground.indexOf(gi);
    if (idx >= 0) world.ground.splice(idx, 1);
  }
}

/* ---------------- the worn backpack ---------------- */

/** Put on the backpack in slot `index` of `ref` — dragged onto the Bag slot. */
export function wearPackFrom(g: Game, ref: ContainerRef, index: number): void {
  const P = g.player;
  const slots = refSlots(g, ref);
  const st = slots ? slots[index] : null;
  if (!slots || !st) return;
  if (!isContainer(st.kind)) { tell(g, "that is not a backpack", "#d96a5a"); return; }
  if (!refUsable(g, ref)) { tell(g, "too far away", "#d96a5a"); return; }
  const old = P.pack;
  slots[index] = null;
  P.pack = st;
  /* The pack being replaced goes INSIDE the new one. It has to go somewhere,
   * and the alternative — refuse the swap — is a dead end, because the new
   * pack is almost always sitting in the old one and could not be worn at
   * all. Detaching first is what keeps that from becoming a cycle. */
  if (old) {
    if (!addStack(st.items!, old)) dropContainerToGround(g, old);
  }
  tell(g, "backpack on", "#b9e07f");
  tone(420, 0.07, "sine", 0.05);
}

/** …the same, but the pack was lying on the floor. */
export function wearPackFromFloor(g: Game, gi: GroundItem): void {
  const P = g.player;
  const world = g.current;
  if (!isContainer(gi.kind)) { tell(g, "that is not a backpack", "#d96a5a"); return; }
  if (!world.ground.includes(gi)) return;
  if (!withinReach(g, gi.x, gi.y)) { tell(g, "too far away", "#d96a5a"); return; }
  const st: ItemStack = { kind: gi.kind, n: 1, items: gi.items };
  const old = P.pack;
  P.pack = st;
  const idx = world.ground.indexOf(gi);
  if (idx >= 0) world.ground.splice(idx, 1);
  if (old && !addStack(st.items ?? [], old)) dropContainerToGround(g, old);
  tell(g, "backpack on", "#b9e07f");
}

/** Take the worn pack off into some other container. */
export function movePackTo(g: Game, to: ContainerRef): void {
  const P = g.player;
  const st = P.pack;
  if (!st) return;
  // it cannot go into itself, and "the bag" IS itself
  if (baseOf(to).c === "bag") { tell(g, "it will not fit inside itself", "#d96a5a"); return; }
  if (!refUsable(g, to)) { tell(g, "too far away", "#d96a5a"); return; }
  const dst = refSlots(g, to);
  if (!dst) return;
  const room = chestRoomLeft(g, to);
  if (room !== null && stackSlotCost(st) > room) { tell(g, "the chest is full", "#d96a5a"); return; }
  if (!addStack(dst, st)) { tell(g, "no room", "#d96a5a"); return; }
  P.pack = null;
  tell(g, "backpack off", "#e0a06a");
}

/** Take the worn pack off onto the ground. */
/* The THIRD door out of the pack, and until now the only one with no lock on
 * it at all. Taking the backpack off is one button and it puts the whole tree
 * on the floor — where, because `groundDecays` deliberately never eats a
 * container, it would sit for as long as the character cared to leave it.
 * The two gates in `moveItems` and `dropFromContainer` were guarding the front
 * door while this stood open. */
export function dropWornPack(g: Game, tx?: number, ty?: number): void {
  const P = g.player;
  const st = P.pack;
  if (!st) return;
  if (carriesBound(st, P.level)) {
    tell(g, "the sage is waiting for what is in there — it stays with you", "#e0a06a");
    return;
  }
  P.pack = null;
  dropContainerToGround(g, st, tx, ty);
  tell(g, "backpack off", "#e0a06a");
}

/** Unequip a worn gear piece into a specific container. */
export function unequipInto(g: Game, slot: EqSlot, to: ContainerRef): void {
  const P = g.player;
  const kind = P.eq[slot];
  if (!kind) return;
  if (!refUsable(g, to)) { tell(g, "too far away", "#d96a5a"); return; }
  const dst = refSlots(g, to);
  if (!dst) return;
  const room = chestRoomLeft(g, to);
  if (room !== null && room < 1) { tell(g, "the chest is full", "#d96a5a"); return; }
  // worn gear never counted toward carry cap, so putting it in the bag can
  // push you over — the same check a pickup gets
  if (rootOf(to) === "player" && itemWeight(kind, 1) > freeCap(P)) { tell(g, "too heavy", "#d96a5a"); return; }
  if (!addStack(dst, { kind, n: 1 })) { tell(g, "no room", "#d96a5a"); return; }
  P.eq[slot] = null;
  refreshDerived(P);
  tone(300, 0.08, "triangle", 0.05);
}

/** Take one slot of a body's loot into the bag — the whole stack, as far as it fits. */
export function takeOne(g: Game, c: Corpse, index: number): void {
  const ref: ContainerRef = { c: "corpse", id: c.id };
  moveItems(g, ref, index, { c: "bag" }, null, refSlots(g, ref)?.[index]?.n ?? 1);
  closeIfEmpty(g, ref);
}
