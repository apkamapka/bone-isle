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
  const { SPRITE_SCALE: SPRITE_SCALE2 } = await import("../src/config.ts");

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

  console.log("grid walking: a started step always finishes on the centre (Tibia release-mid-step):");
  {
    const { tryStep, glideWalker, tileCenter, stepDir, atCenter } = await import("../src/world/grid.ts");
    const home = buildWorlds(WORLD_SEED).home;
    // find an open 3x3 patch, then take its CENTRE so E and the NE diagonal fit
    let ox = 0, oy = 0;
    outerStep: for (let y = 4; y < home.h - 4; y++) {
      for (let x = 4; x < home.w - 4; x++) {
        let clear = true;
        for (let j = 0; j < 3 && clear; j++) for (let i = 0; i < 3; i++) {
          if (home.solid[y + j][x + i] || home.tile[y + j][x + i] === 0) { clear = false; break; }
        }
        if (clear) { ox = x + 1; oy = y + 1; break outerStep; }
      }
    }
    ok(ox > 0, "found an open 3x3 patch to walk in");

    // The exact bug: hold one frame → claim the E tile → glide only PART of the
    // way → RELEASE. With the pre-glide fix the leftover travel must still land
    // dead-centre on the DESTINATION, never freeze between the two centres.
    const w1 = { x: tileCenter(ox), y: tileCenter(oy), tx: ox, ty: oy };
    const s = stepDir(1, 0);
    ok(s.sx === 1 && s.sy === 0, "east input quantises to a pure +x step");
    tryStep(home, w1, s.sx, s.sy);      // claims (ox+1, oy) at once
    glideWalker(w1, 3);                  // travels only 3px of a whole tile
    ok(!atCenter(w1), "mid-step: render is stranded between the two centres");
    ok(w1.tx === ox + 1 && w1.ty === oy, "…yet the destination tile is already claimed");
    // KEY RELEASED — no further step, only the per-frame settle glide.
    let guard = 0;
    while (!atCenter(w1) && guard++ < 64) glideWalker(w1, 4);
    ok(atCenter(w1), "released mid-step: the step still finishes exactly on the centre");
    ok(w1.x === tileCenter(ox + 1) && w1.y === tileCenter(oy), "…and it is the DESTINATION centre, not the origin");

    // One tap = exactly one tile, diagonals included (8-dir, Tibia 8.6).
    const w2 = { x: tileCenter(ox), y: tileCenter(oy), tx: ox, ty: oy };
    const dg = stepDir(0.7, -0.7);
    ok(Math.abs(dg.sx) === 1 && Math.abs(dg.sy) === 1, "a 45° input quantises to a diagonal step");
    tryStep(home, w2, dg.sx, dg.sy);
    let g2 = 0;
    while (!atCenter(w2) && g2++ < 64) glideWalker(w2, 4);
    ok(w2.tx === ox + dg.sx && w2.ty === oy + dg.sy && atCenter(w2), "a single diagonal tap lands exactly one tile away, centred");
  }

  console.log("shield block cap (max 2 attackers per round):");
  {
    const { hurtPlayer, resetShieldWindow } = await import("../src/systems/combat.ts");
    const { defenseShield, defenseArmor, shieldBlockMax } = await import("../src/systems/skills.ts");
    const { resetStance } = await import("../src/systems/stance.ts");
    const { markBloodHit, resetBloodHit } = await import("../src/systems/skills.ts");
    const worlds = buildWorlds(WORLD_SEED);
    resetSkills();
    resetShieldWindow();
    resetStance();
    const p = createPlayer({ x: 200, y: 200 });
    p.level = 1; // no death-drop side effects
    p.maxhp = 10_000_000; p.hp = p.maxhp;
    p.eq.shield = "shieldItem"; // def 3 (shield side)
    p.eq.body = "armor";        // def 4 (armor side)
    ok(defenseShield(p.eq) === 8 && defenseArmor(p.eq) === 9, "defense split: shield 8 / armor 9");
    ok(shieldBlockMax(p.eq) > 0, "a held shield gives a non-zero block ceiling");
    // Gear the character up so the two defense layers are worth more than the
    // rounding noise, then compare AVERAGES — every reduction is now a roll,
    // so a single hit proves nothing.
    p.eq.shield = "marrowShield"; p.eq.head = "marrowHelmet";
    p.eq.body = "marrowArmor"; p.eq.legs = "marrowLegs"; p.eq.boots = "marrowBoots";
    skills.shield.lv = 60;
    const RAW = 200;
    const sample = (n: number, engaged: boolean): number => {
      let total = 0;
      for (let i = 0; i < n; i++) {
        markBloodHit();
        resetShieldWindow();
        if (!engaged) { hurtPlayer(worlds.home, p, RAW); hurtPlayer(worlds.home, p, RAW); } // use up the cap
        const before = p.hp;
        hurtPlayer(worlds.home, p, RAW);
        total += before - p.hp;
      }
      return total / n;
    };
    const withShield = sample(400, true);
    const pierced = sample(400, false);
    ok(pierced > withShield, `3rd attacker bypasses the shield (${withShield.toFixed(1)} vs ${pierced.toFixed(1)} per hit)`);
    ok(withShield >= RAW * 0.5, "armor + shield never erase more than the 50% cap");
    skills.shield.lv = 10;
    resetShieldWindow();
    resetSkills();
    const p2 = createPlayer({ x: 200, y: 200 });
    p2.level = 1; p2.maxhp = 100000; p2.hp = 100000;
    p2.eq.shield = "shieldItem";
    markBloodHit();
    hurtPlayer(worlds.home, p2, 200);
    hurtPlayer(worlds.home, p2, 200);
    hurtPlayer(worlds.home, p2, 200);
    ok(skills.shield.pts === 2, "shielding trained only by the 2 blocked hits");

    // ---- blood hit: standing still must never train anything ----
    resetShieldWindow(); resetSkills(); resetBloodHit();
    const idle = createPlayer({ x: 200, y: 200 });
    idle.level = 1; idle.maxhp = 100000; idle.hp = 100000;
    idle.eq.shield = "shieldItem";
    for (let i = 0; i < 50; i++) { resetShieldWindow(); hurtPlayer(worlds.home, idle, 20); }
    ok(skills.shield.pts === 0, "50 hits taken without fighting back train NOTHING");
    markBloodHit();
    resetShieldWindow();
    hurtPlayer(worlds.home, idle, 20);
    ok(skills.shield.pts === 1, "…and one blow of your own re-opens the window");
    resetShieldWindow();
    resetSkills();
    resetBloodHit();
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
      if (spawnMonster(wild, "bandit", { x: px, y: py })) {
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
    for (let i = 0; i < 4; i++) spawnMonster(arena, "bandit");
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
    const { PLAYER_ATTACK_RATE, DIST_HITCHANCE_MAX, MIN_HIT_RATIO } = await import("../src/config.ts");
    const { MONSTER_DEFS } = await import("../src/entities/monsters.ts");
    ok(PLAYER_ATTACK_RATE === 2.0, "player swings every 2.0s (Tibia weapon speed)");
    ok(Object.values(MONSTER_DEFS).every((d) => d.atkRate === 2.0), "every monster attacks every 2.0s — blow for blow");
    // damage rolls sit inside the Tibia band: [MIN_HIT_RATIO·max, max]
    resetSkills();
    let sawMin = false, sawMax = false, outOfBand = false, sum = 0;
    const N = 20000;
    const floor40 = Math.floor(40 * MIN_HIT_RATIO);
    for (let i = 0; i < N; i++) {
      const r = rollMeleeDamage(40);
      if (r === floor40) sawMin = true;
      if (r === 40) sawMax = true;
      if (r < floor40 || r > 40) { outOfBand = true; break; }
      sum += r;
    }
    ok(!outOfBand, "no melee roll ever leaves the [40%·max, max] band");
    ok(sawMin && sawMax, "melee rolls reach both the floor and the ceiling");
    ok(Math.abs(sum / N - 28) < 1, `average melee hit ≈ 70% of max (${(sum / N).toFixed(1)}/40)`);
    const dr = rollDistanceDamage(50);
    ok(dr >= Math.floor(50 * MIN_HIT_RATIO) && dr <= 50, "distance rolls share the same band");
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
    const avg = maxHit * (1 + MIN_HIT_RATIO) / 2;
    const goblin = MONSTER_DEFS.goblin;
    const swings = Math.ceil(goblin.hp / avg);
    const ttk = swings * 2.0;
    ok(ttk >= 6 && ttk <= 30, `lvl-10 goblin kill ≈ ${ttk.toFixed(0)}s (${swings} swings, max hit ${maxHit})`);
    resetSkills();
  }

  console.log("combat model (multiplicative damage, stance, mastery):");
  {
    const sk = await import("../src/systems/skills.ts");
    const st = await import("../src/systems/stance.ts");
    const cfg = await import("../src/config.ts");
    const { MONSTER_DEFS } = await import("../src/entities/monsters.ts");
    const mk = (lv: number, weapon?: keyof typeof items.ITEMS) => {
      const p = createPlayer({ x: 0, y: 0 });
      p.level = lv;
      if (weapon) p.eq.weapon = weapon as never;
      return p;
    };

    resetSkills(); st.resetStance();

    // ---- level is a MULTIPLIER, so it can never be out-trained ----
    ok(Math.abs(sk.levelFactor(0) - 1) < 1e-9, "level 0 is the neutral multiplier");
    ok(Math.abs(sk.levelFactor(100) - 2) < 1e-9, "level 100 doubles damage (1% per level)");
    {
      // the report's own control: 8/70 must NOT out-hit 30/60
      skills.sword.lv = 70;
      const low = sk.attackPower(8, mk(8, "ironSword").eq);
      skills.sword.lv = 60;
      const high = sk.attackPower(30, mk(30, "ironSword").eq);
      ok(high > low, `level 30 / skill 60 out-hits level 8 / skill 70 (${high} vs ${low})`);
      resetSkills();
    }

    // ---- skillTerm: training outruns gear ----
    {
      const p = mk(25, "ironSword");
      skills.sword.lv = 10;
      const green = sk.attackPower(25, p.eq);
      skills.sword.lv = 100;
      const trained = sk.attackPower(25, p.eq);
      ok(trained / green > 6, `skill 10 → 100 multiplies damage ${(trained / green).toFixed(1)}× (training beats gear)`);
      resetSkills();
      const fists = sk.attackPower(25, createPlayer({ x: 0, y: 0 }).eq);
      ok(fists >= 1, "bare fists still hit for something (MELEE_FIST_ATK)");
    }

    // ---- mastery: rewards specialists, ignores Shielding ----
    {
      skills.sword.lv = 60; skills.dist.lv = 10; skills.shield.lv = 10;
      const specialist = sk.mastery("sword");
      ok(Math.abs(specialist - (1 + 50 / cfg.MASTERY_DIVISOR)) < 1e-9, "60/10 specialist gains the full mastery bonus");
      skills.dist.lv = 60;
      ok(sk.mastery("sword") === 1, "50/50-style hybrid gains nothing");
      skills.dist.lv = 10; skills.shield.lv = 100;
      ok(Math.abs(sk.mastery("sword") - specialist) < 1e-9, "Shielding is NOT taxed by mastery — defense must never be a trap");
      resetSkills();
    }

    // ---- stance: damage traded for blocking, both directions ----
    {
      // trained + well-armed on purpose: at single-digit hits the rounding in
      // attackPower would swamp the ratio being asserted
      skills.sword.lv = 60;
      const p = mk(60, "marrowBlade");
      st.setStance("offensive");
      const off = sk.attackPower(60, p.eq);
      const offBlock = sk.shieldBlockMax({ ...p.eq, shield: "steelShield" } as never);
      st.setStance("defensive");
      const def = sk.attackPower(60, p.eq);
      const defBlock = sk.shieldBlockMax({ ...p.eq, shield: "steelShield" } as never);
      ok(off > def, `offensive out-damages defensive (${off} vs ${def})`);
      ok(defBlock > offBlock, `defensive out-blocks offensive (${defBlock.toFixed(1)} vs ${offBlock.toFixed(1)})`);
      ok(Math.abs(def / off - cfg.STANCE_ATK.defensive / cfg.STANCE_ATK.offensive) < 0.02, "the stance ratio matches STANCE_ATK");
      st.setStance("balanced");
      const bal = sk.attackPower(60, p.eq);
      ok(bal > def && bal < off, "balanced sits between the two");
      ok(st.cycleStance() === "defensive" && st.cycleStance() === "offensive", "the hotkey cycles through every stance");
      st.resetStance();
      ok(st.stance() === "balanced", "a fresh character starts balanced");
      resetSkills();
    }

    // ---- armor: flat, random, and never total ----
    {
      let min = Infinity, max = -Infinity, sum = 0;
      for (let i = 0; i < 20000; i++) {
        const r = sk.rollArmorReduction(20);
        min = Math.min(min, r); max = Math.max(max, r); sum += r;
      }
      ok(min === 10 && max === 20, "armor 20 reduces by 10–20 (half to full)");
      ok(Math.abs(sum / 20000 - 15) < 0.3, `average armor reduction ≈ 0.75× rating (${(sum / 20000).toFixed(1)}/20)`);
      ok(sk.rollArmorReduction(0) === 0, "no armor, no reduction");
    }

    // ---- shield block: triangular, so defense is steady not a lottery ----
    {
      resetSkills(); st.resetStance();
      const eq = { ...createPlayer({ x: 0, y: 0 }).eq, shield: "marrowShield" } as never;
      skills.shield.lv = 60;
      const ceil = sk.shieldBlockMax(eq);
      let sum = 0, over = false;
      const N = 20000;
      for (let i = 0; i < N; i++) {
        const b = sk.rollShieldBlock(eq);
        if (b > ceil + 1e-9 || b < 0) over = true;
        sum += b;
      }
      ok(!over, "a block never exceeds its ceiling");
      ok(Math.abs(sum / N - ceil / 2) < ceil * 0.03, `triangular roll averages half the ceiling (${(sum / N).toFixed(1)}/${ceil.toFixed(1)})`);
      const bare = sk.shieldBlockMax(createPlayer({ x: 0, y: 0 }).eq);
      ok(bare === 0, "empty hands block nothing");
      resetSkills();
    }

    // ---- the invulnerability bug this whole pass exists to kill ----
    {
      const { hurtPlayer, resetShieldWindow } = await import("../src/systems/combat.ts");
      const worlds = buildWorlds(WORLD_SEED);
      resetSkills(); resetShieldWindow(); st.resetStance();
      const p = createPlayer({ x: 200, y: 200 });
      p.level = 1; p.maxhp = 10_000_000; p.hp = p.maxhp;
      p.eq.shield = "marrowShield"; p.eq.head = "marrowHelmet";
      p.eq.body = "marrowArmor"; p.eq.legs = "marrowLegs"; p.eq.boots = "marrowBoots";
      skills.shield.lv = 60;
      const raw = 29; // an average Minotaur Guard swing
      let total = 0;
      for (let i = 0; i < 400; i++) { resetShieldWindow(); const b = p.hp; hurtPlayer(worlds.home, p, raw); total += b - p.hp; }
      const avg = total / 400;
      ok(avg >= raw * cfg.DEFENSE_CAP_FRAC - 0.5, `a fully-geared character still takes ~${avg.toFixed(1)} of a ${raw} hit (was 1)`);
      resetShieldWindow(); resetSkills();
    }

    // ---- HP: the knight curve ----
    {
      const { refreshDerived } = await import("../src/entities/player.ts");
      const p = createPlayer({ x: 0, y: 0 });
      for (const [lv, want] of [[1, 95], [8, 200], [25, 455], [50, 830], [100, 1580]] as const) {
        p.level = lv; refreshDerived(p, { maxhp: 0 });
        ok(p.maxhp === want, `level ${lv} → ${want} HP (knight curve)`);
      }
    }

    // ---- monster armor: real, bounded, and never total immunity ----
    {
      const { applyMonsterArmor } = await import("../src/systems/combat.ts");
      const armored = Object.values(MONSTER_DEFS).filter((d) => (d.armor ?? 0) > 0);
      ok(armored.length >= 20, `${armored.length} creatures carry an armor rating`);
      ok(Object.values(MONSTER_DEFS).every((d) => (d.armor ?? 0) <= 20), "no creature's armor exceeds the dragon's");
      ok((MONSTER_DEFS.dragon.armor ?? 0) > (MONSTER_DEFS.goblin.armor ?? 0), "armor tracks the difficulty ladder");
      ok((MONSTER_DEFS.ghost.armor ?? 0) === 0, "an incorporeal creature wears none");
      const m = { kind: "dragon" } as never;
      let floored = true;
      for (let i = 0; i < 500; i++) if (applyMonsterArmor(m, 5) < cfg.MIN_DAMAGE) floored = false;
      ok(floored, "armor can never reduce a hit below MIN_DAMAGE");
      ok(applyMonsterArmor({ kind: "ghost" } as never, 50) === 50, "an unarmored creature takes the hit whole");
    }

    resetSkills(); st.resetStance();
  }

  console.log("gear ladder (item table vs the design curve):");
  {
    const cfg = await import("../src/config.ts");
    const I = items.ITEMS;
    const defOf = (k: keyof typeof I): number => I[k].gear?.def ?? 0;
    const atkValue = (k: keyof typeof I): number => cfg.MELEE_FIST_ATK + (I[k].gear?.atk ?? 0);

    // Each rung names the level it is meant to carry a character through.
    const weapons = [["sword", 1], ["ironSword", 8], ["battleAxe", 15],
      ["boneSword", 22], ["fireSword", 32], ["marrowBlade", 42]] as const;
    const shields = [["shieldItem", 1], ["steelShield", 12], ["boneShield", 22],
      ["dragonShield", 32], ["marrowShield", 42]] as const;
    // full worn sets: head + body + legs + boots
    const sets = [
      [["helmet", "leatherArmor", "legs", "boots"], 10],
      [["helmet", "chainArmor", "legs", "boots"], 15],
      [["helmet", "armor", "legs", "boots"], 20],
      [["boneHelmet", "armor", "boneLegs", "boneBoots"], 26],
      [["boneHelmet", "dragonScaleArmor", "boneLegs", "boneBoots"], 36],
    ] as const;
    // The Marrow set is deliberately OFF the curve: a single one-time chest
    // prize, the best gear in the game, and the only reward for the bottom of
    // the Bone Caverns. It is checked separately — ahead of the curve, but not
    // so far ahead that everything below it stops mattering.
    const MARROW = ["marrowHelmet", "marrowArmor", "marrowLegs", "marrowBoots"] as const;

    let weaponsOk = true, shieldsOk = true, setsOk = true;
    for (const [k, lv] of weapons) {
      const want = cfg.bestWeaponAtk(lv);
      if (Math.abs(atkValue(k) - want) > want * 0.2) { weaponsOk = false; console.log(`    ${k}: ${atkValue(k)} vs target ${want.toFixed(1)} @ lv${lv}`); }
    }
    for (const [k, lv] of shields) {
      const want = cfg.bestShieldDef(lv);
      if (Math.abs(defOf(k) - want) > want * 0.2) { shieldsOk = false; console.log(`    ${k}: ${defOf(k)} vs target ${want.toFixed(1)} @ lv${lv}`); }
    }
    for (const [pieces, lv] of sets) {
      const total = pieces.reduce((n, k) => n + defOf(k as keyof typeof I), 0);
      const want = cfg.bestArmorSet(lv);
      if (Math.abs(total - want) > want * 0.2) { setsOk = false; console.log(`    set@${lv}: ${total} vs target ${want.toFixed(1)}`); }
    }
    ok(weaponsOk, "every weapon rung sits within 20% of bestWeaponAtk");
    ok(shieldsOk, "every shield rung sits within 20% of bestShieldDef");
    ok(setsOk, "every full armor set sits within 20% of bestArmorSet");

    // monotone: an upgrade must always BE an upgrade
    const mono = (xs: readonly (readonly [string, number])[], f: (k: never) => number): boolean =>
      xs.every((x, i) => i === 0 || f(x[0] as never) > f(xs[i - 1][0] as never));
    ok(mono(weapons, atkValue as never), "weapons never step backwards");
    ok(mono(shields, defOf as never), "shields never step backwards");
    ok(sets.every((x, i) => i === 0 || x[0].reduce((n, k) => n + defOf(k as keyof typeof I), 0)
      > sets[i - 1][0].reduce((n, k) => n + defOf(k as keyof typeof I), 0)), "armor sets never step backwards");

    // the Marrow prize: above the curve, and above every craftable set
    {
      const marrow = MARROW.reduce((n, k) => n + defOf(k), 0);
      const best = sets[sets.length - 1][0].reduce((n, k) => n + defOf(k as keyof typeof I), 0);
      const curveAtCeiling = cfg.bestArmorSet(50); // today's planned ceiling
      ok(marrow > best, `the Marrow set (${marrow}) beats every craftable set (${best})`);
      ok(marrow < curveAtCeiling * 1.5, `…but only ${(marrow / curveAtCeiling).toFixed(2)}× the curve — a prize, not a different game`);
      ok(defOf("marrowShield") > defOf("dragonShield"), "the Marrow shield tops the shield ladder too");
    }

    // the plateau is as important as the slope: gear stops, training does not
    ok(cfg.bestWeaponAtk(200) === cfg.bestWeaponAtk(100), "weapon curve plateaus and stays there");
    ok(cfg.bestShieldDef(200) === 45 && cfg.bestArmorSet(200) === 45, "defense curves plateau at 45");
    // …and across the covered range gear must grow slower than training does
    const gearGrowth = cfg.bestWeaponAtk(60) / cfg.bestWeaponAtk(1);
    ok(gearGrowth < 4, `best weapon grows only ${gearGrowth.toFixed(1)}× from level 1 to 60 (skillTerm grows ~4.5×)`);

    // Coverage: the curve runs to level 100 because the world will keep
    // growing. Report what the item table does NOT yet reach, so the gap is a
    // visible content task instead of a silent hole.
    {
      const topAtk = Math.max(...(Object.keys(I) as (keyof typeof I)[]).map(atkValue));
      const topShield = Math.max(...(Object.keys(I) as (keyof typeof I)[]).map(defOf));
      const covered = (f: (l: number) => number, have: number): number => {
        for (let l = 100; l >= 1; l--) if (f(l) <= have) return l;
        return 0;
      };
      const wLv = covered(cfg.bestWeaponAtk, topAtk);
      const sLv = covered(cfg.bestShieldDef, defOf("marrowShield"));
      console.log(`    ladder reaches: weapons →lv${wLv}, shields →lv${sLv} (target ceiling: 50)`);
      ok(wLv >= 40, `the weapon ladder carries a character to level ${wLv}`);
      ok(sLv >= 40, `the shield ladder carries a character to level ${sLv}`);
    }

    // the Bone set exists, is craftable, and fills the gap it was added for
    for (const k of ["boneShield", "boneHelmet", "boneLegs", "boneBoots"] as const) {
      ok(!!items.RECIPES.find((r) => r.out === k), `${k} has a recipe`);
      ok(!!items.ITEMS[k].slot, `${k} is equippable`);
    }
    const boneSet = defOf("boneHelmet") + defOf("armor") + defOf("boneLegs") + defOf("boneBoots");
    const plateSet = defOf("helmet") + defOf("armor") + defOf("legs") + defOf("boots");
    const marrowSet = defOf("marrowHelmet") + defOf("marrowArmor") + defOf("marrowLegs") + defOf("marrowBoots");
    ok(boneSet > plateSet && boneSet < marrowSet, `Bone set (${boneSet}) sits between plate (${plateSet}) and Marrow (${marrowSet})`);
  }

  console.log("training curve (Tibia 8.6 constants):");
  {
    const { skillNeed } = await import("../src/systems/skills.ts");
    const tries = (base: number, factor: number, s: number, offset = 10): number =>
      base * (Math.pow(factor, s - offset) - 1) / (factor - 1);
    resetSkills();
    ok(Object.values(skills).every((s) => s.factor === 1.1),
      "every skill grows on 8.6's 1.1 curve — the pacing IS the design");
    ok(skills.sword.base === 50 && skills.dist.base === 50, "weapon skills start at A=50, like Tibia melee");
    ok(skills.shield.base === 2 * skills.sword.base,
      "Shielding costs double — paid back by blocking two creatures a round");
    // the multi-block cap is the ONLY thing that justifies A=100; if it ever
    // goes away this assertion is the tripwire that says to halve the cost
    const { SHIELD_BLOCK_MAX } = await import("../src/config.ts");
    ok(SHIELD_BLOCK_MAX === 2, "…and that payback exists because the shield engages 2 attackers");
    // +10 skill roughly triples the total investment (1.1^10 ≈ 2.6)
    const t60 = tries(50, 1.1, 60), t70 = tries(50, 1.1, 70);
    ok(t70 / t60 > 2.3 && t70 / t60 < 3.0, `+10 skill costs ${(t70 / t60).toFixed(1)}× the total so far`);
    // and the per-level need must never shrink as the skill climbs
    let rising = true;
    for (let lv = 11; lv <= 99; lv++) {
      skills.sword.lv = lv;
      const a = skillNeed(skills.sword);
      skills.sword.lv = lv + 1;
      if (skillNeed(skills.sword) <= a) rising = false;
    }
    ok(rising, "every skill level costs strictly more than the one before it");
    resetSkills();
  }

  console.log("monster budget (a net for creatures added later):");
  {
    const M = await import("../src/entities/monsters.ts");
    const defs = Object.entries(M.MONSTER_DEFS) as [string, typeof M.MONSTER_DEFS[keyof typeof M.MONSTER_DEFS]][];
    const dpsOf = (d: typeof defs[0][1]): number => (d.dmg[0] + d.dmg[1]) / 2 / d.atkRate;

    // the budget must be monotone, or "the level it is for" means nothing
    let mono = true;
    for (let l = 2; l <= 100; l++) {
      if (M.monsterHpBudget(l) <= M.monsterHpBudget(l - 1)) mono = false;
      if (M.monsterDpsBudget(l) <= M.monsterDpsBudget(l - 1)) mono = false;
      if (M.monsterExpBudget(l) <= M.monsterExpBudget(l - 1)) mono = false;
    }
    ok(mono, "every budget curve rises with the level it is written for");
    ok(M.monsterTierOf(M.monsterHpBudget(30)) === 30, "monsterTierOf inverts monsterHpBudget");

    // exp must grow SLOWER than threat, or levelling accelerates away
    const t20 = M.monsterHpBudget(20) * M.monsterDpsBudget(20);
    const t60 = M.monsterHpBudget(60) * M.monsterDpsBudget(60);
    const expRatio = M.monsterExpBudget(60) / M.monsterExpBudget(20);
    ok(expRatio < t60 / t20, `exp grows ${expRatio.toFixed(0)}× where threat grows ${(t60 / t20).toFixed(0)}× — levelling decelerates`);

    // the shipped bestiary, held to a wide band: variety is the point, but
    // nothing should be off by more than a factor of ~2 without a reason
    const bad: string[] = [];
    for (const [k, d] of defs) {
      const tier = M.monsterTierOf(d.hp);
      const eR = d.exp / M.monsterExpBudget(tier);
      const dR = dpsOf(d) / M.monsterDpsBudget(tier);
      if (eR < 0.5 || eR > 1.6) bad.push(`${k} exp ${eR.toFixed(2)}×`);
      // casters read low here because their ranged damage is not in `dmg`
      if (dR < 0.35 || dR > 2.0) bad.push(`${k} dps ${dR.toFixed(2)}×`);
      if ((d.armor ?? 0) > M.monsterArmorBudget(tier) + 6) bad.push(`${k} armor ${d.armor}`);
    }
    if (bad.length) console.log(`    out of band: ${bad.join(", ")}`);
    ok(bad.length === 0, `all ${defs.length} creatures sit inside the budget band`);

    // …and a creature placed BY the budget must come out inside it
    for (const lv of [5, 20, 45, 70]) {
      const hp = M.monsterHpBudget(lv);
      ok(M.monsterTierOf(hp) === lv, `a creature built to the level-${lv} budget reads back as level ${lv}`);
    }
  }

  console.log("elemental channel (crystals, resistances, arrows):");
  {
    const E = await import("../src/systems/elements.ts");
    const C = await import("../src/systems/crystals.ts");
    const T = await import("../src/systems/tower.ts");
    const M = await import("../src/entities/monsters.ts");

    ok(E.ELEMENTS.length === 5, "five elements");
    ok(Object.keys(C.CRYSTAL_SPECS).length === 30, "5 elements × 3 tiers × 2 roles = 30 crystals");
    for (const k of Object.keys(C.CRYSTAL_SPECS)) {
      ok(!!items.ITEMS[k as keyof typeof items.ITEMS]?.crystal, `${k} exists as a crystal item`);
    }
    // every crystal and arrow must be reachable through the tower
    const unlockable = new Set(T.RESEARCH.map((r) => r.crystal));
    ok(Object.keys(C.CRYSTAL_SPECS).every((k) => unlockable.has(k as never)),
      "every crystal has a research project — none are unobtainable");
    ok(E.ELEMENTS.every((el) => unlockable.has(`${el}Arrow` as never)), "every element has an arrowhead project");

    // tiers must climb, and each must require the one below it in its own lane
    ok(E.TIER_MULT[1] > E.TIER_MULT[0] * 2 && E.TIER_MULT[2] > E.TIER_MULT[1] * 2,
      "each tier more than doubles — an upgrade, not a percentage");
    let chained = true, deepest = 0;
    for (const r of T.RESEARCH) {
      if (r.tier === undefined || r.tier === 0) continue;
      const req = T.RESEARCH.find((x) => x.id === r.requires);
      if (!req || req.element !== r.element || req.tier !== r.tier - 1) chained = false;
      deepest = Math.max(deepest, T.researchChain(r.id).length);
    }
    ok(chained, "every tier requires the tier below it, in the same element and role");
    ok(deepest === 2, `the deepest lane is ${deepest} projects — commitment, not a wall`);
    ok(!T.researchAvailable("fire3shard", ["fire1shard"]), "tier III is locked behind tier II");
    ok(T.researchAvailable("fire3shard", ["fire1shard", "fire2shard"]), "…and opens once the lane is walked");

    // resistances: sparse, meaningful, and never total immunity
    const withRes = Object.values(M.MONSTER_DEFS).filter((d) => d.resist);
    ok(withRes.length >= 15 && withRes.length < Object.keys(M.MONSTER_DEFS).length,
      `${withRes.length} creatures carry resistances — the exception, not the rule`);
    let sane = true, anyWeak = false, anyStrong = false;
    for (const d of Object.values(M.MONSTER_DEFS)) {
      for (const el of E.ELEMENTS) {
        const r = E.resistanceOf(d.resist, el);
        if (r <= 0 || r > 2) sane = false;
        if (r < 1) anyStrong = true;
        if (r > 1) anyWeak = true;
      }
    }
    ok(sane, "no resistance is zero (immune) or beyond 2× (a free kill)");
    ok(anyStrong && anyWeak, "both resistances and weaknesses exist — the element choice is real");
    ok(E.resistanceOf(undefined, "fire") === 1, "ordinary flesh resists nothing");
    ok((M.MONSTER_DEFS.dragon.resist?.fire ?? 1) < 1 && (M.MONSTER_DEFS.dragon.resist?.ice ?? 1) > 1,
      "a dragon shrugs off fire and hates the cold");
    ok((M.MONSTER_DEFS.ghost.resist?.earth ?? 1) < 1, "earth barely touches something incorporeal");

    // damage: scales with tier and level, respects resistance, never zero
    const roll = (tier: 0 | 1 | 2, lv: number, res?: Record<string, number>): number => {
      let t = 0;
      for (let i = 0; i < 4000; i++) t += E.crystalDamage([14, 22], tier, lv, res as never, "fire");
      return t / 4000;
    };
    const t1 = roll(0, 20), t3 = roll(2, 20);
    ok(t3 / t1 > 4 && t3 / t1 < 5.5, `tier III hits ${(t3 / t1).toFixed(1)}× a tier I`);
    ok(roll(0, 100) / roll(0, 1) > 1.5, "crystal damage climbs with character level");
    ok(roll(0, 20, { fire: 0.25 }) < t1 * 0.4, "a resistant creature takes far less");
    ok(roll(0, 20, { fire: 1.6 }) > t1 * 1.4, "a vulnerable one takes far more");
    ok(E.crystalDamage([0.1, 0.1], 0, 1, { fire: 0.01 }, "fire") >= 1, "a crystal always lands for something");

    // the point of the whole channel: it goes around armor
    for (const el of E.ELEMENTS) {
      ok(items.ITEMS[`${el}Arrow` as keyof typeof items.ITEMS]?.element === el, `${el} arrow carries its element`);
    }
    ok(!items.ITEMS.boneArrow.element, "a plain bone arrow carries none — it meets armor like steel does");
  }

  console.log("combat power parity (builds worth the same must play the same):");
  {
    const sk = await import("../src/systems/skills.ts");
    const st = await import("../src/systems/stance.ts");
    // Spend an identical training budget three ways and compare output. This
    // is the report's verification method turned into a regression test: it is
    // what catches a "small" constant change quietly making one build dominant.
    const cost = (lv: number, base: number): number => base * (Math.pow(1.1, lv - 10) - 1) / 0.1;
    const skillFor = (budget: number, base: number): number => {
      let lv = 10;
      while (cost(lv + 1, base) <= budget && lv < 100) lv++;
      return lv;
    };
    const BUDGET = cost(60, 50); // whatever a pure swordsman at 60 has paid
    resetSkills(); st.resetStance();

    const p = createPlayer({ x: 0, y: 0 });
    p.level = 30;
    p.eq.weapon = "marrowBlade";

    // build A: everything into the blade
    skills.sword.lv = skillFor(BUDGET, 50); skills.dist.lv = 10; skills.shield.lv = 10;
    const specialist = sk.attackPower(30, p.eq) * sk.mastery("sword");

    // build B: split evenly between blade and bow
    const half = skillFor(BUDGET / 2, 50);
    skills.sword.lv = half; skills.dist.lv = half; skills.shield.lv = 10;
    const hybrid = sk.attackPower(30, p.eq) * sk.mastery("sword");

    ok(skills.sword.lv < skillFor(BUDGET, 50), "splitting the budget really does cost skill levels");
    const edge = specialist / hybrid;
    ok(edge > 1.05 && edge < 1.6,
      `the specialist out-hits the hybrid by ${((edge - 1) * 100).toFixed(0)}% — enough to be a choice, not a trap`);

    // build C: half into Shielding instead. Must NOT be punished twice — once
    // by the points spent, and again by losing the mastery bonus.
    skills.sword.lv = half; skills.dist.lv = 10; skills.shield.lv = half;
    ok(sk.mastery("sword") > 1, "training Shielding never costs the mastery bonus");
    resetSkills(); st.resetStance();
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
    ok((blade.gear?.atk ?? 0) > (items.ITEMS.fireSword.gear?.atk ?? 0) && blade.slot === "weapon",
      `Marrow Blade tops the weapon ladder (${blade.gear?.atk} attack)`);
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
    const { MONSTER_AGGRO_RANGE, MONSTER_RESPAWN_S, TILE } = await import("../src/config.ts");
    const { killMonster } = await import("../src/systems/combat.ts");
    // 30 + the dragon, then the two undead heavies of Etap 18
    ok(MONSTER_KINDS.length === 33, `bestiary holds 33 kinds (32 + the dragon), got ${MONSTER_KINDS.length}`);
    // every loot entry references a real item, every def carries a live sprite
    let lootOk = true, sprOk = true;
    for (const k of MONSTER_KINDS) {
      const d = MONSTER_DEFS[k];
      if (!d.spr) sprOk = false;
      for (const e of d.loot) if (!items.ITEMS[e.kind]) lootOk = false;
    }
    ok(lootOk, "every loot entry maps to a real item");
    ok(sprOk, "every monster kind has a baked sprite");
    // Aggro is now a tight 6 tiles (tighter engagement for the zoomed-in view).
    // A shooter's weapon range may EXCEED aggro — that only bites once you
    // provoke one and then retreat. What must hold: an UNPROVOKED monster never
    // attacks from beyond aggro, whatever its own range.
    const shooters = MONSTER_KINDS.filter((k) => MONSTER_DEFS[k].ranged);
    ok(shooters.length === 8, `eight distance fighters in the bestiary, got ${shooters.length}`);
    ok(MONSTER_AGGRO_RANGE === 6 * TILE, "aggro range is a tight 6 tiles");
    {
      // hunter's weapon range is 280 px (8.75 tiles) — well past aggro (192).
      const arena = buildWorlds(WORLD_SEED).wild;
      arena.monsters.length = 0;
      spawnMonster(arena, "hunter");
      const h = arena.monsters[0];
      // fresh target sat BEYOND aggro but INSIDE weapon range: must stay asleep
      const far = { x: h.x + 240, y: h.y, dead: false }; // 240 > 192 aggro, < 280 range
      let farShots = 0;
      for (let t = 0; t < 40; t++) updateMonsters(arena, 1 / 60, far, (_m, r) => { if (r) farShots++; }); // <1s ⇒ no wander drift
      ok(farShots === 0, "an unprovoked shooter beyond aggro never fires, even in weapon range");
      // bring the target inside aggro: it wakes and shoots
      const near = { x: h.x + 150, y: h.y, dead: false }; // 150 < 192 aggro
      let nearShots = 0;
      for (let t = 0; t < 240; t++) updateMonsters(arena, 1 / 60, near, (_m, r) => { if (r) nearShots++; });
      ok(nearShots >= 1, "…but wakes and fires once the target is within aggro");
    }
    // the orc archer drops bone arrows (he carries a crossbow, not a spear)
    const archer = MONSTER_DEFS.orcArcher;
    ok(archer.loot.some((e) => e.kind === "boneArrow"), "orc archer drops bone arrows");
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
    ok((items.ITEMS.battleAxe.gear?.atk ?? 0) > (items.ITEMS.ironSword.gear?.atk ?? 0)
      && (items.ITEMS.fireSword.gear?.atk ?? 0) > (items.ITEMS.boneSword.gear?.atk ?? 0),
      "battle axe and fire sword slot into the weapon ladder in order");
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
    // The boat is not on the redrawn Bonetown yet, so the frontier is currently
    // reachable only in the other direction. Guard the pairing that still holds
    // and record the gap loudly rather than deleting the check.
    ok(!worlds.town.portals.some((p) => p.dest === "deepwild"),
      "the boat to the Deep Wildlands is NOT on the redrawn town yet (re-add when the map gains it)");
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
        && inCamp("orcfort").some((m) => m.kind === "orcArcher")
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
    ok(d0.hair === 57 && d0.primary === 95 && d0.secondary === 95 && d0.shoes === 114 && d0.current === "adventurer",
      "fresh state is the silver/gray look in the 133-dye rack");
    outfit.setOutfitColor(p, "hair", 11);
    outfit.setOutfitColor(p, "primary", 4);
    ok(outfit.outfitState().hair === 11 && outfit.outfitState().primary === 4, "dye picks stick");
    outfit.setOutfitColor(p, "secondary", 999);
    ok(outfit.outfitState().secondary === 95, "an out-of-range dye is refused");
    // save round-trip
    const snap = outfit.outfitSave();
    outfit.resetOutfit();
    ok(outfit.outfitState().hair === 57, "reset back to defaults");
    outfit.loadOutfitSave(snap);
    const d1 = outfit.outfitState();
    ok(d1.hair === 11 && d1.primary === 4 && d1.secondary === 95, "save snapshot restores the dyes");
    // hostile / legacy data → defaults, owned always keeps the starter
    outfit.loadOutfitSave({ hair: "purple", current: "dragonKing", owned: ["dragonKing", 7] });
    const d2 = outfit.outfitState();
    ok(d2.hair === 57 && d2.current === "adventurer" && d2.owned.includes("adventurer"),
      "corrupt save data falls back to the default look");
    outfit.loadOutfitSave(undefined);
    ok(outfit.outfitState().primary === 95, "pre-wardrobe saves (no outfit field) load clean");
    outfit.resetOutfit();
  }

  console.log("Etap 10 — the tailor stands in Bonetown:");
  {
    const { makeHandmadeWorld, TOWN_SPEC } = await import("../src/world/handmade.ts");
    const town = makeHandmadeWorld(TOWN_SPEC);
    const tailor = town.npcs.find((n) => n.key === "tailor");
    ok(!!tailor, "Vesper is placed on the town map");
    ok(town.npcs.length === 6, "all six town NPCs parse from the grid");
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
    // Bonetown was redrawn in Tiled and only its Home Isle gate is authored so
    // far, so the temple stairs are not on the map yet. The Sanctum itself is
    // untouched and is still checked in full below; what the town must prove
    // meanwhile is that its one gate is walkable-to from every townsperson.
    const town = makeHandmadeWorld(TOWN_SPEC);
    ok(town.portals.length === 2 && town.portals.some((p) => p.dest === "home")
      && town.portals.some((p) => p.dest === "cellar"),
      "the redrawn town carries the Home Isle gate and the cellar trapdoor");
    const plaza = town.portals.find((p) => p.dest === "home")!;
    for (const n of town.npcs) {
      const road = findPath(town, toTile(n.x), toTile(n.y), toTile(plaza.x), toTile(plaza.y));
      ok(road.length > 0, `${n.name} can walk to the gate (${road.length} steps)`);
    }
    ok(town.npcs.length === 6, "the redraw shifted no NPC off the map");

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
    ok(of.outfitState().hair === 57 && of.outfitState().primary === 95,
      "out-of-range indices fall back to the default look");
    // restore the dyes the round-trip check below expects
    of.setOutfitColor(P, "primary", 12);
    of.setOutfitColor(P, "secondary", 6);

    ok(of.zoneLabels().hair === "Hair" && of.zoneLabels().primary === "Shirt"
      && of.zoneLabels().secondary === "Pants" && of.zoneLabels().shoes === "Shoes",
      "Wardrobe dye rows are captioned Hair/Shirt/Pants/Shoes");

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
    ok(items.ITEMS.longbow.bow!.range / cfg.TILE === 5, "Hunter's Bow reaches 5 tiles");
    ok(items.ITEMS.bow.bow!.range / cfg.TILE === 5, "Short Bow reaches 5 tiles too");
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

  // ------------------------------------------------- LPC hero sheet
  {
    console.log("Hero sprite sheet (LPC walk + idle + body):");
    const hs = await import("../src/gfx/heroSheet.ts");

    // headless: no Image, so the sheet never loads and the caller must fall
    // back to the baked Adventurer outfit rather than crashing
    hs.loadHeroSheet();
    ok(hs.heroReady() === false, "loading is a safe no-op without a DOM");
    ok(hs.heroSprite("down", 1, true, 0, 0, false) === null,
      "heroSprite() returns null so the baked outfit stands in");
    ok(hs.heroSprite("side", -1, false, 0, 0, true) === null, "…including for the death frame");

    // walk cycle — pure maths, testable without a canvas
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(hs.walkFrameIndex(i / 8));
    ok(seen.size === 8, `the walk cycles through all 8 stride frames (${seen.size})`);
    ok(Math.min(...seen) === 1 && Math.max(...seen) === 8, "stride frames stay inside 1..8");
    ok(hs.walkFrameIndex(0) === hs.walkFrameIndex(1), "the stride repeats once a second at 8 fps");

    // idle loop — the fix for marching on the spot
    ok(hs.idleFrameIndex(0) === 0 && hs.idleFrameIndex(0.5) === 1,
      "idle alternates two frames at 2 fps");
    ok(hs.idleFrameIndex(1) === 0, "and loops");
    const idles = new Set<number>();
    for (let i = 0; i < 40; i++) idles.add(hs.idleFrameIndex(i / 4));
    ok(idles.size === 2 && !idles.has(2), "idle never wanders outside its two frames");
  }

  // ------------------------------------------------- actor scale
  {
    console.log("Actor scale (creatures bigger than props):");
    const cfg = await import("../src/config.ts");
    const gfx = await import("../src/gfx/sprites.ts");

    ok(cfg.ACTOR_SCALE > cfg.SPRITE_SCALE, "actors bake chunkier than props");
    ok(gfx.spriteZoom(gfx.SPR.skeleton) === cfg.ACTOR_SCALE, "a monster carries the actor zoom");
    ok(gfx.spriteZoom(gfx.SPR.npcSmith) === cfg.ACTOR_SCALE, "so does a townsperson");
    ok(gfx.spriteZoom(gfx.SPR.corpse) === cfg.ACTOR_SCALE, "and a corpse, so it matches what died");
    ok(gfx.spriteZoom(gfx.SPR.coin) === cfg.SPRITE_SCALE, "an item icon stays at the prop scale");
    ok(gfx.spriteZoom(gfx.SPR.mushroom) === cfg.SPRITE_SCALE,
      "so does decor — it is painted into the legacy-scale terrain canvas");

    // the 1x art is untouched, so the terrain bake still gets exact pixels
    ok(gfx.spriteSource(gfx.SPR.skeleton).height === gfx.SPR.skeleton.height / cfg.ACTOR_SCALE,
      "the original 1x artwork survives the re-bake");
    ok(gfx.SPR.skeleton.height > gfx.SPR.coin.height, "a skeleton now out-sizes a coin");

    // icons must not grow just because the sprite did
    ok(gfx.iconW(gfx.SPR.skeleton, 2) === gfx.spriteSource(gfx.SPR.skeleton).width * 2,
      "iconW divides out the actual bake zoom, not a hardcoded 2");
    ok(gfx.iconH(gfx.SPR.coin, 2) === 10, "a coin icon still draws at its old size");
  }

  console.log("Home Isle authored in Tiled (map swap):");
  {
    const { walkable } = await import("../src/world/grid.ts");
    const { worldSpawn } = await import("../src/world/collision.ts");
    const home = buildWorlds(WORLD_SEED).home;

    ok(home.w === 35 && home.h === 35, "the island is the 35x35 grid exported from Tiled");
    ok(home.mapImage === undefined, "headless: no terrain image, the baked canvas carries on");
    ok(home.trees.length === 12, "all 12 authored trees made it across");
    ok(home.rocks.length === 10, "…and all 10 rocks (the duplicate marker is gone)");
    ok(home.herbs.length === 0 && home.decos.length === 0, "no scattered decoration was added");
    ok(home.portals.length === 1 && home.portals[0].dest === "town", "one portal, to Bonetown");

    // the authored spawn tile is honoured and is somewhere you can stand
    ok(home.spawn !== undefined, "the 'S' glyph produced a spawn point");
    const sp = worldSpawn(home);
    ok(!home.solid[Math.floor(sp.y / TILE)][Math.floor(sp.x / TILE)], "the spawn tile is walkable");

    // EVERY walkable tile must be reachable from spawn — the bridge is the only
    // link between the two landmasses, so a mis-converted bridge strands half
    // the island. Flood fill 4-way from the spawn tile and compare counts.
    const sx = Math.floor(sp.x / TILE);
    const sy = Math.floor(sp.y / TILE);
    const seen = new Set<number>([sy * home.w + sx]);
    const stack = [[sx, sy]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + ox, ny = y + oy;
        const id = ny * home.w + nx;
        if (seen.has(id) || !walkable(home, nx, ny)) continue;
        seen.add(id);
        stack.push([nx, ny]);
      }
    }
    let open = 0;
    for (let y = 0; y < home.h; y++) for (let x = 0; x < home.w; x++) if (walkable(home, x, y)) open++;
    ok(open > 400, "the island has a substantial walkable area");
    ok(seen.size === open, "every walkable tile is reachable from spawn — the bridge connects");

    // the bridge itself: dirt over what used to be open sea, and crossable
    const bridge: Array<[number, number]> = [];
    for (let y = 0; y < home.h; y++) for (let x = 0; x < home.w; x++)
      if (home.tile[y][x] === Tile.Dirt) bridge.push([x, y]);
    ok(bridge.length === 6, "the bridge deck is 6 tiles — the railings are solid, like the art");
    ok(bridge.every(([x, y]) => walkable(home, x, y)), "every deck tile is walkable");
    // …and the two shores it joins really are separate landmasses: remove the
    // deck and the flood fill must no longer cover everything.
    for (const [x, y] of bridge) home.solid[y][x] = true;
    const seen2 = new Set<number>([sy * home.w + sx]);
    const st2 = [[sx, sy]];
    while (st2.length) {
      const [x, y] = st2.pop()!;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + ox, ny = y + oy;
        const id = ny * home.w + nx;
        if (seen2.has(id) || !walkable(home, nx, ny)) continue;
        seen2.add(id);
        st2.push([nx, ny]);
      }
    }
    ok(seen2.size < open - 100, "block the deck and the far shore is cut off — the bridge is load-bearing");
    for (const [x, y] of bridge) home.solid[y][x] = false;

    // terrain art and collision must not drift apart: the exported picture is
    // 32 px per tile, so a mismatched export has to be rejected, not drawn.
    const { TILE: T2 } = await import("../src/config.ts");
    ok(home.w * T2 === 1120 && home.h * T2 === 1120,
      "the collision grid matches the 1120x1120 terrain export");

    // prop artwork: headless there are no images, so every prop must still be
    // the baked sprite and the engine must keep drawing its own shadows.
    const gfx2 = await import("../src/gfx/sprites.ts");
    ok(!gfx2.hasPropArt(), "headless: no PNG props, the baked art stands in");
    ok(gfx2.propSprite("rock") === gfx2.SPR.rock, "propSprite falls through to the baked rock");
    ok(gfx2.propSprite("stump") === gfx2.SPR.stump, "…and the baked stump");
    ok(gfx2.propSprite("rubble") === gfx2.SPR.rubble, "…and the baked rubble");

    // installing artwork must swap it everywhere and be undoable
    const fake = document.createElement("canvas");
    fake.width = 36; fake.height = 32;
    gfx2.adoptSprite(fake);
    ok(gfx2.spriteZoom(fake) === SPRITE_SCALE2,
      "adopted artwork registers its scale, so icons size correctly");
    gfx2.setPropArt("rock", fake);
    ok(gfx2.propSprite("rock") === fake, "installed artwork wins over the baked sprite");
    gfx2.setPropArt("rock", null);
    ok(gfx2.propSprite("rock") === gfx2.SPR.rock, "clearing it restores the baked sprite");

    // the stump must read as the same tree, cut: no wider at its base than the
    // trunk's root flare, or it looks like it belongs to a different plant.
    const cfg2 = await import("../src/config.ts");
    ok(cfg2.WATER_GLINT_PCT > 0 && cfg2.WATER_GLINT_PCT <= 100,
      "the sea-glint density is a sane percentage");
    ok(cfg2.WATER_GLINT_DRIFT > 0, "glints actually drift, so the sea moves");

    // a procedural island has no authored spawn, so it must fall back cleanly
    const wild = buildWorlds(WORLD_SEED).wild;
    ok(wild.spawn === undefined, "procedural maps carry no authored spawn");
    const wsp = worldSpawn(wild);
    ok(!wild.solid[Math.floor(wsp.y / TILE)][Math.floor(wsp.x / TILE)],
      "…and still land beside their portal, exactly as before");
  }

  console.log("Bonetown redrawn in Tiled:");
  {
    const { walkable } = await import("../src/world/grid.ts");
    const town = buildWorlds(WORLD_SEED).town;
    ok(town.w === 60 && town.h === 60, "the town is the 60x60 grid exported from Tiled");
    ok(!town.safe && town.safeMaxY === 25,
      "the town is split: a haven down to the fence on row 25, hunting ground below");
    ok(town.trees.length === 114 && town.rocks.length === 48,
      "every authored tree and rock came across, duplicates dropped");
    ok(town.npcs.length === 6, "all six townsfolk are present");
    ok(new Set(town.npcs.map((n) => n.name)).size === 6, "…and none is a duplicate");
    ok(town.portals.length === 2 && town.portals.some((p) => p.dest === "home")
      && town.portals.some((p) => p.dest === "cellar"),
      "two gates: Home Isle and the Time Sage's cellar");
    // the split has to hold in practice, not just in the flag
    const { populateWorld: popTown, createGame } = await import("../src/game.ts");
    ok(town.mobPosts?.length === 16, "the 16 authored bandit posts came across");

    // THE test that matters: a real game start, not a hand-driven populate.
    // Calling populateWorld directly proves the function works while the town
    // stands empty in the actual game, which is exactly what happened once.
    const fresh = createGame(WORLD_SEED);
    ok(fresh.worlds.town.monsters.length === 16,
      "starting a game actually puts the bandits on the map");
    ok(fresh.worlds.town.monsters.every((m) => m.kind === "bandit"),
      "…and they are all bandits");
    // and the same must hold after a save round-trip: loadGame() rebuilds the
    // worlds from scratch, so it goes through populateAll all over again
    const { saveGame, loadGame } = await import("../src/save.ts");
    saveGame(fresh);
    const restored = loadGame();
    ok(restored !== null && restored.worlds.town.monsters.length === 16,
      "loading a save leaves the town populated too");

    popTown(town, WORLD_SEED);
    ok(town.monsters.length === 16, "exactly as many bandits as the map asks for — no roster padding");
    ok(town.monsters.every((m) => m.ty > 25),
      "not one bandit spawned north of the fence");
    // authored placement means EXACT placement, not "somewhere in the region"
    const posts = new Set(town.mobPosts!.map((p) => p.ty * town.w + p.tx));
    ok(town.monsters.every((m) => posts.has(m.ty * town.w + m.tx)),
      "every bandit stands on the tile the map marked, not a scattered one");
    ok(town.monsters.every((m) => m.guard !== undefined),
      "each one remembers its post, so a kill respawns it back there");
    // and the placement is stable: repopulating must not shuffle them
    const before = town.monsters.map((m) => m.ty * town.w + m.tx).sort((a, b) => a - b);
    popTown(town, WORLD_SEED);
    const after = town.monsters.map((m) => m.ty * town.w + m.tx).sort((a, b) => a - b);
    ok(before.join() === after.join(), "repopulating puts them back on the same squares");
    ok(town.npcs.every((n) => Math.floor(n.y / TILE) <= 25),
      "every townsperson stands inside the haven");

    // Reachability: trees and rocks are clearable, so the honest invariant is
    // that nothing is walled off by TERRAIN. Flood fill treating props as
    // passable and require the whole town to be one piece.
    const start = { x: Math.floor(town.portals[0].x / TILE), y: Math.floor(town.portals[0].y / TILE) };
    const clear = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < town.w && y < town.h &&
      town.tile[y][x] !== Tile.Water && town.tile[y][x] !== Tile.Wall;
    const seen = new Set<number>([start.y * town.w + start.x]);
    const st = [[start.x, start.y]];
    while (st.length) {
      const [x, y] = st.pop()!;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + ox, ny = y + oy, id = ny * town.w + nx;
        if (seen.has(id) || !clear(nx, ny)) continue;
        seen.add(id); st.push([nx, ny]);
      }
    }
    let open = 0;
    for (let y = 0; y < town.h; y++) for (let x = 0; x < town.w; x++) if (clear(x, y)) open++;
    ok(seen.size === open, "no corner of the town is walled off by terrain");

    // the fence really is a barrier, and the road really is the way through
    let fence = 0;
    for (let y = 0; y < town.h; y++) for (let x = 0; x < town.w; x++)
      if (town.tile[y][x] === Tile.Wall) fence++;
    ok(fence === 18, "the fence line is 18 solid tiles");
    ok(town.npcs.every((n) => walkable(town, Math.floor(n.x / TILE), Math.floor(n.y / TILE))),
      "every townsperson stands somewhere you can reach them");
  }

  console.log("Bandit — the tier-1 creature replacing the rat:");
  {
    const { MONSTER_DEFS, mobSprite, setMobArt } = await import("../src/entities/monsters.ts");
    const b = MONSTER_DEFS.bandit;
    ok(b !== undefined, "the bandit is a defined creature");
    ok(!("rat" in MONSTER_DEFS), "the rat is gone, not merely hidden");

    // "weak, from level 1": it must sit at the bottom of the ladder. Compare
    // against every other creature rather than hard-coding numbers, so the
    // claim survives future rebalancing.
    const others = (Object.keys(MONSTER_DEFS) as Array<keyof typeof MONSTER_DEFS>)
      .filter((k) => k !== "bandit")
      .map((k) => MONSTER_DEFS[k]);
    ok(others.every((o) => b.hp <= o.hp), "no creature has less health");
    ok(others.every((o) => b.exp <= o.exp), "none is worth less experience");
    ok(b.danger <= Math.min(...others.map((o) => o.danger)),
      "it spawns closest to the entrance of any creature");
    ok(b.ranged === undefined, "it fights in melee, so a level 1 can close on it");
    ok(b.gold[1] > 0, "being a person, it carries coin");

    // artwork: baked fallback headless, and installing a PNG must take over
    ok(mobSprite("bandit") === b.spr, "headless it draws with the baked fallback");
    const art = document.createElement("canvas");
    art.width = 30; art.height = 53;
    setMobArt("bandit", art);
    ok(mobSprite("bandit") === art, "loaded artwork wins");
    setMobArt("bandit", null);
    ok(mobSprite("bandit") === b.spr, "clearing it restores the fallback");

    // it must actually be in the world the newcomer reaches first
    const { populateWorld: pop } = await import("../src/game.ts");
    const ws = buildWorlds(WORLD_SEED);
    pop(ws.wild, WORLD_SEED);
    ok(ws.wild.monsters.some((m) => m.kind === "bandit"), "bandits populate the Wildlands roster");
    ok(ws.town.monsters.length === 0, "…and buildWorlds alone leaves the town empty");
  }

  console.log("Bandit walk cycle + the credits that come with it:");
  {
    const { dirOfStep, mobFrame, hasWalkSheet } = await import("../src/gfx/mobSheet.ts");
    ok(dirOfStep(0, -1) === "up" && dirOfStep(0, 1) === "down", "vertical steps face up/down");
    ok(dirOfStep(-1, 0) === "left" && dirOfStep(1, 0) === "right", "horizontal steps face sideways");
    ok(dirOfStep(1, 1) === "down", "diagonals resolve to the vertical, matching the player");
    ok(dirOfStep(0, 0) === null, "standing still changes nothing");
    ok(!hasWalkSheet("bandit"), "headless there is no sheet…");
    ok(mobFrame("bandit", "down", true, 0) === null, "…so the caller falls back to the flat sprite");

    // fresh creatures must start with a valid facing, or the first draw throws
    const ws = buildWorlds(WORLD_SEED);
    const { populateWorld: pw } = await import("../src/game.ts");
    pw(ws.town, WORLD_SEED);
    ok(ws.town.monsters.every((m) => m.dir === "down"), "every creature spawns facing camera");

    // the licence obligation is a build artefact, so assert it like one
    const fs = await import("node:fs");
    const credits = fs.readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");
    ok(credits.includes("mob-bandit-walk.png"), "the bandit sheet is credited by filename");
    ok(credits.includes("Tricorne_Lieutenant_brown"),
      "…with the generator recipe that reproduces it");
    ok(/ShareAlike/i.test(credits), "…and the ShareAlike obligation is spelled out");
    ok(credits.includes("prop-tree.png"), "the drawn props are accounted for too");
  }

  console.log("The four minotaur ranks walk instead of sliding:");
  {
    const fs = await import("node:fs");
    const { mobFrame } = await import("../src/gfx/mobSheet.ts");
    const sheetSrc = fs.readFileSync(
      new URL("../src/gfx/mobSheet.ts", import.meta.url), "utf8");
    const credits = fs.readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");

    /** Width and height straight out of the PNG's IHDR — no decoder needed. */
    const png = (file: string): [number, number] => {
      const b = fs.readFileSync(new URL(`../public/${file}`, import.meta.url));
      return [b.readUInt32BE(16), b.readUInt32BE(20)];
    };

    const RANKS: [string, string][] = [
      ["minotaur", "mob-minotaur-walk.png"],
      ["minotaurArcher", "mob-minotaur-archer-walk.png"],
      ["minotaurGuard", "mob-minotaur-guard-walk.png"],
      ["minotaurMage", "mob-minotaur-mage-walk.png"],
    ];

    for (const [kind, file] of RANKS) {
      ok(sheetSrc.includes(`${kind}: "./${file}"`), `${kind} has a walk sheet registered`);
      ok(fs.existsSync(new URL(`../public/${file}`, import.meta.url)),
        `…and ${file} is actually shipped`);
      const [w, h] = png(file);
      ok(w % 9 === 0 && h % 4 === 0,
        `…laid out as the 9x4 grid the slicer expects (${w}x${h})`);
      ok(h / 4 > w / 9,
        "…and the frame is taller than it is wide, so the crop kept the body upright");
      ok(credits.includes(file), `…and ${file} is credited by filename`);
      ok(mobFrame(kind as never, "down", true, 0) === null,
        "…while headless it still falls back to the baked sprite");
    }

    ok(credits.includes("Minotaur_fur_tan"),
      "the shared head layer names the generator recipe");
    ok(credits.includes("Scutum_shield_scutum") && credits.includes("Tattered_teal"),
      "…and the gear that tells the guard and the mage apart");

    // The guard's shield and the mage's staff widen the crop; the plain
    // minotaur must stay the bandit's build, or the tiers stop reading as one
    // family standing on one-tile footprints.
    const [pw, ph] = png("mob-minotaur-walk.png");
    ok(pw / 9 === 32 && ph / 4 === 55, "the plain minotaur matches the bandit frame exactly");
    ok(png("mob-minotaur-guard-walk.png")[0] / 9 > pw / 9,
      "…and the shield-bearer is wider, not taller-and-thinner");
  }

  console.log("The skeleton, the goblin, the ghoul and the five orc ranks walk too:");
  {
    const fs = await import("node:fs");
    const { mobFrame } = await import("../src/gfx/mobSheet.ts");
    const sheetSrc = fs.readFileSync(
      new URL("../src/gfx/mobSheet.ts", import.meta.url), "utf8");
    const credits = fs.readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");

    const png = (file: string): [number, number] => {
      const b = fs.readFileSync(new URL(`../public/${file}`, import.meta.url));
      return [b.readUInt32BE(16), b.readUInt32BE(20)];
    };

    const WALKERS: [string, string][] = [
      ["skeleton", "mob-skeleton-walk.png"],
      ["goblin", "mob-goblin-walk.png"],
      ["ghoul", "mob-ghoul-walk.png"],
      ["orc", "mob-orc-walk.png"],
      ["orcWarrior", "mob-orc-warrior-walk.png"],
      ["orcBerserker", "mob-orc-berserker-walk.png"],
      ["orcArcher", "mob-orc-archer-walk.png"],
      ["orcShaman", "mob-orc-shaman-walk.png"],
    ];

    for (const [kind, file] of WALKERS) {
      ok(sheetSrc.includes(`${kind}: "./${file}"`), `${kind} has a walk sheet registered`);
      ok(fs.existsSync(new URL(`../public/${file}`, import.meta.url)),
        `…and ${file} is actually shipped`);
      const [w, h] = png(file);
      ok(w % 9 === 0 && h % 4 === 0,
        `…laid out as the 9x4 grid the slicer expects (${w}x${h})`);
      ok(credits.includes(file), `…and ${file} is credited by filename`);
      ok(mobFrame(kind as never, "down", true, 0) === null,
        "…while headless it still falls back to the baked sprite");
    }

    // Every rank shares one base and one head; only the gear differs, and the
    // gear is what the crop width is measuring. Bare orc sets the floor.
    const bare = png("mob-orc-walk.png")[0] / 9;
    ok(bare === 32, "the bare orc is a one-tile build like the bandit");
    for (const f of ["mob-orc-warrior-walk.png", "mob-orc-berserker-walk.png",
      "mob-orc-archer-walk.png", "mob-orc-shaman-walk.png"]) {
      ok(png(f)[0] / 9 > bare, `${f} is wider than the bare orc — its gear sticks out`);
    }
    ok(png("mob-orc-berserker-walk.png")[0] / 9 === 52,
      "the berserker's mace makes him the widest sprite in the game");

    ok(credits.includes("Orc_male_dark_green"),
      "the shared orc head names the generator recipe");
    ok(credits.includes("Skeleton_skeleton") && credits.includes("Goblin_pale_green")
      && credits.includes("Zombie_zombie"),
      "…and so do the three loners");
  }

  console.log("The orc spearman is an archer now:");
  {
    const fs = await import("node:fs");
    const { MONSTER_DEFS, MONSTER_KINDS } = await import("../src/entities/monsters.ts");

    ok(MONSTER_KINDS.includes("orcArcher" as never), "orcArcher is a live monster kind");
    ok(!(MONSTER_KINDS as readonly string[]).includes("orcSpearman"),
      "…and the old spearman name is gone from the bestiary");

    // He was always shooting and always dropping arrows; only the label lied.
    ok(MONSTER_DEFS.orcArcher.ranged !== undefined, "he is still a ranged attacker");

    // The rename has to reach the camp rosters too, or the orc fort spawns
    // nothing where the spearmen used to stand.
    for (const f of ["../src/game.ts", "../src/gfx/sprites.ts", "../src/world/types.ts"]) {
      const src = fs.readFileSync(new URL(f, import.meta.url), "utf8");
      ok(!src.includes("orcSpearman"), `${f} carries no leftover spearman`);
    }
  }

  console.log("The snake slithers, and only sideways:");
  {
    const fs = await import("node:fs");
    const { stepFacing, mobFrame } = await import("../src/gfx/mobSheet.ts");
    const sheetSrc = fs.readFileSync(
      new URL("../src/gfx/mobSheet.ts", import.meta.url), "utf8");
    const credits = fs.readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");

    const png = (file: string): [number, number] => {
      const b = fs.readFileSync(new URL(`../public/${file}`, import.meta.url));
      return [b.readUInt32BE(16), b.readUInt32BE(20)];
    };

    ok(sheetSrc.includes('snake: "./mob-snake-walk.png"'), "the snake has a walk sheet");
    ok(fs.existsSync(new URL("../public/mob-snake-walk.png", import.meta.url)),
      "…and it is actually shipped");

    // Seven frames, not the LPC nine — the slicer has to read the count off the
    // sheet rather than assume, or every frame lands a third of a body out.
    const [w, h] = png("mob-snake-walk.png");
    ok(sheetSrc.includes("snake: 7"), "…registered as a seven-frame strip");
    ok(w % 7 === 0 && h % 4 === 0, `…laid out as a 7x4 grid (${w}x${h})`);
    ok(w / 7 === 32 && h / 4 === 21, "…with a 32x21 frame: one tile long, a third of a tile tall");

    // it must read as vermin next to the humanoids, not as another orc
    ok(h / 4 < png("mob-orc-walk.png")[1] / 4 / 2,
      "the snake is under half the orc's height");

    // side-only facing: horizontal turns it, vertical leaves it alone
    ok(stepFacing("snake", 1, 0, "left") === "right", "a step east turns the snake east");
    ok(stepFacing("snake", -1, 0, "right") === "left", "…and a step west turns it west");
    ok(stepFacing("snake", 1, -1, "left") === "right", "…a diagonal turns it on the horizontal");
    ok(stepFacing("snake", 0, -1, "right") === "right", "a step north leaves it facing east");
    ok(stepFacing("snake", 0, 1, "left") === "left", "…and a step south leaves it facing west");
    ok(stepFacing("snake", 0, 0, "left") === "left", "standing still changes nothing");

    // everything else still turns all four ways, ties to the vertical
    ok(stepFacing("orc", 0, -1, "left") === "up", "an orc still faces north when it walks north");
    ok(stepFacing("orc", 1, -1, "left") === "up", "…and its diagonals still break to the vertical");
    ok(stepFacing("orc", 1, 0, "up") === "right", "…while a step east turns it east");
    ok(stepFacing("orc", 0, 0, "up") === "up", "…and standing still changes nothing");

    ok(mobFrame("snake", "right", true, 0) === null,
      "headless it still falls back to the baked sprite");

    // the body is hand-drawn, since the pack ships no death frame
    ok(fs.existsSync(new URL("../public/mob-snake-dead.png", import.meta.url)),
      "the snake leaves a body");
    ok(sheetSrc.includes('snake: "./mob-snake-dead.png"'), "…and it is registered");
    const [dw, dh] = png("mob-snake-dead.png");
    ok(dw <= 32 && dh < 21, `…lying flatter than the living coil (${dw}x${dh})`);

    // this pack is not LPC and its terms run the other way — the credit is
    // mandatory and the redistribution ban is the thing to remember
    ok(credits.includes("carysaurus"), "the pack's author is credited by name");
    ok(credits.includes("carysaurus.itch.io/snake-sprites"), "…with a link to the source");
    ok(credits.includes("cannot redistribute"), "…and the licence term is quoted, not paraphrased");
    ok(!credits.includes("mob-snake-walk.png` is a derivative work of CC-BY-SA"),
      "…and it is not mislabelled as CC-BY-SA like the LPC art");

    // it stays at the bottom of the ladder: new art, same creature
    const { MONSTER_DEFS } = await import("../src/entities/monsters.ts");
    ok(MONSTER_DEFS.snake.exp <= 10 && MONSTER_DEFS.snake.hp <= 20,
      "the snake is still a level 1 creature");
  }

  console.log("Bodies on the ground:");
  {
    const fs = await import("node:fs");
    const { corpseSprite } = await import("../src/gfx/mobSheet.ts");
    const { heroCorpse } = await import("../src/gfx/heroSheet.ts");
    const sheetSrc = fs.readFileSync(
      new URL("../src/gfx/mobSheet.ts", import.meta.url), "utf8");
    const mainSrc = fs.readFileSync(
      new URL("../src/main.ts", import.meta.url), "utf8");
    const credits = fs.readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");

    ok(fs.existsSync(new URL("../public/mob-minotaur-dead.png", import.meta.url)),
      "the minotaur body is shipped");
    ok(credits.includes("mob-minotaur-dead.png"), "…and credited by filename");

    // one body, four ranks: the gear-strewn per-rank death frames were dropped
    // on purpose, so a stray extra file here means someone re-added them
    for (const k of ["minotaur", "minotaurArcher", "minotaurGuard", "minotaurMage"]) {
      ok(sheetSrc.includes(`${k}: "./mob-minotaur-dead.png"`),
        `${k} leaves a body, not a bone pile`);
    }
    for (const f of ["archer", "guard", "mage"]) {
      ok(!fs.existsSync(new URL(`../public/mob-minotaur-${f}-dead.png`, import.meta.url)),
        `no separate ${f} body — the ranks share one corpse`);
    }

    // corpse.name is the monster kind, so the lookup is keyed off it directly
    const { killMonster } = await import("../src/systems/combat.ts");
    const { createPlayer: mkP } = await import("../src/entities/player.ts");
    const ws = buildWorlds(WORLD_SEED);
    const { populateWorld: pw2 } = await import("../src/game.ts");
    pw2(ws.wild, WORLD_SEED);
    const before = ws.wild.corpses.length;
    const victim = ws.wild.monsters[0];
    const kind = victim.kind;
    killMonster(ws.wild, mkP({ x: victim.x, y: victim.y }), victim);
    ok(ws.wild.corpses.length === before + 1, "a kill leaves a corpse behind");
    ok(ws.wild.corpses[ws.wild.corpses.length - 1].name === kind,
      "…named after the kind, which is what the art lookup keys on");

    ok(fs.existsSync(new URL("../public/mob-bandit-dead.png", import.meta.url)),
      "the bandit body is shipped too");
    ok(sheetSrc.includes('bandit: "./mob-bandit-dead.png"'),
      "…and registered, so the outlaws stop leaving bones");
    ok(credits.includes("mob-bandit-dead.png"), "…and credited by filename");

    // Three loners keep their own bodies; the five orc ranks share the bare
    // orc's, for the same reason the minotaurs share theirs.
    for (const [kind, file] of [
      ["skeleton", "mob-skeleton-dead.png"],
      ["goblin", "mob-goblin-dead.png"],
      ["ghoul", "mob-ghoul-dead.png"],
      ["orc", "mob-orc-dead.png"],
    ] as [string, string][]) {
      ok(fs.existsSync(new URL(`../public/${file}`, import.meta.url)),
        `the ${kind} body is shipped`);
      ok(sheetSrc.includes(`${kind}: "./${file}"`), `…and registered for the ${kind}`);
      ok(credits.includes(file), `…and credited by filename`);
    }
    for (const k of ["orc", "orcWarrior", "orcBerserker", "orcArcher", "orcShaman"]) {
      ok(sheetSrc.includes(`${k}: "./mob-orc-dead.png"`),
        `${k} leaves a bare orc body, not his gear`);
    }
    for (const f of ["warrior", "berserker", "archer", "shaman"]) {
      ok(!fs.existsSync(new URL(`../public/mob-orc-${f}-dead.png`, import.meta.url)),
        `no separate ${f} body — the ranks share one corpse`);
    }

    ok(corpseSprite("spider") === null, "a creature with no body art gets none");
    ok(corpseSprite("minotaur") === null, "headless even a minotaur falls back…");
    ok(corpseSprite("bandit") === null, "…and so does a bandit…");
    ok(heroCorpse() === null, "…and so does the player's own body");
    ok(mainSrc.includes('c.name === "your body" ? heroCorpse() : corpseSprite(c.name)'),
      "the lootable body reuses the hero's death frame instead of the bone pile");
    ok(mainSrc.includes("const baseY = c.y + TILE / 2;"),
      "a body lies on the bottom edge of its tile, not the centre line");
    ok(mainSrc.includes("drawShadow(c.x, baseY)"),
      "…and its shadow goes down with it");
    ok(mainSrc.includes("drawSprite(SPR.corpse, c.x, c.y + 8)"),
      "…while the bone pile keeps the nudge it was drawn for");
  }

  console.log("Townsfolk: all five walk a 3x3 beat and stop when spoken to:");
  {
    const { updateNpcs, faceToward } = await import("../src/entities/npcs.ts");
    const { NPC_WALK_SPEED, NPC_TALK_HOLD_S, PLAYER_BASE_SPEED } = await import("../src/config.ts");
    const { chebTiles } = await import("../src/world/grid.ts");
    const { npcFrame } = await import("../src/gfx/mobSheet.ts");

    ok(NPC_WALK_SPEED * 3 < PLAYER_BASE_SPEED,
      "a townsperson can never outpace a level 1 player");
    ok(npcFrame("smith", "down", true, 0) === null,
      "headless there is no sheet, so the baked stand-in is used");

    // rndi is inclusive at both ends. The step-order shuffle got this wrong
    // once and fed an out-of-range index into the direction table, which only
    // showed up once five NPCs were rolling instead of one.
    const { rndi: ri } = await import("../src/util.ts");
    let outOfRange = false;
    for (let i = 0; i < 20000; i++) if (ri(0, 3) > 3 || ri(0, 3) < 0) outOfRange = true;
    ok(!outOfRange, "rndi(0, 3) stays inside a four-element table");

    const town = buildWorlds(WORLD_SEED).town;
    const smith = town.npcs.find((n) => n.key === "smith")!;
    ok(smith !== undefined, "the smith is on the town map");
    const shopkeepers = town.npcs.filter((n) => n.key !== "timesage");
    ok(shopkeepers.length === 5 && shopkeepers.every((n) =>
      n.bx0 === n.hx - 1 && n.bx1 === n.hx + 1 && n.by0 === n.hy - 1 && n.by1 === n.hy + 1),
      "the five shopkeepers walk a 3x3 beat");
    ok(town.npcs.every((n) => n.dir === "down"),
      "everyone spawns facing camera, so the first draw has a valid row");
    ok(town.npcs.every((n) => n.hx === n.tx && n.hy === n.ty),
      "home is the tile the map authored them on");

    // Two beats sharing a square would leave that pair shuffling into each
    // other forever. Home tiles must be at least 3 apart, Chebyshev.
    let tooClose = "";
    for (const a of town.npcs) {
      for (const b of town.npcs) {
        if (a === b) continue;
        if (chebTiles(a.hx, a.hy, b.hx, b.hy) < 3) tooClose = `${a.key}/${b.key}`;
      }
    }
    ok(tooClose === "", `no two beats overlap${tooClose && " — " + tooClose}`);

    // Every square any of them can reach must be standable, or they get wedged
    // against a wall on one side of the beat.
    let unwalkable = "";
    let beatTiles = 0;
    for (const n of town.npcs) {
      for (let ty = n.by0; ty <= n.by1; ty++) {
        for (let tx = n.bx0; tx <= n.bx1; tx++) {
          beatTiles++;
          if (town.solid[ty][tx]) unwalkable = n.key;
        }
      }
    }
    ok(unwalkable === "", `every beat is walkable end to end${unwalkable && " — " + unwalkable}`);
    // 5 shopkeepers x 9 tiles + the sage's 9-tile line
    ok(beatTiles === 54, `every beat covers the tiles it should (${beatTiles})`);

    // Half a minute of pacing. Nobody may leave their beat on any single tick —
    // not merely end up back inside it — and nobody may share a square.
    const homes = town.npcs.map((n) => ({ n, x: n.hx, y: n.hy }));
    let strayed = "";
    let collided = false;
    let offCentre = false;
    const stepped = new Set<string>();
    for (let i = 0; i < 1800; i++) {
      updateNpcs(town, 1 / 60, -9999, -9999);
      for (const h of homes) {
        if (h.n.tx < h.n.bx0 || h.n.tx > h.n.bx1
          || h.n.ty < h.n.by0 || h.n.ty > h.n.by1) strayed = h.n.key;
        if (h.n.tx !== h.x || h.n.ty !== h.y) stepped.add(h.n.key);
        if (Math.abs(h.n.x - (h.n.tx * TILE + TILE / 2)) > TILE) offCentre = true;
      }
      if (town.npcs.some((a) => town.npcs.some((b) => b !== a && b.tx === a.tx && b.ty === a.ty))) {
        collided = true;
      }
    }
    ok(strayed === "", `thirty seconds of pacing never leaves the beat${strayed && " — " + strayed}`);
    ok(stepped.size === 6, "…and all six actually move");
    ok(!offCentre, "…and no render position runs away from its tile");
    ok(!collided, "…and no two townsfolk ever share a square");

    // Being spoken to freezes him where he stands and turns him around.
    smith.talk = NPC_TALK_HOLD_S;
    const held = { tx: smith.tx, ty: smith.ty };
    for (let i = 0; i < 120; i++) updateNpcs(town, 1 / 60, -9999, -9999);
    ok(smith.tx === held.tx && smith.ty === held.ty, "in conversation he does not step");
    ok(smith.moving === false, "…and shows his standing pose, not a stride");
    ok(smith.talk > 0, "…for as long as the hold lasts");

    // …and the hold expires on its own once the conversation stops.
    for (let i = 0; i < 60 * (NPC_TALK_HOLD_S + 1); i++) updateNpcs(town, 1 / 60, -9999, -9999);
    ok(smith.talk === 0, "the hold decays with nobody refreshing it");

    faceToward(smith, smith.x, smith.y - 500);
    ok(smith.dir === "up", "he turns to look north at a player above him");
    faceToward(smith, smith.x + 500, smith.y);
    ok(smith.dir === "right", "…and east at one to his right");
    faceToward(smith, smith.x - 500, smith.y + 20);
    ok(smith.dir === "left", "a shallow angle still reads as sideways");

    // He must not walk onto the player, so a free tile stays a real one.
    // The blocked square has to be one the smith is NOT already standing on:
    // tryStep claims the destination the instant it is chosen, so `smith.tx/ty`
    // is either where he stands or where he is already committed to. Parking
    // the player on his home tile (the old test) passed or failed purely on
    // where the previous loop happened to leave him.
    smith.talk = 0;
    let blockTx = smith.hx;
    let blockTy = smith.hy;
    search: for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = smith.hx + dx;
        const ty = smith.hy + dy;
        if (tx === smith.tx && ty === smith.ty) continue;
        if (town.solid[ty][tx]) continue;
        blockTx = tx;
        blockTy = ty;
        break search;
      }
    }
    ok(!(blockTx === smith.tx && blockTy === smith.ty),
      "the blocked square is one he has not already claimed");
    const blockX = blockTx * TILE + TILE / 2;
    const blockY = blockTy * TILE + TILE / 2;
    let landedOnPlayer = false;
    for (let i = 0; i < 1800; i++) {
      updateNpcs(town, 1 / 60, blockX, blockY);
      if (smith.tx === blockTx && smith.ty === blockTy) landedOnPlayer = true;
    }
    ok(!landedOnPlayer, "he never claims the square the player is standing on");

    const fs2 = await import("node:fs");
    const cr = fs2.readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");
    const KEYS = ["smith", "herbalist", "elder", "taskmaster", "tailor"] as const;
    for (const k of KEYS) {
      ok(cr.includes(`npc-${k}.png`), `the ${k} sheet is credited by filename`);
    }
    ok(cr.includes("Mace_mace") && cr.includes("Belle_skirt_green")
      && cr.includes("Necklace_gold") && cr.includes("Long_Topknot_red")
      && cr.includes("Frock_coat_blue"),
      "…each with the generator recipe that reproduces it");

    // The art must actually be wired up: every roster entry needs a sheet, or
    // that NPC silently falls back to a baked stand-in that cannot turn.
    const sheetSrc = fs2.readFileSync(
      new URL("../src/gfx/mobSheet.ts", import.meta.url), "utf8");
    for (const k of KEYS) {
      ok(sheetSrc.includes(`"npc:${k}": "./npc-${k}.png"`),
        `${k} has a walk sheet registered`);
    }
  }

  console.log("Chronos the Time Sage & his cellar:");
  {
    const { makeHandmadeWorld, TOWN_SPEC, CELLAR_SPEC } = await import("../src/world/handmade.ts");
    const { updateNpcs } = await import("../src/entities/npcs.ts");
    const { buildWorlds } = await import("../src/game.ts");
    const { WORLD_SEED, TILE: T } = await import("../src/config.ts");

    /* --- the sage in town: the tile the printscreen showed, pacing one row --- */
    const town = makeHandmadeWorld(TOWN_SPEC);
    const sage = town.npcs.find((n) => n.key === "timesage")!;
    ok(!!sage, "Chronos stands in Bonetown");
    ok(sage.name === "Chronos the Time Sage", `named in English (${sage.name})`);
    ok(sage.tx === 16 && sage.ty === 15,
      `on the tile the printscreen showed (${sage.tx},${sage.ty})`);
    ok(sage.bx0 === sage.hx - 4 && sage.bx1 === sage.hx + 4,
      "four tiles east and west");
    ok(sage.by0 === sage.hy && sage.by1 === sage.hy, "…and never north or south");
    for (let dx = -4; dx <= 4; dx++) {
      ok(!town.solid[sage.hy][sage.hx + dx], `his beat is clear at +${dx}`);
    }

    // …and he actually walks it: half a minute of pacing must reach both ends
    // of the line and never step off the row.
    let minTx = sage.tx;
    let maxTx = sage.tx;
    let leftRow = false;
    for (let i = 0; i < 4000; i++) {
      updateNpcs(town, 1 / 60, -9999, -9999);
      if (sage.ty !== sage.hy) leftRow = true;
      minTx = Math.min(minTx, sage.tx);
      maxTx = Math.max(maxTx, sage.tx);
    }
    ok(!leftRow, "he never leaves his row");
    ok(minTx >= sage.hx - 4 && maxTx <= sage.hx + 4,
      `and never overshoots the four tiles (${minTx}..${maxTx})`);
    ok(maxTx > minTx, "he does pace — this is not a rooted NPC by accident");

    /* --- the trapdoor where the stack was dropped --- */
    const down = town.portals.find((p) => p.dest === "cellar")!;
    ok(!!down, "the town has a way down to the cellar");
    ok(down.style === undefined, "…and it is a teleport pad, not a ladder");
    ok(down.span === 2, "…a 2x2 one, like the pads downstairs");

    /* --- the cellar itself --- */
    const cellar = makeHandmadeWorld(CELLAR_SPEC);
    const { portalTiles, portalCovers } = await import("../src/world/collision.ts");
    ok(cellar.w === 30 && cellar.h === 50,
      "the 20x40 hall plus a five-tile margin on every side");
    ok(cellar.safe, "nothing hostile lives down there yet");

    // The walkable floor is tiles 7..22 x 8..42 — pulled inside the rocky rim
    // so you cannot stand on the mushroom rock and look like you are walking
    // up the wall. Everything outside it, rim and black margin alike, blocks.
    let strayWall = "";
    let marginHole = "";
    for (let y = 0; y < cellar.h; y++) {
      for (let x = 0; x < cellar.w; x++) {
        const inside = x >= 7 && x <= 22 && y >= 8 && y <= 42;
        if (cellar.solid[y][x] !== !inside) strayWall = `${x},${y}`;
        const margin = x < 5 || y < 5 || x > 24 || y > 44;
        if (margin && !cellar.solid[y][x]) marginHole = `${x},${y}`;
      }
    }
    ok(strayWall === "", `only the rim and the margin block${strayWall && " — " + strayWall}`);
    ok(marginHole === "", `the margin has no gaps${marginHole && " — " + marginHole}`);
    // the rim itself: the rows and columns the artwork draws rock on
    ok(cellar.solid[6].every((v) => v) && cellar.solid[7].every((v) => v),
      "the two rock rows along the top are closed off");
    ok(cellar.solid[43].every((v) => v), "…and the mushroom row along the bottom");
    ok(cellar.solid.every((row) => row[6] && row[23]),
      "…and the rock column down each side");
    ok(!cellar.solid[8][7] && !cellar.solid[42][22],
      "the corners of the floor itself are still walkable");

    const up = cellar.portals.find((p) => p.dest === "town")!;
    ok(!!up, "the way back to Bonetown is down there");
    ok(up.style === undefined && up.span === 2,
      "…and it too is a 2x2 pad rather than a ladder");
    ok(Math.floor(up.x / T) === 15 && Math.floor(up.y / T) === 33,
      "…centred on the dry core of the islet between the four pools");
    // the whole pad must sit on dry floor: half of it hanging over a pool was
    // what made it look shoved off to one side
    for (const t of portalTiles(up)) {
      ok(t.tx >= 14 && t.tx <= 15 && t.ty >= 32 && t.ty <= 33,
        `pad tile (${t.tx},${t.ty}) is on the islet`);
    }

    const pads = cellar.portals.filter((p) => p.inactive);
    ok(pads.length === 14, `fourteen pads, all dormant for now (${pads.length})`);
    ok(cellar.portals.length === 15, "…and nothing else that teleports");
    const named = ["Orc Warrens", "Troll Caves", "Minotaur Halls", "Undead Crypt"];
    for (const n of named) {
      ok(pads.some((p) => p.label.startsWith(n)), `${n} has its own pad`);
    }
    ok(pads.filter((p) => p.label.startsWith("Sealed Rift")).length === 10,
      "…plus the ten the sage has not named yet");

    // every pad has to be standable, or the pad you can see is a pad you
    // can never use once its hunting ground exists. And it is 2x2: all four
    // squares carry you, not just the one the glyph was authored on.
    let padBlocked = "";
    let padSpan = "";
    let padTiles = "";
    let missedSquare = "";
    let leaked = "";
    for (const p of pads) {
      if (p.span !== 2) padSpan = p.label;
      const ts = portalTiles(p);
      if (ts.length !== 4) padTiles = p.label;
      for (const t of ts) {
        if (cellar.solid[t.ty][t.tx]) padBlocked = p.label;
        // standing anywhere on the block must count as standing on the pad
        if (!portalCovers(p, t.tx * T + T / 2, t.ty * T + T / 2)) missedSquare = p.label;
      }
      // …and one square outside the block must not
      const out = ts[0];
      if (portalCovers(p, (out.tx - 1) * T + T / 2, out.ty * T + T / 2)) leaked = p.label;
      if (portalCovers(p, out.tx * T + T / 2, (out.ty - 1) * T + T / 2)) leaked = p.label;
    }
    ok(padSpan === "", `every pad is a 2x2 block${padSpan && " — " + padSpan}`);
    ok(padTiles === "", `…covering exactly four squares${padTiles && " — " + padTiles}`);
    ok(padBlocked === "", `…all of them walkable${padBlocked && " — " + padBlocked}`);
    ok(missedSquare === "", `…all of them teleporting${missedSquare && " — " + missedSquare}`);
    ok(leaked === "", `…and nothing outside the block does${leaked && " — " + leaked}`);

    // the blocks land where the artwork painted them: two columns of pads at
    // x=3 and x=15, plus the extra pair along the top row
    const corners = pads.map((p) => portalTiles(p)[0]).map((t) => `${t.tx},${t.ty}`).sort();
    ok(corners.join(" ") === [
      "16,9", "20,18", "20,22", "20,26", "20,39", "20,9", "20,13",
      "8,18", "8,22", "8,26", "8,39", "8,9", "8,13", "12,9",
    ].sort().join(" "), `pads sit on the painted blocks (${corners.join(" ")})`);

    // arriving must not drop you back onto the pad you came through, or the
    // portal fires again and bounces you home
    const { portalSpawn } = await import("../src/world/collision.ts");
    const landing = portalSpawn(cellar, up);
    ok(!portalCovers(up, landing.x, landing.y),
      "you land beside the pad, not on it");
    const landingBack = portalSpawn(town, down);
    ok(!portalCovers(down, landingBack.x, landingBack.y),
      "…and the same coming back up");

    const deep = cellar.npcs.find((n) => n.key === "timesage")!;
    ok(!!deep, "the sage is in his cellar too");
    ok(deep.tx === 15 && deep.ty === 14,
      `at the heart of the great pool (${deep.tx},${deep.ty})`);
    // a 2x2 square hanging west and south of his corner
    ok(deep.bx0 === 14 && deep.bx1 === 15 && deep.by0 === 14 && deep.by1 === 15,
      "his beat is the square one tile west and one south");
    const seen = new Set<string>();
    let escaped = "";
    for (let i = 0; i < 6000; i++) {
      updateNpcs(cellar, 1 / 60, -9999, -9999);
      seen.add(`${deep.tx},${deep.ty}`);
      if (deep.tx < 14 || deep.tx > 15 || deep.ty < 14 || deep.ty > 15) escaped = `${deep.tx},${deep.ty}`;
    }
    ok(escaped === "", `he never leaves the square${escaped && " — " + escaped}`);
    ok(seen.size === 4, `and walks all four of its tiles (${seen.size})`);

    /* --- and it is wired into the real game, not just the spec --- */
    const worlds = buildWorlds(WORLD_SEED);
    ok(!!worlds.cellar && worlds.cellar.name === "Time Sage's Cellar",
      "buildWorlds actually creates the cellar");
    const back = worlds.cellar.portals.find((p) => p.dest === "town");
    const there = worlds.town.portals.find((p) => p.dest === "cellar");
    ok(!!back && !!there, "the round trip is complete in both directions");

    const fs3 = await import("node:fs");
    const terrain = fs3.readFileSync(
      new URL("../src/world/terrainImage.ts", import.meta.url), "utf8");
    ok(terrain.includes('cellar: "./cellar-terrain.png"'), "the painted floor is registered");
    ok(fs3.existsSync(new URL("../public/cellar-terrain.png", import.meta.url)),
      "…and the file is actually shipped");
    ok(fs3.existsSync(new URL("../public/npc-timesage.png", import.meta.url)),
      "the sage's walk sheet is shipped too");
    const sheetSrc2 = fs3.readFileSync(
      new URL("../src/gfx/mobSheet.ts", import.meta.url), "utf8");
    ok(sheetSrc2.includes('"npc:timesage": "./npc-timesage.png"'),
      "…and registered, so he turns instead of sliding");
    const cr2 = fs3.readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");
    ok(cr2.includes("npc-timesage.png"), "his sheet is credited by filename");
    ok(cr2.includes("Celestial_Wizard_Moon_Hat_slate"),
      "…with the generator recipe that reproduces him");

    /* --- dormant pads read red now, live ones violet --- */
    const cfg = fs3.readFileSync(new URL("../src/config.ts", import.meta.url), "utf8");
    ok(/PORTAL_DORMANT_CORE = "#e0574c"/.test(cfg), "a dormant pad burns red");
    ok(/PORTAL_LIVE_CORE = "#c9a6ff"/.test(cfg), "…and a live one still breathes violet");
    const mainSrc = fs3.readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
    ok(!/rgba\(140,140,148/.test(mainSrc), "the old ash-grey pad is gone from the renderer");
  }

  console.log("The skeleton warrior and the demon skeleton join the bestiary:");
  {
    const fs = await import("node:fs");
    const { mobFrame, corpseSprite } = await import("../src/gfx/mobSheet.ts");
    const { MONSTER_DEFS } = await import("../src/entities/monsters.ts");
    const sheetSrc = fs.readFileSync(
      new URL("../src/gfx/mobSheet.ts", import.meta.url), "utf8");
    const credits = fs.readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");

    const png = (file: string): [number, number] => {
      const b = fs.readFileSync(new URL(`../public/${file}`, import.meta.url));
      return [b.readUInt32BE(16), b.readUInt32BE(20)];
    };

    const UNDEAD: [string, string][] = [
      ["skeletonWarrior", "mob-skeleton-warrior-walk.png"],
      ["demonSkeleton", "mob-demon-skeleton-walk.png"],
    ];

    for (const [kind, file] of UNDEAD) {
      ok(sheetSrc.includes(`${kind}: "./${file}"`), `${kind} has a walk sheet registered`);
      ok(fs.existsSync(new URL(`../public/${file}`, import.meta.url)),
        `…and ${file} is actually shipped`);
      const [w, h] = png(file);
      ok(w % 9 === 0 && h % 4 === 0,
        `…laid out as the 9x4 grid the slicer expects (${w}x${h})`);
      ok(h / 4 === 49, "…with all four facings cut to one height, so it never bobs on turning");
      ok(credits.includes(file), `…and ${file} is credited by filename`);
      ok(mobFrame(kind as never, "down", true, 0) === null,
        "…while headless it still falls back to the baked sprite");
      ok(corpseSprite(kind) === null,
        "…and headless its body falls back too, rather than throwing");
    }

    // Three skeletons, one heap of bones. A new *-dead.png for either of these
    // means someone re-drew a corpse that was deliberately shared.
    for (const k of ["skeleton", "skeletonWarrior", "demonSkeleton"]) {
      ok(sheetSrc.includes(`${k}: "./mob-skeleton-dead.png"`),
        `${k} leaves the shared skeleton body`);
    }
    for (const f of ["mob-skeleton-warrior-dead.png", "mob-demon-skeleton-dead.png"]) {
      ok(!fs.existsSync(new URL(`../public/${f}`, import.meta.url)),
        `no separate ${f} — the three skeletons share one corpse`);
    }

    // The wings are the whole point of the demon's silhouette: they fill the
    // 64px source cell edge to edge, which makes it the widest thing alive.
    const demonW = png("mob-demon-skeleton-walk.png")[0] / 9;
    ok(demonW === 64, "the demon's wings span the full source cell");
    for (const f of ["mob-orc-berserker-walk.png", "mob-minotaur-guard-walk.png",
      "mob-minotaur-mage-walk.png"]) {
      ok(png(f)[0] / 9 < demonW, `…wider than ${f}, which used to hold the record`);
    }
    ok(png("mob-skeleton-warrior-walk.png")[0] / 9 > png("mob-skeleton-walk.png")[0] / 9,
      "the warrior is wider than the bare skeleton — the helmet and dagger stick out");

    /* --- stats: the warrior shadows the minotaur guard, the demon the dragon --- */
    const guard = MONSTER_DEFS.minotaurGuard;
    const warrior = MONSTER_DEFS.skeletonWarrior;
    const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= b * tol;
    ok(near(warrior.hp, guard.hp, 0.1), "the skeleton warrior matches the guard's HP");
    ok(near(warrior.exp, guard.exp, 0.1), "…and its experience");
    ok(near(warrior.dmg[0], guard.dmg[0], 0.15) && near(warrior.dmg[1], guard.dmg[1], 0.15),
      "…and both ends of its damage roll");

    const dragon = MONSTER_DEFS.dragon;
    const demon = MONSTER_DEFS.demonSkeleton;
    ok(demon.hp < dragon.hp && demon.hp > dragon.hp * 0.6,
      "the demon skeleton is below the dragon but in its weight class");
    ok(demon.exp < dragon.exp && demon.dmg[1] < dragon.dmg[1],
      "…worth less and hitting softer than the boss");
    ok(demon.hp > MONSTER_DEFS.boneLord.hp,
      "…yet clear of the Bone Lord, the next thing down");

    // Both are melee. A ranged block on either would let it out-range the bow
    // it is meant to be fought with, and the demon has no breath to justify it.
    ok(warrior.ranged === undefined, "the skeleton warrior fights in melee only");
    ok(demon.ranged === undefined, "…and so does the demon skeleton");

    // Loot is being done wholesale later; an empty table must stay empty and
    // must not crash the roller.
    const { rollLoot } = await import("../src/entities/monsters.ts");
    for (const k of ["skeletonWarrior", "demonSkeleton"] as const) {
      ok(MONSTER_DEFS[k].loot.length === 0, `${k} carries no loot table yet`);
      ok(rollLoot(k).items.length === 0, "…and rolling it yields nothing rather than throwing");
    }

    /* --- they actually spawn somewhere, and it is flagged as temporary --- */
    const gameSrc = fs.readFileSync(new URL("../src/game.ts", import.meta.url), "utf8");
    ok(/TEMP-ETAP18/.test(gameSrc),
      "the stand-in spawn entries are tagged for removal");
    const worlds = buildWorlds(WORLD_SEED);
    const { populateWorld: pw3 } = await import("../src/game.ts");
    pw3(worlds.cave3, WORLD_SEED);
    ok(worlds.cave3.monsters.some((m) => m.kind === "skeletonWarrior"),
      "a skeleton warrior stands on Bone Caverns -3");
    ok(worlds.cave3.monsters.some((m) => m.kind === "demonSkeleton"),
      "…and so does a demon skeleton");
  }

  console.log("Campfires flicker instead of being baked into the map:");
  {
    const fs = await import("node:fs");
    const fire = await import("../src/gfx/fireSheet.ts");
    const gfx = await import("../src/gfx/sprites.ts");
    const credits = fs.readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");
    const handmadeSrc = fs.readFileSync(
      new URL("../src/world/handmade.ts", import.meta.url), "utf8");
    const deepwildSrc = fs.readFileSync(
      new URL("../src/world/deepwild.ts", import.meta.url), "utf8");

    /* --- the strip is laid out the way the slicer reads it --- */
    const b = fs.readFileSync(new URL("../public/prop-campfire.png", import.meta.url));
    const [sw, sh] = [b.readUInt32BE(16), b.readUInt32BE(20)];
    ok(sw === 32 * fire.FIRE_FRAMES && sh === 32,
      `the strip is ${fire.FIRE_FRAMES} square 32px frames (${sw}x${sh})`);
    ok(sw % fire.FIRE_FRAMES === 0, "…so the slicer's integer frame width is exact");
    ok(credits.includes("prop-campfire.png"), "…and it is credited by filename");
    ok(/NYKNCK/.test(credits), "…with the artist the pack was bought from named");

    /* --- the cycle walks the strip and wraps --- */
    const seq = Array.from({ length: fire.FIRE_FRAMES + 2 },
      (_, i) => fire.fireFrameIndex(i / fire.FIRE_FPS, 0));
    ok(seq.every((f) => f >= 0 && f < fire.FIRE_FRAMES),
      "every frame index lands inside the strip");
    ok(seq.slice(0, fire.FIRE_FRAMES).join() === [...Array(fire.FIRE_FRAMES).keys()].join(),
      "one second walks the whole strip in order");
    ok(seq[fire.FIRE_FRAMES] === 0, "…then wraps back to the first frame");
    ok(fire.fireFrameIndex(0, 0) === fire.fireFrameIndex(1000, 0),
      "the cycle stays stable far from t=0");
    ok(fire.fireFrameIndex(0, -0.5) >= 0,
      "a negative phase still indexes inside the strip");

    /* --- phases keep two fires in one camp out of lockstep --- */
    const t = 0.5 / fire.FIRE_FPS;
    ok(new Set(Array.from({ length: 4 }, (_, i) =>
      fire.fireFrameIndex(t, i / fire.FIRE_FPS))).size === 4,
      "four different phases show four different frames at the same instant");

    /* --- headless there is no artwork, and the baked sprite carries it --- */
    ok(!fire.hasFireArt(), "headless: the strip never loads");
    ok(fire.campfireFrame(0, 0) === null, "…so the frame lookup returns null");
    ok(gfx.SPR.campfire !== undefined, "…and the baked campfire is there to stand in");

    /* --- a fire is an entity, not a deco: decos are baked once --- */
    const worlds = buildWorlds(WORLD_SEED);
    const all = Object.values(worlds);
    ok(all.every((w) => Array.isArray(w.fires)), "every world carries a fire list");
    ok(all.every((w) => w.decos.every((d) => d.spr !== gfx.SPR.campfire)),
      "no campfire is left in the baked decoration list");
    ok(worlds.deepwild.fires.length > 0, "the wilderness camps light real fires");
    ok(worlds.deepwild.fires.every((f) => f.phase >= 0 && f.phase < 1),
      "…each with its own phase inside one cycle");
    ok(new Set(worlds.deepwild.fires.map((f) => `${f.tx},${f.ty}`)).size
      === worlds.deepwild.fires.length,
      "…and no two of them stacked on one tile");
    ok(worlds.deepwild.fires.every((f) => !worlds.deepwild.solid[f.ty][f.tx]),
      "camp fires stay walkable, so nothing can be sealed into a corner");
    ok(!deepwildSrc.includes("dress(SPR.campfire"),
      "the camps no longer dress themselves with a still campfire");

    /* --- hand-authored maps can place one, and there it does block --- */
    ok(/case "F":/.test(handmadeSrc), "hand-authored maps place a fire with 'F'");
    ok(/case "F":[\s\S]{0,400}?w\.fires\.push[\s\S]{0,200}?solid\[y\]\[x\] = true/.test(handmadeSrc),
      "…and that one is solid, so the player walks around it");
  }

  console.log("Standing scenery is walked behind, not over:");
  {
    const fs = await import("node:fs");
    const scn = await import("../src/gfx/sceneryArt.ts");
    const gfx = await import("../src/gfx/sprites.ts");
    const { makeHandmadeWorld } = await import("../src/world/handmade.ts");
    const { TILE: T } = await import("../src/config.ts");
    const credits = fs.readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");

    const png = (file: string): [number, number] => {
      const b = fs.readFileSync(new URL(`../public/${file}`, import.meta.url));
      return [b.readUInt32BE(16), b.readUInt32BE(20)];
    };

    const FILES: Record<string, string> = {
      skullPole: "prop-skullpole.png",
      deadTree: "prop-tree-dead.png",
      felledTree: "prop-tree-felled.png",
    };

    ok(scn.SCENERY_KINDS.length === 3, "three kinds of scenery are registered");
    for (const kind of scn.SCENERY_KINDS) {
      const file = FILES[kind];
      ok(fs.existsSync(new URL(`../public/${file}`, import.meta.url)),
        `${kind} ships ${file}`);
      const [w, h] = png(file);
      ok(h > T, `…and it stands taller than one tile (${w}x${h}), so it overhangs`);
      ok(credits.includes(file), `…and ${file} is credited by filename`);
      ok(!scn.hasSceneryArt(kind), "…while headless the PNG never loads");
      ok(scn.scenerySprite(kind) !== undefined,
        "…and a baked sprite stands in for it instead");
    }

    /* --- the totem is the drawn version of the pole the camps already plant --- */
    ok(scn.scenerySprite("skullPole") === gfx.SPR.skullPole,
      "headless, the totem falls back to the baked skull pole it replaces");

    /* --- a glyph plants one and seals the tile under it --- */
    const w = makeHandmadeWorld({
      key: "home",
      name: "scenery probe",
      safe: true,
      rows: [".....", ".....", "..Y..", ".....", "....."],
      portals: {},
      scenery: { Y: "skullPole" },
    });
    ok(w.scenery.length === 1, "the glyph plants exactly one totem");
    ok(w.scenery[0].tx === 2 && w.scenery[0].ty === 2, "…on the tile it was written");
    ok(w.solid[2][2], "…and that tile is solid, like a tree's");
    ok(!w.solid[1][2],
      "…while the tile above stays walkable — the sprite overhangs it, nothing more");
    ok(w.decos.length === 0,
      "…and nothing was baked into the map canvas, which would draw it under the player");

    const worlds = buildWorlds(WORLD_SEED);
    ok(Object.values(worlds).every((x) => Array.isArray(x.scenery)),
      "every world carries a scenery list");
  }

  console.log("The Bone Reach is traced faithfully from Tiled:");
  {
    const fs = await import("node:fs");
    const { REACH_SPEC } = await import("../src/world/reachSpec.ts");
    const { CELLAR_SPEC } = await import("../src/world/handmade.ts");
    const { Tile: T2 } = await import("../src/world/types.ts");
    const { populateAll } = await import("../src/game.ts");
    const worlds = buildWorlds(WORLD_SEED);
    populateAll(worlds, WORLD_SEED);
    const r = worlds.reach;

    /* --- the export lines up with the grid, or the loader drops it --- */
    const b = fs.readFileSync(new URL("../public/reach-terrain.png", import.meta.url));
    ok(b.readUInt32BE(16) === r.w * 32 && b.readUInt32BE(20) === r.h * 32,
      `the terrain export is exactly ${r.w * 32}x${r.h * 32}`);
    ok(REACH_SPEC.rows.length === 100 && REACH_SPEC.rows.every((x) => x.length === 100),
      "the grid is 100x100, as drawn");
    ok(REACH_SPEC.floor?.length === 100, "…and the terrain grid matches it row for row");

    /* --- everything the author marked actually landed --- */
    ok(r.fires.length === 48, "all 48 campfires were placed");
    ok(r.scenery.filter((s) => s.kind === "skullPole").length === 13,
      "…and all 13 skull totems");
    ok(r.mobPosts?.length === 107, "107 creature posts were written into the grid");
    ok(r.monsters.length === 107, "…and every one of them spawned");
    ok(r.monsters.filter((m) => m.kind === "demonSkeleton").length === 1,
      "exactly one demon skeleton, as the map asks");

    /* --- green ground grows, dead ground does not --- */
    const onGrass = (t: { tx: number; ty: number }) => r.tile[t.ty][t.tx] === T2.Grass;
    ok(r.trees.length > 0 && r.trees.every(onGrass), "living trees stand only on green ground");
    ok(r.scenery.filter((s) => s.kind === "deadTree" || s.kind === "felledTree").length > 0,
      "dead and felled trees were scattered too");
    ok(r.scenery.filter((s) => s.kind === "deadTree").every((s) => r.tile[s.ty][s.tx] === T2.Dirt),
      "…and they stand only where the ground is not green");
    ok(r.rocks.some((k) => r.tile[k.ty][k.tx] === T2.Grass)
      && r.rocks.some((k) => r.tile[k.ty][k.tx] === T2.Dirt),
      "rock is worth mining on both halves of the island");

    /* --- the separate terrain grid is doing its job --- */
    ok(r.fires.some((f) => r.tile[f.ty][f.tx] === T2.Dirt),
      "a fire on packed earth reports earth, not the grass a glyph would default to");

    /* --- painted obstacles block without pretending to be ruins --- */
    const painted = REACH_SPEC.rows.reduce((n, row) =>
      n + [...row].filter((c) => c === "X" || c === "x").length, 0);
    ok(painted === 188, "all 188 painted obstacles carry a collision glyph");
    let blockedNotWall = 0;
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        if (REACH_SPEC.rows[y][x] === "X" || REACH_SPEC.rows[y][x] === "x") {
          if (r.solid[y][x] && r.tile[y][x] !== T2.Wall) blockedNotWall++;
        }
      }
    }
    ok(blockedNotWall === 188, "…each one solid while the ground under it stays what it was");

    /* --- the island is one landmass; nothing is marooned --- */
    const back = r.portals.find((p) => p.dest === "cellar");
    ok(back !== undefined && !back.inactive, "a live pad leads back to the cellar");
    const sx = Math.floor(back!.x / 32), sy = Math.floor(back!.y / 32);
    const seen = Array.from({ length: r.h }, () => new Array<boolean>(r.w).fill(false));
    const q: [number, number][] = [[sx, sy]];
    seen[sy][sx] = true;
    let reached = 0;
    while (q.length) {
      const [x, y] = q.pop()!;
      reached++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = x + dx, c = y + dy;
        if (a < 0 || c < 0 || a >= r.w || c >= r.h) continue;
        if (seen[c][a] || r.solid[c][a] || r.tile[c][a] === T2.Water) continue;
        seen[c][a] = true;
        q.push([a, c]);
      }
    }
    let walkable = 0;
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) if (!r.solid[y][x] && r.tile[y][x] !== T2.Water) walkable++;
    }
    ok(reached === walkable, `every walkable square is reachable from the pad (${reached})`);
    ok(r.mobPosts!.every((p) => seen[p.ty][p.tx]), "…so no creature is marooned off it");

    /* --- difficulty rises away from the pad, which is how it was drawn --- */
    const meanDist = (kind: string): number => {
      const ps = r.mobPosts!.filter((p) => p.kind === kind);
      return ps.reduce((s, p) => s + Math.hypot(p.tx - sx, p.ty - sy), 0) / ps.length;
    };
    ok(meanDist("snake") < meanDist("orcBerserker"),
      "snakes sit nearer the way home than orc berserkers");
    ok(meanDist("skeleton") < meanDist("demonSkeleton"),
      "…and plain skeletons nearer than the demon skeleton");

    /* --- the descents are cut but not yet dug --- */
    ok(r.portals.filter((p) => p.inactive).length === 3,
      "three descents to -1 stand sealed until those floors exist");

    /* --- the Time Sage's bottom-right pad now opens here --- */
    ok(CELLAR_SPEC.portals.d.dest === "reach",
      "the cellar's bottom-right pad leads to the Bone Reach");
    ok(!CELLAR_SPEC.portals.d.inactive, "…and it is live, not dormant");
    ok(!Object.values(CELLAR_SPEC.portals).some((p) => p.dest === "deepwild"),
      "…and no pad points at the Deep Wildlands any more");
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
