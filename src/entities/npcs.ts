/**
 * Town NPCs: their shop stock (sell list), what they buy from you, and how the
 * ones with a beat walk it.
 */
import { ITEMS } from "../items.ts";
import { NPC_WALK_SPEED, NPC_REST_MIN_S, NPC_REST_MAX_S } from "../config.ts";
import { rnd, rndi } from "../util.ts";
import { toTile, glideWalker, tryStep, atCenter, walkable } from "../world/grid.ts";
import { portalTiles } from "../world/collision.ts";
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
/* A value of 0 pays 0, even on a buy list (Etap 57). The floor of one gold
 * used to apply here too, so a zero-value item put on a buy list by mistake
 * would have sold for a coin apiece — and forge output is zero precisely so
 * that no list can ever turn it back into gold. */
const sellPrice = (k: ItemKind): number =>
  ITEMS[k].value > 0 ? Math.max(1, Math.round(ITEMS[k].value * 0.5)) : 0;

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
  /* BORIN (Etap 57). Two changes to what he takes, none to what he stocks.
   *
   * He no longer buys IRON or STEEL. Both were a mint: Chain Boots sold to
   * him for 12 and melted into a steel he paid 50 for. What the forge makes
   * goes into buildings, runes and trades between players — see the value
   * note on `ItemDef`.
   *
   * He DOES buy both bows now. They drop off poachers, amazons, hunters and
   * minotaur archers, and nobody in town would take one, so a bow in a corpse
   * was the one piece of gear worth nothing at all. */
  smith: {
    greeting: "Fresh steel and a fair price. What'll it be?",
    entries: shop(
      ["shortSword", "ironSword", "leatherHelm", "leatherBody", "leatherLegs", "leatherBoots",
        "leatherShield", "trainingArrow", "bow", "backpack"],
      ["wood", "stone", "bones", "coal", "bow", "longbow", "leatherHelm", "snakeskinHelm", "leatherBody", "snakeskinBody", "leatherLegs", "snakeskinLegs", "leatherBoots", "snakeskinBoots", "leatherShield", "studdedHelm", "goblinHelm", "studdedBody", "goblinBody", "studdedLegs", "goblinLegs", "studdedBoots", "goblinBoots", "studdedShield", "goblinShield", "chainHelm", "orcishHelm", "chainBody", "orcishBody", "chainLegs", "orcishLegs", "chainBoots", "orcishBoots", "chainShield", "orcishShield", "plateHelm", "minotaurHelm", "plateBody", "minotaurBody", "plateLegs", "minotaurLegs", "plateBoots", "minotaurBoots", "plateShield", "minotaurShield", "steelHelm", "marrowHelm", "steelBody", "marrowBody", "steelLegs", "marrowLegs", "steelBoots", "marrowBoots", "steelShield", "marrowShield", "knightHelm", "dragonHelm", "knightBody", "dragonBody", "knightLegs", "dragonLegs", "knightBoots", "dragonBoots", "knightShield", "dragonShield", "goldenHelm", "vampireHelm", "goldenBody", "vampireBody", "goldenLegs", "vampireLegs", "goldenBoots", "vampireBoots", "goldenShield", "vampireShield", "zephyrHelm", "zephyrBody", "zephyrLegs", "zephyrBoots", "shortSword", "fangDagger", "ironSword", "goblinHatchet", "mercBlade", "warHammer", "orcishAxe", "gladius", "boneSword", "minotaurAxe", "warlordBlade", "steelMaul", "demonCleaver", "knightSword", "fireSword", "marrowBlade", "sunspear", "bloodletter"],
    ),
  },
  /* MIRA. Her shelf lost the Leather Boots (Etap 57): Borin stocks the same
   * pair at the same price, and a herbalist selling boots was a leftover, not
   * a second source. What she buys is what comes off a creature — food and
   * trophies — and the trophies are where the Etap 57 price rise landed. */
  herbalist: {
    greeting: "Potions, herbs, remedies — all freshly picked.",
    entries: shop(
      ["hpPotion", "healCrystal", "meat", "mushroom"],
      ["mushroom", "meat", "venomGland", "ghoulClaw", "dragonHam", "dragonScale",
        "minotaurHorn", "orcEar", "goblinFang", "cursedRib"],
    ),
  },
  elder: {
    greeting: "Adventurer. There is work to be done. See your quest log.",
    /* THE POWER RING IS NO LONGER FOR SALE (Etap 43). It is a chest prize —
     * Kárr's howe until Etap 54 and Gorak's hoard since — and a reward you can
     * also buy for a hundred and eighty gold is not a reward. He still BUYS
     * them, so a second one off a second character is still worth carrying
     * out, and since Etap 54 he buys all THREE rings on the same principle:
     * every one of them comes out of exactly one chest, none of them is
     * stocked, and a player who finds a duplicate should have somewhere to
     * take it.
     *
     * JEWELLERY ONLY SINCE ETAP 57. He also used to buy three swords, at
     * exactly Borin's price, and the Essential Gem at 500 — the second was a
     * mint (three trophies worth 32 gold cut into one) and the first was a
     * copy of a list the smith already has. */
    entries: shop(
      ["amulet", "aolAmulet"],
      ["amulet", "ring", "guardRing", "healthRing", "aolAmulet"],
    ),
  },
};

/**
 * What `npc` pays for one `kind`, or 0 if he will not take it.
 *
 * For anything that has to QUOTE a shop without opening one — the forge's
 * smelt tab tells you what Borin would give for a piece before you melt it,
 * and it used to print the item's raw value there, which is twice what he
 * actually pays.
 */
export function sellsFor(npc: NpcKey, kind: ItemKind): number {
  return SHOPS[npc]?.entries.find((e) => e.kind === kind)?.sell ?? 0;
}

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
  const portal = new Set<number>();
  for (const p of w.portals) {
    for (const t of portalTiles(p)) portal.add(t.ty * w.w + t.tx);
  }

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

    // The beat is a rectangle in absolute tiles, so it need not be centred on
    // where the map put him: the cellar sage's square hangs west and south of
    // his corner, the town sage's is a line, a shopkeeper's is a 3x3 box.
    if (n.bx0 === n.bx1 && n.by0 === n.by1) continue;
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
      if (nx < n.bx0 || nx > n.bx1 || ny < n.by0 || ny > n.by1) continue;
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
