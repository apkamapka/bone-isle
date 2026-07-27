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
import { npcRest } from "../entities/npcs.ts";
import type { MonsterKind } from "./types.ts";
import { Tile } from "./types.ts";
import type { World, WorldKey, NpcKey } from "./types.ts";

interface PortalDef {
  dest: WorldKey;
  label: string;
  style?: "ladderDown" | "ladderUp" | "caveMouth";
  /** Dormant pad — rendered ashen, refuses travel (quest realms come later). */
  inactive?: boolean;
  /** Pads painted larger than one tile: the glyph marks the block's TOP-LEFT
   *  square and `span` says how many tiles across it runs. The portal is
   *  centred on the block, so every square of it teleports. */
  span?: number;
  /** Terrain painted under the portal glyph (default grass). */
  floor?: Tile;
}

/** A townsperson placed on a specific map, with that map's beat. */
export interface NpcPlacement {
  key: NpcKey;
  /** How many tiles he may stray in each direction from where the glyph put
   *  him. Anything omitted falls back to the roster's own radius, so
   *  `{ west: 4, east: 4 }` on a rooted NPC gives a line and nothing else. */
  beat?: { west?: number; east?: number; north?: number; south?: number };
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
  /** Glyph → town NPC key, or the same key with this map's own beat: `roam`
   *  tiles east/west, `roamY` north/south (both default to the roster's), and
   *  `floor` for the terrain painted underneath (default grass, as before). */
  npcs?: Readonly<Record<string, NpcKey | NpcPlacement>>;
  /** Glyph → required level for a sealed doorway (rendered as a portcullis,
   *  solid until the player reaches the level; floor beneath is cave). */
  gates?: Readonly<Record<string, number>>;
  /** Glyph marking the map's spawn tile (plain grass underneath). Resolved
   *  per-spec rather than hard-coded, because the same letter already means a
   *  portal on Bonetown. */
  spawn?: string;
  /** Rows 0..safeMaxY stay a haven even though the map itself is hostile. */
  safeMaxY?: number;
  /** Glyph → creature posted on that tile (plain grass or road underneath). */
  monsters?: Readonly<Record<string, MonsterKind>>;
}

/** NPC display name + sprite, keyed for O(1) lookup while parsing. */
const NPC_BY_KEY = new Map<NpcKey, { name: string; spr: HTMLCanvasElement; roam: number }>(
  NPC_DATA.map(([key, name, spr, roam]) => [key, { name, spr, roam }]),
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
    safeMaxY: spec.safeMaxY,
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
          const mob = spec.monsters?.[ch];
          if (mob) {
            (w.mobPosts ??= []).push({ kind: mob, tx: x, ty: y });
            break;
          }
          if (spec.spawn && ch === spec.spawn) {
            w.spawn = { x: cx, y: cy };
            break;
          }
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
            const span = pdef.span ?? 1;
            if (pdef.floor !== undefined) {
              // paint the WHOLE block, not just the glyph's own square
              for (let dy = 0; dy < span; dy++) {
                for (let dx = 0; dx < span; dx++) {
                  const bx = x + dx;
                  const by = y + dy;
                  if (bx >= W || by >= H) continue;
                  tile[by][bx] = pdef.floor;
                  solid[by][bx] = false;
                }
              }
            }
            w.portals.push({ x: cx + ((span - 1) * TILE) / 2, y: cy + ((span - 1) * TILE) / 2,
              dest: pdef.dest, label: pdef.label,
              ...(pdef.style ? { style: pdef.style } : {}),
              ...(pdef.inactive ? { inactive: true } : {}),
              ...(span > 1 ? { span } : {}) });
            break;
          }
          const nspec = spec.npcs?.[ch];
          if (nspec) {
            const place: NpcPlacement = typeof nspec === "string" ? { key: nspec } : nspec;
            const meta = NPC_BY_KEY.get(place.key);
            if (meta) {
              if (place.floor !== undefined) {
                tile[y][x] = place.floor;
                solid[y][x] = false;
              }
              const b = place.beat ?? {};
              w.npcs.push({
                key: place.key, name: meta.name, spr: meta.spr, bob: (x + y) % 3,
                x: cx, y: cy, tx: x, ty: y,
                hx: x, hy: y,
                bx0: x - (b.west ?? meta.roam), bx1: x + (b.east ?? meta.roam),
                by0: y - (b.north ?? meta.roam), by1: y + (b.south ?? meta.roam),
                dir: "down", rest: npcRest(), phase: 0, moving: false, talk: 0,
              });
            }
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
/*  HOME ISLE — authored in Tiled and converted to this glyph grid.    */
/*  Terrain art comes from the Tiled export (public/home-terrain.png);  */
/*  this grid carries only COLLISION, derived from that same image so   */
/*  you can walk exactly where land is drawn. Shoreline tiles that are  */
/*  more than half water are '~'. ':' is the bridge deck, 'S' spawn.    */
/* ------------------------------------------------------------------ */
const HOME_ROWS: readonly string[] = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~...R......~~~~~..~~~~~~~",
  "~~~~~~~~~...T.........~~~~....~~~~~",
  "~~~~~~~~~.............~~~~.P..~~~~~",
  "~~~~~~~~~R..........S.~~~~.....~~~~",
  "~~~~~~~~..T...........~~~~~....~~~~",
  "~~~~~~~~~.............~~~~~.....~~~",
  "~~~~~~~~~~..~~~~~~~..~~~~~~T...R~~~",
  "~~~~~~~~~~~~~~~~~~~::~~~~~~.....~~~",
  "~~~~~~~~~~~~~~~~~~~::~~~~~......~~~",
  "~~~~~~~~~~~~~~~~~~~::~~~~.......~~~",
  "~~~~~~~~~~~...~~.....~~~.R....T.~~~",
  "~~~~~.....R.....................~~~",
  "~~~~...........................~~~~",
  "~~~~~.T........................~~~~",
  "~~~~~....T....................~~~~~",
  "~~~~~..........................~~~~",
  "~~~~~.........................~~~~~",
  "~~~~...T....................T..~~~~",
  "~~~~~..........................~~~~",
  "~~~~~~.R...T..............R..~~~~~~",
  "~~~~~~....................~~~~~~~~~",
  "~~~~~....R................~~~~~~~~~",
  "~~~~~~.................T.~~~~~~~~~~",
  "~~~~~~.T.................~~~~~~~~~~",
  "~~~~~......R...T.....R...~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
];

export const HOME_SPEC: HandmadeSpec = {
  key: "home",
  name: "Home Isle",
  safe: true,
  rows: HOME_ROWS,
  portals: { P: { dest: "town", label: "to Bonetown" } },
  spawn: "S",
};

/* ------------------------------------------------------------------ */
/*  BONETOWN — the hub. NPCs round a plaza; two portals (home / wild).  */
/* ------------------------------------------------------------------ */
const TOWN_ROWS: readonly string[] = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~........~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~.....::::.T....~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~......::::::......~~~~~~~~~~~~.............~~~~~~~~~",
  "~~~~~~~....T..::C:::.......~~~~~~~.......R...T..R....~~~~~~~",
  "~~~~~~~.......::::::...T.....~~~......T.:::::::::..T..~~~~~~",
  "~~~~~~~....R...::::....................:::::::::::....~~~~~~",
  "~~~~~~.........::::R....R.......T.....:::::::::::::.R.~~~~~~",
  "~~~~~~~.T.::::::::::::::.............:::s:::::::h:::...~~~~~",
  "~~~~~~~...::::::::::::::...T..R....T.:::::::::::::::.T~~~~~~",
  "~~~~~~....::::::::::::::::::::::::::::::::::::::::::..~~~~~~",
  "~~~~~~~..R::::::z:::::::::::::::::::::::::::P:::::::...~~~~~",
  "~~~~~~~~..::::::::::::::::::::::::::::::::::::::::::..~~~~~~",
  "~~~~~~~~..::::::::::::::::::::::::::::::::::::::::::T..~~~~~",
  "~~~~~~~..T::::::::::::::T............:::::::::::e:::..~~~~~~",
  "~~~~~~~~..::::::::::::::............R:::g:::t:::::::..~~~~~~",
  "~~~~~~~.......T...R.T....R..T.........:::::::::::::....~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~........T....:::::::::::.R.T~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~........:::::::::.....~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~..R.......#::.......R.~~~~~",
  "~~~~~~~....~.....~......~~~~~~~~~~~....T...#::.T..T...~~~~~~",
  "~~~~~~...T....T....T.......~~~~~~~~~########:########~~~~~~~",
  "~~~~~~T.......bR.......T.......~~~~~~......:::......~~~~~~~~",
  "~~~~~...R...T...........R..T....~~~~~~T.T..:::R..T..~~~~~~~~",
  "~~~~~~..........T....T.............~~......:::.......~~~~~~~",
  "~~~~~~~.T..................R.T..T.R....b.T.:::...R...~~~~~~~",
  "~~~~~~~~..R..T......R...T............T..T.R:::.Tb..T.~~~~~~~",
  "~~~~~~~~.......R.T..:::::::::::::b::::::::::::T.......~~~~~~",
  "~~~~~~~~...........::b:::::b::::::::::::::::::...T....~~~~~~",
  "~~~~~~~~...T......::::::::::::::::::::::::::::.T....T.~~~~~~",
  "~~~~~~~.....b.T..R:::..T..R.T..............:::.........~~~~~",
  "~~~~~~...T........:::T........T..T.R.T...T.:::T..T..T.~~~~~~",
  "~~~~~~.R..........:::...T....b.............:b:.....R.R~~~~~~",
  "~~~~~~.....b....T.:::......................:::R........~~~~~",
  "~~~~~...T...T.R...:::T.R...T..T.R.T...T..T.:::...T....~~~~~~",
  "~~~~~.............:::......................:::.....T.~~~~~~~",
  "~~~~~.............:::...T...............T..:::T.R....~~~~~~~",
  "~~~~....R..T.R.T..:::T......T..T..T..T.R..T:::......~~~~~~~~",
  "~~~~~.T...........::::::::::::::::::::::::::::...T..~~~~~~~~",
  "~~~~~~.............:::::::::::::::::::::::::::.T...~~~~~~~~~",
  "~~~~~~...T..........::::::::::::::::::::b:::::.....~~~~~~~~~",
  "~~~~~........T...........T.............T...:::T...T.~~~~~~~~",
  "~~~~~~.T.........T..T..........T.R.T.......:::......~~~~~~~~",
  "~~~~~~...R..b.~~..b.........T............T.:::R.Tb...~~~~~~~",
  "~~~~~~~~~~~~~~~~~...R..T.R...........T.R...::::::::T.~~~~~~~",
  "~~~~~~~~~~~~~~~~~...............T..........::::::::...~~~~~~",
  "~~~~~~~~~~~~~~~~..T...............~~~~~..T.::::::::..~~~~~~~",
  "~~~~~~~~~~~~~~~~~.......T...T...~~~~~~~~~..R.T.....T..~~~~~~",
  "~~~~~~~~~~~~~~~~~~.R.....b..~~~~~~~~~~~~~~.....bT.R..~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~..T.....~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
];

export const TOWN_SPEC: HandmadeSpec = {
  key: "town",
  name: "Bonetown",
  // No longer a blanket haven: the fence on row 25 splits the map. North of it
  // is town and nothing hostile may set foot there; south of it is the first
  // hunting ground a new character can reach.
  safe: false,
  safeMaxY: 25,
  grassShift: 4,
  rows: TOWN_ROWS,
  // Only the Home Isle gate is authored on the redrawn map; the Wildlands,
  // Deep Wildlands and Sanctum doors come back as those maps are redrawn.
  portals: {
    P: { dest: "home", label: "to Home Isle" },
    // a proper teleport pad, 2x2 like the ones downstairs — the glyph marks
    // its top-left tile, so it covers (16,8)…(17,9) on the northern tongue
    C: { dest: "cellar", label: "to the Time Sage's cellar", span: 2, floor: Tile.Dirt },
  },
  npcs: {
    s: "smith", h: "herbalist", e: "elder", g: "taskmaster", t: "tailor",
    // Chronos paces the western plaza: four tiles east, four west, one row —
    // never north or south, so he stays on the line the map put him on.
    z: { key: "timesage", beat: { west: 4, east: 4 }, floor: Tile.Dirt },
  },
  monsters: { b: "bandit" },
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

/* ------------------------------------------------------------------ */
/*  THE TIME SAGE'S CELLAR — under the northern dirt tongue in town.   */
/*  Painted in Tiled (public/cellar-terrain.png); this grid carries    */
/*  only collision, and the author's rule is simple: the hall's outer  */
/*  wall is the only solid thing inside it. The pools are ankle-deep   */
/*  and the black spurs are floor decoration, so the whole hall is     */
/*  walkable — which it has to be, since the way up sits on the islet  */
/*  between the four pools.                                            */
/*                                                                     */
/*  Around that hall runs a five-tile black margin, solid and unlit.   */
/*  It exists so the camera can centre on you in the corners instead   */
/*  of clamping to the map edge and shoving you off to one side; the   */
/*  terrain PNG carries the same margin as flat black.                 */
/*                                                                     */
/*  Fourteen pads carry an X in the artwork; each is a 2x2 block and   */
/*  the portal glyph sits on its top-left tile. All fourteen are       */
/*  dormant for now — the hunting grounds behind them come later.      */
/* ------------------------------------------------------------------ */
const CELLAR_ROWS: readonly string[] = [
  "##############################",
  "##############################",
  "##############################",
  "##############################",
  "##############################",
  "##############################",
  "######==================######",
  "######==================######",
  "######==================######",
  "######==1===2===3===4===######",
  "######==================######",
  "######==================######",
  "######==================######",
  "######==5===========6===######",
  "######=========Z========######",
  "######==================######",
  "######==================######",
  "######==================######",
  "######==7===========8===######",
  "######==================######",
  "######==================######",
  "######==================######",
  "######==9===========0===######",
  "######==================######",
  "######==================######",
  "######==================######",
  "######==a===========b===######",
  "######==================######",
  "######==================######",
  "######==================######",
  "######==================######",
  "######==================######",
  "######========U=========######",
  "######==================######",
  "######==================######",
  "######==================######",
  "######==================######",
  "######==================######",
  "######==================######",
  "######==c===========d===######",
  "######==================######",
  "######==================######",
  "######==================######",
  "######==================######",
  "##############################",
  "##############################",
  "##############################",
  "##############################",
  "##############################",
  "##############################",
];
/** A cellar pad that hums but takes nobody anywhere yet. The artwork paints
 *  each one 2x2, so the portal spans the block and all four squares carry you
 *  the day its hunting ground exists. The glyph marks the top-left square. */
const sealed = (label: string) =>
  ({ dest: "cellar", label, inactive: true, floor: Tile.Cave, span: 2 } as const);

export const CELLAR_SPEC: HandmadeSpec = {
  key: "cellar",
  name: "Time Sage's Cellar",
  safe: true,
  rows: CELLAR_ROWS,
  portals: {
    U: { dest: "town", label: "back up to Bonetown", span: 2, floor: Tile.Cave },
    // the four that will open first, once their hunting grounds exist
    a: sealed("Minotaur Halls — sealed"),
    b: sealed("Undead Crypt — sealed"),
    c: sealed("Orc Warrens — sealed"),
    d: sealed("Troll Caves — sealed"),
    // and ten more the sage has not named yet
    "1": sealed("Sealed Rift I"),
    "2": sealed("Sealed Rift II"),
    "3": sealed("Sealed Rift III"),
    "4": sealed("Sealed Rift IV"),
    "5": sealed("Sealed Rift V"),
    "6": sealed("Sealed Rift VI"),
    "7": sealed("Sealed Rift VII"),
    "8": sealed("Sealed Rift VIII"),
    "9": sealed("Sealed Rift IX"),
    "0": sealed("Sealed Rift X"),
  },
  // He shuffles a 2x2 square that hangs off his corner — one tile west and
  // one south of where the pin put him — rather than standing dead still.
  npcs: { Z: { key: "timesage", beat: { west: 1, south: 1 }, floor: Tile.Cave } },
};
