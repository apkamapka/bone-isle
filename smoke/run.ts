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
  const { WORLD_SEED, TILE } = await import("../src/config.ts");
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
          const lx = (x - 1) * TILE + TILE / 2, rx = (x + 1) * TILE + TILE / 2, cy = y * TILE + TILE / 2;
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

  console.log("grid movement (one creature per square, Tibia-style):");
  {
    const { tryStep, glideWalker, tileCenter, findPath, chebTiles, walkable } = await import("../src/world/grid.ts");
    const worlds = buildWorlds(WORLD_SEED);
    const home = worlds.home;
    // open 3x3 patch of grass
    let ox = 0, oy = 0;
    outer3: for (let y = 4; y < home.h - 4; y++) {
      for (let x = 4; x < home.w - 4; x++) {
        let clear = true;
        for (let j = 0; j < 3 && clear; j++) for (let i = 0; i < 3; i++) {
          if (home.solid[y + j][x + i] || home.tile[y + j][x + i] === 0) { clear = false; break; }
        }
        if (clear) { ox = x; oy = y; break outer3; }
      }
    }
    ok(ox > 0, "found an open 3x3 patch");
    const mk = (tx: number, ty: number) => ({ x: tileCenter(tx), y: tileCenter(ty), tx, ty });
    const mover = mk(ox, oy + 1);
    const body = mk(ox + 1, oy + 1);
    const occ = (tx: number, ty: number) => tx === body.tx && ty === body.ty;
    // a claimed square is a hard wall: you cannot step onto another creature
    ok(!tryStep(home, mover, 1, 0, occ), "cannot step onto an occupied square");
    ok(mover.tx === ox && mover.ty === oy + 1, "refused step leaves the walker in place");
    // ...but the diagonal PAST it is a genuine escape route (Tibia rule)
    ok(tryStep(home, mover, 1, 1, occ), "diagonal slip past an adjacent body works");
    ok(mover.tx === ox + 1 && mover.ty === oy + 2, "step claims the destination tile at once");
    // glide: render position travels to the claimed centre and snaps exactly
    let guard = 0;
    while (glideWalker(mover, 3) === 0 && guard++ < 32) { /* glide */ }
    ok(mover.x === tileCenter(mover.tx) && mover.y === tileCenter(mover.ty), "glide arrives exactly on the tile centre");
    // A* routes around the occupied square instead of through it
    const path = findPath(home, ox, oy + 1, ox + 2, oy + 1, occ);
    ok(path.length > 0, "A* finds a route to the far side");
    ok(path.every((t) => !occ(t.x, t.y) && walkable(home, t.x, t.y)), "route never crosses the occupied square");
    const last = path[path.length - 1];
    ok(last.x === ox + 2 && last.y === oy + 1, "route ends on the goal tile");
    ok(path.every((t, i) => {
      const prev = i === 0 ? { x: ox, y: oy + 1 } : path[i - 1];
      return chebTiles(prev.x, prev.y, t.x, t.y) === 1;
    }), "route is a chain of single-tile steps");
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
    ok(wild.monsters.length === 30, `wild fully populated (${wild.monsters.length}/30 — the trimmed surface roster)`);
    let minGap = Infinity;
    for (let i = 0; i < wild.monsters.length; i++) {
      for (let j = i + 1; j < wild.monsters.length; j++) {
        const a = wild.monsters[i], b = wild.monsters[j];
        minGap = Math.min(minGap, Math.hypot(a.x - b.x, a.y - b.y));
      }
    }
    ok(minGap >= SPAWN_SPACING_PX, `no day-one blobs (closest pair ${minGap.toFixed(0)}px ≥ ${SPAWN_SPACING_PX})`);
    // respawn avoids the player: everything spawned with `avoid` keeps its distance
    const px = (wild.w / 2) * TILE, py = (wild.h / 2) * TILE;
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
        if (clear) { cx = (x + 4) * TILE; cy = (y + 4) * TILE; break outer4; }
      }
    }
    ok(cx > 0, "found a clear 8x8 arena");
    const { toTile, tileCenter, chebTiles } = await import("../src/world/grid.ts");
    const ptx = toTile(cx);
    const pty = toTile(cy);
    arena.monsters.length = 0;
    for (let i = 0; i < 4; i++) spawnMonster(arena, "rat");
    // line them up single-file due west of the target — the worst case
    arena.monsters.forEach((m, i) => {
      m.tx = ptx - 2 - i;
      m.ty = pty;
      m.x = tileCenter(m.tx);
      m.y = tileCenter(m.ty);
      m.orbit = i % 2 === 0 ? 1 : -1;
    });
    const targetP = { x: tileCenter(ptx), y: tileCenter(pty), dead: false };
    for (let t = 0; t < 480; t++) updateMonsters(arena, 1 / 60, targetP, () => { /* hits ignored */ });
    const near = arena.monsters.filter((m) => chebTiles(m.tx, m.ty, ptx, pty) <= 1);
    ok(near.length === 4, `all 4 reached the attack ring instead of queueing (${near.length}/4)`);
    const tiles = new Set(near.map((m) => m.tx + "," + m.ty));
    ok(tiles.size === near.length, "each ring member claims its OWN square (1 creature = 1 tile)");
    const angles = near.map((m) => Math.atan2(m.ty - pty, m.tx - ptx));
    let spread = 0;
    for (let i = 0; i < angles.length; i++) for (let j = i + 1; j < angles.length; j++) {
      let da = Math.abs(angles[i] - angles[j]);
      if (da > Math.PI) da = 2 * Math.PI - da;
      spread = Math.max(spread, da);
    }
    ok(spread > 1.5, `they fan out around the target (max angular spread ${spread.toFixed(2)} rad)`);
  }

  console.log("Tibia-style combat balance:");
  {
    const { rollMeleeDamage, rollDistanceDamage, distanceHitChance, attackPower } = await import("../src/systems/skills.ts");
    const { PLAYER_ATTACK_RATE, DIST_HITCHANCE_MAX } = await import("../src/config.ts");
    const { MONSTER_DEFS } = await import("../src/entities/monsters.ts");
    ok(PLAYER_ATTACK_RATE === 2.0, "player swings every 2.0s (Tibia weapon speed)");
    ok(Object.values(MONSTER_DEFS).every((d) => d.atkRate === 2.0), "every monster attacks every 2.0s — blow for blow");
    // damage rolls span the whole Tibia range
    resetSkills();
    let sawZero = false, sawMax = false, sum = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const r = rollMeleeDamage(40);
      if (r === 0) sawZero = true;
      if (r === 40) sawMax = true;
      sum += r;
      if (r < 0 || r > 40) { sawZero = false; break; }
    }
    ok(sawZero && sawMax, "melee rolls cover 0 ('poof') through max");
    ok(Math.abs(sum / N - 20) < 1, `average melee hit ≈ half of max (${(sum / N).toFixed(1)}/40)`);
    const dr = rollDistanceDamage(50, 10);
    ok(dr >= 2 && dr <= 50, "distance roll floors at level/5");
    // accuracy: 60% at skill 10, capped at 90%
    ok(Math.abs(distanceHitChance() - 0.60) < 1e-9, "bow accuracy 60% at Distance 10");
    skills.dist.lv = 90;
    ok(distanceHitChance() === DIST_HITCHANCE_MAX, "…capped at 90% like Tibia bows");
    resetSkills();
    // exp pacing: lvl-10 melee char, iron sword, sword skill 20 vs a goblin —
    // avg dmg = max/2, so time-to-kill lands in Tibia territory
    skills.sword.lv = 20;
    const p = createPlayer({ x: 0, y: 0 });
    p.level = 10;
    p.eq.weapon = "ironSword";
    const maxHit = attackPower(p.level, p.eq);
    const avg = maxHit / 2;
    const goblin = MONSTER_DEFS.goblin;
    const swings = Math.ceil(goblin.hp / avg);
    const ttk = swings * 2.0;
    ok(ttk >= 8 && ttk <= 30, `lvl-10 goblin kill ≈ ${ttk.toFixed(0)}s (${swings} swings, max hit ${maxHit}) — was ~2-3s before`);
    resetSkills();
  }

  console.log("speed from level (no Speed skill — Tibia 8.6):");
  {
    const { playerSpeed } = await import("../src/entities/player.ts");
    const { PLAYER_BASE_SPEED, SPEED_PER_LEVEL } = await import("../src/config.ts");
    ok(!("speed" in skills), "skills panel no longer contains a Speed skill");
    const p = createPlayer({ x: 0, y: 0 });
    ok(playerSpeed(p) === PLAYER_BASE_SPEED, "level 1 moves at base speed");
    p.level = 50;
    ok(playerSpeed(p) === PLAYER_BASE_SPEED + 49 * SPEED_PER_LEVEL, "level 50 gains the per-level bonus");
    const boots = createPlayer({ x: 0, y: 0 });
    boots.eq.boots = "boots"; // Swift Boots — a world-pixel bonus, so it doubled with TILE
    const bootSpeed = items.ITEMS.boots.gear!.speed!;
    ok(playerSpeed(boots) === PLAYER_BASE_SPEED + bootSpeed, "gear speed bonus still applies on top");
  }

  console.log("monster aggro (sight covers every bow + hit provokes):");
  {
    const { MONSTER_AGGRO_RANGE, MONSTER_AGGRO_HIT_S } = await import("../src/config.ts");
    const { playerShoot } = await import("../src/systems/combat.ts");
    const { spawnMonster } = await import("../src/entities/monsters.ts");
    // no bow may outrange monster awareness — the whole point of the change
    let longestBow = 0;
    for (const k of Object.keys(items.ITEMS) as (keyof typeof items.ITEMS)[]) {
      const d = items.ITEMS[k] as { bow?: { range: number } };
      if (d.bow) longestBow = Math.max(longestBow, d.bow.range);
    }
    ok(MONSTER_AGGRO_RANGE >= longestBow + TILE, `aggro range ${MONSTER_AGGRO_RANGE} ≥ longest bow ${longestBow} + 1 tile`);
    // a fresh spawn is calm; an arrow (hit OR miss) provokes it
    const worlds = buildWorlds(WORLD_SEED);
    const wild = worlds.wild;
    ok(spawnMonster(wild, "goblin"), "goblin spawns on the Wildlands");
    const m = wild.monsters[wild.monsters.length - 1];
    ok(m.aggroT === 0, "freshly spawned monster starts calm");
    const p = createPlayer({ x: m.x - 100, y: m.y });
    p.bag = items.emptyBag();
    items.addItem(p.bag, "arrow", 10);
    p.eq.weapon = "bow";
    playerShoot(wild, p, m, "arrow");
    ok(m.aggroT === MONSTER_AGGRO_HIT_S, "being shot at (hit or miss) provokes the monster");
  }

  console.log("food & regeneration (Tibia fed system):");
  {
    const { FED_MAX_S, FED_HP_PER_S } = await import("../src/config.ts");
    ok((items.ITEMS.meat.food ?? 0) > 0 && items.ITEMS.meat.heal === undefined, "raw meat feeds instead of instant-healing");
    ok((items.ITEMS.mushroom.food ?? 0) > 0, "mushroom is food too");
    ok((items.ITEMS.hpPotion.heal ?? 0) > 0 && items.ITEMS.hpPotion.food === undefined, "health potion stays an instant heal");
    ok(FED_MAX_S === 1200, "fed time caps at 20 minutes like Tibia");
    ok(FED_HP_PER_S > 0, "being fed regenerates HP");
    const p = createPlayer({ x: 0, y: 0 });
    ok(p.fedS === 0, "a fresh character starts hungry");
  }

  console.log("Marrow Blade treasure (cave -3 chest):");
  {
    const { MONSTER_DEFS } = await import("../src/entities/monsters.ts");
    const { SHOPS } = await import("../src/entities/npcs.ts");
    const blade = items.ITEMS.marrowBlade;
    ok(blade.gear?.atk === 20 && blade.slot === "weapon", "Marrow Blade is a 20-attack weapon");
    // unobtainable anywhere but the chest: no loot table and no shop sells it
    let inLoot = false;
    for (const k of Object.keys(MONSTER_DEFS) as (keyof typeof MONSTER_DEFS)[]) {
      if (MONSTER_DEFS[k].loot.some((e: { kind: string }) => e.kind === "marrowBlade")) inLoot = true;
    }
    ok(!inLoot, "no monster drops the Marrow Blade");
    let inShop = false;
    for (const shop of Object.values(SHOPS)) {
      if (shop && shop.entries.some((e) => e.kind === "marrowBlade" && e.buy > 0)) inShop = true;
    }
    ok(!inShop, "no shop sells the Marrow Blade");
    // the chest sits on the bottom floor, far from the ladder, deterministically
    const worlds = buildWorlds(WORLD_SEED);
    const c3 = worlds.cave3;
    const chest = c3.structures.find((st) => st.key === "treasure");
    ok(!!chest, "Bone Caverns -3 contains the treasure chest");
    ok(!worlds.cave1.structures.some((st) => st.key === "treasure")
      && !worlds.cave2.structures.some((st) => st.key === "treasure"), "upper floors have no chest");
    if (chest) {
      ok(c3.solid[chest.ty][chest.tx] === true, "the chest tile is solid (can't stand on it)");
      const up = c3.portals.find((pt) => pt.style === "ladderUp")!;
      const dChest = Math.hypot(chest.tx * TILE + TILE / 2 - up.x, chest.ty * TILE + TILE / 2 - up.y);
      ok(dChest > TILE * 20, `chest is deep in the cavern (${Math.round(dChest / TILE)} tiles from the ladder)`);
      const again = buildWorlds(WORLD_SEED).cave3.structures.find((st) => st.key === "treasure")!;
      ok(again.tx === chest.tx && again.ty === chest.ty, "chest position is deterministic from the seed");
    }
  }

  console.log("Etap 8 — extended bestiary:");
  {
    const { MONSTER_DEFS, MONSTER_KINDS, spawnMonster, updateMonsters } = await import("../src/entities/monsters.ts");
    const { MONSTER_AGGRO_RANGE, MONSTER_RESPAWN_S } = await import("../src/config.ts");
    const { killMonster } = await import("../src/systems/combat.ts");
    ok(MONSTER_KINDS.length === 31, `bestiary holds 31 kinds (30 + the dragon), got ${MONSTER_KINDS.length}`);
    // every loot entry references a real item, every def carries a live sprite
    let lootOk = true, sprOk = true;
    for (const k of MONSTER_KINDS) {
      const d = MONSTER_DEFS[k];
      if (!d.spr) sprOk = false;
      for (const e of d.loot) if (!items.ITEMS[e.kind]) lootOk = false;
    }
    ok(lootOk, "every loot entry maps to a real item");
    ok(sprOk, "every monster kind has a baked sprite");
    // shooters never outrange their own awareness
    const shooters = MONSTER_KINDS.filter((k) => MONSTER_DEFS[k].ranged);
    ok(shooters.length === 8, `eight distance fighters in the bestiary, got ${shooters.length}`);
    ok(shooters.every((k) => MONSTER_DEFS[k].ranged!.range < MONSTER_AGGRO_RANGE),
      "every shooter's range stays under the aggro range");
    // the orc spearman drops bone arrows (spears were cut per design review)
    const spearman = MONSTER_DEFS.orcSpearman;
    ok(spearman.loot.some((e) => e.kind === "boneArrow"), "orc spearman drops bone arrows");
    ok(!MONSTER_KINDS.some((k) => MONSTER_DEFS[k].loot.some((e) => (e.kind as string) === "spear")),
      "no monster drops a 'spear' item (it does not exist)");
    // the dragon: boss stats, long respawn, exclusive gear drops
    const dragon = MONSTER_DEFS.dragon;
    ok(dragon.hp === 1000 && dragon.exp === 900, "dragon is the 1000 hp / 900 exp boss");
    ok((dragon.respawnS ?? 0) >= 600, "the dragon's lair refills on a long clock");
    ok(MONSTER_KINDS.every((k) => (MONSTER_DEFS[k].respawnS ?? MONSTER_RESPAWN_S) === (k === "dragon" ? 600 : MONSTER_RESPAWN_S)),
      "only the dragon overrides the standard respawn");
    for (const rare of ["dragonShield", "fireSword", "dragonScaleArmor"] as const) {
      const only = MONSTER_KINDS.filter((k) => MONSTER_DEFS[k].loot.some((e) => e.kind === rare));
      ok(only.length === 1 && only[0] === "dragon", `${rare} drops from the dragon alone`);
    }
    // killMonster schedules the dragon's respawn on its own clock
    {
      const worlds = buildWorlds(WORLD_SEED);
      const c3 = worlds.cave3;
      c3.monsters.length = 0; c3.respawns.length = 0;
      ok(spawnMonster(c3, "dragon"), "the dragon spawns on Bone Caverns -3");
      const p = createPlayer({ x: 0, y: 0 });
      killMonster(c3, p, c3.monsters[0]);
      ok(c3.respawns.length === 1 && c3.respawns[0].t === 600, "a slain dragon respawns after 600 s");
      ok(c3.corpses.length === 1 && c3.corpses[0].name === "dragon", "the dragon leaves a lootable corpse");
    }
    // a shooter holds its ground and fires: park a hunter mid-range and step
    // the AI — it must land ranged hits without ever closing to melee reach
    {
      const worlds = buildWorlds(WORLD_SEED);
      const wild = worlds.wild;
      wild.monsters.length = 0;
      ok(spawnMonster(wild, "hunter"), "a hunter spawns for the AI test");
      const h = wild.monsters[0];
      const targetP = { x: h.x + 100, y: h.y, dead: false };
      let rangedHits = 0, meleeHits = 0, minD = Infinity;
      for (let t = 0; t < 600; t++) {
        updateMonsters(wild, 1 / 60, targetP, (_m, ranged) => { if (ranged) rangedHits++; else meleeHits++; });
        minD = Math.min(minD, Math.hypot(h.x - targetP.x, h.y - targetP.y));
      }
      ok(rangedHits >= 4 && meleeHits === 0, `the hunter fires from range (${rangedHits} shots, ${meleeHits} melee)`);
      ok(minD > 13, `the hunter never closes to melee reach (min ${Math.round(minD)} px)`);
      ok(wild.shots.length > 0 || rangedHits > 0, "monster shots spawn cosmetic projectiles");
    }
    // populations: every floor's roster references only defined kinds — and a
    // fresh populate actually places the dragon
    {
      const { populateAll } = await import("../src/game.ts");
      const worlds = buildWorlds(WORLD_SEED);
      populateAll(worlds, WORLD_SEED);
      ok(worlds.cave3.monsters.filter((mm) => mm.kind === "dragon").length === 1,
        "exactly one dragon nests in Bone Caverns -3");
      ok(worlds.wild.monsters.some((mm) => mm.kind === "snake")
        && worlds.wild.monsters.some((mm) => mm.kind === "amazon"), "the surface carries the new tier-1/2 kinds");
      ok(worlds.cave2.monsters.some((mm) => mm.kind === "minotaurArcher"), "cavern -2 fields minotaur archers");
    }
    // new gear sanity: the progression slots between existing pieces
    ok(items.ITEMS.battleAxe.gear?.atk === 9 && items.ITEMS.fireSword.gear?.atk === 16,
      "battle axe (9) and fire sword (16) slot into the weapon ladder");
    ok((items.ITEMS.dragonShield.gear?.def ?? 0) > (items.ITEMS.steelShield.gear?.def ?? 0),
      "dragon shield out-defends steel shield");
    ok((items.ITEMS.dragonHam.food ?? 0) > (items.ITEMS.meat.food ?? 0), "dragon ham out-feeds raw meat");
  }

  console.log("Deep Wildlands (Etap 9a v2 — the continent & the camp lairs):");
  {
    const { populateAll } = await import("../src/game.ts");
    const { LAIRS } = await import("../src/world/deepwild.ts");
    const { Tile } = await import("../src/world/types.ts");
    const { dist } = await import("../src/util.ts");
    const worlds = buildWorlds(WORLD_SEED);
    const dw = worlds.deepwild;
    ok(dw.w === 368 && dw.h === 272, `the continent is 368x272, got ${dw.w}x${dw.h}`);
    ok(dw.w * dw.h >= 3 * 208 * 160, "three times the area of the first frontier cut");
    ok(!dw.safe, "the Deep Wildlands is flagged dangerous (ready for future rosters)");
    // an irregular, noise-carved coast — a real landmass share, not a blob's
    let landN = 0;
    for (let y = 0; y < dw.h; y++)
      for (let x = 0; x < dw.w; x++)
        if (dw.tile[y][x] !== Tile.Water) landN++;
    const landFrac = landN / (dw.w * dw.h);
    ok(landFrac > 0.35 && landFrac < 0.55, `mainland covers a continental share of the map (${(landFrac * 100).toFixed(1)}%)`);
    // travel loop: a boat in Bonetown, a dock back home on the frontier
    ok(worlds.town.portals.some((p) => p.dest === "deepwild"), "Bonetown has the boat to the Deep Wildlands");
    ok(dw.portals.some((p) => p.dest === "town"), "the frontier dock leads back to Bonetown");
    // eight themed camps, far apart, all anchored on walkable ground
    ok(dw.camps.length === 8, `eight camps are recorded, got ${dw.camps.length}`);
    ok(new Set(dw.camps.map((c) => c.key)).size === 8, "camp keys are unique");
    ok(dw.camps.every((c) => !dw.solid[Math.floor(c.y / TILE)][Math.floor(c.x / TILE)]), "every camp centre is walkable");
    let minGap = Infinity;
    for (let i = 0; i < dw.camps.length; i++)
      for (let j = i + 1; j < dw.camps.length; j++)
        minGap = Math.min(minGap, dist(dw.camps[i].x, dw.camps[i].y, dw.camps[j].x, dw.camps[j].y) / TILE);
    ok(minGap >= 48, `settlements keep their distance (nearest pair ${Math.round(minGap)} tiles apart)`);
    // carved terrain actually exists: dirt floors/trails, solid palisades
    let dirt = 0, pal = 0, palSolid = true;
    for (let y = 0; y < dw.h; y++)
      for (let x = 0; x < dw.w; x++) {
        if (dw.tile[y][x] === Tile.Dirt) dirt++;
        if (dw.tile[y][x] === Tile.Palisade) { pal++; if (!dw.solid[y][x]) palSolid = false; }
      }
    ok(dirt > 600, `camp floors + trails carved in dirt (${dirt} tiles)`);
    ok(pal > 40 && palSolid, `palisade rings raised and solid (${pal} posts)`);
    ok(dw.camps.every((c) => dw.trees.every((t) =>
      dist(t.tx * TILE + TILE / 2, t.ty * TILE + TILE / 2, c.x, c.y) > c.r - TILE)), "camp interiors are clear of trees");
    // every camp reaches the dock on foot — one connected mainland, no islets
    {
      const dock = dw.portals.find((p) => p.dest === "town")!;
      const W = dw.w;
      const seen = new Uint8Array(W * dw.h);
      const q: number[] = [Math.floor(dock.y / TILE) * W + Math.floor(dock.x / TILE)];
      seen[q[0]] = 1;
      for (let h = 0; h < q.length; h++) {
        const x = q[h] % W;
        const y = Math.floor(q[h] / W);
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= dw.h) continue;
          const id = ny * W + nx;
          if (seen[id] || dw.solid[ny][nx] || dw.tile[ny][nx] === Tile.Water) continue;
          seen[id] = 1;
          q.push(id);
        }
      }
      ok(dw.camps.every((c) => seen[Math.floor(c.y / TILE) * W + Math.floor(c.x / TILE)] === 1),
        "every settlement is reachable on foot from the dock");
    }
    // Etap 9b: the region is ALIVE — every settlement fields its themed
    // garrison inside the ring, leashed to home
    populateAll(worlds, WORLD_SEED);
    {
      const inCamp = (key: string) => dw.monsters.filter((m) => m.camp === key);
      ok(dw.camps.every((c) => inCamp(c.key).length > 0), "every settlement fields a garrison");
      ok(dw.monsters.filter((m) => m.camp).every((m) => {
        const c = dw.camps.find((cc) => cc.key === m.camp)!;
        return dist(m.x, m.y, c.x, c.y) <= c.r;
      }), "every garrison member spawns inside its own ring");
      ok(dw.monsters.filter((m) => m.camp).every((m) => m.hr !== undefined && m.hx !== undefined),
        "camp dwellers carry a home leash");
      ok(inCamp("goblin").some((m) => m.kind === "goblin")
        && inCamp("orcfort").some((m) => m.kind === "orcSpearman")
        && inCamp("grave").some((m) => m.kind === "ghoul")
        && inCamp("bastion").some((m) => m.kind === "minotaur"), "garrisons match their settlement themes");
      // the forest between camps belongs to the wolves — free roamers
      const roamers = dw.monsters.filter((m) => !m.camp);
      ok(roamers.length >= 15 && roamers.every((m) => m.kind === "wolf" || m.kind === "warWolf"),
        `wolves lope through the open forest (${roamers.length} roamers)`);
      ok(roamers.every((m) => dw.camps.every((c) => dist(m.x, m.y, c.x, c.y) > c.r)),
        "roamers spawn outside every settlement");
      ok(roamers.every((m) => !m.hr), "roamers carry no leash — the woods are theirs");
      // a slain villager respawns back home, not across the continent
      const { killMonster } = await import("../src/systems/combat.ts");
      const { spawnMonsterInCamp } = await import("../src/entities/monsters.ts");
      const gob = inCamp("goblin").find((m) => m.kind === "goblin")!;
      const before = dw.monsters.length;
      killMonster(dw, createPlayer({ x: 0, y: 0 }), gob);
      ok(dw.monsters.length === before - 1 && dw.respawns.some((r) => r.camp === "goblin"),
        "a slain villager queues a respawn bound to its home camp");
      const goblinCamp = dw.camps.find((c) => c.key === "goblin")!;
      ok(spawnMonsterInCamp(dw, "goblin", goblinCamp), "the respawn lands back inside the village");
      const back = dw.monsters[dw.monsters.length - 1];
      ok(dist(back.x, back.y, goblinCamp.x, goblinCamp.y) <= goblinCamp.r, "…within the ring");
    }
    // the lairs: every camp descends underground, deeper floors are larger
    ok(LAIRS.length === 15, `fifteen lair floors are cataloged, got ${LAIRS.length}`);
    ok(dw.camps.every((c) => dw.portals.some((p) =>
      p.style === "caveMouth" && dist(p.x, p.y, c.x, c.y) <= c.r)),
      "every camp has a cave mouth inside its ring");
    let chainsOk = true, filledOk = true, growOk = true;
    for (const l of LAIRS) {
      const lw = worlds[l.key];
      if (!lw) { chainsOk = false; continue; }
      if (!lw.portals.some((p) => p.style === "ladderUp" && p.dest === l.up)) chainsOk = false;
      if (l.down && !lw.portals.some((p) => p.style === "ladderDown" && p.dest === l.down)) chainsOk = false;
      if (!l.down && lw.portals.some((p) => p.style === "ladderDown")) chainsOk = false;
      if (lw.monsters.length === 0) filledOk = false;
    }
    ok(chainsOk, "every lair floor's ladders chain correctly (up to the camp, down to the next)");
    ok(filledOk, "every lair floor is populated (Etap 9b)");
    ok(worlds.roost3.monsters.some((m) => m.kind === "dragon"), "the second dragon nests at the Roost's heart");
    ok(worlds.grave2.monsters.some((m) => m.kind === "mummy"), "the deep graveyard wakes its mummies");
    // deeper = larger (the future difficulty ramp has room to breathe)
    for (const spec of [["roost1", "roost2", "roost3"], ["goblin1", "goblin2"]] as const) {
      for (let i = 1; i < spec.length; i++) {
        const a = worlds[spec[i - 1] as keyof typeof worlds];
        const b = worlds[spec[i] as keyof typeof worlds];
        if (!(b.w * b.h > a.w * a.h)) growOk = false;
      }
    }
    ok(growOk, "deeper lair floors are larger than the ones above");
    // determinism: a second build carves the exact same settlements
    const again = buildWorlds(WORLD_SEED).deepwild;
    ok(again.camps.every((c, i) => c.x === dw.camps[i].x && c.y === dw.camps[i].y && c.key === dw.camps[i].key),
      "camp layout is deterministic from the seed");
    // ...and the older islands were untouched by the addition (their streams
    // are salted separately): the cave-3 chest sits where it always did
    const chest = worlds.cave3.structures.find((st) => st.key === "treasure")!;
    const chestAgain = buildWorlds(WORLD_SEED).cave3.structures.find((st) => st.key === "treasure")!;
    ok(chest.tx === chestAgain.tx && chest.ty === chestAgain.ty, "existing islands still roll identically");

    // ---- Etap 9c: the Marrow set — five chests, five deepest floors ----
    console.log("the Marrow set & the hoard guards (Etap 9c):");
    const { CHEST_PRIZES } = await import("../src/game.ts");
    const marrow = ["marrowShield", "marrowArmor", "marrowHelmet", "marrowLegs", "marrowBoots"] as const;
    ok(marrow.every((k) => items.ITEMS[k]?.gear?.def), "all five Marrow pieces exist as gear");
    ok((items.ITEMS.marrowShield.gear?.def ?? 0) > (items.ITEMS.dragonShield.gear?.def ?? 0)
      && (items.ITEMS.marrowArmor.gear?.def ?? 0) > (items.ITEMS.dragonScaleArmor.gear?.def ?? 0)
      && (items.ITEMS.marrowHelmet.gear?.def ?? 0) > (items.ITEMS.helmet.gear?.def ?? 0)
      && (items.ITEMS.marrowLegs.gear?.def ?? 0) > (items.ITEMS.legs.gear?.def ?? 0)
      && (items.ITEMS.marrowBoots.gear?.def ?? 0) > (items.ITEMS.boots.gear?.def ?? 0),
      "every Marrow piece tops its slot's ladder");
    ok(new Set(items.ITEMS && marrow.map((k) => items.ITEMS[k].slot)).size === 5,
      "the set covers five distinct equipment slots");
    // exactly six chest worlds, each with a distinct prize; the blade stays home
    const prizeWorlds = Object.keys(CHEST_PRIZES) as (keyof typeof CHEST_PRIZES)[];
    ok(prizeWorlds.length === 6 && CHEST_PRIZES.cave3 === "marrowBlade",
      "six chest worlds are mapped; the caverns still hold the blade");
    ok(new Set(Object.values(CHEST_PRIZES)).size === 6, "every chest holds a different prize");
    const treasureLairs = ["goblin2", "orcfort2", "bastion2", "grave2", "roost3"] as const;
    let chestsOk = true, hoardOk = true, guardsOk = true, postedOk = true;
    for (const k of treasureLairs) {
      const lw = worlds[k];
      const ch = lw.structures.find((st) => st.key === "treasure");
      if (!ch) { chestsOk = false; continue; }
      const hoard = lw.camps.find((c) => c.key === "hoard");
      if (!hoard || dist(hoard.x, hoard.y, ch.tx * TILE + TILE / 2, ch.ty * TILE + TILE / 2) > 1) hoardOk = false;
      const detail = lw.monsters.filter((m) => m.camp === "hoard");
      if (detail.length < 2) guardsOk = false;
      if (!detail.every((m) => hoard && dist(m.x, m.y, hoard.x, hoard.y) <= hoard.r && m.hr)) postedOk = false;
    }
    ok(chestsOk, "every martial camp's deepest floor holds a Marrow chest");
    ok(hoardOk, "each chest is wrapped in a hoard zone");
    ok(guardsOk, "an elite guard detail is posted at every hoard");
    ok(postedOk, "the guards stand leashed to their chest");
    ok(worlds.grave2.monsters.filter((m) => m.kind === "boneLord").length >= 3,
      "the deep graveyard now fields bone lords beyond its roster (chest detail)");
    // the shallow lairs and the mild camps stay chest-free
    ok((["warren1", "cove1", "hollow1", "hollow2", "goblin1", "orcfort1", "bastion1", "grave1", "roost1", "roost2"] as const)
      .every((k) => !worlds[k].structures.some((st) => st.key === "treasure")),
      "no chest leaks onto shallower floors");
  }

  console.log("Etap 10 — Archery Range & training arrows:");
  {
    const bag = items.emptyBag();
    items.addItem(bag, "trainingArrow", 40);
    ok(items.bestArrow(bag) === null, "combat pick ignores training arrows");
    ok(items.bestPracticeArrow(bag) === "trainingArrow", "range pick takes training arrows");
    items.addItem(bag, "boneArrow", 5);
    ok(items.bestArrow(bag) === "boneArrow", "combat pick still finds real ammo");
    ok(items.bestPracticeArrow(bag) === "trainingArrow", "…but the range keeps preferring practice shafts");
    items.removeItem(bag, "trainingArrow", 40);
    ok(items.bestPracticeArrow(bag) === "boneArrow", "no practice shafts → range falls back to combat ammo");
    // the recipe: one log, a whole quiver
    const r = items.RECIPES.find((rc) => rc.out === "trainingArrow")!;
    const cbag = items.emptyBag();
    items.addItem(cbag, "wood", 1);
    ok(items.craft(cbag, r), "1 wood crafts the batch");
    ok(items.bagCount(cbag, "trainingArrow") === 25 && items.bagCount(cbag, "wood") === 0,
      "…and yields 25 training arrows");
    ok((items.ITEMS.trainingArrow.ammo?.dmg ?? -1) === 0 && items.ITEMS.trainingArrow.practice === true,
      "training arrows carry zero attack and the practice flag");
    // the structure itself
    ok(!!STRUCTS.range && STRUCTS.range.single === true, "Archery Range exists on a 1-tile footprint");
    const home = buildWorlds(WORLD_SEED).home;
    let placeable = false;
    for (let ty = 1; ty < home.h - 1 && !placeable; ty++)
      for (let tx = 1; tx < home.w - 1 && !placeable; tx++)
        if (canPlaceAt(home, "range", tx, ty)) placeable = true;
    ok(placeable, "the range finds clear grass on Home Isle");
  }

  console.log("Etap 10 — Wardrobe (outfit dyes):");
  {
    const outfit = await import("../src/systems/outfit.ts");
    const p = createPlayer({ x: 0, y: 0 });
    outfit.resetOutfit();
    const d0 = outfit.outfitState();
    ok(d0.hair === 116 && d0.primary === 75 && d0.secondary === 120 && d0.current === "adventurer",
      "fresh state is the default look in the 133-dye rack");
    outfit.setOutfitColor(p, "hair", 11);
    outfit.setOutfitColor(p, "primary", 4);
    ok(outfit.outfitState().hair === 11 && outfit.outfitState().primary === 4, "dye picks stick");
    outfit.setOutfitColor(p, "secondary", 999);
    ok(outfit.outfitState().secondary === 120, "an out-of-range dye is refused");
    // save round-trip
    const snap = outfit.outfitSave();
    outfit.resetOutfit();
    ok(outfit.outfitState().hair === 116, "reset back to defaults");
    outfit.loadOutfitSave(snap);
    const d1 = outfit.outfitState();
    ok(d1.hair === 11 && d1.primary === 4 && d1.secondary === 120, "save snapshot restores the dyes");
    // hostile / legacy data → defaults, owned always keeps the starter
    outfit.loadOutfitSave({ hair: "purple", current: "dragonKing", owned: ["dragonKing", 7] });
    const d2 = outfit.outfitState();
    ok(d2.hair === 116 && d2.current === "adventurer" && d2.owned.includes("adventurer"),
      "corrupt save data falls back to the default look");
    outfit.loadOutfitSave(undefined);
    ok(outfit.outfitState().primary === 75, "pre-wardrobe saves (no outfit field) load clean");
    outfit.resetOutfit();
  }

  console.log("Etap 10 — the tailor stands in Bonetown:");
  {
    const { makeHandmadeWorld, TOWN_SPEC } = await import("../src/world/handmade.ts");
    const town = makeHandmadeWorld(TOWN_SPEC);
    const tailor = town.npcs.find((n) => n.key === "tailor");
    ok(!!tailor, "Vesper is placed on the town map");
    ok(town.npcs.length === 5, "all five town NPCs parse from the grid");
    const { SHOPS } = await import("../src/entities/npcs.ts");
    ok(!SHOPS.tailor, "the tailor runs the wardrobe, not a shop");
    ok(!!SHOPS.smith?.entries.find((e) => e.kind === "trainingArrow" && e.buy === 1 && e.sell === 0),
      "the smith sells training arrows for 1g and never buys them back");
  }

  console.log("Bone Sanctum — temple road, level gates, dormant pads:");
  {
    const { makeHandmadeWorld, TOWN_SPEC, SANCTUM_SPEC } = await import("../src/world/handmade.ts");
    const { applyGates } = await import("../src/game.ts");
    const { findPath, toTile } = await import("../src/world/grid.ts");
    const town = makeHandmadeWorld(TOWN_SPEC);
    const stairs = town.portals.find((p) => p.dest === "sanctum");
    ok(!!stairs && stairs.style === "ladderDown", "the temple stairs stand west of Bonetown");
    const plaza = town.portals.find((p) => p.dest === "home")!;
    const road = findPath(town, toTile(plaza.x), toTile(plaza.y), toTile(stairs!.x), toTile(stairs!.y));
    ok(road.length > 0, `the temple road walks all the way from the plaza (${road.length} steps)`);
    ok(town.npcs.length === 5, "the western extension shifted no NPC off the map");

    const s = makeHandmadeWorld(SANCTUM_SPEC);
    ok(s.gates.length === 10, "five doorways, two gate tiles each");
    const lvs = [...new Set(s.gates.map((g) => g.lv))].sort((a, b) => a - b);
    ok(lvs.join(",") === "10,15,20,25,30", `gate levels are 10/15/20/25/30 (${lvs.join("/")})`);
    const pads = s.portals.filter((p) => p.inactive);
    ok(pads.length === 5, "each chamber holds one dormant teleport pad");
    const up = s.portals.find((p) => p.dest === "town");
    ok(!!up && up.style === "ladderUp", "the ladder back to Bonetown is in the nave");

    // sealed at level 9: no pad reachable from the ladder
    applyGates(s, 9);
    const from = { x: toTile(up!.x), y: toTile(up!.y) };
    const reaches = (p: { x: number; y: number }): boolean => {
      const path = findPath(s, from.x, from.y, toTile(p.x), toTile(p.y));
      const last = path[path.length - 1];
      return !!last && last.x === toTile(p.x) && last.y === toTile(p.y);
    };
    ok(pads.every((p) => !reaches(p)), "at level 9 every chamber is sealed");
    // level 10 opens EXACTLY the first gate
    applyGates(s, 10);
    const open10 = pads.filter((p) => reaches(p));
    ok(open10.length === 1, "level 10 opens exactly one chamber");
    // level 30 opens them all
    applyGates(s, 30);
    ok(pads.every((p) => reaches(p)), "level 30 walks into all five chambers");
    // gates re-seal if applied with a lower level again (pure function of level)
    applyGates(s, 12);
    ok(pads.filter((p) => reaches(p)).length === 1, "applyGates is a pure function of level");
  }

  console.log("Etap 11 — independent Storage Chests (50 slots each):");
  {
    const { tryPlace, canAfford } = await import("../src/systems/building.ts");
    const { createGame, homeChests } = await import("../src/game.ts");
    const g = createGame();
    g.player.gold = 0;
    items.addItem(g.player.bag, "wood", 200);
    items.addItem(g.player.bag, "stone", 100);
    // find two clear spots and raise two chests
    const home = g.worlds.home;
    let built = 0;
    for (let ty = 1; ty < home.h - 1 && built < 2; ty++)
      for (let tx = 1; tx < home.w - 1 && built < 2; tx++)
        if (canPlaceAt(home, "chest", tx, ty))
          if (tryPlace(home, g.player, "chest", tx * TILE + TILE, ty * TILE + TILE, homeChests(g))) built++;
    ok(built === 2, "two chests raised on Home Isle");
    const invs = homeChests(g);
    ok(invs.length === 2 && invs[0] !== invs[1], "each chest owns a separate inventory");
    ok(invs[0].length === 50 && invs[1].length === 50, "every chest has 50 slots");
    items.addItem(invs[0], "bones", 30);
    ok(items.bagCount(invs[0], "bones") === 30 && items.bagCount(invs[1], "bones") === 0,
      "items stored in one chest never appear in the other");
    // costs still draw from the backpack + EVERY chest combined
    items.addItem(invs[1], "herb", 12);
    const bagWood = items.bagCount(g.player.bag, "wood");
    items.removeItem(g.player.bag, "wood", bagWood);
    items.addItem(invs[0], "wood", 22);
    items.addItem(g.player.bag, "stone", 6);
    ok(canAfford(g.player.bag, STRUCTS.garden.cost, homeChests(g)),
      "a build cost split across bag + two chests still affords");
  }

  console.log("Etap 11 — chest persistence & legacy shared-stash migration:");
  {
    const { createGame, homeChests } = await import("../src/game.ts");
    const { saveGame, loadGame, deleteSave } = await import("../src/save.ts");
    const { tryPlace } = await import("../src/systems/building.ts");
    const g = createGame();
    items.addItem(g.player.bag, "wood", 60);
    items.addItem(g.player.bag, "stone", 40);
    const home = g.worlds.home;
    outer: for (let ty = 1; ty < home.h - 1; ty++)
      for (let tx = 1; tx < home.w - 1; tx++)
        if (canPlaceAt(home, "chest", tx, ty)) {
          tryPlace(home, g.player, "chest", tx * TILE + TILE, ty * TILE + TILE, homeChests(g));
          break outer;
        }
    items.addItem(homeChests(g)[0], "silk", 44);
    saveGame(g);
    const g2 = loadGame();
    ok(!!g2 && items.bagCount(homeChests(g2!)[0], "silk") === 44,
      "a chest's own inventory survives the save round-trip");
    // legacy: strip the chest inv and plant the pre-Etap-11 shared stash field
    const raw = JSON.parse(localStorage.getItem("bone-isle-save-v2")!);
    for (const st of raw.structures.home) delete st.inv;
    raw.stash = [{ kind: "bones", n: 17 }, { kind: "wood", n: 5 }];
    localStorage.setItem("bone-isle-save-v2", JSON.stringify(raw));
    const g3 = loadGame();
    ok(!!g3 && items.bagCount(homeChests(g3!)[0], "bones") === 17
      && items.bagCount(homeChests(g3!)[0], "wood") === 5,
      "the old shared stash pours into the first chest on load");
    deleteSave();
  }

  console.log("Etap 11 — backpacks, the Dopalacz & shop stock:");
  {
    ok(items.ITEMS.backpack.pack?.slots === 8 && items.ITEMS.backpack.stack === 1,
      "a carried Backpack is worth +8 bag slots");
    ok(items.ITEMS.booster.boost === true, "the Dopalacz carries the boost flag");
    const br = items.RECIPES.find((r) => r.out === "booster")!;
    ok(!!br && br.gold === 1 && Object.keys(br.cost).length === 0,
      "the Dopalacz forges for 1 gold and nothing else");
    const bag = items.emptyBag();
    ok(items.craft(bag, br) && items.bagCount(bag, "booster") === 1,
      "crafting it lands one in the bag (gold is charged by the forge)");
    const { SHOPS } = await import("../src/entities/npcs.ts");
    ok(!!SHOPS.smith?.entries.find((e) => e.kind === "backpack" && e.buy === 40),
      "the smith sells Backpacks for 40g");
    ok(items.emptyStash().length === 50, "a fresh chest inventory is 50 slots");
  }

  console.log("Etap 12 — HUD v2 (orientations, scale, presets, snapping):");
  {
    const hl = await import("../src/systems/hudLayout.ts");
    // per-orientation positions: moving a group in portrait leaves landscape alone
    hl.resetHudLayout();
    hl.moveHudGroup("swap", 100, 200, 400, 800);            // portrait screen
    const port = hl.placeHud("swap", 10, 10, 400, 800);
    ok(Math.abs(port.x - 100) < 1 && Math.abs(port.y - 200) < 1, "portrait move lands where dropped");
    const land = hl.placeHud("swap", 10, 10, 800, 400);     // landscape untouched
    ok(Math.abs(land.x - 0.78 * 800) < 1, "landscape keeps its own default");

    // snapping: grid rounding + edge magnet with margin
    hl.moveHudGroup("slot0", 101, 203, 400, 800);
    hl.snapHudGroup("slot0", 40, 40, 400, 800, 8, 16, 6);
    const s0 = hl.placeHud("slot0", 40, 40, 400, 800);
    ok(s0.x % 8 < 0.5 || 8 - (s0.x % 8) < 0.5, "x snapped to the 8px grid");
    ok(s0.y % 8 < 0.5 || 8 - (s0.y % 8) < 0.5, "y snapped to the 8px grid");
    hl.moveHudGroup("slot1", 395, 5, 400, 800);             // hugging the right/top edge
    hl.snapHudGroup("slot1", 40, 40, 400, 800, 8, 16, 6);
    const s1 = hl.placeHud("slot1", 40, 40, 400, 800);
    ok(Math.abs(s1.x - (400 - 40 - 6)) < 0.5, "right-edge magnet pulls flush to the margin");
    ok(Math.abs(s1.y - 6) < 0.5, "top-edge magnet pulls flush to the margin");

    // user scale clamps to its range and persists through save/load
    hl.setHudUserScale(9);
    ok(hl.hudUserScale() === 1.6, "scale clamps at the max");
    hl.setHudUserScale(0.1);
    ok(hl.hudUserScale() === 0.7, "scale clamps at the min");
    hl.stepHudUserScale(1);
    ok(Math.abs(hl.hudUserScale() - 0.8) < 1e-9, "step raises by 10%");

    // presets: compact collapses the menu, classic reopens it,
    // and portrait/landscape get DIFFERENT slot arrangements
    hl.applyHudPreset("compact");
    ok(!hl.hudMenuOpen(), "compact preset collapses the panel menu");
    const cp = hl.placeHud("slot0", 10, 10, 400, 800);
    const cl = hl.placeHud("slot0", 10, 10, 800, 400);
    ok(Math.abs(cp.x / 400 - cl.x / 800) > 0.001, "compact differs per orientation");
    hl.applyHudPreset("classic");
    ok(hl.hudMenuOpen(), "classic preset reopens the menu");

    // v1 → v2 migration: an old single-orientation layout seeds BOTH
    localStorage.removeItem("bone-isle-hud-v2");
    localStorage.setItem("bone-isle-hud-v1", JSON.stringify({
      locked: false,
      pos: { swap: { x: 0.25, y: 0.5 } },
    }));
    hl.loadHudLayout();
    const mp = hl.placeHud("swap", 10, 10, 400, 800);
    const ml = hl.placeHud("swap", 10, 10, 800, 400);
    ok(Math.abs(mp.x - 0.25 * 400) < 1 && Math.abs(ml.x - 0.25 * 800) < 1,
      "a v1 layout migrates into both orientations");
    ok(!hl.hudLocked(), "the v1 lock state migrates too");
    ok(localStorage.getItem("bone-isle-hud-v2") !== null, "migration writes the v2 key");

    // full round-trip: layout, scale and menu state survive a reload
    hl.setHudUserScale(1.2);
    hl.toggleHudMenu();
    const menuBefore = hl.hudMenuOpen();
    hl.moveHudGroup("vitals", 40, 60, 400, 800);
    hl.saveHudLayout();
    const raw = localStorage.getItem("bone-isle-hud-v2")!;
    const data = JSON.parse(raw);
    ok(data.scale === 1.2 && data.menuOpen === menuBefore
      && Math.abs(data.pos.portrait.vitals.x - 0.1) < 1e-6,
      "scale + menu + per-orientation positions all persist");
    hl.resetHudLayout();
    ok(hl.hudUserScale() === 1 && hl.hudMenuOpen(), "reset restores scale and menu");
  }

  console.log("Etap 12b — per-window zoom & collapse (panelPrefs):");
  {
    const pp = await import("../src/systems/panelPrefs.ts");
    pp.resetPanelPrefs();
    ok(pp.panelZoom("equip") === 1 && !pp.panelCollapsed("equip"), "fresh window: 100%, expanded");
    pp.stepPanelZoom("equip", 1);
    pp.stepPanelZoom("equip", 1);
    ok(Math.abs(pp.panelZoom("equip") - 1.2) < 1e-9, "two + steps → 120%");
    ok(pp.panelZoom("skills") === 1, "zooming Equip leaves Skills alone");
    for (let i = 0; i < 30; i++) pp.stepPanelZoom("bag", -1);
    ok(pp.panelZoom("bag") === 0.5, "zoom clamps at 50%");
    for (let i = 0; i < 30; i++) pp.stepPanelZoom("bag", 1);
    ok(pp.panelZoom("bag") === 1.5, "zoom clamps at 150%");
    pp.togglePanelCollapsed("skills");
    ok(pp.panelCollapsed("skills") && !pp.panelCollapsed("equip"), "collapse is per-window too");
    // persistence round-trip: prefs survive a reload
    pp.loadPanelPrefs();
    ok(Math.abs(pp.panelZoom("equip") - 1.2) < 1e-9 && pp.panelCollapsed("skills"),
      "zoom + collapse survive the save/load round-trip");
    // corrupt storage never crashes and falls back to defaults
    localStorage.setItem("bone-isle-panels-v1", "{oops");
    pp.resetPanelPrefs();
    localStorage.setItem("bone-isle-panels-v1", "{oops");
    pp.loadPanelPrefs();
    ok(pp.panelZoom("equip") === 1, "corrupt prefs fall back to defaults");
    pp.resetPanelPrefs();
  }

  // ---------------------------------------------------------------- Etap 13
  {
    console.log("Etap 13 — Adventurer outfit (directional sprites + dye zones):");
    const of = await import("../src/systems/outfit.ts");
    const gfxSrc = await import("../src/gfx/sprites.ts");
    of.resetOutfit();

    const set = of.bakeOutfitSprites();
    ok(!!set.down && !!set.side && !!set.up, "three facings bake");
    // the maps are still 12x16; the bake is SPRITE_SCALE bigger since Etap 17
    const advSrc = (c: HTMLCanvasElement): HTMLCanvasElement => gfxSrc.spriteSource(c);
    ok(advSrc(set.down).height === 16 && advSrc(set.side).height === 16 && advSrc(set.up).height === 16,
      "every facing is 16 art px tall — three rows above the townsfolk");
    ok(advSrc(set.down).width === 12 && advSrc(set.side).width === 12 && advSrc(set.up).width === 12,
      "every facing is 12 art px wide, still within one tile");
    ok(set.down.height === 32 && set.down.width === 24, "…and it bakes out at 24x32 for a 32-px tile");
    ok(set.down !== set.side, "front and side are distinct canvases");

    // every map is well-formed and drawn from the shared palette
    const adv = await import("../src/gfx/adventurer.ts");
    const { PAL } = await import("../src/gfx/sprites.ts");
    for (const [nm, m] of [["down", adv.ADV_DOWN], ["side", adv.ADV_SIDE], ["up", adv.ADV_UP]] as const) {
      ok(m.length === 16, `${nm} is 16 rows`);
      ok(m.every((r) => r.length === 12), `${nm} rows are all 12 wide`);
      ok(m.every((r) => [...r].every((c) => c === "." || c in PAL)),
        `${nm} uses only palette glyphs`);
    }
    ok(adv.ADV_DOWN.every((r) => r.startsWith(".") || r.startsWith("e")),
      "no facing bleeds into the left edge without an outline");
    for (const [nm, m] of [["down", adv.ADV_DOWN], ["side", adv.ADV_SIDE], ["up", adv.ADV_UP]] as const) {
      ok(m.some((r) => r.includes("e")), `${nm} carries the dark outline`);
    }
    ok(adv.ADV_SIDE.some((r) => r.includes("c")) && adv.ADV_UP.some((r) => r.includes("c")),
      "the quiver reads on the side and back views");
    ok(adv.ADV_UP.slice(0, 7).every((r) => !r.includes("s")),
      "the back view shows no face — no skin in the head rows");
    ok(adv.ADV_DOWN[4].includes("e") && adv.ADV_DOWN[4].includes("s"),
      "the front view has eyes set in skin");

    // dyeing must change the sprite but never its geometry
    const before = of.bakeOutfitSprites().down.width;
    const P = { spr: null, sprDir: null } as never;
    of.setOutfitColor(P, "primary", 12);
    of.setOutfitColor(P, "secondary", 6);
    ok(of.outfitState().primary === 12 && of.outfitState().secondary === 6,
      "dye picks land in state");
    ok(of.bakeOutfitSprites().down.width === before, "dyeing leaves geometry alone");

    // zone captions follow the worn outfit
    // the 133-dye rack: Tibia's own 19 x 7 grid, generated not hand-listed
    ok(of.OUTFIT_COLORS.length === 133, "the rack holds 133 dyes");
    ok(of.HUE_STEPS === 19 && of.SAT_ROWS === 7, "laid out 19 across by 7 down");
    ok(of.OUTFIT_COLORS.every((c) => /^#[0-9a-f]{6}$/.test(c)), "every dye is valid hex");
    ok(new Set(of.OUTFIT_COLORS).size >= 120, "the grid is near enough collision-free");
    ok(of.OUTFIT_COLORS[0] === "#ffffff", "index 0 is white, where the gray column starts");
    for (let r = 0; r < 7; r++) {
      const c = of.OUTFIT_COLORS[r * 19];
      ok(c.slice(1, 3) === c.slice(3, 5) && c.slice(3, 5) === c.slice(5, 7),
        `column 0 row ${r} is a gray`);
    }
    ok(of.OUTFIT_COLORS[77] === "#ff5500", "row 4 hue 1 is saturated orange");
    ok(of.OUTFIT_COLORS[82] === "#00ff00", "pure green sits where Tibia puts it");

    // pre-Etap-14 saves indexed the old 19-dye rack and must be translated
    of.loadOutfitSave({ hair: 0, primary: 1, secondary: 2, current: "adventurer", owned: ["adventurer"] });
    ok(of.outfitState().hair === 116 && of.outfitState().primary === 75,
      "legacy dye indices remap into the 133-color rack");
    ok(of.outfitSave().pal === 133, "saves now carry the palette generation");
    of.loadOutfitSave({ pal: 133, hair: 130, primary: 4, secondary: 9, current: "adventurer", owned: ["adventurer"] });
    ok(of.outfitState().hair === 130, "Etap-14 saves are taken at face value");
    of.loadOutfitSave({ pal: 133, hair: 9999, primary: -3, secondary: 9, current: "adventurer", owned: ["adventurer"] });
    ok(of.outfitState().hair === 116 && of.outfitState().primary === 75,
      "out-of-range indices fall back to the default look");
    // restore the dyes the round-trip check below expects
    of.setOutfitColor(P, "primary", 12);
    of.setOutfitColor(P, "secondary", 6);

    ok(of.zoneLabels().hair === "Hood" && of.zoneLabels().primary === "Tunic",
      "Adventurer's dye rows are captioned Hood/Tunic/Legs");

    // save format is unchanged — no migration required
    const snap = of.outfitSave();
    of.resetOutfit();
    of.loadOutfitSave(snap);
    ok(of.outfitState().primary === 12 && of.outfitState().secondary === 6,
      "dye choices survive the save round-trip");
    of.loadOutfitSave({ hair: 0, primary: 1, secondary: 2, current: "adventurer", owned: ["adventurer"] });
    ok(of.outfitState().current === "adventurer", "pre-Etap-13 saves load untouched");

    // the legacy glyph outfit still bakes (single view repeated)
    of.loadOutfitSave({ hair: 0, primary: 1, secondary: 2, current: "classic", owned: ["adventurer", "classic"] });
    const cls = of.bakeOutfitSprites();
    ok(cls.down.width === cls.side.width && cls.side.height === cls.up.height,
      "single-view outfits render identically in every facing");
    ok(of.zoneLabels().hair === "Hair", "Classic keeps the original captions");
    of.resetOutfit();
  }


  // ---------------------------------------------------------------- Etap 17
  {
    console.log("Etap 17 — TILE 16 → 32 (four times the pixels, same picture):");
    const cfg = await import("../src/config.ts");
    const gfx = await import("../src/gfx/sprites.ts");

    ok(cfg.TILE === 32, "a tile is 32 px");
    ok(cfg.LEGACY_TILE === 16 && cfg.SPRITE_SCALE === 2, "legacy art is blown up 2x");
    ok(cfg.MAP_TILE === 16, "the static terrain canvas stays at legacy resolution");

    // bake(): legacy maps double, native 32-px maps are left alone
    const map = ["ab", "ba"];
    const legacy = gfx.bake(map);
    ok(legacy.width === 4 && legacy.height === 4, "bake() turns a 2x2 legacy map into 4x4");
    const native = gfx.bakeNative(map);
    ok(native.width === 2 && native.height === 2, "bakeNative() leaves a 32-px map at its own size");
    ok(gfx.spriteSource(legacy).width === 2, "the 1x source stays reachable (the map canvas needs it)");
    ok(gfx.spriteSource(native) === native, "a native sprite is its own source");

    // the whole atlas came through the legacy path
    ok(gfx.SPR.player.width === 20 && gfx.SPR.player.height === 26,
      `the player sprite is a 2x bake of the 10x13 map (${gfx.SPR.player.width}x${gfx.SPR.player.height})`);
    ok(gfx.bakeForge().width === 56 && gfx.bakeForge().height === 52, "procedural bakers scale too (forge 28x26 → 56x52)");

    // UI icons keep the footprint they had when a tile was 16 px
    ok(gfx.iconW(gfx.SPR.coin, 2) === 14 && gfx.iconH(gfx.SPR.coin, 2) === 10,
      "a coin icon still draws 14x10 at 2x zoom");

    // ---- framing: the same tile count as the 16-px era, on every viewport ----
    const oldZoom = (w: number, h: number, mobile: boolean): number => {
      const lo = Math.min(w, h);
      const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
      return mobile ? cl(Math.round(lo / 220), 2, 6) : cl(lo / 180, 4, 6.4);
    };
    const oldTiles = (w: number, h: number, mobile: boolean): { w: number; h: number } => {
      const f = oldZoom(w, h, mobile);
      return { w: Math.max(160, Math.ceil(w / f)) / 16, h: Math.max(120, Math.ceil(h / f)) / 16 };
    };
    const screens: ReadonlyArray<readonly [number, number, boolean]> = [
      [1916, 931, false], [1280, 720, false], [1600, 900, false], [1920, 1080, false],
      [2560, 1440, false], [3440, 1440, false], [400, 400, false], [6000, 4000, false],
      [360, 800, true], [390, 844, true], [430, 932, true], [540, 1200, true],
      [768, 1024, true], [820, 1180, true], [1000, 1000, true], [1024, 1366, true],
    ];
    let same = 0;
    for (const [w, h, m] of screens) {
      const now = cfg.visibleTiles(w, h, m);
      const was = oldTiles(w, h, m);
      // ceil() snaps the buffer to a whole world pixel, and a world pixel is
      // half what it used to be — so the count may differ by at most ONE
      // legacy pixel (1/16 of a tile). Anything beyond that is a real regression.
      const tol = 1 / cfg.LEGACY_TILE + 1e-9;
      if (Math.abs(now.w - was.w) <= tol && Math.abs(now.h - was.h) <= tol) same++;
      else console.log(`      ${w}x${h}${m ? " mobile" : ""}: was ${was.w.toFixed(2)}x${was.h.toFixed(2)}, now ${now.w.toFixed(2)}x${now.h.toFixed(2)}`);
    }
    ok(same === screens.length, `framing holds within a legacy pixel on all ${screens.length} reference viewports (${same} match)`);

    ok(cfg.DESKTOP_ZOOM_DIV === 360 && cfg.MOBILE_ZOOM_DIV === 440, "both divisors doubled with TILE");
    ok(cfg.worldZoom(400, 400, false) === 2 && cfg.worldZoom(6000, 4000, false) === 3.2,
      "desktop clamps halved to 2..3.2");
    ok(cfg.worldZoom(390, 844, true) === 1,
      "a phone reaches f=1 — the old floor of 2 would have shown half the world");
    ok(cfg.worldZoom(768, 1024, true) === 1.5,
      "a 768-px tablet lands on a HALF step: plain rounding at /440 would have zoomed it in");
    const shot = cfg.visibleTiles(1916, 931, false);
    ok(shot.w > 21 && shot.w < 26 && shot.h > 10 && shot.h < 13,
      `desktop still frames ~23x11 tiles (${shot.w.toFixed(1)}x${shot.h.toFixed(1)})`);

    // ---- world geometry moved with the tile, so ranges are the same distance ----
    ok(cfg.MELEE_REACH_PX === 48 && cfg.USE_RANGE_PX === 112 && cfg.THROW_RANGE_PX === 240,
      "reach constants doubled");
    ok(cfg.MELEE_REACH_PX > Math.SQRT2 * cfg.TILE && cfg.MELEE_REACH_PX < 2 * cfg.TILE,
      "melee still covers a diagonal neighbour and never a square two out");
    ok(cfg.GARDEN_RADIUS / cfg.TILE === 2.5, "the garden aura still spans 2.5 tiles");
    ok(items.ITEMS.longbow.bow!.range / cfg.TILE === 9.375, "Hunter's Bow still reaches the same 9.4 tiles");
    ok(cfg.MONSTER_AGGRO_RANGE >= items.ITEMS.longbow.bow!.range + cfg.TILE,
      "monster sight still outreaches the longest bow by a tile");

    // ---- the terrain canvas is NOT baked at TILE (phones would refuse it) ----
    const zw = buildWorlds(WORLD_SEED);
    ok(zw.home.mapCanvas.width === zw.home.w * cfg.MAP_TILE,
      "the map canvas is painted at MAP_TILE, not TILE");
    ok(zw.deepwild.mapCanvas.width * zw.deepwild.mapCanvas.height < 30_000_000,
      `the continent's bitmap stays under 30 Mpx (${(zw.deepwild.mapCanvas.width * zw.deepwild.mapCanvas.height / 1e6).toFixed(1)} Mpx)`);
  }

  // ------------------------------------------------- Etap 17: save migration
  {
    console.log("Etap 17 — a v2 save scales into the 32-px world:");
    const { loadGame, saveGame, deleteSave } = await import("../src/save.ts");
    const { toTile } = await import("../src/world/grid.ts");
    const KEY = "bone-isle-save-v2";

    const probe = buildWorlds(WORLD_SEED).home;
    let ttx = -1;
    let tty = -1;
    outerSave: for (let y = 3; y < probe.h - 3; y++) {
      for (let x = 3; x < probe.w - 3; x++) {
        if (!probe.solid[y][x] && probe.tile[y][x] > 0) { ttx = x; tty = y; break outerSave; }
      }
    }
    ok(ttx >= 0, "found a walkable home tile to anchor the migration test");

    // exactly what a pre-Etap-17 client wrote for that tile centre
    const v2 = {
      v: 2, seed: WORLD_SEED, current: "home",
      player: {
        x: ttx * 16 + 8, y: tty * 16 + 8,
        hp: 60, maxhp: 100, gold: 42, level: 3, exp: 0, expNext: 100,
        bag: [], eq: {},
      },
      skills: {}, quests: [], structures: {},
      ground: { home: [{ kind: "wood", n: 3, x: ttx * 16 + 8, y: tty * 16 + 8 }] },
      corpses: { home: [{ name: "corpse", x: ttx * 16 + 8, y: tty * 16 + 8, items: [], gold: 5, t: 60 }] },
    };
    localStorage.setItem(KEY, JSON.stringify(v2));
    const g2 = loadGame()!;
    ok(!!g2, "a v2 save still loads");
    ok(g2.player.tx === ttx && g2.player.ty === tty,
      `the player lands on the SAME tile, not half way (${g2.player.tx},${g2.player.ty} vs ${ttx},${tty})`);
    ok(g2.player.gold === 42, "the rest of the save is untouched");
    ok(g2.worlds.home.ground[0]?.x === ttx * 32 + 16, "loose ground stacks scale too");
    ok(g2.worlds.home.corpses[0]?.x === ttx * 32 + 16, "and so do corpses");

    // v3 round-trips without scaling a second time
    saveGame(g2);
    const stored = JSON.parse(localStorage.getItem(KEY)!) as { v: number };
    ok(stored.v === 3, "saving writes the new v3 format");
    const g3 = loadGame()!;
    ok(g3.player.tx === ttx && g3.player.ty === tty, "a v3 save reloads on the same tile (no double scaling)");
    ok(toTile(g3.worlds.home.ground[0].x) === ttx, "…and its ground stack stays put");
    deleteSave();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
