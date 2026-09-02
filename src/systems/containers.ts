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
import type { GroundItem, World } from "../world/types.ts";
import { corpseById, groundById, structureById } from "../world/entities.ts";

export type ContainerRef =
  /** The slots inside the backpack the player is wearing. */
  | { c: "bag" }
  /** One Storage Chest's own inventory, by entity id. */
  | { c: "stash"; id: number }
  /** A lootable body, by entity id. */
  | { c: "corpse"; id: number }
  /** A container lying loose on the ground — the loot bag — by entity id. */
  | { c: "ground"; id: number }
  /**
   * A bag held OUTSIDE the world for the length of one operation.
   *
   * The deliberate escape hatch, and the only member that still carries an
   * object. It exists so that lifting a stack off the floor into a pack can
   * go through `moveItems` like everything else: the source is a GroundItem,
   * which is not a container, so it is wrapped in a one-slot bag and given an
   * address for exactly as long as the move takes.
   *
   * It is never stored in a window, never survives a frame, and must never be
   * sent anywhere. If you find yourself wanting to hold one, the thing you
   * actually want is an entity with an id.
   */
  | { c: "loose"; slots: Bag }
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
    case "stash":
    case "corpse":
    case "ground": return a.id === (b as { id: number }).id;
    // A loose bag is only ever equal to itself, and only within the one
    // statement that made it — hence identity, which is all it can be.
    case "loose": return a.slots === (b as { slots: Bag }).slots;
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

/**
 * Detach everything sitting deeper than the resolver can read, and hand it
 * back so the caller can put it somewhere the player will find it.
 *
 * The repair half of the depth rule. `moveItems` now refuses to bury a pack
 * past MAX_NEST_DEPTH, which stops any NEW save reaching this state — but a
 * character written before that gate existed may be carrying a seventh pack
 * whose window has been showing nothing for as long as it has been there.
 * Fixing the rule going forward does not open that pack; this does.
 *
 * Returns the loose stacks, in the order found. The tree below the cap is left
 * exactly as it was: only the slots AT the cap are emptied, because lifting
 * their contents lifts the whole subtree with them.
 */
export function liftOverDeep(root: Bag, cap = MAX_NEST_DEPTH): ItemStack[] {
  const out: ItemStack[] = [];
  const walk = (slots: Bag, depth: number): void => {
    for (let i = 0; i < slots.length; i++) {
      const st = slots[i];
      if (!st) continue;
      if (depth >= cap) { out.push(st); slots[i] = null; continue; }
      const inner = st.items;
      if (inner) walk(inner, depth + 1);
    }
  };
  walk(root, 0);
  return out;
}

/**
 * What `slotsOf` needs from the outside world to resolve a base address.
 *
 * It grew a world when refs went from holding objects to holding ids: an id
 * is meaningless without somewhere to look it up. That is the cost of the
 * change, and it buys the thing that matters — a stale address now resolves
 * to null on its own, so "is this window still looking at something real?" is
 * answered by the same call that fetches the slots, rather than by a separate
 * `includes()` check that could disagree with it.
 */
export interface RefWorld {
  /** The worn backpack's slots (an empty frozen array when bagless). */
  bag: Bag;
  /** The world the character is standing in: bodies and loose stacks. */
  world: World;
  /** Home, where the Storage Chests stand — consulted from anywhere. */
  home: World;
}

/**
 * The slots a ref points at, or null when the address has gone stale —
 * the corpse rotted, the pack was picked up, the chest was demolished.
 * Callers must treat null as "that window is gone", never as "empty".
 */
export function slotsOf(ref: ContainerRef, w: RefWorld): Bag | null {
  switch (ref.c) {
    case "bag": return w.bag;
    case "stash": return structureById(w.world, ref.id, w.home)?.inv ?? null;
    case "corpse": return corpseById(w.world, ref.id)?.items ?? null;
    case "loose": return ref.slots;
    case "ground": {
      const gi = groundById(w.world, ref.id);
      if (!gi || !isContainer(gi.kind)) return null;
      // the GroundItem is not an ItemStack, so borrow one to size the slots
      const shim: ItemStack = { kind: gi.kind, n: 1, items: gi.items };
      const slots = contentsOf(shim);
      if (slots) gi.items = slots;
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
