/** Global game state: the three islands, the active one, and the player. */
import { makeWorld } from "./world/generate.ts";
import { makeHandmadeWorld, HOME_SPEC, TOWN_SPEC } from "./world/handmade.ts";
import { makeCaveWorld, addCaveEntrance } from "./world/cave.ts";
import { portalSpawn } from "./world/collision.ts";
import { spawnMonster } from "./entities/monsters.ts";
import { createPlayer } from "./entities/player.ts";
import { loadResearchState } from "./systems/tower.ts";
import { resetTasks } from "./systems/tasks.ts";
import { resetSkills } from "./systems/skills.ts";
import { resetQuests } from "./systems/quests.ts";
import { emptyStash } from "./items.ts";
import { seedWorldRng } from "./util.ts";
import { beep } from "./audio.ts";
import { WORLD_SEED, MONSTERS_ENABLED } from "./config.ts";
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
  /** IDs of one-time treasure chests already opened (persisted in the save). */
  opened: string[];
}

/**
 * Monster rosters per dangerous world. Difficulty is the descent: the surface
 * carries only the low tiers, and each Bone Caverns floor down adds heavier
 * ones — so pushing deeper, not running laps, is how you meet tougher foes.
 */
type DangerKey = "wild" | "cave1" | "cave2" | "cave3";
// Per-floor populations. THE tuning knob for crowd pressure: with body
// blocking + the 2-attacker shield cap, every extra creature in a pack now
// matters (3rd+ hits pierce the shield), so adjust counts here after playtests.
const POPULATIONS: Readonly<Record<DangerKey, Partial<Record<MonsterKind, number>>>> = {
  // Surface: tiers 1-2, the ~level 1-8 hunting grounds. Shooters debut gently
  // (poison spider spit, amazon knives) before the cavern archers below.
  wild: {
    rat: 5, snake: 4, crab: 4, bat: 4, spider: 4, wasp: 3,
    skeleton: 3, rotworm: 3, poisonSpider: 3, wolf: 3, goblin: 3, amazon: 2,
  },
  // -1: tiers 2-3 (~level 8-13). The first spear-throwing orcs appear.
  cave1: {
    skeleton: 3, rotworm: 3, goblin: 3, wolf: 3, warWolf: 3,
    ghoul: 3, ghost: 3, orc: 3, orcSpearman: 3, bear: 2,
  },
  // -2: tiers 3-4 (~level 12-17). The orc war camp and the minotaur outposts.
  cave2: {
    orc: 3, orcSpearman: 2, bear: 2, orcWarrior: 3, hunter: 2, ghost: 2,
    minotaur: 3, minotaurArcher: 2, troll: 2, orcShaman: 2, mummy: 2,
  },
  // -3: tier 5 (~level 17-20+) and the dragon's lair — ONE dragon nests in
  // the deepest band (danger 0.99, same as the Bone Lord) on a 10-minute
  // respawn, guarding the way to the Marrow Blade chest.
  cave3: {
    troll: 2, mummy: 2, orcBerserker: 3, cyclops: 3,
    minotaurGuard: 2, minotaurMage: 2, boneLord: 2, dragon: 1,
  },
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
    treasure: true, // the Marrow Blade chest waits at the very bottom
  });
  return { home, town, wild, cave1, cave2, cave3 };
}

/** Populate one dangerous world from its own deterministic RNG stream. */
export function populateWorld(w: World, seed = WORLD_SEED): void {
  const pop = POPULATIONS[w.key as DangerKey];
  if (!pop) return;
  w.monsters.length = 0;
  w.respawns.length = 0;
  if (!MONSTERS_ENABLED) return; // peaceful mode: leave every floor empty
  seedWorldRng(seed ^ keySalt(w.key));
  for (const kind of Object.keys(pop) as MonsterKind[]) {
    for (let i = 0; i < (pop[kind] ?? 0); i++) spawnMonster(w, kind);
  }
}

/** Populate the Wildlands and every cave floor. */
export function populateAll(worlds: Record<WorldKey, World>, seed = WORLD_SEED): void {
  for (const k of DANGER_KEYS) populateWorld(worlds[k], seed);
}

export function createGame(seed = WORLD_SEED): Game {
  const worlds = buildWorlds(seed);
  populateAll(worlds, seed);
  const player = createPlayer(portalSpawn(worlds.home));
  loadResearchState([]); // a fresh game has no research completed
  resetTasks(); // no board tasks taken yet
  resetSkills(); // module state — wipe any training from a previous session
  resetQuests(); // likewise, quest progress lives in module state
  return {
    seed,
    worlds,
    current: worlds.home,
    player,
    stash: emptyStash(),
    zoneFlash: { text: "Home Isle  (safe)", t: 2.2 },
    tpFlash: 0,
    opened: [],
  };
}

/** 8-way compass word for a direction vector (screen space: +y is south). */
function compass(dx: number, dy: number): string {
  const ns = dy < -8 ? "north" : dy > 8 ? "south" : "";
  const ew = dx < -8 ? "west" : dx > 8 ? "east" : "";
  return (ns + ew) || "east";
}

/** Teleport the player through a portal to `dest`. */
export function travelTo(g: Game, dest: WorldKey): void {
  const target = g.worlds[dest];
  // spawn beside the return portal that points back to where we came from
  const back = target.portals.find((pt) => pt.dest === g.current.key) ?? target.portals[0];
  const p = portalSpawn(target, back);
  // arriving on the surface: point the way to the cave mouth so it's findable
  let extra = "";
  if (dest === "wild") {
    const mouth = target.portals.find((pt) => pt.dest === "cave1");
    if (mouth) extra = "  ·  cave mouth to the " + compass(mouth.x - p.x, mouth.y - p.y);
  }
  g.current = target;
  g.player.x = p.x;
  g.player.y = p.y;
  g.player.dest = null;
  g.player.target = null;
  g.player.gather = null;
  g.player.tpCd = 1.6;
  g.tpFlash = 1;
  g.zoneFlash = { text: target.name + (target.safe ? "  (safe)" : "  (dangerous)") + extra, t: 2.8 };
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
