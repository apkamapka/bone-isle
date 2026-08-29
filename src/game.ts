/** Global game state: the three islands, the active one, and the player. */
import { DEADDEEP2_SPEC } from "./world/deadDeep2Spec.ts";
import { DEADDEEP_SPEC } from "./world/deadDeepSpec.ts";
import { MINODEEP_SPEC } from "./world/minoDeepSpec.ts";
import { MINODEEP2_SPEC } from "./world/minoDeep2Spec.ts";
import { ORCDEEP_SPEC } from "./world/orcDeepSpec.ts";
import { ORCDEEP2_SPEC } from "./world/orcDeep2Spec.ts";
import { BANDITDEEP2_SPEC } from "./world/banditDeep2Spec.ts";
import { BANDITDEEP3_SPEC } from "./world/banditDeep3Spec.ts";
import { BANDITDEEP_SPEC } from "./world/banditDeepSpec.ts";
import { LIDDESDALE_SPEC } from "./world/liddesdaleSpec.ts";
import { HERMITAGE_SPEC } from "./world/hermitageSpec.ts";
import { BANDIT_SPEC } from "./world/banditSpec.ts";
import { REACH_SPEC } from "./world/reachSpec.ts";
import { placeWalker } from "./world/grid.ts";
import { makeHandmadeWorld, HOME_SPEC, TOWN_SPEC, CELLAR_SPEC } from "./world/handmade.ts";
import { loadTerrainImages } from "./world/terrainImage.ts";
import { missionByGround, missionByEcho, groundOpen, echoOpen, relicRoadOpen } from "./systems/missions.ts";
import { loadPropArt } from "./world/propArt.ts";
import { loadMobSheets } from "./gfx/mobSheet.ts";
import { loadFireSheet } from "./gfx/fireSheet.ts";
import { loadSceneryArt } from "./gfx/sceneryArt.ts";
import { loadBuildingArt } from "./gfx/buildingArt.ts";
import { loadControlIcons } from "./ui/icons.ts";
import { loadSpellArt } from "./gfx/spellArt.ts";
import { loadItemArt } from "./gfx/itemArt.ts";
import { portalSpawn, worldSpawn } from "./world/collision.ts";
import { spawnAtPost } from "./entities/monsters.ts";
import { createPlayer } from "./entities/player.ts";
import { clearMonsterSpells } from "./systems/monsterSpells.ts";
import type { ItemKind } from "./items.ts";
import { applyOutfit } from "./systems/outfit.ts";
import { resetPlayerState } from "./systems/playerState.ts";
import { stampWorlds } from "./world/entities.ts";
import { emptyStash } from "./items.ts";
import { beep } from "./audio.ts";
import { WORLD_SEED, MONSTERS_ENABLED } from "./config.ts";
import type { Portal, World, WorldKey } from "./world/types.ts";
import type { Player } from "./entities/player.ts";
import type { Bag } from "./items.ts";

/**
 * Every Storage Chest's inventory on Home Isle, backpack-excluded. Crafting,
 * research and building costs draw from the backpack plus ALL of these — the
 * chests are independent containers, but your resources are still your
 * resources wherever you banked them (Etap 11).
 */
export function homeChests(g: Game): Bag[] {
  const out: Bag[] = [];
  for (const s of g.worlds.home.structures) {
    if (s.key === "chest") out.push((s.inv ??= emptyStash()));
  }
  return out;
}

export interface Game {
  seed: number;
  worlds: Record<WorldKey, World>;
  /** The world the player is currently standing in. */
  current: World;
  player: Player;
  zoneFlash: { text: string; t: number };
  tpFlash: number;
  /** IDs of one-time treasure chests already opened (persisted in the save). */
  opened: string[];
}

/* ------------------------------------------------------------------ *
 *  WHERE THE POPULATION TABLES WENT (Etap 40)
 *
 *  `POPULATIONS`, `CAMP_POPULATIONS`, `WILDERNESS_ROAMERS`, `HOARD_GUARDS`
 *  and `TEST_POSTS` all lived here, and all five are gone. They scattered a
 *  roster across a procedurally rolled floor by distance from its entrance —
 *  a good answer for a map nobody had drawn, and the wrong one for a map
 *  somebody had. Every world that survives is hand-authored: its creatures
 *  are glyphs on the grid, at the spacing its author chose, and they respawn
 *  onto the very tile they were drawn on.
 *
 *  So there is nothing left to tune here. Crowd pressure is now a property of
 *  the map file, which is where it was always going to end up once the maps
 *  were being drawn rather than generated. To make a floor harder, add
 *  creatures to its spec.
 * ------------------------------------------------------------------ */

/**
 * One-time chest prizes by world. An entry is either a kind — one of it — or a
 * kind and a count, because the minotaur branch's hoard pays part of its worth
 * in coin and ten separate `platinumCoin` entries would have read as ten
 * separate finds in the message the chest flashes.
 *
 * Etap 40 took two entries with it. `cave3` held the Marrow Blade and
 * `bastion2` the Knight shield, and both maps are gone — the shield still
 * drops from the Black Knight at 5%, but THE MARROW BLADE NOW HAS NO SOURCE
 * AT ALL. It is left in the item table on purpose: the sword exists, it is
 * simply not findable until a mission map buries it again.
 *
 * The 80x80 redraw took the other two. Neither `minodeep1` nor `orcdeep1`
 * buries anything now; each branch has ONE hoard and it sits at the bottom of
 * its -2, where the drawings mark it — the minotaur shield under the horns,
 * the orcish shield under the orcs, ten platinum with each.
 *
 * SO NO CHEST IN THE GAME HOLDS KNIGHT GEAR ANY MORE. All four pieces stay in
 * the item table and all four still drop from the Black Knight at 5% apiece,
 * which was always meant to be the repeatable source; what is gone is the
 * one-off that handed a level-25 character half the set for a walk. If that
 * turns out to be too steep a cut, this table is where it is put back.
 *
 * Worlds absent here fall back to the blade in `openTreasure`, which is a
 * fallback nothing reaches — every chest in the game is listed.
 */
export type ChestPrize = ItemKind | readonly [ItemKind, number];

export const CHEST_PRIZES: Readonly<Partial<Record<WorldKey, readonly ChestPrize[]>>> = {
  minodeep2: ["minotaurShield", ["platinumCoin", 10]],
  orcdeep2: ["orcishShield", ["platinumCoin", 10]],
  // The redcap's hoard: everything he ever took off the road, in one pile.
  // Thirty platinum is three thousand gold and it is the biggest single prize
  // in the game, which is exactly why it lives HERE and not in his loot table
  // — `game.opened` gives it out once per character, and a respawning boss
  // would have given it out forever.
  hermitage: [["platinumCoin", 30]],
};

/**
 * Build every map. One hand-authored spec per world, parsed from its glyph
 * grid — no seed, no RNG, no procedural terrain anywhere in the game since
 * Etap 40. The count is deliberately not written down here: it moves every
 * time an island lands, and a number in a comment that nothing checks is a
 * number that goes stale. `WorldKey` is the list.
 *
 * `seed` is kept in the signature and on `Game` because the save carries it
 * and because a shard will want one, but nothing in here reads it any more:
 * two players on the same world now stand on byte-identical maps by
 * construction rather than by agreeing on a number.
 */
export function buildWorlds(_seed: number): Record<WorldKey, World> {
  const worlds: Record<WorldKey, World> = {
    home: makeHandmadeWorld(HOME_SPEC),
    town: makeHandmadeWorld(TOWN_SPEC),
    cellar: makeHandmadeWorld(CELLAR_SPEC),
    bandit: makeHandmadeWorld(BANDIT_SPEC),
    banditdeep1: makeHandmadeWorld(BANDITDEEP_SPEC),
    banditdeep2: makeHandmadeWorld(BANDITDEEP2_SPEC),
    banditdeep3: makeHandmadeWorld(BANDITDEEP3_SPEC),
    reach: makeHandmadeWorld(REACH_SPEC),
    orcdeep1: makeHandmadeWorld(ORCDEEP_SPEC),
    orcdeep2: makeHandmadeWorld(ORCDEEP2_SPEC),
    minodeep1: makeHandmadeWorld(MINODEEP_SPEC),
    minodeep2: makeHandmadeWorld(MINODEEP2_SPEC),
    deaddeep1: makeHandmadeWorld(DEADDEEP_SPEC),
    deaddeep2: makeHandmadeWorld(DEADDEEP2_SPEC),
    liddesdale: makeHandmadeWorld(LIDDESDALE_SPEC),
    hermitage: makeHandmadeWorld(HERMITAGE_SPEC),
  };
  loadTerrainImages(worlds); // async; the baked terrain shows until it lands
  loadPropArt(worlds);       // likewise for trees, rocks, stumps and rubble
  loadMobSheets();           // directional walk cycles for humanoid creatures
  loadFireSheet();           // the campfire flicker
  loadSceneryArt();          // totems and dead trees the player walks behind
  loadBuildingArt();         // the forge, the tower and the posts, one image per tier
  loadControlIcons();        // the five sidebar buttons, 16x16 each
  loadItemArt();             // drawn icons over the baked stand-ins
  loadSpellArt();            // bolts and blooms, one strip per element and tier
  return worlds;
}

/**
 * Populate one map from the creature posts its author drew on it.
 *
 * That is the whole function now. Etap 40 removed the other two paths — the
 * radial danger band and the Deep Wildlands settlement scatter — along with
 * the maps that needed them, and with them went the crowd multiplier, the
 * density top-up and the chest-guard dragon. A hand-drawn floor gets exactly
 * the creatures on exactly the squares its spec names.
 *
 * A safe map has no posts and simply comes out empty, so this is safe to call
 * on every world without checking which.
 */
export function populateWorld(w: World): void {
  if (!w.mobPosts?.length) return;
  w.monsters.length = 0;
  w.respawns.length = 0;
  if (!MONSTERS_ENABLED) return; // peaceful mode: leave every floor empty
  for (const post of w.mobPosts) spawnAtPost(w, post.kind, post.tx, post.ty);
}

/** Populate every map that carries authored creature posts. */
export function populateAll(worlds: Record<WorldKey, World>): void {
  for (const k of Object.keys(worlds) as WorldKey[]) populateWorld(worlds[k]);
}

export function createGame(seed = WORLD_SEED): Game {
  const worlds = buildWorlds(seed);
  populateAll(worlds);
  // Creatures are stamped by pushMonster and structures by their placers; this
  // catches anything a hand-authored spec dropped in directly. Idempotent.
  stampWorlds(worlds);
  // ONE call wipes the lot now (Etap 31): skills, quests, board tasks,
  // wardrobe, research, attunement, stance and every combat clock live
  // together on the character's PlayerState, so a fresh game is a fresh
  // state object rather than seven separate resets that could drift apart.
  resetPlayerState();
  const player = createPlayer(worldSpawn(worlds.home));
  applyOutfit(player);
  return {
    seed,
    worlds,
    current: worlds.home,
    player,
    zoneFlash: { text: "Home Isle  (safe)", t: 2.2 },
    tpFlash: 0,
    opened: [],
  };
}

/** Teleport the player through a portal to `dest`. */
/**
 * Seal or open every level gate in `w` against the player's level. A gate is
 * simply a solid tile while locked, so grid movement, pathfinding and monster
 * AI all respect it with zero special cases. Called every frame for the
 * current world (a handful of gates — negligible) so a mid-session level-up
 * swings the portcullis open the moment the fanfare plays.
 */
export function applyGates(w: World, level: number): void {
  for (const gt of w.gates) w.solid[gt.ty][gt.tx] = level < gt.lv;
}

/**
 * Light or darken every mission door, everywhere, against the chain's state.
 *
 * The sibling of `applyGates` and called from the same place for the same
 * reason: a pad's state is a FUNCTION of the character, not a property of the
 * map, so it is recomputed rather than remembered. Two rules, and they are
 * different on purpose:
 *
 *   a pad onto a hunting GROUND  — lit from the moment the sage hands the
 *       mission over, and lit forever after. The ground is yours.
 *   a mouth into an ECHO         — lit only while the boss is still standing.
 *       It shuts on the KILL, which is what makes the fight one-time and the
 *       hoard behind him a one-time hoard.
 *   a pad OUT of an echo         — the relic road, dark until that same kill
 *       and lit by it. The door in closes as the door out opens.
 *
 * A portal pointing at a world no mission claims is left exactly as authored,
 * so every pad that existed before missions did still behaves as it did.
 */
export function applyMissionPads(worlds: Record<WorldKey, World>, level: number): void {
  for (const w of Object.values(worlds)) {
    // A pad standing INSIDE an echo and pointing at the sage's room is the
    // relic road: the way home that opens where the boss fell. Checked first,
    // because it is identified by the room it stands in rather than by where
    // it goes, and `cellar` is a destination half the game points at.
    const echoHere = missionByEcho(w.key);
    for (const pt of w.portals) {
      if (echoHere && pt.dest === "cellar") pt.inactive = !relicRoadOpen(w.key, level);
      else if (missionByGround(pt.dest)) pt.inactive = !groundOpen(pt.dest, level);
      else if (missionByEcho(pt.dest)) pt.inactive = !echoOpen(pt.dest, level);
    }
  }
}

export function travelTo(g: Game, dest: WorldKey): void {
  const target = g.worlds[dest];
  // Spawn beside the return portal that points back to where we came from — and
  // where there is more than one of those, the NEAREST one. A floor reached by
  // a single staircase has exactly one candidate and behaves as it always did.
  // Bandit Deep -1 has six ladders, all back to the same island and all on the
  // same tile coordinates as the six holes above them, so "nearest to where the
  // player is standing" is precisely "the ladder under the hole he jumped down".
  // Taking the first in the list would land every descent on the north-eastern
  // ladder and make five of the six holes lie about where they lead.
  const backs = target.portals.filter((pt) => pt.dest === g.current.key);
  const back = backs.reduce<Portal | undefined>((best, pt) => (
    best === undefined
      || Math.hypot(pt.x - g.player.x, pt.y - g.player.y)
       < Math.hypot(best.x - g.player.x, best.y - g.player.y) ? pt : best
  ), undefined) ?? target.portals[0];
  const p = portalSpawn(target, back);
  // The two arrival hints — "cave mouth to the north-west" on the Wildlands and
  // "orc fort to the east" on the Deep Wildlands — went with those maps in
  // Etap 40, and the `compass()` helper that phrased them went too. Both
  // existed because a procedural island gives you no landmark to steer by; a
  // drawn one does. The zone banner below still has room for a suffix if a
  // mission map ever wants to point at something.
  const extra = "";
  // Every creature's committed cast belongs to the island it was cast on.
  // Leaving mid-windup and coming back to a fireball resolving in your face is
  // the same class of bug the FX module already guards against by world.
  clearMonsterSpells();
  g.current = target;
  placeWalker(g.player, p.x, p.y);
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
  const p = worldSpawn(g.worlds.home);
  placeWalker(g.player, p.x, p.y);
  g.player.hp = g.player.maxhp;
  g.player.dead = false;
  g.zoneFlash = { text: "Home Isle  (safe)", t: 2 };
}
