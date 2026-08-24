/**
 * What is left of the world generator: the townsfolk roster and the terrain
 * baker.
 *
 * Etap 40 removed `makeWorld` and with it the last procedural map. Every world
 * is authored by hand in `handmade.ts` and painted in Tiled; the baked canvas
 * this module still produces is only the fallback that shows for the frame or
 * two before the PNG arrives.
 */
import { MAP_TILE, SPRITE_SCALE } from "../config.ts";
import { SPR, spriteSource } from "../gfx/sprites.ts";
import { rnd, rndi } from "../util.ts";
import type { NpcKey, World } from "./types.ts";
import { Tile } from "./types.ts";

export const NPC_DATA: ReadonlyArray<readonly [NpcKey, string, HTMLCanvasElement, number]> = [
  ["smith", "Borin the Smith", SPR.npcSmith, 1],
  ["herbalist", "Mira the Herbalist", SPR.npcHerbalist, 1],
  ["elder", "Elder Oswin", SPR.npcElder, 1],
  ["taskmaster", "Grizelda the Huntress", SPR.npcTaskmaster, 1],
  ["tailor", "Vesper the Tailor", SPR.npcTailor, 1],
  // Rooted by default — the cellar copy never moves. The town copy overrides
  // the beat in its own spec (four tiles east and west, one row).
  ["timesage", "Chronos the Time Sage", SPR.npcTimesage, 0],
];

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
 * Render the static terrain + decorations into world.mapCanvas once.
 *
 * Deliberately painted at MAP_TILE (16 px per tile), NOT at TILE. Every
 * literal below — the speckle offsets, the plank widths, the wall courses —
 * was hand-tuned against a 16-px square, and the renderer blits this canvas
 * SPRITE_SCALE times bigger, so the terrain comes out pixel-identical to the
 * 16-px era without a single number here changing. It also keeps the
 * continent's bitmap at a quarter of the memory a TILE-resolution bake needs.
 */
export function bakeWorldCanvas(w: World, grassShift = 0): void {
  const W = w.w;
  const H = w.h;
  const TILE = MAP_TILE; // everything below paints in legacy map pixels
  const mc = w.mapCanvas;
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
        if (coastal) w.coastWater.push({ x: x * SPRITE_SCALE * TILE, y: y * SPRITE_SCALE * TILE, ph: rnd(0, 6.28) });
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
    const spr = spriteSource(d.spr);
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
}

/** World pixels → static-map-canvas pixels. The terrain bake lives at legacy
 *  resolution, so anything painted over it afterwards converts through here. */
export function toMapPx(v: number): number {
  return v / SPRITE_SCALE;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
