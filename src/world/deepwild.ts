/**
 * The Deep Wildlands v2 — a CONTINENT, not an island blob.
 *
 * 368x272 tiles (three times the area of the first cut, twelve times the old
 * Wildlands). The coastline is carved from layered value noise instead of the
 * radial silhouette: deep bays, fat peninsulas and enclosed inland lakes — the
 * hand-sketched "mainland" look — with an adaptive threshold that always lands
 * on ~46% land, whatever the noise rolls.
 *
 * Eight themed monster settlements are spread by a farthest-point rule so no
 * two camps crowd each other (60+ tiles apart), ordered by difficulty: the
 * gentle camps sit near the southern dock, the deadly ones across the land.
 * EVERY camp has a dark cave mouth inside its ring — the descent into that
 * settlement's own LAIR, a chain of one to three cellular-automata floors
 * (deeper floors are larger and will carry the harder tiers when the rosters
 * arrive). Trodden trails run dock → camps along real walkable BFS paths, so
 * they bend around bays and lakes instead of pretending to ford them.
 *
 * THIS STAGE STILL SHIPS THE MAP ONLY: no POPULATIONS entries exist for the
 * frontier or any lair floor, so the whole region generates empty — free to
 * review. Deterministic from WORLD_SEED xor key salts; the older islands'
 * streams are untouched.
 */
import { TILE } from "../config.ts";
import { wrnd, wrand, dist } from "../util.ts";
import { SPR, bakeTree } from "../gfx/sprites.ts";
import { makeWorld, bakeWorldCanvas } from "./generate.ts";
import { Tile } from "./types.ts";
import type { World, WorldKey } from "./types.ts";

/* ------------------------------------------------------------------ */
/*  Camps & their lairs                                                 */
/* ------------------------------------------------------------------ */

interface CampSpec {
  key: string;
  name: string;
  /** Camp radius in tiles. */
  r: number;
  ring: "palisade" | "wall" | "none";
  theme: "warren" | "cove" | "hollow" | "goblin" | "orc" | "minotaur" | "grave" | "dragon";
  /** Descent chain, top floor first. Deeper floors = harder (future rosters). */
  floors: readonly WorldKey[];
}

/** Ordered by difficulty: index 0 spawns nearest the dock, the last farthest. */
const CAMP_SPECS: readonly CampSpec[] = [
  { key: "warren",  name: "Rat Warren",          r: 7,  ring: "none",     theme: "warren",   floors: ["warren1"] },
  { key: "cove",    name: "Crab Cove",           r: 7,  ring: "none",     theme: "cove",     floors: ["cove1"] },
  { key: "hollow",  name: "Spider Hollow",       r: 8,  ring: "none",     theme: "hollow",   floors: ["hollow1", "hollow2"] },
  { key: "goblin",  name: "Goblin Village",      r: 9,  ring: "palisade", theme: "goblin",   floors: ["goblin1", "goblin2"] },
  { key: "orcfort", name: "Orc Fort",            r: 10, ring: "palisade", theme: "orc",      floors: ["orcfort1", "orcfort2"] },
  { key: "bastion", name: "Minotaur Bastion",    r: 10, ring: "wall",     theme: "minotaur", floors: ["bastion1", "bastion2"] },
  { key: "grave",   name: "Forgotten Graveyard", r: 9,  ring: "wall",     theme: "grave",    floors: ["grave1", "grave2"] },
  { key: "roost",   name: "Dragon Roost",        r: 9,  ring: "none",     theme: "dragon",   floors: ["roost1", "roost2", "roost3"] },
];

/** One lair floor as game.ts should build it (via makeCaveWorld). */
export interface LairFloor {
  key: WorldKey;
  name: string;
  up: WorldKey;
  down?: WorldKey;
  w: number;
  h: number;
  rocks: number;
  bones: number;
  /** A one-time Marrow-set chest waits on this floor (bottom floors of the
   *  five martial camps), placed farthest from the ladder and ringed by an
   *  elite guard detail. */
  treasure?: boolean;
}

/** The camps whose deepest floor hoards a piece of the Marrow set. */
const TREASURE_FLOORS: ReadonlySet<string> = new Set(["goblin2", "orcfort2", "bastion2", "grave2", "roost3"]);

/**
 * The full lair catalog, derived from the camp chains. Floor sizes grow with
 * depth — the deeper you go, the bigger (and, once populated, the meaner) it
 * gets. game.ts walks this list and rolls one cave world per entry.
 */
export const LAIRS: readonly LairFloor[] = CAMP_SPECS.flatMap((c) =>
  c.floors.map((key, i): LairFloor => ({
    key,
    name: `${c.name} Lair -${i + 1}`,
    up: i === 0 ? "deepwild" : c.floors[i - 1],
    down: c.floors[i + 1],
    w: 48 + i * 10,
    h: 40 + i * 8,
    rocks: 10 + i * 4,
    bones: 8 + i * 3,
    treasure: TREASURE_FLOORS.has(key) || undefined,
  })),
);

/* ------------------------------------------------------------------ */
/*  Continent mask: layered value noise, adaptive land quantile         */
/* ------------------------------------------------------------------ */

/** A coarse grid of deterministic randoms (drawn from the seeded world RNG). */
function noiseGrid(cols: number, rows: number): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => wrand()));
}

/** Smoothstep-bilinear sample of a coarse grid at tile (x, y), cell size `c`. */
function sampleNoise(g: number[][], x: number, y: number, c: number): number {
  const gx = x / c;
  const gy = y / c;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const row0 = g[Math.min(y0, g.length - 1)];
  const row1 = g[Math.min(y0 + 1, g.length - 1)];
  const a = row0[Math.min(x0, row0.length - 1)];
  const b = row0[Math.min(x0 + 1, row0.length - 1)];
  const cc = row1[Math.min(x0, row1.length - 1)];
  const d = row1[Math.min(x0 + 1, row1.length - 1)];
  return (a + (b - a) * sx) * (1 - sy) + (cc + (d - cc) * sx) * sy;
}

/**
 * Build the land grid: two noise octaves faded toward the map border, then a
 * threshold picked as the exact quantile that yields ~46% land. The largest
 * 4-connected landmass is kept (stray islets sink); water enclosed inside it
 * simply stays — those are the inland lakes.
 */
function buildLandGrid(W: number, H: number): boolean[][] {
  const g1 = noiseGrid(Math.ceil(W / 26) + 2, Math.ceil(H / 26) + 2);
  const g2 = noiseGrid(Math.ceil(W / 10) + 2, Math.ceil(H / 10) + 2);
  const v: number[][] = [];
  const flat: number[] = [];
  for (let y = 0; y < H; y++) {
    v[y] = [];
    for (let x = 0; x < W; x++) {
      const n = 0.68 * sampleNoise(g1, x, y, 26) + 0.32 * sampleNoise(g2, x, y, 10);
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y) / 24;
      const fall = edge >= 1 ? 1 : edge * edge * (3 - 2 * edge);
      v[y][x] = n * (0.3 + 0.7 * fall);
      flat.push(v[y][x]);
    }
  }
  flat.sort((a, b) => a - b);
  // aim a little high: sinking the stray islets below trims a few points off,
  // so ~52% pre-filter settles near ~45% of the map as one connected mainland
  const thr = flat[Math.floor(flat.length * (1 - 0.52))];
  const land: boolean[][] = v.map((row) => row.map((val) => val > thr));

  // keep only the biggest landmass — no separate unreachable islets
  const seen: boolean[][] = Array.from({ length: H }, () => new Array<boolean>(W).fill(false));
  let best: [number, number][] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!land[y][x] || seen[y][x]) continue;
      const region: [number, number][] = [];
      const stack: [number, number][] = [[x, y]];
      seen[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        region.push([cx, cy]);
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (!land[ny][nx] || seen[ny][nx]) continue;
          seen[ny][nx] = true;
          stack.push([nx, ny]);
        }
      }
      if (region.length > best.length) best = region;
    }
  }
  const keep = new Set(best.map(([x, y]) => y * W + x));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (land[y][x] && !keep.has(y * W + x)) land[y][x] = false;
  return land;
}

/* ------------------------------------------------------------------ */
/*  The frontier itself                                                 */
/* ------------------------------------------------------------------ */

const DW_W = 368;
const DW_H = 272;

export function makeDeepWildWorld(): World {
  // the mask must be rolled FIRST so its RNG draws are stable regardless of
  // how many draws terrain decoration makes afterwards
  const land = buildLandGrid(DW_W, DW_H);

  const w = makeWorld({
    key: "deepwild", name: "Deep Wildlands", safe: false, w: DW_W, h: DW_H,
    buildSpots: false, npcs: false,
    // resource counts scaled with the 3x area
    trees: 380, rocks: 260, herbs: 150, mushrooms: 60, bones: 120, grassShift: -20,
    portals: [], // the dock is placed by hand below, on the southern coast
    mask: (tx, ty) => land[ty][tx],
  });

  /* ---- the dock: southernmost clear inland spot of the mainland ---- */
  const dock = placeDock(w);

  /* ---- camps: farthest-point spread, difficulty = distance from dock ---- */
  const spots = campAnchors(w, dock);
  CAMP_SPECS.forEach((spec, i) => {
    const { cx, cy } = spots[i];
    carveCamp(w, spec, cx, cy);
    w.camps.push({
      key: spec.key, name: spec.name,
      x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2,
      r: spec.r * TILE,
    });
    // the descent: a cave mouth on the camp floor, leading to lair floor -1
    placeLairMouth(w, cx, cy, spec);
  });

  /* ---- trodden trails: real BFS paths dock → every camp ---- */
  paintTrails(w, dock);

  // tile edits + fresh decor → repaint the static canvas (clear the coastal
  // shimmer list first; the baker refills it and must not double up)
  w.coastWater.length = 0;
  bakeWorldCanvas(w, -20);

  // the dark descent holes are painted over the finished canvas, exactly the
  // way addCaveEntrance dresses the Wildlands' cavern mouth
  for (const pt of w.portals) {
    if (pt.style !== "caveMouth") continue;
    const m = w.mapCanvas.getContext("2d")!;
    m.fillStyle = "#54504a";
    m.beginPath(); m.ellipse(pt.x, pt.y + 1, 12, 9, 0, 0, 6.2832); m.fill();
    m.fillStyle = "#26241f";
    m.beginPath(); m.ellipse(pt.x, pt.y + 2, 8, 6, 0, 0, 6.2832); m.fill();
  }
  return w;
}

/**
 * Put the dock on the southern coast: the southernmost tile whose 5x5
 * neighbourhood is entirely clear land. Pure scan, no RNG draws. Any resource
 * nodes that landed there first are evicted.
 */
function placeDock(w: World): { tx: number; ty: number } {
  const clear5 = (tx: number, ty: number): boolean => {
    for (let oy = -2; oy <= 2; oy++)
      for (let ox = -2; ox <= 2; ox++) {
        const t = w.tile[ty + oy]?.[tx + ox];
        if (t === undefined || t === Tile.Water || t === Tile.Wall) return false;
      }
    return true;
  };
  let spot: { tx: number; ty: number } | null = null;
  outer: for (let y = w.h - 4; y >= 3 && !spot; y--) {
    // sweep x from the middle outward so the dock hugs the map's south-centre
    for (let s = 0; s < w.w - 6; s++) {
      const x = Math.floor(w.w / 2) + (s % 2 === 0 ? s / 2 : -(s + 1) / 2);
      if (x < 3 || x >= w.w - 3) continue;
      if (clear5(x, y)) { spot = { tx: x, ty: y }; break outer; }
    }
  }
  spot ??= { tx: Math.floor(w.w / 2), ty: Math.floor(w.h / 2) };
  const { tx, ty } = spot;
  const inArea = (a: number, b: number): boolean => Math.max(Math.abs(a - tx), Math.abs(b - ty)) <= 2;
  w.trees = w.trees.filter((t) => { if (inArea(t.tx, t.ty)) { w.solid[t.ty][t.tx] = false; return false; } return true; });
  w.rocks = w.rocks.filter((t) => { if (inArea(t.tx, t.ty)) { w.solid[t.ty][t.tx] = false; return false; } return true; });
  w.herbs = w.herbs.filter((t) => !inArea(t.tx, t.ty));
  w.decos = w.decos.filter((d) => !inArea(d.tx, d.ty));
  w.portals.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, dest: "town", label: "to Bonetown" });
  return spot;
}

/**
 * Choose the eight camp anchors. Candidates are tiles whose whole camp circle
 * (radius + margin) sits on land. Each camp targets a dock distance that grows
 * with its difficulty rank; among candidates near that distance the one
 * farthest from all previously placed camps wins — settlements end up 60+
 * tiles apart, spread across the whole continent. Pure computation, no RNG.
 */
function campAnchors(w: World, dock: { tx: number; ty: number }): { cx: number; cy: number }[] {
  const margin = 4;
  const candidates: { x: number; y: number; d: number }[] = [];
  let maxD = 0;
  for (let y = 14; y < w.h - 14; y += 3) {
    for (let x = 14; x < w.w - 14; x += 3) {
      if (w.tile[y][x] === Tile.Water) continue;
      const R = 11 + margin; // fits the largest camp
      let ok = true;
      for (let oy = -R; oy <= R && ok; oy += 2)
        for (let ox = -R; ox <= R && ok; ox += 2) {
          if (Math.hypot(ox, oy) > R) continue;
          const t = w.tile[y + oy]?.[x + ox];
          if (t === undefined || t === Tile.Water) ok = false;
        }
      if (!ok) continue;
      const d = dist(x, y, dock.tx, dock.ty);
      maxD = Math.max(maxD, d);
      candidates.push({ x, y, d });
    }
  }
  const placed: { cx: number; cy: number }[] = [];
  CAMP_SPECS.forEach((_, i) => {
    const target = (0.16 + (0.82 - 0.16) * (i / (CAMP_SPECS.length - 1))) * maxD;
    for (const minGap of [64, 52, 42, 32]) {
      let best: { x: number; y: number } | null = null;
      let bestScore = -Infinity;
      for (const c of candidates) {
        if (Math.abs(c.d - target) > maxD * 0.14) continue;
        let nearest = Infinity;
        for (const p of placed) nearest = Math.min(nearest, dist(c.x, c.y, p.cx, p.cy));
        if (nearest < minGap) continue;
        // prefer maximal spread from the other camps within the target band
        const score = Math.min(nearest, 999) - Math.abs(c.d - target) * 0.25;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (best) { placed.push({ cx: best.x, cy: best.y }); return; }
    }
    // dense-map fallback: nearest candidate to the target distance
    let fb = candidates[0];
    for (const c of candidates) if (Math.abs(c.d - target) < Math.abs(fb.d - target)) fb = c;
    placed.push({ cx: fb.x, cy: fb.y });
  });
  return placed;
}

/** Clear the circle, floor it with dirt, raise the ring, dress the interior. */
function carveCamp(w: World, spec: CampSpec, cx: number, cy: number): void {
  const R = spec.r;

  // 1) evict resource nodes & decor from the circle (and free their tiles)
  const inside = (tx: number, ty: number): boolean => dist(tx, ty, cx, cy) <= R + 1;
  w.trees = w.trees.filter((t) => { if (inside(t.tx, t.ty)) { w.solid[t.ty][t.tx] = false; return false; } return true; });
  w.rocks = w.rocks.filter((t) => { if (inside(t.tx, t.ty)) { w.solid[t.ty][t.tx] = false; return false; } return true; });
  w.herbs = w.herbs.filter((t) => !inside(t.tx, t.ty));
  w.decos = w.decos.filter((d) => !inside(d.tx, d.ty));

  // 2) dirt floor with a ragged, hand-worn edge
  for (let y = cy - R - 1; y <= cy + R + 1; y++) {
    for (let x = cx - R - 1; x <= cx + R + 1; x++) {
      const d = dist(x, y, cx, cy);
      if (d > R + wrnd(-0.8, 0.4)) continue;
      const t = w.tile[y]?.[x];
      if (t === Tile.Grass || t === Tile.Sand) w.tile[y][x] = Tile.Dirt;
    }
  }

  // 3) the ring: posts/stones on the perimeter with two opposite gates.
  if (spec.ring !== "none") {
    const gateA = Math.atan2(w.h / 2 - cy, w.w / 2 - cx); // toward the interior
    const gateB = gateA + Math.PI;
    const t: Tile = spec.ring === "palisade" ? Tile.Palisade : Tile.Wall;
    const steps = Math.max(26, Math.round(R * 7));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      if (angleGap(a, gateA) < 0.36 || angleGap(a, gateB) < 0.3) continue; // gates
      const x = Math.round(cx + Math.cos(a) * R);
      const y = Math.round(cy + Math.sin(a) * R);
      const cur = w.tile[y]?.[x];
      if (cur === Tile.Dirt || cur === Tile.Grass || cur === Tile.Sand) {
        w.tile[y][x] = t;
        w.solid[y][x] = true;
      }
    }
  }

  // 4) interior dressing per theme (decos bake into the map canvas). The
  // centre stays clear — the lair mouth goes there right after.
  const spot = (): { x: number; y: number } | null => {
    for (let tries = 0; tries < 60; tries++) {
      const a = wrnd(0, Math.PI * 2);
      const rr = wrnd(2.4, R - 1.8);
      const x = Math.round(cx + Math.cos(a) * rr);
      const y = Math.round(cy + Math.sin(a) * rr);
      const t = w.tile[y]?.[x];
      if ((t === Tile.Dirt || t === Tile.Sand) && !w.solid[y][x]
        && dist(x, y, cx, cy) > 2.2
        && w.decos.every((d) => dist(d.tx, d.ty, x, y) >= 2)) return { x, y };
    }
    return null;
  };
  const dress = (spr: HTMLCanvasElement, n: number, solidTile = false): void => {
    for (let i = 0; i < n; i++) {
      const p = spot();
      if (!p) continue;
      w.decos.push({ spr, tx: p.x, ty: p.y });
      if (solidTile) w.solid[p.y][p.x] = true;
    }
  };

  switch (spec.theme) {
    case "warren":
      dress(SPR.bones, 6); dress(SPR.mushroom, 4);
      break;
    case "cove":
      // a shell-strewn beach camp: sand floor instead of dirt
      for (let y = cy - R; y <= cy + R; y++)
        for (let x = cx - R; x <= cx + R; x++)
          if (w.tile[y]?.[x] === Tile.Dirt && dist(x, y, cx, cy) <= R) w.tile[y][x] = Tile.Sand;
      dress(SPR.bones, 3); dress(SPR.stoneIcon, 5);
      break;
    case "hollow":
      dress(SPR.web, 7); dress(SPR.bones, 4);
      ringOfTrees(w, cx, cy, R + 2);
      break;
    case "goblin":
      dress(SPR.hut, 4, true); dress(SPR.tent, 2, true); dress(SPR.campfire, 1); dress(SPR.bones, 3);
      break;
    case "orc":
      dress(SPR.hut, 5, true); dress(SPR.skullPole, 3, true); dress(SPR.campfire, 2); dress(SPR.bones, 3);
      break;
    case "minotaur":
      dress(SPR.hut, 3, true); dress(SPR.skullPole, 2, true); dress(SPR.bones, 5); dress(SPR.stoneIcon, 3);
      break;
    case "grave":
      dress(SPR.gravestone, 10, true); dress(SPR.bones, 5); dress(SPR.web, 2);
      break;
    case "dragon":
      dress(SPR.scorch, 10); dress(SPR.bones, 7); dress(SPR.skullPole, 2, true);
      break;
  }
}

/** The descent into a camp's lair: a cave-mouth portal on the camp centre. */
function placeLairMouth(w: World, cx: number, cy: number, spec: CampSpec): void {
  // the centre was kept clear by carveCamp; still walk a small spiral in case
  // the ragged dirt edge or ring landed something odd on it
  let tx = cx;
  let ty = cy;
  outer: for (let r = 0; r < 5; r++) {
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
        const t = w.tile[cy + oy]?.[cx + ox];
        if ((t === Tile.Dirt || t === Tile.Sand) && !w.solid[cy + oy][cx + ox]) {
          tx = cx + ox;
          ty = cy + oy;
          break outer;
        }
      }
    }
  }
  w.portals.push({
    x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2,
    dest: spec.floors[0], label: `descend into the ${spec.name.toLowerCase()} lair`,
    style: "caveMouth",
  });
}

/** Smallest absolute angular distance between two angles. */
function angleGap(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

/** A dense ring of extra trees just outside a camp (Spider Hollow's hem). */
function ringOfTrees(w: World, cx: number, cy: number, r: number): void {
  const steps = Math.round(r * 6);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    // leave two gaps so the hollow stays enterable
    if (angleGap(a, 0) < 0.5 || angleGap(a, Math.PI) < 0.5) continue;
    const x = Math.round(cx + Math.cos(a) * r + wrnd(-0.6, 0.6));
    const y = Math.round(cy + Math.sin(a) * r + wrnd(-0.6, 0.6));
    if (w.tile[y]?.[x] !== Tile.Grass || w.solid[y][x]) continue;
    if (!w.trees.every((t) => dist(t.tx, t.ty, x, y) >= 1.5)) continue;
    w.trees.push({ tx: x, ty: y, spr: bakeTree(), hp: 3, maxhp: 3, stump: false, respawnT: 0, hurtT: 0 });
    w.solid[y][x] = true;
  }
}

/**
 * Trodden trails along REAL walkable routes: one multi-target BFS from the
 * dock over non-solid land, then each camp's parent chain is painted as a
 * two-tile dirt path. Trails bend around bays, lakes and forests exactly the
 * way feet would — no broken "fords" across open water.
 */
function paintTrails(w: World, dock: { tx: number; ty: number }): void {
  const W = w.w;
  const H = w.h;
  const walkable = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < W && y < H && !w.solid[y][x] && w.tile[y][x] !== Tile.Water;
  const parent = new Int32Array(W * H).fill(-1);
  const start = dock.ty * W + dock.tx;
  parent[start] = start;
  const qx: number[] = [dock.tx];
  const qy: number[] = [dock.ty];
  for (let head = 0; head < qx.length; head++) {
    const x = qx[head];
    const y = qy[head];
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + ox;
      const ny = y + oy;
      if (!walkable(nx, ny) || parent[ny * W + nx] !== -1) continue;
      parent[ny * W + nx] = y * W + x;
      qx.push(nx);
      qy.push(ny);
    }
  }
  for (const c of w.camps) {
    let cur = Math.floor(c.y / TILE) * W + Math.floor(c.x / TILE);
    if (parent[cur] === -1) continue; // unreachable (shouldn't happen — one landmass)
    let guard = W * H;
    while (cur !== start && guard-- > 0) {
      const x = cur % W;
      const y = Math.floor(cur / W);
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]] as const) {
        const tx = x + ox;
        const ty = y + oy;
        if (w.tile[ty]?.[tx] === Tile.Grass && !w.solid[ty][tx]) w.tile[ty][tx] = Tile.Dirt;
      }
      cur = parent[cur];
    }
  }
}
