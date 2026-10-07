/**
 * The game's tables, as JSON for xebeka.com.
 *
 * The website's library (creatures, items, NPCs, places) is built from THIS,
 * never typed out by hand: a page that copies a number out of the code is a
 * page that is wrong the first time the number moves. So the exporter reads
 * the same modules the game runs, under the same DOM stub the smoke suite
 * uses, and the site's build reads what it writes.
 *
 * Run by `npm run build:site` before the site is built, so every deploy
 * carries the tables of the code it was deployed with. The smoke suite calls
 * `collectGameData()` too (Etap 74, 83), which is what keeps this file from
 * rotting quietly between website sessions.
 *
 * Exact drop chances ARE in the output. The site shows rarity labels instead
 * (a decision, not a limitation of the data), and it reads this file at build
 * time only, so the numbers never reach a visitor's browser.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE LIBRARY LEAVES OUT (etap 2.1, Radek's call)
 *
 * Every trace of the Time Sage's missions: their hunting grounds and echoes,
 * the bosses and whatever else lives only there, the relics brought back to
 * him, the pads in the cellar, and Chronos himself. Players find those by
 * playing. The cut is made HERE, once, and not page by page, so no page can
 * leak what the JSON never carried. It follows from these rules:
 *
 *   a place is listed unless a mission owns it (`MISSIONS`, ground and echo);
 *   a creature is listed when it stands on a listed place;
 *   an item is listed when something listed hands it out, or when nothing
 *   hands it out yet at all (UNOBTAINABLE, below): a player should see the
 *   gear the world is still waiting for;
 *   an item only the missions hand out is listed too, with its source kept
 *   back (`secretSource`): the rings in the echoes' hoards are worth knowing
 *   about, where they wait is not. The relics alone stay out, being the
 *   errands themselves (Radek's call, Oct 2026).
 *
 * Everything else is pruned to match: a shop line whose item is not listed,
 * an exit to a place that is not, a task whose creatures are not.
 *
 * An item that NOTHING hands out, mission or not, is not an oversight to be
 * left in quietly: it is either a system this file forgot to read, or gear the
 * code defines ahead of the world. The second kind is named in UNOBTAINABLE,
 * listed with `obtainable: false` and no sources (Radek's call, Oct 2026), and
 * the smoke suite fails on anything sourceless that is not named there. The
 * flag stays in the tables; no page shows it.
 * ---------------------------------------------------------------------------
 */
import "../smoke/stub.ts";
import { closeSync, existsSync, mkdirSync, openSync, readSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ITEMS, RECIPES, SET_BONUS, SET_SPEED_BONUS, type ItemDef, type ItemKind, type SetKey } from "../src/items.ts";
import { OUTFIT_COLORS, OUTFITS, WARDROBE_OUTFITS, zoneLabels } from "../src/systems/outfit.ts";
import { MONSTER_DEFS, MONSTER_KINDS, mobName, monsterResist } from "../src/entities/monsters.ts";
import { SHOPS } from "../src/entities/npcs.ts";
import { NPC_DATA } from "../src/world/generate.ts";
import { buildWorlds, CHEST_PRIZES } from "../src/game.ts";
import { MISSIONS } from "../src/systems/missions.ts";
import { TASKS, TP_LEVEL_GAP } from "../src/systems/tasks.ts";
import { SHELF, RANKS, shelfLabel, shelfNote } from "../src/systems/shelf.ts";
import { RESEARCH, OFFERS, towerTierFor } from "../src/systems/tower.ts";
import { COAL_PER_SMELT, GEM_COAL, GEM_TROPHIES, GEM_TROPHY_KINDS } from "../src/systems/smelt.ts";
import { ELEMENTS, ELEMENT_LABEL, type Element, type Resistances } from "../src/systems/elements.ts";
import { iconFile } from "../src/gfx/itemArt.ts";
import { sheetSpec, walkCycleSeconds } from "../src/gfx/mobSheet.ts";
import { TERRAIN_SRC } from "../src/world/terrainImage.ts";
import { FIELD_TICK_DMG } from "../src/systems/monsterSpells.ts";
import { CRYSTAL_SPECS, BURST_TILES, NOVA_TILES, WAVE_TILES } from "../src/systems/crystals.ts";
import { ownCooldown, groupCooldown } from "../src/systems/cooldowns.ts";
import { TIER_MULT, CRYSTAL_LEVEL_SCALE } from "../src/systems/elements.ts";
import {
  HEAL_CRYSTAL_BASE, HEAL_CRYSTAL_PER_LEVEL, HEAL_RUNE_BASE, HEAL_RUNE_PER_LEVEL,
  HASTE_RUNE_S, MIRE_RUNE_S, MIRE_RUNE_TILES, AEGIS_RUNE_S, AEGIS_LOCK_S, FURY_RUNE_S, FURY_DEBT_S, FURY_LOCK_S,
} from "../src/config.ts";
import { TILE, WORLD_SEED } from "../src/config.ts";
import type { NpcKey, WorldKey } from "../src/world/types.ts";

export type ItemCategory =
  | "weapon" | "distance weapon" | "shield" | "armor" | "jewellery"
  | "ammunition" | "crystal" | "potion" | "scroll" | "food" | "container" | "coin" | "material";

/** Materials by item, as the game spends them. */
export type Cost = Partial<Record<ItemKind, number>>;

/**
 * One way to get an item. Only LISTED things appear here: a creature that
 * lives on a listed place, a townsperson the library shows, a listed place's
 * chest. The Forge and the Alchemy Tower are buildings on every player's own
 * island, so they are always listed.
 */
export type ItemSource =
  /** `chance` is exact (0..1). The site turns it into a label. */
  | { type: "drop"; creature: string; chance: number; n: readonly [number, number] }
  /** Stocked by a shop, at this price in gold. */
  | { type: "shop"; npc: string; price: number }
  /** The one-time chest of a place, `n` at a time. */
  | { type: "chest"; place: string; n: number }
  /** Bought at the Alchemy Tower: `batch` charges for `gold` plus `cost`. */
  | {
      type: "tower";
      towerTier: 1 | 2 | 3;
      gold: number;
      cost: Cost;
      batch: number;
      minLevel: number;
      /** The element the player has to be attuned to, for the elemental shelf. */
      element: Element | null;
      /** A one-time research that opens the shelf; null when it is open from the start. */
      research: { gold: number; cost: Cost } | null;
    }
  /** Smelted out of metal gear at the Forge, one batch of coal a piece. */
  | { type: "forge"; method: "smelt"; forgeTier: 1 | 2; coal: number }
  /** Made at the Forge's craft bench from materials, `batch` at a time. */
  | { type: "forge"; method: "craft"; forgeTier: 1; batch: number; cost: Cost }
  /** Cut at a tier-III Forge from coal and `kinds` different trophies. */
  | { type: "forge"; method: "gem"; forgeTier: 3; coal: number; kinds: number; trophies: readonly ItemKind[] }
  /** Chopped from trees or mined from rocks. */
  | { type: "gather"; from: "tree" | "rock" }
  /** Changed for other coins by a townsperson. */
  | { type: "exchange"; npc: string }
  /** On Grizelda's shelf (Etap 92): `points` Task Points, from the rank `rank`. */
  | { type: "shelf"; npc: string; points: number; rank: string };

/**
 * What a crystal does, read from the crystal tables rather than restated:
 * the elemental line from CRYSTAL_SPECS, the utility crystals from config.
 * Damage and healing are given at a few levels, because both grow with the
 * caster's; damage is per creature caught, before its resistance.
 */
export interface ExportCrystalSpec {
  form: "shard" | "burst" | "nova" | "wave" | "knell" | "life" | "recall" | "haste" | "slowdown" | "protection" | "fury";
  element: Element | null;
  tier: 1 | 2 | 3 | null;
  damage: { level: number; dmg: readonly [number, number] }[];
  heal: { level: number; hp: number }[];
  /** How far it reaches, in tiles; null for the shapes anchored on the caster. */
  reachTiles: number | null;
  /** Tiles the shape covers. */
  footprint: number | null;
  /** Thrown at a square rather than at a creature. */
  aimed: boolean;
  /** Seconds before this crystal can be used again; null where nothing waits. */
  cooldownS: number | null;
  /** Seconds every other attack crystal waits after this one. */
  sharedS: number;
  /** How long the effect lasts, in seconds. */
  durationS: number | null;
  /** Seconds before the same effect can be had again, where that is longer than the cooldown. */
  lockS: number | null;
  /** Fury's price: seconds of burn after it ends. */
  afterS: number | null;
}

export interface ExportItem extends Omit<ItemDef, "testLevel" | "testSkill"> {
  key: ItemKind;
  category: ItemCategory;
  /** The game's drawn icon under /play/, or null when the item is baked in code. */
  icon: string | null;
  /** What a crystal does, in the tower's own words. */
  desc: string | null;
  /**
   * False for gear nothing in the world hands out yet (UNOBTAINABLE). The
   * library lists it like any other item and its page says only that where it
   * comes from is unknown, never that it is not in the world (Radek, Oct 2026).
   */
  obtainable: boolean;
  /**
   * True when something hands it out, but only on a mission. `sources` is
   * empty then, and the page reads exactly like a not-yet item's: "Unknown".
   */
  secretSource: boolean;
  /** Every listed way to get it. Empty when `obtainable` is false or the source is a secret. */
  sources: ItemSource[];
  /** Listed shops that buy it, and what they pay. */
  sellTo: { npc: string; price: number }[];
  /** For a crystal: what it does. Null for everything else. */
  crystalSpec: ExportCrystalSpec | null;
}

/** A walk sheet under /play/: 4 rows (up, left, down, right) of `cols` frames. */
export interface ExportSheet {
  file: string;
  /** The whole sheet, in px. */
  w: number;
  h: number;
  frameW: number;
  frameH: number;
  cols: number;
  rows: 4;
  /** Drawn from the side only: every row carries the side view. */
  sideOnly: boolean;
  /** Seconds for one full stride, as the game walks it. */
  cycleS: number;
}

export interface ExportMonster {
  kind: string;
  name: string;
  hp: number;
  exp: number;
  /** Melee damage roll. */
  dmg: readonly [number, number];
  armor: number;
  speed: number;
  gold: readonly [number, number];
  /** `chance` is exact (0..1). The site turns it into a label. */
  loot: { item: ItemKind; chance: number; n: readonly [number, number] }[];
  /** The one element a creature IS, when it is one (dragon, black knight). */
  element: Element | null;
  /** Multipliers on incoming elemental damage; 1 = ordinary, absent = 1. */
  resist: Resistances;
  /** Distance attack, reach in tiles. */
  ranged: { tiles: number; dmg: readonly [number, number] } | null;
  /**
   * A field spell has no impact of its own: it sets the ground burning, and
   * `dmg` is what each tick of standing in it costs (`field` true).
   */
  spells: { name: string; element: Element; dmg: readonly [number, number]; field: boolean }[];
  respawnS: number | null;
  /** Null while the creature has no drawn sheet yet. */
  sprite: ExportSheet | null;
}

/** What a townsperson is for. Timesage's "missions" never reaches the JSON. */
export type NpcRole = "shop" | "tasks" | "wardrobe" | "exchange" | "missions";

export interface ExportNpc {
  key: string;
  name: string;
  /** What the town calls them: "Smith", "Money changer". */
  title: string;
  role: Exclude<NpcRole, "missions">;
  /** Where they stand, on listed places only. */
  places: { place: string; tx: number; ty: number }[];
  sprite: ExportSheet | null;
  /** Lines with an unlisted item are left out. */
  shop: { greeting: string; entries: { item: ItemKind; buy: number; sell: number }[] } | null;
  /** The tailor's work: the outfit's dye zones and how many colours each takes. */
  wardrobe: { zones: string[]; colours: number; outfits: { name: string; shelf: boolean }[] } | null;
  /** The money changer's rate: gold coins for one platinum, and back. */
  exchange: { rate: number } | null;
}

export interface ExportTask {
  id: string;
  title: string;
  /** Listed creatures only; a kill of any of them counts. */
  creatures: string[];
  /**
   * Kills per hand-in. An errand repeats forever, and a hand-in takes only
   * `need` off the tally, so overkill carries into the next round (tasks.ts).
   */
  need: number;
  reqLevel: number;
  reward: { points: number; gold: number; exp: number };
}

export interface ExportWorld {
  key: string;
  name: string;
  safe: boolean;
  /** Size in tiles. */
  w: number;
  h: number;
  /** The ground art under /play/, `w x h` tiles at 32 px; null when there is none. */
  terrain: string | null;
  /** How many spawn posts each creature has on this map. */
  monsters: Record<string, number>;
  /** Every spawn post, for the map's markers. */
  spawns: { kind: string; tx: number; ty: number }[];
  npcs: { key: string; tx: number; ty: number }[];
  /** Ways out to other listed places. */
  exits: { to: string; tx: number; ty: number; style: "portal" | "ladderDown" | "ladderUp" | "caveMouth" }[];
  trees: number;
  rocks: number;
  /** The place's one-time chest, if it has one. */
  chest: { item: ItemKind; n: number }[] | null;
}

/** A matched set: head, body, legs and boots worn together pay the bonus. */
export interface ExportSet {
  key: string;
  name: string;
  /** Armor for wearing it whole. */
  bonus: number;
  /** Speed for wearing it whole, where the set pays one. */
  speedBonus: number;
  /** Listed pieces only, head to boots. */
  pieces: ItemKind[];
}

/** Who keeps the shelf: the task board's NPC. */
const SHELF_NPC = "taskmaster";

/** Grizelda's shelf (Etap 92), for her page. */
export interface ExportShelf {
  npc: string;
  /** Lifetime Task Points that reach each rank, lowest first. */
  ranks: { name: string; at: number }[];
  /** What the points buy, in shelf order. `item` is null for the outfit and the task slot. */
  entries: { id: string; name: string; note: string; item: ItemKind | null; rank: number; price: number }[];
  /** An errand more than this many levels below the character pays no points. */
  pointGap: number;
}

export interface GameData {
  elements: { id: Element; label: string }[];
  items: ExportItem[];
  monsters: ExportMonster[];
  npcs: ExportNpc[];
  worlds: ExportWorld[];
  tasks: ExportTask[];
  sets: ExportSet[];
  shelf: ExportShelf;
}

/* ------------------------------------------------------------------ */
/*  The cut                                                            */
/* ------------------------------------------------------------------ */

/** Every place a mission owns: its hunting ground and its echo. */
export function missionPlaces(): ReadonlySet<string> {
  return new Set<string>(MISSIONS.flatMap((m) => [m.ground, m.echo]));
}

/** What a boss gives straight into the pack, for the Time Sage: the errands themselves, never listed. */
export const RELICS: ReadonlySet<ItemKind> = new Set<ItemKind>(
  MISSIONS.flatMap((m) => (m.relic ? [m.relic] : [])),
);

/** Townsfolk who belong to the missions. Chronos hands them out and does nothing else. */
export const MISSION_NPCS: ReadonlySet<NpcKey> = new Set<NpcKey>(["timesage"]);

/**
 * Gear the code defines and nothing in the world hands out yet: the sets that
 * wait for the reward shelf, and the attunement Marks, whose lanes are opened
 * at the circles of Calanais now. Remove a line when its item gets a source;
 * the smoke suite says which line has gone stale.
 */
export const UNOBTAINABLE: ReadonlySet<ItemKind> = new Set<ItemKind>([
  // the Hunter set (keys of the old Snakeskin set)
  "snakeskinHelm", "snakeskinBody", "snakeskinLegs", "snakeskinBoots",
  // tier 7: Golden (human line) and Vampire (beast line)
  "goldenHelm", "goldenBody", "goldenLegs", "goldenBoots", "goldenShield", "sunspear",
  "vampireHelm", "vampireBody", "vampireLegs", "vampireBoots", "vampireShield", "bloodletter",
  // the Zephyr, the speed set
  "zephyrHelm", "zephyrBody", "zephyrLegs", "zephyrBoots",
  // the attunement Marks
  "fireCrystal", "waterCrystal", "earthCrystal", "windCrystal", "lightningCrystal",
]);

/** A set's name where it is not its key: the Hunter set keeps the Snakeskin's key (Etap 67). */
const SET_NAME: Partial<Record<SetKey, string>> = { snakeskin: "Hunter" };

/** What the town calls each townsperson, for the library's pages. */
const NPC_TITLE: Readonly<Record<NpcKey, string>> = {
  smith: "Smith",
  herbalist: "Herbalist",
  elder: "Elder",
  taskmaster: "Taskmaster",
  tailor: "Tailor",
  morgan: "Money changer",
  timesage: "Time Sage",
};

/** What each townsperson is for, as main.ts opens their window. */
const NPC_ROLE: Readonly<Record<NpcKey, NpcRole>> = {
  smith: "shop",
  herbalist: "shop",
  elder: "shop",
  taskmaster: "tasks",
  tailor: "wardrobe",
  morgan: "exchange",
  timesage: "missions",
};

function categoryOf(d: ItemDef): ItemCategory {
  if (d.coin !== undefined) return "coin";
  if (d.pack) return "container";
  if (d.slot === "weapon") return d.bow ? "distance weapon" : "weapon";
  if (d.slot === "shield") return "shield";
  if (d.slot === "ring" || d.slot === "amulet") return "jewellery";
  if (d.slot) return "armor";
  if (d.ammo) return "ammunition";
  if (d.crystal) return "crystal";
  if (d.heal !== undefined) return "potion";
  if (d.blessing) return "scroll";
  if (d.food !== undefined) return "food";
  return "material";
}

/** TEST items (instant levels, instant skills) are a developer's tools, not part of the world. */
const isTestItem = (d: ItemDef): boolean => d.testLevel !== undefined || d.testSkill !== undefined;

const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../public");

/** Width and height from a PNG's header, or null when the file is not there. */
function pngSize(file: string): { w: number; h: number } | null {
  const path = resolve(PUBLIC_DIR, file);
  if (!existsSync(path)) return null;
  const head = Buffer.alloc(24);
  const fd = openSync(path, "r");
  try { readSync(fd, head, 0, 24, 0); } finally { closeSync(fd); }
  if (head.toString("ascii", 12, 16) !== "IHDR") return null;
  return { w: head.readUInt32BE(16), h: head.readUInt32BE(20) };
}

function sheetOf(id: string): ExportSheet | null {
  const spec = sheetSpec(id);
  const size = spec ? pngSize(spec.src) : null;
  if (!spec || !size) return null;
  return {
    file: spec.src,
    w: size.w,
    h: size.h,
    frameW: Math.floor(size.w / spec.cols),
    frameH: Math.floor(size.h / spec.rows),
    cols: spec.cols,
    rows: spec.rows,
    sideOnly: spec.sideOnly,
    cycleS: walkCycleSeconds(id),
  };
}

/**
 * Every way to get every item, before the cut: `listed` are the sources the
 * library may show, `unlisted` counts the ones only the missions give.
 */
export function itemSources(): Map<ItemKind, { listed: ItemSource[]; unlisted: number }> {
  const hiddenPlaces = missionPlaces();
  const worlds = Object.values(buildWorlds(WORLD_SEED));
  const listedKinds = new Set<string>();
  for (const w of worlds) {
    if (hiddenPlaces.has(w.key)) continue;
    for (const p of w.mobPosts ?? []) listedKinds.add(p.kind);
  }

  const out = new Map<ItemKind, { listed: ItemSource[]; unlisted: number }>();
  const at = (k: ItemKind) => {
    let e = out.get(k);
    if (!e) out.set(k, (e = { listed: [], unlisted: 0 }));
    return e;
  };
  const add = (k: ItemKind, s: ItemSource) => { at(k).listed.push(s); };
  const hide = (k: ItemKind) => { at(k).unlisted++; };

  // ---- creatures
  for (const kind of MONSTER_KINDS) {
    const d = MONSTER_DEFS[kind];
    const listed = listedKinds.has(kind);
    for (const l of d.loot) {
      if (listed) add(l.kind, { type: "drop", creature: kind, chance: l.chance, n: l.n });
      else hide(l.kind);
    }
    if (d.gold[1] > 0) {
      if (listed) add("goldCoin", { type: "drop", creature: kind, chance: 1, n: d.gold });
      else hide("goldCoin");
    }
  }

  // ---- the relics: straight from the boss into the pack, never through a loot table
  for (const m of MISSIONS) if (m.relic) hide(m.relic);

  // ---- shops
  for (const [key, shop] of Object.entries(SHOPS) as [NpcKey, NonNullable<(typeof SHOPS)[NpcKey]>][]) {
    for (const e of shop.entries) {
      if (e.buy <= 0) continue;
      if (MISSION_NPCS.has(key)) hide(e.kind);
      else add(e.kind, { type: "shop", npc: key, price: e.buy });
    }
  }

  // ---- Grizelda's shelf (Etap 92): Task Points, behind a rank
  for (const e of SHELF) {
    if (e.good.type === "item") add(e.good.item, { type: "shelf", npc: SHELF_NPC, points: e.price, rank: RANKS[e.rank].name });
  }

  // ---- one-time chests
  for (const [place, prizes] of Object.entries(CHEST_PRIZES) as [WorldKey, readonly (ItemKind | readonly [ItemKind, number])[]][]) {
    for (const p of prizes) {
      const [item, n] = typeof p === "string" ? [p, 1] : p;
      if (hiddenPlaces.has(place)) hide(item);
      else add(item, { type: "chest", place, n });
    }
  }

  // ---- the Alchemy Tower
  for (const r of RESEARCH) {
    add(r.crystal, {
      type: "tower",
      towerTier: towerTierFor(r),
      gold: r.buyGold ?? 0,
      cost: { ...r.buyCost },
      batch: r.buyN,
      minLevel: r.minLevel ?? 1,
      element: r.element ?? null,
      research: r.openFromStart ? null : { gold: r.researchGold ?? 0, cost: { ...r.researchCost } },
    });
  }
  for (const o of OFFERS) {
    add(o.crystal, {
      type: "tower",
      towerTier: (o.tier + 1) as 1 | 2 | 3,
      gold: o.gold,
      cost: { ...o.cost },
      batch: o.buyN,
      minLevel: 1,
      element: o.element,
      research: null,
    });
  }

  // ---- the Forge
  add("iron", { type: "forge", method: "smelt", forgeTier: 1, coal: COAL_PER_SMELT });
  add("steel", { type: "forge", method: "smelt", forgeTier: 2, coal: COAL_PER_SMELT });
  add("essentialGem", { type: "forge", method: "gem", forgeTier: 3, coal: GEM_COAL, kinds: GEM_TROPHY_KINDS, trophies: [...GEM_TROPHIES] });

  // ---- the Forge's craft bench (always open, from the first tier)
  for (const r of RECIPES) {
    add(r.out, { type: "forge", method: "craft", forgeTier: 1, batch: r.outN ?? 1, cost: { ...r.cost } });
  }

  // ---- trees and rocks
  add("wood", { type: "gather", from: "tree" });
  add("stone", { type: "gather", from: "rock" });

  // ---- the money changer
  for (const coin of ["goldCoin", "platinumCoin"] as const) {
    if (MISSION_NPCS.has("morgan")) hide(coin);
    else add(coin, { type: "exchange", npc: "morgan" });
  }

  return out;
}

/** The levels a crystal's damage and healing are quoted at. */
export const CRYSTAL_LEVELS: readonly number[] = [1, 25, 50, 100];

const FORM_OF: Readonly<Record<string, ExportCrystalSpec["form"]>> = {
  shard: "shard", burst: "burst", nova: "nova", wave: "wave", rune: "knell",
};
const FOOTPRINT: Readonly<Record<string, number>> = {
  shard: 1, rune: 1, burst: BURST_TILES.length, nova: NOVA_TILES.length, wave: WAVE_TILES.length,
};

/** One crystal's spec, or null for an item that is not a crystal. */
export function crystalSpecOf(key: ItemKind): ExportCrystalSpec | null {
  if (!ITEMS[key].crystal) return null;
  const base = {
    damage: [], heal: [], reachTiles: null, footprint: null, aimed: false,
    cooldownS: ownCooldown(key), sharedS: groupCooldown(key), durationS: null, lockS: null, afterS: null,
  } satisfies Partial<ExportCrystalSpec>;
  const spec = CRYSTAL_SPECS[key];
  if (spec) {
    const mult = TIER_MULT[spec.tier];
    return {
      ...base,
      form: FORM_OF[spec.role],
      element: spec.element,
      tier: (spec.tier + 1) as 1 | 2 | 3,
      damage: CRYSTAL_LEVELS.map((level) => {
        const k = mult * (1 + level / CRYSTAL_LEVEL_SCALE);
        return { level, dmg: [Math.max(1, Math.round(spec.base[0] * k)), Math.max(1, Math.round(spec.base[1] * k))] as const };
      }),
      reachTiles: spec.range > 0 ? Math.round(spec.range / TILE) : null,
      footprint: FOOTPRINT[spec.role] ?? null,
      aimed: spec.role === "burst",
    };
  }
  const util = { ...base, element: null, tier: null };
  switch (key) {
    case "healCrystal":
      return { ...util, form: "life", heal: CRYSTAL_LEVELS.map((level) => ({ level, hp: HEAL_CRYSTAL_BASE + level * HEAL_CRYSTAL_PER_LEVEL })) };
    case "healRune":
      return { ...util, form: "life", heal: CRYSTAL_LEVELS.map((level) => ({ level, hp: HEAL_RUNE_BASE + level * HEAL_RUNE_PER_LEVEL })) };
    // Recall is a journey, not a cast: main.ts spends the charge and travels, with no clock.
    case "recallCrystal": return { ...util, form: "recall", cooldownS: null, sharedS: 0 };
    case "hasteRune": return { ...util, form: "haste", durationS: HASTE_RUNE_S };
    case "mireRune": return { ...util, form: "slowdown", durationS: MIRE_RUNE_S, reachTiles: MIRE_RUNE_TILES };
    case "aegisRune": return { ...util, form: "protection", durationS: AEGIS_RUNE_S, lockS: AEGIS_LOCK_S };
    case "furyRune": return { ...util, form: "fury", durationS: FURY_RUNE_S, lockS: FURY_LOCK_S, afterS: FURY_DEBT_S };
    default: return null;
  }
}

/** Descriptions the tower gives its crystals, by item. */
function towerDescs(): Map<ItemKind, string> {
  const out = new Map<ItemKind, string>();
  for (const r of RESEARCH) out.set(r.crystal, r.desc);
  for (const o of OFFERS) out.set(o.crystal, o.desc);
  return out;
}

export function collectGameData(): GameData {
  const hiddenPlaces = missionPlaces();
  const built = Object.values(buildWorlds(WORLD_SEED));
  const listedWorlds = built.filter((w) => !hiddenPlaces.has(w.key));
  const placeKeys = new Set(listedWorlds.map((w) => w.key as string));

  // ---- creatures: the ones standing on a listed place
  const kinds = new Set<string>();
  for (const w of listedWorlds) for (const p of w.mobPosts ?? []) kinds.add(p.kind);

  // ---- items: the ones something listed hands out
  const sources = itemSources();
  const descs = towerDescs();
  const items: ExportItem[] = [];
  for (const key of Object.keys(ITEMS) as ItemKind[]) {
    const def = ITEMS[key];
    if (isTestItem(def)) continue;
    const entry = sources.get(key);
    const listed = entry?.listed ?? [];
    const waiting = UNOBTAINABLE.has(key);
    const secret = listed.length === 0 && (entry?.unlisted ?? 0) > 0 && !RELICS.has(key);
    if (listed.length === 0 && !waiting && !secret) continue;
    const { testLevel: _l, testSkill: _s, ...rest } = def;
    const icon = iconFile(key);
    items.push({
      key,
      category: categoryOf(def),
      ...rest,
      icon: existsSync(resolve(PUBLIC_DIR, icon)) ? icon : null,
      desc: descs.get(key) ?? null,
      obtainable: !waiting,
      secretSource: secret,
      sources: listed,
      sellTo: [],
      crystalSpec: crystalSpecOf(key),
    });
  }
  const itemKeys = new Set<string>(items.map((i) => i.key));

  const monsters: ExportMonster[] = MONSTER_KINDS.filter((k) => kinds.has(k)).map((kind) => {
    const d = MONSTER_DEFS[kind];
    return {
      kind,
      name: mobName(kind),
      hp: d.hp,
      exp: d.exp,
      dmg: d.dmg,
      armor: d.armor ?? 0,
      speed: d.speed,
      gold: d.gold,
      loot: d.loot.map((l) => ({ item: l.kind, chance: l.chance, n: l.n })),
      element: d.element ?? null,
      resist: { ...(monsterResist(d) ?? {}) },
      ranged: d.ranged ? { tiles: Math.round(d.ranged.range / TILE), dmg: d.ranged.dmg } : null,
      spells: (d.spells ?? []).map((s) => s.shape === "field"
        ? { name: s.name, element: s.element, dmg: FIELD_TICK_DMG, field: true }
        : { name: s.name, element: s.element, dmg: s.dmg, field: false }),
      respawnS: d.respawnS ?? null,
      sprite: sheetOf(kind),
    };
  });

  // ---- townsfolk: everyone but the missions' own
  const npcs: ExportNpc[] = [];
  for (const [key, name] of NPC_DATA) {
    if (MISSION_NPCS.has(key)) continue;
    const role = NPC_ROLE[key];
    if (role === "missions") continue;
    const shop = SHOPS[key];
    const places = listedWorlds.flatMap((w) =>
      w.npcs.filter((n) => n.key === key).map((n) => ({ place: w.key as string, tx: n.tx, ty: n.ty })));
    npcs.push({
      key,
      name,
      title: NPC_TITLE[key],
      role,
      places,
      sprite: sheetOf(`npc:${key}`),
      shop: shop
        ? {
            greeting: shop.greeting,
            entries: shop.entries.filter((e) => itemKeys.has(e.kind)).map((e) => ({ item: e.kind, buy: e.buy, sell: e.sell })),
          }
        : null,
      wardrobe: role === "wardrobe"
        ? {
            zones: Object.values(zoneLabels()),
            colours: OUTFIT_COLORS.length,
            outfits: WARDROBE_OUTFITS.map((id) => ({
              name: OUTFITS[id]?.name ?? id,
              shelf: SHELF.some((e) => e.good.type === "outfit" && e.good.outfit === id),
            })),
          }
        : null,
      exchange: role === "exchange"
        ? { rate: (ITEMS.platinumCoin.coin ?? 100) / (ITEMS.goldCoin.coin ?? 1) }
        : null,
    });
  }
  const npcKeys = new Set(npcs.map((n) => n.key));
  for (const n of npcs) {
    for (const e of n.shop?.entries ?? []) {
      if (e.sell > 0) items.find((i) => i.key === e.item)?.sellTo.push({ npc: n.key, price: e.sell });
    }
  }

  const worlds: ExportWorld[] = listedWorlds.map((w) => {
    const counts: Record<string, number> = {};
    for (const p of w.mobPosts ?? []) counts[p.kind] = (counts[p.kind] ?? 0) + 1;
    const terrain = TERRAIN_SRC[w.key]?.replace(/^\.\//, "") ?? null;
    const chest = CHEST_PRIZES[w.key];
    return {
      key: w.key,
      name: w.name,
      safe: w.safe,
      w: w.w,
      h: w.h,
      terrain: terrain && existsSync(resolve(PUBLIC_DIR, terrain)) ? terrain : null,
      monsters: counts,
      spawns: (w.mobPosts ?? []).map((p) => ({ kind: p.kind, tx: p.tx, ty: p.ty })),
      npcs: w.npcs.filter((n) => npcKeys.has(n.key)).map((n) => ({ key: n.key, tx: n.tx, ty: n.ty })),
      exits: w.portals
        .filter((p) => !p.inactive && placeKeys.has(p.dest))
        .map((p) => ({ to: p.dest, tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE), style: p.style ?? "portal" })),
      trees: w.trees.length,
      rocks: w.rocks.length,
      chest: chest ? chest.map((p) => (typeof p === "string" ? { item: p, n: 1 } : { item: p[0], n: p[1] })) : null,
    };
  });

  const tasks: ExportTask[] = TASKS.map((t) => ({
    id: t.id,
    title: t.title,
    creatures: t.goal.kinds.filter((k) => kinds.has(k)),
    need: t.goal.need,
    reqLevel: t.reqLevel,
    reward: { points: t.reward.points, gold: t.reward.gold, exp: t.reward.exp },
  })).filter((t) => t.creatures.length > 0);

  // ---- sets: the ones with at least one listed piece, pieces head to boots
  const slotOrder = ["head", "body", "legs", "boots"];
  const sets: ExportSet[] = (Object.keys(SET_BONUS) as SetKey[]).map((key) => ({
    key,
    name: SET_NAME[key] ?? key.charAt(0).toUpperCase() + key.slice(1),
    bonus: SET_BONUS[key],
    speedBonus: SET_SPEED_BONUS[key] ?? 0,
    pieces: items
      .filter((i) => i.set === key)
      .sort((a, b) => slotOrder.indexOf(a.slot ?? "") - slotOrder.indexOf(b.slot ?? ""))
      .map((i) => i.key),
  })).filter((s) => s.pieces.length > 0);

  const shelf: ExportShelf = {
    npc: SHELF_NPC,
    ranks: RANKS.map((r) => ({ name: r.name, at: r.at })),
    entries: SHELF.map((e) => ({
      id: e.id,
      name: shelfLabel(e),
      note: shelfNote(e),
      item: e.good.type === "item" && itemKeys.has(e.good.item) ? e.good.item : null,
      rank: e.rank,
      price: e.price,
    })),
    pointGap: TP_LEVEL_GAP,
  };

  return {
    elements: ELEMENTS.map((id) => ({ id, label: ELEMENT_LABEL[id] })),
    items,
    monsters,
    npcs,
    worlds,
    tasks,
    sets,
    shelf,
  };
}

/** Where the site's build picks the tables up. Generated on every build, never committed. */
export const OUT_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../web/src/data/generated/game-data.json");

const runDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runDirectly) {
  const data = collectGameData();
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(data, null, 2) + "\n");
  console.log(
    `game data: ${data.items.length} items, ${data.monsters.length} creatures, ` +
      `${data.npcs.length} NPCs, ${data.worlds.length} places, ${data.tasks.length} tasks -> ${OUT_FILE}`,
  );
}
