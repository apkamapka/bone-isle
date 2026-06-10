import "./style.css";
import { VIEW_W, VIEW_H, TILE, MAP_W, MAP_H } from "./config.ts";
import { moveEntity } from "./world/collision.ts";
import { SPR } from "./gfx/sprites.ts";
import { clamp, dist, rndi } from "./util.ts";
import { playerSpeed } from "./entities/player.ts";
import { updateMonsters, MONSTER_DEFS, spawnMonster } from "./entities/monsters.ts";
import { playerAttack, hurtPlayer } from "./systems/combat.ts";
import { gatherTick, tickRegrowth } from "./systems/gather.ts";
import { addFloat, updateFloats, drawFloats } from "./fx.ts";
import { beep, unlockAudio } from "./audio.ts";
import { initInput, moveAxis, isDown } from "./input.ts";
import { createGame, switchWorld, respawnAtHome } from "./game.ts";
import type { Vec, World, Monster } from "./world/types.ts";

/* ------------------------------------------------------------------
   Step 5: two islands joined by the portal. Home Isle is safe (no
   monsters, build pads glow); Wild Isle has the fights. Walk onto the
   portal to travel. Gathering is back: click a tree to chop (wood) or a
   rock to mine (stone); both deplete and regrow.
   ------------------------------------------------------------------ */

const screen = document.createElement("canvas");
screen.style.imageRendering = "pixelated";
document.body.appendChild(screen);
const sctx = screen.getContext("2d")!;

const view = document.createElement("canvas");
view.width = VIEW_W;
view.height = VIEW_H;
const vctx = view.getContext("2d")!;

let scale = 2;
function resize(): void {
  scale = Math.max(1, Math.floor(Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H)));
  screen.width = VIEW_W * scale;
  screen.height = VIEW_H * scale;
  sctx.imageSmoothingEnabled = false;
}
addEventListener("resize", resize);
resize();

const game = createGame();
const cam = { x: 0, y: 0 };
let moveMarker: { x: number; y: number; t: number } | null = null;
let waveT = 0;
let last = performance.now();

const cw = (): World => game.current;
const P = game.player;

initInput(screen, {
  toWorld: (sx, sy): Vec => ({ x: sx / scale + cam.x, y: sy / scale + cam.y }),
  onClick: (w) => {
    unlockAudio();
    if (P.dead) return;
    const world = cw();
    // monster?
    for (const m of world.monsters) {
      if (Math.abs(w.x - m.x) < 8 && w.y > m.y - 16 && w.y < m.y + 4) {
        P.target = { kind: "mob", m };
        P.dest = null;
        P.gather = null;
        moveMarker = null;
        return;
      }
    }
    // tree?
    for (const tr of world.trees) {
      if (tr.stump) continue;
      const cx = tr.tx * TILE + TILE / 2;
      if (Math.abs(w.x - cx) < 8 && w.y > tr.ty * TILE + TILE - 27 && w.y < tr.ty * TILE + TILE + 2) {
        P.gather = { kind: "tree", obj: tr };
        P.target = null;
        P.dest = null;
        moveMarker = null;
        return;
      }
    }
    // rock?
    for (const rk of world.rocks) {
      if (rk.depleted) continue;
      const cx = rk.tx * TILE + TILE / 2;
      const cy = rk.ty * TILE + TILE / 2;
      if (Math.abs(w.x - cx) < 9 && Math.abs(w.y - cy) < 8) {
        P.gather = { kind: "rock", obj: rk };
        P.target = null;
        P.dest = null;
        moveMarker = null;
        return;
      }
    }
    // ground move
    P.target = null;
    P.gather = null;
    P.dest = { x: w.x, y: w.y };
    moveMarker = { x: w.x, y: w.y, t: 0.8 };
  },
});

function update(dt: number): void {
  P.tpCd = Math.max(0, P.tpCd - dt);
  const world = cw();

  if (P.dead) {
    P.deadT -= dt;
    if (P.deadT <= 0) respawnAtHome(game);
  } else {
    const spd = playerSpeed(P);

    const { dx, dy } = moveAxis();
    if (dx || dy) {
      P.dest = null;
      P.gather = null;
      const l = Math.hypot(dx, dy);
      moveEntity(world, P, (dx / l) * spd * dt, (dy / l) * spd * dt);
      P.bob += dt * 10;
      if (dx) P.face = dx < 0 ? -1 : 1;
    }

    if (P.dest) {
      const d = dist(P.x, P.y, P.dest.x, P.dest.y);
      if (d < 3) {
        P.dest = null;
      } else {
        const vx = (P.dest.x - P.x) / d;
        const vy = (P.dest.y - P.y) / d;
        const ox = P.x;
        const oy = P.y;
        moveEntity(world, P, vx * spd * dt, vy * spd * dt);
        if (Math.abs(P.x - ox) < 0.01 && Math.abs(P.y - oy) < 0.01) P.dest = null;
        P.bob += dt * 10;
        if (vx) P.face = vx < 0 ? -1 : 1;
      }
    }

    P.atkCd -= dt;

    // chase + auto-attack a monster target
    if (P.target && P.target.kind === "mob") {
      const m = P.target.m;
      if (!world.monsters.includes(m)) {
        P.target = null;
      } else {
        const d = dist(P.x, P.y, m.x, m.y);
        if (d > 20) {
          const vx = (m.x - P.x) / d;
          const vy = (m.y - P.y) / d;
          moveEntity(world, P, vx * spd * dt, vy * spd * dt);
          P.bob += dt * 10;
          if (vx) P.face = vx < 0 ? -1 : 1;
        } else if (P.atkCd <= 0) {
          P.atkCd = P.atkRate;
          if (playerAttack(world, P, m)) P.target = null;
        }
      }
    }

    // walk to + harvest a gather target
    if (P.gather) {
      const g = P.gather;
      const done = g.kind === "tree" ? g.obj.stump : g.obj.depleted;
      if (done) {
        P.gather = null;
      } else {
        const o = g.obj;
        const cx = o.tx * TILE + TILE / 2;
        const cy = o.ty * TILE + TILE - 4;
        const d = dist(P.x, P.y, cx, cy);
        if (d > 19) {
          const vx = (cx - P.x) / d;
          const vy = (cy - P.y) / d;
          moveEntity(world, P, vx * spd * dt, vy * spd * dt);
          P.bob += dt * 10;
          if (vx) P.face = vx < 0 ? -1 : 1;
        } else if (P.atkCd <= 0) {
          gatherTick(world, P, g);
        }
      }
    }

    // slow regen
    P.regen += dt;
    if (P.regen > 2) {
      P.regen = 0;
      if (P.hp < P.maxhp) P.hp = Math.min(P.maxhp, P.hp + 1);
    }

    // loot pickup
    for (let i = world.loot.length - 1; i >= 0; i--) {
      const it = world.loot[i];
      if (dist(P.x, P.y, it.x, it.y) < 10) {
        P.inv[it.type]++;
        addFloat(world, P.x, P.y - 16, `+1 ${it.type === "bones" ? "bone" : "coin"}`, "#fff2c4");
        beep(it.type === "coins" ? 880 : 520, 0.08, "triangle", 0.06);
        world.loot.splice(i, 1);
      }
    }

    // portal contact
    if (P.tpCd <= 0 && dist(P.x, P.y, world.portal.x, world.portal.y) < 11) switchWorld(game);
  }

  // monsters only act in the current world (Home has none)
  const tgt = { x: P.x, y: P.y, dead: P.dead };
  updateMonsters(world, dt, tgt, (m: Monster) => {
    const dd = MONSTER_DEFS[m.kind].dmg;
    hurtPlayer(world, P, rndi(dd[0], dd[1]));
  });

  // respawns + resource regrowth in BOTH worlds
  for (const w of [game.home, game.wild]) {
    for (let i = w.respawns.length - 1; i >= 0; i--) {
      w.respawns[i].t -= dt;
      if (w.respawns[i].t <= 0) {
        // Home Isle is safe, so a stray respawn entry there is simply discarded.
        if (!w.safe) spawnMonster(w, w.respawns[i].kind);
        w.respawns.splice(i, 1);
      }
    }
    tickRegrowth(w, dt, P.x, P.y, w === world);
  }

  updateFloats(dt);
  for (const it of world.loot) it.t += dt;
  if (moveMarker) {
    moveMarker.t -= dt;
    if (moveMarker.t <= 0) moveMarker = null;
  }
  if (game.zoneFlash.t > 0) game.zoneFlash.t -= dt;
  game.tpFlash = Math.max(0, game.tpFlash - dt * 1.6);

  cam.x = clamp(P.x - VIEW_W / 2, 0, MAP_W * TILE - VIEW_W);
  cam.y = clamp(P.y - VIEW_H / 2, 0, MAP_H * TILE - VIEW_H);
}

function drawBar(wx: number, wy: number, frac: number): void {
  const x = Math.floor(wx - 8 - cam.x);
  const y = Math.floor(wy - cam.y);
  vctx.fillStyle = "#000";
  vctx.fillRect(x - 1, y - 1, 18, 4);
  const f = clamp(frac, 0, 1);
  vctx.fillStyle = f > 0.6 ? "#46d35b" : f > 0.3 ? "#e3b341" : "#e1483b";
  vctx.fillRect(x, y, Math.round(16 * f), 2);
}

function drawShadow(x: number, y: number, w: number): void {
  vctx.fillStyle = "rgba(0,0,0,.22)";
  vctx.fillRect(Math.floor(x - w / 2 - cam.x), Math.floor(y - 1 - cam.y), w, 3);
}

function drawPortal(world: World): void {
  const px = world.portal.x - cam.x;
  const py = world.portal.y - cam.y;
  const pulse = 0.25 + 0.18 * Math.sin(waveT * 2.4);
  vctx.globalAlpha = pulse;
  vctx.fillStyle = "#7be0d2";
  vctx.beginPath();
  vctx.ellipse(px, py, 9, 5, 0, 0, 6.283);
  vctx.fill();
  vctx.globalAlpha = pulse * 0.7;
  vctx.fillStyle = "#c08bf0";
  vctx.beginPath();
  vctx.ellipse(px, py, 5, 3, 0, 0, 6.283);
  vctx.fill();
  vctx.globalAlpha = 1;
  for (let i = 0; i < 8; i++) {
    const th = waveT * 1.8 + i * 0.785;
    const sx = px + Math.cos(th) * 10;
    const sy = py + Math.sin(th) * 5.5 - Math.sin(waveT * 3 + i) * 1.5;
    vctx.fillStyle = i % 2 ? "#8be8dc" : "#d2a8ff";
    vctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
  }
}

function drawMob(m: Monster): void {
  drawShadow(m.x, m.y, 9);
  const bob = Math.sin(m.bob) > 0 ? -1 : 0;
  const x = Math.floor(m.x - m.spr.width / 2 - cam.x);
  const y = Math.floor(m.y - m.spr.height - cam.y) + bob + 1;
  if (m.hurtT > 0) vctx.globalAlpha = 0.6;
  vctx.drawImage(m.spr, x, y);
  vctx.globalAlpha = 1;
  drawBar(m.x, m.y - m.spr.height - 3, m.hp / m.maxhp);
}

function drawPlayer(): void {
  if (P.dead) {
    vctx.drawImage(SPR.bones, Math.floor(P.x - cam.x) - 4, Math.floor(P.y - cam.y) - 4);
    return;
  }
  drawShadow(P.x, P.y, 9);
  const moving =
    P.dest !== null || P.target !== null || P.gather !== null ||
    isDown("w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright");
  const bob = moving && Math.sin(P.bob) > 0 ? -1 : 0;
  const x = Math.floor(P.x - 5 - cam.x);
  const y = Math.floor(P.y - 13 - cam.y) + bob;
  vctx.drawImage(P.spr, x, y);
  if (P.face >= 0) {
    vctx.drawImage(SPR.sword, x + 10, y + 5);
  } else {
    vctx.save();
    vctx.translate(x, y + 5);
    vctx.scale(-1, 1);
    vctx.drawImage(SPR.sword, 1, 0);
    vctx.restore();
  }
  drawBar(P.x, P.y - 17, P.hp / P.maxhp);
}

interface Drawable {
  y: number;
  draw: () => void;
}

function render(): void {
  const world = cw();
  vctx.drawImage(world.mapCanvas, -Math.floor(cam.x), -Math.floor(cam.y));

  vctx.fillStyle = "rgba(170,225,212,.6)";
  for (const wv of world.coastWater) {
    const sx = wv.x - cam.x;
    const sy = wv.y - cam.y;
    if (sx < -TILE || sy < -TILE || sx > VIEW_W || sy > VIEW_H) continue;
    const ph = Math.sin(waveT * 1.6 + wv.ph);
    if (ph > 0.2) vctx.fillRect(Math.floor(sx + 4 + ph * 4), Math.floor(sy + 6), 5, 1);
    if (ph < -0.4) vctx.fillRect(Math.floor(sx + 2 - ph * 3), Math.floor(sy + 11), 4, 1);
  }

  // stumps & rubble (ground level)
  for (const tr of world.trees)
    if (tr.stump) vctx.drawImage(SPR.stump, Math.floor(tr.tx * TILE + 4 - cam.x), Math.floor(tr.ty * TILE + 9 - cam.y));
  for (const rk of world.rocks)
    if (rk.depleted) vctx.drawImage(SPR.rubble, Math.floor(rk.tx * TILE + 4 - cam.x), Math.floor(rk.ty * TILE + 9 - cam.y));

  drawPortal(world);

  // build pads (home only)
  if (world.safe) {
    for (const s of world.buildSpots) {
      if (s.built) continue;
      const x = Math.floor(s.tx * TILE - cam.x);
      const y = Math.floor(s.ty * TILE - cam.y);
      vctx.globalAlpha = 0.35 + 0.3 * Math.sin(waveT * 3 + s.tx);
      vctx.strokeStyle = "#e3b341";
      vctx.lineWidth = 1;
      vctx.strokeRect(x + 0.5, y + 0.5, 31, 31);
      vctx.fillStyle = "#e3b341";
      for (const [ox, oy] of [[0, 0], [29, 0], [0, 29], [29, 29]] as const) vctx.fillRect(x + ox, y + oy, 3, 3);
      vctx.globalAlpha = 1;
    }
  }

  if (moveMarker) {
    const x = Math.floor(moveMarker.x - cam.x);
    const y = Math.floor(moveMarker.y - cam.y);
    vctx.globalAlpha = moveMarker.t;
    vctx.fillStyle = "#ffe27a";
    vctx.fillRect(x - 3, y, 7, 1);
    vctx.fillRect(x, y - 3, 1, 7);
    vctx.globalAlpha = 1;
  }

  for (const it of world.loot) {
    const s = it.type === "bones" ? SPR.bones : SPR.coin;
    const hov = Math.sin(it.t * 4) > 0 ? 0 : -1;
    vctx.drawImage(s, Math.floor(it.x - cam.x - s.width / 2), Math.floor(it.y - cam.y - s.height + 2 + hov));
  }

  const draws: Drawable[] = [];
  for (const tr of world.trees) {
    if (tr.stump) continue;
    draws.push({
      y: tr.ty * TILE + TILE,
      draw: () => {
        const x = tr.tx * TILE - cam.x;
        const y = tr.ty * TILE + TILE - 26 - cam.y;
        vctx.fillStyle = "rgba(0,0,0,.2)";
        vctx.fillRect(Math.floor(tr.tx * TILE + 2 - cam.x), Math.floor(tr.ty * TILE + TILE - 4 - cam.y), 12, 3);
        if (tr.hurtT > 0) vctx.globalAlpha = 0.6;
        vctx.drawImage(tr.spr, Math.floor(x), Math.floor(y));
        vctx.globalAlpha = 1;
        if (tr.hp < tr.maxhp) drawBar(tr.tx * TILE + TILE / 2, tr.ty * TILE - 12, tr.hp / tr.maxhp);
      },
    });
  }
  for (const rk of world.rocks) {
    if (rk.depleted) continue;
    draws.push({
      y: rk.ty * TILE + TILE - 2,
      draw: () => {
        if (rk.hurtT > 0) vctx.globalAlpha = 0.6;
        vctx.drawImage(SPR.rock, Math.floor(rk.tx * TILE + 3 - cam.x), Math.floor(rk.ty * TILE + TILE - 8 - cam.y));
        vctx.globalAlpha = 1;
        if (rk.hp < rk.maxhp) drawBar(rk.tx * TILE + TILE / 2, rk.ty * TILE + 2, rk.hp / rk.maxhp);
      },
    });
  }
  for (const m of world.monsters) draws.push({ y: m.y, draw: () => drawMob(m) });
  draws.push({ y: P.y, draw: drawPlayer });
  draws.sort((a, b) => a.y - b.y);
  for (const d of draws) d.draw();

  // target marker (monsters)
  if (P.target && P.target.kind === "mob") {
    const m = P.target.m;
    const x = Math.floor(m.x - cam.x);
    const y = Math.floor(m.y - cam.y - 7);
    vctx.strokeStyle = "#ff4b3a";
    vctx.lineWidth = 1;
    const r = 9;
    vctx.beginPath();
    const corners: ReadonlyArray<readonly [number, number, number, number]> = [
      [-r, -r, 1, 0], [-r, -r, 0, 1], [r, -r, -1, 0], [r, -r, 0, 1],
      [-r, r, 1, 0], [-r, r, 0, -1], [r, r, -1, 0], [r, r, 0, -1],
    ];
    for (const [ox, oy, ddx, ddy] of corners) {
      vctx.moveTo(x + ox + 0.5, y + oy + 0.5);
      vctx.lineTo(x + ox + ddx * 4 + 0.5, y + oy + ddy * 4 + 0.5);
    }
    vctx.stroke();
  }
  // gather marker (green box)
  if (P.gather) {
    const o = P.gather.obj;
    const x = Math.floor(o.tx * TILE + TILE / 2 - cam.x);
    const y = Math.floor(o.ty * TILE + (P.gather.kind === "tree" ? 2 : 6) - cam.y);
    vctx.strokeStyle = "#9fe8a8";
    vctx.lineWidth = 1;
    vctx.strokeRect(x - 8.5, y - 8.5, 17, 17);
  }

  drawFloats(vctx, world, cam.x, cam.y);

  // teleport flash
  if (game.tpFlash > 0) {
    vctx.globalAlpha = game.tpFlash * 0.8;
    vctx.fillStyle = "#bfeee6";
    vctx.fillRect(0, 0, VIEW_W, VIEW_H);
    vctx.globalAlpha = 1;
  }

  // banner + zone label
  vctx.font = "bold 8px monospace";
  vctx.textAlign = "left";
  vctx.fillStyle = "rgba(0,0,0,.6)";
  vctx.fillText(`${world.name} · click tree/rock to gather · portal to travel`, 9, 15);
  vctx.fillStyle = "#cfe8d2";
  vctx.fillText(`${world.name} · click tree/rock to gather · portal to travel`, 8, 14);

  if (game.zoneFlash.t > 0) {
    vctx.globalAlpha = clamp(game.zoneFlash.t, 0, 1);
    vctx.textAlign = "center";
    vctx.font = "bold 14px monospace";
    vctx.fillStyle = "#ffe9a8";
    vctx.fillText(game.zoneFlash.text, VIEW_W / 2, 40);
    vctx.globalAlpha = 1;
  }

  if (P.dead) {
    vctx.fillStyle = "rgba(20,10,10,.45)";
    vctx.fillRect(0, 0, VIEW_W, VIEW_H);
    vctx.textAlign = "center";
    vctx.font = "bold 20px monospace";
    vctx.fillStyle = "#ff6a5e";
    vctx.fillText("You died", VIEW_W / 2, VIEW_H / 2 - 6);
    vctx.font = "bold 8px monospace";
    vctx.fillStyle = "#f3eedd";
    vctx.fillText(`respawning at Home Isle in ${Math.ceil(P.deadT)}...`, VIEW_W / 2, VIEW_H / 2 + 12);
  }

  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(view, 0, 0, VIEW_W * scale, VIEW_H * scale);
}

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  waveT += dt;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
