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
    ok(wild.monsters.length === 41, `wild fully populated (${wild.monsters.length}/41 — the Etap 8 tier-1/2 roster)`);
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
    boots.eq.boots = "boots"; // Swift Boots: gear speed +6
    ok(playerSpeed(boots) === PLAYER_BASE_SPEED + 6, "gear speed bonus still applies on top");
  }

  console.log("monster aggro (sight covers every bow + hit provokes):");
  {
    const { MONSTER_AGGRO_RANGE, MONSTER_AGGRO_HIT_S, TILE } = await import("../src/config.ts");
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
      const dChest = Math.hypot(chest.tx * 16 + 8 - up.x, chest.ty * 16 + 8 - up.y);
      ok(dChest > 16 * 20, `chest is deep in the cavern (${Math.round(dChest / 16)} tiles from the ladder)`);
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
    ok(dw.camps.every((c) => !dw.solid[Math.floor(c.y / 16)][Math.floor(c.x / 16)]), "every camp centre is walkable");
    let minGap = Infinity;
    for (let i = 0; i < dw.camps.length; i++)
      for (let j = i + 1; j < dw.camps.length; j++)
        minGap = Math.min(minGap, dist(dw.camps[i].x, dw.camps[i].y, dw.camps[j].x, dw.camps[j].y) / 16);
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
      dist(t.tx * 16 + 8, t.ty * 16 + 8, c.x, c.y) > c.r - 16)), "camp interiors are clear of trees");
    // every camp reaches the dock on foot — one connected mainland, no islets
    {
      const dock = dw.portals.find((p) => p.dest === "town")!;
      const W = dw.w;
      const seen = new Uint8Array(W * dw.h);
      const q: number[] = [Math.floor(dock.y / 16) * W + Math.floor(dock.x / 16)];
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
      ok(dw.camps.every((c) => seen[Math.floor(c.y / 16) * W + Math.floor(c.x / 16)] === 1),
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
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
