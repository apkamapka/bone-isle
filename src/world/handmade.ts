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
 *   : dirt trail (walkable)   = cave floor (underground maps)
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
  style?: "ladderDown" | "ladderUp" | "caveMouth";
  /** Dormant pad — rendered ashen, refuses travel (quest realms come later). */
  inactive?: boolean;
  /** Terrain painted under the portal glyph (default grass). */
  floor?: Tile;
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
  /** Glyph → required level for a sealed doorway (rendered as a portcullis,
   *  solid until the player reaches the level; floor beneath is cave). */
  gates?: Readonly<Record<string, number>>;
}

/** NPC display name + sprite, keyed for O(1) lookup while parsing. */
const NPC_BY_KEY = new Map<NpcKey, { name: string; spr: HTMLCanvasElement }>(
  NPC_DATA.map(([key, name, spr]) => [key, { name, spr }]),
);

const baseTileOf = (ch: string): Tile => {
  if (ch === "~") return Tile.Water;
  if (ch === ",") return Tile.Sand;
  if (ch === "#") return Tile.Wall;
  if (ch === ":") return Tile.Dirt;
  if (ch === "=") return Tile.Cave;
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
    gates: [],
    camps: [],
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
          const gateLv = spec.gates?.[ch];
          if (gateLv !== undefined) {
            // a sealed doorway: cave floor beneath, solid until unlocked
            tile[y][x] = Tile.Cave;
            solid[y][x] = true;
            w.gates.push({ tx: x, ty: y, lv: gateLv });
            break;
          }
          const pdef = spec.portals[ch];
          if (pdef) {
            if (pdef.floor !== undefined) {
              tile[y][x] = pdef.floor;
              solid[y][x] = false;
            }
            w.portals.push({ x: cx, y: cy, dest: pdef.dest, label: pdef.label,
              ...(pdef.style ? { style: pdef.style } : {}),
              ...(pdef.inactive ? { inactive: true } : {}) });
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
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~,,,,,,,~~~~~~~~~~~~~~~~~~",
  "~~~~~~~,,,,,,,,,,,~~~~~~~~~~~~~~~~~~~~~~~,,,,,,,,,,,,,,,~~~~~~~~~~~~~~",
  "~~~~~,,,,.........,,~~~~~~~~~~~~~~~~~~~,,,,.....T.....,,,,~~~~~~~~~~~~",
  "~~~~,,...T.....T...,,~~~~~~~~~~~~~~~~,,,,...............,,,,~~~~~~~~~~",
  "~~~,,.....o...o.....,,~~~~~~~~~~~~~~,,,..H.............H..,,,~~~~~~~~~",
  "~~~,,.###########...,,~~~~~~~~~~~~~,,...................W...,,~~~~~~~~",
  "~~,,..#,,,,,,,,,#....,,~~~~~~~~~~~,,.......................##,,~~~~~~~",
  "~~,,.o#,,,,,,,,,#o...,,~~~~~~~~~~,,##...o.....................,,~~~~~~",
  "~~,,..#,,,,,,,,,#..T..,,~~~~~~~~,,,.#.................o.......,,,~~~~~",
  "~~,,..#,,,S,,,,,#.....,,~~~~~~~~,,...M.....s,,,,,,,,,h.....M...,,~~~~~",
  "~~,,.o#,,,,,,,,,#o...,,,,,,,,,,,,,..........,,,,,,,,,..........,,,~~~~",
  "~~,,..#,,,,,,,,,:::::::::::::::,,R...T......,,,,,,,,,......T....,,~~~~",
  "~~,,.o#,,,,,,,,,:::::::::::::::,,...........,,,,,,,,,...........,,~~~~",
  "~~,,..#,,,,,,,,,#..,,,,,,,,,,,,,,......H....,,,,,,,,,....H....R.,,~~~~",
  "~~,,.o#,,,,,,,,,#o...,,,~~~,,,,,,..T........,,,,,,,,,..t........,,~~~~",
  "~~,,..#,,,,,,,,,#..T..,,~~~~~~~,,...........,,,,,,,,,........T..,,~~~~",
  "~~~,,.###########.....,,~~~~~~~,,,..........,,,,,,,,,.........R,,,~~~~",
  "~~~,,......o.........,,~~~~~~~~~,,R........e,,,,,,,,,g......D..,,~~~~~",
  "~~~~,,...T.....T....,,~~~~~~~~~~,,,...........................,,,~~~~~",
  "~~~~~,,,,.........,,,~~~~~~~~~~~~,,...T.....................##,,~~~~~~",
  "~~~~~~~,,,,,,,,,,,,~~~~~~~~~~~~~~~,,.........................#,~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~,,R..P...............o.TR,,~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~,,,M................M.,,,~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~,,,,H.............H,,,,~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~,,,,...H...H...,,,,~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~,,,,,,,,,,,,,,,~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~,,,,,,,~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
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
    D: { dest: "deepwild", label: "to the Deep Wildlands" },
    S: { dest: "sanctum", label: "to the Bone Sanctum", style: "ladderDown", floor: Tile.Sand },
  },
  npcs: { s: "smith", h: "herbalist", e: "elder", g: "taskmaster", t: "tailor" },
};

/* ------------------------------------------------------------------ */
/*  BONE SANCTUM — the crypt beneath the western temple. Five chambers */
/*  sealed by level gates (10/15/20/25/30); each holds a dormant       */
/*  teleport pad that will link to a quest realm in a future stage.    */
/* ------------------------------------------------------------------ */
const SANCTUM_ROWS: readonly string[] = [
  "##############################",
  "##############################",
  "##############################",
  "##############################",
  "###o===#====#====#====#===o###",
  "###====#====#====#====#====###",
  "###=a==#=b==#=c==#=d==#=e==###",
  "###====#====#====#====#====###",
  "###====#====#====#====#====###",
  "###====#====#====#====#====###",
  "####11###22###33###44###55####",
  "###========================###",
  "###==========o==o==========###",
  "###==o==================o==###",
  "###====#==============#====###",
  "###========================###",
  "###========================###",
  "###========================###",
  "###====#==============#====###",
  "###===========U============###",
  "###=o====================o=###",
  "##############################",
  "##############################",
  "##############################",
];

const dormant = (label: string) =>
  ({ dest: "sanctum", label, inactive: true, floor: Tile.Cave } as const);

export const SANCTUM_SPEC: HandmadeSpec = {
  key: "sanctum",
  name: "Bone Sanctum",
  safe: true,
  rows: SANCTUM_ROWS,
  portals: {
    U: { dest: "town", label: "to Bonetown", style: "ladderUp", floor: Tile.Cave },
    a: dormant("Dormant Portal I"),
    b: dormant("Dormant Portal II"),
    c: dormant("Dormant Portal III"),
    d: dormant("Dormant Portal IV"),
    e: dormant("Dormant Portal V"),
  },
  gates: { "1": 10, "2": 15, "3": 20, "4": 25, "5": 30 },
};
