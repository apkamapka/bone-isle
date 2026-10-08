/**
 * What a map looks like on screen (Etap 3.1b moved this here from the world
 * code, which no longer holds a single picture).
 *
 * Every map has a picture exported from Tiled, named by its key in
 * world/terrainImage.ts. This loads them, and hands one out only when it is
 * the size the map's grid says it must be: a mismatched export would slide
 * the whole map against what can be walked on, so it is refused loudly and the
 * fallback is drawn instead.
 *
 * The fallback is painted from the glyph grid — water by depth, grass, sand,
 * walls, the scattered decorations — and used for the frame or two before a
 * PNG arrives, or forever if one is missing. It used to be painted for every
 * map while the world was being built, on the server's side of the line. Now
 * it is painted the first time a map is drawn without its picture, and kept.
 *
 * Headless (no `Image`, no `document`) nothing loads, and the smoke suite
 * paints fallbacks against the stub canvas.
 */
import { TILE, MAP_TILE, SPRITE_SCALE } from "../config.ts";
import { SPR, spriteSource } from "./sprites.ts";
import { rnd, rndi } from "../util.ts";
import { TERRAIN_SRC } from "../world/terrainImage.ts";
import { Tile } from "../world/types.ts";
import type { World, WorldKey } from "../world/types.ts";

/** Animated coastal water tile (foam/wave dashes), in world pixels. */
export interface CoastWater {
  x: number;
  y: number;
  ph: number;
}

/** A map's fallback picture and the coast squares that animate over it. */
export interface BakedTerrain {
  canvas: HTMLCanvasElement;
  coast: CoastWater[];
}

/* ---- the exported pictures ------------------------------------------- */

const images: Partial<Record<WorldKey, HTMLImageElement>> = {};
const refused = new Set<WorldKey>();
let started = false;

/**
 * Kick off loading every map's picture. Once is enough; safe to call again,
 * and a no-op headless.
 */
export function loadTerrainArt(): void {
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  if (started) return;
  started = true;
  for (const key of Object.keys(TERRAIN_SRC) as WorldKey[]) {
    const src = TERRAIN_SRC[key];
    if (!src) continue;
    const img = new Image();
    img.onload = () => { images[key] = img; };
    img.onerror = () => {
      console.warn(`terrain '${key}' failed to load, keeping the baked terrain`);
    };
    img.src = src;
  }
}

/**
 * The picture to draw `w` with, or null while there is none — not loaded yet,
 * missing, or exported at the wrong size, in which case the bake shows.
 */
export function terrainImage(w: World): HTMLImageElement | null {
  const img = images[w.key];
  if (!img) return null;
  if (img.naturalWidth !== w.w * TILE || img.naturalHeight !== w.h * TILE) {
    if (!refused.has(w.key)) {
      refused.add(w.key);
      console.warn(
        `terrain '${w.key}': image is ${img.naturalWidth}x${img.naturalHeight}, ` +
        `expected ${w.w * TILE}x${w.h * TILE} — keeping the baked terrain`,
      );
    }
    return null;
  }
  return img;
}

/* ---- the fallback ----------------------------------------------------- */

const baked = new WeakMap<World, BakedTerrain>();

/** The fallback picture of `w`, painted the first time it is asked for. */
export function bakedTerrain(w: World): BakedTerrain {
  let b = baked.get(w);
  if (!b) {
    b = bakeWorldCanvas(w, w.grassShift ?? 0);
    baked.set(w, b);
  }
  return b;
}

/**
 * Distance (in tiles) from every water cell to the nearest land, via a
 * multi-source BFS seeded from all land tiles. Drives the deep-water colour
 * gradient — works for any coastline shape, so hand-authored maps (which have
 * no radial `landR`) get the same look as procedural islands.
 */
function landDistance(w: World): number[][] {
  const W = w.w;
  const H = w.h;
  const depth: number[][] = Array.from({ length: H }, () => new Array<number>(W).fill(-1));
  const qx: number[] = [];
  const qy: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (w.tile[y][x] !== Tile.Water) { depth[y][x] = 0; qx.push(x); qy.push(y); }
    }
  }
  for (let head = 0; head < qx.length; head++) {
    const x = qx[head];
    const y = qy[head];
    const d = depth[y][x];
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (depth[ny][nx] !== -1) continue;
      depth[ny][nx] = d + 1;
      qx.push(nx);
      qy.push(ny);
    }
  }
  return depth;
}

/**
 * Paint the static terrain + decorations of one world into a fresh canvas, and
 * note the coastal water squares the foam animation runs along.
 *
 * Deliberately painted at MAP_TILE (16 px per tile), NOT at TILE. Every
 * literal below — the speckle offsets, the plank widths, the wall courses —
 * was hand-tuned against a 16-px square, and the renderer blits this canvas
 * SPRITE_SCALE times bigger, so the terrain comes out pixel-identical to the
 * 16-px era without a single number here changing. It also keeps the
 * continent's bitmap at a quarter of the memory a TILE-resolution bake needs.
 */
function bakeWorldCanvas(w: World, grassShift = 0): BakedTerrain {
  const W = w.w;
  const H = w.h;
  const TILE = MAP_TILE; // everything below paints in legacy map pixels
  const mc = document.createElement("canvas");
  const coast: CoastWater[] = [];
  mc.width = W * TILE;
  mc.height = H * TILE;
  const m = mc.getContext("2d")!;
  m.imageSmoothingEnabled = false;
  const gj = grassShift;
  const depth = landDistance(w);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t0 = w.tile[y][x];
      const px = x * TILE;
      const py = y * TILE;
      if (t0 === Tile.Water) {
        const deep = clamp01((depth[y][x] - 1) / 5);
        const c1 = [46, 143, 138];
        const c2 = [28, 96, 96];
        const c = c1.map((v, i) => Math.round(v + (c2[i] - v) * deep));
        m.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        m.fillRect(px, py, TILE, TILE);
        m.fillStyle = "rgba(120,190,180,.45)";
        for (let i = 0; i < 2; i++)
          if (Math.random() < 0.5) m.fillRect(px + rndi(1, 10), py + rndi(2, 13), rndi(3, 5), 1);
        let coastal = false;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
          if ((w.tile[y + oy]?.[x + ox] ?? 0) > 0) coastal = true;
        // the renderer reads these in WORLD pixels, not map pixels
        if (coastal) coast.push({ x: x * SPRITE_SCALE * TILE, y: y * SPRITE_SCALE * TILE, ph: rnd(0, 6.28) });
      } else if (t0 === Tile.Grass) {
        const j = rndi(-7, 7);
        m.fillStyle = `rgb(${111 + j + gj},${154 + j},${68 + j})`;
        m.fillRect(px, py, TILE, TILE);
        m.fillStyle = "rgba(56,92,38,.8)";
        for (let i = 0, n = rndi(3, 6); i < n; i++) m.fillRect(px + rndi(1, 13), py + rndi(1, 13), 2, 1);
        if (Math.random() < 0.25) {
          m.fillStyle = "rgba(170,200,110,.5)";
          m.fillRect(px + rndi(2, 10), py + rndi(2, 10), rndi(2, 4), rndi(2, 3));
        }
      } else if (t0 === Tile.Sand) {
        const j = rndi(-6, 6);
        m.fillStyle = `rgb(${217 + j},${196 + j},${122 + j})`;
        m.fillRect(px, py, TILE, TILE);
        m.fillStyle = "rgba(150,125,70,.8)";
        for (let i = 0, n = rndi(3, 6); i < n; i++) m.fillRect(px + rndi(1, 14), py + rndi(1, 14), 1, 1);
      } else if (t0 === Tile.Cave) {
        const j = rndi(-6, 6);
        m.fillStyle = `rgb(${92 + j},${88 + j},${84 + j})`;
        m.fillRect(px, py, TILE, TILE);
        m.fillStyle = "rgba(58,54,50,.85)";
        for (let i = 0, n = rndi(3, 6); i < n; i++) m.fillRect(px + rndi(1, 14), py + rndi(1, 14), 1, 1);
        if (Math.random() < 0.22) {
          m.fillStyle = "rgba(140,134,126,.4)";
          m.fillRect(px + rndi(2, 11), py + rndi(2, 11), rndi(2, 3), 1);
        }
      } else if (t0 === Tile.Dirt) {
        // packed camp earth / trodden trail — warm brown with darker speckle
        const j = rndi(-6, 6);
        m.fillStyle = `rgb(${146 + j},${112 + j},${72 + j})`;
        m.fillRect(px, py, TILE, TILE);
        m.fillStyle = "rgba(84,60,36,.8)";
        for (let i = 0, n = rndi(3, 6); i < n; i++) m.fillRect(px + rndi(1, 13), py + rndi(1, 13), 2, 1);
        if (Math.random() < 0.2) {
          m.fillStyle = "rgba(190,160,110,.45)";
          m.fillRect(px + rndi(2, 10), py + rndi(2, 10), rndi(2, 4), 1);
        }
      } else if (t0 === Tile.Palisade) {
        // sharpened wooden posts — three planks per tile, dark seams, spiked top
        m.fillStyle = "#5b3b22"; m.fillRect(px, py, TILE, TILE);
        m.fillStyle = "#8a5c34";
        m.fillRect(px + 1, py + 2, 4, 13); m.fillRect(px + 6, py + 1, 4, 14); m.fillRect(px + 11, py + 2, 4, 13);
        m.fillStyle = "#a8743f";
        m.fillRect(px + 2, py + 3, 1, 11); m.fillRect(px + 7, py + 2, 1, 12); m.fillRect(px + 12, py + 3, 1, 11);
        m.fillStyle = "#2b2017";
        m.fillRect(px, py, TILE, 2); m.fillRect(px + 5, py + 1, 1, 15); m.fillRect(px + 10, py + 1, 1, 15);
        m.fillRect(px + 3, py, 2, 2); m.fillRect(px + 8, py, 2, 2); m.fillRect(px + 13, py, 2, 2);
      } else if (t0 === Tile.Wall) {
        m.fillStyle = "#7d8487"; m.fillRect(px, py, TILE, TILE);
        m.fillStyle = "#999fa2";
        m.fillRect(px + 1, py + 1, 6, 5); m.fillRect(px + 9, py + 1, 6, 5);
        m.fillRect(px + 1, py + 9, 4, 5); m.fillRect(px + 7, py + 9, 8, 5);
        m.fillStyle = "#4f5557";
        m.fillRect(px, py + 7, TILE, 1); m.fillRect(px, py + 15, TILE, 1);
        m.fillRect(px + 8, py, 1, 7); m.fillRect(px + 6, py + 8, 1, 8);
        m.fillStyle = "#2f3436"; m.fillRect(px, py, TILE, 1);
        if (Math.random() < 0.5) { m.fillStyle = "#6a7a55"; m.fillRect(px + rndi(2, 12), py + rndi(2, 12), 2, 1); }
      }
    }
  }

  // dark outline where sand meets water
  m.fillStyle = "#1d4b48";
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (w.tile[y][x] !== Tile.Sand) continue;
      const px = x * TILE;
      const py = y * TILE;
      if ((w.tile[y][x - 1] ?? 0) === Tile.Water) m.fillRect(px, py, 1, TILE);
      if ((w.tile[y][x + 1] ?? 0) === Tile.Water) m.fillRect(px + TILE - 1, py, 1, TILE);
      if ((w.tile[y - 1]?.[x] ?? 0) === Tile.Water) m.fillRect(px, py, TILE, 1);
      if ((w.tile[y + 1]?.[x] ?? 0) === Tile.Water) m.fillRect(px, py + TILE - 1, TILE, 1);
    }
  }
  // dotted grass/sand boundary
  m.fillStyle = "rgba(90,110,50,.7)";
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (w.tile[y][x] !== Tile.Grass) continue;
      const px = x * TILE;
      const py = y * TILE;
      const edges: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
        [-1, 0, 0, 0, 1, TILE], [1, 0, TILE - 1, 0, 1, TILE], [0, -1, 0, 0, TILE, 1], [0, 1, 0, TILE - 1, TILE, 1],
      ];
      for (const [ox, oy, ex, ey, ww, hh] of edges) {
        const nb = w.tile[y + oy]?.[x + ox];
        if (nb === Tile.Sand || nb === Tile.Dirt)
          for (let i = 0; i < TILE; i += 3) m.fillRect(px + ex + (ww === 1 ? 0 : i), py + ey + (hh === 1 ? 0 : i), 1, 1);
      }
    }
  }
  // baked decor — the 1x source, since this canvas is at legacy resolution
  for (const d of w.decos) {
    const spr = spriteSource(SPR[d.art]);
    m.drawImage(spr, d.tx * TILE + ((TILE - spr.width) >> 1), d.ty * TILE + TILE - spr.height - 2);
    m.fillStyle = "rgba(0,0,0,.18)";
    m.fillRect(d.tx * TILE + 3, d.ty * TILE + TILE - 3, TILE - 6, 2);
  }
  // portal stone ring bases (portal coords are world px → map px)
  for (const pt of w.portals) {
    const cx = pt.x / SPRITE_SCALE;
    const cy = pt.y / SPRITE_SCALE;
    m.fillStyle = "#6a7174";
    for (let a = 0; a < 12; a++) {
      const th = (a / 12) * 6.283;
      m.fillRect(Math.round(cx + Math.cos(th) * 12 - 1.5), Math.round(cy + Math.sin(th) * 7 - 1), 3, 2);
    }
    m.fillStyle = "#3a4144";
    for (let a = 0; a < 12; a += 2) {
      const th = (a / 12) * 6.283 + 0.26;
      m.fillRect(Math.round(cx + Math.cos(th) * 12 - 1), Math.round(cy + Math.sin(th) * 7), 2, 1);
    }
  }
  return { canvas: mc, coast };
}

/** World pixels → static-map-canvas pixels. The terrain bake lives at legacy
 *  resolution, so anything painted over it afterwards converts through here. */
export function toMapPx(v: number): number {
  return v / SPRITE_SCALE;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
