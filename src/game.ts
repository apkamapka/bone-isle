/** Global game state: the three islands, the active one, and the player. */
import { makeWorld } from "./world/generate.ts";
import { makeHandmadeWorld, HOME_SPEC, TOWN_SPEC } from "./world/handmade.ts";
import { makeCaveWorld, addCaveEntrance } from "./world/cave.ts";
import { makeDeepWildWorld, LAIRS } from "./world/deepwild.ts";
import { portalSpawn } from "./world/collision.ts";
import { spawnMonster, spawnMonsterInCamp, spawnWilderness } from "./entities/monsters.ts";
import { createPlayer } from "./entities/player.ts";
import type { ItemKind } from "./items.ts";
import { loadResearchState } from "./systems/tower.ts";
import { resetTasks } from "./systems/tasks.ts";
import { resetSkills } from "./systems/skills.ts";
import { resetQuests } from "./systems/quests.ts";
import { resetOutfit, applyOutfit } from "./systems/outfit.ts";
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
type DangerKey = "wild" | "cave1" | "cave2" | "cave3"
  | "warren1" | "cove1" | "hollow1" | "hollow2" | "goblin1" | "goblin2"
  | "orcfort1" | "orcfort2" | "bastion1" | "bastion2" | "grave1" | "grave2"
  | "roost1" | "roost2" | "roost3";
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
  // ---- Deep Wildlands camp lairs: each settlement's dungeon, difficulty ----
  // ---- rising floor by floor (Etap 9b)                                  ----
  warren1:  { rat: 5, bat: 4, snake: 3 },
  cove1:    { crab: 7, wasp: 3 },
  hollow1:  { spider: 5, poisonSpider: 4 },
  hollow2:  { poisonSpider: 6, wasp: 4 },
  goblin1:  { goblin: 6, rotworm: 3 },
  goblin2:  { goblin: 6, warWolf: 3 },
  orcfort1: { orc: 4, orcSpearman: 3, orcWarrior: 3 },
  orcfort2: { orcWarrior: 4, orcShaman: 3, orcBerserker: 2 },
  bastion1: { minotaur: 4, minotaurArcher: 3 },
  bastion2: { minotaurGuard: 3, minotaurMage: 2, minotaur: 3 },
  grave1:   { skeleton: 4, ghoul: 4, ghost: 3 },
  grave2:   { mummy: 4, ghost: 3, boneLord: 1 },
  roost1:   { bear: 3, warWolf: 3 },
  roost2:   { cyclops: 3, orcBerserker: 2 },
  // the Roost's heart: the SECOND dragon (the cavern one guards the chest;
  // this one guards nothing but its hoard) with the same 10-minute clock
  roost3:   { dragon: 1, cyclops: 2 },
};

/**
 * Deep Wildlands SURFACE population (Etap 9b). Settlements carry themed
 * garrisons that spawn inside the camp ring and stay leashed to it; the open
 * forest between camps belongs to the wolves — free roamers with no leash,
 * spawned anywhere on the mainland outside settlements and the dock area.
 */
const CAMP_POPULATIONS: Readonly<Record<string, Partial<Record<MonsterKind, number>>>> = {
  warren:  { rat: 5, snake: 3 },
  cove:    { crab: 6 },
  hollow:  { spider: 4, poisonSpider: 3, wasp: 2 },
  goblin:  { goblin: 5, warWolf: 2 },
  orcfort: { orc: 4, orcSpearman: 3, orcWarrior: 2 },
  bastion: { minotaur: 4, minotaurArcher: 2, minotaurGuard: 1 },
  grave:   { skeleton: 4, ghoul: 3, ghost: 2 },
  roost:   { warWolf: 3 },
};
const WILDERNESS_ROAMERS: Partial<Record<MonsterKind, number>> = { wolf: 14, warWolf: 6 };

/**
 * One-time chest prizes by world (Etap 9c): the Marrow Blade's chest at the
 * bottom of the Bone Caverns, and the five Marrow-set pieces hoarded on the
 * deepest floors of the martial camps — difficulty rising with the prize.
 * main.ts reads this map in openTreasure; worlds absent here fall back to the
 * classic blade, so old saves behave exactly as before.
 */
export const CHEST_PRIZES: Readonly<Partial<Record<WorldKey, ItemKind>>> = {
  cave3: "marrowBlade",
  goblin2: "marrowBoots",   // the gentlest heist
  orcfort2: "marrowLegs",
  bastion2: "marrowShield",
  grave2: "marrowHelmet",
  roost3: "marrowArmor",    // pried from under the dragon
};

/**
 * The elite guard details posted around each Marrow chest — a tier above the
 * floor's regular roster, leashed to the hoard so they never abandon their
 * post and respawning right back beside it.
 */
const HOARD_GUARDS: Readonly<Partial<Record<WorldKey, Partial<Record<MonsterKind, number>>>>> = {
  goblin2: { warWolf: 3 },
  orcfort2: { orcBerserker: 2, orcShaman: 1 },
  bastion2: { minotaurGuard: 2, minotaurMage: 1 },
  grave2: { boneLord: 2 },
  roost3: { cyclops: 2, minotaurGuard: 1 },
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
  // The Deep Wildlands rolls from its own salted stream AFTER everything else,
  // so adding it changes not a single tile of the older islands (old saves see
  // the exact same Wildlands/caverns they were rolled on).
  seedWorldRng(seed ^ keySalt("deepwild"));
  const deepwild = makeDeepWildWorld();
  // …and every camp's lair floors, each from its own salted seed. The record
  // is completed by the loop below, hence the cast: TypeScript can't see that
  // LAIRS covers exactly the remaining WorldKey members.
  const worlds = { home, town, wild, deepwild, cave1, cave2, cave3 } as Record<WorldKey, World>;
  for (const l of LAIRS) {
    const lw = makeCaveWorld({
      key: l.key, name: l.name, w: l.w, h: l.h, seed: seed ^ keySalt(l.key),
      up: l.up, down: l.down, rocks: l.rocks, bones: l.bones, treasure: l.treasure,
    });
    // a Marrow-set chest gets a virtual "hoard" camp around it: the elite
    // guard detail spawns inside that circle, stands leashed to the chest,
    // and — via the same camp-respawn path as the villages — returns to its
    // post when slain
    const chest = lw.structures.find((st) => st.key === "treasure");
    if (chest) {
      lw.camps.push({
        key: "hoard", name: `${l.name} hoard`,
        x: chest.tx * 16 + 8, y: chest.ty * 16 + 8, r: 96,
      });
    }
    worlds[l.key] = lw;
  }
  return worlds;
}

/** Populate one dangerous world from its own deterministic RNG stream. */
export function populateWorld(w: World, seed = WORLD_SEED): void {
  // the continent populates by settlement, not by danger band
  if (w.key === "deepwild") {
    w.monsters.length = 0;
    w.respawns.length = 0;
    if (!MONSTERS_ENABLED) return;
    seedWorldRng(seed ^ keySalt(w.key));
    for (const camp of w.camps) {
      const pop = CAMP_POPULATIONS[camp.key];
      if (!pop) continue;
      for (const kind of Object.keys(pop) as MonsterKind[]) {
        for (let i = 0; i < (pop[kind] ?? 0); i++) spawnMonsterInCamp(w, kind, camp);
      }
    }
    for (const kind of Object.keys(WILDERNESS_ROAMERS) as MonsterKind[]) {
      for (let i = 0; i < (WILDERNESS_ROAMERS[kind] ?? 0); i++) spawnWilderness(w, kind);
    }
    return;
  }
  const pop = POPULATIONS[w.key as DangerKey];
  if (!pop) return;
  w.monsters.length = 0;
  w.respawns.length = 0;
  if (!MONSTERS_ENABLED) return; // peaceful mode: leave every floor empty
  seedWorldRng(seed ^ keySalt(w.key));
  for (const kind of Object.keys(pop) as MonsterKind[]) {
    for (let i = 0; i < (pop[kind] ?? 0); i++) spawnMonster(w, kind);
  }
  // the Marrow chest's elite guard detail, posted around the hoard
  const guards = HOARD_GUARDS[w.key];
  const hoard = w.camps.find((c) => c.key === "hoard");
  if (guards && hoard) {
    for (const kind of Object.keys(guards) as MonsterKind[]) {
      for (let i = 0; i < (guards[kind] ?? 0); i++) spawnMonsterInCamp(w, kind, hoard);
    }
  }
}

/** Populate the Wildlands, the caverns, the continent, and every lair floor. */
export function populateAll(worlds: Record<WorldKey, World>, seed = WORLD_SEED): void {
  for (const k of DANGER_KEYS) populateWorld(worlds[k], seed);
  populateWorld(worlds.deepwild, seed);
}

export function createGame(seed = WORLD_SEED): Game {
  const worlds = buildWorlds(seed);
  populateAll(worlds, seed);
  const player = createPlayer(portalSpawn(worlds.home));
  loadResearchState([]); // a fresh game has no research completed
  resetTasks(); // no board tasks taken yet
  resetSkills(); // module state — wipe any training from a previous session
  resetQuests(); // likewise, quest progress lives in module state
  resetOutfit(); // and the wardrobe — a fresh hero wears the classic look
  applyOutfit(player);
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
  // arriving on the Deep Wildlands: point the way to the nearest camp
  if (dest === "deepwild" && target.camps.length) {
    let best = target.camps[0];
    for (const c of target.camps) {
      if (Math.hypot(c.x - p.x, c.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y)) best = c;
    }
    extra = "  ·  " + best.name + " to the " + compass(best.x - p.x, best.y - p.y);
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
