/** Global game state: the three islands, the active one, and the player. */
import { makeWorld } from "./world/generate.ts";
import { portalSpawn } from "./world/collision.ts";
import { spawnMonster, MONSTER_KINDS } from "./entities/monsters.ts";
import { createPlayer } from "./entities/player.ts";
import { emptyStash } from "./items.ts";
import { seedWorldRng } from "./util.ts";
import { beep } from "./audio.ts";
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

/** How many of each monster kind live on the Wildlands. */
const WILD_POPULATION: Readonly<Record<MonsterKind, number>> = {
  spider: 5, skeleton: 5, goblin: 4, orc: 3, ghost: 3, troll: 2,
};

/** Build all three islands from a seed (deterministic terrain & layout). */
export function buildWorlds(seed: number): Record<WorldKey, World> {
  seedWorldRng(seed);
  const home = makeWorld({
    key: "home", name: "Home Isle", safe: true, w: 40, h: 30,
    buildSpots: true, npcs: false,
    trees: 5, rocks: 4, herbs: 3, mushrooms: 5, bones: 2,
    portals: [{ dest: "town", label: "to Bonetown" }],
  });
  const town = makeWorld({
    key: "town", name: "Bonetown", safe: true, w: 44, h: 32,
    buildSpots: false, npcs: true,
    trees: 4, rocks: 3, herbs: 5, mushrooms: 4, bones: 3, grassShift: 4,
    portals: [{ dest: "home", label: "to Home Isle" }, { dest: "wild", label: "to the Wildlands" }],
  });
  const wild = makeWorld({
    key: "wild", name: "Wildlands", safe: false, w: 60, h: 46,
    buildSpots: false, npcs: false,
    trees: 10, rocks: 9, herbs: 6, mushrooms: 4, bones: 9, grassShift: -14,
    portals: [{ dest: "town", label: "to Bonetown" }],
  });
  return { home, town, wild };
}

/** Populate the Wildlands with its monster roster. */
export function populateWild(wild: World): void {
  wild.monsters.length = 0;
  wild.respawns.length = 0;
  for (const kind of MONSTER_KINDS) {
    for (let i = 0; i < WILD_POPULATION[kind]; i++) spawnMonster(wild, kind);
  }
}

export function createGame(seed = (Math.random() * 1e9) | 0): Game {
  const worlds = buildWorlds(seed);
  populateWild(worlds.wild);
  const player = createPlayer(portalSpawn(worlds.home));
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
  g.player.mana = g.player.maxmana;
  g.player.dead = false;
  g.zoneFlash = { text: "Home Isle  (safe)", t: 2 };
}
