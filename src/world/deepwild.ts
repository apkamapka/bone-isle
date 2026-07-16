/**
 * The Deep Wildlands — one big frontier island (208x160, four times the
 * Wildlands' area) built around themed monster CAMPS instead of danger bands.
 *
 * The idea (Tibia-style spawn areas): creatures don't roam the whole island in
 * loose difficulty rings — they live in settlements. A goblin village behind a
 * palisade, an orc fort, a walled minotaur bastion, a graveyard, a scorched
 * dragon roost. Each camp is a carved circle of packed earth with its own
 * architecture and decoration, joined to the arrival dock by trodden trails.
 *
 * THIS STAGE SHIPS THE MAP ONLY. `deepwild` has no POPULATIONS entry, so the
 * island generates completely empty of monsters — free to explore and review.
 * The camps are recorded on `world.camps` (key, name, centre, radius) as the
 * anchor points a later stage will use for per-camp rosters and respawns.
 *
 * Deterministic: generation re-seeds the world RNG from WORLD_SEED xor a key
 * salt, so every device (and, later, every multiplayer client) carves the
 * exact same island — and the Wildlands' own RNG stream is left untouched.
 */
import { TILE } from "../config.ts";
import { wrnd, dist } from "../util.ts";
import { SPR, bakeTree } from "../gfx/sprites.ts";
import { makeWorld, bakeWorldCanvas } from "./generate.ts";
import { Tile } from "./types.ts";
import type { World } from "./types.ts";

/** Camp blueprint: where it sits on the island and how it's dressed. */
interface CampSpec {
  key: string;
  name: string;
  /** Angle around the island centre (radians) and radius as a fraction of the
   *  coastline distance in that direction — hand-tuned spread, then snapped to
   *  walkable ground. The dock sits south, so low tiers face south. */
  angle: number;
  radial: number;
  /** Camp radius in tiles. */
  r: number;
  /** Ring style: wooden palisade, ruined stone wall, or open ground. */
  ring: "palisade" | "wall" | "none";
  /** Decoration theme (drives which sprites dress the interior). */
  theme: "warren" | "cove" | "hollow" | "goblin" | "orc" | "minotaur" | "grave" | "dragon";
}

/**
 * Eight settlements, ordered by intended difficulty. Angles are compass-ish:
 * 0 = east, PI/2 = south (screen y grows down), PI = west, -PI/2 = north.
 * The dock is placed south of centre, so the gentle camps hug the southern
 * half and the hard ones wait across the island.
 */
const CAMP_SPECS: readonly CampSpec[] = [
  { key: "warren",   name: "Rat Warren",          angle:  1.9,  radial: 0.42, r: 6, ring: "none",     theme: "warren" },
  { key: "cove",     name: "Crab Cove",           angle:  0.75, radial: 0.80, r: 6, ring: "none",     theme: "cove" },
  { key: "hollow",   name: "Spider Hollow",       angle:  2.65, radial: 0.52, r: 7, ring: "none",     theme: "hollow" },
  { key: "goblin",   name: "Goblin Village",      angle:  0.05, radial: 0.52, r: 8, ring: "palisade", theme: "goblin" },
  { key: "orcfort",  name: "Orc Fort",            angle: -0.65, radial: 0.62, r: 9, ring: "palisade", theme: "orc" },
  { key: "bastion",  name: "Minotaur Bastion",    angle:  3.35, radial: 0.68, r: 9, ring: "wall",     theme: "minotaur" },
  { key: "grave",    name: "Forgotten Graveyard", angle: -2.15, radial: 0.62, r: 8, ring: "wall",     theme: "grave" },
  { key: "roost",    name: "Dragon Roost",        angle: -1.45, radial: 0.72, r: 8, ring: "none",     theme: "dragon" },
];

export function makeDeepWildWorld(): World {
  const w = makeWorld({
    key: "deepwild", name: "Deep Wildlands", safe: false, w: 208, h: 160,
    buildSpots: false, npcs: false,
    // resource counts scaled with the 4x area; camps clear their own circles
    trees: 130, rocks: 90, herbs: 56, mushrooms: 24, bones: 44, grassShift: -20,
    portals: [{ dest: "town", label: "to Bonetown" }],
  });

  const CX = w.w / 2;
  const CY = w.h / 2;
  const dock = w.portals[0];

  /* ---- carve the camps ---- */
  for (const spec of CAMP_SPECS) {
    // aim: along the spec angle, a fraction of the way toward the coast.
    // landR works in the squashed space (dy * 1.32), matching generation.
    const reach = w.landR(spec.angle) * spec.radial;
    let cx = Math.round(CX + Math.cos(spec.angle) * reach);
    let cy = Math.round(CY + (Math.sin(spec.angle) * reach) / 1.32);
    // snap to ground: spiral outward until the centre tile is walkable grass
    ({ cx, cy } = snapToGrass(w, cx, cy));

    carveCamp(w, spec, cx, cy);
    w.camps.push({
      key: spec.key, name: spec.name,
      x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2,
      r: spec.r * TILE,
    });
  }

  /* ---- trodden trails: dock → every camp ---- */
  if (dock) {
    for (const c of w.camps) {
      paintTrail(w, Math.floor(dock.x / TILE), Math.floor(dock.y / TILE), Math.floor(c.x / TILE), Math.floor(c.y / TILE));
    }
  }

  // tile edits + fresh decor → repaint the static canvas (clear the coastal
  // shimmer list first; the baker refills it and must not double up)
  w.coastWater.length = 0;
  bakeWorldCanvas(w, -20);
  return w;
}

/** Spiral out from (x,y) to the nearest clear grass tile. */
function snapToGrass(w: World, x: number, y: number): { cx: number; cy: number } {
  const ok = (tx: number, ty: number): boolean =>
    w.tile[ty]?.[tx] === Tile.Grass && !w.solid[ty][tx];
  if (ok(x, y)) return { cx: x, cy: y };
  for (let r = 1; r < 40; r++) {
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
        if (ok(x + ox, y + oy)) return { cx: x + ox, cy: y + oy };
      }
    }
  }
  return { cx: Math.floor(w.w / 2), cy: Math.floor(w.h / 2) };
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
      if (w.tile[y]?.[x] === Tile.Grass) w.tile[y][x] = Tile.Dirt;
    }
  }

  // 3) the ring: posts/stones on the perimeter with two opposite gates.
  // Gates face the island centre (the trail side) and its opposite.
  if (spec.ring !== "none") {
    const gateA = Math.atan2(cy - w.h / 2, cx - w.w / 2) + Math.PI; // toward centre
    const gateB = gateA + Math.PI;
    const t: Tile = spec.ring === "palisade" ? Tile.Palisade : Tile.Wall;
    const steps = Math.max(26, Math.round(R * 7));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      if (angleGap(a, gateA) < 0.42 || angleGap(a, gateB) < 0.34) continue; // gates
      const x = Math.round(cx + Math.cos(a) * R);
      const y = Math.round(cy + Math.sin(a) * R);
      const cur = w.tile[y]?.[x];
      if (cur === Tile.Dirt || cur === Tile.Grass || cur === Tile.Sand) {
        w.tile[y][x] = t;
        w.solid[y][x] = true;
      }
    }
  }

  // 4) interior dressing per theme (decos bake into the map canvas)
  const spot = (): { x: number; y: number } | null => {
    for (let tries = 0; tries < 60; tries++) {
      const a = wrnd(0, Math.PI * 2);
      const rr = wrnd(1.2, R - 1.6);
      const x = Math.round(cx + Math.cos(a) * rr);
      const y = Math.round(cy + Math.sin(a) * rr);
      if (w.tile[y]?.[x] === Tile.Dirt && !w.solid[y][x]
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
      dress(SPR.bones, 5); dress(SPR.mushroom, 3);
      break;
    case "cove":
      // a shell-strewn beach camp: sand floor instead of dirt
      for (let y = cy - R; y <= cy + R; y++)
        for (let x = cx - R; x <= cx + R; x++)
          if (w.tile[y]?.[x] === Tile.Dirt && dist(x, y, cx, cy) <= R) w.tile[y][x] = Tile.Sand;
      dress(SPR.bones, 3); dress(SPR.stoneIcon, 4);
      break;
    case "hollow":
      // a web-choked clearing hemmed in by a dense tree ring
      dress(SPR.web, 6); dress(SPR.bones, 3);
      ringOfTrees(w, cx, cy, R + 2);
      break;
    case "goblin":
      dress(SPR.hut, 3, true); dress(SPR.tent, 2, true); dress(SPR.campfire, 1); dress(SPR.bones, 2);
      break;
    case "orc":
      dress(SPR.hut, 4, true); dress(SPR.skullPole, 3, true); dress(SPR.campfire, 2); dress(SPR.bones, 3);
      break;
    case "minotaur":
      dress(SPR.hut, 2, true); dress(SPR.skullPole, 2, true); dress(SPR.bones, 4); dress(SPR.stoneIcon, 3);
      break;
    case "grave":
      dress(SPR.gravestone, 8, true); dress(SPR.bones, 4); dress(SPR.web, 2);
      break;
    case "dragon":
      dress(SPR.scorch, 8); dress(SPR.bones, 6); dress(SPR.skullPole, 2, true);
      break;
  }
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
 * Paint a two-tile-wide trodden trail between two tile coords. Steps along
 * the straight line with a little deterministic wobble; only grass converts
 * (water, sand, walls, camp floors are left alone), so a trail that grazes a
 * bay simply breaks at the shore — reads as a ford rather than a bridge.
 */
function paintTrail(w: World, x0: number, y0: number, x1: number, y1: number): void {
  const steps = Math.ceil(dist(x0, y0, x1, y1) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wob = Math.sin(t * 9.7) * 1.2 + wrnd(-0.5, 0.5);
    const nx = Math.round(x0 + (x1 - x0) * t + wob * 0.5);
    const ny = Math.round(y0 + (y1 - y0) * t + wob * 0.5);
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]] as const) {
      const x = nx + ox;
      const y = ny + oy;
      if (w.tile[y]?.[x] === Tile.Grass && !w.solid[y][x]) w.tile[y][x] = Tile.Dirt;
    }
  }
}
