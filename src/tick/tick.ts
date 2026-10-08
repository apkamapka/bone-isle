/**
 * The game moving on by one frame (Etap 3.1d moved this here from main.ts).
 *
 * WHAT A TICK IS
 * --------------
 * Everything that happens because time passed rather than because the player
 * asked: the clocks running down, the walk toward a click, the blows at the
 * mark, the creatures moving and striking, bodies and dropped loot rotting,
 * the burning ground and the spells in flight, the fires, the rune circles
 * and the pads underfoot. It runs without a screen — the smoke suite runs it
 * in Node — because the server will run exactly this, for every player, and
 * send the clients what came of it.
 *
 * WHAT IS NOT IN IT
 * -----------------
 * The screen's share of the frame: the walk cycle and the bob, the floating
 * numbers, the spell art and the blood fading, the minimap, the windows that
 * close when you walk away, the sound of the place, and this browser's
 * autosave. Those stay in main.ts, which calls `tickGame` once a frame and
 * runs them around it.
 *
 * The four things the tick needs from the person at the controls — which way
 * they steer, whether a box is up, what to do on reaching something to use,
 * and a box to show them — come in through `TickControls` (controls.ts).
 *
 * The order of everything below is the order main.ts always ran it in. It
 * matters more than it looks: the creatures move after the player has, the
 * fed clock bites after the debts do, and the pads are the very last thing,
 * so a player carried to another world is carried once the frame is done.
 */
import { applyGates, applyMissionPads, respawnAtHome, type Game } from "../game.ts";
import { MONSTERS_ENABLED, RESPAWN_RETRY_S, FED_HP_PER_S, MELEE_REACH_PX, MIN_ELEMENTAL_DAMAGE } from "../config.ts";
import { dist, rndi } from "../util.ts";
import { playerSpeed } from "../entities/player.ts";
import { updateMonsters, MONSTER_DEFS, spawnAtPost, tickMonsterSlows } from "../entities/monsters.ts";
import { updateNpcs } from "../entities/npcs.ts";
import { toTile, glideWalker, tryStep, stepDir, atCenter } from "../world/grid.ts";
import { lineOfSight, isSafeTile } from "../world/collision.ts";
import { hurtPlayer } from "../systems/combat.ts";
import { gatherTick, tickRegrowth } from "../systems/gather.ts";
import { markBattle } from "../systems/battle.ts";
import { tickCrystalCooldown } from "../systems/crystals.ts";
import { tickSkull } from "../systems/pvp.ts";
import { tickBuffs, debtBite } from "../systems/buffs.ts";
import { ELEMENT_COLOR, elementEdgeMultiplier } from "../systems/elements.ts";
import { playerElement } from "../systems/tower.ts";
import { chasing } from "../systems/playerState.ts";
import { groundDecays } from "../systems/containers.ts";
import { updateMonsterSpells } from "../systems/monsterSpells.ts";
import { tickFields } from "../systems/fields.ts";
import { tickVoices } from "../systems/voices.ts";
import { mobDamageMult } from "../systems/elite.ts";
import { floatAt } from "../systems/fxEvents.ts";
import { tell, withinReach, structInReach } from "../intents/actor.ts";
import type { TickControls, TickReport } from "./controls.ts";
import { targetPoint, targetStruct, gatherPoint, attackMode } from "./targets.ts";
import { walkGrid, playerOcc, faceDelta, forgetRoute } from "./walk.ts";
import { strike, tickRangedFire, tickMeleeFire, coolArrowWarning, tickCampfireBurn, tickMonsterBurn } from "./fight.ts";
import { checkAttuneCircles, checkPortals } from "./places.ts";

export function tickGame(g: Game, dt: number, c: TickControls): TickReport {
  const P = g.player;
  const world = g.current;
  // level gates: seal/open against the current level (also right after level-ups)
  applyGates(world, P.level);
  // …and the same for the sage's doors, against the mission chain. Swept over
  // EVERY world rather than the current one because the pad that has to change
  // is usually somewhere else: take the mission in the cellar and the door that
  // lights is on the island you are not standing on yet.
  applyMissionPads(g.worlds, P.level);
  P.tpCd = Math.max(0, P.tpCd - dt);
  P.atkCd = Math.max(0, P.atkCd - dt);
  tickCrystalCooldown(dt);
  /* The skull's timer runs WHATEVER the player is doing, so it is ticked up
   * here where nothing can return past it: dying does not launder a frag, and
   * neither does standing still. (The chat's clock is the screen's and runs
   * at the top of the frame in main.ts, for the same reason.) */
  tickSkull(dt);

  // death → respawn countdown
  if (P.dead) {
    P.deadT -= dt;
    if (P.deadT <= 0) respawnAtHome(g);
    tickFields(dt);     // the ground the spell set alight still burns out on time
    // The long locks keep counting while you are face down. Death already
    // cleared the effects themselves, so this only advances `furyLock` and
    // `aegisLock` — and it has to, or lying dead would pause the half-hour
    // wait and dying would be a way to shorten it.
    tickBuffs(P.buffs, dt);
    // …and so does the cast behind it: a creature rooted in its windup when
    // you died would still be rooted when you walked back in.
    updateMonsterSpells(g.current, dt, { tx: P.tx, ty: P.ty, dead: true }, () => {});
    return { dead: true, steered: false };
  }

  let steered = false;

  // With a bow equipped (and arrows), an attack target is a "kite" target:
  // it survives manual movement so you can shoot and run (Tibia-style).
  const mode = attackMode(g);
  const kiting = !!P.target
    && (P.target.kind === "mob" || P.target.kind === "dummy")
    && mode.ranged;
  // A MELEE attack on a monster is just as sticky now: the marked target
  // survives manual movement, and tickMeleeFire below swings whenever the
  // monster is in reach — so you can step around, loot, and keep fighting.
  const holdMelee = !!P.target && P.target.kind === "mob" && !mode.ranged;

  // movement: WASD/joystick overrides auto-actions. All walking is grid
  // walking now (Tibia-style): the player stands on ONE tile, glides toward
  // its centre, and only from the centre claims an adjacent square. Monsters
  // hard-block their tiles — a free square is always a real escape route.
  /* A box on screen stops the feet. Both the keys and any click-to-walk
   * destination already in flight, because a player who tapped the far side of
   * the room and then stepped on the pad would otherwise read the chronicle
   * while sliding out from under it. */
  if (c.reading()) { P.dest = null; P.gather = null; }
  const ax = c.reading() ? { dx: 0, dy: 0 } : c.axis();
  // Tibia-style grid walking: whatever state we're in, ALWAYS finish the
  // in-flight glide toward the current tile centre FIRST. A step, once begun,
  // always completes — so the player can never come to rest between tiles
  // (releasing the key mid-step no longer freezes it half-way; approaching a
  // monster / node settles it cleanly too). The unspent budget then funds any
  // NEW steps below. While the glide is still running this frame `budget`
  // comes back 0 and every branch simply waits a frame.
  let budget = playerSpeed(P) * dt;
  budget = glideWalker(P, budget);
  if (ax.dx || ax.dy) {
    P.dest = null; P.gather = null;
    steered = true; // the client forgets a body it was walking the player to
    if (!kiting && !holdMelee) P.target = null; // non-combat targets still drop
    const occ = playerOcc(world);
    for (;;) {
      if (budget <= 0) break;
      const { sx, sy } = stepDir(ax.dx, ax.dy);
      if (!sx && !sy) break;
      // diagonal blocked → slide along whichever axis is free (wall hugging)
      if (!tryStep(world, P, sx, sy, occ)
        && !(sx && sy && (tryStep(world, P, sx, 0, occ) || tryStep(world, P, 0, sy, occ)))) break;
      budget = glideWalker(P, budget); // glide onto the freshly-claimed tile
    }
    forgetRoute(P); // manual steps invalidate any cached auto-route
    faceDelta(P, ax.dx, ax.dy);
  } else if (P.dest) {
    const gx = toTile(P.dest.x);
    const gy = toTile(P.dest.y);
    const there = P.tx === gx && P.ty === gy && atCenter(P);
    if (there) P.dest = null;
    else {
      const moved = walkGrid(g, world, gx, gy, budget);
      if (P.tx === gx && P.ty === gy && atCenter(P)) P.dest = null;
      // unreachable click (water, rock): the best-effort route ended — stop
      else if (!moved && atCenter(P)) P.dest = null;
    }
  } else if (P.target && !kiting) {
    // melee / walk-up targets: approach along the grid, then act.
    //
    // STAND WHILE FIGHTING (chase off) applies to CREATURES only. Walking up
    // to a chest, a corpse or an NPC is not a chase — it is the only way to
    // reach them, and a player who turned off pursuit did not mean "never
    // walk to a body again". Tibia draws the line in the same place: the
    // toggle is labelled for opponents.
    const chaseBlocked = !chasing()
      && (P.target.kind === "mob" || P.target.kind === "dummy");
    const tp = targetPoint(g);
    if (tp) {
      // Anything that OPENS A PANEL is measured with the very rule the panel
      // closes on. Mixing the two — walk up to 48 px, then judge the open
      // window by squares — is how you get a chest that pops and shuts in the
      // same breath, because 48 px reaches a tile the square rule calls two
      // away. Fighting keeps its pixel reach: a blade is not a window.
      const t = P.target;
      const inReach = t.kind === "corpse" || t.kind === "ground" ? withinReach(g, tp.x, tp.y)
        : t.kind === "structure" ? (() => { const st = targetStruct(g, t); return !!st && structInReach(g, st); })()
        : dist(P.x, P.y, tp.x, tp.y) <= (t.kind === "dummy" || t.kind === "mob" ? mode.reach : MELEE_REACH_PX);
      if (inReach) resolveTarget(g, c);
      else if (chaseBlocked) {
        // standing our ground: keep the mark, take no step. tickMeleeFire
        // below still swings the moment the creature walks into reach.
      } else {
        const moved = walkGrid(g, world, toTile(tp.x), toTile(tp.y), budget);
        // the route ran out without arriving (walled-in chest, corpse across
        // water): let go rather than shuffle against the obstacle forever
        if (!moved && atCenter(P) && (t.kind === "corpse" || t.kind === "structure" || t.kind === "ground")) {
          P.target = null;
          tell(g, "too far away", "#e0a06a");
        }
      }
    }
  } else if (kiting) {
    // idle bowman: close the gap when the target drifted out of range OR a
    // wall blocks the shot (walk around the corner instead of standing dumb)
    const tp = targetPoint(g);
    if (tp) {
      const d = dist(P.x, P.y, tp.x, tp.y);
      const blocked = P.target?.kind === "mob" && !lineOfSight(world, P.x, P.y, tp.x, tp.y);
      // Standing archer: hold the spot and let the shot lapse rather than
      // walking into the pack. This is the case the switch was asked for.
      if (chasing() && (d > mode.reach || blocked)) walkGrid(g, world, toTile(tp.x), toTile(tp.y), budget);
    }
  } else if (P.gather) {
    const gp = gatherPoint(g);
    if (gp) {
      const d = dist(P.x, P.y, gp.x, gp.y);
      if (d > MELEE_REACH_PX) walkGrid(g, world, toTile(gp.x), toTile(gp.y), budget);
      else if (P.atkCd <= 0 && P.gather) {
        gatherTick(world, P, P.gather);
      }
    }
  }

  // Ranged fire pass: with a bow, keep shooting the kept target whenever it's in
  // range and off cooldown — whether we're standing still or kiting on the move.
  if (kiting) tickRangedFire(g, mode);
  // Melee fire pass — the sword-arm mirror of the above: the marked monster
  // eats a swing whenever it's within reach and the attack is off cooldown,
  // even while the player is walking or has a loot window open.
  else if (holdMelee) tickMeleeFire(g);

  // monsters attack the player (only on dangerous islands)
  if (!world.safe) {
    updateMonsters(world, dt, { x: P.x, y: P.y, tx: P.tx, ty: P.ty, dead: P.dead }, (m, ranged) => {
      /* THE OTHER HALF OF THE ZONE. A creature cannot WALK into a haven, and
       * that was taken for a sanctuary — but a crossbowman reaches three
       * hundred pixels and a sword reaches across the boundary tile, so the
       * haven only ever stopped the ones that had to come to you. Asked on
       * the tile the player is standing on RIGHT NOW, so stepping in cuts a
       * bolt already loosed rather than letting it land a beat later. */
      if (isSafeTile(world, P.tx, P.ty)) return;
      markBattle();
      const d = MONSTER_DEFS[m.kind];
      const roll = ranged && d.ranged ? d.ranged.dmg : d.dmg;
      hurtPlayer(world, P, Math.round(rndi(roll[0], roll[1]) * mobDamageMult(m)));
    });
    // respawns — never on top of the player (Tibia: nothing spawns on screen);
    // if the whole area is camped, the respawn retries a few seconds later.
    if (MONSTERS_ENABLED) {
      for (let i = world.respawns.length - 1; i >= 0; i--) {
        const r = world.respawns[i];
        r.t -= dt;
        if (r.t <= 0) {
          // Every creature in the game is posted, so this is the only path
          // left: it goes back to the square the map's author drew it on, or
          // — if the player is standing there — to the nearest free ring
          // around it. Etap 40 removed the camp and scatter branches.
          const done = r.guard
            ? spawnAtPost(world, r.kind, r.guard.tx, r.guard.ty, P)
            : false;
          if (done) world.respawns.splice(i, 1);
          else r.t = RESPAWN_RETRY_S;
        }
      }
    }
  }

  // corpse decay
  for (let i = world.corpses.length - 1; i >= 0; i--) {
    world.corpses[i].t -= dt;
    // a body rotting under an open loot window takes the window with it —
    // the client sees it is gone (main.ts, `sweepVanished`)
    if (world.corpses[i].t <= 0) world.corpses.splice(i, 1);
  }

  /* Dropped items fade from the ground after their lifetime (1h) — except
   * CONTAINERS, which never do.
   *
   * A loot bag is a place you deliberately leave things. If it rotted on the
   * same hour timer as a stray log, the feature would be a trap: you set your
   * bag down by the corpses, clear a floor, come back and both the bag and
   * everything in it are gone. Tibia's ground never eats a backpack either.
   * The bag persists; the wood you dropped by accident still tidies itself. */
  for (let i = world.ground.length - 1; i >= 0; i--) {
    if (!groundDecays(world.ground[i])) continue;
    world.ground[i].t -= dt;
    if (world.ground[i].t > 0) continue;
    // a loot bag rotting out from under an open window takes the window with
    // it, or the player is left dragging things into nowhere — the client sees
    // it is gone (main.ts, `sweepVanished`)
    world.ground.splice(i, 1);
  }

  /* Rune effects, and Fury's bill.
   *
   * The damage is dealt HERE rather than inside buffs.ts because that module
   * must not import combat.ts — `hurtPlayer` asks it for the Aegis cut and the
   * Fury multiplier, so the arrow only points one way. `tickBuffs` counts the
   * ticks that came due and this is the one place that knows how to hurt
   * somebody.
   *
   * It goes through `hurtPlayer` as ELEMENTAL, which is what it is: the burn
   * is inside you and no shield answers it. Aegis does reduce it, and that is
   * fine — fifteen seconds against a five-minute debt is under a twentieth of
   * the bill, so it reads as a small mercy rather than a way out.
   *
   * Mire ticks with the creatures it slowed, which is why that call sits next
   * to this one rather than in updateMonsters: both are "time passing for an
   * effect somebody bought". */
  tickMonsterSlows(world, dt);
  const bites = tickBuffs(P.buffs, dt);
  if (bites > 0 && !P.dead) {
    for (let i = 0; i < bites && !P.dead; i++) {
      hurtPlayer(world, P, debtBite(P.maxhp), true);
    }
  }

  // fed regeneration (Tibia-style): HP trickles back only while fed. The fed
  // clock ticks down regardless of HP, exactly like the original.
  if (P.fedS > 0) {
    P.fedS = Math.max(0, P.fedS - dt);
    if (!P.dead && P.hp < P.maxhp) P.hp = Math.min(P.maxhp, P.hp + FED_HP_PER_S * dt);
  }

  // "no arrows" may be said again once its clock runs out
  coolArrowWarning(P, dt);

  // the burning ground is NOT cosmetic — it hurts — so it ages on the game's
  // beat; the spell art around it is the client's
  tickFields(dt);
  // monster casts: windups landing, and the ground they left on fire. This is
  // the one place spell damage reaches the player from a creature, so it is
  // deliberately the same `hurtPlayer` the melee exchange uses — elemental
  // damage ignores armor on its own, inside the damage roll.
  updateMonsterSpells(world, dt, { tx: P.tx, ty: P.ty, dead: P.dead }, (dmg, el, name) => {
    markBattle();
    const adjusted = Math.max(MIN_ELEMENTAL_DAMAGE,
      Math.round(dmg * elementEdgeMultiplier(el, playerElement())));
    hurtPlayer(world, P, adjusted, true);
    // Only the discrete hits announce themselves. The per-second burn passes
    // `null`: it already draws a number every tick, and stacking the word
    // "burning" on top of it once a second buried the player under his own
    // damage log while he was standing in a fire he can plainly see.
    if (name) floatAt(world, P.x, P.y - 26, name, ELEMENT_COLOR[el]);
  });

  tickCampfireBurn(g, world, dt);
  tickMonsterBurn(g, world);
  checkAttuneCircles(g, world, c);

  tickRegrowth(world, dt, P.x, P.y, true);
  tickVoices(world, dt, P.x, P.y);
  updateNpcs(world, dt, P.x, P.y);
  checkPortals(g, c);
  return { dead: false, steered };
}

/**
 * The mark is in reach: fight it, or hand it over to be used.
 *
 * Every branch resolves its id first and lets go of a target that no longer
 * exists. That "if it is gone, drop it" line used to be three different
 * checks in three different shapes — `includes()`, `hp <= 0`, and nothing at
 * all for structures — and now it is one, because a stale id cannot resolve.
 *
 * A creature or a training dummy is struck (`strike`, fight.ts). Anything
 * else — a body, a stack on the floor, a townsperson, a building — is USED,
 * which means a window, a conversation, a pickup or a treasure chest, and
 * that is the client's to carry out (`TickControls.arrive`). The mark is let
 * go either way, as it always was.
 */
function resolveTarget(g: Game, c: TickControls): void {
  const P = g.player;
  const t = P.target;
  if (!t) return;
  if (t.kind === "mob" || t.kind === "dummy") {
    strike(g, t);
    return;
  }
  c.arrive(t);
  P.target = null;
}
