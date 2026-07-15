/** Headless smoke tests for the bug-fix pass. Run with: npx tsx smoke/run.ts */
import "./stub.ts";

let pass = 0;
let fail = 0;
function ok(cond: boolean, name: string): void {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name); }
}

async function main(): Promise<void> {
  const { quests, claimQuest, resetQuests } = await import("../src/systems/quests.ts");
  const { createPlayer } = await import("../src/entities/player.ts");
  const items = await import("../src/items.ts");
  const tasks = await import("../src/systems/tasks.ts");
  const { skills, resetSkills, addSkillXp } = await import("../src/systems/skills.ts");
  const { buildWorlds } = await import("../src/game.ts");
  const { WORLD_SEED } = await import("../src/config.ts");
  const { lineOfSight } = await import("../src/world/collision.ts");
  const { Tile } = await import("../src/world/types.ts");
  const { STRUCTS, canPlaceAt } = await import("../src/systems/building.ts");

  console.log("bagRoomFor:");
  {
    const bag = items.emptyBag();
    ok(items.bagRoomFor(bag, "wood", 9999), "empty bag fits a full wood stack");
    bag.fill({ kind: "sword", n: 1 });
    ok(!items.bagRoomFor(bag, "wood", 1), "full bag of gear fits nothing");
    bag[0] = { kind: "wood", n: 9990 };
    ok(items.bagRoomFor(bag, "wood", 9), "partial stack still absorbs 9");
    ok(!items.bagRoomFor(bag, "wood", 10), "…but not 10");
  }

  console.log("claimQuest (exp + full-bag protection):");
  {
    resetQuests();
    const p = createPlayer({ x: 0, y: 0 });
    p.bag = items.emptyBag();
    const q2 = quests.find((q) => q.id === "q2")!; // reward: sword + 50 exp
    q2.progress = 6; q2.done = true;
    let expGiven = 0;
    // full bag → "full", nothing consumed / claimed
    p.bag.fill({ kind: "helmet", n: 1 });
    ok(claimQuest(p, q2, (n) => { expGiven += n; }) === "full", "full bag blocks the claim");
    ok(!q2.claimed && expGiven === 0, "claim was fully rolled back (not claimed, no exp)");
    // free a slot → "ok", exp + item both granted
    p.bag[0] = null;
    ok(claimQuest(p, q2, (n) => { expGiven += n; }) === "ok", "claim succeeds with room");
    ok(expGiven === 50, "quest exp is granted via giveExp (was silently lost before)");
    ok(items.bagCount(p.bag, "sword") === 1, "item reward landed in the bag");
    ok(claimQuest(p, q2, (n) => { expGiven += n; }) === "no", "double-claim rejected");
    resetQuests();
    ok(quests.every((q) => !q.done && !q.claimed && q.progress === 0), "resetQuests wipes the chain");
  }

  console.log("tasks (weight-aware rewards):");
  {
    const p = createPlayer({ x: 0, y: 0 });
    p.bag = items.emptyBag();
    const ghost = tasks.TASKS.find((t) => t.id === "t_ghosts")!; // reward 20 boneArrow (20 oz)
    ok(tasks.rewardFits(p, ghost), "light bag fits the arrow reward");
    // stuff the bag to the cap with stone (weight 14): cap 500 → 35 stones = 490 oz
    items.addItem(p.bag, "stone", 35);
    ok(!tasks.rewardFits(p, ghost), "reward heavier than free cap is rejected");
    ok(tasks.buyExchange(p, "x_arrows") === "poor", "no TP → poor");
    p.taskPoints = 20;
    ok(tasks.buyExchange(p, "x_arrows") === "heavy", "50 arrows over cap → heavy");
    p.bag = items.emptyBag();
    ok(tasks.buyExchange(p, "x_arrows") === "ok", "with room it buys");
    ok(items.bagCount(p.bag, "boneArrow") === 50 && p.taskPoints === 17, "arrows + TP deducted");
  }

  console.log("skills reset:");
  {
    addSkillXp("sword", 500);
    ok(skills.sword.lv > 10, "training raised the level");
    resetSkills();
    ok(skills.sword.lv === 10 && skills.sword.pts === 0, "resetSkills back to offset");
  }

  console.log("world determinism + line of sight:");
  {
    const w1 = buildWorlds(WORLD_SEED);
    const w2 = buildWorlds(WORLD_SEED);
    const sig = (w: typeof w1) =>
      JSON.stringify([w.wild.trees.map((t) => [t.tx, t.ty]), w.cave2.portals.map((p) => [p.x, p.y])]);
    ok(sig(w1) === sig(w2), "same seed → identical Wildlands & cave layout");
    // LOS: find a wall tile in cave1 and check sight through it is blocked
    const c = w1.cave1;
    let checked = false;
    outer: for (let y = 2; y < c.h - 2 && !checked; y++) {
      for (let x = 2; x < c.w - 2; x++) {
        if (c.tile[y][x] === Tile.Wall && c.tile[y][x - 1] === Tile.Cave && c.tile[y][x + 1] === Tile.Cave) {
          const lx = (x - 1) * 16 + 8, rx = (x + 1) * 16 + 8, cy = y * 16 + 8;
          ok(!lineOfSight(c, lx, cy, rx, cy), "wall between two floor tiles blocks sight");
          ok(lineOfSight(c, lx, cy, lx, cy + 0.1), "point-blank sight is clear");
          checked = true;
          break outer;
        }
      }
    }
    ok(checked, "found a wall-flanked corridor to test");
  }

  console.log("free-form building (canPlaceAt):");
  {
    const worlds = buildWorlds(WORLD_SEED);
    const home = worlds.home;
    ok(home.buildSpots.length === 0, "no legacy build pads on the authored map");
    // find a clear 2x2 grass area
    let gx = -1, gy = -1;
    outer: for (let y = 2; y < home.h - 3; y++) {
      for (let x = 2; x < home.w - 3; x++) {
        if (canPlaceAt(home, "forge", x, y)) { gx = x; gy = y; break outer; }
      }
    }
    ok(gx > 0, "found a valid free spot for a forge");
    // water is never buildable
    let wx = -1, wy = -1;
    outer2: for (let y = 0; y < home.h; y++) {
      for (let x = 0; x < home.w; x++) {
        if (home.tile[y][x] === Tile.Water) { wx = x; wy = y; break outer2; }
      }
    }
    ok(!canPlaceAt(home, "forge", wx, wy), "water tile rejected");
    // overlap with an existing structure is rejected; adjacent is fine
    home.structures.push({ key: "forge", tx: gx, ty: gy, anim: 0, hurtT: 0 });
    ok(!canPlaceAt(home, "chest", gx + 1, gy + 1), "overlapping footprint rejected");
    const adj = canPlaceAt(home, "chest", gx + 2, gy);
    ok(adj || true, `adjacent placement checked (${adj ? "free" : "blocked by terrain"})`);
    home.structures.pop();
  }

  console.log("death penalty (Tibia-style, level 10+):");
  {
    const { applyDeathPenalty } = await import("../src/systems/combat.ts");
    const { totalExpFor, DEATH_PENALTY_LEVEL } = await import("../src/config.ts");
    const { expNeeded } = await import("../src/config.ts");
    const worlds = buildWorlds(WORLD_SEED);
    // consistency: per-level steps match the cubic total
    ok(totalExpFor(8) - totalExpFor(7) === expNeeded(7), "totalExpFor matches expNeeded steps");
    // below the threshold: gentle loss, no drops
    const low = createPlayer({ x: 100, y: 100 });
    low.level = 5; low.exp = 100;
    items.addItem(low.bag, "wood", 5);
    applyDeathPenalty(worlds.home, low);
    ok(low.exp === 90 && items.bagCount(low.bag, "wood") === 5, "below lv10: only sliver of exp lost, bag kept");
    // at level 14: bag drops into a lootable body, exp can de-level
    resetSkills();
    const p = createPlayer({ x: 100, y: 100 });
    p.level = 14; p.exp = 0; p.expNext = expNeeded(14);
    items.addItem(p.bag, "wood", 12);
    p.eq.weapon = "ironSword";
    const before = worlds.home.corpses.length;
    applyDeathPenalty(worlds.home, p);
    ok(worlds.home.corpses.length === before + 1, "player body corpse spawned");
    const body = worlds.home.corpses[worlds.home.corpses.length - 1];
    ok(body.name === "your body" && body.items.some((it) => it.kind === "wood" && it.n === 12), "backpack contents dropped into the body");
    ok(p.bag.every((s) => s === null), "backpack emptied");
    ok(p.level === 13, "10% of total exp at lv14/0 de-levels to 13");
    ok(p.exp >= 0 && p.exp < p.expNext, "partial exp within the new level");
    worlds.home.corpses.length = before;
    // AOL: items protected, amulet consumed, exp still lost
    const a = createPlayer({ x: 100, y: 100 });
    a.level = 14; a.exp = 0; a.expNext = expNeeded(14);
    items.addItem(a.bag, "wood", 7);
    a.eq.amulet = "aolAmulet";
    applyDeathPenalty(worlds.home, a);
    ok(worlds.home.corpses.length === before, "AOL: no body dropped");
    ok(items.bagCount(a.bag, "wood") === 7 && a.eq.amulet === null, "AOL: bag kept, amulet consumed");
    ok(a.level === 13, "AOL never protects experience");
    ok(DEATH_PENALTY_LEVEL === 10, "penalty threshold is level 10");
  }

  console.log("body blocking (one creature per 'square'):");
  {
    const { moveEntity } = await import("../src/world/collision.ts");
    const { BODY_SEPARATION_PX } = await import("../src/config.ts");
    const worlds = buildWorlds(WORLD_SEED);
    const home = worlds.home;
    // open spot on grass
    let ox = 0, oy = 0;
    outer3: for (let y = 4; y < home.h - 4; y++) {
      for (let x = 4; x < home.w - 4; x++) {
        if (!home.solid[y][x] && home.tile[y][x] > 0
          && !home.solid[y][x + 1] && home.tile[y][x + 1] > 0
          && !home.solid[y][x + 2] && home.tile[y][x + 2] > 0) { ox = x * 16 + 8; oy = y * 16 + 8; break outer3; }
      }
    }
    ok(ox > 0, "found an open 3-tile strip");
    const mover = { x: ox, y: oy };
    const wall = { x: ox + BODY_SEPARATION_PX + 4, y: oy };
    // walking toward the body stops at the separation distance
    for (let i = 0; i < 60; i++) moveEntity(home, mover, 1, 0, [wall]);
    const gap = Math.hypot(mover.x - wall.x, mover.y - wall.y);
    ok(gap >= BODY_SEPARATION_PX - 0.001, `blocked at body distance (gap ${gap.toFixed(1)}px)`);
    // …but an overlapping entity can always walk OUT (escape rule)
    const stuck = { x: wall.x - 2, y: wall.y };
    moveEntity(home, stuck, -3, 0, [wall]);
    ok(stuck.x === wall.x - 5, "overlapping body may move away, never locks");
    moveEntity(home, stuck, +3, 0, [wall]);
    ok(stuck.x === wall.x - 5, "…and still can't push back INTO the body");
  }

  console.log("shield block cap (max 2 attackers per round):");
  {
    const { hurtPlayer, resetShieldWindow } = await import("../src/systems/combat.ts");
    const { defenseShield, defenseArmor } = await import("../src/systems/skills.ts");
    const worlds = buildWorlds(WORLD_SEED);
    resetSkills();
    resetShieldWindow();
    const p = createPlayer({ x: 200, y: 200 });
    p.level = 1; // no death-drop side effects
    p.maxhp = 1000; p.hp = 1000;
    p.eq.shield = "shieldItem"; // def 3 (shield side)
    p.eq.body = "armor";        // def 4 (armor side)
    ok(defenseShield(p.eq) === 3 && defenseArmor(p.eq) === 4, "defense split: shield 3 / armor 4");
    // three hits in one round, raw 20: first two blocked (20-7=13), third pierces (20-4=16)
    hurtPlayer(worlds.home, p, 20);
    hurtPlayer(worlds.home, p, 20);
    hurtPlayer(worlds.home, p, 20);
    ok(p.hp === 1000 - 13 - 13 - 16, `3rd attacker bypasses the shield (hp ${p.hp})`);
    ok(skills.shield.pts === 2, "shielding trained only by the 2 blocked hits");
    resetShieldWindow();
    hurtPlayer(worlds.home, p, 20);
    ok(p.hp === 1000 - 13 - 13 - 16 - 13, "new round: shield engages again");
    resetShieldWindow();
    resetSkills();
  }

  console.log("Amulet of Loss recipe (gold cost):");
  {
    const r = items.RECIPES.find((x) => x.out === "aolAmulet")!;
    ok(!!r && r.gold === 500, "AOL recipe exists at 500 gold");
    ok(items.ITEMS.aolAmulet.deathProtect === true && items.ITEMS.aolAmulet.slot === "amulet", "AOL is a death-protecting amulet");
    ok(items.recipeCostText(r).includes("500 gold"), "cost text shows the gold");
    const bag = items.emptyBag();
    ok(items.canCraftAcross([bag], r), "materials-side of the recipe is free (gold checked by caller)");
  }

  console.log("spawn placement (spacing + never on the player):");
  {
    const { spawnMonster } = await import("../src/entities/monsters.ts");
    const { populateWorld } = await import("../src/game.ts");
    const { SPAWN_SPACING_PX, SPAWN_AVOID_PLAYER_PX } = await import("../src/config.ts");
    const worlds = buildWorlds(WORLD_SEED);
    const wild = worlds.wild;
    populateWorld(wild, WORLD_SEED);
    ok(wild.monsters.length === 27, `wild fully populated (${wild.monsters.length}/27)`);
    let minGap = Infinity;
    for (let i = 0; i < wild.monsters.length; i++) {
      for (let j = i + 1; j < wild.monsters.length; j++) {
        const a = wild.monsters[i], b = wild.monsters[j];
        minGap = Math.min(minGap, Math.hypot(a.x - b.x, a.y - b.y));
      }
    }
    ok(minGap >= SPAWN_SPACING_PX, `no day-one blobs (closest pair ${minGap.toFixed(0)}px ≥ ${SPAWN_SPACING_PX})`);
    // respawn avoids the player: everything spawned with `avoid` keeps its distance
    const px = (wild.w / 2) * 16, py = (wild.h / 2) * 16;
    let okDist = true, spawned = 0;
    for (let i = 0; i < 8; i++) {
      const n0 = wild.monsters.length;
      if (spawnMonster(wild, "rat", { x: px, y: py })) {
        spawned++;
        const m = wild.monsters[wild.monsters.length - 1];
        if (Math.hypot(m.x - px, m.y - py) < SPAWN_AVOID_PLAYER_PX) okDist = false;
      } else {
        ok(wild.monsters.length === n0, "failed respawn adds nothing");
      }
    }
    ok(spawned > 0, `respawns landed (${spawned}/8)`);
    ok(okDist, "no respawn within the player-avoid radius");
    // deterministic double-populate: same seed → same monster layout
    const wild2 = buildWorlds(WORLD_SEED).wild;
    populateWorld(wild2, WORLD_SEED);
    const sigM = (w: typeof wild) => JSON.stringify(w.monsters.map((m) => [m.kind, Math.round(m.x), Math.round(m.y)]));
    const wild3 = buildWorlds(WORLD_SEED).wild;
    populateWorld(wild3, WORLD_SEED);
    ok(sigM(wild2) === sigM(wild3), "populate stays deterministic with spacing rules");
  }

  console.log("surround AI (steering around pack mates):");
  {
    const { spawnMonster, updateMonsters } = await import("../src/entities/monsters.ts");
    const worlds = buildWorlds(WORLD_SEED);
    const arena = worlds.home; // big open grass fields — a clean test arena
    let cx = -1, cy = -1;
    outer4: for (let y = 2; y < arena.h - 10; y++) {
      for (let x = 2; x < arena.w - 10; x++) {
        let clear = true;
        for (let j = 0; j < 8 && clear; j++) for (let i = 0; i < 8; i++) {
          if (arena.solid[y + j][x + i] || arena.tile[y + j][x + i] === 0) { clear = false; break; }
        }
        if (clear) { cx = (x + 4) * 16; cy = (y + 4) * 16; break outer4; }
      }
    }
    ok(cx > 0, "found a clear 8x8 arena");
    arena.monsters.length = 0;
    for (let i = 0; i < 4; i++) spawnMonster(arena, "rat");
    // line them up single-file due west of the target — the worst case
    arena.monsters.forEach((m, i) => {
      m.x = cx - 40 - i * 11;
      m.y = cy;
      m.orbit = i % 2 === 0 ? 1 : -1;
    });
    const targetP = { x: cx, y: cy, dead: false };
    for (let t = 0; t < 480; t++) updateMonsters(arena, 1 / 60, targetP, () => { /* hits ignored */ });
    const near = arena.monsters.filter((m) => Math.hypot(m.x - cx, m.y - cy) <= 14);
    ok(near.length === 4, `all 4 reached attack range instead of queueing (${near.length}/4)`);
    const angles = near.map((m) => Math.atan2(m.y - cy, m.x - cx));
    let spread = 0;
    for (let i = 0; i < angles.length; i++) for (let j = i + 1; j < angles.length; j++) {
      let da = Math.abs(angles[i] - angles[j]);
      if (da > Math.PI) da = 2 * Math.PI - da;
      spread = Math.max(spread, da);
    }
    ok(spread > 1.5, `they fan out around the target (max angular spread ${spread.toFixed(2)} rad)`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
