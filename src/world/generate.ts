/**
 * Procedural island generation and static map-canvas baking.
 * Produces an organic island: grass interior, sandy coast, ruined walls,
 * a teleport portal, optional build pads, plus trees/rocks/decor.
 */
import { TILE, MAP_W, MAP_H, CENTER_X, CENTER_Y } from "../config.ts";
import { rnd, rndi, dist } from "../util.ts";
import { SPR, bakeTree } from "../gfx/sprites.ts";
import { Tile } from "./types.ts";
import type { World, WorldOpts, Vec } from "./types.ts";

export function makeWorld(opts: WorldOpts): World {
  const a1 = rnd(0, 6.28);
  const a2 = rnd(0, 6.28);
  const a3 = rnd(0, 6.28);
  const landR = (th: number): number =>
    12.6 * (1 + 0.10 * Math.sin(3 * th + a1) + 0.07 * Math.sin(5 * th + a2) + 0.05 * Math.sin(8 * th + a3));

  const tile: Tile[][] = [];
  const solid: boolean[][] = [];

  // base terrain ring
  for (let y = 0; y < MAP_H; y++) {
    tile[y] = [];
    solid[y] = [];
    for (let x = 0; x < MAP_W; x++) {
      const dx = x - CENTER_X;
      const dy = (y - CENTER_Y) * 1.32;
      const d = Math.hypot(dx, dy);
      const th = Math.atan2(dy, dx);
      const r = landR(th);
      tile[y][x] = d < r ? (d > r - 2.1 ? Tile.Sand : Tile.Grass) : Tile.Water;
    }
  }
  // grass touching water becomes sand (clean coastline)
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (tile[y][x] !== Tile.Grass) continue;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if ((tile[y + oy]?.[x + ox] ?? Tile.Grass) === Tile.Water) {
          tile[y][x] = Tile.Sand;
          break;
        }
      }
    }
  }
  // ruined stone walls
  const wallSets = [
    { ox: Math.floor(CENTER_X) - 7, oy: Math.floor(CENTER_Y) - 4, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [0, 1]] },
    { ox: Math.floor(CENTER_X) + 6, oy: Math.floor(CENTER_Y) + 3, cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  ] as const;
  for (const ws of wallSets) {
    for (const [ox, oy] of ws.cells) {
      const x = ws.ox + ox;
      const y = ws.oy + oy;
      if (tile[y]?.[x] === Tile.Grass) tile[y][x] = Tile.Wall;
    }
  }
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      solid[y][x] = tile[y][x] === Tile.Water || tile[y][x] === Tile.Wall;
    }
  }

  const w: World = {
    name: opts.name,
    safe: opts.safe,
    tile,
    solid,
    reserved: [],
    trees: [],
    rocks: [],
    decos: [],
    monsters: [],
    loot: [],
    respawns: [],
    structures: [],
    buildSpots: [],
    portal: { x: CENTER_X * TILE, y: (CENTER_Y + 3) * TILE },
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

  // portal: 3x3 clear grass, south of center
  let portalSet = false;
  for (let ry = 0; ry < 10 && !portalSet; ry++) {
    for (let rx = -8; rx <= 8 && !portalSet; rx++) {
      const x = Math.floor(CENTER_X) + rx;
      const y = Math.floor(CENTER_Y) + 3 + ry;
      let ok = true;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++)
          if (!grassFree(x + i, y + j)) ok = false;
      if (ok) {
        w.portal = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
        reserve(x, y, 3.2);
        portalSet = true;
      }
    }
  }

  // build pads (home only): 2x2 grass
  if (opts.buildSpots) {
    for (let tries = 0; tries < 900 && w.buildSpots.length < 6; tries++) {
      const x = rndi(4, MAP_W - 6);
      const y = rndi(4, MAP_H - 6);
      let ok = grassFree(x, y) && grassFree(x + 1, y) && grassFree(x, y + 1) && grassFree(x + 1, y + 1);
      ok = ok && farFromReserved(x + 0.5, y + 0.5);
      ok = ok && w.buildSpots.every((s) => dist(x, y, s.tx, s.ty) >= 4);
      ok = ok && dist(x, y, CENTER_X, CENTER_Y) > 2.5;
      if (ok) {
        w.buildSpots.push({ tx: x, ty: y, built: null });
        reserve(x + 0.5, y + 0.5, 3);
      }
    }
  }

  // helper: find a free grass tile away from reserved areas
  const place = (): Vec | null => {
    for (let tries = 0; tries < 400; tries++) {
      const x = rndi(3, MAP_W - 4);
      const y = rndi(3, MAP_H - 4);
      if (!grassFree(x, y)) continue;
      if (!farFromReserved(x, y)) continue;
      if (dist(x, y, CENTER_X, CENTER_Y) < 3) continue;
      return { x, y };
    }
    return null;
  };

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
  for (let i = 0; i < opts.mushrooms; i++) {
    const p = place();
    if (p) { w.decos.push({ spr: SPR.mushroom, tx: p.x, ty: p.y }); reserve(p.x, p.y, 1.6); }
  }
  for (let i = 0; i < opts.bones; i++) {
    const p = place();
    if (p) { w.decos.push({ spr: SPR.bones, tx: p.x, ty: p.y }); reserve(p.x, p.y, 1.6); }
  }

  bakeWorldCanvas(w, opts);
  return w;
}

/** Render the static terrain + decorations into world.mapCanvas once. */
function bakeWorldCanvas(w: World, opts: WorldOpts): void {
  const mc = w.mapCanvas;
  mc.width = MAP_W * TILE;
  mc.height = MAP_H * TILE;
  const m = mc.getContext("2d")!;
  const gj = opts.grassShift ?? 0;

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t0 = w.tile[y][x];
      const px = x * TILE;
      const py = y * TILE;
      if (t0 === Tile.Water) {
        const dx = x - CENTER_X;
        const dy = (y - CENTER_Y) * 1.32;
        const deep = clamp01((Math.hypot(dx, dy) - w.landR(Math.atan2(dy, dx))) / 6);
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
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
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
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (w.tile[y][x] !== Tile.Grass) continue;
      const px = x * TILE;
      const py = y * TILE;
      const edges: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
        [-1, 0, 0, 0, 1, TILE], [1, 0, TILE - 1, 0, 1, TILE], [0, -1, 0, 0, TILE, 1], [0, 1, 0, TILE - 1, TILE, 1],
      ];
      for (const [ox, oy, ex, ey, ww, hh] of edges) {
        if (w.tile[y + oy]?.[x + ox] === Tile.Sand)
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
  // portal stone ring base
  const px = w.portal.x;
  const py = w.portal.y;
  m.fillStyle = "#6a7174";
  for (let a = 0; a < 12; a++) {
    const th = (a / 12) * 6.283;
    m.fillRect(Math.round(px + Math.cos(th) * 12 - 1.5), Math.round(py + Math.sin(th) * 7 - 1), 3, 2);
  }
  m.fillStyle = "#3a4144";
  for (let a = 0; a < 12; a += 2) {
    const th = (a / 12) * 6.283 + 0.26;
    m.fillRect(Math.round(px + Math.cos(th) * 12 - 1), Math.round(py + Math.sin(th) * 7), 2, 1);
  }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
