/** Global game state: the three islands, the active one, and the player. */
import { makeWorld } from "./world/generate.ts";
import { makeHandmadeWorld, HOME_SPEC, TOWN_SPEC } from "./world/handmade.ts";
import { makeCaveWorld, addCaveEntrance } from "./world/cave.ts";
import { portalSpawn } from "./world/collision.ts";
import { spawnMonster } from "./entities/monsters.ts";
import { createPlayer } from "./entities/player.ts";
import { loadResearchState } from "./systems/tower.ts";
import { resetTasks } from "./systems/tasks.ts";
import { emptyStash } from "./items.ts";
import { seedWorldRng } from "./util.ts";
import { beep } from "./audio.ts";
import { WORLD_SEED } from "./config.ts";
import type { World, WorldKey } from "./world/types.ts";
import type { Player } from "./entities/player.ts";
import type { Bag } from "./items.ts";
import type { MonsterKind } from "./world/types.ts";

export interface Game {
  seed: number;
  worlds: Record<WorldKey, World>;
  /** The world the player is currently standing in. */
  current: World;
  player: Player;
  /** Storage-chest contents, shared across all chests. */
  stash: Bag;
  zoneFlash: { text: string; t: number };
  tpFlash: number;
}

/**
 * Monster rosters per dangerous world. Difficulty is the descent: the surface
 * carries only the low tiers, and each Bone Caverns floor down adds heavier
 * ones — so pushing deeper, not running laps, is how you meet tougher foes.
 */
type DangerKey = "wild" | "cave1" | "cave2" | "cave3";
const POPULATIONS: Readonly<Record<DangerKey, Partial<Record<MonsterKind, number>>>> = {
  wild: { rat: 6, spider: 5, bat: 5, skeleton: 4, goblin: 4, wolf: 3 },
  cave1: { skeleton: 5, goblin: 5, wolf: 4, ghost: 4, orc: 4, bear: 2 },
  cave2: { orc: 5, bear: 4, minotaur: 4, ghost: 3, troll: 3 },
  cave3: { minotaur: 3, troll: 4, cyclops: 4, boneLord: 2 },
};
const DANGER_KEYS = Object.keys(POPULATIONS) as DangerKey[];

/** Stable per-key salt so each world's RNG stream is its own. */
function keySalt(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return h;
}

/** Build every map from a seed (deterministic terrain, layout & descent). */
export function buildWorlds(seed: number): Record<WorldKey, World> {
  // Seed the world RNG for the procedural Wildlands. The hub islands are
  // hand-authored (no RNG) and each cave floor re-seeds itself, so the surface
  // stays deterministic from the seed alone.
  seedWorldRng(seed);
  const home = makeHandmadeWorld(HOME_SPEC);
  const town = makeHandmadeWorld(TOWN_SPEC);
  const wild = makeWorld({
    key: "wild", name: "Wildlands", safe: false, w: 104, h: 80,
    buildSpots: false, npcs: false,
    trees: 40, rocks: 34, herbs: 20, mushrooms: 8, bones: 18, grassShift: -14,
    portals: [{ dest: "town", label: "to Bonetown" }],
  });
  // the cave mouth sits far out in the wilds; ladders chain the floors down
  addCaveEntrance(wild, "cave1", seed ^ keySalt("caveEntrance"));
  const cave1 = makeCaveWorld({
    key: "cave1", name: "Bone Caverns -1", w: 72, h: 56, seed: seed ^ keySalt("cave1"),
    up: "wild", down: "cave2", rocks: 16, bones: 12,
  });
  const cave2 = makeCaveWorld({
    key: "cave2", name: "Bone Caverns -2", w: 76, h: 60, seed: seed ^ keySalt("cave2"),
    up: "cave1", down: "cave3", rocks: 18, bones: 12,
  });
  const cave3 = makeCaveWorld({
    key: "cave3", name: "Bone Caverns -3", w: 80, h: 64, seed: seed ^ keySalt("cave3"),
    up: "cave2", rocks: 20, bones: 14,
  });
  return { home, town, wild, cave1, cave2, cave3 };
}

/** Populate one dangerous world from its own deterministic RNG stream. */
export function populateWorld(w: World): void {
  const pop = POPULATIONS[w.key as DangerKey];
  if (!pop) return;
  w.monsters.length = 0;
  w.respawns.length = 0;
  seedWorldRng(WORLD_SEED ^ keySalt(w.key));
  for (const kind of Object.keys(pop) as MonsterKind[]) {
    for (let i = 0; i < (pop[kind] ?? 0); i++) spawnMonster(w, kind);
  }
}

/** Populate the Wildlands and every cave floor. */
export function populateAll(worlds: Record<WorldKey, World>): void {
  for (const k of DANGER_KEYS) populateWorld(worlds[k]);
}

export function createGame(seed = WORLD_SEED): Game {
  const worlds = buildWorlds(seed);
  populateAll(worlds);
  const player = createPlayer(portalSpawn(worlds.home));
  loadResearchState([]); // a fresh game has no research completed
  resetTasks(); // no board tasks taken yet
  return {
    seed,
    worlds,
    current: worlds.home,
    player,
    stash: emptyStash(),
    zoneFlash: { text: "Home Isle  (safe)", t: 2.2 },
    tpFlash: 0,
  };
}

/** Teleport the player through a portal to `dest`. */
export function travelTo(g: Game, dest: WorldKey): void {
  const target = g.worlds[dest];
  // spawn beside the return portal that points back to where we came from
  const back = target.portals.find((pt) => pt.dest === g.current.key) ?? target.portals[0];
  const p = portalSpawn(target, back);
  g.current = target;
  g.player.x = p.x;
  g.player.y = p.y;
  g.player.dest = null;
  g.player.target = null;
  g.player.gather = null;
  g.player.tpCd = 1.6;
  g.tpFlash = 1;
  g.zoneFlash = { text: target.name + (target.safe ? "  (safe)" : "  (dangerous)"), t: 2.2 };
  beep(520, 0.25, "sine", 0.07, 420);
}

/** Send the player home alive (used on respawn after death). */
export function respawnAtHome(g: Game): void {
  g.current = g.worlds.home;
  const p = portalSpawn(g.worlds.home);
  g.player.x = p.x;
  g.player.y = p.y;
  g.player.hp = g.player.maxhp;
  g.player.dead = false;
  g.zoneFlash = { text: "Home Isle  (safe)", t: 2 };
}
