/** Resource gathering: chop trees, mine rocks, pick herbs. */
import { TREE_REGROW_S, ROCK_REGROW_S, HERB_REGROW_S, TILE } from "../config.ts";
import { dist } from "../util.ts";
import { beep } from "../audio.ts";
import { addFloat } from "../fx.ts";
import { addItem } from "../items.ts";
import { canCarry } from "../entities/player.ts";
import { onItemCollected, syncCollectQuests } from "./quests.ts";
import type { Player, GatherTask } from "../entities/player.ts";
import type { ItemKind } from "../items.ts";
import type { World } from "../world/types.ts";

/** A float callback for quest-completion popups. */
export type GatherFx = (text: string) => void;

/** Perform one chop/mine/pick tick on the player's current gather target. */
export function gatherTick(world: World, p: Player, g: GatherTask, fx?: GatherFx): void {
  p.atkCd = p.atkRate;
  // Stop if the backpack is too full to hold what this node yields.
  const yields: Record<GatherTask["kind"], ItemKind> = { tree: "wood", rock: "stone", herb: "herb" };
  if (!canCarry(p, yields[g.kind])) {
    addFloat(world, p.x, p.y - 26, "too heavy!", "#ff9a5e");
    p.gather = null;
    return;
  }
  if (g.kind === "tree") {
    const tr = g.obj;
    tr.hp--;
    tr.hurtT = 0.15;
    addItem(p.bag, "wood", 1);
    onItemCollected("wood", 1);
    addFloat(world, tr.tx * TILE + TILE / 2, tr.ty * TILE - 8, "+1 wood", "#b9e07f");
    beep(300, 0.06, "triangle", 0.06);
    if (tr.hp <= 0) {
      addItem(p.bag, "wood", 2);
      onItemCollected("wood", 2);
      addFloat(world, tr.tx * TILE + TILE / 2, tr.ty * TILE - 2, "+2 wood", "#b9e07f");
      tr.stump = true;
      tr.respawnT = TREE_REGROW_S;
      world.solid[tr.ty][tr.tx] = false;
      p.gather = null;
    }
    syncCollectQuests(p, fx);
  } else if (g.kind === "rock") {
    const rk = g.obj;
    rk.hp--;
    rk.hurtT = 0.15;
    addItem(p.bag, "stone", 1);
    onItemCollected("stone", 1);
    addFloat(world, rk.tx * TILE + TILE / 2, rk.ty * TILE - 2, "+1 stone", "#c8d3d8");
    beep(180, 0.06, "square", 0.05);
    if (rk.hp <= 0) {
      addItem(p.bag, "stone", 2);
      onItemCollected("stone", 2);
      addFloat(world, rk.tx * TILE + TILE / 2, rk.ty * TILE + 4, "+2 stone", "#c8d3d8");
      rk.depleted = true;
      rk.respawnT = ROCK_REGROW_S;
      world.solid[rk.ty][rk.tx] = false;
      p.gather = null;
    }
    syncCollectQuests(p, fx);
  } else {
    const hb = g.obj;
    addItem(p.bag, "herb", 1);
    onItemCollected("herb", 1);
    addFloat(world, hb.tx * TILE + TILE / 2, hb.ty * TILE - 4, "+1 herb", "#9fe08a");
    beep(360, 0.06, "sine", 0.05);
    hb.picked = true;
    hb.respawnT = HERB_REGROW_S;
    p.gather = null;
    syncCollectQuests(p, fx);
  }
}

/**
 * Tick regrowth for trees/rocks/herbs. A node won't pop back while the player
 * stands on its tile (avoids trapping them inside a solid).
 */
export function tickRegrowth(world: World, dt: number, px: number, py: number, playerHere: boolean): void {
  for (const tr of world.trees) {
    if (!tr.stump) continue;
    tr.respawnT -= dt;
    if (tr.respawnT <= 0 && !(playerHere && dist(px, py, tr.tx * TILE + 8, tr.ty * TILE + 8) < 18)) {
      tr.stump = false;
      tr.hp = tr.maxhp;
      world.solid[tr.ty][tr.tx] = true;
    }
  }
  for (const rk of world.rocks) {
    if (!rk.depleted) continue;
    rk.respawnT -= dt;
    if (rk.respawnT <= 0 && !(playerHere && dist(px, py, rk.tx * TILE + 8, rk.ty * TILE + 8) < 18)) {
      rk.depleted = false;
      rk.hp = rk.maxhp;
      world.solid[rk.ty][rk.tx] = true;
    }
  }
  for (const hb of world.herbs) {
    if (!hb.picked) continue;
    hb.respawnT -= dt;
    if (hb.respawnT <= 0) hb.picked = false;
  }
}
