/**
 * Putting things down, throwing them and picking them up (Etap 3.1c moved
 * this here from main.ts).
 *
 * The ground is the one place every player shares, so everything that lands
 * on it goes through `placeOnGround` (world/ground.ts): one square, one pile,
 * newest on top. A throw is clamped to the throw range and slides back along
 * its line to the first square it may land on; the sea swallows what reaches
 * it, and a live portal carries it to the far side.
 */
import type { Game } from "../game.ts";
import type { Bag, EqSlot, ItemKind, ItemStack } from "../items.ts";
import { ITEMS, addItem, addStack, bagWeight, itemWeight, isContainer, compactBag } from "../items.ts";
import { Tile, type GroundItem, type World, type WorldKey } from "../world/types.ts";
import { TILE, THROW_RANGE_PX } from "../config.ts";
import { lineOfSight, blockedAt, portalCovers } from "../world/collision.ts";
import { placeOnGround, moveToPile } from "../world/ground.ts";
import { freeCap, refreshDerived } from "../entities/player.ts";
import { sound, tone, floatAt } from "../systems/fxEvents.ts";
import { tell, withinReach } from "./actor.ts";

/** Is this pixel over open water? */
function waterAt(w: World, px: number, py: number): boolean {
  const x = Math.floor(px / TILE);
  const y = Math.floor(py / TILE);
  if (x < 0 || y < 0 || x >= w.w || y >= w.h) return false;
  return w.tile[y][x] === Tile.Water;
}

/**
 * Where a throw aimed at (tx,ty) actually lands. The target is clamped to
 * THROW_RANGE_PX from the player, snapped to the tile centre, then — if that
 * tile is solid or out of sight — slides back along the throw line toward the
 * player half a tile at a time until it's legal (Tibia does the same: an item
 * thrown at a wall falls at its foot). Worst case it lands at your feet.
 *
 * WATER is a legal landing spot even though it is not walkable, and `sank`
 * says so. The sea is the game's rubbish bin: what goes in does not come
 * back, there is no prompt, and the throw range is the ordinary one — the
 * whole gesture has to be as cheap as throwing onto grass or it stops being
 * a way to get rid of things.
 */
export function resolveThrowTarget(g: Game, tx: number, ty: number): { x: number; y: number; sank: boolean } {
  const P = g.player;
  const world = g.current;
  let dx = tx - P.x;
  let dy = ty - P.y;
  const d = Math.hypot(dx, dy);
  if (d > THROW_RANGE_PX) { dx *= THROW_RANGE_PX / d; dy *= THROW_RANGE_PX / d; }
  const steps = Math.ceil(Math.hypot(dx, dy) / (TILE / 2));
  for (let i = steps; i >= 1; i--) {
    const px = P.x + dx * (i / steps);
    const py = P.y + dy * (i / steps);
    // snap to the tile centre so thrown loot sits tidily on the grid
    const cx = Math.floor(px / TILE) * TILE + TILE / 2;
    const cy = Math.floor(py / TILE) * TILE + TILE / 2;
    if (!lineOfSight(world, P.x, P.y, cx, cy)) continue;
    const wet = waterAt(world, cx, cy);
    if (wet || !blockedAt(world, cx, cy)) return { x: cx, y: cy, sank: wet };
  }
  return { x: P.x, y: P.y + 4, sank: false };
}

/** Swallow a stack thrown into the sea. Nothing is recoverable. */
export function sink(g: Game, kind: ItemKind, n: number, x: number, y: number): void {
  floatAt(g.current, x, y - 12, "splash", "#8ecfff");
  tell(g, `${n} ${ITEMS[kind].name} sank`, "#8ecfff");
  // the splash is the sea's, heard by whoever stands by it
  sound("splash", { world: g.current, x, y });
}

/**
 * A thrown stack that lands on a portal travels THROUGH it (Etap 11) — the
 * classic loot-bag trick: pitch your haul into the teleport and it drops out
 * beside the matching portal on the far side, exactly where you'd arrive.
 */
export function sendThroughPortal(g: Game, kind: ItemKind, n: number, pt: { dest: WorldKey }, contents?: Bag): void {
  const from = g.current;
  const dest = g.worlds[pt.dest];
  const back = dest.portals.find((p2) => p2.dest === from.key) ?? dest.portals[0];
  const gx = back?.x ?? dest.w * TILE / 2;
  const gy = (back?.y ?? dest.h * TILE / 2) + 28;
  /* One rule for landing on a square, and `placeOnGround` is it: the haul
   * arrives on top of whatever is already lying by the far portal, and a pack
   * shoved through arrives WITH what is in it and never merges. */
  placeOnGround(dest, kind, n, gx, gy, { items: contents });
  tell(g, `whoosh — ${n} ${ITEMS[kind].name} through the portal!`, "#8ab6ff");
  sound("portal");
}

/** The portal (if any) whose swirl covers world point (x,y). A dormant pad is
 *  not a portal for this purpose: it refuses to carry the player, so it must
 *  not swallow a thrown stack either — the goods would land on the far side of
 *  a door that doesn't open. Items simply drop on top of it instead. */
export function portalAt(g: Game, x: number, y: number): { dest: WorldKey } | null {
  for (const pt of g.current.portals) {
    if (pt.inactive) continue;
    if (portalCovers(pt, x, y, 24)) return pt;
  }
  return null;
}

/** Drop an item stack onto the ground — at the player's feet, or thrown to a
 *  target spot (Tibia-style) when (tx,ty) is given. */
export function dropToGround(g: Game, kind: ItemKind, n: number, tx?: number, ty?: number): void {
  const P = g.player;
  if (n <= 0) return;
  const world = g.current;
  let gx: number;
  let gy: number;
  if (tx !== undefined && ty !== undefined) {
    const t = resolveThrowTarget(g, tx, ty);
    // aimed at a portal → the stack takes the trip instead of landing
    const pt = portalAt(g, t.x, t.y);
    if (pt) { sendThroughPortal(g, kind, n, pt); return; }
    if (t.sank) { sink(g, kind, n, t.x, t.y); return; }
    gx = t.x; gy = t.y;
  } else {
    /* At your feet means at your feet — the square you are standing on, not a
     * jittered point inside it. The jitter was there to keep a heap from
     * overlapping exactly, and it cost the pile its order: a random `y` is a
     * random depth, so half the drops slid under what was already there. */
    gx = P.x;
    gy = P.y;
  }
  // one square, one pile, newest on top — and loose material joins the stack
  // already on top of it rather than one buried under a helmet
  placeOnGround(world, kind, n, gx, gy);
  tell(g, `dropped ${n} ${ITEMS[kind].name}`, "#cfa86a");
  tone(200, 0.06, "sine", 0.04, -60);
}

/** Move an already-dropped ground stack to another spot (drag-throw). Same
 *  legality rules as a bag throw; merges into a near stack at the landing. */
export function throwGroundItem(g: Game, gi: GroundItem, tx: number, ty: number): void {
  const world = g.current;
  if (!world.ground.includes(gi)) return;
  // no telekinesis: pushing loot around requires standing near it
  if (!withinReach(g, gi.x, gi.y)) { tell(g, "too far away", "#d96a5a"); return; }
  const t = resolveThrowTarget(g, tx, ty);
  // shoving a ground stack into a portal sends it through too
  const pt = portalAt(g, t.x, t.y);
  if (pt) {
    const idx = world.ground.indexOf(gi);
    if (idx >= 0) world.ground.splice(idx, 1);
    sendThroughPortal(g, gi.kind, gi.n, pt, gi.items);
    return;
  }
  // ...and shoving one into the sea loses it, exactly like a bag throw
  if (t.sank) {
    const idx = world.ground.indexOf(gi);
    if (idx >= 0) world.ground.splice(idx, 1);
    sink(g, gi.kind, gi.n, t.x, t.y);
    return;
  }
  /* It lands like anything else: on TOP of the square it was aimed at. Moving
   * the coordinates alone used to leave it wherever it sat in `world.ground`,
   * so a stack shoved onto a pile kept the depth of the square it came from —
   * and two backpacks still never merge, which `moveToPile` enforces. */
  moveToPile(world, gi, t.x, t.y);
  tone(200, 0.06, "sine", 0.04, -60);
}

/** Pick a dropped stack back up, as far as weight/space allow. */
export function pickupGround(g: Game, gi: GroundItem): void {
  const P = g.player;
  const world = g.current;
  /* The client walks you over before it asks, so in a game without a server
   * this never speaks. A request is still no proof of where its player
   * stands, and the rule is the one the floor window closes on. */
  if (!withinReach(g, gi.x, gi.y)) { tell(g, "too far away", "#d96a5a"); return; }
  /* A container has to travel as ONE object. Routing it through `addItem`
   * would mint a fresh empty pack of the same kind and leave everything
   * inside it on the floor with no owner — a silent, unrecoverable loss. */
  if (isContainer(gi.kind)) {
    const st: ItemStack = { kind: gi.kind, n: 1, items: gi.items };
    if (bagWeight([st]) + ITEMS[gi.kind].weight > freeCap(P)) { tell(g, "too heavy"); return; }
    if (!addStack(P.bag, st)) { tell(g, "bag full"); return; }
    const i = world.ground.indexOf(gi);
    if (i >= 0) world.ground.splice(i, 1);
    tone(520, 0.06, "sine", 0.05, 80);
    return;
  }
  const fitByWeight = Math.floor(freeCap(P) / itemWeight(gi.kind, 1));
  if (fitByWeight <= 0) { tell(g, "too heavy"); return; }
  const want = Math.min(gi.n, fitByWeight);
  const left = addItem(P.bag, gi.kind, want) + (gi.n - want);
  const took = gi.n - left;
  if (took <= 0) { tell(g, "bag full"); return; }
  compactBag(P.bag);
  if (left > 0) gi.n = left;
  else { const idx = world.ground.indexOf(gi); if (idx >= 0) world.ground.splice(idx, 1); }
  tone(520, 0.06, "sine", 0.05, 80);
}

/** Take gear off a paperdoll slot and throw it on the ground (optionally aimed).
 *  Nothing to weigh: it goes straight from the body to the floor, Tibia-style,
 *  and only lightens the load. */
export function dropFromEq(g: Game, slot: EqSlot, tx?: number, ty?: number): void {
  const P = g.player;
  const kind = P.eq[slot];
  if (!kind) return;
  P.eq[slot] = null;
  refreshDerived(P);
  dropToGround(g, kind, 1, tx, ty);
  tone(300, 0.08, "triangle", 0.05);
}

/** Put a whole container object on the floor, keeping what is inside it. */
export function dropContainerToGround(g: Game, st: ItemStack, tx?: number, ty?: number): void {
  const P = g.player;
  const world = g.current;
  let gx: number;
  let gy: number;
  if (tx !== undefined && ty !== undefined) {
    const t = resolveThrowTarget(g, tx, ty);
    // a pack aimed at a portal takes the trip, contents and all — the same
    // deal a loose stack gets, and the one a player will assume
    const pt = portalAt(g, t.x, t.y);
    if (pt) { sendThroughPortal(g, st.kind, 1, pt, st.items); return; }
    // …and a pack thrown into the sea is a pack, and everything in it, gone
    if (t.sank) { sink(g, st.kind, 1, t.x, t.y); return; }
    gx = t.x; gy = t.y;
  } else {
    gx = P.x;
    gy = P.y;
  }
  // never merged into a nearby stack: two backpacks are two objects
  placeOnGround(world, st.kind, 1, gx, gy, { items: st.items });
  tell(g, `dropped ${ITEMS[st.kind].name}`, "#cfa86a");
  tone(200, 0.06, "sine", 0.04, -60);
}
