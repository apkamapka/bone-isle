/**
 * Container addressing.
 *
 * Every place an item can sit — the worn backpack, a Storage Chest, a corpse,
 * a pack lying on the floor, and any pack nested inside any of those — gets
 * ONE kind of address. That is the whole point of this file: without it,
 * "move this item there" needs a case for every pair of window types, which
 * is nine functions today and sixteen the moment a fourth container exists.
 * With it there is exactly one move, and the rules (weight, reach, capacity)
 * are decided by asking the address two questions: where does it root, and is
 * it inside itself.
 */
import { contentsOf, isContainer } from "../items.ts";
import type { Bag, ItemStack } from "../items.ts";
import type { Corpse, GroundItem, Structure } from "../world/types.ts";

export type ContainerRef =
  /** The slots inside the backpack the player is wearing. */
  | { c: "bag" }
  /** One Storage Chest's own inventory. */
  | { c: "stash"; s: Structure }
  /** A lootable body. */
  | { c: "corpse"; body: Corpse }
  /** A container lying loose on the ground — the loot bag. */
  | { c: "ground"; gi: GroundItem }
  /** A container occupying slot `i` of another container. */
  | { c: "nested"; via: ContainerRef; i: number };

/** The address a nested chain ultimately hangs from. */
export type BaseRef = Exclude<ContainerRef, { c: "nested" }>;

export function baseOf(ref: ContainerRef): BaseRef {
  let r = ref;
  while (r.c === "nested") r = r.via;
  return r;
}

/**
 * Is this container on the player, or out in the world?
 *
 * The single question that decides which rules apply to a move. Carry weight
 * is only ever charged when something crosses INTO the player; reach is only
 * ever checked when something touches the world.
 */
export function rootOf(ref: ContainerRef): "player" | "world" {
  return baseOf(ref).c === "bag" ? "player" : "world";
}

/** Structural equality — refs are rebuilt every frame, never held. */
export function sameRef(a: ContainerRef, b: ContainerRef): boolean {
  if (a.c !== b.c) return false;
  switch (a.c) {
    case "bag": return true;
    case "stash": return a.s === (b as { s: Structure }).s;
    case "corpse": return a.body === (b as { body: Corpse }).body;
    case "ground": return a.gi === (b as { gi: GroundItem }).gi;
    case "nested": {
      const o = b as { via: ContainerRef; i: number };
      return a.i === o.i && sameRef(a.via, o.via);
    }
  }
}

/** Is `inner` the same container as `outer`, or somewhere inside it? */
export function isInside(inner: ContainerRef, outer: ContainerRef): boolean {
  let r: ContainerRef = inner;
  for (;;) {
    if (sameRef(r, outer)) return true;
    if (r.c !== "nested") return false;
    r = r.via;
  }
}

/** Depth of nesting: 0 for a window's own container, 1 for a pack inside it. */
export function depthOf(ref: ContainerRef): number {
  let n = 0;
  let r = ref;
  while (r.c === "nested") { n++; r = r.via; }
  return n;
}

/**
 * How deep packs may be nested. Not a rule the player will ever meet by
 * accident — it exists so a corrupt save or a stray bug cannot hand the
 * resolver an infinite chain to walk.
 */
export const MAX_NEST_DEPTH = 6;

/** What `slotsOf` needs from the outside world to resolve a base address. */
export interface RefWorld {
  /** The worn backpack's slots (an empty frozen array when bagless). */
  bag: Bag;
}

/**
 * The slots a ref points at, or null when the address has gone stale —
 * the corpse rotted, the pack was picked up, the chest was demolished.
 * Callers must treat null as "that window is gone", never as "empty".
 */
export function slotsOf(ref: ContainerRef, w: RefWorld): Bag | null {
  switch (ref.c) {
    case "bag": return w.bag;
    case "stash": return ref.s.inv ?? null;
    case "corpse": return ref.body.items;
    case "ground": {
      if (!isContainer(ref.gi.kind)) return null;
      // the GroundItem is not an ItemStack, so borrow one to size the slots
      const shim: ItemStack = { kind: ref.gi.kind, n: 1, items: ref.gi.items };
      const slots = contentsOf(shim);
      if (slots) ref.gi.items = slots;
      return slots;
    }
    case "nested": {
      if (depthOf(ref) > MAX_NEST_DEPTH) return null;
      const parent = slotsOf(ref.via, w);
      if (!parent) return null;
      const st = parent[ref.i];
      if (!st || !isContainer(st.kind)) return null;
      return contentsOf(st);
    }
  }
}

/** The stack a nested ref names, or null. Used to title a window. */
export function stackAt(ref: ContainerRef, w: RefWorld): ItemStack | null {
  if (ref.c !== "nested") return null;
  const parent = slotsOf(ref.via, w);
  return parent ? parent[ref.i] ?? null : null;
}

/**
 * Walk a trail of slot indices down from a base address, stopping early if
 * the trail has gone stale. Returns the deepest ref that still resolves AND
 * how much of the trail survived, so the window can trim itself instead of
 * showing nothing when the pack it was looking at is taken away.
 */
export function followTrail(
  base: ContainerRef,
  trail: readonly number[],
  w: RefWorld,
): { ref: ContainerRef; used: number } {
  let ref: ContainerRef = base;
  let used = 0;
  for (const i of trail) {
    const next: ContainerRef = { c: "nested", via: ref, i };
    if (!slotsOf(next, w)) break;
    ref = next;
    used++;
  }
  return { ref, used };
}

/**
 * Does this loose stack tidy itself away after its hour on the floor?
 *
 * Everything does — except a container. A loot bag is somewhere the player
 * DELIBERATELY put things; if it rotted on the same timer as a stray log, the
 * feature would be a trap rather than a convenience, and the loss would be
 * silent and total. Tibia's ground never eats a backpack either.
 */
export function groundDecays(gi: GroundItem): boolean {
  return !isContainer(gi.kind);
}
