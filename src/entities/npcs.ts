/**
 * Town NPCs: their shop stock (sell list), what they buy from you, and how the
 * ones with a beat walk it.
 */
import { ITEMS } from "../items.ts";
import { NPC_WALK_SPEED, NPC_REST_MIN_S, NPC_REST_MAX_S } from "../config.ts";
import { rnd, rndi } from "../util.ts";
import { toTile, glideWalker, tryStep, atCenter, walkable } from "../world/grid.ts";
import type { ItemKind } from "../items.ts";
import type { NpcKey, Npc, NpcDir, World } from "../world/types.ts";

/** A row in an NPC's shop. */
export interface ShopEntry {
  kind: ItemKind;
  /** Gold the player pays to buy one. */
  buy: number;
  /** Gold the player receives to sell one (0 = NPC won't buy it). */
  sell: number;
}

const buyPrice = (k: ItemKind): number => Math.max(1, Math.round(ITEMS[k].value * 2));
const sellPrice = (k: ItemKind): number => Math.max(1, Math.round(ITEMS[k].value * 0.5));

function shop(sells: ItemKind[], buys: ItemKind[]): ShopEntry[] {
  const rows: ShopEntry[] = [];
  const seen = new Set<ItemKind>();
  for (const k of sells) {
    rows.push({ kind: k, buy: buyPrice(k), sell: buys.includes(k) ? sellPrice(k) : 0 });
    seen.add(k);
  }
  for (const k of buys) {
    if (!seen.has(k)) rows.push({ kind: k, buy: 0, sell: sellPrice(k) });
  }
  return rows;
}

export interface NpcShop {
  greeting: string;
  entries: ShopEntry[];
}

/** Shops keyed by NPC. The taskmaster has no shop — clicking them opens the task board. */
export const SHOPS: Readonly<Partial<Record<NpcKey, NpcShop>>> = {
  smith: {
    greeting: "Fresh steel and a fair price. What'll it be?",
    entries: shop(
      ["sword", "ironSword", "leatherArmor", "chainArmor", "helmet", "armor", "shieldItem", "legs", "trainingArrow", "backpack"],
      ["wood", "stone", "bones", "ironSword", "boneSword", "sword", "leatherArmor", "chainArmor",
        "battleAxe", "steelShield", "fireSword", "dragonShield", "dragonScaleArmor", "shell"],
    ),
  },
  herbalist: {
    greeting: "Potions, herbs, remedies — all freshly picked.",
    entries: shop(
      ["hpPotion", "healCrystal", "boots", "meat", "mushroom"],
      ["herb", "mushroom", "silk", "meat", "venomGland", "wolfFur", "ghoulClaw", "dragonHam", "dragonScale"],
    ),
  },
  elder: {
    greeting: "Adventurer. There is work to be done. See your quest log.",
    entries: shop(
      ["amulet", "ring"],
      ["amulet", "ring", "boneSword"],
    ),
  },
};

/* ------------------------------------------------------------------ */
/*  Walking about                                                      */
/* ------------------------------------------------------------------ */

/** How long to stand around before considering the next step. */
export function npcRest(): number {
  return rnd(NPC_REST_MIN_S, NPC_REST_MAX_S);
}

/** Which way a townsperson faces after an orthogonal step. */
function dirOf(sx: number, sy: number): NpcDir | null {
  if (sy < 0) return "up";
  if (sy > 0) return "down";
  if (sx < 0) return "left";
  if (sx > 0) return "right";
  return null;
}

/** Turn to look at a point — used while someone is talking to us. */
export function faceToward(n: Npc, px: number, py: number): void {
  const dx = px - n.x;
  const dy = py - n.y;
  if (Math.abs(dx) >= Math.abs(dy)) n.dir = dx < 0 ? "left" : "right";
  else n.dir = dy < 0 ? "up" : "down";
}

/** Four orthogonal steps. Townsfolk never cut a corner — a shopkeeper pacing
 *  diagonally across his own stall reads as a creature, not a person. */
const STEPS4: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Move every townsperson one tick.
 *
 * The rules, in order, mirror the player's: ALWAYS finish the glide already in
 * flight, so an NPC can never come to rest between tiles even if you start
 * talking to him mid-stride. Only from a tile centre does anything get decided,
 * and only when nobody is talking to him and his rest timer has run out.
 *
 * A step is claimed the instant it is chosen (grid.ts semantics), so two bodies
 * can never share a square: the smith will not walk through you, a monster, or
 * another NPC, and he will not park on a portal pad.
 */
export function updateNpcs(w: World, dt: number, px: number, py: number): void {
  if (!w.npcs.length) return;
  const ptx = toTile(px);
  const pty = toTile(py);
  const portal = new Set(w.portals.map((p) => toTile(p.y) * w.w + toTile(p.x)));

  for (const n of w.npcs) {
    if (n.talk > 0) n.talk = Math.max(0, n.talk - dt);

    // 1. finish the step in flight, whatever else is going on
    const wasX = n.x;
    const wasY = n.y;
    let budget = glideWalker(n, NPC_WALK_SPEED * dt);
    n.moving = n.x !== wasX || n.y !== wasY;
    if (n.moving) n.phase += dt;
    if (!atCenter(n)) continue;

    // 2. in conversation: stand still and look at whoever is talking
    if (n.talk > 0) {
      n.moving = false;
      faceToward(n, px, py);
      n.rest = npcRest();       // and don't bolt the moment the window closes
      continue;
    }

    // The beat is a rectangle, not a square: `roam` bounds the walk east-west
    // and `roamY` (defaulting to the same) north-south, so a sage who paces
    // four tiles along one row is `roam: 4, roamY: 0` rather than a special case.
    const rx = n.roam;
    const ry = n.roamY ?? n.roam;
    if (rx <= 0 && ry <= 0) continue;
    n.rest -= dt;
    if (n.rest > 0) continue;
    n.rest = npcRest();
    // a quarter of the time he just stands there a while longer. rndi is
    // inclusive at BOTH ends, so the top of every range here is the last
    // valid value, never one past it.
    if (rndi(0, 3) === 0) continue;

    // 3. pick a free square inside the beat, in random order
    const occupied = (tx: number, ty: number): boolean =>
      (tx === ptx && ty === pty)
      || portal.has(ty * w.w + tx)
      || w.monsters.some((m) => m.tx === tx && m.ty === ty)
      || w.npcs.some((o) => o !== n && o.tx === tx && o.ty === ty);

    const order = [0, 1, 2, 3];
    for (let i = order.length - 1; i > 0; i--) {
      const j = rndi(0, i);
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const i of order) {
      const [sx, sy] = STEPS4[i];
      const nx = n.tx + sx;
      const ny = n.ty + sy;
      if (Math.abs(nx - n.hx) > rx || Math.abs(ny - n.hy) > ry) continue;
      if (!walkable(w, nx, ny)) continue;
      if (!tryStep(w, n, sx, sy, occupied)) continue;
      const d = dirOf(sx, sy);
      if (d) n.dir = d;
      n.moving = true;
      budget = glideWalker(n, budget);   // spend what the glide above left over
      break;
    }
  }
}
