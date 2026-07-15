/**
 * Hand-authored hub islands (Home Isle & Bonetown).
 *
 * Instead of rolling these from the world RNG like the Wildlands, they are laid
 * out by hand as character grids — one glyph per tile — so shops, build plots
 * and portals sit exactly where they were designed to. The parser turns a grid
 * into the very same `World` shape `makeWorld` produces, so every downstream
 * system (collision, spawns, resource nodes, NPCs, build spots, save/load, the
 * baker) works unchanged. Because nothing here touches the world RNG, the
 * Wildlands stays deterministic from the seed regardless of hub edits.
 *
 * Glyph legend (shared):
 *   ~ water    . grass    , sand    # ruined wall
 *   T tree     R rock     H herb    M mushroom (decor)   o bones (decor)
 *   (structures are placed free-form at runtime — no build-pad glyphs)
 * Per-map glyphs (portals & NPCs) are resolved through the spec's own maps, so
 * the same letter can mean different things on different islands.
 *
 * The coastline is a plain rounded shape; the parts that matter — where things
 * are placed — are the authored coordinates. Every glyph can be edited by hand;
 * the smoke tests re-validate row lengths, feature counts and a walkable spawn.
 */
import { TILE } from "../config.ts";
import { SPR, bakeTree } from "../gfx/sprites.ts";
import { NPC_DATA, bakeWorldCanvas } from "./generate.ts";
import { Tile } from "./types.ts";
import type { World, WorldKey, NpcKey } from "./types.ts";

interface PortalDef {
  dest: WorldKey;
  label: string;
}

export interface HandmadeSpec {
  key: WorldKey;
  name: string;
  safe: boolean;
  grassShift?: number;
  rows: readonly string[];
  /** Glyph → portal destination. */
  portals: Readonly<Record<string, PortalDef>>;
  /** Glyph → town NPC key. */
  npcs?: Readonly<Record<string, NpcKey>>;
}

/** NPC display name + sprite, keyed for O(1) lookup while parsing. */
const NPC_BY_KEY = new Map<NpcKey, { name: string; spr: HTMLCanvasElement }>(
  NPC_DATA.map(([key, name, spr]) => [key, { name, spr }]),
);

const baseTileOf = (ch: string): Tile => {
  if (ch === "~") return Tile.Water;
  if (ch === ",") return Tile.Sand;
  if (ch === "#") return Tile.Wall;
  return Tile.Grass; // '.' and every feature glyph sit on grass
};

/** Parse a character grid into a full World (same contract as makeWorld). */
export function makeHandmadeWorld(spec: HandmadeSpec): World {
  const rows = spec.rows;
  const H = rows.length;
  const W = rows[0]?.length ?? 0;
  for (let y = 0; y < H; y++) {
    if (rows[y].length !== W) {
      throw new Error(`handmade ${spec.key}: row ${y} is ${rows[y].length} wide, expected ${W}`);
    }
  }

  const tile: Tile[][] = [];
  const solid: boolean[][] = [];
  for (let y = 0; y < H; y++) {
    tile[y] = [];
    solid[y] = [];
    for (let x = 0; x < W; x++) {
      const t = baseTileOf(rows[y][x]);
      tile[y][x] = t;
      solid[y][x] = t === Tile.Water || t === Tile.Wall;
    }
  }

  const w: World = {
    key: spec.key,
    name: spec.name,
    safe: spec.safe,
    w: W,
    h: H,
    tile,
    solid,
    reserved: [],
    trees: [],
    rocks: [],
    herbs: [],
    decos: [],
    monsters: [],
    corpses: [],
    ground: [],
    npcs: [],
    respawns: [],
    shots: [],
    structures: [],
    buildSpots: [],
    portals: [],
    coastWater: [],
    // Authored maps have no radial silhouette; the baker no longer needs one.
    landR: () => Math.max(W, H),
    mapCanvas: document.createElement("canvas"),
  };

  // Second pass: features. Reading order (top→bottom, left→right) fixes a
  // stable, deterministic order for build spots — important for save migration.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x];
      const cx = x * TILE + TILE / 2;
      const cy = y * TILE + TILE / 2;
      switch (ch) {
        case "T":
          w.trees.push({ tx: x, ty: y, spr: bakeTree(), hp: 3, maxhp: 3, stump: false, respawnT: 0, hurtT: 0 });
          solid[y][x] = true;
          break;
        case "R":
          w.rocks.push({ tx: x, ty: y, hp: 4, maxhp: 4, depleted: false, respawnT: 0, hurtT: 0 });
          solid[y][x] = true;
          break;
        case "H":
          w.herbs.push({ tx: x, ty: y, picked: false, respawnT: 0 });
          break;
        case "M":
          w.decos.push({ spr: SPR.mushroom, tx: x, ty: y });
          break;
        case "o":
          w.decos.push({ spr: SPR.bones, tx: x, ty: y });
          break;
        case "B":
          w.buildSpots.push({ tx: x, ty: y, built: null });
          break;
        default: {
          const pdef = spec.portals[ch];
          if (pdef) {
            w.portals.push({ x: cx, y: cy, dest: pdef.dest, label: pdef.label });
            break;
          }
          const nkey = spec.npcs?.[ch];
          if (nkey) {
            const meta = NPC_BY_KEY.get(nkey);
            if (meta) w.npcs.push({ key: nkey, name: meta.name, x: cx, y: cy, spr: meta.spr, bob: (x + y) % 3 });
          }
          break;
        }
      }
    }
  }

  bakeWorldCanvas(w, spec.grassShift ?? 0);
  return w;
}

/* ------------------------------------------------------------------ */
/*  HOME ISLE — your base. One portal to Bonetown, six build pads.     */
/* ------------------------------------------------------------------ */
const HOME_ROWS: readonly string[] = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~,,,,,,,,,,,~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~,,,,,,.....,,,,,,~~~~~~~~~~~",
  "~~~~~~~~~~~,,,T.....o..T...,,,~~~~~~~~~~",
  "~~~~~~~~~,,,.................,,,~~~~~~~~",
  "~~~~~~~~,,,..................T,,,~~~~~~~",
  "~~~~~~~,,,.....................,,,~~~~~~",
  "~~~~~~,,,.......................,,,~~~~~",
  "~~~~~~,,R.M...................T..,,~~~~~",
  "~~~~~~,,T.......H.......H........,,~~~~~",
  "~~~~~,,R........................TR,,~~~~",
  "~~~~~,,...........................,,~~~~",
  "~~~~~,,R........................TR,,~~~~",
  "~~~~~,,...........................,,~~~~",
  "~~~~~,,R.......................T..,,~~~~",
  "~~~~~~,,T....M............M.....R,,~~~~~",
  "~~~~~~,,.........................,,~~~~~",
  "~~~~~~,,,TR....H.......H.....T..,,,~~~~~",
  "~~~~~~~,,,.....................,,,~~~~~~",
  "~~~~~~~~,,,........P..........,,,~~~~~~~",
  "~~~~~~~~~,,,H..............H.,,,~~~~~~~~",
  "~~~~~~~~~~~,,,..M.......o..,,,~~~~~~~~~~",
  "~~~~~~~~~~~~,,,,,,...M.,,,,,,~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~,,,,,,,,,,,~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
];

export const HOME_SPEC: HandmadeSpec = {
  key: "home",
  name: "Home Isle",
  safe: true,
  rows: HOME_ROWS,
  portals: { P: { dest: "town", label: "to Bonetown" } },
};

/* ------------------------------------------------------------------ */
/*  BONETOWN — the hub. NPCs round a plaza; two portals (home / wild).  */
/* ------------------------------------------------------------------ */
const TOWN_ROWS: readonly string[] = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~,,,,,,,~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~,,,,,,,,,,,,,,,~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~,,,,.....T.....,,,,~~~~~~~~~~~~",
  "~~~~~~~~~~~,,,,...............,,,,~~~~~~~~~~",
  "~~~~~~~~~~,,,..H.............H..,,,~~~~~~~~~",
  "~~~~~~~~~,,...................W...,,~~~~~~~~",
  "~~~~~~~~,,.......................##,,~~~~~~~",
  "~~~~~~~,,##...o.....................,,~~~~~~",
  "~~~~~~,,,.#.................o.......,,,~~~~~",
  "~~~~~~,,...M.....s,,,,,,,,,h.....M...,,~~~~~",
  "~~~~~,,,..........,,,,,,,,,..........,,,~~~~",
  "~~~~~,,R...T......,,,,,,,,,......T....,,~~~~",
  "~~~~~,,...........,,,,,,,,,...........,,~~~~",
  "~~~~~,,......H....,,,,,,,,,....H....R.,,~~~~",
  "~~~~~,,..T........,,,,,,,,,...........,,~~~~",
  "~~~~~,,...........,,,,,,,,,........T..,,~~~~",
  "~~~~~,,,..........,,,,,,,,,.........R,,,~~~~",
  "~~~~~~,,R........e,,,,,,,,,g.........,,~~~~~",
  "~~~~~~,,,...........................,,,~~~~~",
  "~~~~~~~,,...T.....................##,,~~~~~~",
  "~~~~~~~~,,.........................#,~~~~~~~",
  "~~~~~~~~~,,R..P...............o.TR,,~~~~~~~~",
  "~~~~~~~~~~,,,M................M.,,,~~~~~~~~~",
  "~~~~~~~~~~~,,,,H.............H,,,,~~~~~~~~~~",
  "~~~~~~~~~~~~~,,,,...H...H...,,,,~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~,,,,,,,,,,,,,,,~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~,,,,,,,~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
];

export const TOWN_SPEC: HandmadeSpec = {
  key: "town",
  name: "Bonetown",
  safe: true,
  grassShift: 4,
  rows: TOWN_ROWS,
  portals: {
    P: { dest: "home", label: "to Home Isle" },
    W: { dest: "wild", label: "to the Wildlands" },
  },
  npcs: { s: "smith", h: "herbalist", e: "elder", g: "taskmaster" },
};
