/**
 * Stable runtime identity for every entity in the world.
 *
 * WHY
 * ---
 * Until now "that creature" was a JavaScript object reference: the attack
 * target held `{ kind: "mob", m: theMonsterItself }`, and two things were
 * the same monster when `a === b`. That is exact, free and completely
 * unsendable. A client cannot post a pointer to a server, and a server cannot
 * broadcast one back — the moment there is a wire between the two halves of
 * this game, "attack that one" has to be a NUMBER.
 *
 * So every monster, corpse, ground stack, NPC and structure now carries an
 * `id`, stamped once when it is created, and the things that refer to an
 * entity across time refer to it by that id.
 *
 * The id is deliberately NOT a save field. It is stamped fresh on load (see
 * `stampWorld`), for two reasons: nothing outside a session refers to an
 * entity by id, and re-using saved ids would mean either persisting the
 * counter or risking a collision with an id the counter is about to hand out.
 * Runtime-only identity is both simpler and impossible to get wrong.
 *
 * WHY A COUNTER, AND WHY LINEAR SEARCH
 * ------------------------------------
 * The counter is process-global rather than per-world, so an id is unique
 * across the whole game and a stale reference can never be resolved by
 * accident against a different world's entity. It resets only for tests.
 *
 * Lookup is a linear scan rather than a Map, on purpose. The busiest list in
 * the game is a floor's monsters, which runs to about 150 on the largest map;
 * scanning that is nothing next to the work of one frame, and a parallel Map
 * is a second copy of the truth that can drift out of step with the array
 * every time something is spliced out of it. Corpses decay, ground stacks
 * despawn and monsters die constantly — splicing is the normal case here, not
 * the exception, so the structure that needs no maintenance wins.
 */
import type { Corpse, GroundItem, Monster, Npc, Structure, World } from "./types.ts";

let counter = 0;

/** A fresh id. Never zero, so `id ?? 0` and falsy checks cannot pass for one. */
export function nextEntityId(): number {
  return ++counter;
}

/** Restart the counter. Tests only — the game never needs this. */
export function resetEntityIds(): void {
  counter = 0;
}

/** How many ids have been handed out. Read by the smoke tests. */
export function entityIdsIssued(): number {
  return counter;
}

/**
 * Find the entity with this id, or undefined if it is gone.
 *
 * "Or undefined" is the point. A held id whose entity has died, decayed or
 * been looted away resolves to nothing, which is exactly the answer the
 * caller needs — and it is an answer a raw object reference could never give,
 * because a dead monster's object stays perfectly alive as long as something
 * points at it. Half the "is this still valid?" checks scattered through the
 * game were working around that; they become this one lookup.
 */
export function byId<T extends { id: number }>(list: readonly T[], id: number): T | undefined {
  for (const e of list) if (e.id === id) return e;
  return undefined;
}

/** Typed shorthands, so a call site cannot search the wrong list. */
export const monsterById = (w: World, id: number): Monster | undefined => byId(w.monsters, id);
export const corpseById = (w: World, id: number): Corpse | undefined => byId(w.corpses, id);
export const groundById = (w: World, id: number): GroundItem | undefined => byId(w.ground, id);
export const npcById = (w: World, id: number): Npc | undefined => byId(w.npcs, id);

/**
 * A structure, looked up in `w` and then in `home`.
 *
 * Structures are the one entity kind whose id may be resolved from another
 * island: a Storage Chest stands on the Home Isle, and crafting costs are
 * paid out of every chest on it regardless of where the character is
 * standing. Everything else — creatures, bodies, loose items — only ever
 * matters on the floor the character is on.
 */
export function structureById(w: World, id: number, home?: World): Structure | undefined {
  return byId(w.structures, id) ?? (home && home !== w ? byId(home.structures, id) : undefined);
}

/**
 * Stamp every entity in a world that does not already carry an id.
 *
 * Called after a world is built and after a save is loaded. Idempotent by
 * design — it skips anything already stamped — so running it twice over a
 * populated world cannot renumber creatures out from under a held target.
 */
export function stampWorld(w: World): void {
  const lists: { id: number }[][] = [w.monsters, w.corpses, w.ground, w.npcs, w.structures];
  for (const list of lists) {
    for (const e of list) if (!e.id) e.id = nextEntityId();
  }
}

/** Stamp every world in the game. */
export function stampWorlds(worlds: Record<string, World>): void {
  for (const k of Object.keys(worlds)) stampWorld(worlds[k]);
}
