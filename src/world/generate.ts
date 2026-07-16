/**
 * Procedural island generation and static map-canvas baking.
 * Deterministic per seed (uses the world RNG from util.ts) so saved games
 * regenerate the exact same islands. Visual pixel jitter stays random.
 */
import { TILE } from "../config.ts";
import { wrnd, wrndi, rnd, rndi, dist } from "../util.ts";
import { SPR, bakeTree } from "../gfx/sprites.ts";
import { Tile } from "./types.ts";
import type { World, WorldOpts, Vec, NpcKey } from "./types.ts";

export const NPC_DATA: ReadonlyArray<readonly [NpcKey, string, HTMLCanvasElement]> = [
  ["smith", "Borin the Smith", SPR.npcSmith],
  ["herbalist", "Mira the Herbalist", SPR.npcHerbalist],
  ["elder", "Elder Oswin", SPR.npcElder],
  ["taskmaster", "Grizelda the Huntress", SPR.npcTaskmaster],
  ["tailor", "Vesper the Tailor", SPR.npcTailor],
];

export function makeWorld(opts: WorldOpts): World {
  const W = opts.w;
  const H = opts.h;
  const CX = W / 2;
  const CY = H / 2;
  const a1 = wrnd(0, 6.28);
  const a2 = wrnd(0, 6.28);
  const a3 = wrnd(0, 6.28);
  const r0 = Math.min(W, H * 1.32) * 0.29;
  const landR = (th: number): number =>
    r0 * (1 + 0.10 * Math.sin(3 * th + a1) + 0.07 * Math.sin(5 * th + a2) + 0.05 * Math.sin(8 * th + a3));

  const tile: Tile[][] = [];
  const solid: boolean[][] = [];

  // base terrain: either the classic radial island, or a caller-supplied mask
  if (opts.mask) {
    for (let y = 0; y < H; y++) {
      tile[y] = [];
      solid[y] = [];
      for (let x = 0; x < W; x++) tile[y][x] = opts.mask(x, y) ? Tile.Grass : Tile.Water;
    }
  } else {
    for (let y = 0; y < H; y++) {
      tile[y] = [];
      solid[y] = [];
      for (let x = 0; x < W; x++) {
        const dx = x - CX;
        const dy = (y - CY) * 1.32;
        const d = Math.hypot(dx, dy);
        const th = Math.atan2(dy, dx);
        const r = landR(th);
        tile[y][x] = d < r ? (d > r - 2.1 ? Tile.Sand : Tile.Grass) : Tile.Water;
      }
    }
  }
  // grass touching water becomes sand (clean coastline)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (tile[y][x] !== Tile.Grass) continue;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if ((tile[y + oy]?.[x + ox] ?? Tile.Grass) === Tile.Water) {
          tile[y][x] = Tile.Sand;
          break;
        }
      }
    }
  }
  // masked worlds get a second beach pass (the radial path bakes its own
  // 2-tile ring above) so the coast reads at the bigger map scale
  if (opts.mask) {
    const widen: [number, number][] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (tile[y][x] !== Tile.Grass) continue;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if ((tile[y + oy]?.[x + ox] ?? Tile.Grass) === Tile.Sand) { widen.push([x, y]); break; }
        }
      }
    }
    for (const [x, y] of widen) tile[y][x] = Tile.Sand;
  }
  // ruined stone walls, count scaled with island area
  const wallCount = Math.max(2, Math.round((W * H) / 700));
  for (let wsi = 0; wsi < wallCount; wsi++) {
    const ox = opts.mask
      ? wrndi(3, W - 6)
      : Math.floor(CX) + wrndi(-Math.floor(r0 * 0.7), Math.floor(r0 * 0.7));
    const oy = opts.mask
      ? wrndi(3, H - 6)
      : Math.floor(CY) + wrndi(-Math.floor(r0 * 0.5), Math.floor(r0 * 0.5));
    const cells: ReadonlyArray<readonly [number, number]> =
      wrand2() < 0.5
        ? [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [0, 1]]
        : [[0, 0], [0, 1], [0, 2], [1, 2]];
    for (const [cx, cy] of cells) {
      const x = ox + cx;
      const y = oy + cy;
      if (tile[y]?.[x] === Tile.Grass) tile[y][x] = Tile.Wall;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      solid[y][x] = tile[y][x] === Tile.Water || tile[y][x] === Tile.Wall || tile[y][x] === Tile.Palisade;
    }
  }

  const w: World = {
    key: opts.key,
    name: opts.name,
    safe: opts.safe,
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
    camps: [],
    coastWater: [],
    landR,
    mapCanvas: document.createElement("canvas"),
  };

  const reserve = (x: number, y: number, r: number): void => {
    w.reserved.push({ x, y, r });
  };
  const farFromReserved = (x: number, y: number): boolean =>
    w.reserved.every((o) => dist(x, y, o.x, o.y) >= o.r);
  const grassFree = (x: number, y: number): boolean =>
    tile[y]?.[x] === Tile.Grass && !solid[y][x];

  // portals: each needs a 3x3 clear grass patch; first south, then north, east
  const portalDirs: ReadonlyArray<readonly [number, number]> = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  opts.portals.forEach((pdef, pi) => {
    const [dx, dy] = portalDirs[pi % portalDirs.length];
    for (let rr = 3; rr < Math.max(W, H); rr++) {
      let placed = false;
      for (let sweep = -8; sweep <= 8 && !placed; sweep++) {
        const x = Math.floor(CX) + dx * rr + (dy !== 0 ? sweep : 0);
        const y = Math.floor(CY) + dy * rr + (dx !== 0 ? sweep : 0);
        let ok = true;
        for (let j = -1; j <= 1; j++)
          for (let i = -1; i <= 1; i++)
            if (!grassFree(x + i, y + j)) ok = false;
        ok = ok && farFromReserved(x, y);
        if (ok) {
          w.portals.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, dest: pdef.dest, label: pdef.label });
          reserve(x, y, 3.6);
          placed = true;
        }
      }
      if (placed) break;
    }
  });

  // build pads (home only): 2x2 grass
  if (opts.buildSpots) {
    for (let tries = 0; tries < 1200 && w.buildSpots.length < 6; tries++) {
      const x = wrndi(4, W - 6);
      const y = wrndi(4, H - 6);
      let ok = grassFree(x, y) && grassFree(x + 1, y) && grassFree(x, y + 1) && grassFree(x + 1, y + 1);
      ok = ok && farFromReserved(x + 0.5, y + 0.5);
      ok = ok && w.buildSpots.every((s) => dist(x, y, s.tx, s.ty) >= 4);
      ok = ok && dist(x, y, CX, CY) > 2.5;
      if (ok) {
        w.buildSpots.push({ tx: x, ty: y, built: null });
        reserve(x + 0.5, y + 0.5, 3);
      }
    }
  }

  // helper: find a free grass tile away from reserved areas
  const place = (): Vec | null => {
    for (let tries = 0; tries < 600; tries++) {
      const x = wrndi(3, W - 4);
      const y = wrndi(3, H - 4);
      if (!grassFree(x, y)) continue;
      if (!farFromReserved(x, y)) continue;
      if (dist(x, y, CX, CY) < 3) continue;
      return { x, y };
    }
    return null;
  };

  // NPCs (town only): placed near the center on clear grass
  if (opts.npcs) {
    for (const [key, name, spr] of NPC_DATA) {
      let spot: Vec | null = null;
      for (let tries = 0; tries < 500 && !spot; tries++) {
        const x = Math.floor(CX) + wrndi(-7, 7);
        const y = Math.floor(CY) + wrndi(-5, 5);
        if (grassFree(x, y) && farFromReserved(x, y)) spot = { x, y };
      }
      spot ??= place();
      if (spot) {
        w.npcs.push({ key, name, x: spot.x * TILE + TILE / 2, y: spot.y * TILE + TILE / 2, spr, bob: wrnd(0, 3) });
        reserve(spot.x, spot.y, 2.4);
      }
    }
  }

  for (let i = 0; i < opts.trees; i++) {
    const p = place();
    if (p) {
      w.trees.push({ tx: p.x, ty: p.y, spr: bakeTree(), hp: 3, maxhp: 3, stump: false, respawnT: 0, hurtT: 0 });
      solid[p.y][p.x] = true;
      reserve(p.x, p.y, 2.2);
    }
  }
  for (let i = 0; i < opts.rocks; i++) {
    const p = place();
    if (p) {
      w.rocks.push({ tx: p.x, ty: p.y, hp: 4, maxhp: 4, depleted: false, respawnT: 0, hurtT: 0 });
      solid[p.y][p.x] = true;
      reserve(p.x, p.y, 2.2);
    }
  }
  for (let i = 0; i < opts.herbs; i++) {
    const p = place();
    if (p) {
      w.herbs.push({ tx: p.x, ty: p.y, picked: false, respawnT: 0 });
      reserve(p.x, p.y, 1.6);
    }
  }
  for (let i = 0; i < opts.mushrooms; i++) {
    const p = place();
    if (p) { w.decos.push({ spr: SPR.mushroom, tx: p.x, ty: p.y }); reserve(p.x, p.y, 1.6); }
  }
  for (let i = 0; i < opts.bones; i++) {
    const p = place();
    if (p) { w.decos.push({ spr: SPR.bones, tx: p.x, ty: p.y }); reserve(p.x, p.y, 1.6); }
  }

  bakeWorldCanvas(w, opts.grassShift ?? 0);
  return w;
}

/** Deterministic coin flip helper (kept separate for clarity). */
import { wrand } from "../util.ts";
function wrand2(): number {
  return wrand();
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

/** Render the static terrain + decorations into world.mapCanvas once. */
export function bakeWorldCanvas(w: World, grassShift = 0): void {
  const W = w.w;
  const H = w.h;
  const mc = w.mapCanvas;
  mc.width = W * TILE;
  mc.height = H * TILE;
  const m = mc.getContext("2d")!;
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
        if (coastal) w.coastWater.push({ x: px, y: py, ph: rnd(0, 6.28) });
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
  // baked decor
  for (const d of w.decos) {
    m.drawImage(d.spr, d.tx * TILE + ((TILE - d.spr.width) >> 1), d.ty * TILE + TILE - d.spr.height - 2);
    m.fillStyle = "rgba(0,0,0,.18)";
    m.fillRect(d.tx * TILE + 3, d.ty * TILE + TILE - 3, TILE - 6, 2);
  }
  // portal stone ring bases
  for (const pt of w.portals) {
    m.fillStyle = "#6a7174";
    for (let a = 0; a < 12; a++) {
      const th = (a / 12) * 6.283;
      m.fillRect(Math.round(pt.x + Math.cos(th) * 12 - 1.5), Math.round(pt.y + Math.sin(th) * 7 - 1), 3, 2);
    }
    m.fillStyle = "#3a4144";
    for (let a = 0; a < 12; a += 2) {
      const th = (a / 12) * 6.283 + 0.26;
      m.fillRect(Math.round(pt.x + Math.cos(th) * 12 - 1), Math.round(pt.y + Math.sin(th) * 7), 2, 1);
    }
  }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
