/** Resource gathering: chop trees for wood, mine rocks for stone. */
import { TREE_REGROW_S, ROCK_REGROW_S, TILE } from "../config.ts";
import { dist } from "../util.ts";
import { beep } from "../audio.ts";
import { addFloat } from "../fx.ts";
import type { Player, GatherTask } from "../entities/player.ts";
import type { World } from "../world/types.ts";

/** Perform one chop/mine tick on the player's current gather target. */
export function gatherTick(world: World, p: Player, g: GatherTask): void {
  p.atkCd = p.atkRate;
  if (g.kind === "tree") {
    const tr = g.obj;
    tr.hp--;
    tr.hurtT = 0.15;
    p.inv.wood++;
    addFloat(world, tr.tx * TILE + TILE / 2, tr.ty * TILE - 8, "+1 wood", "#b9e07f");
    beep(300, 0.06, "triangle", 0.06);
    if (tr.hp <= 0) {
      p.inv.wood += 2;
      addFloat(world, tr.tx * TILE + TILE / 2, tr.ty * TILE - 2, "+2 wood", "#b9e07f");
      tr.stump = true;
      tr.respawnT = TREE_REGROW_S;
      world.solid[tr.ty][tr.tx] = false;
      p.gather = null;
    }
  } else {
    const rk = g.obj;
    rk.hp--;
    rk.hurtT = 0.15;
    p.inv.stone++;
    addFloat(world, rk.tx * TILE + TILE / 2, rk.ty * TILE - 2, "+1 stone", "#c8d3d8");
    beep(180, 0.06, "square", 0.05);
    if (rk.hp <= 0) {
      p.inv.stone += 2;
      addFloat(world, rk.tx * TILE + TILE / 2, rk.ty * TILE + 4, "+2 stone", "#c8d3d8");
      rk.depleted = true;
      rk.respawnT = ROCK_REGROW_S;
      world.solid[rk.ty][rk.tx] = false;
      p.gather = null;
    }
  }
}

/**
 * Tick regrowth for trees/rocks in a world. A node won't pop back while the
 * player is standing on its tile (avoids trapping them inside a solid).
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
}
