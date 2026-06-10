/** Global game state: the two islands, which one is active, and the player. */
import { makeWorld } from "./world/generate.ts";
import { portalSpawn } from "./world/collision.ts";
import { spawnMonster } from "./entities/monsters.ts";
import { createPlayer } from "./entities/player.ts";
import { beep } from "./audio.ts";
import type { World } from "./world/types.ts";
import type { Player } from "./entities/player.ts";

export interface Game {
  home: World;
  wild: World;
  /** The world the player is currently standing in. */
  current: World;
  player: Player;
  /** Brief on-screen zone label after a transition. */
  zoneFlash: { text: string; t: number };
  /** White flash alpha right after teleporting. */
  tpFlash: number;
}

export function createGame(): Game {
  const home = makeWorld({
    name: "Home Isle", safe: true, buildSpots: true,
    trees: 5, rocks: 4, mushrooms: 6, bones: 3,
  });
  const wild = makeWorld({
    name: "Wild Isle", safe: false, buildSpots: false,
    trees: 6, rocks: 6, mushrooms: 3, bones: 7, grassShift: -14,
  });

  // monsters live only on the Wild Isle
  for (let i = 0; i < 4; i++) spawnMonster(wild, "skeleton");
  for (let i = 0; i < 3; i++) spawnMonster(wild, "goblin");

  const player = createPlayer(portalSpawn(home));

  return {
    home,
    wild,
    current: home,
    player,
    zoneFlash: { text: "Home Isle  (safe)", t: 2.2 },
    tpFlash: 0,
  };
}

/** Teleport the player to the other island via the portal. */
export function switchWorld(g: Game): void {
  g.current = g.current === g.home ? g.wild : g.home;
  const p = portalSpawn(g.current);
  g.player.x = p.x;
  g.player.y = p.y;
  g.player.dest = null;
  g.player.target = null;
  g.player.gather = null;
  g.player.tpCd = 1.8;
  g.tpFlash = 1;
  g.zoneFlash = { text: g.current.name + (g.current.safe ? "  (safe)" : ""), t: 2.2 };
  beep(520, 0.25, "sine", 0.07, 420);
}

/** Send the player home alive (used on respawn after death). */
export function respawnAtHome(g: Game): void {
  g.current = g.home;
  const p = portalSpawn(g.home);
  g.player.x = p.x;
  g.player.y = p.y;
  g.player.hp = g.player.maxhp;
  g.player.dead = false;
  g.zoneFlash = { text: "Home Isle  (safe)", t: 2 };
}
