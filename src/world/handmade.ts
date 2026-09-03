/**
 * Hand-authored hub islands (Home Isle & Bonetown).
 *
 * Since Etap 40 this is the ONLY way a map is made. They are laid
 * out by hand as character grids — one glyph per tile — so shops, build plots
 * and portals sit exactly where they were designed to. The parser turns a grid
 * into the very same `World` shape `makeWorld` produces, so every downstream
 * system (collision, spawns, resource nodes, NPCs, build spots, save/load, the
 * baker) works unchanged. Because nothing here touches the world RNG, the
 * every map is byte-identical on every device, by construction.
 *
 * Glyph legend (shared):
 *   ~ water    . grass    , sand    # ruined wall
 *   T tree     R rock     H/M mushroom (decor)   o bones (decor)
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
import { nextEntityId } from "./entities.ts";
import { FOOTPRINT, BLOCK, paintedTiles } from "../gfx/sceneryArt.ts";
import type { MonsterKind, SceneryKind } from "./types.ts";
import type { Element } from "../systems/elements.ts";
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
  /**
   * Squares that stay a haven even though the map itself is hostile, written
   * as inclusive `[x0, y0, x1, y1]` boxes and burned into a per-tile mask when
   * the world is parsed.
   *
   * Rectangles rather than a glyph because the haven is a property of the
   * GROUND, not of what stands on it: every square of two of Bonetown's six
   * islands is town, whether it carries a house, a road or nothing at all, and
   * a glyph would have to be repeated on all sixteen hundred of them and kept
   * in step with every edit. Overlap is harmless and water inside a box is
   * harmless too, since nothing can stand there to ask.
   */
  safeRects?: readonly (readonly [number, number, number, number])[];
  /** Glyph → creature posted on that tile (plain grass or road underneath). */
  monsters?: Readonly<Record<string, MonsterKind>>;
  /**
   * Optional second grid, the same shape as `rows`, giving the terrain under
   * every square. Small hand-drawn islands do not need it — a feature glyph
   * defaults to grass beneath and that is nearly always right. A map traced
   * from Tiled does: half the Bone Reach is packed earth, and without this
   * every totem, fire and creature on it would report grass to the minimap
   * and to the fallback baker. Only the shared terrain glyphs are read here.
   */
  floor?: readonly string[];
  /**
   * Glyphs that are impassable and nothing else. The Tiled export already
   * draws the boulder, tent or barrel; collision is the only thing that still
   * needs telling about it, and painting a wall glyph instead would show as a
   * ruin on the minimap and in the baked fallback.
   */
  solids?: string;
  /** Glyph → an attunement circle granting that element. The sanctum under
   *  Calanais is the only map that uses it. */
  attune?: Readonly<Record<string, Element>>;
  /** Glyph → a decorative one-square element effect on that tile. */
  ambient?: Readonly<Record<string, Element>>;
  /** Glyph → standing scenery on that tile. The tile is made solid, exactly
   *  like a tree's: these objects are taller than one square and the player
   *  walks BEHIND them, never through them. Glyphs are per-spec so a letter
   *  free on one island can still mean a portal on another. */
  scenery?: Readonly<Record<string, SceneryKind>>;
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

/**
 * Burn a spec's haven rectangles into one bit per tile.
 *
 * Undefined when the spec names none, and that absence is meaningful: it is
 * what `inHaven` reads to answer "this map has no sanctuary" without a bounds
 * check on an array that was never built. Boxes are clamped rather than
 * refused, so a rectangle drawn a tile past the shore is a rounding error and
 * not a crash.
 */
function havenMask(spec: HandmadeSpec, W: number, H: number): Uint8Array | undefined {
  if (!spec.safeRects?.length) return undefined;
  const mask = new Uint8Array(W * H);
  for (const [x0, y0, x1, y1] of spec.safeRects) {
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) mask[y * W + x] = 1;
    }
  }
  return mask;
}

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
  if (spec.floor && (spec.floor.length !== H || spec.floor.some((r) => r.length !== W))) {
    throw new Error(`handmade ${spec.key}: floor grid does not match the ${W}x${H} rows`);
  }

  const tile: Tile[][] = [];
  const solid: boolean[][] = [];
  for (let y = 0; y < H; y++) {
    tile[y] = [];
    solid[y] = [];
    for (let x = 0; x < W; x++) {
      const t = baseTileOf((spec.floor?.[y] ?? rows[y])[x]);
      tile[y][x] = t;
      solid[y][x] = t === Tile.Water || t === Tile.Wall
        || spec.solids?.includes(rows[y][x]) === true;
    }
  }

  const w: World = {
    key: spec.key,
    name: spec.name,
    safe: spec.safe,
    safeMask: havenMask(spec, W, H),
    w: W,
    h: H,
    tile,
    solid,
    reserved: [],
    trees: [],
    rocks: [],
    decos: [],
    fires: [],
    attuneNodes: [],
    ambientFx: [],
    scenery: [],
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
    coastWater: [],
    // Authored maps have no radial silhouette; the baker no longer needs one.
    landR: () => Math.max(W, H),
    mapCanvas: document.createElement("canvas"),
  };

  /**
   * NOTHING DECORATIVE WITHIN A SQUARE OF THE SEA.
   *
   * Props are drawn larger than the squares they stand on, so a tree or a
   * boulder one tile in from a shoreline paints part of itself on the water.
   * Radek photographed it twice: boulders lying on open sea off Calanais, and
   * a whole column of trees hugging the west shore with their crowns out over
   * the waves. Nothing was ever placed IN the water — every glyph involved is
   * on grass — which is exactly why it lasted: the tile was legal and the
   * picture was not.
   *
   * The margin, rather than a test for literal overlap, is the part that had
   * to be decided. Overlap alone does not catch the Calanais boulders: their
   * art is 60px wide inside a 64px footprint and never reaches the water glyph
   * next door. They still look wrong, because the coastline you SEE is painted
   * in the terrain PNG exported from Tiled and the coastline the game reasons
   * about is this glyph grid, and along a hand-drawn shore the two do not
   * agree to the pixel. One clear square absorbs that disagreement without
   * redrawing every map.
   *
   * Refusing here rather than in the specs means a map author cannot make the
   * mistake by hand — but it also means the spec and the world legitimately
   * disagree now, so `refused` is counted and the smoke suite pins it. A
   * silently shrinking map is the thing that would be worse than the artefact.
   */
  const SHORE_MARGIN = 1;
  const wetGlyph = (tx: number, ty: number): boolean =>
    tx < 0 || ty < 0 || tx >= W || ty >= H || baseTileOf(rows[ty][tx]) === Tile.Water;
  const nearWater = (tiles: readonly { tx: number; ty: number }[]): boolean =>
    tiles.some(({ tx, ty }) => {
      for (let dy = -SHORE_MARGIN; dy <= SHORE_MARGIN; dy++)
        for (let dx = -SHORE_MARGIN; dx <= SHORE_MARGIN; dx++)
          if (wetGlyph(tx + dx, ty + dy)) return true;
      return false;
    });

  // Second pass: features. Reading order (top→bottom, left→right) fixes a
  // stable, deterministic order for build spots — important for save migration.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x];
      const cx = x * TILE + TILE / 2;
      const cy = y * TILE + TILE / 2;
      switch (ch) {
        case "T":
          // 32x56, anchored on the bottom of its square: one tile wide, and the
          // crown reaches into the square north of it.
          if (nearWater([{ tx: x, ty: y }, { tx: x, ty: y - 1 }])) break;
          w.trees.push({ tx: x, ty: y, spr: bakeTree(), hp: 3, maxhp: 3, stump: false, respawnT: 0, hurtT: 0 });
          solid[y][x] = true;
          break;
        case "R":
          /* The margin does NOT apply to a gatherable rock, and that is a
           * decision rather than an oversight. `SPR.rock` is 20x12 drawn
           * centred in a 32px square: it cannot touch a neighbouring tile at
           * all, so it never produced the artefact this rule exists to stop,
           * and it may sit on the very last square of a beach as it always
           * has. Giving it the margin cost Home Isle eight of its ten stone
           * nodes, and "gather 20 stone" is the fourth quest in the game.
           *
           * The rule is about what an object PAINTS, so an object that paints
           * inside its own square answers about its own square. */
          w.rocks.push({ tx: x, ty: y, hp: 4, maxhp: 4, depleted: false, respawnT: 0, hurtT: 0 });
          solid[y][x] = true;
          break;
        case "H":
          // Herbs are gone (Etap 26); the character survives as plain decor so
          // hand-authored maps keep their scatter without an edit pass.
          w.decos.push({ spr: SPR.mushroom, tx: x, ty: y });
          break;
        case "M":
          w.decos.push({ spr: SPR.mushroom, tx: x, ty: y });
          break;
        case "F":
          // A campfire does NOT seal its square, on any map.
          //
          // It used to, on hand-authored ones. The trouble is that the fire is
          // the only solid prop in the game whose artwork is exactly one tile
          // and no more: a tree, a tent, a house all stand taller than the
          // square they block, so the thing you see and the thing that stops
          // you are obviously one object. The fire's logs sit flush on the
          // bottom edge of its cell and the flame licks up from there, and
          // across the twelve frames of the strip that leaves eight to twelve
          // pixels of a solid square as plain bare ground. Walk south onto one
          // and you are refused by a third of a tile that visibly is not there.
          //
          // The body is twenty-one rows of a thirty-two row cell, so no amount
          // of nudging the sprite can make it cover what it seals — lift it far
          // enough to close the gap above and an identical gap opens below.
          // Since the artwork cannot be made to tell the truth about the
          // collision, the collision goes: a fire is something you can step
          // through, which is what the wilderness camps have always done with
          // theirs so that a fire could never wall a monster into a corner.
          // FIRE_LIFT still centres the flame on its own square, because a
          // campfire hanging off the bottom edge of a tile looked wrong quite
          // apart from the collision.
          w.fires.push({ tx: x, ty: y, phase: (x * 7 + y * 13) % 10 / 10 });
          break;
        case "o":
          w.decos.push({ spr: SPR.bones, tx: x, ty: y });
          break;
        case "B":
          w.buildSpots.push({ tx: x, ty: y, built: null });
          break;
        case "$":
          // A one-time hoard, the same furniture the cave floors bury at their
          // bottom. Solid: you open it from the next tile, you do not stand in
          // it. What is inside is game.ts's call, keyed by world.
          w.structures.push({ id: nextEntityId(), key: "treasure", tx: x, ty: y, anim: 0 });
          solid[y][x] = true;
          break;
        default: {
          const amb = spec.ambient?.[ch];
          if (amb) {
            w.ambientFx.push({ el: amb, tx: x, ty: y, phase: ((x * 7 + y * 13) % 20) / 20 });
            break;
          }
          const att = spec.attune?.[ch];
          if (att) {
            // The glyph names the CENTRE the art is anchored on; the 64x64
            // frame covers the 2x2 block whose top-left is one tile up and
            // left. Nothing is sealed — walking in is the whole mechanic.
            w.attuneNodes.push({ el: att, tx: x, ty: y, phase: ((x * 5 + y * 11) % 10) / 10 });
            break;
          }
          if (spec.solids?.includes(ch)) break; // painted obstacle; collision only
          const scn = spec.scenery?.[ch];
          if (scn) {
            if (nearWater(paintedTiles(scn, x, y))) break;
            w.scenery.push({ tx: x, ty: y, kind: scn });
            // The glyph is the footprint's top-left square. Seal the near row of
            // the block and nothing else: the far row is overhang the player is
            // meant to walk behind, exactly as he walks under a tree's crown.
            const fp = FOOTPRINT[scn];
            const bk = BLOCK[scn];
            const y0 = y + fp.h - bk.h;
            for (let j = y0; j < Math.min(H, y0 + bk.h); j++) {
              for (let i = x; i < Math.min(W, x + bk.w); i++) solid[j][i] = true;
            }
            break;
          }
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
                id: nextEntityId(),
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
  "~~~~~~~~~~~..........~~~~~..~~~~~~~",
  "~~~~~~~~~...T.R.......~~~~....~~~~~",
  "~~~~~~~~~.............~~~~.P..~~~~~",
  "~~~~~~~~~.R.........S.~~~~.....~~~~",
  "~~~~~~~~..T...........~~~~~....~~~~",
  "~~~~~~~~~.............~~~~~.....~~~",
  "~~~~~~~~~~..~~~~~~~..~~~~~~T..R.~~~",
  "~~~~~~~~~~~~~~~~~~~::~~~~~~.....~~~",
  "~~~~~~~~~~~~~~~~~~~::~~~~~......~~~",
  "~~~~~~~~~~~~~~~~~~~::~~~~.......~~~",
  "~~~~~~~~~~~...~~.....~~~..R...T.~~~",
  "~~~~~...........................~~~",
  "~~~~......R....................~~~~",
  "~~~~~.T........................~~~~",
  "~~~~~....T....................~~~~~",
  "~~~~~..........................~~~~",
  "~~~~~.........................~~~~~",
  "~~~~...T....................T..~~~~",
  "~~~~~.....................R....~~~~",
  "~~~~~~.R...T.................~~~~~~",
  "~~~~~~....................~~~~~~~~~",
  "~~~~~....R................~~~~~~~~~",
  "~~~~~~.................T.~~~~~~~~~~",
  "~~~~~~.T...R.........R...~~~~~~~~~~",
  "~~~~~..........T.........~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
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
/*  BONETOWN lives in its own file now. Six islands and 106 squares    */
/*  across is more grid than the rest of this module put together, and  */
/*  no longer something to scroll past on the way to the cellar.        */
/* ------------------------------------------------------------------ */
export { TOWN_SPEC } from "./townSpec.ts";

/* ------------------------------------------------------------------ */
/*  THE TIME SAGE'S CELLAR — under the northern dirt tongue in town.   */
/*  Painted in Tiled (public/cellar-terrain.png); this grid carries    */
/*  only collision, and the author's rule is simple: the floor of the hall  */
/*  walks and its rocky rim does not. The pools are ankle-deep and the      */
/*  black spurs are floor decoration, so everything inside the rim is       */
/*  walkable — which it has to be, since the way up sits on the islet       */
/*  between the four pools.                                                */
/*                                                                     */
/*  The walkable box is x 7..22, y 8..42. That is not the rim the old      */
/*  Tiled grid drew: the mushroom rock reads three tiles deep along the    */
/*  top and one to two elsewhere, and standing on any of it looked like    */
/*  walking up the wall. The box is pulled in to the last tile that is     */
/*  clean floor in the artwork.                                            */
/*                                                                     */
/*  Around the hall runs a five-tile black margin, solid and unlit. It     */
/*  exists so the camera can centre on you in the corners instead of       */
/*  clamping to the map edge and shoving you off to one side; the terrain  */
/*  PNG carries the same margin as flat black.                             */
/*                                                                     */
/*  Fourteen pads carry an X in the artwork; each is a 2x2 block and   */
/*  the portal glyph sits on its top-left tile. Two are live — the     */
/*  Gallows Coast and the Bone Reach, the grounds a new character      */
/*  levels on. The other twelve are dormant, and the Time Sage opens   */
/*  them one at a time as his missions are written.                    */
/*                                                                     */
/*  Fourteen is not a number anything depends on. When it runs out the */
/*  answer is a SECOND cellar, not a wider one, so nothing outside this*/
/*  file counts the pads — the smoke suite checks that each is 2x2,    */
/*  walkable, unshared and reachable, and never how many there are.    */
/* ------------------------------------------------------------------ */
const CELLAR_ROWS: readonly string[] = [
  "##############################",
  "##############################",
  "##############################",
  "##############################",
  "##############################",
  "##############################",
  "##############################",
  "##############################",
  "#######================#######",
  "#######=1===2===3===4==#######",
  "#######================#######",
  "#######================#######",
  "#######================#######",
  "#######=5===========6==#######",
  "#######========Z=======#######",
  "#######================#######",
  "#######================#######",
  "#######================#######",
  "#######=7===========8==#######",
  "#######================#######",
  "#######================#######",
  "#######================#######",
  "#######=9===========0==#######",
  "#######================#######",
  "#######================#######",
  "#######================#######",
  "#######=a===========b==#######",
  "#######================#######",
  "#######================#######",
  "#######================#######",
  "#######================#######",
  "#######================#######",
  "#######=======U========#######",
  "#######================#######",
  "#######================#######",
  "#######================#######",
  "#######================#######",
  "#######================#######",
  "#######================#######",
  "#######=c===========d==#######",
  "#######================#######",
  "#######================#######",
  "#######================#######",
  "##############################",
  "##############################",
  "##############################",
  "##############################",
  "##############################",
  "##############################",
  "##############################",
];/** A cellar pad that hums but takes nobody anywhere yet. The artwork paints
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
    // Named for grounds that do not exist yet. The names are placeholders and
    // will be replaced by the missions that open these doors.
    a: sealed("Minotaur Halls — sealed"),
    b: sealed("Undead Crypt — sealed"),
    // The two live pads. Neither island has a way back to the cellar, so you
    // arrive beside its own gate to Bonetown and return that way — see the
    // note in `travelTo`. These are the grounds a character levels on before
    // the sage will speak to them about anything.
    c: { dest: "bandit", label: "to the Gallows Coast", span: 2, floor: Tile.Cave },
    d: { dest: "reach", label: "to the Bone Reach", span: 2, floor: Tile.Cave },
    // The first rift the sage has actually opened. It is a MISSION door rather
    // than a hunting ground — the island behind it exists to be walked once,
    // for the cap at the bottom of it — which is why it is named after the
    // place and not after what lives there.
    // A MISSION door. It ships dormant and `applyMissionPads` lights it the
    // moment Chronos hands the errand over — the pad is not a place you find,
    // it is a place he opens.
    "1": {
      dest: "liddesdale", label: "to Liddesdale — the Bloody Valley",
      span: 2, floor: Tile.Cave, inactive: true,
    },
    // The second, and the same rule: named, dormant, lit by `applyMissionPads`
    // when Chronos hands the errand over rather than when the player is old
    // enough for it. Two named pads now, which is why nothing in the smoke
    // suite counts them — it checks that each named pad has a mission behind
    // it, and lets the number be whatever the catalogue says today.
    "2": {
      dest: "haramsey", label: "to Haramsey — the barrow coast",
      span: 2, floor: Tile.Cave, inactive: true,
    },
    // The third named rift. TEMP-ETAP47-OPENRIFT: it ships LIVE rather than
    // dormant, which is not where it ends up. Every other mission door is
    // `inactive` and lit by `applyMissionPads` when Chronos hands the errand
    // over — but the level-8 errand does not exist in the catalogue yet, so a
    // dormant pad here would be a pad nothing can ever light and an island
    // nobody can walk. It flips to `inactive: true` the day the mission lands,
    // and the smoke suite fails until it does.
    // The third named rift, and the first one the sage opens: Calanais is the
    // level-8 link and comes before Liddesdale in the chain. Dormant like the
    // other two — `applyMissionPads` lights it when the errand is in hand.
    "3": {
      dest: "calanais", label: "to Calanais — the Temple Isle",
      span: 2, floor: Tile.Cave, inactive: true,
    },
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
