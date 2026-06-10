import "./style.css";
import { VIEW_W, VIEW_H, TILE, MAP_W, MAP_H } from "./config.ts";
import { makeWorld } from "./world/generate.ts";
import { moveEntity, portalSpawn } from "./world/collision.ts";
import { SPR } from "./gfx/sprites.ts";
import { clamp, dist } from "./util.ts";
import { createPlayer, playerSpeed } from "./entities/player.ts";
import { spawnMonster, updateMonsters, MONSTER_DEFS } from "./entities/monsters.ts";
import { playerAttack, hurtPlayer } from "./systems/combat.ts";
import { addFloat, updateFloats, drawFloats } from "./fx.ts";
import { beep, unlockAudio } from "./audio.ts";
import { initInput, moveAxis, isDown } from "./input.ts";
import { rndi } from "./util.ts";
import type { Vec, World, Monster } from "./world/types.ts";

/* ------------------------------------------------------------------
   Step 4: monsters + combat. The active world is now the Wild Isle so
   there's something to fight. Click a monster to attack (auto-melee in
   range), damage floats, loot drops, death + 10s respawn.
   Portal-to-Home, gathering and panels arrive in the next steps.
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

const world: World = makeWorld({
  name: "Wild Isle",
  safe: false,
  buildSpots: false,
  trees: 6,
  rocks: 6,
  mushrooms: 3,
  bones: 7,
  grassShift: -14,
});

for (let i = 0; i < 4; i++) spawnMonster(world, "skeleton");
for (let i = 0; i < 3; i++) spawnMonster(world, "goblin");

const player = createPlayer(portalSpawn(world));
const cam = { x: 0, y: 0 };
let moveMarker: { x: number; y: number; t: number } | null = null;

initInput(screen, {
  toWorld: (sx, sy): Vec => ({ x: sx / scale + cam.x, y: sy / scale + cam.y }),
  onClick: (w) => {
    unlockAudio();
    if (player.dead) return;
    // click a monster -> target it
    for (const m of world.monsters) {
      if (Math.abs(w.x - m.x) < 8 && w.y > m.y - 16 && w.y < m.y + 4) {
        player.target = { kind: "mob", m };
        player.dest = null;
        moveMarker = null;
        return;
      }
    }
    // otherwise walk
    player.target = null;
    player.dest = { x: w.x, y: w.y };
    moveMarker = { x: w.x, y: w.y, t: 0.8 };
  },
});

let waveT = 0;
let last = performance.now();

function update(dt: number): void {
  if (player.dead) {
    player.deadT -= dt;
    if (player.deadT <= 0) {
      player.dead = false;
      player.hp = player.maxhp;
      const p = portalSpawn(world);
      player.x = p.x;
      player.y = p.y;
    }
  } else {
    const spd = playerSpeed(player);

    const { dx, dy } = moveAxis();
    if (dx || dy) {
      player.dest = null;
      const l = Math.hypot(dx, dy);
      moveEntity(world, player, (dx / l) * spd * dt, (dy / l) * spd * dt);
      player.bob += dt * 10;
      if (dx) player.face = dx < 0 ? -1 : 1;
    }

    if (player.dest) {
      const d = dist(player.x, player.y, player.dest.x, player.dest.y);
      if (d < 3) {
        player.dest = null;
      } else {
        const vx = (player.dest.x - player.x) / d;
        const vy = (player.dest.y - player.y) / d;
        const ox = player.x;
        const oy = player.y;
        moveEntity(world, player, vx * spd * dt, vy * spd * dt);
        if (Math.abs(player.x - ox) < 0.01 && Math.abs(player.y - oy) < 0.01) player.dest = null;
        player.bob += dt * 10;
        if (vx) player.face = vx < 0 ? -1 : 1;
      }
    }

    // chase + auto-attack the targeted monster
    player.atkCd -= dt;
    if (player.target && player.target.kind === "mob") {
      const m = player.target.m;
      if (!world.monsters.includes(m)) {
        player.target = null;
      } else {
        const d = dist(player.x, player.y, m.x, m.y);
        if (d > 20) {
          const vx = (m.x - player.x) / d;
          const vy = (m.y - player.y) / d;
          moveEntity(world, player, vx * spd * dt, vy * spd * dt);
          player.bob += dt * 10;
          if (vx) player.face = vx < 0 ? -1 : 1;
        } else if (player.atkCd <= 0) {
          player.atkCd = player.atkRate;
          const died = playerAttack(world, player, m);
          if (died) player.target = null;
        }
      }
    }

    // slow regen
    player.regen += dt;
    if (player.regen > 2) {
      player.regen = 0;
      if (player.hp < player.maxhp) player.hp = Math.min(player.maxhp, player.hp + 1);
    }

    // loot pickup
    for (let i = world.loot.length - 1; i >= 0; i--) {
      const it = world.loot[i];
      if (dist(player.x, player.y, it.x, it.y) < 10) {
        player.inv[it.type]++;
        addFloat(world, player.x, player.y - 16, `+1 ${it.type === "bones" ? "bone" : "coin"}`, "#fff2c4");
        beep(it.type === "coins" ? 880 : 520, 0.08, "triangle", 0.06);
        world.loot.splice(i, 1);
      }
    }
  }

  // monsters chase/attack the player
  const tgt = { x: player.x, y: player.y, dead: player.dead };
  updateMonsters(world, dt, tgt, (m: Monster) => {
    const dd = MONSTER_DEFS[m.kind].dmg;
    hurtPlayer(world, player, rndi(dd[0], dd[1]));
  });

  // respawns
  for (let i = world.respawns.length - 1; i >= 0; i--) {
    world.respawns[i].t -= dt;
    if (world.respawns[i].t <= 0) {
      spawnMonster(world, world.respawns[i].kind);
      world.respawns.splice(i, 1);
    }
  }

  updateFloats(dt);
  for (const it of world.loot) it.t += dt;
  if (moveMarker) {
    moveMarker.t -= dt;
    if (moveMarker.t <= 0) moveMarker = null;
  }

  cam.x = clamp(player.x - VIEW_W / 2, 0, MAP_W * TILE - VIEW_W);
  cam.y = clamp(player.y - VIEW_H / 2, 0, MAP_H * TILE - VIEW_H);
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

function drawPortal(): void {
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
  if (player.dead) {
    vctx.drawImage(SPR.bones, Math.floor(player.x - cam.x) - 4, Math.floor(player.y - cam.y) - 4);
    return;
  }
  drawShadow(player.x, player.y, 9);
  const moving =
    player.dest !== null ||
    player.target !== null ||
    isDown("w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright");
  const bob = moving && Math.sin(player.bob) > 0 ? -1 : 0;
  const x = Math.floor(player.x - 5 - cam.x);
  const y = Math.floor(player.y - 13 - cam.y) + bob;
  vctx.drawImage(player.spr, x, y);
  if (player.face >= 0) {
    vctx.drawImage(SPR.sword, x + 10, y + 5);
  } else {
    vctx.save();
    vctx.translate(x, y + 5);
    vctx.scale(-1, 1);
    vctx.drawImage(SPR.sword, 1, 0);
    vctx.restore();
  }
  drawBar(player.x, player.y - 17, player.hp / player.maxhp);
}

interface Drawable {
  y: number;
  draw: () => void;
}

function render(): void {
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

  drawPortal();

  if (moveMarker) {
    const x = Math.floor(moveMarker.x - cam.x);
    const y = Math.floor(moveMarker.y - cam.y);
    vctx.globalAlpha = moveMarker.t;
    vctx.fillStyle = "#ffe27a";
    vctx.fillRect(x - 3, y, 7, 1);
    vctx.fillRect(x, y - 3, 1, 7);
    vctx.globalAlpha = 1;
  }

  // loot on ground
  for (const it of world.loot) {
    const s = it.type === "bones" ? SPR.bones : SPR.coin;
    const hov = Math.sin(it.t * 4) > 0 ? 0 : -1;
    vctx.drawImage(s, Math.floor(it.x - cam.x - s.width / 2), Math.floor(it.y - cam.y - s.height + 2 + hov));
  }

  // y-sorted: trees, rocks, monsters, player
  const draws: Drawable[] = [];
  for (const tr of world.trees) {
    draws.push({
      y: tr.ty * TILE + TILE,
      draw: () => {
        const x = tr.tx * TILE - cam.x;
        const y = tr.ty * TILE + TILE - 26 - cam.y;
        vctx.fillStyle = "rgba(0,0,0,.2)";
        vctx.fillRect(Math.floor(tr.tx * TILE + 2 - cam.x), Math.floor(tr.ty * TILE + TILE - 4 - cam.y), 12, 3);
        vctx.drawImage(tr.spr, Math.floor(x), Math.floor(y));
      },
    });
  }
  for (const rk of world.rocks) {
    draws.push({
      y: rk.ty * TILE + TILE - 2,
      draw: () => {
        vctx.drawImage(SPR.rock, Math.floor(rk.tx * TILE + 3 - cam.x), Math.floor(rk.ty * TILE + TILE - 8 - cam.y));
      },
    });
  }
  for (const m of world.monsters) draws.push({ y: m.y, draw: () => drawMob(m) });
  draws.push({ y: player.y, draw: drawPlayer });
  draws.sort((a, b) => a.y - b.y);
  for (const d of draws) d.draw();

  // target marker (red corner brackets)
  if (player.target && player.target.kind === "mob") {
    const m = player.target.m;
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

  drawFloats(vctx, world, cam.x, cam.y);

  // banner
  vctx.font = "bold 8px monospace";
  vctx.textAlign = "left";
  vctx.fillStyle = "rgba(0,0,0,.6)";
  vctx.fillText(`${world.name} · click a monster to fight`, 9, 15);
  vctx.fillStyle = "#cfe8d2";
  vctx.fillText(`${world.name} · click a monster to fight`, 8, 14);

  if (player.dead) {
    vctx.fillStyle = "rgba(20,10,10,.45)";
    vctx.fillRect(0, 0, VIEW_W, VIEW_H);
    vctx.textAlign = "center";
    vctx.font = "bold 20px monospace";
    vctx.fillStyle = "#ff6a5e";
    vctx.fillText("You died", VIEW_W / 2, VIEW_H / 2 - 6);
    vctx.font = "bold 8px monospace";
    vctx.fillStyle = "#f3eedd";
    vctx.fillText(`respawning in ${Math.ceil(player.deadT)}...`, VIEW_W / 2, VIEW_H / 2 + 12);
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
