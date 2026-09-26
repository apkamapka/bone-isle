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
 * `collectGameData()` too (Etap 74), which is what keeps this file from
 * rotting quietly between website sessions.
 *
 * Exact drop chances ARE in the output. The site shows rarity labels instead
 * (a decision, not a limitation of the data), and it reads this file at build
 * time only, so the numbers never reach a visitor's browser.
 */
import "../smoke/stub.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ITEMS, type ItemDef, type ItemKind } from "../src/items.ts";
import { MONSTER_DEFS, MONSTER_KINDS, mobName, monsterResist } from "../src/entities/monsters.ts";
import { SHOPS } from "../src/entities/npcs.ts";
import { NPC_DATA } from "../src/world/generate.ts";
import { buildWorlds } from "../src/game.ts";
import { ELEMENTS, ELEMENT_LABEL, type Element, type Resistances } from "../src/systems/elements.ts";
import { TILE, WORLD_SEED } from "../src/config.ts";

export type ItemCategory =
  | "weapon" | "distance weapon" | "shield" | "armor" | "jewellery"
  | "ammunition" | "crystal" | "potion" | "food" | "container" | "coin" | "material";

export interface ExportItem extends Omit<ItemDef, "testLevel" | "testSkill"> {
  key: ItemKind;
  category: ItemCategory;
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
  spells: { name: string; element: Element; dmg: readonly [number, number] }[];
  respawnS: number | null;
}

export interface ExportNpc {
  key: string;
  name: string;
  shop: { greeting: string; entries: { item: ItemKind; buy: number; sell: number }[] } | null;
}

export interface ExportWorld {
  key: string;
  name: string;
  safe: boolean;
  /** How many spawn posts each creature has on this map. */
  monsters: Record<string, number>;
}

export interface GameData {
  elements: { id: Element; label: string }[];
  items: ExportItem[];
  monsters: ExportMonster[];
  npcs: ExportNpc[];
  worlds: ExportWorld[];
}

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
  if (d.food !== undefined) return "food";
  return "material";
}

/** TEST items (instant levels, instant skills) are a developer's tools, not part of the world. */
const isTestItem = (d: ItemDef): boolean => d.testLevel !== undefined || d.testSkill !== undefined;

export function collectGameData(): GameData {
  const items: ExportItem[] = [];
  for (const key of Object.keys(ITEMS) as ItemKind[]) {
    const def = ITEMS[key];
    if (isTestItem(def)) continue;
    const { testLevel: _l, testSkill: _s, ...rest } = def;
    items.push({ key, category: categoryOf(def), ...rest });
  }

  const monsters: ExportMonster[] = MONSTER_KINDS.map((kind) => {
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
      spells: (d.spells ?? []).map((s) => ({ name: s.name, element: s.element, dmg: s.dmg })),
      respawnS: d.respawnS ?? null,
    };
  });

  const npcs: ExportNpc[] = NPC_DATA.map(([key, name]) => {
    const shop = SHOPS[key];
    return {
      key,
      name,
      shop: shop
        ? { greeting: shop.greeting, entries: shop.entries.map((e) => ({ item: e.kind, buy: e.buy, sell: e.sell })) }
        : null,
    };
  });

  const worlds: ExportWorld[] = Object.values(buildWorlds(WORLD_SEED)).map((w) => {
    const counts: Record<string, number> = {};
    for (const p of w.mobPosts ?? []) counts[p.kind] = (counts[p.kind] ?? 0) + 1;
    return { key: w.key, name: w.name, safe: w.safe, monsters: counts };
  });

  return {
    elements: ELEMENTS.map((id) => ({ id, label: ELEMENT_LABEL[id] })),
    items,
    monsters,
    npcs,
    worlds,
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
      `${data.npcs.length} NPCs, ${data.worlds.length} places -> ${OUT_FILE}`,
  );
}
